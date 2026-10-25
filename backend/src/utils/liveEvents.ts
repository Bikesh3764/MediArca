import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { invalidateDoctorQueueCache } from './queueStateCache';

/**
 * Live push channel (Server-Sent Events).
 *
 * Screens open one long-lived GET /api/events stream. When queue data changes we
 * push a tiny "something changed" event and the screen re-fetches right away,
 * instead of waiting for its next poll. Polling stays on as a safety net.
 *
 * Events carry no patient data, only which doctor's queue moved.
 * In-process only (one Render instance); use Redis pub/sub if you run several.
 */
interface LiveClient {
  res: Response;
  userId: string;
  role: string;
}

const clients = new Set<LiveClient>();
const MAX_STREAMS_PER_USER = 5;
const HEARTBEAT_MS = 25000;

const write = (client: LiveClient, event: string, data: unknown): void => {
  try {
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    clients.delete(client);
  }
};

export const getLiveClientCount = (): number => clients.size;

/** GET /api/events — authenticated SSE stream. */
export const streamLiveEvents = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }
  const userId = req.user.id;

  // Drop the oldest stream when one user opens too many tabs
  const mine = [...clients].filter((c) => c.userId === userId);
  if (mine.length >= MAX_STREAMS_PER_USER) {
    const oldest = mine[0];
    clients.delete(oldest);
    try {
      oldest.res.end();
    } catch {
      /* already closed */
    }
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.write('retry: 5000\n\n');

  const client: LiveClient = { res, userId, role: req.user.role };
  clients.add(client);
  write(client, 'ready', { ok: true });

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      /* closed */
    }
  }, HEARTBEAT_MS);
  if (heartbeat.unref) heartbeat.unref();

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(client);
  });
};

/** Close all streams (used during graceful shutdown so server.close() isn't held open). */
export const closeAllLiveStreams = (): void => {
  for (const client of clients) {
    try {
      client.res.end();
    } catch {
      /* already closed */
    }
  }
  clients.clear();
};

/** Tell every open screen that a doctor's queue changed (doctorId omitted = "refresh anyway"). */
export const publishQueueChange = (doctorId?: string | null): void => {
  const payload = doctorId ? { doctorId } : {};
  for (const client of clients) write(client, 'queue', payload);
};

/** Tell one user's open screens that they have a new notification. */
export const publishNotification = (userId: string): void => {
  for (const client of clients) {
    if (client.userId === userId) write(client, 'notification', {});
  }
};

const QUEUE_WRITE_PATHS = /^\/api\/(appointments|consultations|receptionists?|doctors|clinics?)(\/|$)/i;

const findDoctorId = (body: any): string | null => {
  const candidates = [
    body?.doctorId,
    body?.data?.doctorId,
    body?.appointment?.doctorId,
    body?.data?.appointment?.doctorId,
    body?.doctor?.id,
    body?.data?.doctor?.id,
  ];
  const hit = candidates.find((v) => typeof v === 'string' && v.length > 0);
  return hit || null;
};

/**
 * After any successful queue-related write, push a live "queue" event.
 * The doctor id is read from the response when present so patients of other
 * doctors can ignore it.
 */
export const publishOnQueueWrite = (req: Request, res: Response, next: NextFunction): void => {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }
  const path = String(req.originalUrl || '').split('?')[0];
  if (!QUEUE_WRITE_PATHS.test(path)) {
    next();
    return;
  }

  let doctorId: string | null = null;
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    doctorId = findDoctorId(body) || findDoctorId((req as any).body);
    return originalJson(body);
  };

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    // Drop the 4s queue snapshot so the re-fetch that follows sees the new state
    invalidateDoctorQueueCache(doctorId || undefined);
    if (clients.size > 0) publishQueueChange(doctorId);
  });
  next();
};
