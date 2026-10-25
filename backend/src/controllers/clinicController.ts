import crypto from 'crypto';
import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';
import { isValidIndianPhone, formatIndianPhone, sanitizeIndianPhone, findExistingAccountByPhone } from '../utils/phoneUtils';
import { isDoctorEligibleForClinicalPractice, isClinicActive } from '../utils/authGuards';
import { createNotification } from '../services/notificationService';
import { parsePaginationParams, buildPaginationMetadata } from '../utils/pagination';
import { getLocalDateString, cleanSlotName, parseDoctorSlots, parseAffiliationSlots } from '../utils/scheduleUtils';

/**
 * Get profile and statistics for currently authenticated clinic
 */
export const getMyClinic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true },
        },
        receptionists: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, phone: true, createdAt: true },
            },
            doctors: {
              include: {
                doctor: {
                  include: {
                    user: { select: { id: true, fullName: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        doctors: {
          include: {
            doctor: {
              include: {
                user: {
                  select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true },
                },
              },
            },
          },
        },
      },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    // Auto-generate checkinCode if missing (BUG-03)
    if (!clinic.checkinCode) {
      const generatedCode = crypto.randomUUID();
      await prisma.clinicProfile.update({
        where: { id: clinic.id },
        data: { checkinCode: generatedCode },
      });
      clinic.checkinCode = generatedCode;
    }

    // Gate operational and patient data if clinic is unverified, pending, suspended, or rejected (Finding M2, Issue 8)
    const isNotActiveOrVerified =
      !clinic.isVerified || clinic.verificationStatus !== 'VERIFIED';

    if (isNotActiveOrVerified) {
      res.json({
        success: true,
        data: {
          clinic: {
            id: clinic.id,
            clinicName: clinic.clinicName,
            address: clinic.address,
            city: clinic.city,
            state: clinic.state,
            phone: clinic.phone || (clinic as any).user?.phone || null,
            email: (clinic as any).user?.email || null,
            avatarUrl: (clinic as any).user?.avatarUrl || null,
            fullName: (clinic as any).user?.fullName || clinic.clinicName,
            isVerified: clinic.isVerified,
            verificationStatus: clinic.verificationStatus,
            createdAt: clinic.createdAt,
          },
          doctors: [],
          incomingRequests: [],
          outgoingRequests: [],
          receptionists: [],
          incomingReceptionists: [],
          totalDoctors: 0,
          totalBookings: 0,
          totalRevenue: 0,
          recentAppointments: [],
        },
      });
      return;
    }

    // Scalable database queries: count total bookings and fetch only recent 15 appointments
    const totalBookings = await prisma.appointment.count({
      where: {
        clinicId: clinic.id,
        status: { notIn: ['CANCELLED', 'REJECTED', 'EXPIRED'] },
      },
    });

    const recentAppointments = await prisma.appointment.findMany({
      where: { clinicId: clinic.id },
      include: {
        patient: {
          include: {
            user: { select: { fullName: true, phone: true, email: true } },
          },
        },
        doctor: {
          include: {
            user: { select: { fullName: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    // Partition affiliations by status & direction
    const activeDoctorAffiliations = clinic.doctors.filter(
      (cd) => cd.status === 'ACCEPTED' || cd.status === 'ACTIVE'
    );
    const incomingDoctorRequests = clinic.doctors.filter(
      (cd) => cd.status === 'PENDING' && (cd as any).requestedBy === 'DOCTOR'
    );
    const outgoingDoctorRequests = clinic.doctors.filter(
      (cd) => cd.status === 'PENDING' && (cd as any).requestedBy === 'CLINIC'
    );

    // Compute stats per doctor specifically for THIS clinic using targeted database queries
    const doctorStats = await Promise.all(
      activeDoctorAffiliations.map(async (cd) => {
        const bookingCount = await prisma.appointment.count({
          where: {
            clinicId: clinic.id,
            doctorId: cd.doctorId,
            status: { notIn: ['CANCELLED', 'REJECTED', 'EXPIRED'] },
          },
        });
        const completedCount = await prisma.appointment.count({
          where: { clinicId: clinic.id, doctorId: cd.doctorId, status: 'COMPLETED' },
        });
        // Finding F1: Count revenue only on completed consultations or paid transactions without loading rows
        const paidOrCompletedCount = await prisma.appointment.count({
          where: {
            clinicId: clinic.id,
            doctorId: cd.doctorId,
            OR: [
              { paymentStatus: 'PAID' },
              { status: 'COMPLETED' },
            ],
            status: { notIn: ['CANCELLED', 'REJECTED', 'EXPIRED'] },
          },
        });
        const effectiveFee = typeof cd.consultationFee === 'number' && Number.isFinite(cd.consultationFee)
          ? cd.consultationFee
          : (typeof cd.doctor.consultationFee === 'number' && Number.isFinite(cd.doctor.consultationFee) ? cd.doctor.consultationFee : 0);
        const revenue = paidOrCompletedCount * effectiveFee;

        return {
          affiliationId: cd.id,
          doctorId: cd.doctor.id,
          fullName: cd.doctor.user.fullName,
          email: cd.doctor.user.email,
          phone: cd.doctor.user.phone,
          avatarUrl: cd.doctor.user.avatarUrl,
          specialty: cd.doctor.specialty,
          qualifications: cd.doctor.qualifications,
          experienceYears: cd.doctor.experienceYears,
          consultationFee: effectiveFee,
          bookingCount,
          completedCount,
          revenue,
          status: cd.status,
          requestedBy: (cd as any).requestedBy || 'CLINIC',
          joinedAt: cd.createdAt,
        };
      })
    );

    const mapRequestInfo = (cd: typeof clinic.doctors[0]) => ({
      affiliationId: cd.id,
      doctorId: cd.doctor.id,
      fullName: cd.doctor.user.fullName,
      email: cd.doctor.user.email,
      phone: cd.doctor.user.phone,
      avatarUrl: cd.doctor.user.avatarUrl,
      specialty: cd.doctor.specialty,
      qualifications: cd.doctor.qualifications,
      experienceYears: cd.doctor.experienceYears,
      consultationFee: cd.doctor.consultationFee,
      status: cd.status,
      requestedBy: (cd as any).requestedBy || 'CLINIC',
      requestedAt: cd.createdAt,
    });

    const totalDoctors = doctorStats.length;
    const totalRevenue = doctorStats.reduce((sum, d) => sum + d.revenue, 0);

    res.json({
      success: true,
      data: {
        clinic: {
          id: clinic.id,
          clinicName: clinic.clinicName,
          address: clinic.address,
          city: clinic.city,
          state: clinic.state,
          phone: clinic.phone || (clinic as any).user?.phone || null,
          email: (clinic as any).user?.email || null,
          avatarUrl: (clinic as any).user?.avatarUrl || null,
          fullName: (clinic as any).user?.fullName || clinic.clinicName,
          isVerified: clinic.isVerified,
          verificationStatus: clinic.verificationStatus,
          checkinCode: (clinic as any).checkinCode || null,
          createdAt: clinic.createdAt,
        },
        doctors: doctorStats,
        incomingRequests: incomingDoctorRequests.map(mapRequestInfo),
        outgoingRequests: outgoingDoctorRequests.map(mapRequestInfo),
        receptionists: (() => {
          const activeDocIds = new Set(activeDoctorAffiliations.map((cd) => cd.doctorId));
          return (clinic.receptionists || [])
            .filter((r) => (r as any).status !== 'PENDING' && (r as any).status !== 'REJECTED')
            .map((r) => {
              const validDoctors = r.doctors.filter((d) => activeDocIds.has(d.doctorId));
              return {
                id: r.id,
                userId: r.userId,
                fullName: r.user.fullName,
                email: r.user.email,
                phone: r.phone || r.user.phone || '',
                doctorIds: validDoctors.map((d) => d.doctorId),
                doctors: validDoctors.map((d) => ({
                  id: d.doctor.id,
                  fullName: d.doctor.user.fullName,
                  specialty: d.doctor.specialty,
                })),
                status: (r as any).status || 'ACTIVE',
                createdAt: r.createdAt,
              };
            });
        })(),
        incomingReceptionists: (clinic.receptionists || [])
          .filter((r) => (r as any).status === 'PENDING')
          .map((r) => ({
            id: r.id,
            userId: r.userId,
            fullName: r.user.fullName,
            email: r.user.email,
            phone: r.phone || r.user.phone || '',
            status: 'PENDING',
            createdAt: r.createdAt,
          })),
        totalDoctors,
        totalBookings,
        totalRevenue,
        recentAppointments: recentAppointments.map((a) => ({
          id: a.id,
          patientName: a.patientName || a.patient?.user?.fullName || 'Patient',
          patientPhone: a.patient?.user?.phone || 'N/A',
          doctorName: a.doctor?.user?.fullName || 'Doctor',
          doctorId: a.doctorId,
          date: a.appointmentDate,
          queueNumber: a.queueNumber,
          checkingWindow: a.checkingWindow,
          estimatedTime: a.estimatedTime,
          status: a.status,
          fee: activeDoctorAffiliations.find((cd) => cd.doctorId === a.doctorId)?.consultationFee ?? a.doctor.consultationFee,
        })),
      },
    });
  } catch (error: any) {
    console.error('getMyClinic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve clinic details',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Onboard / Affiliate a doctor to this clinic
 */
export const addDoctorToClinic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const { doctorEmail, doctorId } = req.body;

    if (!doctorEmail && !doctorId) {
      res.status(400).json({ success: false, message: 'Doctor email or doctor ID is required' });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    if (!clinic.isVerified || clinic.verificationStatus === 'SUSPENDED') {
      res.status(400).json({
        success: false,
        message: 'Cannot affiliate with an unverified or suspended clinic. Please wait for administrative verification.',
      });
      return;
    }

    let doctor: any;
    if (doctorId) {
      doctor = await prisma.doctorProfile.findUnique({
        where: { id: doctorId },
        include: {
          user: {
            select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, role: true },
          },
        },
      });
      if (!doctor) {
        doctor = await prisma.doctorProfile.findUnique({
          where: { userId: doctorId },
          include: {
            user: {
              select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, role: true },
            },
          },
        });
      }
    } else if (doctorEmail) {
      const user = await prisma.user.findUnique({
        where: {
          email_role: {
            email: doctorEmail.toLowerCase().trim(),
            role: 'DOCTOR',
          },
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          role: true,
          doctorProfile: true,
        },
      });
      if (user && user.doctorProfile) {
        const { doctorProfile, ...safeUser } = user;
        doctor = { ...doctorProfile, user: safeUser };
      }
    }

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found with provided identifier' });
      return;
    }

    const docCheck = isDoctorEligibleForClinicalPractice(doctor);
    if (!docCheck.eligible) {
      res.status(400).json({
        success: false,
        message: docCheck.reason || 'Doctor is pending administrative verification. Unverified doctors cannot be affiliated with clinics.',
      });
      return;
    }

    // Check if affiliation already exists
    const existing = await prisma.clinicDoctor.findUnique({
      where: {
        clinicId_doctorId: {
          clinicId: clinic.id,
          doctorId: doctor.id,
        },
      },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED' || existing.status === 'ACTIVE') {
        res.status(400).json({ success: false, message: 'Doctor is already affiliated with this clinic' });
        return;
      }
      if (existing.status === 'PENDING') {
        if ((existing as any).requestedBy === 'DOCTOR') {
          // Doctor already requested, auto-accept
          const accepted = await prisma.clinicDoctor.update({
            where: { id: existing.id },
            data: { status: 'ACCEPTED' },
            include: {
              doctor: {
                include: { user: { select: { fullName: true, email: true, phone: true } } },
              },
            },
          });
          createNotification(
            doctor.userId,
            'Affiliation Request Accepted',
            `${clinic.clinicName} has accepted your clinic affiliation request.`,
            'SYSTEM'
          ).catch(() => {});

          res.status(200).json({
            success: true,
            message: `Accepted affiliation request from Dr. ${doctor.user.fullName}`,
            data: accepted,
          });
          return;
        }
        res.status(400).json({
          success: false,
          message: 'An affiliation request has already been sent to this doctor and is pending their acceptance',
        });
        return;
      }
      if (existing.status === 'REJECTED') {
        const renewed = await prisma.clinicDoctor.update({
          where: { id: existing.id },
          data: { status: 'PENDING', requestedBy: 'CLINIC' },
          include: {
            doctor: {
              include: { user: { select: { fullName: true, email: true, phone: true } } },
            },
          },
        });

        createNotification(
          doctor.userId,
          'Clinic Affiliation Invitation',
          `${clinic.clinicName} has invited you to affiliate with their clinic facility.`,
          'SYSTEM'
        ).catch(() => {});

        res.status(201).json({
          success: true,
          message: `Affiliation request sent to Dr. ${doctor.user.fullName}. They must accept before appearing in active staff.`,
          data: renewed,
        });
        return;
      }
    }

    const affiliation = await prisma.clinicDoctor.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        status: 'PENDING',
        requestedBy: 'CLINIC',
      },
      include: {
        doctor: {
          include: {
            user: { select: { fullName: true, email: true, phone: true } },
          },
        },
      },
    });

    createNotification(
      doctor.userId,
      'Clinic Affiliation Invitation',
      `${clinic.clinicName} has invited you to affiliate with their clinic facility.`,
      'SYSTEM'
    ).catch(() => {});

    res.status(201).json({
      success: true,
      message: `Affiliation request sent to Dr. ${doctor.user.fullName}. They must accept before appearing in active staff.`,
      data: affiliation,
    });
  } catch (error: any) {
    console.error('addDoctorToClinic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to onboard doctor',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Respond to an incoming affiliation request from a doctor (ACCEPT or REJECT)
 */
export const respondToDoctorAffiliation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const affiliationId = String(req.params.affiliationId);
    const { action } = req.body;

    if (!action || !['ACCEPT', 'REJECT'].includes(action.toUpperCase())) {
      res.status(400).json({ success: false, message: 'Action must be ACCEPT or REJECT' });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    if (!clinic.isVerified || clinic.verificationStatus === 'SUSPENDED') {
      res.status(400).json({
        success: false,
        message: 'Cannot affiliate with an unverified or suspended clinic. Please wait for administrative verification.',
      });
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
        clinicId: clinic.id,
      },
      include: {
        doctor: {
          include: { user: { select: { fullName: true } } },
        },
      },
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

    if (normalizedAction === 'ACCEPT' && affiliation.requestedBy === 'CLINIC') {
      res.status(403).json({
        success: false,
        message: 'Cannot accept an affiliation request initiated by your clinic. Awaiting doctor acceptance.',
      });
      return;
    }

    const docName = affiliation.doctor.user.fullName;

    if (normalizedAction === 'ACCEPT') {
      const docCheck = isDoctorEligibleForClinicalPractice(affiliation.doctor);
      if (!docCheck.eligible) {
        res.status(400).json({
          success: false,
          message: docCheck.reason || 'Doctor is not eligible for clinical practice or affiliation.',
        });
        return;
      }

      const updated = await prisma.clinicDoctor.update({
        where: { id: affiliation.id },
        data: { status: 'ACCEPTED' },
      });

      const docProf = await prisma.doctorProfile.findUnique({
        where: { id: affiliation.doctorId },
        select: { userId: true },
      });
      if (docProf?.userId) {
        createNotification(
          docProf.userId,
          'Affiliation Request Accepted',
          `Your affiliation request with ${clinic.clinicName} was accepted. You are now active on their roster.`,
          'SYSTEM'
        ).catch(() => {});
      }

      res.json({
        success: true,
        message: `Accepted affiliation with Dr. ${docName}. Doctor is now in your active roster.`,
        data: updated,
      });
    } else {
      await prisma.clinicDoctor.delete({
        where: { id: affiliation.id },
      });

      const docProf = await prisma.doctorProfile.findUnique({
        where: { id: affiliation.doctorId },
        select: { userId: true },
      });
      if (docProf?.userId) {
        createNotification(
          docProf.userId,
          'Affiliation Request Declined',
          `Your affiliation request with ${clinic.clinicName} was not accepted.`,
          'SYSTEM'
        ).catch(() => {});
      }

      res.json({
        success: true,
        message: `Rejected affiliation request from Dr. ${docName}.`,
      });
    }
  } catch (error: any) {
    console.error('respondToDoctorAffiliation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process affiliation response',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Detach / Remove a doctor from this clinic
 */
export const removeDoctorFromClinic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const doctorId = String(req.params.doctorId);

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    // Find all receptionists belonging to this clinic
    const clinicReceptionists = await prisma.receptionistProfile.findMany({
      where: { clinicId: clinic.id },
      select: { id: true },
    });
    const recIds = clinicReceptionists.map((r) => r.id);

    const todayStr = getLocalDateString();
    await prisma.$transaction([
      prisma.clinicDoctor.deleteMany({
        where: {
          clinicId: clinic.id,
          doctorId,
        },
      }),
      ...(recIds.length > 0
        ? [
            prisma.doctorReceptionist.deleteMany({
              where: {
                doctorId,
                receptionistId: { in: recIds },
              },
            }),
          ]
        : []),
      ...(typeof (prisma.appointment as any)?.updateMany === 'function'
        ? [
            prisma.appointment.updateMany({
              where: {
                clinicId: clinic.id,
                doctorId,
                appointmentDate: { gte: todayStr },
                status: { in: ['PENDING_APPROVAL', 'WAITING'] },
              },
              data: {
                status: 'CANCELLED',
                isCheckedIn: false,
                checkedInAt: null,
              },
            }),
          ]
        : []),
    ]);

    res.json({
      success: true,
      message: 'Doctor detached from clinic successfully',
    });
  } catch (error: any) {
    console.error('removeDoctorFromClinic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove doctor affiliation',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Public listing of verified clinics
 */
export const getPublicClinics = async (req: any, res: Response): Promise<void> => {
  try {
    const { search, city, state } = req.query || {};
    const whereClause: any = {
      isVerified: true,
      verificationStatus: 'VERIFIED',
    };

    if (city && typeof city === 'string' && city.trim() && city !== 'All') {
      whereClause.city = { contains: city.trim(), mode: 'insensitive' };
    }

    if (state && typeof state === 'string' && state.trim() && state !== 'All') {
      whereClause.state = { contains: state.trim(), mode: 'insensitive' };
    }

    if (search && typeof search === 'string' && search.trim()) {
      whereClause.OR = [
        { clinicName: { contains: search.trim(), mode: 'insensitive' } },
        { address: { contains: search.trim(), mode: 'insensitive' } },
        { city: { contains: search.trim(), mode: 'insensitive' } },
        { state: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const { page, limit, skip } = parsePaginationParams(req.query, 20, 50);

    const [total, clinics] = await prisma.$transaction([
      prisma.clinicProfile.count({ where: whereClause }),
      prisma.clinicProfile.findMany({
        where: whereClause,
        select: {
          id: true,
          clinicName: true,
          address: true,
          city: true,
          state: true,
          phone: true,
          isVerified: true,
          user: {
            select: {
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              doctors: {
                where: {
                  status: { in: ['ACTIVE', 'ACCEPTED'] },
                  doctor: { isVerified: true, verificationStatus: 'VERIFIED' },
                },
              },
            },
          },
          doctors: {
            where: {
              status: { in: ['ACTIVE', 'ACCEPTED'] },
              doctor: { isVerified: true, verificationStatus: 'VERIFIED' },
            },
            select: {
              id: true,
              clinicId: true,
              doctorId: true,
              status: true,
              consultationFee: true,
              slots: true,
              doctor: {
                select: {
                  id: true,
                  specialty: true,
                  qualifications: true,
                  experienceYears: true,
                  consultationFee: true,
                  bio: true,
                  clinicAddress: true,
                  isVerified: true,
                  checkingStartTime: true,
                  checkingEndTime: true,
                  avgConsultationMinutes: true,
                  maxDailyPatients: true,
                  slots: true,
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
            },
          },
          receptionists: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              doctors: { select: { doctorId: true, status: true } },
            },
          },
        },
        orderBy: [{ clinicName: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    const formattedClinics = clinics.map((c: any) => {
      // Exclude raw receptionist internal records from public response (FIX-006)
      const { receptionists: _receptionists, user, ...cleanClinic } = c;
      return {
        ...cleanClinic,
        avatarUrl: user?.avatarUrl || null,
        hasReceptionist: (c.receptionists || []).length > 0,
        doctors: (c.doctors || []).map((cd: any) => {
          const { doctor, ...cleanCd } = cd;
          const { user, ...cleanDoctor } = doctor || {};
          return {
            ...cleanCd,
            hasReceptionist: (c.receptionists || []).some((r: any) => {
              const activeDocs = (r.doctors || []).filter((d: any) => d.status === 'ACTIVE' || !d.status);
              if (activeDocs.length === 0) return true;
              return activeDocs.some((d: any) => d.doctorId === cd.doctorId);
            }),
            doctor: {
              ...cleanDoctor,
              user: user
                ? {
                    id: user.id,
                    fullName: user.fullName,
                    avatarUrl: user.avatarUrl,
                  }
                : null,
            },
          };
        }),
      };
    });

    res.json({
      success: true,
      count: formattedClinics.length,
      data: formattedClinics,
      pagination: buildPaginationMetadata(total, page, limit),
    });
  } catch (error: any) {
    console.error('getPublicClinics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve clinics',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Public details of a verified clinic by ID
 */
export const getPublicClinicById = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const clinic = await prisma.clinicProfile.findFirst({
      where: {
        id,
        isVerified: true,
        verificationStatus: 'VERIFIED',
      },
      select: {
        id: true,
        clinicName: true,
        address: true,
        city: true,
        state: true,
        phone: true,
        isVerified: true,
        user: {
          select: {
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            doctors: {
              where: {
                status: { in: ['ACTIVE', 'ACCEPTED'] },
                doctor: { isVerified: true, verificationStatus: 'VERIFIED' },
              },
            },
          },
        },
        doctors: {
          where: {
            status: { in: ['ACTIVE', 'ACCEPTED'] },
            doctor: { isVerified: true, verificationStatus: 'VERIFIED' },
          },
          select: {
            id: true,
            clinicId: true,
            doctorId: true,
            status: true,
            consultationFee: true,
            slots: true,
            doctor: {
              select: {
                id: true,
                specialty: true,
                qualifications: true,
                experienceYears: true,
                consultationFee: true,
                bio: true,
                clinicAddress: true,
                isVerified: true,
                checkingStartTime: true,
                checkingEndTime: true,
                avgConsultationMinutes: true,
                maxDailyPatients: true,
                slots: true,
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        receptionists: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            doctors: { select: { doctorId: true, status: true } },
          },
        },
      },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic not found or not verified' });
      return;
    }

    // Exclude raw receptionist internal records from public response (FIX-006)
    const { receptionists: _receptionists, user, ...cleanClinic } = clinic;
    const formattedClinic = {
      ...cleanClinic,
      avatarUrl: user?.avatarUrl || null,
      hasReceptionist: (clinic.receptionists || []).length > 0,
      doctors: (clinic.doctors || []).map((cd: any) => {
        const { doctor, ...cleanCd } = cd;
        const { user, ...cleanDoctor } = doctor || {};
        return {
          ...cleanCd,
          hasReceptionist: (clinic.receptionists || []).some((r: any) => {
            const activeDocs = (r.doctors || []).filter((d: any) => d.status === 'ACTIVE' || !d.status);
            if (activeDocs.length === 0) return true;
            return activeDocs.some((d: any) => d.doctorId === cd.doctorId);
          }),
          doctor: {
            ...cleanDoctor,
            user: user
              ? {
                  id: user.id,
                  fullName: user.fullName,
                  avatarUrl: user.avatarUrl,
                }
              : null,
          },
        };
      }),
    };

    res.json({
      success: true,
      data: formattedClinic,
    });
  } catch (error: any) {
    console.error('getPublicClinicById error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve clinic details',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Provision / Create a Receptionist account for this Clinic
 */
export const addClinicReceptionist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const { fullName, email, password, phone, doctorIds = [] } = req.body;

    if (!fullName || !email || !password || typeof fullName !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ success: false, message: 'Receptionist name, email, and password are required and must be valid strings' });
      return;
    }

    if (password.trim().length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        doctors: {
          where: { status: { in: ['ACTIVE', 'ACCEPTED'] } },
        },
      },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    if (!clinic.isVerified || clinic.verificationStatus === 'SUSPENDED') {
      res.status(403).json({
        success: false,
        message: 'Your clinic facility is pending administrative verification or is suspended. Staff provisioning is disabled.',
      });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({
      where: {
        email_role: {
          email: cleanEmail,
          role: 'RECEPTIONIST',
        },
      },
    });

    let existingRecProfile: any = (existingUser as any)?.receptionistProfile || null;
    if (existingUser && !existingRecProfile && typeof (prisma.receptionistProfile as any)?.findUnique === 'function') {
      existingRecProfile = await prisma.receptionistProfile.findUnique({
        where: { userId: existingUser.id },
      });
    }

    if (existingUser && existingRecProfile?.status !== 'REJECTED') {
      res.status(409).json({ success: false, message: 'A receptionist account with this email already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let formattedPhone: string | null = null;
    if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
      const trimmedPhone = String(phone).trim();
      const sanitizedDigits = sanitizeIndianPhone(trimmedPhone);
      if (!isValidIndianPhone(trimmedPhone) && (!sanitizedDigits || sanitizedDigits.length !== 10 || !/^[6-9]/.test(sanitizedDigits))) {
        res.status(400).json({
          success: false,
          message: 'Invalid Indian phone number. Please enter a valid 10-digit mobile number (+91).',
        });
        return;
      }
      formattedPhone = formatIndianPhone(trimmedPhone);

      // Note: Mobile number uniqueness is disabled as per specification (uniqueness strictly on email).
      if (false) {
        const existingPhoneUser = await findExistingAccountByPhone(prisma, formattedPhone, {
          role: 'RECEPTIONIST',
          excludeUserId: existingUser?.id,
        });
        if (existingPhoneUser) {
          res.status(409).json({
            success: false,
            message: 'A receptionist account with this mobile number already exists.',
          });
          return;
        }
      }
    }

    // Validate that provided doctorIds belong to this clinic
    const clinicDoctorIds = new Set(clinic.doctors.map((cd) => cd.doctorId));
    const validDoctorIds = (Array.isArray(doctorIds) ? doctorIds : []).filter((id: string) =>
      clinicDoctorIds.has(id)
    );

    const newReceptionist = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            fullName: fullName.trim(),
            passwordHash,
            phone: formattedPhone,
            isEmailVerified: true,
            mustChangePassword: true,
            receptionistProfile: {
              upsert: {
                update: {
                  clinicId: clinic.id,
                  phone: formattedPhone,
                  status: 'ACTIVE',
                  doctors: {
                    deleteMany: {},
                    create: validDoctorIds.map((docId: string) => ({
                      doctorId: docId,
                      status: 'ACTIVE',
                    })),
                  },
                },
                create: {
                  clinicId: clinic.id,
                  phone: formattedPhone,
                  status: 'ACTIVE',
                  doctors: {
                    create: validDoctorIds.map((docId: string) => ({
                      doctorId: docId,
                      status: 'ACTIVE',
                    })),
                  },
                },
              },
            },
          },
          include: {
            receptionistProfile: {
              include: {
                doctors: {
                  include: {
                    doctor: {
                      include: {
                        user: { select: { fullName: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : await prisma.user.create({
          data: {
            fullName: fullName.trim(),
            email: cleanEmail,
            passwordHash,
            phone: formattedPhone,
            role: 'RECEPTIONIST',
            isEmailVerified: true,
            mustChangePassword: true,
            receptionistProfile: {
              create: {
                clinicId: clinic.id,
                phone: formattedPhone,
                status: 'ACTIVE',
                doctors: {
                  create: validDoctorIds.map((docId: string) => ({
                    doctorId: docId,
                    status: 'ACTIVE',
                  })),
                },
              },
            },
          },
          include: {
            receptionistProfile: {
              include: {
                doctors: {
                  include: {
                    doctor: {
                      include: {
                        user: { select: { fullName: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        });

    const { passwordHash: _, ...safeUser } = newReceptionist;
    res.status(201).json({
      success: true,
      message: `Receptionist credentials for ${fullName} created successfully`,
      data: {
        user: safeUser,
        receptionist: {
          id: newReceptionist.receptionistProfile?.id,
          fullName: newReceptionist.fullName,
          email: newReceptionist.email,
          phone: newReceptionist.phone,
          clinicId: clinic.id,
          doctors: newReceptionist.receptionistProfile?.doctors || [],
        },
      },
    });
  } catch (error: any) {
    console.error('addClinicReceptionist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to provision receptionist',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Get all receptionists provisioned by this clinic
 */
export const getClinicReceptionists = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
      include: { doctors: true },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    const activeDoctorIds = new Set(clinic.doctors.map((cd) => cd.doctorId));

    const receptionists = await prisma.receptionistProfile.findMany({
      where: { clinicId: clinic.id },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, createdAt: true } },
        doctors: {
          include: {
            doctor: {
              include: {
                user: { select: { fullName: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: receptionists.map((r) => {
        const validDoctors = r.doctors.filter((d) => activeDoctorIds.has(d.doctorId));
        return {
          id: r.id,
          userId: r.userId,
          fullName: r.user.fullName,
          email: r.user.email,
          phone: r.phone || r.user.phone || '',
          doctorIds: validDoctors.map((d) => d.doctorId),
          doctors: validDoctors.map((d) => ({
            id: d.doctor.id,
            fullName: d.doctor.user.fullName,
            specialty: d.doctor.specialty,
          })),
          createdAt: r.createdAt,
        };
      }),
    });
  } catch (error: any) {
    console.error('getClinicReceptionists error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve receptionists',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Update doctor assignments for a receptionist
 */
export const updateClinicReceptionistDoctors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const receptionistId = String(req.params.receptionistId);
    const { doctorIds } = req.body;

    if (!Array.isArray(doctorIds)) {
      res.status(400).json({ success: false, message: 'doctorIds must be an array of doctor IDs' });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
      include: { doctors: true },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    const receptionist = await prisma.receptionistProfile.findFirst({
      where: { id: receptionistId, clinicId: clinic.id },
    });

    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist not found at this clinic' });
      return;
    }

    // Filter doctorIds to only those actively affiliated with this clinic (Finding H5)
    const activeClinicDoctorIds = new Set(
      clinic.doctors
        .filter((cd) => cd.status === 'ACTIVE' || cd.status === 'ACCEPTED')
        .map((cd) => cd.doctorId)
    );
    const validDoctorIds = doctorIds.filter((id) => activeClinicDoctorIds.has(id));

    // Transactionally update doctor assignments
    await prisma.$transaction([
      prisma.doctorReceptionist.deleteMany({
        where: { receptionistId: receptionist.id },
      }),
      ...validDoctorIds.map((doctorId) =>
        prisma.doctorReceptionist.create({
          data: {
            doctorId,
            receptionistId: receptionist.id,
            status: 'ACTIVE',
          },
        })
      ),
    ]);

    res.json({
      success: true,
      message: 'Receptionist doctor assignments updated successfully',
      data: { success: true, message: 'Receptionist doctor assignments updated successfully' },
    });
  } catch (error: any) {
    console.error('updateClinicReceptionistDoctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update assignments',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Remove a receptionist from this clinic
 */
export const removeClinicReceptionist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const receptionistId = String(req.params.receptionistId);

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    const receptionist = await prisma.receptionistProfile.findFirst({
      where: { id: receptionistId, clinicId: clinic.id },
    });

    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist not found at this clinic' });
      return;
    }

    // Deleting the user cascades to ReceptionistProfile and DoctorReceptionist
    await prisma.user.delete({
      where: { id: receptionist.userId },
    });

    res.json({
      success: true,
      message: 'Receptionist removed successfully',
    });
  } catch (error: any) {
    console.error('removeClinicReceptionist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove receptionist',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Clinic Admin responds to incoming receptionist application (ACCEPT or REJECT)
 */
export const respondToReceptionistRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const { receptionistId } = req.params;
    const { action, doctorIds } = req.body;

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    const receptionist = await prisma.receptionistProfile.findFirst({
      where: { id: String(receptionistId), clinicId: clinic.id },
    });

    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist request not found for your clinic' });
      return;
    }

    if (receptionist.status && receptionist.status !== 'PENDING') {
      res.status(400).json({
        success: false,
        message: `Receptionist application has already been processed (${receptionist.status.toLowerCase()}).`,
      });
      return;
    }

    const normalizedAction = String(action || '').trim().toUpperCase();

    if (!['ACCEPT', 'REJECT'].includes(normalizedAction)) {
      res.status(400).json({ success: false, message: 'Action must be either ACCEPT or REJECT' });
      return;
    }

    if (normalizedAction === 'ACCEPT') {
      let validDoctorIds: string[] = [];
      if (Array.isArray(doctorIds) && doctorIds.length > 0) {
        // Validate submitted doctor IDs belong to this clinic
        const clinicDoctors = await prisma.clinicDoctor.findMany({
          where: { clinicId: clinic.id, status: { in: ['ACTIVE', 'ACCEPTED'] } },
          select: { doctorId: true },
        });
        const clinicDoctorIds = new Set(clinicDoctors.map((cd) => cd.doctorId));
        validDoctorIds = doctorIds.filter((docId: string) => clinicDoctorIds.has(docId));
      }

      await prisma.$transaction([
        prisma.receptionistProfile.update({
          where: { id: receptionist.id },
          data: { status: 'ACTIVE' },
        }),
        prisma.user.update({
          where: { id: receptionist.userId },
          data: {
            isEmailVerified: true,
            emailVerificationOtp: null,
            emailVerificationOtpExpiresAt: null,
          },
        }),
        ...(validDoctorIds.length > 0
          ? [
              prisma.doctorReceptionist.deleteMany({
                where: { receptionistId: receptionist.id },
              }),
              prisma.doctorReceptionist.createMany({
                data: validDoctorIds.map((docId: string) => ({
                  doctorId: docId,
                  receptionistId: receptionist.id,
                  status: 'ACTIVE',
                })),
              }),
            ]
          : []),
      ]);

      res.json({
        success: true,
        message: 'Receptionist application approved and desk permissions granted.',
      });
    } else {
      await prisma.$transaction([
        prisma.receptionistProfile.update({
          where: { id: receptionist.id },
          data: { status: 'REJECTED' },
        }),
        prisma.doctorReceptionist.deleteMany({
          where: { receptionistId: receptionist.id },
        }),
      ]);

      res.json({
        success: true,
        message: 'Receptionist application declined and desk assignments revoked.',
      });
    }
  } catch (error: any) {
    console.error('respondToReceptionistRequest error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to receptionist request',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Update clinic profile (clinicName, address, city, state, phone, avatarUrl)
 */
export const updateClinicProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const { clinicName, address, city, state, phone, avatarUrl, fullName } = req.body;

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true } },
      },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    // Validate avatarUrl: Disallow base64 data URLs in profile updates to prevent Postgres database bloat (Bug 12)
    if (avatarUrl !== undefined && avatarUrl !== null) {
      if (typeof avatarUrl === 'string' && avatarUrl.startsWith('data:image/')) {
        res.status(400).json({
          success: false,
          message: 'Base64 image data URLs are not permitted. Please upload your avatar via the official avatar upload endpoint.',
        });
        return;
      }
    }

    let formattedPhone: string | null | undefined = undefined;
    if (phone !== undefined) {
      if (phone === null || String(phone).trim() === '') {
        formattedPhone = null;
      } else {
        const trimmedPhone = String(phone).trim();
        if (!isValidIndianPhone(trimmedPhone)) {
          res.status(400).json({ success: false, message: 'Please enter a valid 10-digit Indian mobile number.' });
          return;
        }
        formattedPhone = formatIndianPhone(trimmedPhone);

        // Enforce mobile number uniqueness per role if changed
        // Note: Mobile number uniqueness is disabled as per specification (uniqueness strictly on email).
        if (false && clinic && req.user && formattedPhone !== clinic?.user?.phone) {
          const existingPhoneUser = await findExistingAccountByPhone(prisma, formattedPhone, {
            excludeUserId: req.user?.id,
            role: 'CLINIC',
          });
          if (existingPhoneUser) {
            res.status(409).json({
              success: false,
              message: 'An account with this mobile number already exists for the clinic portal. Each mobile number can only have one clinic account.',
            });
            return;
          }
        }
      }
    }

    const cleanClinicName = clinicName && typeof clinicName === 'string' ? clinicName.trim() : undefined;
    const cleanAddress = address !== undefined && typeof address === 'string' ? address.trim() : undefined;
    const cleanCity = city !== undefined ? (city ? String(city).trim() : null) : undefined;
    const cleanState = state !== undefined ? (state ? String(state).trim() : null) : undefined;

    const userUpdatePayload: any = {};
    if (cleanClinicName) {
      userUpdatePayload.fullName = cleanClinicName;
    } else if (fullName && typeof fullName === 'string' && fullName.trim()) {
      userUpdatePayload.fullName = fullName.trim();
    }
    if (formattedPhone !== undefined && formattedPhone !== null) {
      userUpdatePayload.phone = formattedPhone;
    }
    if (avatarUrl !== undefined) {
      userUpdatePayload.avatarUrl = avatarUrl;
    }

    const [updatedClinic, updatedUser] = await prisma.$transaction([
      prisma.clinicProfile.update({
        where: { id: clinic.id },
        data: {
          ...(cleanClinicName ? { clinicName: cleanClinicName } : {}),
          ...(cleanAddress !== undefined ? { address: cleanAddress } : {}),
          ...(cleanCity !== undefined ? { city: cleanCity } : {}),
          ...(cleanState !== undefined ? { state: cleanState } : {}),
          ...(formattedPhone !== undefined ? { phone: formattedPhone } : {}),
        },
      }),
      ...(Object.keys(userUpdatePayload).length > 0
        ? [
            prisma.user.update({
              where: { id: req.user.id },
              data: userUpdatePayload,
              select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, role: true },
            }),
          ]
        : [
            prisma.user.findUnique({
              where: { id: req.user.id },
              select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, role: true },
            }),
          ]),
    ]);

    res.json({
      success: true,
      message: 'Clinic profile updated successfully',
      data: {
        ...updatedClinic,
        phone: updatedClinic.phone || updatedUser?.phone || null,
        email: updatedUser?.email,
        avatarUrl: updatedUser?.avatarUrl || null,
        user: updatedUser,
      },
    });
  } catch (error: any) {
    console.error('updateClinicProfile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update clinic profile',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Generate comprehensive categorized 1-month / custom range report for Clinic
 */
export const getClinicReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: Clinic only' });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        doctors: {
          where: { status: { in: ['ACCEPTED', 'ACTIVE'] } },
          include: {
            doctor: {
              include: {
                user: { select: { fullName: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    const clinicCheck = isClinicActive(clinic);
    if (!clinicCheck.active) {
      res.status(403).json({
        success: false,
        message: clinicCheck.reason || 'Clinic account is pending verification or suspended.',
      });
      return;
    }

    const today = getLocalDateString();
    let endDate = typeof req.query.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.endDate)
      ? req.query.endDate
      : today;

    // Enforce maximum 3-month (90 days) date range clamp
    const MAX_REPORT_DAYS = 90;

    const clampToMaxDays = (endStr: string, days: number): string => {
      const parts = endStr.split('-').map(Number);
      const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      if (isNaN(dt.getTime())) return today;
      dt.setUTCDate(dt.getUTCDate() - days);
      return dt.toISOString().slice(0, 10);
    };

    const defaultStart = clampToMaxDays(endDate, MAX_REPORT_DAYS);

    let startDate = typeof req.query.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.startDate)
      ? req.query.startDate
      : defaultStart;

    if (startDate > endDate) {
      startDate = endDate;
    }

    const startParts = startDate.split('-').map(Number);
    const endParts = endDate.split('-').map(Number);
    const startMs = Date.UTC(startParts[0], startParts[1] - 1, startParts[2]);
    const endMs = Date.UTC(endParts[0], endParts[1] - 1, endParts[2]);
    const diffDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
    if (isNaN(diffDays) || diffDays > MAX_REPORT_DAYS) {
      startDate = clampToMaxDays(endDate, MAX_REPORT_DAYS);
    }

    const doctorId = req.query.doctorId as string;

    const whereClause: any = {
      clinicId: clinic.id,
      appointmentDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (doctorId && doctorId !== 'all') {
      whereClause.doctorId = doctorId;
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        doctor: {
          include: {
            user: { select: { fullName: true } },
          },
        },
        patient: {
          include: {
            user: { select: { fullName: true, phone: true } },
          },
        },
      },
      orderBy: [
        { appointmentDate: 'desc' },
        { queueNumber: 'asc' },
      ],
      take: 2000,
    });

    // Create doctor fee and slot maps from affiliations
    const doctorFeeMap = new Map<string, number>();
    const doctorSlotsMap = new Map<string, any[]>();
    clinic.doctors.forEach((cd) => {
      const fee = typeof cd.consultationFee === 'number' && Number.isFinite(cd.consultationFee)
        ? cd.consultationFee
        : (typeof cd.doctor.consultationFee === 'number' && Number.isFinite(cd.doctor.consultationFee) ? cd.doctor.consultationFee : 0);
      doctorFeeMap.set(cd.doctorId, fee);

      let cSlots = parseDoctorSlots(cd.doctor);
      if ((cd as any).slots) {
        cSlots = parseAffiliationSlots((cd as any).slots) ?? cSlots;
      }
      doctorSlotsMap.set(cd.doctorId, cSlots);
    });

    let totalRevenue = 0;
    let completedCount = 0;
    let inConsultationCount = 0;
    let waitingCount = 0;
    let cancelledCount = 0;

    const doctorBreakdownMap = new Map<string, { doctorId: string; doctorName: string; specialty: string; bookings: number; completed: number; cancelled: number; revenue: number }>();
    const shiftBreakdownMap = new Map<string, { shiftName: string; bookings: number; completed: number; revenue: number }>();

    clinic.doctors.forEach((cd) => {
      doctorBreakdownMap.set(cd.doctorId, {
        doctorId: cd.doctorId,
        doctorName: cd.doctor.user.fullName,
        specialty: cd.doctor.specialty,
        bookings: 0,
        completed: 0,
        cancelled: 0,
        revenue: 0,
      });
    });

    const items = appointments.map((appt) => {
      const effectiveFee = doctorFeeMap.get(appt.doctorId) ?? (typeof appt.doctor?.consultationFee === 'number' ? appt.doctor.consultationFee : 0);
      const isCompletedOrPaid = appt.status === 'COMPLETED' || appt.paymentStatus === 'PAID';
      const isCancelled = ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(appt.status);
      const earnedFee = (isCompletedOrPaid && !isCancelled) ? effectiveFee : 0;

      if (appt.status === 'COMPLETED') completedCount++;
      else if (appt.status === 'IN_CONSULTATION') inConsultationCount++;
      else if (appt.status === 'WAITING' || appt.status === 'PENDING_APPROVAL') waitingCount++;
      else if (isCancelled) cancelledCount++;

      totalRevenue += earnedFee;

      // Doctor Breakdown
      const docEntry = doctorBreakdownMap.get(appt.doctorId) || {
        doctorId: appt.doctorId,
        doctorName: appt.doctor?.user?.fullName || 'Doctor',
        specialty: appt.doctor?.specialty || 'General',
        bookings: 0,
        completed: 0,
        cancelled: 0,
        revenue: 0,
      };
      docEntry.bookings++;
      if (appt.status === 'COMPLETED') docEntry.completed++;
      if (isCancelled) docEntry.cancelled++;
      docEntry.revenue += earnedFee;
      doctorBreakdownMap.set(appt.doctorId, docEntry);

      // Clean shift name (ARCH-009 / FUNC-009: resolve from slotId or preserve custom shift name)
      const candidateSlots = doctorSlotsMap.get(appt.doctorId) || (appt.doctor ? parseDoctorSlots(appt.doctor) : []);
      const matchedSlotById = appt.slotId ? candidateSlots.find((s: any) => s && s.id === appt.slotId) : null;
      const rawShift = String(matchedSlotById?.name || appt.checkingWindow || 'Shift 1').trim();
      const shiftNumMatch = rawShift.match(/^shift\s*(\d+)\b/i);
      const cleanShift = shiftNumMatch ? `Shift ${shiftNumMatch[1]}` : cleanSlotName(rawShift, 'Shift 1');

      const shiftEntry = shiftBreakdownMap.get(cleanShift) || {
        shiftName: cleanShift,
        bookings: 0,
        completed: 0,
        revenue: 0,
      };
      shiftEntry.bookings++;
      if (appt.status === 'COMPLETED') shiftEntry.completed++;
      shiftEntry.revenue += earnedFee;
      shiftBreakdownMap.set(cleanShift, shiftEntry);

      return {
        id: appt.id,
        queueNumber: appt.queueNumber,
        appointmentDate: appt.appointmentDate,
        checkingWindow: cleanShift,
        status: appt.status,
        paymentStatus: appt.paymentStatus,
        patientName: appt.patientName || appt.patient?.user?.fullName || 'Walk-in Patient',
        patientPhone: (appt as any).patientPhone || appt.patient?.user?.phone || '—',
        doctorId: appt.doctorId,
        doctorName: appt.doctor?.user?.fullName || 'Doctor',
        specialty: appt.doctor?.specialty || 'General',
        fee: effectiveFee,
        earnedRevenue: earnedFee,
      };
    });

    res.json({
      success: true,
      reportType: 'CLINIC',
      facility: {
        id: clinic.id,
        name: clinic.clinicName,
        city: clinic.city || '',
        address: clinic.address || '',
        phone: clinic.phone || '',
      },
      dateRange: {
        startDate,
        endDate,
      },
      selectedDoctorId: doctorId || 'all',
      summary: {
        totalBookings: appointments.length,
        completedCount,
        inConsultationCount,
        waitingCount,
        cancelledCount,
        totalRevenue,
      },
      byDoctor: Array.from(doctorBreakdownMap.values()).filter((d) => (doctorId && doctorId !== 'all' ? d.doctorId === doctorId : true)),
      byShift: Array.from(shiftBreakdownMap.values()).sort((a, b) => a.shiftName.localeCompare(b.shiftName)),
      appointments: items,
    });
  } catch (error: any) {
    console.error('getClinicReport error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate clinic report' });
  }
};

