import { Request, Response } from 'express';
import prisma from '../../config/database';
import {
  timeToMinutes,
  minutesTo12Hour,
  parseDoctorSlots,
  getLocalDateString,
  getIndianTimeMinutes,
  parseAffiliationSlots,
} from '../../utils/scheduleUtils';
import { isValidIndianPhone, sanitizeIndianPhone } from '../../utils/phoneUtils';
import { normalizeWalkinCode } from '../../utils/walkinCode';
import { estimateQueueWait, minutesBetween } from '../../utils/queueEta';
import { resolveReceptionistContact } from './helpers';

const NOT_FOUND_MESSAGE = 'No walk-in found. Check the number and code.';

/**
 * Public walk-in tracker (FIX-058).
 *
 * A walk-in patient types the mobile number given at the desk and the 6-character code to see
 * their token, the token being served now and the estimated time. Both must match, so knowing
 * someone's number alone shows nothing. Only today's and upcoming visits are found: the code
 * stops working after the visit day. The answer never includes the patient's phone or IDs.
 */
export const trackWalkin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, code } = (req.body || {}) as { phone?: unknown; code?: unknown };
    const walkInCode = normalizeWalkinCode(code);
    const phoneText = typeof phone === 'string' ? phone.trim() : '';

    if (!walkInCode || !phoneText || !isValidIndianPhone(phoneText)) {
      res.status(400).json({ success: false, message: 'Enter your 10-digit mobile number and 6-character code.' });
      return;
    }
    const wantedDigits = sanitizeIndianPhone(phoneText);

    const now = new Date();
    const today = getLocalDateString(now);

    const candidates = await prisma.appointment.findMany({
      where: { walkInCode, appointmentDate: { gte: today } },
      orderBy: { appointmentDate: 'asc' },
      take: 5,
      include: {
        doctor: {
          include: {
            user: { select: { fullName: true, avatarUrl: true } },
            receptionists: {
              where: { status: 'ACTIVE' },
              include: { receptionist: { include: { user: { select: { fullName: true, phone: true } } } } },
            },
          },
        },
        clinic: {
          select: {
            id: true,
            clinicName: true,
            address: true,
            city: true,
            phone: true,
            user: { select: { avatarUrl: true } },
            receptionists: {
              where: { status: 'ACTIVE' },
              select: {
                id: true,
                phone: true,
                user: { select: { fullName: true, phone: true } },
                doctors: { select: { doctorId: true, status: true } },
              },
            },
          },
        },
        patient: { select: { user: { select: { phone: true } } } },
      },
    });

    const appt = candidates.find((a) => sanitizeIndianPhone(a.patient?.user?.phone || '') === wantedDigits);
    if (!appt) {
      res.status(404).json({ success: false, message: NOT_FOUND_MESSAGE });
      return;
    }

    const recContact = resolveReceptionistContact(appt.clinic, appt.doctorId, appt.doctor);
    const isToday = appt.appointmentDate === today;

    let liveQueue: Record<string, unknown> | null = null;
    if (appt.status === 'WAITING' || appt.status === 'IN_CONSULTATION') {
      const affiliation = appt.clinicId
        ? await prisma.clinicDoctor.findUnique({
            where: { clinicId_doctorId: { clinicId: appt.clinicId, doctorId: appt.doctorId } },
            select: { slots: true },
          })
        : null;
      let slots = parseDoctorSlots(appt.doctor);
      if (affiliation?.slots) slots = parseAffiliationSlots(affiliation.slots) ?? slots;
      const slot = (appt.slotId && slots.find((s) => s.id === appt.slotId)) || slots[0];

      const sameShift = await prisma.appointment.findMany({
        where: {
          doctorId: appt.doctorId,
          appointmentDate: appt.appointmentDate,
          ...(appt.clinicId ? { clinicId: appt.clinicId } : {}),
          ...(appt.slotId ? { slotId: appt.slotId } : { checkingWindow: appt.checkingWindow }),
          status: { in: ['WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
          queueNumber: { gt: 0 },
        },
        select: { queueNumber: true, status: true, isCheckedIn: true, calledAt: true, completedAt: true },
      });

      const serving = sameShift.find((a) => a.status === 'IN_CONSULTATION');
      const waitingAhead =
        appt.status === 'IN_CONSULTATION'
          ? []
          : sameShift.filter((a) => a.status === 'WAITING' && a.queueNumber < appt.queueNumber);

      const slotStartMins = slot ? timeToMinutes(slot.startTime) : 0;
      let slotEndMins = slot ? timeToMinutes(slot.endTime) : 24 * 60;
      if (slotEndMins <= slotStartMins) slotEndMins += 24 * 60;
      const nowMins = getIndianTimeMinutes(now);
      const isShiftPassed = isToday && nowMins >= slotEndMins;
      const isShiftActive = isToday && nowMins >= slotStartMins && nowMins < slotEndMins;

      const returnAt = appt.doctor?.expectedReturnTime;
      const eta = estimateQueueWait({
        nowMins,
        slotStartMins,
        slotEndMins,
        plannedPace: slot?.avgConsultationMinutes || 3.0,
        aheadArrived: waitingAhead.filter((a) => a.isCheckedIn).length,
        aheadNotArrived: waitingAhead.filter((a) => !a.isCheckedIn).length,
        inConsultationElapsedMins:
          serving && serving.queueNumber !== appt.queueNumber ? minutesBetween(serving.calledAt, now) ?? 0 : null,
        recentDurations: sameShift
          .filter((a) => a.status === 'COMPLETED')
          .map((a) => minutesBetween(a.calledAt, a.completedAt))
          .filter((d): d is number => d !== null),
        cabinStatus: appt.doctor?.cabinStatus,
        returnAtMins: returnAt && /\d{1,2}:\d{2}/.test(returnAt) ? timeToMinutes(returnAt) : null,
      });
      const waitMinutes = appt.status === 'IN_CONSULTATION' ? 0 : eta.waitMinutes;

      let liveEstimatedTime = appt.estimatedTime;
      if (appt.status === 'IN_CONSULTATION') liveEstimatedTime = 'In Cabin Now';
      else if (isToday) liveEstimatedTime = isShiftPassed ? 'Shift Ended' : minutesTo12Hour(nowMins + waitMinutes);

      liveQueue = {
        currentServingQueueNumber: serving?.queueNumber || 0,
        patientsAway: waitingAhead.length,
        estimatedWaitMinutes: waitMinutes,
        isYourTurn: appt.status === 'IN_CONSULTATION',
        isShiftActive,
        isShiftPassed,
        liveEstimatedTime,
        delayReason: isToday && appt.status === 'WAITING' ? eta.delayReason : null,
      };
    }

    res.json({
      success: true,
      data: {
        walkInCode: appt.walkInCode,
        patientName: appt.patientName || null,
        queueNumber: appt.queueNumber,
        status: appt.status,
        appointmentDate: appt.appointmentDate,
        checkingWindow: appt.checkingWindow,
        estimatedTime: appt.estimatedTime,
        doctor: {
          fullName: appt.doctor?.user?.fullName || null,
          avatarUrl: appt.doctor?.user?.avatarUrl || null,
          specialty: appt.doctor?.specialty || null,
          cabinStatus: appt.doctor?.cabinStatus || null,
          expectedReturnTime: appt.doctor?.expectedReturnTime || null,
        },
        clinic: appt.clinic
          ? {
              clinicName: appt.clinic.clinicName,
              address: appt.clinic.address,
              city: appt.clinic.city,
              avatarUrl: appt.clinic.user?.avatarUrl || null,
            }
          : null,
        receptionistName: recContact.name || null,
        receptionistPhone: recContact.phone || appt.clinic?.phone || null,
        liveQueue,
      },
    });
  } catch (error: any) {
    console.error('trackWalkin error:', error);
    res.status(500).json({ success: false, message: 'Couldn’t load your queue. Try again.' });
  }
};
