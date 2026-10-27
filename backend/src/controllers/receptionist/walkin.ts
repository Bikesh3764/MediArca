import { Response } from 'express';
import { createUnusablePasswordHash } from '../../utils/passwords';
import { BOOKING_TX_OPTIONS, isBookingBusyError, BOOKING_BUSY_MESSAGE } from '../../utils/bookingTx';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/authMiddleware';
import crypto from 'crypto';
import { parseDoctorSlots, evaluateSlotStatus, getLocalDateString, getIndianTimeMinutes, timeToMinutes, minutesTo12Hour, isValidAppointmentDate, cleanSlotName, parseDoctorWorkingDays, parseDoctorLeaves, isDoctorOnLeave, isDoctorWorkingOnDate } from '../../utils/scheduleUtils';
import { formatIndianPhone, sanitizeIndianPhone, isValidIndianPhone } from '../../utils/phoneUtils';
import { verifyReceptionistDoctorAccess } from '../../utils/authGuards';
import { createNotification, formatVisitDate, withDr } from '../../services/notificationService';
import { invalidateDoctorQueueCache } from '../../utils/queueStateCache';
import { pickWalkinAccount } from '../../utils/walkinMatch';
import { findTooLong, LIMITS } from '../../utils/inputLimits';
import { isWithinBookingWindow, BOOKING_WINDOW_MESSAGE } from '../../utils/scheduleUtils';

/**
 * Rapid Walk-in Appointment Booking for linked doctors
 */
export const bookWalkin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'RECEPTIONIST') {
      res.status(403).json({ success: false, message: 'Access denied: receptionist role required' });
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

    const {
      doctorId,
      patientName,
      patientPhone,
      gender,
      patientAge,
      isForOther,
      appointmentDate: requestedDate,
      slotId,
      reasonForVisit,
      symptoms,
      clinicId,
    } = req.body;

    if (!doctorId || !patientName || !patientPhone) {
      res.status(400).json({ success: false, message: 'Doctor ID, patient name, and patient phone are required' });
      return;
    }

    if (isForOther) {
      if (!patientName || !String(patientName).trim()) {
        res.status(400).json({ success: false, message: 'Patient full name is required when booking for someone else' });
        return;
      }
      if (!patientAge || !String(patientAge).trim()) {
        res.status(400).json({ success: false, message: 'Patient age is required when booking for someone else' });
        return;
      }
    }

    if (patientAge && String(patientAge).trim()) {
      const parsedAge = parseInt(String(patientAge).trim(), 10);
      if (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 125) {
        res.status(400).json({ success: false, message: 'Patient age must be a valid number between 0 and 125.' });
        return;
      }
    }

    if (requestedDate && !isValidAppointmentDate(requestedDate)) {
      res.status(400).json({
        success: false,
        message: 'Invalid appointment date format. Expected valid calendar date in YYYY-MM-DD format.',
      });
      return;
    }

    const now = new Date();
    const istTodayStr = getLocalDateString(now);
    const currentMinutes = getIndianTimeMinutes(now);

    const appointmentDate = requestedDate || istTodayStr;
    if (appointmentDate < istTodayStr) {
      res.status(400).json({
        success: false,
        message: 'Cannot book appointments for past dates.',
      });
      return;
    }

    if (!isWithinBookingWindow(appointmentDate, now)) {
      res.status(400).json({ success: false, message: BOOKING_WINDOW_MESSAGE });
      return;
    }

    const tooLong = findTooLong({
      patientName: [patientName, LIMITS.name],
      patientPhone: [patientPhone, LIMITS.phone],
      reasonForVisit: [reasonForVisit, LIMITS.reason],
      symptoms: [symptoms, LIMITS.symptoms],
    });
    if (tooLong) {
      res.status(400).json({ success: false, message: tooLong });
      return;
    }

    const accessRecProfile = await prisma.receptionistProfile.findUnique({
      where: { userId: req.user.id },
      select: { clinicId: true },
    });
    const effectiveClinicId = clinicId || accessRecProfile?.clinicId || null;

    const access = await verifyReceptionistDoctorAccess(req.user.id, doctorId, effectiveClinicId);
    if (!access.authorized) {
      res.status(403).json({ success: false, message: access.reason });
      return;
    }

    const receptionist = access.receptionist;

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { user: { select: { fullName: true } } },
    });

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found' });
      return;
    }

    // Verify doctor is sitting today and not on leave (User Feature: Doctor Working Days & Leave Management)
    const cd = effectiveClinicId
      ? await prisma.clinicDoctor.findUnique({
          where: { clinicId_doctorId: { clinicId: effectiveClinicId, doctorId } },
        })
      : null;
    const workingDays = cd?.workingDays
      ? parseDoctorWorkingDays(cd.workingDays)
      : parseDoctorWorkingDays((doctor as any).workingDays);
    const doctorLeaves = [
      ...parseDoctorLeaves((doctor as any).leaves),
      ...(cd?.leaves ? parseDoctorLeaves(cd.leaves) : []),
    ];

    const leaveCheck = isDoctorOnLeave(doctorLeaves, appointmentDate, effectiveClinicId);
    if (leaveCheck.isOnLeave) {
      res.status(400).json({
        success: false,
        message: `Dr. ${doctor.user?.fullName || 'the doctor'} is marked on leave on this date (${appointmentDate})${leaveCheck.leave?.reason ? `: ${leaveCheck.leave.reason}` : ''}. Walk-in queue booking cannot be initiated.`,
      });
      return;
    }

    const workingCheck = isDoctorWorkingOnDate(workingDays, appointmentDate);
    if (!workingCheck.isWorking) {
      res.status(400).json({
        success: false,
        message: `Dr. ${doctor.user?.fullName || 'the doctor'} does not consult on ${workingCheck.dayName}s at this clinic facility. Available sitting days: ${workingDays.join(', ')}.`,
      });
      return;
    }

    // Find or create walk-in patient profile with phone normalization
    const cleanPhone = String(patientPhone).trim();
    if (!isValidIndianPhone(cleanPhone)) {
      res.status(400).json({
        success: false,
        message: 'Invalid patient phone number. Must be a valid 10-digit Indian mobile number (+91).',
      });
      return;
    }
    const normalizedPhone = formatIndianPhone(cleanPhone);
    const rawDigits = sanitizeIndianPhone(cleanPhone);
    const unspacedE164 = rawDigits ? `+91${rawDigits}` : '';
    const spacedSeedFormat = rawDigits ? `+91 ${rawDigits.slice(0, 5)} ${rawDigits.slice(5)}` : '';

    const phoneLookupWhere = {
      role: 'PATIENT',
      OR: [
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        ...(rawDigits ? [{ phone: rawDigits }] : []),
        ...(unspacedE164 ? [{ phone: unspacedE164 }] : []),
        ...(spacedSeedFormat ? [{ phone: spacedSeedFormat }] : []),
        { phone: cleanPhone },
      ],
    };

    let patientUser: any = null;
    if (typeof (prisma.user as any)?.findMany === 'function') {
      const candidates = await prisma.user.findMany({
        where: phoneLookupWhere,
        include: { patientProfile: true },
      });
      // Only reuse an account whose name matches what the desk typed (no phone-to-name lookup)
      patientUser = pickWalkinAccount(candidates as any[], patientName);
    } else {
      const found = await prisma.user.findFirst({
        where: phoneLookupWhere,
        include: { patientProfile: true },
      });
      patientUser = pickWalkinAccount(found ? [found as any] : [], patientName);
    }

    if (!patientUser) {
      // Walk-ins never sign in with a password (FIX-049: 12 rounds froze the live server ~1.5 s)
      const dummyHash = createUnusablePasswordHash();
      const walkinEmail = `walkin.${crypto.randomUUID()}@mediarca.local`;

      patientUser = await prisma.user.create({
        data: {
          fullName: patientName ? String(patientName).trim() : 'Walk-in Patient',
          phone: normalizedPhone || cleanPhone,
          email: walkinEmail,
          passwordHash: dummyHash,
          role: 'PATIENT',
          mustChangePassword: true,
          patientProfile: {
            create: {
              gender: gender || null,
            },
          },
        },
        include: { patientProfile: true },
      });
    }

    const isOther = Boolean(
      isForOther || (patientUser && patientName && patientUser.fullName.trim().toLowerCase() !== String(patientName).trim().toLowerCase())
    );

    let patientProfile = patientUser.patientProfile;
    if (!patientProfile) {
      patientProfile = await prisma.patientProfile.create({
        data: {
          userId: patientUser.id,
          gender: gender || null,
        },
      });
    }

    // Resolve clinic affiliation & custom practice shifts
    let targetClinicId = effectiveClinicId || receptionist.clinicId;
    let targetAffiliation: any = null;
    if (targetClinicId) {
      targetAffiliation = await prisma.clinicDoctor.findUnique({
        where: {
          clinicId_doctorId: {
            clinicId: targetClinicId,
            doctorId: doctor.id,
          },
        },
      });
    }

    if (!targetClinicId && !targetAffiliation) {
      targetAffiliation = await prisma.clinicDoctor.findFirst({
        where: { doctorId: doctor.id, status: { in: ['ACTIVE', 'ACCEPTED'] } },
      });
      if (targetAffiliation) {
        targetClinicId = targetAffiliation.clinicId;
      }
    }

    if (!targetClinicId) {
      res.status(400).json({
        success: false,
        message: 'A valid clinic association is required to allocate walk-in queue tokens for this doctor.',
      });
      return;
    }

    let slots = parseDoctorSlots(doctor);
    if (targetAffiliation?.slots) {
      try {
        const parsed = typeof targetAffiliation.slots === 'string' ? JSON.parse(targetAffiliation.slots) : targetAffiliation.slots;
        if (Array.isArray(parsed) && parsed.length > 0) {
          slots = parsed;
        }
      } catch {}
    }
    let chosenSlot = slots.find((s) => s.id === slotId) || slots[0];

    // Concurrency-safe atomic transaction
    let newAppointment: any;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        newAppointment = await prisma.$transaction(async (tx) => {
          // Concurrency control: lock practitioner row for this booking without swallowing errors (BUG-05, A-02)
          if (typeof (tx as any).$queryRaw === 'function') {
            await (tx as any).$queryRaw`SELECT id FROM "DoctorProfile" WHERE id = ${doctor.id} FOR UPDATE;`;
          } else if (typeof (tx as any).$executeRaw === 'function') {
            await (tx as any).$executeRaw`SELECT id FROM "DoctorProfile" WHERE id = ${doctor.id} FOR UPDATE;`;
          }

          // Duplicate booking check within transaction (Finding H7, Bug 13: allow distinct family members on same phone)
          const cleanPatientName = patientName ? String(patientName).trim() : null;
          const existingInTx = await tx.appointment.findFirst({
            where: {
              patientId: patientProfile!.id,
              doctorId: doctor.id,
              appointmentDate,
              isForOther: Boolean(isOther),
              ...(cleanPatientName
                ? { patientName: { equals: cleanPatientName, mode: 'insensitive' } }
                : {}),
              status: { in: ['PENDING_APPROVAL', 'WAITING', 'IN_CONSULTATION'] },
            },
          });
          if (existingInTx) {
            let isExpiredTx = false;
            if (existingInTx.status === 'PENDING_APPROVAL') {
              if (appointmentDate < istTodayStr) {
                isExpiredTx = true;
              } else if (appointmentDate === istTodayStr) {
                const prevSlot = (existingInTx.slotId && slots.find((s) => s.id === existingInTx.slotId)) || slots[0];
                if (prevSlot) {
                  const prevStartMins = timeToMinutes(prevSlot.startTime);
                  let prevEndMins = timeToMinutes(prevSlot.endTime);
                  if (prevEndMins <= prevStartMins) prevEndMins += 24 * 60;
                  if (currentMinutes >= prevEndMins) {
                    isExpiredTx = true;
                  }
                }
              }
            }

            if (isExpiredTx) {
              await tx.appointment.update({
                where: { id: existingInTx.id },
                data: { status: 'EXPIRED' },
              });
            } else {
              const recipient = isOther && cleanPatientName ? `for ${cleanPatientName}` : 'for this patient';
              throw new Error(
                `DUPLICATE_ACTIVE_BOOKING: Patient already has an active booking (Queue #${existingInTx.queueNumber}) ${recipient} with this doctor on ${appointmentDate}.`
              );
            }
          }

          // FUNC-008: Count only confirmed/completed bookings toward hard slot capacity so unapproved pending requests cannot starve walk-ins
          const dayAppointments = await tx.appointment.findMany({
            where: {
              doctorId: doctor.id,
              appointmentDate,
              ...(targetClinicId ? { clinicId: targetClinicId } : {}),
              status: { in: ['WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
            },
            select: {
              id: true,
              slotId: true,
              checkingWindow: true,
              queueNumber: true,
            },
          });

          const bookedInSlot = dayAppointments.filter((a) => {
            if (a.slotId) return a.slotId === chosenSlot.id;
            if (a.checkingWindow) return a.checkingWindow.includes(chosenSlot.startTime) || cleanSlotName(a.checkingWindow) === cleanSlotName(chosenSlot.name);
            return slots.length === 1;
          }).length;

          // Check if slot has passed or reached max patients
          const slotStatus = evaluateSlotStatus(
            chosenSlot,
            appointmentDate,
            bookedInSlot,
            new Date()
          );

          if (slotStatus.isPassed) {
            throw new Error(
              `This checking slot (${chosenSlot.name}) has already ended for today. Please pick an upcoming shift or future date.`
            );
          }

          if (slotStatus.isFull) {
            throw new Error(
              `This checking slot (${chosenSlot.name}) has reached its maximum patient capacity (${chosenSlot.maxPatients} patients).`
            );
          }

          // Highest queue number on this date across appointments for this clinic and shift (FIX-014)
          const slotFilter = chosenSlot?.id
            ? {
                OR: [
                  { slotId: chosenSlot.id },
                  { checkingWindow: chosenSlot.name },
                ],
              }
            : chosenSlot?.name
            ? { checkingWindow: chosenSlot.name }
            : {};

          const maxQueueAppt = await tx.appointment.findFirst({
            where: {
              doctorId: doctor.id,
              appointmentDate,
              ...(targetClinicId ? { clinicId: targetClinicId } : {}),
              queueNumber: { gt: 0 },
              ...slotFilter,
            },
            orderBy: { queueNumber: 'desc' },
            select: { queueNumber: true },
          });
          const highestQueue = maxQueueAppt && maxQueueAppt.queueNumber > 0 ? maxQueueAppt.queueNumber : 0;
          const queueNumber = Math.max(1, highestQueue + 1);

          const pace = chosenSlot.avgConsultationMinutes || 3.0;
          const patientsAheadInQueue = Math.max(0, queueNumber - 1);
          let estimatedTime = slotStatus.estimatedTime;
          if (chosenSlot.startTime) {
            const [sh, sm] = chosenSlot.startTime.split(':').map(Number);
            const slotStartMins = sh * 60 + sm;
            estimatedTime = minutesTo12Hour(slotStartMins + Math.round(patientsAheadInQueue * pace));
          }
          const checkingWindow = cleanSlotName(chosenSlot.name, 'Shift 1');
          const isTodayBooking = appointmentDate === istTodayStr;

          const created = await tx.appointment.create({
            data: {
              patientId: patientProfile!.id,
              doctorId: doctor.id,
              clinicId: targetClinicId,
              appointmentDate,
              queueNumber,
              checkingWindow,
              estimatedTime,
              slotId: chosenSlot.id,
              status: 'WAITING',
              paymentStatus: 'PAID',
              reasonForVisit: reasonForVisit || 'Walk-in Consultation',
              symptoms: symptoms || null,
              isForOther: isOther,
              patientName: patientName ? String(patientName).trim() : null,
              patientAge: patientAge ? String(patientAge).trim() : null,
              patientGender: gender || null,
              isCheckedIn: isTodayBooking,
              checkedInAt: isTodayBooking ? new Date() : null,
            },
            include: {
              doctor: {
                include: { user: { select: { id: true, fullName: true } } },
              },
              clinic: {
                select: { id: true, clinicName: true, address: true, city: true, phone: true },
              },
              patient: {
                include: { user: { select: { fullName: true, phone: true } } },
              },
            },
          });

          (created as any).patientPhone =
            normalizedPhone || cleanPhone || created.patient?.user?.phone || null;

          // Auto-expire remaining PENDING_APPROVAL appointments if shift has reached maximum patient capacity
          const newConfirmedCount = bookedInSlot + 1;
          if (chosenSlot && chosenSlot.maxPatients && newConfirmedCount >= chosenSlot.maxPatients) {
            const walkinSlotWhere = chosenSlot?.id
              ? {
                  OR: [
                    { slotId: chosenSlot.id },
                    ...(chosenSlot.name ? [{ checkingWindow: chosenSlot.name }] : []),
                  ],
                }
              : chosenSlot?.name
              ? { checkingWindow: chosenSlot.name }
              : {};

            const walkinClinicWhere = targetClinicId
              ? {
                  OR: [
                    { clinicId: targetClinicId },
                    { clinicId: null },
                  ],
                }
              : {};

            if (typeof tx.appointment?.updateMany === 'function') {
              await tx.appointment.updateMany({
                where: {
                  doctorId: doctor.id,
                  appointmentDate,
                  status: 'PENDING_APPROVAL',
                  ...walkinSlotWhere,
                  ...walkinClinicWhere,
                },
                data: { status: 'EXPIRED' },
              });
            }
          }

          return created;
        }, BOOKING_TX_OPTIONS);

        break; // Success!
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

    if (newAppointment?.patient?.user) {
      createNotification(
        newAppointment.patient.userId || (newAppointment.patient as any).user?.id,
        'Token booked',
        `Token #${newAppointment.queueNumber} for ${withDr(newAppointment.doctor?.user?.fullName)} on ${formatVisitDate(appointmentDate)}.`,
        'QUEUE'
      ).catch(() => {});
    }

    if (newAppointment?.doctor?.userId || (newAppointment?.doctor as any)?.user?.id) {
      const doctorUserId = newAppointment.doctor.userId || (newAppointment.doctor as any).user?.id;
      const displayPatient = patientName ? String(patientName).trim() : (newAppointment.patient?.user?.fullName || 'Walk-in Patient');
      createNotification(
        doctorUserId,
        'Walk-in Patient Added',
        `Walk-in Patient ${displayPatient} was added to your queue (Token #${newAppointment.queueNumber}) at ${newAppointment.clinic?.clinicName || 'Clinic'}.`,
        'QUEUE'
      ).catch(() => {});
    }

    invalidateDoctorQueueCache(doctorId, appointmentDate);

    res.status(201).json({
      success: true,
      message: `Token #${newAppointment.queueNumber} created successfully for ${patientName}`,
      data: newAppointment,
    });
  } catch (error: any) {
    console.error('bookWalkin error:', error);
    const msg = error?.message || '';
    if (msg.startsWith('DUPLICATE_ACTIVE_BOOKING:')) {
      const cleanMsg = msg.replace('DUPLICATE_ACTIVE_BOOKING:', '').trim();
      res.status(409).json({ success: false, message: cleanMsg });
      return;
    }
    if (msg.includes('reached its maximum patient capacity')) {
      res.status(409).json({ success: false, message: msg });
      return;
    }
    if (msg.includes('already ended for today')) {
      res.status(400).json({ success: false, message: msg });
      return;
    }
    if (isBookingBusyError(error)) {
      res.status(503).json({ success: false, message: BOOKING_BUSY_MESSAGE });
      return;
    }
    if (msg.startsWith('CONCURRENCY_LOCK_FAILURE:')) {
      res.status(503).json({ success: false, message: 'Practitioner schedule is busy with concurrent reservations. Please retry in a moment.' });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to book walk-in appointment. Please try again.',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};
