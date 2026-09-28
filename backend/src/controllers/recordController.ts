import path from 'path';
import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';
import { uploadToR2, deleteFromR2, isR2Configured } from '../config/r2';

export const uploadRecord = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'PATIENT') {
      res.status(403).json({ success: false, message: 'Only patients can upload personal medical records' });
      return;
    }

    const { title, category = 'Lab Report' } = req.body;
    const file = req.file;

    if (category && String(category).trim().toLowerCase() === 'prescription') {
      res.status(400).json({
        success: false,
        message: 'Prescription uploads are not permitted in the patient medical vault. Digital prescriptions are issued directly by doctors during consultation.',
      });
      return;
    }

    if (!file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    if (file.size > 1 * 1024 * 1024) {
      res.status(400).json({
        success: false,
        message: 'File size exceeds 1 MB limit. Please compress or optimize the file before uploading.',
      });
      return;
    }

    let patient = await prisma.patientProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!patient) {
      patient = await prisma.patientProfile.create({
        data: { userId: req.user.id },
      });
    }

    const ext = path.extname(file.originalname) || (file.mimetype.includes('pdf') ? '.pdf' : '.jpg');
    const key = `records/${patient.id}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    let fileUrl: string;
    if (isR2Configured() && file.buffer) {
      fileUrl = await uploadToR2(file.buffer, key, file.mimetype);
    } else if (file.buffer) {
      fileUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    } else {
      fileUrl = `/uploads/${(file as any).filename || 'document' + ext}`;
    }

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
      let patient = await prisma.patientProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (!patient) {
        patient = await prisma.patientProfile.create({
          data: { userId: req.user.id },
        });
      }
      patientId = patient.id;
    } else if (req.user.role === 'DOCTOR' || req.user.role === 'ADMIN') {
      if (req.user.role === 'DOCTOR' && !patientId) {
        res.status(400).json({ success: false, message: 'patientId is required for doctor view' });
        return;
      }
    } else {
      res.status(403).json({ success: false, message: 'Forbidden: Insufficient role permissions to view medical records' });
      return;
    }

    const whereClause: any = {};
    if (patientId) {
      whereClause.patientId = patientId;
    }

    const records = await prisma.medicalRecord.findMany({
      where: whereClause,
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

    if (record.fileUrl && (record.fileUrl.startsWith('http') || record.fileUrl.startsWith('records/'))) {
      await deleteFromR2(record.fileUrl);
    }

    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error: any) {
    console.error('deleteRecord error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete record', error: error.message });
  }
};
