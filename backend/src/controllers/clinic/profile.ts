import crypto from 'crypto';
import { Response } from 'express';
import prisma from '../../config/database';
import { findTooLongInBody } from '../../utils/inputLimits';
import { AuthRequest } from '../../middleware/authMiddleware';
import { isValidIndianPhone, formatIndianPhone, findExistingAccountByPhone } from '../../utils/phoneUtils';
import { isClinicActive } from '../../utils/authGuards';
import { avatarUrlProblem } from '../../utils/avatarUrl';
import { getLocalDateString, cleanSlotName, parseDoctorSlots, parseAffiliationSlots } from '../../utils/scheduleUtils';
import { REPORT_MAX_ROWS, capReportRows } from '../../utils/reportLimits';

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
        // Unpaid requests aren't bookings yet
        status: { notIn: ['CANCELLED', 'REJECTED', 'EXPIRED', 'PENDING_APPROVAL'] },
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
            status: { notIn: ['CANCELLED', 'REJECTED', 'EXPIRED', 'PENDING_APPROVAL'] },
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
 * Update clinic profile (clinicName, address, city, state, phone, avatarUrl)
 */
export const updateClinicProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tooLongField = findTooLongInBody(req.body);
    if (tooLongField) {
      res.status(400).json({ success: false, message: tooLongField });
      return;
    }
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
      const avatarProblem = avatarUrlProblem(avatarUrl, clinic.user?.avatarUrl);
      if (avatarProblem) {
        res.status(400).json({ success: false, message: avatarProblem });
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
      userUpdatePayload.avatarUrl = avatarUrl || null;
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

    const foundAppointments = await prisma.appointment.findMany({
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
      take: REPORT_MAX_ROWS + 1,
    });
    const { rows: appointments, truncated: reportTruncated } = capReportRows(foundAppointments);

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
      truncated: reportTruncated,
      maxRows: REPORT_MAX_ROWS,
      appointments: items,
    });
  } catch (error: any) {
    console.error('getClinicReport error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate clinic report' });
  }
};
