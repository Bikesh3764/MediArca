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
import prisma from './config/database';

// Non-blocking automatic schema sync for multi-slot support on live Postgres/SQLite
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
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/admin', adminRoutes);

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
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
