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
          where: { clinic: { isVerified: true }, status: { in: ['ACTIVE', 'ACCEPTED'] } },
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
          where: { clinic: { isVerified: true }, status: { in: ['ACTIVE', 'ACCEPTED'] } },
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
                clinic: true,
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

    // Partition affiliations by status & direction
    const activeClinics = doctor.clinics.filter(
      (cd) => cd.status === 'ACCEPTED' || cd.status === 'ACTIVE'
    );
    const incomingClinicRequests = doctor.clinics.filter(
      (cd) => cd.status === 'PENDING' && (cd as any).requestedBy === 'CLINIC'
    );
    const outgoingClinicRequests = doctor.clinics.filter(
      (cd) => cd.status === 'PENDING' && (cd as any).requestedBy === 'DOCTOR'
    );

    // Get clinic-specific stats for each affiliated clinic
    const clinicsWithStats = await Promise.all(
      activeClinics.map(async (cd) => {
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
          requestedBy: (cd as any).requestedBy || 'CLINIC',
          joinedAt: cd.createdAt,
        };
      })
    );

    const mapClinicReq = (cd: typeof doctor.clinics[0]) => ({
      affiliationId: cd.id,
      clinicId: cd.clinic.id,
      clinicName: cd.clinic.clinicName,
      address: cd.clinic.address,
      city: cd.clinic.city,
      phone: cd.clinic.phone || cd.clinic.user.phone,
      email: cd.clinic.user.email,
      status: cd.status,
      requestedBy: (cd as any).requestedBy || 'CLINIC',
      requestedAt: cd.createdAt,
    });

    // Only include receptionists whose parent clinic is actively affiliated with this doctor
    const affiliatedClinicIds = new Set(activeClinics.map((cd) => cd.clinicId));
    const receptionists = doctor.receptionists
      .filter((dr) => dr.receptionist.clinicId && affiliatedClinicIds.has(dr.receptionist.clinicId))
      .map((dr) => ({
        affiliationId: dr.id,
        receptionistId: dr.receptionist.id,
        fullName: dr.receptionist.user.fullName,
        email: dr.receptionist.user.email,
        phone: dr.receptionist.phone || dr.receptionist.user.phone,
        clinicId: dr.receptionist.clinicId,
        clinicName: dr.receptionist.clinic?.clinicName,
        status: dr.status,
        joinedAt: dr.createdAt,
      }));

    res.json({
      success: true,
      data: {
        clinics: clinicsWithStats,
        incomingRequests: incomingClinicRequests.map(mapClinicReq),
        outgoingRequests: outgoingClinicRequests.map(mapClinicReq),
        receptionists,
      },
    });
  } catch (error: any) {
    console.error('getDoctorAffiliations error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve affiliations', error: error.message });
  }
};

/**
 * Doctor requests to affiliate with a clinic
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

    if (!doctor.isVerified) {
      res.status(400).json({
        success: false,
        message: 'Doctor is pending administrative verification. Unverified doctors cannot be affiliated with clinics.',
      });
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

    if (!clinic.isVerified) {
      res.status(400).json({
        success: false,
        message: 'Cannot affiliate with an unverified clinic. Please wait for administrative verification.',
      });
      return;
    }

    const existing = await prisma.clinicDoctor.findUnique({
      where: { clinicId_doctorId: { clinicId: clinic.id, doctorId: doctor.id } },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED' || existing.status === 'ACTIVE') {
        res.status(400).json({ success: false, message: 'Already affiliated with this clinic' });
        return;
      }
      if (existing.status === 'PENDING') {
        if ((existing as any).requestedBy === 'CLINIC') {
          // Clinic already requested doctor, auto-accept
          const accepted = await prisma.clinicDoctor.update({
            where: { id: existing.id },
            data: { status: 'ACCEPTED' },
            include: { clinic: true },
          });
          res.status(200).json({
            success: true,
            message: `Affiliation with ${clinic.clinicName} accepted successfully`,
            data: accepted,
          });
          return;
        }
        res.status(400).json({
          success: false,
          message: 'An affiliation request has already been sent to this clinic and is pending acceptance',
        });
        return;
      }
      if (existing.status === 'REJECTED') {
        const renewed = await prisma.clinicDoctor.update({
          where: { id: existing.id },
          data: { status: 'PENDING', requestedBy: 'DOCTOR' },
          include: { clinic: true },
        });
        res.status(201).json({
          success: true,
          message: `Affiliation request sent to ${clinic.clinicName}. Waiting for clinic acceptance.`,
          data: renewed,
        });
        return;
      }
    }

    const link = await prisma.clinicDoctor.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        status: 'PENDING',
        requestedBy: 'DOCTOR',
      },
      include: { clinic: true },
    });

    res.status(201).json({
      success: true,
      message: `Affiliation request sent to ${clinic.clinicName}. Waiting for clinic acceptance.`,
      data: link,
    });
  } catch (error: any) {
    console.error('addDoctorClinic error:', error);
    res.status(500).json({ success: false, message: 'Failed to affiliate clinic', error: error.message });
  }
};

/**
 * Respond to an affiliation request from a clinic (ACCEPT or REJECT)
 */
export const respondToClinicAffiliation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Access denied: doctor role required' });
      return;
    }

    const affiliationId = String(req.params.affiliationId);
    const { action } = req.body;

    if (!action || !['ACCEPT', 'REJECT'].includes(action.toUpperCase())) {
      res.status(400).json({ success: false, message: 'Action must be ACCEPT or REJECT' });
      return;
    }

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    const affiliation = await prisma.clinicDoctor.findFirst({
      where: {
        id: affiliationId,
        doctorId: doctor.id,
      },
      include: { clinic: true },
    });

    if (!affiliation) {
      res.status(404).json({ success: false, message: 'Affiliation request not found' });
      return;
    }

    const clinicName = affiliation.clinic.clinicName;

    if (action.toUpperCase() === 'ACCEPT') {
      const updated = await prisma.clinicDoctor.update({
        where: { id: affiliation.id },
        data: { status: 'ACCEPTED' },
      });
      res.json({
        success: true,
        message: `Accepted affiliation with ${clinicName}. It is now in your active clinics roster.`,
        data: updated,
      });
    } else {
      await prisma.clinicDoctor.delete({
        where: { id: affiliation.id },
      });
      res.json({
        success: true,
        message: `Rejected affiliation request from ${clinicName}.`,
      });
    }
  } catch (error: any) {
    console.error('respondToClinicAffiliation error:', error);
    res.status(500).json({ success: false, message: 'Failed to process affiliation response', error: error.message });
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

    // Find all receptionists belonging to the detached clinic
    const clinicReceptionists = await prisma.receptionistProfile.findMany({
      where: { clinicId },
      select: { id: true },
    });
    const recIds = clinicReceptionists.map((r) => r.id);

    await prisma.$transaction([
      prisma.clinicDoctor.deleteMany({
        where: { clinicId, doctorId: doctor.id },
      }),
      ...(recIds.length > 0
        ? [
            prisma.doctorReceptionist.deleteMany({
              where: {
                doctorId: doctor.id,
                receptionistId: { in: recIds },
              },
            }),
          ]
        : []),
    ]);

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
  res.status(400).json({
    success: false,
    message: 'Direct receptionist linking by doctors is disabled. Receptionists are provisioned and assigned by your affiliated Clinic Administrator.',
  });
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
