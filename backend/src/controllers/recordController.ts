import path from 'path';
import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';
import { uploadToR2, deleteFromR2, isR2Configured } from '../config/r2';

export const uploadRecord = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.status(400).json({
    success: false,
    message: 'Medical document and prescription uploads are disabled.',
  });
};

export const getPatientRecords = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({ success: true, count: 0, data: [] });
};

export const deleteRecord = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    const patient = await prisma.patientProfile.findUnique({
      where: { userId: req.user?.id },
    });

    if (!patient) {
      res.status(403).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const record = await prisma.medicalRecord.findUnique({ where: { id } });
    if (!record || record.patientId !== patient.id) {
      res.status(404).json({ success: false, message: 'Record not found or not owned by you' });
      return;
    }

    await prisma.medicalRecord.delete({ where: { id } });

    if (record.fileUrl && (record.fileUrl.startsWith('http') || record.fileUrl.startsWith('records/'))) {
      await deleteFromR2(record.fileUrl);
    }

    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error: any) {
    console.error('deleteRecord error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete record', error: error.message });
  }
};
