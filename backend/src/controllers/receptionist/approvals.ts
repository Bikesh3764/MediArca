import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/authMiddleware';
import { parseDoctorSlots, getLocalDateString, getIndianTimeMinutes, timeToMinutes, minutesTo12Hour, parseDoctorWorkingDays, parseDoctorLeaves, isDoctorOnLeave, isDoctorWorkingOnDate } from '../../utils/scheduleUtils';
import { canTransition } from '../../utils/appointmentStateMachine';
import { verifyReceptionistDoctorAccess, isDoctorEligibleForClinicalPractice } from '../../utils/authGuards';
import { createNotification, formatVisitDate, withDr } from '../../services/notificationService';
import { invalidateDoctorQueueCache } from '../../utils/queueStateCache';

/**
 * Get all pending booking requests awaiting payment and receptionist verification
 */
export const getPendingAppointments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'RECEPTIONIST') {
      res.status(403).json({ success: false, message: 'Access denied: Receptionist role required' });
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

    const receptionist = await prisma.receptionistProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        clinic: true,
        doctors: {
          where: { status: 'ACTIVE' },
          include: {
            doctor: {
              include: {
                user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, role: true } },
              },
            },
          },
        },
      },
    });

    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist profile not found' });
      return;
    }

    if (receptionist.status !== 'ACTIVE') {
      res.status(403).json({
        success: false,
        message:
          receptionist.status === 'REJECTED'
            ? 'Your receptionist application has been declined by clinic administration.'
            : 'Your receptionist application is pending approval by clinic administration.',
      });
      return;
    }

    let activeDoctorIds: string[] = [];
    if (receptionist.clinicId) {
      const activeClinicDocs = await prisma.clinicDoctor.findMany({
        where: { clinicId: receptionist.clinicId, status: { in: ['ACTIVE', 'ACCEPTED'] } },
        select: { doctorId: true },
      });
      activeDoctorIds = activeClinicDocs.map((cd) => cd.doctorId);
    }

    const assignedDoctorIds = receptionist.doctors
      .filter((d) => d.status === 'ACTIVE' && (activeDoctorIds.length === 0 || activeDoctorIds.includes(d.doctorId)))
      .map((d) => d.doctorId);

    // Fallback: If receptionist has no explicit subset assignments, cover all active doctors of the clinic
    const effectiveDoctorIds = assignedDoctorIds.length > 0
      ? assignedDoctorIds
      : (receptionist.clinicId ? activeDoctorIds : []);

    if (effectiveDoctorIds.length === 0) {
      res.json({
        success: true,
        count: 0,
        data: [],
      });
      return;
    }

    const now = new Date();
    const istTodayStr = getLocalDateString(now);
    const currentMinutes = getIndianTimeMinutes(now);

    const pendingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: { in: effectiveDoctorIds },
        ...(receptionist.clinicId ? { clinicId: receptionist.clinicId } : {}),
        status: 'PENDING_APPROVAL',
        appointmentDate: { gte: istTodayStr },
      },
      include: {
        doctor: {
          include: {
            user: { select: { fullName: true, avatarUrl: true, email: true, phone: true } },
            clinics: {
              where: { clinicId: receptionist.clinicId || undefined },
              include: {
                clinic: {
                  select: {
                    id: true,
                    clinicName: true,
                    address: true,
                    city: true,
                    phone: true,
                  },
                },
              },
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
          },
        },
        patient: {
          include: {
            user: { select: { fullName: true, email: true, phone: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const eligibleAppointments = pendingAppointments.filter(
      (appt) => isDoctorEligibleForClinicalPractice(appt.doctor).eligible
    );

    // Preserve today's pending appointments so receptionists can review, confirm, or reschedule them at desk
    const unexpiredAppointments = eligibleAppointments;

    const enriched = unexpiredAppointments.map((appt) => {
      const cd = appt.clinicId
        ? (appt.doctor as any)?.clinics?.find((c: any) => c.clinicId === appt.clinicId)
        : null;
      const fee = cd?.consultationFee ?? appt.doctor.consultationFee;
      return {
        ...appt,
        consultationFee: fee,
      };
    });

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (error: any) {
    console.error('getPendingAppointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending appointments',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Approve booking request and confirm payment receipt (assigns official sequential queue token)
 */
export const approveAppointment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'RECEPTIONIST') {
      res.status(403).json({ success: false, message: 'Access denied: Receptionist role required' });
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

    const appointmentId = String(req.params.appointmentId);

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: {
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, role: true } },
            clinics: true,
          },
        },
        clinic: {
          select: {
            id: true,
            clinicName: true,
            address: true,
            city: true,
            phone: true,
          },
        },
        patient: {
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, role: true } },
          },
        },
      },
    });

    if (!appointment) {
      res.status(404).json({ success: false, message: 'Appointment not found' });
      return;
    }

    const recProfile = await prisma.receptionistProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true, clinicId: true },
    });

    let targetClinicIdForCheck = appointment.clinicId || appointment.clinic?.id || null;
    if (!targetClinicIdForCheck && recProfile?.clinicId) {
      const isAffiliatedWithRecClinic = (appointment.doctor as any)?.clinics?.some(
        (c: any) => c.clinicId === recProfile.clinicId && (!c.status || c.status === 'ACTIVE' || c.status === 'ACCEPTED')
      );
      if (isAffiliatedWithRecClinic) {
        targetClinicIdForCheck = recProfile.clinicId;
      }
    }
    if (!targetClinicIdForCheck) {
      const activeClinic = (appointment.doctor as any)?.clinics?.find((c: any) => !c.status || c.status === 'ACTIVE' || c.status === 'ACCEPTED');
      targetClinicIdForCheck = activeClinic?.clinicId || null;
    }

    const access = await verifyReceptionistDoctorAccess(req.user.id, appointment.doctorId, targetClinicIdForCheck);
    if (!access.authorized) {
      res.status(403).json({ success: false, message: access.reason });
      return;
    }

    const receptionist = access.receptionist;

    const docCheck = isDoctorEligibleForClinicalPractice(appointment.doctor);
    if (!docCheck.eligible) {
      res.status(403).json({ success: false, message: docCheck.reason });
      return;
    }

    const now = new Date();
    const istTodayStr = getLocalDateString(now);
    const currentMinutes = getIndianTimeMinutes(now);

    if (appointment.appointmentDate < istTodayStr) {
      if (appointment.status === 'PENDING_APPROVAL') {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: 'EXPIRED' },
        });
      }
      res.status(400).json({
        success: false,
        message: `Cannot approve appointment request: the consultation date (${appointment.appointmentDate}) has already passed.`,
      });
      return;
    }

    // BUG-04 & BUG-05: Validate doctor leave, working days, and same-day shift expiration before approving
    {
      const cdForCheck = targetClinicIdForCheck
        ? (appointment.doctor as any)?.clinics?.find((c: any) => c.clinicId === targetClinicIdForCheck)
        : null;

      const hasExplicitWorkingDays = Boolean(cdForCheck?.workingDays || (appointment.doctor as any)?.workingDays);
      const hasExplicitLeaves = Boolean(cdForCheck?.leaves || (appointment.doctor as any)?.leaves);

      if (hasExplicitLeaves) {
        const doctorLeaves = [
          ...parseDoctorLeaves((appointment.doctor as any).leaves),
          ...(cdForCheck?.leaves ? parseDoctorLeaves(cdForCheck.leaves) : []),
        ];
        const leaveCheck = isDoctorOnLeave(doctorLeaves, appointment.appointmentDate, targetClinicIdForCheck);
        if (leaveCheck.isOnLeave) {
          res.status(400).json({
            success: false,
            message: `Cannot approve: Dr. ${appointment.doctor?.user?.fullName || 'the doctor'} is marked on leave on ${appointment.appointmentDate}${leaveCheck.leave?.reason ? ` (${leaveCheck.leave.reason})` : ''}. Please reschedule the appointment instead.`,
          });
          return;
        }
      }

      if (hasExplicitWorkingDays) {
        const workingDays = cdForCheck?.workingDays
          ? parseDoctorWorkingDays(cdForCheck.workingDays)
          : parseDoctorWorkingDays((appointment.doctor as any).workingDays);
        const workingCheck = isDoctorWorkingOnDate(workingDays, appointment.appointmentDate);
        if (!workingCheck.isWorking) {
          res.status(400).json({
            success: false,
            message: `Cannot approve: Dr. ${appointment.doctor?.user?.fullName || 'the doctor'} does not consult on ${workingCheck.dayName}s at this facility. Available sitting days: ${workingDays.join(', ')}.`,
          });
          return;
        }
      }

      if (appointment.appointmentDate === istTodayStr && appointment.slotId) {
        let slotsForCheck = parseDoctorSlots(appointment.doctor);
        if (cdForCheck?.slots) {
          try {
            const p = typeof cdForCheck.slots === 'string' ? JSON.parse(cdForCheck.slots) : cdForCheck.slots;
            if (Array.isArray(p) && p.length > 0) slotsForCheck = p;
          } catch {}
        }
        const matchedSlot = slotsForCheck.find((s: any) => s.id === appointment.slotId);
        if (matchedSlot?.startTime && matchedSlot?.endTime) {
          const slotStartMins = timeToMinutes(matchedSlot.startTime);
          let slotEndMins = timeToMinutes(matchedSlot.endTime);
          if (slotEndMins <= slotStartMins) slotEndMins += 24 * 60;
          if (currentMinutes >= slotEndMins) {
            if (appointment.status === 'PENDING_APPROVAL') {
              await prisma.appointment.update({
                where: { id: appointment.id },
                data: { status: 'EXPIRED' },
              });
            }
            res.status(400).json({
              success: false,
              message: `Cannot approve appointment request: the checking shift (${matchedSlot.name}) has already ended for today (${appointment.appointmentDate}).`,
            });
            return;
          }
        }
      }
    }

    if (appointment.status !== 'PENDING_APPROVAL') {
      res.status(400).json({
        success: false,
        message: `Appointment cannot be approved because current status is ${appointment.status}. Only pending booking requests can be approved.`,
      });
      return;
    }

    const transition = canTransition(appointment.status, 'WAITING', req.user?.role || 'RECEPTIONIST');
    if (!transition.allowed) {
      res.status(400).json({
        success: false,
        message: transition.reason || `Appointment cannot be approved because current status is ${appointment.status}.`,
      });
      return;
    }

    // Atomic transaction: assign real sequential queue token (positive integer), mark WAITING and preserve online arrival status
    let updated: any;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        updated = await executeApproveAppointmentTransaction(
          prisma,
          appointment.id,
          receptionist.id
        );
        break;
      } catch (err: any) {
        attempts++;
        if (
          (err.code === 'P2002' || err.code === 'P2034' || err.code === '40P01' || err.message?.includes('deadlock')) &&
          attempts < maxAttempts
        ) {
          continue;
        }
        throw err;
      }
    }

    if (appointment?.patient?.userId) {
      const cleanDocName = withDr(appointment.doctor?.user?.fullName);
      createNotification(
        appointment.patient.userId,
        'Booking confirmed',
        `${cleanDocName}, ${formatVisitDate(appointment.appointmentDate)}. Your token is #${updated.queueNumber}.`,
        'APPOINTMENT'
      ).catch(() => {});
    }

    invalidateDoctorQueueCache(appointment.doctorId, appointment.appointmentDate);

    res.json({
      success: true,
      message: `Appointment approved successfully. Queue Token #${updated.queueNumber} assigned and payment confirmed.`,
      data: updated,
    });
  } catch (error: any) {
    console.error('approveAppointment error:', error);
    const msg = error?.message || '';
    if (msg.startsWith('APPOINTMENT_ALREADY_APPROVED:') || msg.includes('cannot be approved again')) {
      res.status(400).json({
        success: false,
        message: 'This appointment has already been approved and cannot be approved again.',
      });
      return;
    }
    if (msg.includes('maximum capacity') || msg.includes('Cannot approve:')) {
      res.status(400).json({ success: false, message: msg });
      return;
    }
    res.status(error.statusCode || error.status || 400).json({
      success: false,
      message: error.message || 'Failed to approve appointment',
    });
  }
};

export const executeApproveAppointmentTransaction = async (
  prismaClient: any,
  appointmentId: string,
  receptionistId: string
) => {
  return await prismaClient.$transaction(async (tx: any) => {
    // 1. Fetch current appointment state inside transaction
    const currentAppt = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: {
          include: {
            user: { select: { fullName: true } },
            clinics: true,
          },
        },
        clinic: {
          select: {
            id: true,
            clinicName: true,
            address: true,
            city: true,
            phone: true,
          },
        },
        patient: {
          include: {
            user: { select: { fullName: true, phone: true } },
          },
        },
      },
    });

    if (!currentAppt) {
      throw new Error('APPOINTMENT_NOT_FOUND: Appointment not found');
    }

    // Repeated approval guard: only PENDING_APPROVAL appointments can be approved
    if (currentAppt.status !== 'PENDING_APPROVAL') {
      throw new Error(`APPOINTMENT_ALREADY_APPROVED: Appointment is already in '${currentAppt.status}' status and cannot be approved again.`);
    }

    // Concurrency control: acquire exclusive row lock on DoctorProfile (BUG-05, A-02)
    if (typeof (tx as any).$queryRaw === 'function') {
      await (tx as any).$queryRaw`SELECT id FROM "DoctorProfile" WHERE id = ${currentAppt.doctorId} FOR UPDATE;`;
    } else if (typeof (tx as any).$executeRaw === 'function') {
      await (tx as any).$executeRaw`SELECT id FROM "DoctorProfile" WHERE id = ${currentAppt.doctorId} FOR UPDATE;`;
    }

    // Resolve clinic ID for approval
    let targetClinicId = currentAppt.clinicId || currentAppt.clinic?.id || null;
    if (!targetClinicId && receptionistId) {
      const rec = await tx.receptionistProfile.findUnique({
        where: { id: receptionistId },
        select: { clinicId: true },
      });
      if (rec?.clinicId) {
        const isAffiliatedWithRecClinic = currentAppt.doctor.clinics?.some(
          (c: any) => c.clinicId === rec.clinicId && (!c.status || c.status === 'ACTIVE' || c.status === 'ACCEPTED')
        );
        if (isAffiliatedWithRecClinic) {
          targetClinicId = rec.clinicId;
        }
      }
    }
    if (!targetClinicId) {
      const activeClinic = currentAppt.doctor.clinics?.find((c: any) => !c.status || c.status === 'ACTIVE' || c.status === 'ACCEPTED');
      targetClinicId = activeClinic?.clinicId || null;
    }

    if (!targetClinicId) {
      throw new Error('A valid clinic affiliation is required to approve appointments and issue queue tokens.');
    }

    // Find max positive queue number on this date for this clinic and shift (Per-shift independent queue sequence)
    const slotFilter = currentAppt.slotId
      ? {
          OR: [
            { slotId: currentAppt.slotId },
            { checkingWindow: currentAppt.checkingWindow },
          ],
        }
      : currentAppt.checkingWindow
      ? { checkingWindow: currentAppt.checkingWindow }
      : {};

    const maxQueueAppt = await tx.appointment.findFirst({
      where: {
        doctorId: currentAppt.doctorId,
        appointmentDate: currentAppt.appointmentDate,
        clinicId: targetClinicId,
        queueNumber: { gt: 0 },
        ...slotFilter,
      },
      orderBy: { queueNumber: 'desc' },
      select: { queueNumber: true },
    });

    const nextToken = (maxQueueAppt?.queueNumber || 0) + 1;

    let slots = parseDoctorSlots(currentAppt.doctor);
    const cd = targetClinicId
      ? (currentAppt.doctor as any)?.clinics?.find((c: any) => c.clinicId === targetClinicId)
      : null;
    if (cd?.slots) {
      try {
        const p = typeof cd.slots === 'string' ? JSON.parse(cd.slots) : cd.slots;
        if (Array.isArray(p) && p.length > 0) slots = p;
      } catch {}
    }
    const slot = (currentAppt.slotId && slots.find((s: any) => s.id === currentAppt.slotId)) || slots[0];

    const slotWhere = slot?.id
      ? {
          OR: [
            { slotId: slot.id },
            ...(slot.name ? [{ checkingWindow: slot.name }] : []),
          ],
        }
      : slot?.name
      ? { checkingWindow: slot.name }
      : {};

    const clinicWhere = targetClinicId
      ? {
          OR: [
            { clinicId: targetClinicId },
            { clinicId: null },
          ],
        }
      : (currentAppt.clinicId ? { clinicId: currentAppt.clinicId } : {});

    // Check if slot has already reached capacity and count patients ahead for shift ETA (Issue 6)
    const confirmedInSlot = slot ? await tx.appointment.count({
      where: {
        doctorId: currentAppt.doctorId,
        appointmentDate: currentAppt.appointmentDate,
        status: { in: ['WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
        ...slotWhere,
        ...clinicWhere,
      },
    }) : 0;

    if (slot && slot.maxPatients && confirmedInSlot >= slot.maxPatients) {
      throw new Error(`Cannot approve: checking shift (${slot.name}) has already reached its maximum capacity (${slot.maxPatients} patients).`);
    }

    const pace = slot?.avgConsultationMinutes || 3.0;

    // Estimate start time based on ordinal position inside their specific slot
    let estTime = currentAppt.estimatedTime;
    if (slot?.startTime) {
      const [sh, sm] = slot.startTime.split(':').map(Number);
      const slotStartMins = sh * 60 + sm;
      estTime = minutesTo12Hour(slotStartMins + Math.round(confirmedInSlot * pace));
    }

    // Re-verify that appointment has not been cancelled/expired while waiting for lock (Finding 2 & 3)
    if (typeof tx.appointment?.findUnique === 'function') {
      const freshCheck = await tx.appointment.findUnique({
        where: { id: appointmentId },
        select: { id: true, status: true },
      });
      if (freshCheck && freshCheck.status !== 'PENDING_APPROVAL') {
        throw new Error(`APPOINTMENT_ALREADY_APPROVED: Appointment is no longer in pending status (currently '${freshCheck.status}').`);
      }
    }

    const updatedRecord = await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        clinicId: targetClinicId,
        queueNumber: nextToken,
        status: 'WAITING',
        paymentStatus: 'PAID',
        approvedBy: receptionistId,
        approvedAt: new Date(),
        estimatedTime: estTime,
        isCheckedIn: Boolean(currentAppt.isCheckedIn),
        checkedInAt: currentAppt.checkedInAt || null,
      },
      include: {
        doctor: { include: { user: { select: { fullName: true } } } },
        clinic: {
          select: {
            id: true,
            clinicName: true,
            address: true,
            city: true,
            phone: true,
          },
        },
        patient: { include: { user: { select: { fullName: true, phone: true } } } },
      },
    });

    // Auto-expire remaining PENDING_APPROVAL appointments if shift has reached maximum patient capacity
    const newConfirmedCount = confirmedInSlot + 1;
    if (slot && slot.maxPatients && newConfirmedCount >= slot.maxPatients) {
      const expiredWhere: any = {
        doctorId: currentAppt.doctorId,
        appointmentDate: currentAppt.appointmentDate,
        status: 'PENDING_APPROVAL',
        ...slotWhere,
        ...clinicWhere,
      };

      if (typeof tx.appointment?.updateMany === 'function') {
        await tx.appointment.updateMany({
          where: expiredWhere,
          data: { status: 'EXPIRED' },
        });
      }
    }

    if (updatedRecord?.clinic && (updatedRecord.clinic as any).checkinCode !== undefined) {
      delete (updatedRecord.clinic as any).checkinCode;
    }
    return updatedRecord;
  });
};

/**
 * Decline/reject booking request
 */
export const rejectAppointment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'RECEPTIONIST') {
      res.status(403).json({ success: false, message: 'Access denied: Receptionist role required' });
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

    const appointmentId = String(req.params.appointmentId);
    const { reason } = req.body;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        doctor: {
          include: {
            user: { select: { fullName: true } },
          },
        },
      },
    });

    if (!appointment) {
      res.status(404).json({ success: false, message: 'Appointment not found' });
      return;
    }

    const access = await verifyReceptionistDoctorAccess(req.user.id, appointment.doctorId, appointment.clinicId);
    if (!access.authorized) {
      res.status(403).json({ success: false, message: access.reason });
      return;
    }

    const transition = canTransition(appointment.status, 'REJECTED', req.user?.role || 'RECEPTIONIST');
    if (!transition.allowed) {
      res.status(400).json({
        success: false,
        message: transition.reason || `Appointment cannot be declined because current status is ${appointment.status}.`,
      });
      return;
    }

    const updateResult = await prisma.appointment.updateMany({
      where: { id: appointment.id, status: 'PENDING_APPROVAL' },
      data: {
        status: 'REJECTED',
        paymentStatus: 'FAILED',
        clinicalNotes: reason ? `Declined by reception: ${reason}` : 'Declined by reception',
      },
    });

    if (updateResult.count === 0) {
      res.status(409).json({
        success: false,
        message: 'Appointment is no longer pending approval.',
      });
      return;
    }

    const updated = await prisma.appointment.findUnique({
      where: { id: appointment.id },
    });

    if (appointment?.patient?.userId) {
      const docName = withDr(appointment.doctor?.user?.fullName);
      const declineMsg = reason ? `Reason: ${String(reason).trim()}` : 'Call the clinic for details.';
      createNotification(
        appointment.patient.userId,
        'Booking declined',
        `The clinic couldn't take your request for ${docName} on ${formatVisitDate(appointment.appointmentDate)}. ${declineMsg}`,
        'APPOINTMENT'
      ).catch(() => {});
    }

    res.json({
      success: true,
      message: 'Appointment booking request has been declined.',
      data: updated,
    });
  } catch (error: any) {
    console.error('rejectAppointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to decline appointment',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};
