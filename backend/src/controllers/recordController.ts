import path from 'path';
import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';
import { uploadToR2, deleteFromR2, isR2Configured } from '../config/r2';
import { validateMagicBytes } from '../middleware/uploadMiddleware';

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
        message:
          'Prescription uploads are not permitted in the patient medical vault. Digital prescriptions are issued directly by doctors during consultation.',
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

    // Verify file magic bytes / signature (Finding #27)
    if (file.buffer && !validateMagicBytes(file.buffer, file.mimetype)) {
      res.status(400).json({
        success: false,
        message:
          'Invalid file signature. The uploaded file content does not match its declared type or extension.',
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
    res.status(500).json({
      success: false,
      message: 'Failed to upload document',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
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
    } else if (req.user.role === 'DOCTOR') {
      if (!patientId) {
        res.status(400).json({ success: false, message: 'patientId is required for doctor view' });
        return;
      }
      const doctor = await prisma.doctorProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (!doctor) {
        res.status(403).json({ success: false, message: 'Doctor profile not found' });
        return;
      }
      // Verify clinical relationship: doctor must have at least one appointment with this patient
      const hasRelationship = await prisma.appointment.findFirst({
        where: {
          doctorId: doctor.id,
          patientId: patientId,
        },
      });
      if (!hasRelationship) {
        res.status(403).json({
          success: false,
          message:
            'Access denied: You are only authorized to view medical records for patients with an active appointment or consultation history.',
        });
        return;
      }
    } else if (req.user.role === 'ADMIN') {
      // Authorized administrative audit access
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
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve records',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Authenticated and authorized file streaming endpoint for medical records (Finding #22)
 * Ensures only the owning patient, an authorized treating doctor, or an admin can access clinical files.
 */
export const getRecordFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const id = String(req.params.id);
    const record = await prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        patient: {
          include: { user: true },
        },
      },
    });

    if (!record) {
      res.status(404).json({ success: false, message: 'Medical record not found' });
      return;
    }

    const isOwner = req.user.role === 'PATIENT' && record.patient.userId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    let isAuthorizedDoctor = false;

    if (req.user.role === 'DOCTOR') {
      const doctor = await prisma.doctorProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (doctor) {
        const hasRelationship = await prisma.appointment.findFirst({
          where: {
            doctorId: doctor.id,
            patientId: record.patientId,
          },
        });
        isAuthorizedDoctor = Boolean(hasRelationship);
      }
    }

    if (!isOwner && !isAdmin && !isAuthorizedDoctor) {
      res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view or download this medical record.',
      });
      return;
    }

    // Serve data URI content directly
    if (record.fileUrl.startsWith('data:')) {
      const matches = record.fileUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(record.title)}"`);
        res.send(buffer);
        return;
      }
    }

    // Remote R2 / HTTP URL
    if (record.fileUrl.startsWith('http')) {
      res.redirect(record.fileUrl);
      return;
    }

    // Local file path with strict path traversal protection
    const normalizedRelative = path.normalize(record.fileUrl.replace(/^\/+/, ''));
    const uploadsDir = path.resolve(__dirname, '../../uploads');
    const fullPath = path.resolve(__dirname, '../../', normalizedRelative);

    if (!fullPath.startsWith(uploadsDir)) {
      res.status(403).json({ success: false, message: 'Invalid medical record file path.' });
      return;
    }

    res.sendFile(fullPath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ success: false, message: 'Medical record file not found on storage server.' });
      }
    });
  } catch (error: any) {
    console.error('getRecordFile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to access medical record file',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
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
    res.status(500).json({
      success: false,
      message: 'Failed to delete record',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};
