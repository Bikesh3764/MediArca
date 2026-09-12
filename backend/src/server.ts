import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/authRoutes';
import doctorRoutes from './routes/doctorRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import consultationRoutes from './routes/consultationRoutes';
import recordRoutes from './routes/recordRoutes';
import adminRoutes from './routes/adminRoutes';
import clinicRoutes from './routes/clinicRoutes';
import receptionistRoutes from './routes/receptionistRoutes';
import prisma from './config/database';
import { authenticate } from './middleware/authMiddleware';
import { updateProfile } from './controllers/authController';

// Non-blocking automatic schema sync for multi-slot, clinic, and receptionist support
async function ensureSchema() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "DoctorProfile" ADD COLUMN IF NOT EXISTS "slots" TEXT;`);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "DoctorProfile" ADD COLUMN "slots" TEXT;`);
    } catch {}
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "slotId" TEXT;`);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Appointment" ADD COLUMN "slotId" TEXT;`);
    } catch {}
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "clinicId" TEXT;`);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Appointment" ADD COLUMN "clinicId" TEXT;`);
    } catch {}
  }

  // Ensure ClinicProfile
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ClinicProfile" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT UNIQUE NOT NULL,
        "clinicName" TEXT NOT NULL,
        "address" TEXT NOT NULL,
        "city" TEXT,
        "phone" TEXT,
        "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ClinicProfile" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT UNIQUE NOT NULL,
          "clinicName" TEXT NOT NULL,
          "address" TEXT NOT NULL,
          "city" TEXT,
          "phone" TEXT,
          "isVerified" BOOLEAN NOT NULL DEFAULT 0,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch {}
  }

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "ClinicProfile" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT FALSE;`);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "ClinicProfile" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT 0;`);
    } catch {}
  }

  // Ensure verificationStatus on DoctorProfile
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "DoctorProfile" ADD COLUMN IF NOT EXISTS "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING';`);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "DoctorProfile" ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING';`);
    } catch {}
  }

  // Ensure verificationStatus on ClinicProfile
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "ClinicProfile" ADD COLUMN IF NOT EXISTS "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING';`);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "ClinicProfile" ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING';`);
    } catch {}
  }

  // Sync existing verified records so isVerified: true matches verificationStatus: 'VERIFIED'
  try {
    await prisma.$executeRawUnsafe(`UPDATE "DoctorProfile" SET "verificationStatus" = 'VERIFIED' WHERE "isVerified" = TRUE AND ("verificationStatus" IS NULL OR "verificationStatus" = 'PENDING');`);
    await prisma.$executeRawUnsafe(`UPDATE "ClinicProfile" SET "verificationStatus" = 'VERIFIED' WHERE "isVerified" = TRUE AND ("verificationStatus" IS NULL OR "verificationStatus" = 'PENDING');`);
  } catch {}

  // Ensure ReceptionistProfile
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ReceptionistProfile" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT UNIQUE NOT NULL,
        "clinicId" TEXT,
        "phone" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ReceptionistProfile" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT UNIQUE NOT NULL,
          "clinicId" TEXT,
          "phone" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch {}
  }

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "ReceptionistProfile" ADD COLUMN IF NOT EXISTS "clinicId" TEXT;`);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "ReceptionistProfile" ADD COLUMN "clinicId" TEXT;`);
    } catch {}
  }

  // Ensure ClinicDoctor
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ClinicDoctor" (
        "id" TEXT PRIMARY KEY,
        "clinicId" TEXT NOT NULL,
        "doctorId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ClinicDoctor_clinicId_doctorId_key" UNIQUE ("clinicId", "doctorId")
      );
    `);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ClinicDoctor" (
          "id" TEXT PRIMARY KEY,
          "clinicId" TEXT NOT NULL,
          "doctorId" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE ("clinicId", "doctorId")
        );
      `);
    } catch {}
  }

  // Ensure DoctorReceptionist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DoctorReceptionist" (
        "id" TEXT PRIMARY KEY,
        "doctorId" TEXT NOT NULL,
        "receptionistId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DoctorReceptionist_doctorId_receptionistId_key" UNIQUE ("doctorId", "receptionistId")
      );
    `);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "DoctorReceptionist" (
          "id" TEXT PRIMARY KEY,
          "doctorId" TEXT NOT NULL,
          "receptionistId" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE ("doctorId", "receptionistId")
        );
      `);
    } catch {}
  }

  // Ensure User.mustChangePassword
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT FALSE;`);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT 0;`);
    } catch {}
  }

  // Ensure Appointment columns for booking for other
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "isForOther" BOOLEAN NOT NULL DEFAULT FALSE;`);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Appointment" ADD COLUMN "isForOther" BOOLEAN NOT NULL DEFAULT 0;`);
    } catch {}
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "patientName" TEXT;`);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Appointment" ADD COLUMN "patientName" TEXT;`);
    } catch {}
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "patientAge" TEXT;`);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Appointment" ADD COLUMN "patientAge" TEXT;`);
    } catch {}
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "patientGender" TEXT;`);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Appointment" ADD COLUMN "patientGender" TEXT;`);
    } catch {}
  }

  // Ensure ClinicDoctor.requestedBy
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "ClinicDoctor" ADD COLUMN IF NOT EXISTS "requestedBy" TEXT NOT NULL DEFAULT 'CLINIC';`);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "ClinicDoctor" ADD COLUMN "requestedBy" TEXT NOT NULL DEFAULT 'CLINIC';`);
    } catch {}
  }
}
ensureSchema().catch((e) => console.warn('Schema sync notice:', e?.message));

const app = express();
const PORT = process.env.PORT || 5000;

// Security & CORS
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded documents
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health Check (Supports Render /healthz and /api/health)
app.get(['/healthz', '/api/health', '/'], (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'MediArca Production Healthcare Platform API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.put(['/api/users/profile', '/api/user/profile'], authenticate, updateProfile);
app.put(['/api/doctors/profile', '/api/doctor/profile'], authenticate, updateProfile);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/clinic', clinicRoutes);
app.use('/api/receptionists', receptionistRoutes);
app.use('/api/receptionist', receptionistRoutes);

// Global Error Handler
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
    message: err.message || 'Internal server error occurred',
  });
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 MediArca API running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log(`=========================================`);
});

export default app;
