import { Request, Response, NextFunction } from 'express';

/**
 * Lightweight monitoring that shows up in Render's log viewer.
 *
 * - One line for every failed (>= 500) or slow request, with timing:
 *     [HTTP] 503 GET /api/doctors 2140ms
 *   Paths only (no query strings), so phone numbers or search text never reach the logs.
 * - POST /api/client-errors: the browser reports crashes here, logged as [ClientError].
 */
const SLOW_MS = Number(process.env.SLOW_REQUEST_MS || 1500);

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const path = String(req.originalUrl || req.url).split('?')[0];
    if (path === '/api/events') return; // live stream stays open by design
    if (res.statusCode >= 500 || ms >= SLOW_MS) {
      const label = res.statusCode >= 500 ? 'ERROR' : 'SLOW';
      console.warn(`[HTTP] ${label} ${res.statusCode} ${req.method} ${path} ${Math.round(ms)}ms`);
    }
  });
  next();
};

const clip = (value: unknown, max: number): string => String(value ?? '').slice(0, max);

export const receiveClientError = (req: Request, res: Response): void => {
  const body = (req.body || {}) as Record<string, unknown>;
  const page = clip(body.url, 300).split('?')[0];
  console.error(
    `[ClientError] ${clip(body.message, 300)} | page=${page} | ua=${clip(req.headers['user-agent'], 160)}\n${clip(body.stack, 1500)}`
  );
  // TEMP (FIX-043 check): which proxy headers reach the app. Remove after checking.
  if (String(body.message || '').startsWith('ipdiag')) {
    const h = req.headers;
    console.log(`[IpDiag] ip=${req.ip} sock=${req.socket?.remoteAddress} xff=${h['x-forwarded-for']} cf=${h['cf-connecting-ip']} tci=${h['true-client-ip']} xri=${h['x-real-ip']} cfray=${h['cf-ray']}`);
  }
  res.status(204).end();
};
