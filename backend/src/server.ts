import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

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

// Non-blocking automatic schema sync for multi-slot, clinic, and receptionist support
async function safeExecute(primarySql: string, fallbackSql?: string) {
  try {
    await prisma.$executeRawUnsafe(primarySql);
  } catch {
    if (fallbackSql) {
      try {
        await prisma.$executeRawUnsafe(fallbackSql);
      } catch {}
    }
  }
}

async function ensureSchema() {
  const migrations: [string, string?][] = [
    // User email verification columns
    [`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isEmailVerified" BOOLEAN NOT NULL DEFAULT TRUE;`, `ALTER TABLE "User" ADD COLUMN "isEmailVerified" BOOLEAN DEFAULT 1;`],
    [`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationOtp" TEXT;`, `ALTER TABLE "User" ADD COLUMN "emailVerificationOtp" TEXT;`],
    [`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationOtpExpiresAt" TIMESTAMP(3);`, `ALTER TABLE "User" ADD COLUMN "emailVerificationOtpExpiresAt" DATETIME;`],

    // DoctorProfile columns
    [`ALTER TABLE "DoctorProfile" ADD COLUMN IF NOT EXISTS "slots" TEXT;`, `ALTER TABLE "DoctorProfile" ADD COLUMN "slots" TEXT;`],
    [`ALTER TABLE "DoctorProfile" ADD COLUMN IF NOT EXISTS "cabinStatus" TEXT NOT NULL DEFAULT 'IN_CABIN';`, `ALTER TABLE "DoctorProfile" ADD COLUMN "cabinStatus" TEXT DEFAULT 'IN_CABIN';`],
    [`ALTER TABLE "DoctorProfile" ADD COLUMN IF NOT EXISTS "expectedReturnTime" TEXT;`, `ALTER TABLE "DoctorProfile" ADD COLUMN "expectedReturnTime" TEXT;`],
    [`ALTER TABLE "DoctorProfile" ADD COLUMN IF NOT EXISTS "cabinStatusUpdatedAt" TIMESTAMP(3);`, `ALTER TABLE "DoctorProfile" ADD COLUMN "cabinStatusUpdatedAt" DATETIME;`],
    [`ALTER TABLE "DoctorProfile" ADD COLUMN IF NOT EXISTS "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING';`, `ALTER TABLE "DoctorProfile" ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING';`],

    // Appointment columns
    [`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "slotId" TEXT;`, `ALTER TABLE "Appointment" ADD COLUMN "slotId" TEXT;`],
    [`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "clinicId" TEXT;`, `ALTER TABLE "Appointment" ADD COLUMN "clinicId" TEXT;`],
    [`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "isForOther" BOOLEAN NOT NULL DEFAULT FALSE;`, `ALTER TABLE "Appointment" ADD COLUMN "isForOther" BOOLEAN NOT NULL DEFAULT 0;`],
    [`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "patientName" TEXT;`, `ALTER TABLE "Appointment" ADD COLUMN "patientName" TEXT;`],
    [`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "patientAge" TEXT;`, `ALTER TABLE "Appointment" ADD COLUMN "patientAge" TEXT;`],
    [`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "patientGender" TEXT;`, `ALTER TABLE "Appointment" ADD COLUMN "patientGender" TEXT;`],
    [`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING';`, `ALTER TABLE "Appointment" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING';`],
    [`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;`, `ALTER TABLE "Appointment" ADD COLUMN "approvedBy" TEXT;`],
    [`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);`, `ALTER TABLE "Appointment" ADD COLUMN "approvedAt" DATETIME;`],
    [`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "isCheckedIn" BOOLEAN NOT NULL DEFAULT FALSE;`, `ALTER TABLE "Appointment" ADD COLUMN "isCheckedIn" BOOLEAN NOT NULL DEFAULT 0;`],
    [`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3);`, `ALTER TABLE "Appointment" ADD COLUMN "checkedInAt" DATETIME;`],

    // ClinicProfile table & columns
    [
      `CREATE TABLE IF NOT EXISTS "ClinicProfile" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT UNIQUE NOT NULL,
        "clinicName" TEXT NOT NULL,
        "address" TEXT NOT NULL,
        "city" TEXT,
        "phone" TEXT,
        "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS "ClinicProfile" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT UNIQUE NOT NULL,
        "clinicName" TEXT NOT NULL,
        "address" TEXT NOT NULL,
        "city" TEXT,
        "phone" TEXT,
        "isVerified" BOOLEAN NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`
    ],
    [`ALTER TABLE "ClinicProfile" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT FALSE;`, `ALTER TABLE "ClinicProfile" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT 0;`],
    [`ALTER TABLE "ClinicProfile" ADD COLUMN IF NOT EXISTS "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING';`, `ALTER TABLE "ClinicProfile" ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING';`],
    [`ALTER TABLE "ClinicProfile" ADD COLUMN IF NOT EXISTS "checkinCode" TEXT;`, `ALTER TABLE "ClinicProfile" ADD COLUMN "checkinCode" TEXT;`],

    // Sync verified flags
    [`UPDATE "DoctorProfile" SET "verificationStatus" = 'VERIFIED' WHERE "isVerified" = TRUE AND ("verificationStatus" IS NULL OR "verificationStatus" = 'PENDING');`, `UPDATE "DoctorProfile" SET "verificationStatus" = 'VERIFIED' WHERE "isVerified" = 1 AND ("verificationStatus" IS NULL OR "verificationStatus" = 'PENDING');`],
    [`UPDATE "ClinicProfile" SET "verificationStatus" = 'VERIFIED' WHERE "isVerified" = TRUE AND ("verificationStatus" IS NULL OR "verificationStatus" = 'PENDING');`, `UPDATE "ClinicProfile" SET "verificationStatus" = 'VERIFIED' WHERE "isVerified" = 1 AND ("verificationStatus" IS NULL OR "verificationStatus" = 'PENDING');`],

    // ReceptionistProfile table & columns
    [
      `CREATE TABLE IF NOT EXISTS "ReceptionistProfile" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT UNIQUE NOT NULL,
        "clinicId" TEXT,
        "phone" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS "ReceptionistProfile" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT UNIQUE NOT NULL,
        "clinicId" TEXT,
        "phone" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`
    ],
    [`ALTER TABLE "ReceptionistProfile" ADD COLUMN IF NOT EXISTS "clinicId" TEXT;`, `ALTER TABLE "ReceptionistProfile" ADD COLUMN "clinicId" TEXT;`],
    [`ALTER TABLE "ReceptionistProfile" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';`, `ALTER TABLE "ReceptionistProfile" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';`],

    // ClinicDoctor table & columns
    [
      `CREATE TABLE IF NOT EXISTS "ClinicDoctor" (
        "id" TEXT PRIMARY KEY,
        "clinicId" TEXT NOT NULL,
        "doctorId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ClinicDoctor_clinicId_doctorId_key" UNIQUE ("clinicId", "doctorId")
      );`,
      `CREATE TABLE IF NOT EXISTS "ClinicDoctor" (
        "id" TEXT PRIMARY KEY,
        "clinicId" TEXT NOT NULL,
        "doctorId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("clinicId", "doctorId")
      );`
    ],
    [`ALTER TABLE "ClinicDoctor" ADD COLUMN IF NOT EXISTS "consultationFee" DOUBLE PRECISION;`, `ALTER TABLE "ClinicDoctor" ADD COLUMN "consultationFee" REAL;`],
    [`ALTER TABLE "ClinicDoctor" ADD COLUMN IF NOT EXISTS "slots" TEXT;`, `ALTER TABLE "ClinicDoctor" ADD COLUMN "slots" TEXT;`],
    [`ALTER TABLE "ClinicDoctor" ADD COLUMN IF NOT EXISTS "requestedBy" TEXT NOT NULL DEFAULT 'CLINIC';`, `ALTER TABLE "ClinicDoctor" ADD COLUMN "requestedBy" TEXT NOT NULL DEFAULT 'CLINIC';`],

    // DoctorReceptionist table
    [
      `CREATE TABLE IF NOT EXISTS "DoctorReceptionist" (
        "id" TEXT PRIMARY KEY,
        "doctorId" TEXT NOT NULL,
        "receptionistId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DoctorReceptionist_doctorId_receptionistId_key" UNIQUE ("doctorId", "receptionistId")
      );`,
      `CREATE TABLE IF NOT EXISTS "DoctorReceptionist" (
        "id" TEXT PRIMARY KEY,
        "doctorId" TEXT NOT NULL,
        "receptionistId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("doctorId", "receptionistId")
      );`
    ],

    // User table columns
    [`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT FALSE;`, `ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT 0;`]
  ];

  for (const [primary, fallback] of migrations) {
    await safeExecute(primary, fallback);
  }
}

const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction || process.env.AUTO_SCHEMA_SYNC === 'true') {
  ensureSchema().catch((e) => console.warn('Schema sync notice:', e?.message));
}

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

// Security & CORS (Finding M11)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()) : []),
  'https://bikesh3764.github.io',
  'https://mediarca.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5173',
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (!isProduction) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy: Origin not allowed'));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Prevent aggressive client-side caching of dynamic live queue & medical data (BUG-30)
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
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Periodic pruning of stale rate limit entries to prevent unbounded memory growth (BUG-10)
const rateLimitPruneTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now >= entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);
if (rateLimitPruneTimer.unref) {
  rateLimitPruneTimer.unref();
}

const authRateLimiter = (maxRequests = 40, windowSeconds = 60) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'client';
    const key = `${ip}:${req.path}`;
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

// Rate Limiting for public directory & queue preview endpoints (Finding #33)
const publicApiLimiter = authRateLimiter(120, 60);
app.use(['/api/doctors', '/api/appointments/queue-preview', '/api/clinics'], publicApiLimiter);

app.use('/api/auth', authRoutes);
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
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: isProduction ? 'Internal server error occurred' : (err.message || 'Internal server error occurred'),
  });
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 MediArca API running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log(`=========================================`);
});

export default app;
