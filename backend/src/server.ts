import http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

export interface GracefulShutdownOptions {
  timeoutMs?: number;
  exitProcess?: boolean;
  exitCode?: number;
}

export let server: http.Server | null = null;
export let isShuttingDown = false;
let shutdownPromise: Promise<void> | null = null;

export const setServerInstance = (srv: http.Server | null): void => {
  server = srv;
};

export const resetShutdownStateForTesting = (): void => {
  isShuttingDown = false;
  shutdownPromise = null;
};

export const setIsShuttingDownForTesting = (val: boolean): void => {
  isShuttingDown = val;
};

// Top-level process crash & termination handlers to ensure runtime resilience and graceful shutdown (FIX-018)
export const registerProcessHandlers = (): void => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('🚨 Unhandled Promise Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error: Error) => {
    console.error('🚨 Uncaught Exception caught by runtime resilience handler:', error);
    gracefulShutdown('uncaughtException', { exitCode: 1 }).catch((err) => {
      console.error('[Graceful Shutdown] Fatal error during uncaughtException shutdown:', err);
      process.exit(1);
    });
  });

  process.on('SIGTERM', () => {
    gracefulShutdown('SIGTERM').catch((err) => {
      console.error('[Graceful Shutdown] Fatal error during SIGTERM shutdown:', err);
      process.exit(1);
    });
  });

  process.on('SIGINT', () => {
    gracefulShutdown('SIGINT').catch((err) => {
      console.error('[Graceful Shutdown] Fatal error during SIGINT shutdown:', err);
      process.exit(1);
    });
  });
};

import fs from 'fs';
import authRoutes from './routes/authRoutes';
import doctorRoutes from './routes/doctorRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import consultationRoutes from './routes/consultationRoutes';
import adminRoutes from './routes/adminRoutes';
import clinicRoutes from './routes/clinicRoutes';
import receptionistRoutes from './routes/receptionistRoutes';
import notificationRoutes from './routes/notificationRoutes';
import prisma from './config/database';
import { authenticate, getJwtSecret } from './middleware/authMiddleware';
import { updateProfile } from './controllers/authController';
import { submitContactMessage } from './controllers/adminController';
import { securityStore } from './utils/securityStore';
import { expireStalePendingAppointments } from './utils/maintenance';
import { blockDemoAccountChanges } from './utils/demoAccounts';
import { loadRecentPasswordChanges } from './utils/sessionRevocation';
import { publicResponseCache, invalidatePublicCacheOnWrite } from './middleware/publicResponseCache';
import { streamLiveEvents, publishOnQueueWrite, closeAllLiveStreams } from './utils/liveEvents';
import { requestLogger, receiveClientError } from './middleware/requestLogger';
import { getTrustedClientIp } from './utils/clientIp';
import { requireHuman } from './middleware/requireHuman';
import { startDbBackupSchedule } from './utils/dbBackup';

const isProduction = process.env.NODE_ENV === 'production';

const app = express();
const PORT = process.env.PORT || 5000;

// Production Startup Guard: Fail closed if JWT secret is missing, weak, or fallback (Finding #16)
const jwtSecret = process.env.JWT_SECRET;
if (isProduction) {
  if (!jwtSecret || jwtSecret === 'mediarca-fallback-jwt-secret' || jwtSecret.length < 32) {
    console.error('FATAL: In production, JWT_SECRET must be explicitly set with a minimum of 32 characters and cannot use default fallback.');
    process.exit(1);
  }

  // Production Distributed Security Guard (SEC-003)
  const redisUrl = process.env.REDIS_URL;
  const isRedisRequired = process.env.REQUIRE_REDIS !== 'false' && process.env.STRICT_DISTRIBUTED_SECURITY !== 'false';
  if (!redisUrl || !redisUrl.trim()) {
    if (isRedisRequired) {
      console.error('FATAL CONFIGURATION ERROR: In production, REDIS_URL is strictly required for distributed rate-limiting, OTP abuse protection, and account lockout security controls across instances.');
      process.exit(1);
    }
    // REQUIRE_REDIS=false: fine for a single server, limits are kept in memory
    console.log('[Config] Redis is off (REQUIRE_REDIS=false). Rate limits and lockouts are kept in memory, which is correct for one server. Add REDIS_URL before running more than one.');
  }
}

// Trust proxy for accurate client IP behind Render / reverse proxies (Finding #34)
app.set('trust proxy', 1);

// Every query value is a plain string (first one wins). A repeated key such as
// ?clinicId=a&clinicId=b used to arrive as an array and crash database filters with a 500.
export const parseQueryString = (raw: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(raw || '')) {
    if (!(key in out)) out[key] = value;
  }
  return out;
};
app.set('query parser', parseQueryString);

// Mount Helmet HTTP security headers (FIX-007)
// crossOriginResourcePolicy: 'cross-origin' allows cross-origin clients (e.g. GitHub Pages) to load static assets/avatars
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Security & CORS (Finding M11)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()) : []),
  'https://bikesh3764.github.io',
  'https://mediarca.vercel.app',
  'https://mediarca.in',
  'https://www.mediarca.in',
  'https://mediarca.pages.dev',
  // Local dev servers are only trusted outside production
  ...(isProduction
    ? []
    : [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:5000',
        'http://localhost:8081',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8081',
      ]),
].filter(Boolean) as string[];

export const checkCorsOrigin = (
  origin: string | undefined,
  isProd: boolean,
  allowed: string[],
  callback: (err: any, allow?: boolean) => void
): void => {
  if (!origin) return callback(null, true);
  if (!isProd) {
    return callback(null, true);
  }
  if (
    allowed.includes(origin) ||
    origin === 'https://mediarca.in' ||
    origin === 'https://www.mediarca.in' ||
    origin === 'https://mediarca.pages.dev' ||
    /^https:\/\/[a-z0-9-]+\.mediarca\.pages\.dev$/.test(origin)
  ) {
    return callback(null, true);
  }
  const err = new Error('Blocked by CORS policy: Origin not allowed');
  (err as any).status = 403;
  return callback(err);
};

app.use(
  cors({
    origin: (origin, callback) => {
      checkCorsOrigin(origin, isProduction, allowedOrigins, callback);
    },
    credentials: true,
  })
);

// Log failed and slow requests (visible in Render logs)
app.use(requestLogger);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Safe default caching policy for all API endpoints (BUG-30, FIX-015)
// Unspecified, private, authenticated, or dynamic endpoints default to 'no-store'.
// Only genuinely public discovery endpoints explicitly override this with publicCache().
app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Ensure avatars upload directory exists on disk (BUG-24)
const avatarsDir = path.join(__dirname, '../uploads/avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

// Serve static uploaded public avatars strictly under /uploads/avatars (SEC-001)
// The broad parent /uploads directory static mount has been removed to prevent unauthenticated file exposure.
app.use('/uploads/avatars', express.static(avatarsDir));

// Health Check (Supports Render /healthz and /api/health)
// Touches PostgreSQL database so Supabase resets 7-day inactivity countdown (Finding L2)
app.get(['/healthz', '/api/health', '/'], async (_req: Request, res: Response) => {
  if (isShuttingDown) {
    res.status(503).json({
      status: 'shutting_down',
      message: 'Server is undergoing graceful shutdown',
    });
    return;
  }
  let dbStatus = 'connected';
  try {
    await prisma.$queryRawUnsafe('SELECT 1;');
  } catch (err: any) {
    dbStatus = 'disconnected';
  }

  const redisActive = securityStore.isRedisActive();
  const redisConfigured = Boolean(process.env.REDIS_URL && process.env.REDIS_URL.trim());
  const redisStatus = redisActive ? 'connected' : (redisConfigured ? 'disconnected' : 'unconfigured');

  const isRedisRequired = isProduction && process.env.REQUIRE_REDIS !== 'false' && process.env.STRICT_DISTRIBUTED_SECURITY !== 'false';
  const isHealthy = dbStatus === 'connected' && (!isRedisRequired || redisActive);

  if (isProduction) {
    if (!isHealthy) {
      res.status(503).json({
        status: 'unavailable',
        database: dbStatus,
        redis: redisStatus,
      });
      return;
    }
    res.json({
      // Redis is optional on a single instance; only report degraded when it's required but down
      status: redisActive || !isRedisRequired ? 'ok' : 'degraded',
      database: dbStatus,
      redis: redisStatus,
    });
    return;
  }

  res.json({
    status: 'ok',
    database: dbStatus,
    redis: redisStatus,
    service: 'MediArca Production Healthcare Platform API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Lightweight sliding-window rate limiter with periodic cleanup (BUG-10, SEC-003)
export const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
securityStore.bindRateLimitMap(rateLimitMap);

// Periodic pruning of stale rate limit entries to prevent unbounded memory growth (BUG-10)
export const pruneStaleRateLimits = (): number => {
  const now = Date.now();
  let pruned = 0;
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now >= entry.resetTime) {
      rateLimitMap.delete(key);
      pruned += 1;
    }
  }
  return pruned;
};

export const rateLimitPruneTimer = setInterval(pruneStaleRateLimits, 60000);
if (rateLimitPruneTimer.unref) {
  rateLimitPruneTimer.unref();
}

// Background maintenance: Auto-expire past unconfirmed PENDING_APPROVAL appointments every 15 minutes
export const appointmentExpiryTimer =
  process.env.NODE_ENV !== 'test' && !process.env.MEDIARCA_TEST_SUITE
    ? setInterval(() => {
        expireStalePendingAppointments().catch(() => {});
      }, 15 * 60 * 1000)
    : null;
if (appointmentExpiryTimer && appointmentExpiryTimer.unref) {
  appointmentExpiryTimer.unref();
}
// Initial eager run on server startup
if (process.env.NODE_ENV !== 'test' && !process.env.MEDIARCA_TEST_SUITE) {
  expireStalePendingAppointments().catch(() => {});
}

export const normalizeRateLimitPath = (rawPath: string, baseUrl?: string): string => {
  if (baseUrl && ['/api/doctors', '/api/clinics', '/api/appointments/queue-preview'].includes(baseUrl)) {
    return baseUrl;
  }
  const clean = String(rawPath || '').split('?')[0];
  const publicPrefixMatch = clean.match(/^(\/api\/(?:doctors|clinics|appointments\/queue-preview))(?:\/.*)?$/i);
  if (publicPrefixMatch) {
    return publicPrefixMatch[1].toLowerCase();
  }
  // Lowercase and drop trailing slashes so /API/Auth/Login/ shares a bucket with /api/auth/login
  return clean
    .toLowerCase()
    .replace(/\/+$/, '')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:id');
};

// High-volume public reads: counting them in Redis added a network round trip to every
// discovery request, so they are limited per process instead (single Render instance).
const PUBLIC_CATALOG_LIMIT_KEYS = new Set(['/api/doctors', '/api/clinics', '/api/appointments/queue-preview']);

export const authRateLimiter = (
  maxRequests = 40,
  windowSeconds = 60,
  customScope?: string,
  options: { localOnly?: boolean } = {}
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Secure client IP extraction: Rely on Express-computed req.ip which respects 'trust proxy'
    // Avoid manual x-forwarded-for parsing that is susceptible to spoofing
    // Cloudflare's CF-Connecting-IP first: X-Forwarded-For can be faked by the client (FIX-043)
    const ip = getTrustedClientIp(req) || req.ip || req.socket?.remoteAddress || 'client';

    // User-scoped client differentiation prevents false-positive 429s on shared clinic Wi-Fi.
    // If req.user is not yet attached (e.g. public catalog routes mounted before auth),
    // extract and verify the JWT Bearer token from the Authorization header if present.
    let userId = (req as any).user?.id;
    if (!userId && req.headers?.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.slice(7).trim();
        if (token) {
          const secret = getJwtSecret();
          const decoded = jwt.verify(token, secret) as any;
          if (decoded && decoded.id) {
            userId = decoded.id;
            (req as any).user = (req as any).user || decoded;
          }
        }
      } catch {
        // Fall back cleanly to IP on invalid, expired, or malformed tokens
      }
    }

    const clientIdentifier = userId ? 'user:' + userId : ip;
    const rawPath = req.originalUrl ? req.originalUrl.split('?')[0] : (req.baseUrl || req.path);
    const pathKey = customScope || normalizeRateLimitPath(rawPath, req.baseUrl);
    const key = `${clientIdentifier}:${pathKey}`;

    if (options.localOnly || PUBLIC_CATALOG_LIMIT_KEYS.has(pathKey)) {
      const localOnlyResult = securityStore.incrementRateLimitSync(String(key), maxRequests, windowSeconds);
      if (!localOnlyResult.allowed) {
        res.status(429).json({
          success: false,
          message: 'Too many requests. Please wait a moment before trying again.',
        });
        return;
      }
      next();
      return;
    }

    const isCriticalAuth = /^\/api\/auth\/(login|register|google|verify-otp|resend-otp|forgot-password|reset-password)/i.test(
      req.originalUrl || req.baseUrl || req.path
    );

    // If distributed storage is strictly enforced in production, handle offline/failing store explicitly
    if (securityStore.isDistributedEnforced() && !securityStore.isRedisActive()) {
      if (isCriticalAuth) {
        res.setHeader('Retry-After', '15');
        res.status(503).json({
          success: false,
          code: 'SECURITY_STORE_UNAVAILABLE',
          message: 'Authentication service is temporarily unavailable. Shared security store is offline.',
        });
        return;
      }
      console.warn(`[RateLimiter] Distributed rate limiting is degraded for path ${pathKey}; using process-local fallback`);
      const localResult = securityStore.incrementRateLimitSync(String(key), maxRequests, windowSeconds);
      if (!localResult.allowed) {
        res.status(429).json({
          success: false,
          message: 'Too many requests. Please wait a moment before trying again.',
        });
        return;
      }
      next();
      return;
    }

    // Distributed Redis rate limiting when Redis is active
    if (securityStore.isRedisActive()) {
      securityStore
        .incrementRateLimit(key, maxRequests, windowSeconds)
        .then((result) => {
          if (!result.allowed) {
            res.setHeader('Retry-After', String(result.remainingSeconds || 15));
            res.status(429).json({
              success: false,
              message: 'Too many requests. Please wait a moment before trying again.',
            });
            return;
          }
          next();
        })
        .catch((err) => {
          if (securityStore.isDistributedEnforced() && isCriticalAuth) {
            res.setHeader('Retry-After', '15');
            res.status(503).json({
              success: false,
              code: 'SECURITY_STORE_UNAVAILABLE',
              message: 'Authentication service is temporarily unavailable. Shared security store is offline.',
            });
            return;
          }
          console.warn(`[RateLimiter] Distributed rate limit check degraded to local fallback for ${pathKey}`);
          const localResult = securityStore.incrementRateLimitSync(String(key), maxRequests, windowSeconds);
          if (!localResult.allowed) {
            res.status(429).json({
              success: false,
              message: 'Too many requests. Please wait a moment before trying again.',
            });
            return;
          }
          next();
        });
      return;
    }

    // Resilient synchronous in-memory rate limiting
    const localResult = securityStore.incrementRateLimitSync(String(key), maxRequests, windowSeconds);
    if (!localResult.allowed) {
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please wait a moment before trying again.',
      });
      return;
    }
    next();
  };
};

// Mount Auth Rate Limiting on authentication & registration endpoints
app.use(
  ['/api/auth/login', '/api/auth/register', '/api/auth/google'],
  authRateLimiter(40, 60)
);
// New accounts: 10 sign-ups an hour per visitor (FIX-044)
app.use(
  ['/api/auth/register'],
  authRateLimiter(10, 3600, 'signup')
);

// Mount dedicated rate limiting on OTP verification & resend endpoints (FIX-005)
app.use(['/api/auth/verify-otp'], authRateLimiter(10, 60));
app.use(['/api/auth/resend-otp', '/api/auth/forgot-password'], authRateLimiter(5, 60));
// Code emails across resend and reset: 15 an hour per visitor (FIX-044)
app.use(['/api/auth/resend-otp', '/api/auth/forgot-password'], authRateLimiter(15, 3600, 'otp-email'));
app.use(['/api/auth/reset-password', '/api/auth/change-password'], authRateLimiter(10, 60));

// Rate Limiting for public directory & queue preview endpoints (Finding #33)
// Public catalog paths use the in-process counter (no Redis round trip): see PUBLIC_CATALOG_LIMIT_KEYS
export const publicApiLimiter = authRateLimiter(300, 60);
app.use(['/api/doctors', '/api/appointments/queue-preview', '/api/clinics'], publicApiLimiter);

// Any successful write clears the public discovery cache below
app.use('/api', invalidatePublicCacheOnWrite);
// Push a live "queue changed" event to open screens after queue writes
app.use('/api', publishOnQueueWrite);
// Signed-out discovery lists are served from memory for 15s (each miss costs several DB round trips)
app.use(['/api/doctors', '/api/clinics/public', '/api/clinic/public'], publicResponseCache(15000));

// Mount dedicated rate limiting on public contact form submissions (FIX-017)
// 5 submissions per 10 minutes (600 seconds) per IP/client scope
export const contactRateLimiter = authRateLimiter(5, 600, 'contact');

// Browser crash reports (logged as [ClientError]); 20 per minute per visitor
app.post('/api/client-errors', authRateLimiter(20, 60, 'client-errors'), receiveClientError);

// Live updates stream (Server-Sent Events)
app.get('/api/events', authenticate, streamLiveEvents);
// Bot check on public forms that create accounts or send email (FIX-045)
app.post(
  ['/api/auth/register', '/api/auth/forgot-password'],
  requireHuman
);
app.use('/api/auth', authRoutes);
// Hidden "website" field: people never fill it, simple bots do. Pretend it worked and drop it.
const contactHoneypot = (req: Request, res: Response, next: NextFunction): void => {
  if (typeof req.body?.website === 'string' && req.body.website.trim()) {
    res.status(201).json({ success: true, message: 'Thank you! Your message has been received.' });
    return;
  }
  next();
};
app.post(['/api/contact', '/api/contact-us'], contactHoneypot, requireHuman);
app.post(['/api/contact', '/api/contact-us'], contactRateLimiter, submitContactMessage);
app.put(['/api/users/profile', '/api/user/profile'], authenticate, blockDemoAccountChanges, updateProfile);
app.put(['/api/doctors/profile', '/api/doctor/profile'], authenticate, blockDemoAccountChanges, updateProfile);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/clinic', clinicRoutes);
app.use('/api/receptionists', receptionistRoutes);
app.use('/api/receptionist', receptionistRoutes);
app.use('/api/notifications', notificationRoutes);

// Global Error Handler (Finding #31)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({
      success: false,
      message: 'File size exceeds 1 MB limit. Please upload a document under 1 MB.',
    });
    return;
  }
  const statusCode = err.status || 500;
  console.error('Unhandled Error:', err);
  res.status(statusCode).json({
    success: false,
    message: isProduction && statusCode >= 500 ? 'Internal server error occurred' : (err.message || 'Internal server error occurred'),
  });
});

// Graceful shutdown sequence handling HTTP close, in-flight completion, and database disconnection (FIX-018)
export const gracefulShutdown = (
  signal = 'SIGTERM',
  options: GracefulShutdownOptions = {}
): Promise<void> => {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  isShuttingDown = true;
  const timeoutMs = options.timeoutMs ?? parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '10000', 10);
  const shouldExit = options.exitProcess ?? (process.env.NODE_ENV !== 'test' && !process.env.MEDIARCA_TEST_SUITE);

  shutdownPromise = (async () => {
    console.log(`[Graceful Shutdown] Received ${signal}. Initiating graceful shutdown sequence (timeout: ${timeoutMs}ms)...`);

    // 1. Clear background pruning and maintenance timers
    if (rateLimitPruneTimer) {
      clearInterval(rateLimitPruneTimer);
    }
    if (appointmentExpiryTimer) {
      clearInterval(appointmentExpiryTimer);
    }

    // 2. End live update streams, then stop accepting new HTTP requests and let in-flight ones finish
    closeAllLiveStreams();
    await new Promise<void>((resolve) => {
      let closed = false;
      const timer = setTimeout(() => {
        if (!closed) {
          closed = true;
          console.warn(`[Graceful Shutdown] HTTP server close timed out after ${timeoutMs}ms. Forcing database disconnect.`);
          resolve();
        }
      }, timeoutMs);

      if (server && server.listening) {
        server.close((err) => {
          if (!closed) {
            closed = true;
            clearTimeout(timer);
            if (err) {
              console.error('[Graceful Shutdown] Error closing HTTP server:', err);
            } else {
              console.log('[Graceful Shutdown] HTTP server closed successfully.');
            }
            resolve();
          }
        });
      } else {
        if (!closed) {
          closed = true;
          clearTimeout(timer);
          resolve();
        }
      }
    });

    // 3. Disconnect Prisma connection pool after in-flight requests finish
    try {
      await prisma.$disconnect();
      console.log('[Graceful Shutdown] Database client disconnected successfully.');
    } catch (dbErr) {
      console.error('[Graceful Shutdown] Error disconnecting Prisma database client:', dbErr);
    }

    // 4. Disconnect distributed Redis client (SEC-003)
    try {
      await securityStore.disconnect();
      console.log('[Graceful Shutdown] Distributed security store disconnected successfully.');
    } catch (redisErr) {
      console.error('[Graceful Shutdown] Error disconnecting distributed security store:', redisErr);
    }

    console.log('[Graceful Shutdown] Graceful shutdown sequence completed.');

    if (shouldExit) {
      process.exit(options.exitCode ?? 0);
    }
  })();

  return shutdownPromise;
};

registerProcessHandlers();

if (process.env.NODE_ENV !== 'test' && !process.env.MEDIARCA_TEST_SUITE) {
  // Re-apply "signed out after password change" rules that were set before this restart
  loadRecentPasswordChanges().catch(() => {});
  server = app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 MediArca API running on port ${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
    console.log(`=========================================`);
  });
  // Nightly database backup to private R2 (FIX-050)
  startDbBackupSchedule();
}

export default app;
