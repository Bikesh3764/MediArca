import { Response } from 'express';
import { createUnusablePasswordHash } from '../../utils/passwords';
import { BOOKING_TX_OPTIONS, isBookingBusyError, BOOKING_BUSY_MESSAGE } from '../../utils/bookingTx';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/authMiddleware';
import { timeToMinutes, parseDoctorSlots, evaluateSlotStatus, getLocalDateString, getIndianTimeMinutes, isValidAppointmentDate, isDoctorOnLeave, isDoctorWorkingOnDate, parseDoctorWorkingDays, parseDoctorLeaves, parseAffiliationSlots } from '../../utils/scheduleUtils';
import crypto from 'crypto';
import { formatIndianPhone, sanitizeIndianPhone, isValidIndianPhone } from '../../utils/phoneUtils';
import { isDoctorEligibleForClinicalPractice } from '../../utils/authGuards';
import { createNotification, formatVisitDate, withDr } from '../../services/notificationService';
import { resolveReceptionistContact } from './helpers';
import { pickWalkinAccount } from '../../utils/walkinMatch';
import { findTooLong, LIMITS } from '../../utils/inputLimits';
import { isWithinBookingWindow, BOOKING_WINDOW_MESSAGE } from '../../utils/scheduleUtils';

/** Active bookings (self plus family) one patient account may hold on a single date. */
export const MAX_ACTIVE_BOOKINGS_PER_DAY = 4;

export const bookAppointment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== 'PATIENT' && req.user.role !== 'DOCTOR')) {
      res.status(403).json({ success: false, message: 'Only registered patients or practitioners can book appointments' });
      return;
    }

    const {
      doctorId: requestedDoctorId,
      appointmentDate,
      slotId,
      reasonForVisit,
      symptoms,
      clientMinutes,
      clinicId,
      isForOther,
      patientName,
      patientAge,
      patientGender,
      patientPhone,
    } = req.body;

    let doctorId = requestedDoctorId;

    if (req.user.role === 'DOCTOR') {
      const myDoctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (!myDoctorProfile) {
        res.status(404).json({ success: false, message: 'Doctor profile not found' });
        return;
      }
      if (doctorId && doctorId !== myDoctorProfile.id && doctorId !== req.user.id) {
        res.status(403).json({ success: false, message: 'Doctors can only queue walk-in appointments for their own practice' });
        return;
      }
      doctorId = myDoctorProfile.id;
    }

    if (!doctorId || !appointmentDate) {
      res.status(400).json({ success: false, message: 'Doctor ID and appointment date are required' });
      return;
    }

    if (!isValidAppointmentDate(appointmentDate)) {
      res.status(400).json({
        success: false,
        message: 'Invalid appointment date format. Expected valid calendar date in YYYY-MM-DD format.',
      });
      return;
    }

    const now = new Date();
    const istTodayStr = getLocalDateString(now);
    const currentMinutes = getIndianTimeMinutes(now);

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
      reasonForVisit: [reasonForVisit, LIMITS.reason],
      symptoms: [symptoms, LIMITS.symptoms],
      patientName: [patientName, LIMITS.name],
      patientPhone: [patientPhone, LIMITS.phone],
    });
    if (tooLong) {
      res.status(400).json({ success: false, message: tooLong });
      return;
    }

    // One account can hold a few active bookings per day (self plus family), not unlimited requests
    if (req.user.role === 'PATIENT' && typeof (prisma.appointment as any)?.count === 'function') {
      const activeThatDay = Number(
        (await prisma.appointment.count({
          where: {
            patient: { userId: req.user.id },
            appointmentDate,
            status: { in: ['PENDING_APPROVAL', 'WAITING', 'IN_CONSULTATION'] },
          },
        })) || 0
      );
      if (activeThatDay >= MAX_ACTIVE_BOOKINGS_PER_DAY) {
        res.status(429).json({
          success: false,
          message: `You already have ${MAX_ACTIVE_BOOKINGS_PER_DAY} bookings on this date. Cancel one to book another.`,
        });
        return;
      }
    }

    if (isForOther && req.user.role === 'PATIENT') {
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

    let doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: {
        user: { select: { fullName: true } },
        clinics: {
          where: { clinic: { isVerified: true, verificationStatus: 'VERIFIED' }, status: { in: ['ACTIVE', 'ACCEPTED'] } },
          include: { clinic: true },
        },
      },
    });

    if (!doctor) {
      doctor = await prisma.doctorProfile.findUnique({
        where: { userId: doctorId },
        include: {
          user: { select: { fullName: true } },
          clinics: {
            where: { clinic: { isVerified: true, verificationStatus: 'VERIFIED' }, status: { in: ['ACTIVE', 'ACCEPTED'] } },
            include: { clinic: true },
          },
        },
      });
    }

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found' });
      return;
    }

    const docCheck = isDoctorEligibleForClinicalPractice(doctor);
    if (!docCheck.eligible) {
      res.status(403).json({
        success: false,
        message: docCheck.reason || 'This doctor is not currently verified or practice is suspended. Bookings are unavailable.',
      });
      return;
    }

    let patient: any;
    let patientUser: any = null;
    if (req.user.role === 'DOCTOR') {
      // Doctor booking a walk-in patient with phone normalization
      const cleanPhone = patientPhone ? String(patientPhone).trim() : '';
      if (cleanPhone && !isValidIndianPhone(cleanPhone)) {
        res.status(400).json({
          success: false,
          message: 'Invalid patient phone number. Must be a valid 10-digit Indian mobile number (+91).',
        });
        return;
      }
      const normalizedPhone = formatIndianPhone(cleanPhone);
      const rawDigits = sanitizeIndianPhone(cleanPhone);

      if (cleanPhone) {
        const phoneWhere = {
          role: 'PATIENT' as const,
          OR: [
            ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
            ...(rawDigits ? [{ phone: rawDigits }] : []),
            { phone: cleanPhone },
          ],
        };
        if (typeof (prisma.user as any).findMany === 'function') {
          const candidates = await prisma.user.findMany({
            where: phoneWhere,
            include: { patientProfile: true },
            orderBy: [{ isEmailVerified: 'desc' }, { createdAt: 'asc' }],
          });
          // Only reuse an account whose name matches what was typed (no phone-to-name lookup)
          patientUser = pickWalkinAccount(candidates as any[], patientName);
        } else {
          const found = await prisma.user.findFirst({
            where: phoneWhere,
            include: { patientProfile: true },
          });
          patientUser = pickWalkinAccount(found ? [found as any] : [], patientName);
        }
      }
      if (!patientUser) {
        // Walk-ins never sign in with a password (FIX-049: 12 rounds froze the live server ~1.5 s)
        const dummyHash = createUnusablePasswordHash();
        const walkinEmail = `walkin.${crypto.randomUUID()}@mediarca.local`;
        patientUser = await prisma.user.create({
          data: {
            fullName: patientName ? String(patientName).trim() : 'Walk-in Patient',
            phone: normalizedPhone || cleanPhone || null,
            email: walkinEmail,
            passwordHash: dummyHash,
            role: 'PATIENT',
            mustChangePassword: true,
            patientProfile: {
              create: {
                gender: patientGender || null,
              },
            },
          },
          include: { patientProfile: true },
        });
      }
      patient = patientUser.patientProfile;
      if (!patient) {
        patient = await prisma.patientProfile.create({
          data: {
            userId: patientUser.id,
            gender: patientGender || null,
          },
        });
      }
    } else {
      patient = await prisma.patientProfile.findUnique({
        where: { userId: req.user.id },
      });

      if (!patient) {
        patient = await prisma.patientProfile.create({
          data: { userId: req.user.id },
        });
      }
    }

    // Strictly enforce clinic affiliation: a doctor must have at least one verified active clinic to accept bookings
    const activeClinics = doctor.clinics || [];
    if (activeClinics.length === 0) {
      res.status(400).json({
        success: false,
        message: 'This doctor is currently not associated with any active verified clinic. Online queue booking is unavailable.',
      });
      return;
    }

    // Determine target clinic venue
    let targetClinicId: string;
    let targetAffiliation: any = null;
    if (clinicId) {
      const matched = activeClinics.find((c: any) => c.clinicId === String(clinicId));
      if (!matched) {
        res.status(400).json({
          success: false,
          message: 'The selected clinic is not an active verified venue for this doctor. Please choose a valid clinic venue.',
        });
        return;
      }
      targetClinicId = matched.clinicId;
      targetAffiliation = matched;
    } else {
      if (activeClinics.length === 1) {
        targetClinicId = activeClinics[0].clinicId;
        targetAffiliation = activeClinics[0];
      } else {
        res.status(400).json({
          success: false,
          message: 'This doctor practices at multiple clinics. Please select which clinic venue you wish to book an appointment at.',
        });
        return;
      }
    }

    // Enforce receptionist requirement: patient online queue booking REQUIRES an active front desk receptionist assigned to the doctor at the clinic facility
    if (req.user?.role === 'PATIENT') {
      const activeReceptionist = await prisma.receptionistProfile.findFirst({
        where: {
          clinicId: targetClinicId,
          status: 'ACTIVE',
          OR: [
            { doctors: { none: { status: 'ACTIVE' } } },
            { doctors: { some: { doctorId: doctor.id, status: 'ACTIVE' } } },
          ],
        },
        include: {
          user: { select: { fullName: true, phone: true } },
        },
      });

      if (!activeReceptionist) {
        const rawDocName = doctor.user?.fullName || 'this practitioner';
        const docDisplayName = rawDocName.startsWith('Dr.') ? rawDocName : `Dr. ${rawDocName}`;
        const clinicDisplayName = targetAffiliation?.clinic?.clinicName || 'this facility';
        res.status(400).json({
          success: false,
          message: `Online queue booking is currently unavailable for ${docDisplayName} at ${clinicDisplayName} because no front-desk receptionist is currently assigned at this facility.`,
        });
        return;
      }
    }

    // Verify doctor working days and leave on requested date
    const workingDays = targetAffiliation?.workingDays
      ? parseDoctorWorkingDays(targetAffiliation.workingDays)
      : parseDoctorWorkingDays((doctor as any).workingDays);
    const doctorLeaves = [
      ...parseDoctorLeaves((doctor as any).leaves),
      ...(targetAffiliation?.leaves ? parseDoctorLeaves(targetAffiliation.leaves) : []),
    ];

    const leaveCheck = isDoctorOnLeave(doctorLeaves, appointmentDate, targetClinicId);
    if (leaveCheck.isOnLeave) {
      res.status(400).json({
        success: false,
        message: `Dr. ${doctor.user?.fullName || 'the doctor'} is on leave on this date (${appointmentDate})${leaveCheck.leave?.reason ? `: ${leaveCheck.leave.reason}` : ''}. Please select an alternate date.`,
      });
      return;
    }

    const workingCheck = isDoctorWorkingOnDate(workingDays, appointmentDate);
    if (!workingCheck.isWorking) {
      res.status(400).json({
        success: false,
        message: `Dr. ${doctor.user?.fullName || 'the doctor'} does not consult on ${workingCheck.dayName}s at this clinic facility. Available consultation days: ${workingDays.join(', ')}.`,
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
    let chosenSlot: any = null;
    if (slotId) {
      chosenSlot = slots.find((s) => s.id === String(slotId));
      if (!chosenSlot) {
        res.status(400).json({
          success: false,
          message: `The selected checking shift (${slotId}) is invalid. Please pick an active shift.`,
        });
        return;
      }
    } else {
      chosenSlot = slots.find((s) => {
        const st = evaluateSlotStatus(s, appointmentDate, 0, new Date());
        return !st.isPassed && !st.isFull;
      }) || slots[0];
    }

    // Check if patient already has an active appointment with this doctor on this day (applies to PATIENT self-booking and DOCTOR walk-ins)
    if (req.user.role === 'PATIENT' || (req.user.role === 'DOCTOR' && patient?.id)) {
      const effectiveIsForOther = Boolean(
        isForOther ||
        (req.user.role === 'DOCTOR' &&
          patientUser &&
          patientName &&
          patientUser.fullName.trim().toLowerCase() !== String(patientName).trim().toLowerCase())
      );
      const existingPatientBooking = await prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          doctorId: doctor.id,
          appointmentDate,
          isForOther: effectiveIsForOther,
          ...(effectiveIsForOther && patientName
            ? { patientName: { equals: String(patientName).trim(), mode: 'insensitive' } }
            : {}),
          status: { in: ['PENDING_APPROVAL', 'WAITING', 'IN_CONSULTATION'] },
        },
      });

      if (existingPatientBooking) {
        let isExpired = false;
        if (existingPatientBooking.status === 'PENDING_APPROVAL') {
          if (appointmentDate < istTodayStr) {
            isExpired = true;
          } else if (appointmentDate === istTodayStr) {
            let activeSlots = parseDoctorSlots(doctor);
            if (targetAffiliation?.slots) {
              activeSlots = parseAffiliationSlots(targetAffiliation.slots) ?? activeSlots;
            }
            const prevSlot = (existingPatientBooking.slotId && activeSlots.find((s) => s.id === existingPatientBooking.slotId)) || activeSlots[0];
            if (prevSlot) {
              const prevStartMins = timeToMinutes(prevSlot.startTime);
              let prevEndMins = timeToMinutes(prevSlot.endTime);
              if (prevEndMins <= prevStartMins) prevEndMins += 24 * 60;
              if (currentMinutes >= prevEndMins) {
                isExpired = true;
              }
            }
          }
        }

        if (isExpired) {
          await prisma.appointment.update({
            where: { id: existingPatientBooking.id },
            data: { status: 'EXPIRED' },
          });
        } else {
          const recipient = effectiveIsForOther ? `for ${patientName}` : 'for yourself';
          const isPending = existingPatientBooking.status === 'PENDING_APPROVAL';
          res.status(400).json({
            success: false,
            message: isPending
              ? `You already have a booking request ${recipient} awaiting payment & receptionist approval with this doctor on this date.`
              : `You already have an active booking (Queue #${existingPatientBooking.queueNumber}) ${recipient} with this doctor on this date.`,
          });
          return;
        }
      }
    }

    // Perform atomic transaction with retry on concurrency collision (Finding H7)
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

          // Re-verify duplicate booking inside the transaction
          if (req.user?.role === 'PATIENT' || (req.user?.role === 'DOCTOR' && patient?.id)) {
            const effectiveIsForOtherTx = Boolean(
              isForOther ||
              (req.user?.role === 'DOCTOR' &&
                patientUser &&
                patientName &&
                patientUser.fullName.trim().toLowerCase() !== String(patientName).trim().toLowerCase())
            );
            const duplicateInTx = await tx.appointment.findFirst({
              where: {
                patientId: patient.id,
                doctorId: doctor.id,
                appointmentDate,
                isForOther: effectiveIsForOtherTx,
                ...(effectiveIsForOtherTx && patientName
                  ? { patientName: { equals: String(patientName).trim(), mode: 'insensitive' } }
                  : {}),
                status: { in: ['PENDING_APPROVAL', 'WAITING', 'IN_CONSULTATION'] },
              },
            });
            if (duplicateInTx) {
              let isExpiredTx = false;
              if (duplicateInTx.status === 'PENDING_APPROVAL') {
                if (appointmentDate < istTodayStr) {
                  isExpiredTx = true;
                } else if (appointmentDate === istTodayStr) {
                  let activeSlots = parseDoctorSlots(doctor);
                  if (targetAffiliation?.slots) {
                    activeSlots = parseAffiliationSlots(targetAffiliation.slots) ?? activeSlots;
                  }
                  const prevSlot = (duplicateInTx.slotId && activeSlots.find((s) => s.id === duplicateInTx.slotId)) || activeSlots[0];
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
                  where: { id: duplicateInTx.id },
                  data: { status: 'EXPIRED' },
                });
              } else {
                const recipient = effectiveIsForOtherTx ? `for ${patientName}` : 'for yourself';
                throw new Error(`DUPLICATE_ACTIVE_BOOKING: You already have an active booking ${recipient} with this doctor on this date.`);
              }
            }
          }
          const dayAppointments = await tx.appointment.findMany({
            where: {
              doctorId: doctor.id,
              appointmentDate,
              ...(targetClinicId ? { clinicId: targetClinicId } : {}),
              status: { in: ['PENDING_APPROVAL', 'WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
            },
            select: {
              id: true,
              slotId: true,
              checkingWindow: true,
              queueNumber: true,
              status: true,
            },
          });

          const bookedInSlot = dayAppointments.filter((a: any) => {
            if (a.status === 'PENDING_APPROVAL') return false;
            if (a.slotId) return a.slotId === chosenSlot!.id;
            if (a.checkingWindow) return a.checkingWindow.includes(chosenSlot!.startTime);
            return slots.length === 1;
          }).length;

          // Check if slot has passed or reached max patients using authoritative server time
          const slotStatus = evaluateSlotStatus(
            chosenSlot!,
            appointmentDate,
            bookedInSlot,
            new Date()
          );
          if (slotStatus.isPassed) {
            throw new Error(
              `This checking slot (${chosenSlot!.name}) has already ended for today. Please pick an upcoming slot or a future date.`
            );
          }

          if (slotStatus.isFull) {
            throw new Error(
              `This checking slot (${chosenSlot!.name}) has reached its maximum patient capacity (${chosenSlot!.maxPatients} patients).`
            );
          }

          // Query max queue number across ALL appointments (including CANCELLED) to avoid unique constraint collision
          // Check if booking is made by patient online (requires receptionist & payment confirmation)
          const isPatientBooking = req.user?.role === 'PATIENT';
          const status = isPatientBooking ? 'PENDING_APPROVAL' : 'WAITING';
          const paymentStatus = isPatientBooking ? 'PENDING' : 'PAID';

          const clinicFilter = targetClinicId ? { clinicId: targetClinicId } : {};

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

          let queueNumber: number;
          if (isPatientBooking) {
            // Negative provisional queue token strictly within PostgreSQL 32-bit signed integer range to prevent DB overflow (scoped by clinic, doctor, and shift on date)
            const minQueueAppt = await tx.appointment.findFirst({
              where: {
                doctorId: doctor.id,
                appointmentDate,
                ...clinicFilter,
                queueNumber: { lt: 0 },
                ...slotFilter,
              },
              orderBy: { queueNumber: 'asc' },
              select: { queueNumber: true },
            });
            queueNumber = minQueueAppt ? minQueueAppt.queueNumber - 1 : -1;
          } else {
            // Direct practitioner / walk-in booking: query max positive queue number scoped by clinic, doctor, and shift on date
            const maxQueueAppt = await tx.appointment.findFirst({
              where: {
                doctorId: doctor.id,
                appointmentDate,
                ...clinicFilter,
                queueNumber: { gt: 0 },
                ...slotFilter,
              },
              orderBy: { queueNumber: 'desc' },
              select: { queueNumber: true },
            });
            const highestQueue = maxQueueAppt && maxQueueAppt.queueNumber > 0 ? maxQueueAppt.queueNumber : 0;
            queueNumber = highestQueue + 1;
          }

          const cleanWalkinPhone = patientPhone ? String(patientPhone).trim() : '';
          const normalizedWalkinPhone = cleanWalkinPhone ? formatIndianPhone(cleanWalkinPhone) : '';
          const isSameDayWalkin = !isPatientBooking && appointmentDate === istTodayStr;

          const created = await tx.appointment.create({
            data: {
              patientId: patient!.id,
              doctorId: doctor.id,
              clinicId: targetClinicId,
              appointmentDate,
              queueNumber,
              slotId: chosenSlot!.id,
              checkingWindow: chosenSlot!.name,
              estimatedTime: slotStatus.estimatedTime,
              status,
              paymentStatus,
              reasonForVisit: reasonForVisit || 'General Medical Consultation',
              symptoms: symptoms || null,
              isForOther: Boolean(isForOther || (req.user?.role === 'DOCTOR' && patientUser && patientName && patientUser.fullName.trim().toLowerCase() !== String(patientName).trim().toLowerCase())),
              patientName: (isForOther && patientName) || (req.user?.role === 'DOCTOR' && patientName) ? String(patientName).trim() : null,
              patientAge: patientAge ? String(patientAge).trim() : null,
              patientGender: patientGender || null,
              isCheckedIn: isSameDayWalkin,
              checkedInAt: isSameDayWalkin ? new Date() : null,
            },
            include: {
              doctor: {
                include: {
                  user: { select: { fullName: true, avatarUrl: true } },
                },
              },
              clinic: {
                select: {
                  id: true,
                  clinicName: true,
                  address: true,
                  city: true,
                  phone: true,
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
              patient: {
                include: {
                  user: { select: { fullName: true, phone: true } },
                },
              },
            },
          });

          (created as any).patientPhone =
            normalizedWalkinPhone || cleanWalkinPhone || created.patient?.user?.phone || null;
          return created;
        }, BOOKING_TX_OPTIONS);

        break; // Successfully booked
      } catch (err: any) {
        attempts++;
        if (
          (err.code === 'P2002' || err.code === 'P2034' || err.code === '40P01' || err.message?.includes('deadlock')) &&
          attempts < maxAttempts
        ) {
          // Retry on unique constraint collision or concurrency lock contention
          continue;
        }
        throw err;
      }
    }

    const cleanDocName = withDr(doctor.user?.fullName);
    const isPendingBooking = newAppointment.status === 'PENDING_APPROVAL';
    const visitWhen = `${formatVisitDate(appointmentDate)} (${chosenSlot.name})`;

    // The doctor sees new bookings live on the dashboard, so only the patient and the desk are told.
    if (req.user?.id) {
      if (isPendingBooking) {
        createNotification(
          req.user.id,
          'Booking request sent',
          `${cleanDocName}, ${visitWhen}. Pay at the desk or call the clinic to confirm it.`,
          'APPOINTMENT'
        ).catch(() => {});
      } else {
        createNotification(
          req.user.id,
          'Booking confirmed',
          `${cleanDocName}, ${visitWhen}. Your token is #${newAppointment.queueNumber}.`,
          'APPOINTMENT'
        ).catch(() => {});
      }
    }

    // Notify clinic receptionists managing this doctor
    if (newAppointment.clinicId) {
      prisma.receptionistProfile
        .findMany({
          where: { clinicId: newAppointment.clinicId, status: 'ACTIVE' },
          include: { doctors: true },
        })
        .then((receptionists) => {
          const displayPatient =
            patientName?.trim() || newAppointment.patientName || newAppointment.patient?.user?.fullName || 'A patient';
          for (const rec of receptionists) {
            const isAssigned =
              rec.doctors.length === 0 ||
              rec.doctors.some((d) => d.doctorId === doctor.id);
            if (isAssigned && rec.userId) {
              createNotification(
                rec.userId,
                isPendingBooking ? 'New booking request' : 'New booking',
                isPendingBooking
                  ? `${displayPatient} wants to see ${cleanDocName} on ${visitWhen}.`
                  : `${displayPatient} booked ${cleanDocName} for ${visitWhen}. Token #${newAppointment.queueNumber}.`,
                'APPOINTMENT'
              ).catch(() => {});
            }
          }
        })
        .catch(() => {});
    }

    const recContact = resolveReceptionistContact(newAppointment.clinic, newAppointment.doctorId, newAppointment.doctor);

    let estimatedQueueNumber = newAppointment.queueNumber > 0 ? newAppointment.queueNumber : 1;
    if (isPendingBooking) {
      const confirmedInSlotCount = await prisma.appointment.count({
        where: {
          doctorId: doctor.id,
          appointmentDate,
          ...(newAppointment.clinicId ? { clinicId: newAppointment.clinicId } : {}),
          queueNumber: { gt: 0 },
          ...(chosenSlot?.id ? { slotId: chosenSlot.id } : {}),
        },
      });
      estimatedQueueNumber = Math.max(1, confirmedInSlotCount + 1);
    }

    const appointmentResponseData = {
      ...newAppointment,
      receptionistPhone: recContact.phone || null,
      receptionistName: recContact.name || null,
      estimatedQueueNumber,
    };

    const responseMsg = isPendingBooking
      ? `Appointment request submitted for ${chosenSlot.name}. Estimated Token #${estimatedQueueNumber}. Call receptionist directly to coordinate online payment (UPI over call) or pay at desk to confirm your queue token.`
      : `Appointment confirmed! You are Queue #${newAppointment.queueNumber} (${chosenSlot.name})`;

    res.status(201).json({
      success: true,
      message: responseMsg,
      data: appointmentResponseData,
    });
  } catch (error: any) {
    console.error('bookAppointment error:', error);
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
      message: 'Failed to book appointment. Please try again.',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};
