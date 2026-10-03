import crypto from 'crypto';
import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';
import { isValidIndianPhone, formatIndianPhone, sanitizeIndianPhone } from '../utils/phoneUtils';
import { createNotification } from '../services/notificationService';

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
      const generatedCode = crypto.randomBytes(3).toString('hex').toUpperCase();
      await prisma.clinicProfile.update({
        where: { id: clinic.id },
        data: { checkinCode: generatedCode },
      });
      clinic.checkinCode = generatedCode;
    }

    // Gate operational and patient data if clinic is suspended or rejected (Finding M2)
    const isSuspendedOrRejected =
      clinic.verificationStatus === 'SUSPENDED' || clinic.verificationStatus === 'REJECTED';

    if (isSuspendedOrRejected) {
      res.json({
        success: true,
        data: {
          clinic: {
            id: clinic.id,
            clinicName: clinic.clinicName,
            address: clinic.address,
            city: clinic.city,
            state: clinic.state,
            phone: clinic.phone,
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

    // Fetch all appointments linked to this clinic
    const clinicAppointments = await prisma.appointment.findMany({
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

    // Compute stats per doctor specifically for THIS clinic (active doctors only)
    const doctorStats = activeDoctorAffiliations.map((cd) => {
      const docAppointments = clinicAppointments.filter((a) => a.doctorId === cd.doctorId);
      const bookingCount = docAppointments.length;
      const completedCount = docAppointments.filter((a) => a.status === 'COMPLETED').length;
      // Finding F1: Count revenue only on completed consultations or paid transactions
      const paidOrCompleted = docAppointments.filter(
        (a) =>
          (a.paymentStatus === 'PAID' || a.status === 'COMPLETED') &&
          a.status !== 'CANCELLED' &&
          a.status !== 'REJECTED' &&
          a.status !== 'EXPIRED'
      );
      const effectiveFee = typeof cd.consultationFee === 'number' && Number.isFinite(cd.consultationFee)
        ? cd.consultationFee
        : (typeof cd.doctor.consultationFee === 'number' && Number.isFinite(cd.doctor.consultationFee) ? cd.doctor.consultationFee : 0);
      const revenue = paidOrCompleted.reduce((acc: number, appt: any) => {
        const apptFee = typeof appt.consultationFee === 'number' && Number.isFinite(appt.consultationFee)
          ? appt.consultationFee
          : (typeof appt.fee === 'number' && Number.isFinite(appt.fee) ? appt.fee : effectiveFee);
        return acc + apptFee;
      }, 0);

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
    });

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
    const totalBookings = clinicAppointments.length;
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
          phone: clinic.phone,
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
        recentAppointments: clinicAppointments.slice(0, 15).map((a) => ({
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
    } else if (doctorEmail) {
      const user = await prisma.user.findUnique({
        where: { email: doctorEmail.toLowerCase().trim() },
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

    if (!doctor.isVerified) {
      res.status(400).json({
        success: false,
        message: 'Doctor is pending administrative verification. Unverified doctors cannot be affiliated with clinics.',
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

    const clinics = await prisma.clinicProfile.findMany({
      where: whereClause,
      select: {
        id: true,
        clinicName: true,
        address: true,
        city: true,
        state: true,
        phone: true,
        isVerified: true,
        _count: {
          select: {
            doctors: {
              where: {
                status: { in: ['ACTIVE', 'ACCEPTED'] },
                doctor: { isVerified: true, verificationStatus: { not: 'SUSPENDED' } },
              },
            },
          },
        },
        doctors: {
          where: {
            status: { in: ['ACTIVE', 'ACCEPTED'] },
            doctor: { isVerified: true, verificationStatus: { not: 'SUSPENDED' } },
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
                rating: true,
                totalReviews: true,
                slots: true,
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    phone: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { clinicName: 'asc' },
    });

    res.json({
      success: true,
      data: clinics,
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
        _count: {
          select: {
            doctors: {
              where: {
                status: { in: ['ACTIVE', 'ACCEPTED'] },
                doctor: { isVerified: true, verificationStatus: { not: 'SUSPENDED' } },
              },
            },
          },
        },
        doctors: {
          where: {
            status: { in: ['ACTIVE', 'ACCEPTED'] },
            doctor: { isVerified: true, verificationStatus: { not: 'SUSPENDED' } },
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
                rating: true,
                totalReviews: true,
                slots: true,
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    phone: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic not found or not verified' });
      return;
    }

    res.json({
      success: true,
      data: clinic,
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

    if (!fullName || !email || !password) {
      res.status(400).json({ success: false, message: 'Receptionist name, email, and password are required' });
      return;
    }

    if (typeof password !== 'string' || password.trim().length < 8) {
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
      where: { email: cleanEmail },
    });

    if (existingUser) {
      res.status(400).json({ success: false, message: 'An account with this email already exists' });
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
    }

    // Validate that provided doctorIds belong to this clinic
    const clinicDoctorIds = new Set(clinic.doctors.map((cd) => cd.doctorId));
    const validDoctorIds = (Array.isArray(doctorIds) ? doctorIds : []).filter((id: string) =>
      clinicDoctorIds.has(id)
    );

    const newReceptionist = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: cleanEmail,
        passwordHash,
        phone: formattedPhone,
        role: 'RECEPTIONIST',
        mustChangePassword: true,
        receptionistProfile: {
          create: {
            clinicId: clinic.id,
            phone: formattedPhone,
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

    const normalizedAction = String(action || '').trim().toUpperCase();

    if (!['ACCEPT', 'REJECT'].includes(normalizedAction)) {
      res.status(400).json({ success: false, message: 'Action must be either ACCEPT or REJECT' });
      return;
    }

    if (normalizedAction === 'ACCEPT') {
      await prisma.receptionistProfile.update({
        where: { id: receptionist.id },
        data: { status: 'ACTIVE' },
      });

      if (Array.isArray(doctorIds) && doctorIds.length > 0) {
        // Validate submitted doctor IDs belong to this clinic
        const clinicDoctors = await prisma.clinicDoctor.findMany({
          where: { clinicId: clinic.id, status: { in: ['ACTIVE', 'ACCEPTED'] } },
          select: { doctorId: true },
        });
        const clinicDoctorIds = new Set(clinicDoctors.map((cd) => cd.doctorId));
        const validDoctorIds = doctorIds.filter((docId: string) => clinicDoctorIds.has(docId));

        await prisma.doctorReceptionist.deleteMany({
          where: { receptionistId: receptionist.id },
        });

        if (validDoctorIds.length > 0) {
          await prisma.doctorReceptionist.createMany({
            data: validDoctorIds.map((docId: string) => ({
              doctorId: docId,
              receptionistId: receptionist.id,
              status: 'ACTIVE',
            })),
          });
        }
      }

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

