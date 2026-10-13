import http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';

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
import { authenticate } from './middleware/authMiddleware';
import { updateProfile } from './controllers/authController';
import { submitContactMessage } from './controllers/adminController';

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
}

// Trust proxy for accurate client IP behind Render / reverse proxies (Finding #34)
app.set('trust proxy', 1);

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
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5173',
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

// Serve static uploaded public avatars
app.use('/uploads/avatars', express.static(avatarsDir));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
  if (isProduction) {
    res.json({
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
    });
    return;
  }
  res.json({
    status: 'ok',
    database: dbStatus,
    service: 'MediArca Production Healthcare Platform API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Lightweight sliding-window rate limiter with periodic cleanup (BUG-10)
export const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

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

export const authRateLimiter = (maxRequests = 40, windowSeconds = 60, customScope?: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rawForwarded = req.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(rawForwarded)
      ? rawForwarded[0]
      : typeof rawForwarded === 'string'
        ? rawForwarded.split(',')[0].trim()
        : undefined;
    const ip = req.ip || forwardedIp || 'client';
    const pathKey = customScope || (req.originalUrl ? req.originalUrl.split('?')[0] : (req.baseUrl || req.path));
    const key = `${ip}:${pathKey}`;
    const now = Date.now();
    const entry = rateLimitMap.get(String(key));

    if (entry && now < entry.resetTime) {
      if (entry.count >= maxRequests) {
        res.status(429).json({
          success: false,
          message: 'Too many requests. Please wait a moment before trying again.',
        });
        return;
      }
      entry.count += 1;
    } else {
      rateLimitMap.set(String(key), { count: 1, resetTime: now + windowSeconds * 1000 });
    }
    next();
  };
};

// Mount Auth Rate Limiting on authentication & registration endpoints
app.use(
  ['/api/auth/login', '/api/auth/register', '/api/auth/google', '/api/receptionists/apply', '/api/receptionist/apply'],
  authRateLimiter(40, 60)
);

// Mount dedicated rate limiting on OTP verification & resend endpoints (FIX-005)
app.use(['/api/auth/verify-otp'], authRateLimiter(10, 60));
app.use(['/api/auth/resend-otp'], authRateLimiter(5, 60));

// Rate Limiting for public directory & queue preview endpoints (Finding #33)
const publicApiLimiter = authRateLimiter(120, 60);
app.use(['/api/doctors', '/api/appointments/queue-preview', '/api/clinics'], publicApiLimiter);

// Mount dedicated rate limiting on public contact form submissions (FIX-017)
// 5 submissions per 10 minutes (600 seconds) per IP/client scope
export const contactRateLimiter = authRateLimiter(5, 600, 'contact');

app.use('/api/auth', authRoutes);
app.post(['/api/contact', '/api/contact-us'], contactRateLimiter, submitContactMessage);
app.put(['/api/users/profile', '/api/user/profile'], authenticate, updateProfile);
app.put(['/api/doctors/profile', '/api/doctor/profile'], authenticate, updateProfile);
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

    // 1. Clear background rate-limit pruning timer
    if (rateLimitPruneTimer) {
      clearInterval(rateLimitPruneTimer);
    }

    // 2. Stop accepting new HTTP requests and allow in-flight requests to complete
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

    console.log('[Graceful Shutdown] Graceful shutdown sequence completed.');

    if (shouldExit) {
      process.exit(options.exitCode ?? 0);
    }
  })();

  return shutdownPromise;
};

registerProcessHandlers();

if (process.env.NODE_ENV !== 'test' && !process.env.MEDIARCA_TEST_SUITE) {
  server = app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 MediArca API running on port ${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
    console.log(`=========================================`);
  });
}

export default app;
