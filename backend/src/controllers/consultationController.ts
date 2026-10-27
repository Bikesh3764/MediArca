import { Response } from 'express';
import prisma from '../config/database';
import { findTooLong, LIMITS } from '../utils/inputLimits';
import { AuthRequest } from '../middleware/authMiddleware';
import { getLocalDateString, timeToMinutes, getIndianTimeMinutes, minutesTo12Hour, parseDoctorSlots, cleanSlotName } from '../utils/scheduleUtils';
import { canTransition } from '../utils/appointmentStateMachine';
import { isDoctorEligibleForClinicalPractice } from '../utils/authGuards';
import { createNotification, formatVisitDate, withDr } from '../services/notificationService';
import { invalidateDoctorQueueCache } from '../utils/queueStateCache';

export const getDoctorQueue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Access denied: Doctor only' });
      return;
    }

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        clinics: {
          include: { clinic: true },
        },
      },
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

    const todayIso = getLocalDateString();
    const dateStr = (req.query.date as string) || todayIso;
    const scope = (req.query.scope as string) || 'date';

    const whereClause: any = {
      doctorId: doctor.id,
      queueNumber: { gt: 0 },
    };

    if (scope === 'all-upcoming') {
      whereClause.status = { in: ['WAITING', 'IN_CONSULTATION'] };
      whereClause.appointmentDate = { gte: todayIso };
    } else {
      whereClause.appointmentDate = dateStr;
    }

    const clinicId = req.query.clinicId as string;
    if (clinicId && clinicId !== 'all') {
      whereClause.clinicId = clinicId;
    }

    const slotId = req.query.slotId as string;
    if (slotId && slotId !== 'all') {
      whereClause.OR = [
        { slotId: slotId },
        { checkingWindow: { contains: slotId } },
      ];
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: {
          include: {
            user: { select: { fullName: true, email: true, phone: true, avatarUrl: true } },
          },
        },
        clinic: {
          select: { id: true, clinicName: true, address: true, city: true },
        },
      },
      orderBy: scope === 'all-upcoming'
        ? [{ appointmentDate: 'asc' }, { queueNumber: 'asc' }]
        : { queueNumber: 'asc' },
    });

    let slots = parseDoctorSlots(doctor);
    if (clinicId && clinicId !== 'all') {
      const matchedAff = (doctor.clinics || []).find((c: any) => c.clinicId === clinicId);
      if (matchedAff?.slots) {
        try {
          const p = typeof matchedAff.slots === 'string' ? JSON.parse(matchedAff.slots) : matchedAff.slots;
          if (Array.isArray(p) && p.length > 0) slots = p;
        } catch {}
      }
    } else if ((doctor.clinics || []).length === 1 && (doctor.clinics as any)[0]?.slots) {
      try {
        const p = typeof (doctor.clinics as any)[0].slots === 'string' ? JSON.parse((doctor.clinics as any)[0].slots) : (doctor.clinics as any)[0].slots;
        if (Array.isArray(p) && p.length > 0) slots = p;
      } catch {}
    }

    const getApptStartMins = (a: any): number => {
      if (a.slotId) {
        const matchedSlot = slots.find((s: any) => s.id === a.slotId);
        if (matchedSlot?.startTime) return timeToMinutes(matchedSlot.startTime);
      }
      if (a.checkingWindow) {
        const cleanedWin = cleanSlotName(a.checkingWindow, '');
        const matchedByName = slots.find(
          (s: any) => cleanSlotName(s.name, '').toLowerCase() === cleanedWin.toLowerCase()
        );
        if (matchedByName?.startTime) return timeToMinutes(matchedByName.startTime);
        const match = a.checkingWindow.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
        if (match) return timeToMinutes(match[1]);
      }
      return 0;
    };

    // Chronologically order appointments by date, slot window start time, then queueNumber (Finding 4)
    appointments.sort((a, b) => {
      if (a.appointmentDate !== b.appointmentDate) {
        return a.appointmentDate.localeCompare(b.appointmentDate);
      }
      const aSlotMins = getApptStartMins(a);
      const bSlotMins = getApptStartMins(b);
      if (aSlotMins !== bSlotMins) {
        return aSlotMins - bSlotMins;
      }
      return a.queueNumber - b.queueNumber;
    });

    const currentMins = getIndianTimeMinutes();

    const resolvedAppointments = appointments.map((a: any) => {
      let resolvedEstTime = a.estimatedTime;
      if (a.status === 'IN_CONSULTATION') {
        resolvedEstTime = 'In Cabin';
      } else if (a.status === 'WAITING' && a.queueNumber > 0) {
        const matchedSlot = (a.slotId && slots.find((s: any) => s.id === a.slotId)) || slots[0];
        if (matchedSlot?.startTime) {
          const [sh, sm] = matchedSlot.startTime.split(':').map(Number);
          const slotStartMins = sh * 60 + sm;
          let slotEndMins = matchedSlot.endTime ? timeToMinutes(matchedSlot.endTime) : slotStartMins + 240;
          if (slotEndMins <= slotStartMins) slotEndMins += 24 * 60;
          const pace = matchedSlot.avgConsultationMinutes || 3.0;
          const aheadCount = appointments.filter((other) =>
            other.status === 'WAITING' &&
            other.queueNumber > 0 &&
            other.queueNumber < a.queueNumber &&
            (a.slotId ? other.slotId === a.slotId : true)
          ).length;

          let effectiveBaseMins = slotStartMins;
          if (a.appointmentDate === todayIso && currentMins > slotStartMins && currentMins < slotEndMins) {
            effectiveBaseMins = currentMins;
          }
          resolvedEstTime = minutesTo12Hour(effectiveBaseMins + Math.round(aheadCount * pace));
        }
      }
      return {
        ...a,
        estimatedTime: resolvedEstTime || a.estimatedTime,
      };
    });

    const activeInConsultation = resolvedAppointments.find((a) => a.status === 'IN_CONSULTATION') || null;
    const waitingQueue = resolvedAppointments.filter((a) => a.status === 'WAITING');
    const completedQueue = resolvedAppointments.filter((a) => a.status === 'COMPLETED');

    // Calculate upcoming bookings summary across dates for this doctor
    const upcomingWhere: any = {
      doctorId: doctor.id,
      appointmentDate: { gte: todayIso },
      status: { in: ['WAITING', 'IN_CONSULTATION'] },
    };
    if (clinicId && clinicId !== 'all') {
      upcomingWhere.clinicId = clinicId;
    }

    const upcomingWaiting = await prisma.appointment.findMany({
      where: upcomingWhere,
      select: {
        id: true,
        appointmentDate: true,
      },
      orderBy: { appointmentDate: 'asc' },
    });

    const tomorrow = new Date(Date.now() + 86400000);
    const tomorrowIso = getLocalDateString(tomorrow);
    const tomorrowCount = upcomingWaiting.filter((a) => a.appointmentDate === tomorrowIso).length;
    const futureBookings = upcomingWaiting.filter((a) => a.appointmentDate > dateStr);
    const nextDateWithBookings = futureBookings[0]?.appointmentDate || null;

    res.json({
      success: true,
      data: {
        // Lets the doctor's screen ignore live events about other doctors' queues
        doctorId: doctor.id,
        date: dateStr,
        scope,
        totalQueue: resolvedAppointments.length,
        activeInConsultation,
        waitingQueue,
        completedQueue,
        upcomingSummary: {
          tomorrowDate: tomorrowIso,
          tomorrowCount,
          totalUpcomingCount: upcomingWaiting.length,
          futureCountFromSelectedDate: futureBookings.length,
          nextDateWithBookings,
        },
      },
    });
  } catch (error: any) {
    console.error('getDoctorQueue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve doctor queue',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

export const executeCallPatientTransaction = async (
  prismaClient: any,
  doctorId: string,
  appointmentDate: string,
  appointmentId: string,
  clinicId?: string | null
) => {
  return await prismaClient.$transaction(async (tx: any) => {
    // Concurrency control: acquire exclusive row lock on DoctorProfile and Appointment to serialize queue transitions (A-02, ARCH-012)
    if (typeof (tx as any).$queryRaw === 'function') {
      await (tx as any).$queryRaw`SELECT id FROM "DoctorProfile" WHERE id = ${doctorId} FOR UPDATE;`;
    } else if (typeof tx.$executeRaw === 'function') {
      await tx.$executeRaw`SELECT id FROM "DoctorProfile" WHERE id = ${doctorId} FOR UPDATE;`;
    }
    if (typeof tx.$executeRaw === 'function') {
      await tx.$executeRaw`SELECT id FROM "Appointment" WHERE id = ${appointmentId} FOR UPDATE;`;
    }

    // Re-verify target appointment state inside the transaction after acquiring lock (ARCH-012)
    if (typeof tx.appointment?.findUnique === 'function') {
      const currentAppt = await tx.appointment.findUnique({
        where: { id: appointmentId },
      });
      if (!currentAppt) {
        throw new Error('Appointment no longer exists.');
      }
      if (currentAppt.doctorId && currentAppt.doctorId !== doctorId) {
        throw new Error('Appointment does not belong to this doctor.');
      }
      if (clinicId && currentAppt.clinicId && currentAppt.clinicId !== clinicId) {
        throw new Error('Appointment does not belong to this clinic facility.');
      }
      if (currentAppt.isCheckedIn === false) {
        throw new Error('Patient check-in was removed before entering consultation.');
      }
      if (currentAppt.status && currentAppt.status !== 'WAITING' && currentAppt.status !== 'IN_CONSULTATION') {
        throw new Error(`Cannot call patient: appointment is currently '${currentAppt.status}'.`);
      }
    }

    // Guard: ensure practitioner is not actively consulting a patient at another clinic facility or private practice (Issue 7 / Fix #7 / ARCH-012)
    if (typeof tx.appointment?.findFirst === 'function') {
      const activeInOtherClinic = await tx.appointment.findFirst({
        where: {
          doctorId,
          status: 'IN_CONSULTATION',
          ...(clinicId
            ? { OR: [{ clinicId: { not: clinicId } }, { clinicId: null }] }
            : { clinicId: { not: null } }),
          id: { not: appointmentId },
        },
        include: { clinic: true },
      });

      if (activeInOtherClinic) {
        throw new Error(
          `Cannot call patient into consultation: Doctor is currently in an active consultation at another clinic (${activeInOtherClinic.clinic?.clinicName || 'another facility'}). Only one consultation can be active at a time.`
        );
      }
    }

    // Reset any other currently IN_CONSULTATION appointments back to WAITING for this doctor at the same facility (Finding 2)
    await tx.appointment.updateMany({
      where: {
        doctorId,
        status: 'IN_CONSULTATION',
        id: { not: appointmentId },
        ...(clinicId !== undefined ? { clinicId } : {}),
      },
      data: { status: 'WAITING' },
    });

    // Concurrency guard: conditional atomic update ensures the appointment is strictly in an eligible state (WAITING or IN_CONSULTATION)
    const updateResult = await tx.appointment.updateMany({
      where: {
        id: appointmentId,
        status: { in: ['WAITING', 'IN_CONSULTATION'] },
        isCheckedIn: true,
      },
      data: { status: 'IN_CONSULTATION', calledAt: new Date() },
    });

    if (updateResult.count === 0) {
      throw new Error('Cannot call patient: appointment is no longer in an eligible waiting state.');
    }

    return await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        clinic: true,
        patient: {
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true } },
          },
        },
      },
    });
  });
};

export const callPatient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Doctor only' });
      return;
    }

    const { appointmentId } = req.body;
    if (!appointmentId) {
      res.status(400).json({ success: false, message: 'appointmentId is required' });
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

    // Verify doctor is physically present in the cabin (cannot call if stepped out or not in cabin)
    if (doctor.cabinStatus && doctor.cabinStatus !== 'IN_CABIN') {
      const statusLabel = doctor.cabinStatus === 'STEPPED_OUT'
        ? `stepped out${doctor.expectedReturnTime ? ` (expected return ~${doctor.expectedReturnTime})` : ''}`
        : 'not in cabin';
      res.status(400).json({
        success: false,
        message: `Doctor has ${statusLabel}. Cabin presence must be set to 'In Cabin' before calling patients into consultation.`,
      });
      return;
    }

    // Set any currently in_consultation appointment to WAITING or leave as is, or mark target as IN_CONSULTATION
    const targetAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, phone: true },
            },
          },
        },
      },
    });

    if (!targetAppointment || targetAppointment.doctorId !== doctor.id) {
      res.status(404).json({ success: false, message: 'Appointment not found for this doctor' });
      return;
    }

    const transitionCheck = canTransition(targetAppointment.status, 'IN_CONSULTATION', 'DOCTOR');
    if (!transitionCheck.allowed) {
      res.status(400).json({
        success: false,
        message: transitionCheck.reason || `Cannot call an appointment with status '${targetAppointment.status}'.`,
      });
      return;
    }

    // Verify appointment date: allow today's patients or overnight carryover for checked-in patients
    const todayIso = getLocalDateString();
    const yesterdayIso = getLocalDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const currentMins = getIndianTimeMinutes(new Date());
    const isOvernightCarryover = targetAppointment.appointmentDate === yesterdayIso && currentMins < 6 * 60 && targetAppointment.isCheckedIn;
    if (targetAppointment.appointmentDate !== todayIso && !isOvernightCarryover) {
      res.status(400).json({
        success: false,
        message: `Cannot call an appointment scheduled for ${targetAppointment.appointmentDate}. Only patients scheduled for today (${todayIso}) can be called into the active cabin.`,
      });
      return;
    }

    // Verify patient is checked in / arrived at clinic before calling
    if (!targetAppointment.isCheckedIn) {
      res.status(400).json({
        success: false,
        message: 'Patient has not checked in at the clinic yet. The patient must arrive at the clinic before being called into consultation.',
      });
      return;
    }

    // Concurrency: Atomically reset previous IN_CONSULTATION appointments and set target appointment to IN_CONSULTATION inside prisma.$transaction
    const updated = await executeCallPatientTransaction(
      prisma,
      doctor.id,
      targetAppointment.appointmentDate,
      appointmentId,
      targetAppointment.clinicId
    );

    invalidateDoctorQueueCache(doctor.id, targetAppointment.appointmentDate);

    if (updated?.patient?.user) {
      const doctorName = withDr((doctor as any)?.user?.fullName || req.user.fullName);
      createNotification(
        updated.patient.user.id || (updated.patient as any).userId,
        "It's your turn",
        `${doctorName} is ready for you. Please go in now. Token #${updated.queueNumber}.`,
        'QUEUE'
      ).catch(() => {});
    }

    const patientDisplayName = updated.patientName || updated.patient?.user?.fullName || 'Patient';

    res.json({
      success: true,
      message: `Queue #${updated.queueNumber} (${patientDisplayName}) is now in consultation`,
      data: updated,
    });
  } catch (error: any) {
    console.error('callPatient error:', error);
    const msg = String(error?.message || '');
    // State changed between the checks and the locked update: a normal conflict, not a server fault
    if (
      msg.includes('Cannot call patient') ||
      msg.includes('Patient check-in was removed') ||
      msg.includes('Appointment no longer exists') ||
      msg.includes('Appointment does not belong')
    ) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to call patient',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

export const updateNotesAndVitals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Doctor only' });
      return;
    }

    const { appointmentId, vitals, clinicalNotes, diagnosis, advice, followUpDate } = req.body;

    if (!appointmentId) {
      res.status(400).json({ success: false, message: 'appointmentId is required' });
      return;
    }

    const textFields = { clinicalNotes, diagnosis, advice, followUpDate };
    for (const [key, value] of Object.entries(textFields)) {
      if (value !== undefined && value !== null && typeof value !== 'string') {
        res.status(400).json({ success: false, message: `${key} must be text.` });
        return;
      }
    }
    const tooLong = findTooLong({
      clinicalNotes: [clinicalNotes, LIMITS.notes],
      diagnosis: [diagnosis, LIMITS.symptoms],
      advice: [advice, LIMITS.message],
      followUpDate: [followUpDate, 40],
    });
    if (tooLong) {
      res.status(400).json({ success: false, message: tooLong });
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

    // Verify appointment belongs to this doctor
    const targetAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!targetAppointment || targetAppointment.doctorId !== doctor.id) {
      res.status(403).json({ success: false, message: 'Appointment does not belong to this doctor' });
      return;
    }

    if (['CANCELLED', 'REJECTED', 'PENDING_APPROVAL', 'COMPLETED', 'EXPIRED'].includes(targetAppointment.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot update clinical notes for an appointment with status '${targetAppointment.status}'. Clinical notes and vitals cannot be modified after consultation finalization.`,
      });
      return;
    }

    let finalNotes = clinicalNotes;
    // Clinic notes only: MediArca does not build prescriptions (paper scripts are given at the clinic)
    if (diagnosis || advice || followUpDate) {
      const notesParts: string[] = [];
      if (diagnosis && diagnosis.trim()) {
        notesParts.push(`Diagnosis: ${diagnosis.trim()}`);
      }
      if (clinicalNotes && clinicalNotes.trim()) {
        notesParts.push(clinicalNotes.trim());
      }
      if (advice && advice.trim()) {
        notesParts.push(`Advice: ${advice.trim()}`);
      }
      if (followUpDate && followUpDate.trim()) {
        notesParts.push(`Follow-up Date: ${followUpDate.trim()}`);
      }
      if (notesParts.length > 0) {
        finalNotes = notesParts.join('\n\n');
      }
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        ...(vitals && { vitals: typeof vitals === 'object' ? JSON.stringify(vitals) : vitals }),
        ...(finalNotes !== undefined && { clinicalNotes: finalNotes }),
      },
    });

    res.json({ success: true, message: 'Consultation notes saved', data: updated });
  } catch (error: any) {
    console.error('updateNotesAndVitals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save notes',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

export const executeCompleteConsultationAtomic = async (
  prismaClient: any,
  doctorId: string,
  appointmentId: string,
  updateData: { clinicalNotes?: string; vitals?: string }
) => {
  const result = await prismaClient.appointment.updateMany({
    where: {
      id: appointmentId,
      doctorId,
      status: 'IN_CONSULTATION',
    },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      ...updateData,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return await prismaClient.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      clinic: true,
      doctor: { include: { user: { select: { fullName: true } } } },
      patient: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
    },
  });
};

export const completeConsultation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Doctor only' });
      return;
    }

    const {
      appointmentId,
      diagnosis,
      advice,
      followUpDate,
      clinicalNotes,
      vitals,
    } = req.body;

    if (!appointmentId) {
      res.status(400).json({ success: false, message: 'appointmentId is required' });
      return;
    }

    for (const [key, value] of Object.entries({ clinicalNotes, diagnosis, advice, followUpDate })) {
      if (value !== undefined && value !== null && typeof value !== 'string') {
        res.status(400).json({ success: false, message: `${key} must be text.` });
        return;
      }
    }
    const tooLongNote = findTooLong({
      clinicalNotes: [clinicalNotes, LIMITS.notes],
      diagnosis: [diagnosis, LIMITS.symptoms],
      advice: [advice, LIMITS.message],
      followUpDate: [followUpDate, 40],
    });
    if (tooLongNote) {
      res.status(400).json({ success: false, message: tooLongNote });
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

    // Verify appointment belongs to this doctor
    const targetAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!targetAppointment || targetAppointment.doctorId !== doctor.id) {
      res.status(403).json({ success: false, message: 'Appointment does not belong to this doctor' });
      return;
    }

    // Date check: consultations can be finalized on the scheduled date or overnight carryover
    const todayIso = getLocalDateString(new Date());
    const yesterdayIso = getLocalDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const isOvernightCompletion = targetAppointment.status === 'IN_CONSULTATION' && targetAppointment.appointmentDate === yesterdayIso;
    if (targetAppointment.appointmentDate !== todayIso && !isOvernightCompletion) {
      res.status(400).json({
        success: false,
        message: `Cannot complete a consultation for ${targetAppointment.appointmentDate}. Consultations can only be completed on the scheduled appointment date (today is ${todayIso}).`,
      });
      return;
    }

    if (!targetAppointment.isCheckedIn) {
      res.status(400).json({
        success: false,
        message: 'Patient has not checked in at the clinic yet. Patient must arrive at the clinic before consultation can be completed.',
      });
      return;
    }

    if (targetAppointment.status !== 'IN_CONSULTATION') {
      res.status(400).json({
        success: false,
        message: `Cannot complete consultation for an appointment with status '${targetAppointment.status}'. Patient must be actively in consultation ('IN_CONSULTATION').`,
      });
      return;
    }

    const transitionCheck = canTransition(targetAppointment.status, 'COMPLETED', 'DOCTOR');
    if (!transitionCheck.allowed) {
      res.status(400).json({
        success: false,
        message: transitionCheck.reason || `Cannot complete consultation for an appointment with status '${targetAppointment.status}'.`,
      });
      return;
    }

    let finalNotes = clinicalNotes;
    const notesParts: string[] = [];
    if (diagnosis && diagnosis.trim()) {
      notesParts.push(`Diagnosis: ${diagnosis.trim()}`);
    }
    if (clinicalNotes && clinicalNotes.trim()) {
      notesParts.push(clinicalNotes.trim());
    }
    if (advice && advice.trim()) {
      notesParts.push(`Advice: ${advice.trim()}`);
    }
    if (followUpDate && followUpDate.trim()) {
      notesParts.push(`Follow-up Date: ${followUpDate.trim()}`);
    }
    if (notesParts.length > 0) {
      finalNotes = notesParts.join('\n\n');
    }

    // Concurrency: Atomically ensure only appointments actively in IN_CONSULTATION are marked COMPLETED
    const appt = await prisma.$transaction(async (tx) => {
      return await executeCompleteConsultationAtomic(
        tx,
        doctor.id,
        appointmentId,
        {
          ...(finalNotes !== undefined && { clinicalNotes: finalNotes }),
          ...(vitals && { vitals: typeof vitals === 'object' ? JSON.stringify(vitals) : vitals }),
        }
      );
    });

    if (!appt) {
      res.status(400).json({
        success: false,
        message: 'Cannot complete consultation: Appointment is no longer in waiting or active consultation.',
      });
      return;
    }

    invalidateDoctorQueueCache(doctor.id, targetAppointment.appointmentDate);

    const patProfile = await prisma.patientProfile.findUnique({
      where: { id: targetAppointment.patientId },
      select: { userId: true },
    });
    if (patProfile?.userId) {
      const docName = withDr((doctor as any)?.user?.fullName || req.user.fullName);
      createNotification(
        patProfile.userId,
        'Visit complete',
        `Your visit with ${docName} is done. Collect your physical prescription and follow-up advice at the clinic desk.`,
        'CLINICAL'
      ).catch(() => {});
    }

    res.json({
      success: true,
      message: 'Consultation completed successfully!',
      data: { appointment: appt },
    });
  } catch (error: any) {
    console.error('completeConsultation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete consultation',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

export const holdConsultation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Doctor only' });
      return;
    }

    const { appointmentId } = req.body;
    if (!appointmentId) {
      res.status(400).json({ success: false, message: 'appointmentId is required' });
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

    const targetAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!targetAppointment || targetAppointment.doctorId !== doctor.id) {
      res.status(404).json({ success: false, message: 'Appointment not found for this doctor' });
      return;
    }

    if (targetAppointment.status !== 'IN_CONSULTATION') {
      res.status(400).json({
        success: false,
        message: `Cannot put consultation on hold: appointment status is '${targetAppointment.status}'. Only active in-consultation visits can be returned to waiting status.`,
      });
      return;
    }

    const transitionCheck = canTransition(targetAppointment.status, 'WAITING', 'DOCTOR');
    if (!transitionCheck.allowed) {
      res.status(400).json({
        success: false,
        message: transitionCheck.reason || `Cannot put consultation on hold: appointment status is '${targetAppointment.status}'.`,
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.appointment.updateMany({
        where: { id: appointmentId, status: 'IN_CONSULTATION' },
        data: { status: 'WAITING' },
      });

      if (updateResult.count === 0) {
        return null;
      }

      return await tx.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          clinic: true,
          patient: {
            include: {
              user: { select: { id: true, fullName: true, email: true, phone: true } },
            },
          },
        },
      });
    });

    if (!updated) {
      res.status(409).json({
        success: false,
        message: 'Cannot put consultation on hold: appointment is no longer in consultation.',
      });
      return;
    }

    invalidateDoctorQueueCache(doctor.id, targetAppointment.appointmentDate);

    res.json({
      success: true,
      message: `Token #${updated?.queueNumber} placed on hold and returned to waiting queue`,
      data: updated,
    });
  } catch (error: any) {
    console.error('holdConsultation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to put consultation on hold',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

