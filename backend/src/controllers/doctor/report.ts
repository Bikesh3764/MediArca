import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/authMiddleware';
import { parseDoctorSlots, getLocalDateString, cleanSlotName, parseAffiliationSlots } from '../../utils/scheduleUtils';
import { isDoctorEligibleForClinicalPractice } from '../../utils/authGuards';

/**
 * Generate comprehensive categorized 1-month / custom range report for Doctor
 */
export const getDoctorReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Access denied: Doctor only' });
      return;
    }

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        user: { select: { fullName: true, email: true, phone: true } },
        clinics: {
          where: { status: { in: ['ACCEPTED', 'ACTIVE'] } },
          include: {
            clinic: true,
          },
        },
      },
    });

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    const docCheck = isDoctorEligibleForClinicalPractice(doctor);
    if (!docCheck.eligible) {
      res.status(403).json({
        success: false,
        message: docCheck.reason || 'Doctor account is not verified or is currently suspended.',
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

    const clinicId = req.query.clinicId as string;

    const whereClause: any = {
      doctorId: doctor.id,
      appointmentDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (clinicId && clinicId !== 'all') {
      whereClause.clinicId = clinicId;
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        clinic: true,
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

    // Clinic fee and slot mapping
    const clinicFeeMap = new Map<string, number>();
    const clinicSlotsMap = new Map<string, any[]>();
    const defaultDoctorSlots = parseDoctorSlots(doctor);
    doctor.clinics.forEach((cd) => {
      const fee = typeof cd.consultationFee === 'number' && Number.isFinite(cd.consultationFee)
        ? cd.consultationFee
        : (typeof doctor.consultationFee === 'number' && Number.isFinite(doctor.consultationFee) ? doctor.consultationFee : 0);
      clinicFeeMap.set(cd.clinicId, fee);
      let cSlots = defaultDoctorSlots;
      if ((cd as any).slots) {
        cSlots = parseAffiliationSlots((cd as any).slots) ?? cSlots;
      }
      clinicSlotsMap.set(cd.clinicId, cSlots);
    });

    let totalRevenue = 0;
    let completedCount = 0;
    let inConsultationCount = 0;
    let waitingCount = 0;
    let cancelledCount = 0;

    const clinicBreakdownMap = new Map<string, { clinicId: string; clinicName: string; city: string; bookings: number; completed: number; cancelled: number; revenue: number }>();
    const shiftBreakdownMap = new Map<string, { shiftName: string; bookings: number; completed: number; revenue: number }>();

    doctor.clinics.forEach((cd) => {
      clinicBreakdownMap.set(cd.clinicId, {
        clinicId: cd.clinicId,
        clinicName: cd.clinic.clinicName,
        city: cd.clinic.city || '',
        bookings: 0,
        completed: 0,
        cancelled: 0,
        revenue: 0,
      });
    });

    const items = appointments.map((appt) => {
      const effectiveFee = (appt.clinicId ? clinicFeeMap.get(appt.clinicId) : null) ?? (typeof doctor.consultationFee === 'number' ? doctor.consultationFee : 0);
      const isCompletedOrPaid = appt.status === 'COMPLETED' || appt.paymentStatus === 'PAID';
      const isCancelled = ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(appt.status);
      const earnedFee = (isCompletedOrPaid && !isCancelled) ? effectiveFee : 0;

      if (appt.status === 'COMPLETED') completedCount++;
      else if (appt.status === 'IN_CONSULTATION') inConsultationCount++;
      else if (appt.status === 'WAITING' || appt.status === 'PENDING_APPROVAL') waitingCount++;
      else if (isCancelled) cancelledCount++;

      totalRevenue += earnedFee;

      // Clinic breakdown
      if (appt.clinicId) {
        const cEntry = clinicBreakdownMap.get(appt.clinicId) || {
          clinicId: appt.clinicId,
          clinicName: appt.clinic?.clinicName || 'Affiliated Facility',
          city: appt.clinic?.city || '',
          bookings: 0,
          completed: 0,
          cancelled: 0,
          revenue: 0,
        };
        cEntry.bookings++;
        if (appt.status === 'COMPLETED') cEntry.completed++;
        if (isCancelled) cEntry.cancelled++;
        cEntry.revenue += earnedFee;
        clinicBreakdownMap.set(appt.clinicId, cEntry);
      }

      // Shift breakdown (ARCH-009 / FUNC-009: resolve from slotId or preserve custom shift name)
      const candidateSlots = (appt.clinicId ? clinicSlotsMap.get(appt.clinicId) : null) || defaultDoctorSlots;
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
        clinicId: appt.clinicId,
        clinicName: appt.clinic?.clinicName || 'Independent Practice',
        fee: effectiveFee,
        earnedRevenue: earnedFee,
      };
    });

    res.json({
      success: true,
      reportType: 'DOCTOR',
      doctor: {
        id: doctor.id,
        name: doctor.user.fullName,
        specialty: doctor.specialty,
        phone: doctor.user.phone || '',
      },
      dateRange: {
        startDate,
        endDate,
      },
      selectedClinicId: clinicId || 'all',
      summary: {
        totalBookings: appointments.length,
        completedCount,
        inConsultationCount,
        waitingCount,
        cancelledCount,
        totalRevenue,
      },
      byClinic: Array.from(clinicBreakdownMap.values()).filter((c) => (clinicId && clinicId !== 'all' ? c.clinicId === clinicId : true)),
      byShift: Array.from(shiftBreakdownMap.values()).sort((a, b) => a.shiftName.localeCompare(b.shiftName)),
      appointments: items,
    });
  } catch (error: any) {
    console.error('getDoctorReport error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate doctor report' });
  }
};
