import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';
import { parseDoctorSlots, calculateSlotMetrics, format12Hour } from '../utils/scheduleUtils';

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

    const enrichedDoctors = doctors.map((doc) => ({
      ...doc,
      slots: parseDoctorSlots(doc),
    }));

    res.json({ success: true, count: enrichedDoctors.length, data: enrichedDoctors });
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

    res.json({
      success: true,
      data: {
        ...doctor,
        slots: parseDoctorSlots(doctor),
      },
    });
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
      slots,
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

    let formattedSlots: any[] = [];
    let derivedStartTime = checkingStartTime;
    let derivedEndTime = checkingEndTime;
    let derivedMaxPatients = maxDailyPatients;
    let derivedAvgMinutes = avgConsultationMinutes;

    if (slots) {
      const parsed = typeof slots === 'string' ? JSON.parse(slots) : slots;
      if (Array.isArray(parsed) && parsed.length > 0) {
        formattedSlots = parsed.map((s: any, idx: number) => {
          const sTime = s.startTime || '09:00';
          const eTime = s.endTime || '11:00';
          const maxP = Math.max(1, Number(s.maxPatients) || 50);
          const { avgConsultationMinutes: calculatedAvg } = calculateSlotMetrics(sTime, eTime, maxP);
          return {
            id: s.id || `slot_${idx + 1}`,
            name: s.name || `Slot ${idx + 1} (${format12Hour(sTime)} – ${format12Hour(eTime)})`,
            startTime: sTime,
            endTime: eTime,
            maxPatients: maxP,
            avgConsultationMinutes: s.avgConsultationMinutes || calculatedAvg,
          };
        });

        // Set aggregate fields
        derivedStartTime = formattedSlots[0].startTime;
        derivedEndTime = formattedSlots[formattedSlots.length - 1].endTime;
        derivedMaxPatients = formattedSlots.reduce((acc, cur) => acc + cur.maxPatients, 0);
        derivedAvgMinutes = formattedSlots[0].avgConsultationMinutes;
      }
    }

    const updateData: any = {
      ...(derivedStartTime !== undefined && { checkingStartTime: derivedStartTime }),
      ...(derivedEndTime !== undefined && { checkingEndTime: derivedEndTime }),
      ...(derivedAvgMinutes !== undefined && !isNaN(Number(derivedAvgMinutes)) && {
        avgConsultationMinutes: Math.max(1, Math.round(Number(derivedAvgMinutes))),
      }),
      ...(derivedMaxPatients !== undefined && !isNaN(Number(derivedMaxPatients)) && {
        maxDailyPatients: Math.max(1, Number(derivedMaxPatients)),
      }),
      ...(consultationFee !== undefined && !isNaN(Number(consultationFee)) && {
        consultationFee: Number(consultationFee),
      }),
      ...(clinicAddress !== undefined && { clinicAddress }),
      ...(bio !== undefined && { bio }),
    };

    if (formattedSlots.length > 0) {
      updateData.slots = JSON.stringify(formattedSlots);
    }

    const updated = await prisma.doctorProfile.update({
      where: { id: doctor.id },
      data: updateData,
      include: { user: true },
    });

    res.json({
      success: true,
      message: 'Schedule and checking slots updated successfully',
      data: {
        ...updated,
        slots: parseDoctorSlots(updated),
      },
    });
  } catch (error: any) {
    console.error('updateSchedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to update schedule', error: error.message });
  }
};
