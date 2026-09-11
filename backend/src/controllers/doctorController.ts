import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';

export const getDoctors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, specialty, minExp, maxFee, sortBy } = req.query;

    const whereClause: any = {
      isVerified: true, // Only show verified doctors to patients/public
    };

    if (specialty && typeof specialty === 'string' && specialty !== 'All') {
      whereClause.specialty = { equals: specialty, mode: 'insensitive' };
    }

    if (minExp) {
      whereClause.experienceYears = { gte: Number(minExp) };
    }

    if (maxFee) {
      whereClause.consultationFee = { lte: Number(maxFee) };
    }

    if (search && typeof search === 'string') {
      whereClause.OR = [
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
        { specialty: { contains: search, mode: 'insensitive' } },
        { clinicAddress: { contains: search, mode: 'insensitive' } },
        { bio: { contains: search, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { rating: 'desc' };
    if (sortBy === 'fee_low') orderBy = { consultationFee: 'asc' };
    if (sortBy === 'fee_high') orderBy = { consultationFee: 'desc' };
    if (sortBy === 'experience') orderBy = { experienceYears: 'desc' };
    if (sortBy === 'rating') orderBy = { rating: 'desc' };

    const doctors = await prisma.doctorProfile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            phone: true,
          },
        },
        reviews: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          include: {
            patientUser: { select: { fullName: true, avatarUrl: true } },
          },
        },
      },
      orderBy,
    });

    res.json({ success: true, count: doctors.length, data: doctors });
  } catch (error: any) {
    console.error('getDoctors error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch doctors', error: error.message });
  }
};

export const getDoctorById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            phone: true,
          },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: {
            patientUser: { select: { fullName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found' });
      return;
    }

    res.json({ success: true, data: doctor });
  } catch (error: any) {
    console.error('getDoctorById error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch doctor details', error: error.message });
  }
};

export const updateSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Only doctors can update checking schedule' });
      return;
    }

    const {
      checkingStartTime,
      checkingEndTime,
      avgConsultationMinutes,
      maxDailyPatients,
      consultationFee,
      clinicAddress,
      bio,
    } = req.body;

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    const updated = await prisma.doctorProfile.update({
      where: { id: doctor.id },
      data: {
        ...(checkingStartTime && { checkingStartTime }),
        ...(checkingEndTime && { checkingEndTime }),
        ...(avgConsultationMinutes && { avgConsultationMinutes: Number(avgConsultationMinutes) }),
        ...(maxDailyPatients && { maxDailyPatients: Number(maxDailyPatients) }),
        ...(consultationFee && { consultationFee: Number(consultationFee) }),
        ...(clinicAddress && { clinicAddress }),
        ...(bio && { bio }),
      },
      include: { user: true },
    });

    res.json({ success: true, message: 'Schedule updated successfully', data: updated });
  } catch (error: any) {
    console.error('updateSchedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to update schedule', error: error.message });
  }
};
