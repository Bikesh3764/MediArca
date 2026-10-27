import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/authMiddleware';
import { parseDoctorSlots, getLocalDateString, cleanSlotName, parseAffiliationSlots } from '../../utils/scheduleUtils';
import { REPORT_MAX_ROWS, capReportRows } from '../../utils/reportLimits';

/**
 * Generate comprehensive categorized 1-month / custom range report for Receptionist
 */
export const getReceptionistReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'RECEPTIONIST') {
      res.status(403).json({ success: false, message: 'Access denied: Receptionist only' });
      return;
    }

    const receptionist = await prisma.receptionistProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        clinic: true,
        doctors: {
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

    if (!receptionist || !receptionist.clinicId) {
      res.status(404).json({ success: false, message: 'Receptionist clinic affiliation not found' });
      return;
    }

    const userRec = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { mustChangePassword: true },
    });
    if (userRec?.mustChangePassword || req.user.mustChangePassword) {
      res.status(403).json({
        success: false,
        message: 'Temporary password must be changed before accessing clinical desk operations.',
      });
      return;
    }

    // Determine doctors accessible to this receptionist
    const activeDoctorAffiliations = await prisma.clinicDoctor.findMany({
      where: {
        clinicId: receptionist.clinicId,
        status: { in: ['ACTIVE', 'ACCEPTED'] },
      },
      include: {
        doctor: {
          include: {
            user: { select: { fullName: true } },
          },
        },
      },
    });

    const activeDoctorIds = activeDoctorAffiliations.map((cd) => cd.doctorId);
    const assignedDoctorIds = receptionist.doctors
      .filter((dr) => dr.status === 'ACTIVE' && activeDoctorIds.includes(dr.doctorId))
      .map((dr) => dr.doctorId);

    const hasExplicitSubset = assignedDoctorIds.length > 0;
    const allowedDoctorIds = hasExplicitSubset ? assignedDoctorIds : activeDoctorIds;

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

    if (doctorId && doctorId !== 'all' && hasExplicitSubset && !allowedDoctorIds.includes(doctorId)) {
      res.status(403).json({ success: false, message: 'Doctor not assigned to your desk' });
      return;
    }

    // FUNC-010: When receptionist covers the full clinic desk (!hasExplicitSubset), include all historical clinic appointments
    // so detached doctors' past completed consultations are preserved in the clinic report.
    const whereClause: any = {
      clinicId: receptionist.clinicId,
      appointmentDate: {
        gte: startDate,
        lte: endDate,
      },
    };
    if (doctorId && doctorId !== 'all') {
      whereClause.doctorId = doctorId;
    } else if (hasExplicitSubset) {
      whereClause.doctorId = { in: allowedDoctorIds };
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

    // Create fee and slot maps
    const doctorFeeMap = new Map<string, number>();
    const doctorSlotsMap = new Map<string, any[]>();
    activeDoctorAffiliations.forEach((cd) => {
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

    activeDoctorAffiliations
      .filter((cd) => !hasExplicitSubset || allowedDoctorIds.includes(cd.doctorId))
      .forEach((cd) => {
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

      // Doctor breakdown
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

      // Shift breakdown (ARCH-009 / FUNC-009: resolve from slotId or preserve custom shift name)
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
      reportType: 'RECEPTIONIST',
      facility: {
        id: receptionist.clinic?.id || '',
        name: receptionist.clinic?.clinicName || 'Clinic Front Desk',
        city: receptionist.clinic?.city || '',
        address: receptionist.clinic?.address || '',
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
    console.error('getReceptionistReport error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate receptionist report' });
  }
};
