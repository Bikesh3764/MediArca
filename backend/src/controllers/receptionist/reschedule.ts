import { Response } from 'express';
import prisma from '../../config/database';
import { isWithinBookingWindow, BOOKING_WINDOW_MESSAGE } from '../../utils/scheduleUtils';
import { AuthRequest } from '../../middleware/authMiddleware';
import { parseDoctorSlots, evaluateSlotStatus, getLocalDateString, getIndianTimeMinutes, timeToMinutes, minutesTo12Hour, isValidAppointmentDate, cleanSlotName, parseDoctorWorkingDays, parseDoctorLeaves, isDoctorOnLeave, isDoctorWorkingOnDate, parseAffiliationSlots } from '../../utils/scheduleUtils';
import { verifyReceptionistDoctorAccess, isDoctorEligibleForClinicalPractice, isClinicActive } from '../../utils/authGuards';
import { createNotification, formatVisitDate, withDr } from '../../services/notificationService';
import { invalidateDoctorQueueCache } from '../../utils/queueStateCache';
import { MAX_ACTIVE_BOOKINGS_PER_DAY } from '../appointment/booking';

export const determineRescheduleTarget = (
  currentStatus: string,
  minProvisionalQueue: number | null | undefined,
  maxConfirmedQueue: number | null | undefined,
  paymentStatus?: string
): { targetStatus: string; queueNumber: number } => {
  const isPending =
    currentStatus === 'PENDING_APPROVAL' ||
    (paymentStatus !== undefined && paymentStatus !== 'PAID');

  if (isPending) {
    const nextNegative = typeof minProvisionalQueue === 'number' && minProvisionalQueue < 0
      ? minProvisionalQueue - 1
      : -1;
    return { targetStatus: 'PENDING_APPROVAL', queueNumber: nextNegative };
  }
  const nextPositive = typeof maxConfirmedQueue === 'number' && maxConfirmedQueue > 0
    ? maxConfirmedQueue + 1
    : 1;
  return { targetStatus: 'WAITING', queueNumber: nextPositive };
};

export const rescheduleAppointment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !['RECEPTIONIST', 'CLINIC', 'DOCTOR', 'PATIENT'].includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    if (req.user.role === 'RECEPTIONIST') {
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
    }

    const rawApptId = req.params.appointmentId || req.params.id;
    const appointmentId = typeof rawApptId === 'string' ? rawApptId : Array.isArray(rawApptId) ? rawApptId[0] : '';
    const { newDate: rawNewDate, newSlotId } = req.body;
    const newDate = rawNewDate ? String(rawNewDate).trim() : '';

    if (!newDate) {
      res.status(400).json({ success: false, message: 'New appointment date is required' });
      return;
    }

    if (!isValidAppointmentDate(newDate)) {
      res.status(400).json({
        success: false,
        message: 'Invalid appointment date format. Expected valid calendar date in YYYY-MM-DD format.',
      });
      return;
    }

    const istTodayStr = getLocalDateString();
    if (newDate < istTodayStr) {
      res.status(400).json({ success: false, message: 'Cannot reschedule to a past date' });
      return;
    }
    if (!isWithinBookingWindow(newDate)) {
      res.status(400).json({ success: false, message: BOOKING_WINDOW_MESSAGE });
      return;
    }

    const appointment: any = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: {
          include: {
            user: { select: { fullName: true } },
            clinics: true,
          },
        },
        patient: {
          include: {
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
    });

    if (!appointment) {
      res.status(404).json({ success: false, message: 'Appointment not found' });
      return;
    }

    // Verify authority using canonical guards (Fix #2)
    if (req.user.role === 'PATIENT') {
      if (appointment.patient?.userId !== req.user.id) {
        res.status(403).json({
          success: false,
          message: "You do not have permission to reschedule another patient's appointment",
        });
        return;
      }
    } else if (req.user.role === 'DOCTOR') {
      if (appointment.doctor.userId !== req.user.id) {
        res.status(403).json({ success: false, message: 'You do not have permission to reschedule another doctor\'s appointment' });
        return;
      }
      const docCheck = isDoctorEligibleForClinicalPractice(appointment.doctor);
      if (!docCheck.eligible) {
        res.status(403).json({ success: false, message: docCheck.reason });
        return;
      }
    } else if (req.user.role === 'RECEPTIONIST') {
      const access = await verifyReceptionistDoctorAccess(req.user.id, appointment.doctorId, appointment.clinicId);
      if (!access.authorized) {
        res.status(403).json({ success: false, message: access.reason || 'Unauthorized for this doctor or clinic' });
        return;
      }
    } else if (req.user.role === 'CLINIC') {
      const clinic = await prisma.clinicProfile.findUnique({
        where: { userId: req.user.id },
      });
      const clinicCheck = isClinicActive(clinic);
      if (!clinicCheck.active || !clinic) {
        res.status(403).json({ success: false, message: clinicCheck.reason || 'Clinic facility is inactive' });
        return;
      }
      if (appointment.clinicId !== clinic.id) {
        res.status(403).json({ success: false, message: 'Unauthorized for another clinic facility' });
        return;
      }
      const docCheck = isDoctorEligibleForClinicalPractice(appointment.doctor);
      if (!docCheck.eligible) {
        res.status(403).json({ success: false, message: docCheck.reason });
        return;
      }
    } else {
      res.status(403).json({
        success: false,
        message: 'Access denied: Unauthorized role for appointment rescheduling',
      });
      return;
    }

    // A paid token is moved by the clinic (it may change the token); patients can move only unconfirmed requests
    if (req.user.role === 'PATIENT' && appointment.status === 'WAITING') {
      res.status(403).json({
        success: false,
        message: 'Your token is confirmed. Call the clinic to move it to another day.',
      });
      return;
    }
    // Moving a request must not get around the per-day booking limit
    if (
      req.user.role === 'PATIENT' &&
      newDate !== appointment.appointmentDate &&
      typeof (prisma.appointment as any)?.count === 'function'
    ) {
      const activeThatDay = await prisma.appointment.count({
        where: {
          id: { not: appointment.id },
          patient: { userId: req.user.id },
          appointmentDate: newDate,
          status: { in: ['PENDING_APPROVAL', 'WAITING', 'IN_CONSULTATION'] },
        },
      });
      if (activeThatDay >= MAX_ACTIVE_BOOKINGS_PER_DAY) {
        res.status(429).json({
          success: false,
          message: `You already have ${MAX_ACTIVE_BOOKINGS_PER_DAY} bookings on this date. Cancel one first.`,
        });
        return;
      }
    }

    if (['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'IN_CONSULTATION'].includes(appointment.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot reschedule appointment with status '${appointment.status}'`,
      });
      return;
    }

    if (newDate === appointment.appointmentDate && (!newSlotId || newSlotId === appointment.slotId)) {
      res.status(400).json({
        success: false,
        message: 'Appointment is already scheduled for this date and time slot',
      });
      return;
    }

    // Find next available positive queue number on newDate
    let attempts = 0;
    const maxAttempts = 3;
    let updatedAppt: any;

    while (attempts < maxAttempts) {
      try {
        updatedAppt = await prisma.$transaction(async (tx) => {
          // Concurrency control: acquire exclusive row lock on DoctorProfile (BUG-05, A-02)
          if (typeof (tx as any).$queryRaw === 'function') {
            await (tx as any).$queryRaw`SELECT id FROM "DoctorProfile" WHERE id = ${appointment.doctorId} FOR UPDATE;`;
          } else if (typeof (tx as any).$executeRaw === 'function') {
            await (tx as any).$executeRaw`SELECT id FROM "DoctorProfile" WHERE id = ${appointment.doctorId} FOR UPDATE;`;
          }

          // Concurrency check: Ensure target appointment hasn't transitioned to IN_CONSULTATION, COMPLETED, CANCELLED, or EXPIRED
          const freshAppt = await tx.appointment.findUnique({
            where: { id: appointment.id },
            select: { id: true, status: true },
          });
          if (!freshAppt || ['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'IN_CONSULTATION'].includes(freshAppt.status)) {
            const err: any = new Error(
              `Cannot reschedule appointment: current status is '${freshAppt?.status || 'NOT_FOUND'}'.`
            );
            err.status = 400;
            throw err;
          }

          // Check if patient already has an active appointment with this doctor on target date (FIX-010)
          const duplicate = await tx.appointment.findFirst({
            where: {
              id: { not: appointment.id },
              patientId: appointment.patientId,
              doctorId: appointment.doctorId,
              appointmentDate: newDate,
              isForOther: Boolean(appointment.isForOther),
              ...(appointment.isForOther && appointment.patientName
                ? { patientName: { equals: String(appointment.patientName).trim(), mode: 'insensitive' } }
                : {}),
              status: { in: ['PENDING_APPROVAL', 'WAITING', 'IN_CONSULTATION'] },
            },
            select: { id: true, queueNumber: true, status: true, slotId: true },
          });

          if (duplicate) {
            let isDuplicateExpired = false;
            if (duplicate.status === 'PENDING_APPROVAL') {
              if (newDate < istTodayStr) {
                isDuplicateExpired = true;
              } else if (newDate === istTodayStr) {
                let activeSlots = parseDoctorSlots(appointment.doctor);
                const cd = appointment.clinicId
                  ? appointment.doctor?.clinics?.find((c: any) => c.clinicId === appointment.clinicId)
                  : null;
                if (cd?.slots) {
                  activeSlots = parseAffiliationSlots(cd.slots) ?? activeSlots;
                }
                const prevSlot = (duplicate.slotId && activeSlots.find((s) => s.id === duplicate.slotId)) || activeSlots[0];
                if (prevSlot) {
                  const now = new Date();
                  const currentMinutes = getIndianTimeMinutes(now);
                  const prevStartMins = timeToMinutes(prevSlot.startTime);
                  let prevEndMins = timeToMinutes(prevSlot.endTime);
                  if (prevEndMins <= prevStartMins) prevEndMins += 24 * 60;
                  if (currentMinutes >= prevEndMins) {
                    isDuplicateExpired = true;
                  }
                }
              }
            }

            if (isDuplicateExpired) {
              await tx.appointment.update({
                where: { id: duplicate.id },
                data: { status: 'EXPIRED' },
              });
            } else {
              const recipient = appointment.isForOther && appointment.patientName
                ? `for ${appointment.patientName}`
                : 'for this patient';
              const isPending = duplicate.status === 'PENDING_APPROVAL';
              const message = isPending
                ? `The patient already has an active booking request ${recipient} awaiting approval with this doctor on this date.`
                : `The patient already has an active booking (Queue #${duplicate.queueNumber}) ${recipient} with this doctor on this date.`;
              const err: any = new Error(`DUPLICATE_BOOKING: ${message}`);
              err.status = 400;
              throw err;
            }
          }

          // Resolve slot first to ensure shift-isolated queue allocation
          let slots = parseDoctorSlots(appointment.doctor);
          const cd = appointment.clinicId
            ? appointment.doctor?.clinics?.find((c: any) => c.clinicId === appointment.clinicId)
            : null;
          if (cd?.slots) {
            try {
              const p = typeof cd.slots === 'string' ? JSON.parse(cd.slots) : cd.slots;
              if (Array.isArray(p) && p.length > 0) slots = p;
            } catch {}
          }
          const chosenSlotId = newSlotId || appointment.slotId;
          const slot = (chosenSlotId && slots.find((s) => s.id === chosenSlotId)) || slots[0];

          // Validate doctor leave and sitting days on target reschedule date
          const isStaffActor = ['RECEPTIONIST', 'CLINIC', 'DOCTOR', 'ADMIN'].includes(req.user?.role || '');
          const isDifferentShiftSameDay =
            newDate === appointment.appointmentDate && Boolean(newSlotId && newSlotId !== appointment.slotId);

          const targetClinicIdForReschedule = appointment.clinicId || cd?.clinicId || null;
          if (cd?.leaves || (appointment.doctor as any)?.leaves) {
            const doctorLeaves = [
              ...parseDoctorLeaves((appointment.doctor as any)?.leaves),
              ...(cd?.leaves ? parseDoctorLeaves(cd.leaves) : []),
            ];
            const leaveCheck = isDoctorOnLeave(doctorLeaves, newDate, targetClinicIdForReschedule);
            if (leaveCheck.isOnLeave && !(isStaffActor && isDifferentShiftSameDay)) {
              const err: any = new Error(
                `Dr. ${appointment.doctor?.user?.fullName || 'the doctor'} is on leave on ${newDate}${leaveCheck.leave?.reason ? `: ${leaveCheck.leave.reason}` : ''}. Please pick an alternate date.`
              );
              err.status = 400;
              throw err;
            }
          }

          if (cd?.workingDays || (appointment.doctor as any)?.workingDays) {
            const workingDays = cd?.workingDays
              ? parseDoctorWorkingDays(cd.workingDays)
              : parseDoctorWorkingDays((appointment.doctor as any)?.workingDays);
            const workingCheck = isDoctorWorkingOnDate(workingDays, newDate);
            if (!workingCheck.isWorking && !(isStaffActor && isDifferentShiftSameDay)) {
              const err: any = new Error(
                `Dr. ${appointment.doctor?.user?.fullName || 'the doctor'} does not consult on ${workingCheck.dayName}s at this clinic facility. Available sitting days: ${workingDays.join(', ')}.`
              );
              err.status = 400;
              throw err;
            }
          }

          const slotFilter = slot?.id
            ? {
                OR: [
                  { slotId: slot.id },
                  { checkingWindow: slot.name },
                ],
              }
            : slot?.name
            ? { checkingWindow: slot.name }
            : {};

          const isPending =
            appointment.status === 'PENDING_APPROVAL' ||
            appointment.paymentStatus !== 'PAID';
          let nextQueueNumber: number;

          const clinicFilter = appointment.clinicId ? { clinicId: appointment.clinicId } : {};

          if (isPending) {
            const minQueue = await tx.appointment.findFirst({
              where: {
                doctorId: appointment.doctorId,
                appointmentDate: newDate,
                ...clinicFilter,
                queueNumber: { lt: 0 },
                ...slotFilter,
              },
              orderBy: { queueNumber: 'asc' },
              select: { queueNumber: true },
            });
            nextQueueNumber = minQueue ? minQueue.queueNumber - 1 : -1;
          } else {
            const maxQueue = await tx.appointment.findFirst({
              where: {
                doctorId: appointment.doctorId,
                appointmentDate: newDate,
                ...clinicFilter,
                queueNumber: { gt: 0 },
                ...slotFilter,
              },
              orderBy: { queueNumber: 'desc' },
              select: { queueNumber: true },
            });
            nextQueueNumber = (maxQueue?.queueNumber || 0) + 1;
          }

          let bookedInSlot = 0;
          if (slot) {
            // Validate target slot capacity and expiration for destination date (Finding 5)
            const dayAppointments = await tx.appointment.findMany({
              where: {
                id: { not: appointment.id },
                doctorId: appointment.doctorId,
                appointmentDate: newDate,
                ...(appointment.clinicId ? { clinicId: appointment.clinicId } : {}),
                status: { in: ['PENDING_APPROVAL', 'WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
              },
              select: {
                id: true,
                slotId: true,
                checkingWindow: true,
                status: true,
              },
            });

            bookedInSlot = dayAppointments.filter((a: any) => {
              if (a.status === 'PENDING_APPROVAL') return false;
              if (a.slotId && slot.id) return a.slotId === slot.id;
              if (a.checkingWindow && slot.startTime) return a.checkingWindow.includes(slot.startTime);
              return slots.length === 1;
            }).length;

            const slotStatus = evaluateSlotStatus(
              slot,
              newDate,
              bookedInSlot,
              new Date()
            );

            if (slotStatus.isPassed) {
              const err: any = new Error(
                `This checking slot (${slot.name}) has already ended for ${newDate}. Please pick an upcoming slot or a future date.`
              );
              err.status = 400;
              throw err;
            }

            if (slotStatus.isFull) {
              const err: any = new Error(
                `This checking slot (${slot.name}) has reached its maximum patient capacity (${slot.maxPatients} patients) for ${newDate}.`
              );
              err.status = 400;
              throw err;
            }
          }

          const pace = slot?.avgConsultationMinutes || 3.0;
          const slotStartMins = slot ? timeToMinutes(slot.startTime) : 9 * 60;
          const tokenOffset = isPending ? 0 : bookedInSlot;
          const estStartMins = slotStartMins + tokenOffset * pace;
          const estimatedTime = minutesTo12Hour(estStartMins);
          const checkingWindow = slot ? cleanSlotName(slot.name, 'Shift 1') : (appointment.checkingWindow || 'General Hours');

          const updatedRecord = await tx.appointment.update({
            where: { id: appointment.id },
            data: {
              appointmentDate: newDate,
              queueNumber: nextQueueNumber,
              slotId: slot?.id || chosenSlotId || null,
              checkingWindow,
              estimatedTime,
              status: isPending ? 'PENDING_APPROVAL' : 'WAITING',
              isCheckedIn: newDate === appointment.appointmentDate ? Boolean(appointment.isCheckedIn) : false, // Reset arrival for new date
              checkedInAt: newDate === appointment.appointmentDate ? (appointment.checkedInAt || null) : null,
            },
            include: {
              doctor: { include: { user: { select: { fullName: true } } } },
              patient: {
                include: {
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
          });

          if (updatedRecord?.patient?.user) {
            delete (updatedRecord.patient.user as any).passwordHash;
            delete (updatedRecord.patient.user as any).emailVerificationOtp;
            delete (updatedRecord.patient.user as any).emailVerificationOtpExpiresAt;
          }
          if (updatedRecord?.clinic) {
            delete (updatedRecord.clinic as any).checkinCode;
          }
          return updatedRecord;
        });
        break;
      } catch (err: any) {
        if (err.status === 400 || err.message?.startsWith('DUPLICATE_BOOKING:')) {
          throw err;
        }
        attempts++;
        if (attempts >= maxAttempts) throw err;
        await new Promise((r) => setTimeout(r, 100 * attempts));
      }
    }

    const docName = appointment.doctor?.user?.fullName
      ? (appointment.doctor.user.fullName.startsWith('Dr.')
          ? appointment.doctor.user.fullName
          : `Dr. ${appointment.doctor.user.fullName}`)
      : 'Doctor';

    const tokenDisplay = updatedAppt.queueNumber > 0
      ? `Your token is #${updatedAppt.queueNumber}.`
      : 'The clinic will confirm your token.';

    // Tell the patient, unless they moved it themselves
    if (appointment.patient?.userId && appointment.patient.userId !== req.user.id) {
      createNotification(
        appointment.patient.userId,
        'Visit moved',
        `Your visit with ${docName} is now on ${formatVisitDate(newDate)}. ${tokenDisplay}`,
        'APPOINTMENT'
      ).catch(() => {});
    }

    invalidateDoctorQueueCache(appointment.doctorId);

    res.json({
      success: true,
      message: `Appointment successfully rescheduled to ${newDate} (${tokenDisplay}).`,
      data: updatedAppt,
    });
  } catch (error: any) {
    console.error('rescheduleAppointment error:', error);
    if (error.status === 400 || error.message?.startsWith('DUPLICATE_BOOKING:')) {
      const cleanMessage = error.message?.startsWith('DUPLICATE_BOOKING:')
        ? error.message.replace('DUPLICATE_BOOKING: ', '')
        : error.message;
      res.status(400).json({
        success: false,
        message: cleanMessage,
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Failed to reschedule appointment. Please try again.' : (error.message || 'Failed to reschedule appointment'),
    });
  }
};
