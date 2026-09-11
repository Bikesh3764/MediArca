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
        clinics: {
          include: {
            clinic: true,
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
        clinics: {
          include: {
            clinic: true,
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

/**
 * Get doctor's affiliated clinics and linked receptionists
 */
export const getDoctorAffiliations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Access denied: doctor role required' });
      return;
    }

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        clinics: {
          include: {
            clinic: {
              include: {
                user: { select: { email: true, phone: true } },
              },
            },
          },
        },
        receptionists: {
          include: {
            receptionist: {
              include: {
                user: { select: { fullName: true, email: true, phone: true } },
              },
            },
          },
        },
      },
    });

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    // Get clinic-specific stats for each affiliated clinic
    const clinicsWithStats = await Promise.all(
      doctor.clinics.map(async (cd) => {
        const appointmentsAtClinic = await prisma.appointment.findMany({
          where: {
            doctorId: doctor.id,
            clinicId: cd.clinicId,
          },
        });

        const activeOrCompleted = appointmentsAtClinic.filter((a) => a.status !== 'CANCELLED');
        const revenue = activeOrCompleted.length * doctor.consultationFee;

        return {
          affiliationId: cd.id,
          clinicId: cd.clinic.id,
          clinicName: cd.clinic.clinicName,
          address: cd.clinic.address,
          city: cd.clinic.city,
          phone: cd.clinic.phone || cd.clinic.user.phone,
          email: cd.clinic.user.email,
          bookingCount: appointmentsAtClinic.length,
          revenue,
          status: cd.status,
          joinedAt: cd.createdAt,
        };
      })
    );

    const receptionists = doctor.receptionists.map((dr) => ({
      affiliationId: dr.id,
      receptionistId: dr.receptionist.id,
      fullName: dr.receptionist.user.fullName,
      email: dr.receptionist.user.email,
      phone: dr.receptionist.phone || dr.receptionist.user.phone,
      status: dr.status,
      joinedAt: dr.createdAt,
    }));

    res.json({
      success: true,
      data: {
        clinics: clinicsWithStats,
        receptionists,
      },
    });
  } catch (error: any) {
    console.error('getDoctorAffiliations error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve affiliations', error: error.message });
  }
};

/**
 * Doctor attaches an affiliated clinic
 */
export const addDoctorClinic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Access denied: doctor role required' });
      return;
    }

    const { clinicId, clinicEmail } = req.body;
    if (!clinicId && !clinicEmail) {
      res.status(400).json({ success: false, message: 'Clinic ID or clinic email is required' });
      return;
    }

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    let clinic: any;
    if (clinicId) {
      clinic = await prisma.clinicProfile.findUnique({ where: { id: clinicId } });
    } else if (clinicEmail) {
      const user = await prisma.user.findUnique({
        where: { email: clinicEmail.toLowerCase().trim() },
        include: { clinicProfile: true },
      });
      if (user?.clinicProfile) clinic = user.clinicProfile;
    }

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic not found' });
      return;
    }

    const existing = await prisma.clinicDoctor.findUnique({
      where: { clinicId_doctorId: { clinicId: clinic.id, doctorId: doctor.id } },
    });
    if (existing) {
      res.status(400).json({ success: false, message: 'Already affiliated with this clinic' });
      return;
    }

    const link = await prisma.clinicDoctor.create({
      data: { clinicId: clinic.id, doctorId: doctor.id, status: 'ACTIVE' },
      include: { clinic: true },
    });

    res.status(201).json({ success: true, message: `Affiliated with ${clinic.clinicName} successfully`, data: link });
  } catch (error: any) {
    console.error('addDoctorClinic error:', error);
    res.status(500).json({ success: false, message: 'Failed to affiliate clinic', error: error.message });
  }
};

/**
 * Doctor detaches from a clinic
 */
export const removeDoctorClinic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Access denied: doctor role required' });
      return;
    }

    const clinicId = String(req.params.clinicId);
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: req.user.id } });
    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    await prisma.clinicDoctor.deleteMany({
      where: { clinicId, doctorId: doctor.id },
    });

    res.json({ success: true, message: 'Clinic affiliation removed successfully' });
  } catch (error: any) {
    console.error('removeDoctorClinic error:', error);
    res.status(500).json({ success: false, message: 'Failed to detach clinic', error: error.message });
  }
};

/**
 * Doctor links a receptionist
 */
export const addDoctorReceptionist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Access denied: doctor role required' });
      return;
    }

    const { receptionistEmail } = req.body;
    if (!receptionistEmail) {
      res.status(400).json({ success: false, message: 'Receptionist email is required' });
      return;
    }

    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: req.user.id } });
    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: receptionistEmail.toLowerCase().trim() },
      include: { receptionistProfile: true },
    });

    if (!user || !user.receptionistProfile) {
      res.status(404).json({ success: false, message: 'Receptionist account not found with this email' });
      return;
    }

    const existing = await prisma.doctorReceptionist.findUnique({
      where: {
        doctorId_receptionistId: {
          doctorId: doctor.id,
          receptionistId: user.receptionistProfile.id,
        },
      },
    });

    if (existing) {
      res.status(400).json({ success: false, message: 'Receptionist is already linked to your desk' });
      return;
    }

    const link = await prisma.doctorReceptionist.create({
      data: {
        doctorId: doctor.id,
        receptionistId: user.receptionistProfile.id,
        status: 'ACTIVE',
      },
    });

    res.status(201).json({
      success: true,
      message: `${user.fullName} linked to your desk as receptionist`,
      data: link,
    });
  } catch (error: any) {
    console.error('addDoctorReceptionist error:', error);
    res.status(500).json({ success: false, message: 'Failed to link receptionist', error: error.message });
  }
};

/**
 * Doctor removes a receptionist
 */
export const removeDoctorReceptionist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Access denied: doctor role required' });
      return;
    }

    const receptionistId = String(req.params.receptionistId);
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: req.user.id } });
    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    await prisma.doctorReceptionist.deleteMany({
      where: {
        doctorId: doctor.id,
        receptionistId,
      },
    });

    res.json({ success: true, message: 'Receptionist unlinked successfully' });
  } catch (error: any) {
    console.error('removeDoctorReceptionist error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove receptionist', error: error.message });
  }
};
