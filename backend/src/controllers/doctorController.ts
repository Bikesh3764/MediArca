import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  parseDoctorSlots,
  calculateSlotMetrics,
  format12Hour,
  maskPatientName,
  validateDoctorSlots,
  getIndianTimeMinutes,
  minutesTo12Hour,
} from '../utils/scheduleUtils';
import { isDoctorEligibleForClinicalPractice, verifyReceptionistDoctorAccess } from '../utils/authGuards';
import { parsePaginationParams, buildPaginationMetadata } from '../utils/pagination';

export const formatDoctorClinics = (doc: any) => {
  return (doc.clinics || []).map((cd: any) => {
    let clinicSlots = parseDoctorSlots(doc);
    if (cd.slots) {
      try {
        const parsed = typeof cd.slots === 'string' ? JSON.parse(cd.slots) : cd.slots;
        if (Array.isArray(parsed) && parsed.length > 0) {
          clinicSlots = parsed;
        }
      } catch {}
    }
    const activeReceptionists = (cd.clinic?.receptionists || []).filter((r: any) => {
      if (r.status && r.status !== 'ACTIVE') return false;
      if (!r.doctors || r.doctors.length === 0) return true;
      return r.doctors.some((d: any) => d.doctorId === doc.id && (d.status === 'ACTIVE' || !d.status));
    });

    const receptionists = activeReceptionists.map((r: any) => ({
      id: r.id,
      name: r.user?.fullName || 'Reception Desk',
    }));

    // Exclude raw clinic.receptionists from public clinic projection (FIX-006)
    const { receptionists: _clinicRecs, ...cleanClinic } = cd.clinic || {};

    return {
      ...cd,
      clinic: cleanClinic,
      consultationFee: cd.consultationFee ?? doc.consultationFee,
      slots: clinicSlots,
      receptionists,
      hasReceptionist: receptionists.length > 0,
    };
  });
};

export const getDoctors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, specialty, minExp, maxFee, sortBy, clinicOnly, clinicId, state, city } = req.query;

    const whereClause: any = {
      isVerified: true,
      verificationStatus: 'VERIFIED',
    };

    if (clinicOnly === 'true' || clinicId) {
      whereClause.clinics = {
        some: {
          ...(clinicId ? { clinicId: String(clinicId) } : {}),
          status: { in: ['ACTIVE', 'ACCEPTED'] },
          clinic: { isVerified: true, verificationStatus: 'VERIFIED' },
        },
      };
    }

    if (state && typeof state === 'string' && state.trim() && state !== 'All') {
      const stateTrimmed = state.trim();
      whereClause.clinics = {
        some: {
          ...(whereClause.clinics?.some || {}),
          status: { in: ['ACTIVE', 'ACCEPTED'] },
          clinic: {
            ...(whereClause.clinics?.some?.clinic || {}),
            isVerified: true,
            verificationStatus: 'VERIFIED',
            state: { equals: stateTrimmed, mode: 'insensitive' },
          },
        },
      };
    }

    if (city && typeof city === 'string' && city.trim() && city !== 'All') {
      const cityTrimmed = city.trim();
      whereClause.clinics = {
        some: {
          ...(whereClause.clinics?.some || {}),
          status: { in: ['ACTIVE', 'ACCEPTED'] },
          clinic: {
            ...(whereClause.clinics?.some?.clinic || {}),
            isVerified: true,
            verificationStatus: 'VERIFIED',
            city: { equals: cityTrimmed, mode: 'insensitive' },
          },
        },
      };
    }

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
        {
          clinics: {
            some: {
              clinic: {
                OR: [
                  { clinicName: { contains: search, mode: 'insensitive' } },
                  { address: { contains: search, mode: 'insensitive' } },
                  { city: { contains: search, mode: 'insensitive' } },
                  { state: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
    }

    let orderBy: any[] = [{ rating: 'desc' }, { id: 'asc' }];
    if (sortBy === 'fee_low') orderBy = [{ consultationFee: 'asc' }, { id: 'asc' }];
    if (sortBy === 'fee_high') orderBy = [{ consultationFee: 'desc' }, { id: 'asc' }];
    if (sortBy === 'experience') orderBy = [{ experienceYears: 'desc' }, { id: 'asc' }];
    if (sortBy === 'rating') orderBy = [{ rating: 'desc' }, { id: 'asc' }];

    const { page, limit, skip } = parsePaginationParams(req.query, 20, 50);

    const [total, doctors] = await prisma.$transaction([
      prisma.doctorProfile.count({ where: whereClause }),
      prisma.doctorProfile.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          clinics: {
            where: { clinic: { isVerified: true, verificationStatus: 'VERIFIED' }, status: { in: ['ACTIVE', 'ACCEPTED'] } },
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
        skip,
        take: limit,
      }),
    ]);

    const enrichedDoctors = doctors.map((doc) => ({
      ...doc,
      slots: parseDoctorSlots(doc),
      clinics: formatDoctorClinics(doc),
      reviews: (doc.reviews || []).map((r) => ({
        ...r,
        patientUser: {
          fullName: maskPatientName(r.patientUser?.fullName),
          avatarUrl: null,
        },
      })),
    }));

    res.json({
      success: true,
      count: enrichedDoctors.length,
      data: enrichedDoctors,
      pagination: buildPaginationMetadata(total, page, limit),
    });
  } catch (error: any) {
    console.error('getDoctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctors',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

export const getDoctorById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    const doctorInclude = {
      user: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
      },
      clinics: {
        where: { clinic: { isVerified: true, verificationStatus: 'VERIFIED' }, status: { in: ['ACTIVE', 'ACCEPTED'] } },
        include: {
          clinic: {
            include: {
              receptionists: {
                where: { status: 'ACTIVE' },
                include: {
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                    },
                  },
                  doctors: {
                    select: {
                      doctorId: true,
                      status: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      receptionists: {
        where: { status: 'ACTIVE' },
        include: {
          receptionist: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
              clinic: {
                select: {
                  id: true,
                  clinicName: true,
                  phone: true,
                },
              },
            },
          },
        },
      },
      reviews: {
        orderBy: { createdAt: 'desc' as const },
        include: {
          patientUser: { select: { fullName: true, avatarUrl: true } },
        },
      },
    };

    let doctor = await prisma.doctorProfile.findUnique({
      where: { id },
      include: doctorInclude,
    });

    if (!doctor) {
      doctor = await prisma.doctorProfile.findUnique({
        where: { userId: id },
        include: doctorInclude,
      });
    }

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found' });
      return;
    }

    const isOwner = (req as any).user?.role === 'DOCTOR' && doctor.userId === (req as any).user?.id;
    const isAdmin = (req as any).user?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      if (!doctor.isVerified || doctor.verificationStatus !== 'VERIFIED') {
        res.status(404).json({
          success: false,
          message: 'Doctor profile is not publicly available or pending verification',
        });
        return;
      }
    }

    // Exclude personal phone numbers from public receptionist staff projection (FIX-006)
    const doctorReceptionists = (doctor.receptionists || [])
      .filter((dr: any) => dr.status === 'ACTIVE' || !dr.status)
      .map((dr: any) => ({
        id: dr.receptionist?.id,
        name: dr.receptionist?.user?.fullName || 'Reception Desk',
        clinicId: dr.receptionist?.clinicId,
        clinicName: dr.receptionist?.clinic?.clinicName,
      }));

    // Exclude raw relational receptionists from root spread to prevent data leakage (FIX-006)
    const { receptionists: _rawDocRecs, ...doctorClean } = doctor;

    res.json({
      success: true,
      data: {
        ...doctorClean,
        slots: parseDoctorSlots(doctor),
        clinics: formatDoctorClinics(doctor),
        receptionists: doctorReceptionists,
        reviews: (doctor.reviews || []).map((r) => ({
          ...r,
          patientUser: {
            fullName: maskPatientName(r.patientUser?.fullName),
            avatarUrl: null,
          },
        })),
      },
    });
  } catch (error: any) {
    console.error('getDoctorById error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctor details',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

export const updateSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Only doctors can update checking schedule' });
      return;
    }

    const {
      clinicId,
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

    const docCheck = isDoctorEligibleForClinicalPractice(doctor);
    if (!docCheck.eligible) {
      res.status(403).json({ success: false, message: docCheck.reason });
      return;
    }

    if (consultationFee !== undefined) {
      const numFee = Number(consultationFee);
      if (!Number.isFinite(numFee) || isNaN(numFee) || numFee < 0) {
        res.status(400).json({ success: false, message: 'Consultation fee must be a valid, finite non-negative number.' });
        return;
      }
    }

    let formattedSlots: any[] = [];
    let derivedStartTime = checkingStartTime;
    let derivedEndTime = checkingEndTime;
    let derivedMaxPatients = maxDailyPatients;
    let derivedAvgMinutes = avgConsultationMinutes;

    if (slots) {
      let parsed: any;
      try {
        parsed = typeof slots === 'string' ? JSON.parse(slots) : slots;
      } catch {
        res.status(400).json({ success: false, message: 'Invalid slots format: JSON parsing failed.' });
        return;
      }

      const validation = validateDoctorSlots(parsed);
      if (!validation.valid) {
        res.status(400).json({ success: false, message: validation.error });
        return;
      }

      formattedSlots = validation.formatted!;
      derivedStartTime = formattedSlots[0].startTime;
      derivedEndTime = formattedSlots[formattedSlots.length - 1].endTime;
      derivedMaxPatients = formattedSlots.reduce((acc, cur) => acc + cur.maxPatients, 0);
      derivedAvgMinutes = formattedSlots[0].avgConsultationMinutes;
    }

    // If clinicId is provided, update the clinic-specific schedule on ClinicDoctor
    if (clinicId) {
      const clinicAffiliation = await prisma.clinicDoctor.findUnique({
        where: {
          clinicId_doctorId: {
            clinicId,
            doctorId: doctor.id,
          },
        },
        include: { clinic: true },
      });

      if (!clinicAffiliation || (clinicAffiliation.status !== 'ACTIVE' && clinicAffiliation.status !== 'ACCEPTED')) {
        res.status(403).json({
          success: false,
          message: 'Active clinic affiliation required to configure clinic-specific schedule.',
        });
        return;
      }

      if (!clinicAffiliation.clinic || !clinicAffiliation.clinic.isVerified || clinicAffiliation.clinic.verificationStatus !== 'VERIFIED') {
        res.status(403).json({
          success: false,
          message: 'Clinic facility is not verified or is currently suspended from practice.',
        });
        return;
      }

      const clinicUpdateData: any = {};
      if (formattedSlots.length > 0) {
        clinicUpdateData.slots = JSON.stringify(formattedSlots);
      }
      if (consultationFee !== undefined && Number.isFinite(Number(consultationFee)) && Number(consultationFee) >= 0) {
        clinicUpdateData.consultationFee = Number(consultationFee);
      }

      await prisma.clinicDoctor.update({
        where: { id: clinicAffiliation.id },
        data: clinicUpdateData,
      });

      res.json({
        success: true,
        message: `Schedule and consultation fee for ${clinicAffiliation.clinic.clinicName} updated successfully`,
        data: {
          clinicId,
          clinicName: clinicAffiliation.clinic.clinicName,
          consultationFee: clinicUpdateData.consultationFee ?? (clinicAffiliation as any).consultationFee ?? doctor.consultationFee,
          slots: formattedSlots.length > 0 ? formattedSlots : parseDoctorSlots(doctor),
        },
      });
      return;
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
      ...(consultationFee !== undefined && Number.isFinite(Number(consultationFee)) && Number(consultationFee) >= 0 && {
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
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, role: true },
        },
      },
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
    res.status(500).json({
      success: false,
      message: 'Failed to update schedule',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
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

    // Gate affiliation operations if doctor is suspended or unverified (Finding M3)
    const docCheck = isDoctorEligibleForClinicalPractice(doctor);
    if (!docCheck.eligible) {
      res.status(403).json({ success: false, message: docCheck.reason });
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

        // Finding F2: Count revenue only on completed consultations or paid transactions
        const paidOrCompleted = appointmentsAtClinic.filter(
          (a) =>
            (a.paymentStatus === 'PAID' || a.status === 'COMPLETED') &&
            a.status !== 'CANCELLED' &&
            a.status !== 'REJECTED' &&
            a.status !== 'EXPIRED'
        );
        const clinicFee = (cd as any).consultationFee ?? doctor.consultationFee;
        const revenue = paidOrCompleted.length * clinicFee;

        let clinicSlots = parseDoctorSlots(doctor);
        if ((cd as any).slots) {
          try {
            const parsed = typeof (cd as any).slots === 'string' ? JSON.parse((cd as any).slots) : (cd as any).slots;
            if (Array.isArray(parsed) && parsed.length > 0) {
              clinicSlots = parsed;
            }
          } catch {}
        }

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
          consultationFee: clinicFee,
          slots: clinicSlots,
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
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve affiliations',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
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

    const docCheck = isDoctorEligibleForClinicalPractice(doctor);
    if (!docCheck.eligible) {
      res.status(403).json({ success: false, message: docCheck.reason });
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
    res.status(500).json({
      success: false,
      message: 'Failed to affiliate clinic',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
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

    const docCheck = isDoctorEligibleForClinicalPractice(doctor);
    if (!docCheck.eligible) {
      res.status(403).json({ success: false, message: docCheck.reason });
      return;
    }

    const normalizedAction = String(action || '').trim().toUpperCase();
    if (!['ACCEPT', 'REJECT'].includes(normalizedAction)) {
      res.status(400).json({ success: false, message: 'Action must be either ACCEPT or REJECT' });
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

    if (affiliation.status !== 'PENDING') {
      res.status(400).json({
        success: false,
        message: `Affiliation request is already ${affiliation.status.toLowerCase()}. Only pending requests can be responded to.`,
      });
      return;
    }

    if (normalizedAction === 'ACCEPT' && affiliation.requestedBy === 'DOCTOR') {
      res.status(403).json({
        success: false,
        message: 'Cannot accept an affiliation request initiated by yourself. Awaiting clinic approval.',
      });
      return;
    }

    const clinicName = affiliation.clinic.clinicName;

    if (normalizedAction === 'ACCEPT') {
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
    res.status(500).json({
      success: false,
      message: 'Failed to process affiliation response',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
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

    const docCheck = isDoctorEligibleForClinicalPractice(doctor);
    if (!docCheck.eligible) {
      res.status(403).json({ success: false, message: docCheck.reason });
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
    res.status(500).json({
      success: false,
      message: 'Failed to detach clinic',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
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

    const docCheck = isDoctorEligibleForClinicalPractice(doctor);
    if (!docCheck.eligible) {
      res.status(403).json({ success: false, message: docCheck.reason });
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
    res.status(500).json({
      success: false,
      message: 'Failed to remove receptionist',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Update Doctor Presence / Cabin Status
 * Accessible by:
 * - DOCTOR: updates own presence
 * - RECEPTIONIST: updates assigned doctor's presence
 */
export const updateCabinStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !['DOCTOR', 'RECEPTIONIST'].includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Access denied: doctor or receptionist role required' });
      return;
    }

    const { status, expectedReturnTime, returnEstimateMinutes, doctorId: targetDoctorId } = req.body;

    const validStatuses = ['IN_CABIN', 'STEPPED_OUT', 'NOT_IN_CABIN'];
    const normalizedStatus = String(status || '').toUpperCase().trim();
    if (!validStatuses.includes(normalizedStatus)) {
      res.status(400).json({
        success: false,
        message: 'Invalid cabin status. Must be IN_CABIN, STEPPED_OUT, or NOT_IN_CABIN',
      });
      return;
    }

    let doctor: any;

    if (req.user.role === 'DOCTOR') {
      doctor = await prisma.doctorProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (!doctor) {
        res.status(404).json({ success: false, message: 'Doctor profile not found' });
        return;
      }
      if (doctor.verificationStatus === 'SUSPENDED') {
        res.status(403).json({ success: false, message: 'Practitioner account is currently suspended from clinical practice.' });
        return;
      }
      if (doctor.verificationStatus === 'REJECTED') {
        res.status(403).json({ success: false, message: 'Practitioner registration has been declined by administration.' });
        return;
      }
    } else {
      // RECEPTIONIST
      if (!targetDoctorId) {
        res.status(400).json({ success: false, message: 'doctorId is required for receptionist updates' });
        return;
      }

      const access = await verifyReceptionistDoctorAccess(req.user.id, targetDoctorId, null);
      if (!access.authorized) {
        res.status(403).json({ success: false, message: access.reason || 'Unauthorized for this practitioner' });
        return;
      }

      doctor = await prisma.doctorProfile.findUnique({
        where: { id: targetDoctorId },
      });
      if (!doctor) {
        res.status(404).json({ success: false, message: 'Doctor profile not found' });
        return;
      }
    }

    // Determine expected return time formatting
    let cleanReturnTime: string | null = null;
    if (normalizedStatus === 'STEPPED_OUT') {
      if (expectedReturnTime && typeof expectedReturnTime === 'string' && expectedReturnTime.trim()) {
        cleanReturnTime = expectedReturnTime.trim();
      } else if (returnEstimateMinutes && Number.isFinite(Number(returnEstimateMinutes))) {
        const mins = Math.max(1, Math.min(480, Math.floor(Number(returnEstimateMinutes))));
        const nowMinutes = getIndianTimeMinutes(new Date());
        cleanReturnTime = minutesTo12Hour(nowMinutes + mins);
      }
    }

    const updated = await prisma.doctorProfile.update({
      where: { id: doctor.id },
      data: {
        cabinStatus: normalizedStatus,
        expectedReturnTime: cleanReturnTime,
        cabinStatusUpdatedAt: new Date(),
      },
      select: {
        id: true,
        cabinStatus: true,
        expectedReturnTime: true,
        cabinStatusUpdatedAt: true,
      },
    });

    const statusLabels: Record<string, string> = {
      IN_CABIN: 'Doctor has arrived and is in cabin',
      STEPPED_OUT: cleanReturnTime
        ? `Doctor stepped out (expected back around ${cleanReturnTime})`
        : 'Doctor has stepped out',
      NOT_IN_CABIN: 'Doctor has not yet arrived in cabin',
    };

    res.json({
      success: true,
      message: statusLabels[normalizedStatus] || 'Cabin status updated successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error('updateCabinStatus error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cabin status',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Get public reviews for a doctor with masked patient identity (BUG-08)
 */
export const getDoctorReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id },
      select: { id: true, rating: true, totalReviews: true },
    });

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found' });
      return;
    }

    const { page, limit, skip } = parsePaginationParams(req.query, 20, 50);

    const [total, reviews] = await prisma.$transaction([
      prisma.review.count({ where: { doctorId: id } }),
      prisma.review.findMany({
        where: { doctorId: id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        include: {
          patientUser: { select: { fullName: true } },
        },
      }),
    ]);

    const maskedReviews = reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      patientUser: {
        fullName: maskPatientName(r.patientUser?.fullName),
      },
    }));

    res.json({
      success: true,
      data: {
        rating: doctor.rating,
        totalReviews: doctor.totalReviews,
        reviews: maskedReviews,
        pagination: buildPaginationMetadata(total, page, limit),
      },
    });
  } catch (error: any) {
    console.error('getDoctorReviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctor reviews',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

