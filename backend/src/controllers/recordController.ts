import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';

export const uploadRecord = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'PATIENT') {
      res.status(403).json({ success: false, message: 'Only patients can upload personal medical records' });
      return;
    }

    const { title, category = 'Lab Report' } = req.body;
    const file = req.file;

    if (!file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    const patient = await prisma.patientProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!patient) {
      res.status(404).json({ success: false, message: 'Patient profile not found' });
      return;
    }

    const fileUrl = `/uploads/${file.filename}`;
    const fileType = file.mimetype.includes('pdf') ? 'pdf' : 'image';

    const record = await prisma.medicalRecord.create({
      data: {
        patientId: patient.id,
        title: title || file.originalname,
        category,
        fileUrl,
        fileType,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Medical document uploaded successfully',
      data: record,
    });
  } catch (error: any) {
    console.error('uploadRecord error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload document', error: error.message });
  }
};

export const getPatientRecords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    let patientId = req.query.patientId as string;

    if (req.user.role === 'PATIENT') {
      const patient = await prisma.patientProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (!patient) {
        res.status(404).json({ success: false, message: 'Patient profile not found' });
        return;
      }
      patientId = patient.id;
    } else if (req.user.role === 'DOCTOR' && !patientId) {
      res.status(400).json({ success: false, message: 'patientId is required for doctor view' });
      return;
    }

    const records = await prisma.medicalRecord.findMany({
      where: { patientId },
      orderBy: { uploadedAt: 'desc' },
    });

    res.json({ success: true, count: records.length, data: records });
  } catch (error: any) {
    console.error('getPatientRecords error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve records', error: error.message });
  }
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
    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error: any) {
    console.error('deleteRecord error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete record', error: error.message });
  }
};
