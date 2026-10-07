import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  timeToMinutes,
  minutesTo12Hour,
  format12Hour,
  calculateSlotMetrics,
  parseDoctorSlots,
  evaluateSlotStatus,
  SlotStatusResult,
  getLocalDateString,
  getIndianTimeMinutes,
  isValidAppointmentDate,
} from '../utils/scheduleUtils';
import crypto from 'crypto';
import { canTransition } from '../utils/appointmentStateMachine';
import { formatIndianPhone, sanitizeIndianPhone, isValidIndianPhone } from '../utils/phoneUtils';
import { verifyReceptionistDoctorAccess, isDoctorEligibleForClinicalPractice, isClinicActive } from '../utils/authGuards';
import { createNotification } from '../services/notificationService';

// Helper to calculate estimated time given start time "09:00" and offset minutes (retained for backward compatibility)
export const calculateEstimatedTime = (startTime24: string, offsetMinutes: number): string => {
  if (!startTime24) startTime24 = '09:00';
  const { durationMinutes } = calculateSlotMetrics(startTime24, '23:59', 10);
  const startParts = startTime24.replace(/\s*(AM|PM)/i, '').split(':');
  let startHour = parseInt(startParts[0], 10) || 9;
  if (startTime24.toUpperCase().includes('PM') && startHour < 12) startHour += 12;
  if (startTime24.toUpperCase().includes('AM') && startHour === 12) startHour = 0;
  const startTotalMinutes = startHour * 60 + parseInt(startParts[1] || '0', 10);
  const totalMinutes = startTotalMinutes + offsetMinutes;
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return format12Hour(`${hours24}:${minutes.toString().padStart(2, '0')}`);
};

/**
 * Resolves active receptionist contact details for an appointment at a clinic
 */
export const resolveReceptionistContact = (
  clinic: any,
  doctorId?: string,
  doctor?: any
): { phone: string | null; name: string | null } => {
  if (clinic?.receptionists && Array.isArray(clinic.receptionists) && clinic.receptionists.length > 0) {
    if (doctorId) {
      const assigned = clinic.receptionists.find((r: any) =>
        r.doctors?.some((d: any) => d.doctorId === doctorId && (d.status === 'ACTIVE' || !d.status))
      );
      if (assigned) {
        const phone = assigned.phone || assigned.user?.phone || null;
        const name = assigned.user?.fullName || assigned.fullName || null;
        if (phone || name) return { phone, name };
      }
    }
    // Check for general receptionist covering this clinic without doctor restriction
    const general = clinic.receptionists.find((r: any) => !r.doctors || r.doctors.length === 0);
    if (general) {
      const phone = general.phone || general.user?.phone || null;
      const name = general.user?.fullName || general.fullName || null;
      if (phone || name) return { phone, name };
    }
  }

  // Fallback to doctor's assigned receptionists matching this clinic
  if (doctor?.receptionists && Array.isArray(doctor.receptionists) && doctor.receptionists.length > 0) {
    const docRec = doctor.receptionists.find(
      (dr: any) =>
        (!dr.receptionist?.clinicId || !clinic?.id || dr.receptionist.clinicId === clinic.id) &&
        (dr.receptionist?.phone || dr.receptionist?.user?.phone || dr.receptionist?.user?.fullName)
    );
    if (docRec?.receptionist) {
      return {
        phone: docRec.receptionist.phone || docRec.receptionist.user?.phone || null,
        name: docRec.receptionist.user?.fullName || null,
      };
    }
  }

  // Strictly return null if no actual receptionist is assigned; never substitute clinic phone
  return { phone: null, name: null };
};

export const getQueuePreview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { doctorId, appointmentDate, slotId, clinicId } = req.query;

    if (!doctorId || !appointmentDate) {
      res.status(400).json({ success: false, message: 'doctorId and appointmentDate are required' });
      return;
    }

    if (!isValidAppointmentDate(appointmentDate)) {
      res.status(400).json({
        success: false,
        message: 'Invalid appointment date format. Expected valid calendar date in YYYY-MM-DD format.',
      });
      return;
    }

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: String(doctorId) },
      include: {
        user: { select: { fullName: true } },
        clinics: {
          where: { clinic: { isVerified: true, verificationStatus: 'VERIFIED' }, status: { in: ['ACTIVE', 'ACCEPTED'] } },
          include: {
            clinic: {
              include: {
                receptionists: {
                  where: { status: 'ACTIVE' },
                  select: {
                    id: true,
                    status: true,
                    doctors: { select: { doctorId: true, status: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found' });
      return;
    }

    const isOwner = req.user?.role === 'DOCTOR' && doctor.userId === req.user?.id;
    const isAdmin = req.user?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      if (!doctor.isVerified || doctor.verificationStatus !== 'VERIFIED') {
        res.status(404).json({
          success: false,
          message: 'Doctor profile is not publicly available or pending verification',
        });
        return;
      }
    }

    const dateStr = String(appointmentDate);
    const activeClinics = doctor.clinics || [];

    // Resolve target clinic affiliation
    let selectedAffiliation: any = null;
    if (clinicId) {
      selectedAffiliation = activeClinics.find((c: any) => c.clinicId === String(clinicId));
    }
    if (!selectedAffiliation && activeClinics.length === 1) {
      selectedAffiliation = activeClinics[0];
    }

    // Determine slots: prioritize clinic-specific slots if available
    let slots = parseDoctorSlots(doctor);
    if (selectedAffiliation?.slots) {
      try {
        const parsed = typeof selectedAffiliation.slots === 'string' ? JSON.parse(selectedAffiliation.slots) : selectedAffiliation.slots;
        if (Array.isArray(parsed) && parsed.length > 0) {
          slots = parsed;
        }
      } catch {}
    }

    const effectiveConsultationFee = selectedAffiliation?.consultationFee ?? doctor.consultationFee;

    // Fetch all active appointments for this doctor on this date, clinic-scoped if clinic selected
    const dayAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        appointmentDate: dateStr,
        ...(selectedAffiliation?.clinicId ? { clinicId: selectedAffiliation.clinicId } : {}),
        status: { in: ['PENDING_APPROVAL', 'WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
      },
      select: {
        id: true,
        queueNumber: true,
        slotId: true,
        checkingWindow: true,
        status: true,
      },
    });

    // Highest positive queue number on this date across appointments for this clinic (FIX-014)
    const maxQueueAppt = await prisma.appointment.findFirst({
      where: {
        doctorId: doctor.id,
        appointmentDate: dateStr,
        ...(selectedAffiliation?.clinicId ? { clinicId: selectedAffiliation.clinicId } : {}),
        queueNumber: { gt: 0 },
      },
      orderBy: { queueNumber: 'desc' },
      select: { queueNumber: true },
    });
    const highestQueue = maxQueueAppt && maxQueueAppt.queueNumber > 0 ? maxQueueAppt.queueNumber : 0;
    const nextQueueNumber = Math.max(1, highestQueue + 1);

    // Evaluate status for each slot using authoritative server time
    const availableSlots: SlotStatusResult[] = slots.map((slot) => {
      const bookedInSlot = dayAppointments.filter((a) => {
        if (a.slotId) return a.slotId === slot.id;
        if (a.checkingWindow) return a.checkingWindow.includes(slot.startTime);
        return slots.length === 1;
      }).length;

      const waitingInSlot = dayAppointments.filter((a) => {
        if (a.status !== 'WAITING' && a.status !== 'IN_CONSULTATION') return false;
        if (a.slotId) return a.slotId === slot.id;
        if (a.checkingWindow) return a.checkingWindow.includes(slot.startTime);
        return slots.length === 1;
      }).length;

      return evaluateSlotStatus(
        slot,
        dateStr,
        bookedInSlot,
        new Date(),
        undefined,
        waitingInSlot
      );
    });

    // Target slot selection: chosen slotId if valid and not passed, or first non-passed and non-full slot, or first slot
    let selectedSlotStatus: SlotStatusResult | undefined;
    if (slotId) {
      selectedSlotStatus = availableSlots.find((s) => s.slot.id === String(slotId));
      if (selectedSlotStatus && selectedSlotStatus.isPassed) {
        const alt = availableSlots.find((s) => !s.isPassed && !s.isFull);
        if (alt) selectedSlotStatus = alt;
      }
    }
    if (!selectedSlotStatus) {
      selectedSlotStatus = availableSlots.find((s) => !s.isPassed && !s.isFull) || availableSlots[0];
    }

    res.json({
      success: true,
      data: {
        doctorId: doctor.id,
        doctorName: doctor.user.fullName,
        appointmentDate: dateStr,
        selectedSlotId: selectedSlotStatus.slot.id,
        selectedSlot: selectedSlotStatus,
        availableSlots,
        checkingWindow: selectedSlotStatus.slot.name,
        checkingStartTime: selectedSlotStatus.slot.startTime,
        checkingEndTime: selectedSlotStatus.slot.endTime,
        avgConsultationMinutes: selectedSlotStatus.slot.avgConsultationMinutes,
        maxDailyPatients: selectedSlotStatus.slot.maxPatients,
        totalBooked: selectedSlotStatus.totalBooked,
        nextQueueNumber,
        patientsAhead: selectedSlotStatus.patientsAhead,
        estimatedTime: selectedSlotStatus.estimatedTime,
        isFull: selectedSlotStatus.isFull,
        isPassed: selectedSlotStatus.isPassed,
        isInProgress: selectedSlotStatus.isInProgress,
        statusLabel: selectedSlotStatus.statusLabel,
        consultationFee: effectiveConsultationFee,
        clinicId: selectedAffiliation?.clinicId || null,
        clinicName: selectedAffiliation?.clinic?.clinicName || null,
        hasReceptionist: (() => {
          const recs = selectedAffiliation?.clinic?.receptionists || [];
          return recs.some((r: any) =>
            !r.doctors || r.doctors.length === 0 ||
            r.doctors.some((d: any) => d.doctorId === doctor.id && (d.status === 'ACTIVE' || !d.status))
          );
        })(),
        selectedClinic: selectedAffiliation
          ? {
              clinicId: selectedAffiliation.clinicId,
              clinicName: selectedAffiliation.clinic.clinicName,
              address: selectedAffiliation.clinic.address,
              city: selectedAffiliation.clinic.city,
              phone: selectedAffiliation.clinic.phone,
              consultationFee: effectiveConsultationFee,
              hasReceptionist: (selectedAffiliation.clinic.receptionists || []).some((r: any) =>
                !r.doctors || r.doctors.length === 0 ||
                r.doctors.some((d: any) => d.doctorId === doctor.id && (d.status === 'ACTIVE' || !d.status))
              ),
            }
          : null,
        hasClinics: activeClinics.length > 0,
        clinicsCount: activeClinics.length,
        clinics: activeClinics.map((c: any) => {
          let cSlots = parseDoctorSlots(doctor);
          if (c.slots) {
            try {
              const p = typeof c.slots === 'string' ? JSON.parse(c.slots) : c.slots;
              if (Array.isArray(p) && p.length > 0) cSlots = p;
            } catch {}
          }
          const cHasReceptionist = (c.clinic?.receptionists || []).some((r: any) =>
            !r.doctors || r.doctors.length === 0 ||
            r.doctors.some((d: any) => d.doctorId === doctor.id && (d.status === 'ACTIVE' || !d.status))
          );
          return {
            clinicId: c.clinicId,
            clinicName: c.clinic.clinicName,
            address: c.clinic.address,
            city: c.clinic.city,
            phone: c.clinic.phone,
            consultationFee: c.consultationFee ?? doctor.consultationFee,
            slots: cSlots,
            hasReceptionist: cHasReceptionist,
          };
        }),
      },
    });
  } catch (error: any) {
    console.error('getQueuePreview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate queue preview',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

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
      if (doctorId && doctorId !== myDoctorProfile.id) {
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
        patientUser = await prisma.user.findFirst({
          where: {
            role: 'PATIENT',
            OR: [
              ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
              ...(rawDigits ? [{ phone: rawDigits }] : []),
              { phone: cleanPhone },
            ],
          },
          include: { patientProfile: true },
        });
      }
      if (!patientUser) {
        const unguessablePassword = crypto.randomBytes(32).toString('hex');
        const dummySalt = await bcrypt.genSalt(12);
        const dummyHash = await bcrypt.hash(unguessablePassword, dummySalt);
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

    const doctor = await prisma.doctorProfile.findUnique({
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
            { doctors: { none: {} } },
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

    // Check if patient already has an active appointment with this doctor on this day (applies to PATIENT self-booking)
    if (req.user.role === 'PATIENT') {
      const existingPatientBooking = await prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          doctorId: doctor.id,
          appointmentDate,
          isForOther: Boolean(isForOther),
          ...(isForOther && patientName
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
              try {
                const parsed = typeof targetAffiliation.slots === 'string' ? JSON.parse(targetAffiliation.slots) : targetAffiliation.slots;
                if (Array.isArray(parsed) && parsed.length > 0) activeSlots = parsed;
              } catch {}
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
          const recipient = isForOther ? `for ${patientName}` : 'for yourself';
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
          // Concurrency control: lock practitioner row for this booking without swallowing errors (BUG-05)
          await tx.$executeRaw`SELECT id FROM "DoctorProfile" WHERE id = ${doctor.id} FOR UPDATE;`;

          // Re-verify duplicate booking inside the transaction
          if (req.user?.role === 'PATIENT') {
            const duplicateInTx = await tx.appointment.findFirst({
              where: {
                patientId: patient.id,
                doctorId: doctor.id,
                appointmentDate,
                isForOther: Boolean(isForOther),
                ...(isForOther && patientName
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
                    try {
                      const parsed = typeof targetAffiliation.slots === 'string' ? JSON.parse(targetAffiliation.slots) : targetAffiliation.slots;
                      if (Array.isArray(parsed) && parsed.length > 0) activeSlots = parsed;
                    } catch {}
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
                const recipient = isForOther ? `for ${patientName}` : 'for yourself';
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
            },
          });

          const bookedInSlot = dayAppointments.filter((a) => {
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

          let queueNumber: number;
          if (isPatientBooking) {
            // Negative provisional queue token strictly within PostgreSQL 32-bit signed integer range to prevent DB overflow (FIX-014 scoped by clinic)
            const minQueueAppt = await tx.appointment.findFirst({
              where: {
                doctorId: doctor.id,
                appointmentDate,
                ...clinicFilter,
                queueNumber: { lt: 0 },
              },
              orderBy: { queueNumber: 'asc' },
              select: { queueNumber: true },
            });
            queueNumber = minQueueAppt ? minQueueAppt.queueNumber - 1 : -1;
          } else {
            // Direct practitioner / walk-in booking: query max positive queue number (FIX-014 scoped by clinic)
            const maxQueueAppt = await tx.appointment.findFirst({
              where: {
                doctorId: doctor.id,
                appointmentDate,
                ...clinicFilter,
                queueNumber: { gt: 0 },
              },
              orderBy: { queueNumber: 'desc' },
              select: { queueNumber: true },
            });
            const highestQueue = maxQueueAppt?.queueNumber || 0;
            queueNumber = highestQueue + 1;
          }

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
              isCheckedIn: !isPatientBooking,
              checkedInAt: !isPatientBooking ? new Date() : null,
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
                  user: { select: { fullName: true, email: true, phone: true } },
                },
              },
            },
          });

          return created;
        });

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

    const rawDocName = doctor.user?.fullName || 'Practitioner';
    const cleanDocName = rawDocName.startsWith('Dr.') ? rawDocName : `Dr. ${rawDocName}`;
    const isPendingBooking = newAppointment.status === 'PENDING_APPROVAL';

    if (req.user?.id) {
      if (isPendingBooking) {
        createNotification(
          req.user.id,
          'Appointment Request Received',
          `Your visit request with ${cleanDocName} for ${appointmentDate} (${chosenSlot.name}) has been submitted. Pay receptionist at desk to confirm your queue token.`,
          'APPOINTMENT'
        ).catch(() => {});
      } else {
        createNotification(
          req.user.id,
          'Appointment Booking Confirmed',
          `Your visit with ${cleanDocName} for ${appointmentDate} (${chosenSlot.name}) has been confirmed. You are Queue #${newAppointment.queueNumber}.`,
          'APPOINTMENT'
        ).catch(() => {});
      }
    }
    if (doctor?.userId) {
      createNotification(
        doctor.userId,
        isPendingBooking ? 'New Appointment Request' : 'New Appointment Booking',
        `A patient has ${isPendingBooking ? 'requested' : 'booked'} a visit for ${appointmentDate} (${chosenSlot.name}).`,
        'APPOINTMENT'
      ).catch(() => {});
    }

    // Notify clinic receptionists managing this doctor
    if (newAppointment.clinicId) {
      prisma.receptionistProfile
        .findMany({
          where: { clinicId: newAppointment.clinicId, status: 'ACTIVE' },
          include: { doctors: true },
        })
        .then((receptionists) => {
          const displayPatient = patientName?.trim() || 'A patient';
          for (const rec of receptionists) {
            const isAssigned =
              rec.doctors.length === 0 ||
              rec.doctors.some((d) => d.doctorId === doctor.id);
            if (isAssigned && rec.userId) {
              createNotification(
                rec.userId,
                isPendingBooking ? 'New Appointment Request' : 'New Appointment Booking',
                `${displayPatient} has ${isPendingBooking ? 'requested' : 'booked'} a visit with ${cleanDocName} for ${appointmentDate} (${chosenSlot.name}).`,
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
      const maxConfirmed = await prisma.appointment.findFirst({
        where: {
          doctorId: doctor.id,
          appointmentDate,
          ...(newAppointment.clinicId ? { clinicId: newAppointment.clinicId } : {}),
          queueNumber: { gt: 0 },
          ...(chosenSlot?.id ? { slotId: chosenSlot.id } : {}),
        },
        orderBy: { queueNumber: 'desc' },
        select: { queueNumber: true },
      });
      estimatedQueueNumber = Math.max(1, (maxConfirmed?.queueNumber || 0) + 1);
    }

    const appointmentResponseData = {
      ...newAppointment,
      receptionistPhone: recContact.phone || null,
      receptionistName: recContact.name || null,
      estimatedQueueNumber,
    };

    const responseMsg = isPendingBooking
      ? `Appointment request submitted for ${chosenSlot.name}. Estimated Token #${estimatedQueueNumber}. Pay receptionist at desk to confirm your queue token.`
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

export const getAppointmentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        doctor: {
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true, email: true, phone: true } },
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
            user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true } },
          },
        },
        review: true,
      },
    });

    if (!appointment) {
      res.status(404).json({ success: false, message: 'Appointment not found' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    // Access control: Doctor of appointment, patient of appointment, Admin, or authorized Clinic/Receptionist
    const docEligible = isDoctorEligibleForClinicalPractice(appointment.doctor).eligible;
      const isDoctor = req.user.role === 'DOCTOR' && appointment.doctor.userId === req.user.id && docEligible;
      const isPatient = req.user.role === 'PATIENT' && appointment.patient.userId === req.user.id;
      const isAdmin = req.user.role === 'ADMIN';

      let isClinicOrRec = false;
      if (req.user.role === 'CLINIC' && appointment.clinicId) {
        const clinic = await prisma.clinicProfile.findUnique({
          where: { userId: req.user.id },
        });
        const clinicCheck = isClinicActive(clinic);
        isClinicOrRec = Boolean(clinicCheck.active && clinic && clinic.id === appointment.clinicId);
      } else if (req.user.role === 'RECEPTIONIST') {
        const access = await verifyReceptionistDoctorAccess(req.user.id, appointment.doctorId, appointment.clinicId);
        isClinicOrRec = access.authorized;
      }

      if (!isDoctor && !isPatient && !isAdmin && !isClinicOrRec) {
        res.status(403).json({ success: false, message: 'Access denied: You are not authorized to view this appointment' });
        return;
      }

    let estimatedQueueNumber = appointment.queueNumber > 0 ? appointment.queueNumber : 1;
    if (appointment.status === 'PENDING_APPROVAL') {
      const maxConfirmed = await prisma.appointment.findFirst({
        where: {
          doctorId: appointment.doctorId,
          appointmentDate: appointment.appointmentDate,
          ...(appointment.clinicId ? { clinicId: appointment.clinicId } : {}),
          queueNumber: { gt: 0 },
          ...(appointment.slotId ? { slotId: appointment.slotId } : {}),
        },
        orderBy: { queueNumber: 'desc' },
        select: { queueNumber: true },
      });
      estimatedQueueNumber = Math.max(1, (maxConfirmed?.queueNumber || 0) + 1);
    }

    const recContact = resolveReceptionistContact(appointment.clinic, appointment.doctorId, appointment.doctor);
    res.json({
      success: true,
      data: {
        ...appointment,
        receptionistPhone: recContact.phone || null,
        receptionistName: recContact.name || null,
        estimatedQueueNumber,
      },
    });
  } catch (error: any) {
    console.error('getAppointmentById error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve appointment',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

export const getPatientAppointments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'PATIENT') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    let patient = await prisma.patientProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!patient) {
      patient = await prisma.patientProfile.create({
        data: { userId: req.user.id },
      });
    }

    const now = new Date();
    const istTodayStr = getLocalDateString(now);
    const currentMinutes = getIndianTimeMinutes(now);

    // Auto-expire past unconfirmed PENDING_APPROVAL requests whose consultation date has already passed
    await prisma.appointment.updateMany({
      where: {
        patientId: patient.id,
        status: 'PENDING_APPROVAL',
        appointmentDate: { lt: istTodayStr },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    const appointments = await prisma.appointment.findMany({
      where: { patientId: patient.id },
      include: {
        doctor: {
          include: {
            user: { select: { fullName: true, avatarUrl: true } },
            clinics: {
              where: { clinic: { isVerified: true, verificationStatus: 'VERIFIED' } },
              include: { clinic: true },
            },
            receptionists: {
              where: { status: 'ACTIVE' },
              include: {
                receptionist: {
                  include: {
                    user: { select: { fullName: true, phone: true } },
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
            user: { select: { fullName: true, email: true, phone: true, avatarUrl: true } },
          },
        },
        review: true,
      },
      orderBy: [{ appointmentDate: 'desc' }, { queueNumber: 'asc' }],
    });

    // Batch active appointments to eliminate N+1 polling query explosion on Supabase (BUG-14)
    const activeAppts = appointments.filter(
      (a) => a.status === 'WAITING' || a.status === 'IN_CONSULTATION' || a.status === 'PENDING_APPROVAL'
    );
    const doctorIds = Array.from(new Set(activeAppts.map((a) => a.doctorId)));
    const dates = Array.from(new Set(activeAppts.map((a) => a.appointmentDate)));

    const activeBatchAppointments =
      doctorIds.length > 0 && dates.length > 0
        ? await prisma.appointment.findMany({
            where: {
              doctorId: { in: doctorIds },
              appointmentDate: { in: dates },
              status: { in: ['WAITING', 'IN_CONSULTATION'] },
              queueNumber: { gt: 0 },
            },
            select: {
              doctorId: true,
              appointmentDate: true,
              clinicId: true,
              slotId: true,
              checkingWindow: true,
              queueNumber: true,
              status: true,
            },
          })
        : [];

    // Calculate real-time queue position for active appointments in-memory
    const enrichedAppointments = appointments.map((appt) => {
      const targetClinicAffiliation = appt.clinicId
        ? (appt.doctor as any)?.clinics?.find((c: any) => c.clinicId === appt.clinicId)
        : null;
      const clinicFee = targetClinicAffiliation?.consultationFee ?? appt.doctor.consultationFee;

      const recContact = resolveReceptionistContact(appt.clinic, appt.doctorId, appt.doctor);
      const apptWithRec = {
        ...appt,
        receptionistPhone: recContact.phone || null,
        receptionistName: recContact.name || null,
      };

      if (appt.status === 'WAITING' || appt.status === 'IN_CONSULTATION') {
        let slots = parseDoctorSlots(appt.doctor);
        if (targetClinicAffiliation?.slots) {
          try {
            const parsed = typeof targetClinicAffiliation.slots === 'string' ? JSON.parse(targetClinicAffiliation.slots) : targetClinicAffiliation.slots;
            if (Array.isArray(parsed) && parsed.length > 0) slots = parsed;
          } catch {}
        }
        const slot = (appt.slotId && slots.find((s) => s.id === appt.slotId)) || slots[0];
        const pace = slot?.avgConsultationMinutes || 3.0;

        // Find currently serving queue number in memory from batch
        const currentServingAppt = activeBatchAppointments.find((a) =>
          a.doctorId === appt.doctorId &&
          a.appointmentDate === appt.appointmentDate &&
          (appt.clinicId ? a.clinicId === appt.clinicId : true) &&
          (appt.slotId ? a.slotId === appt.slotId : appt.checkingWindow ? a.checkingWindow === appt.checkingWindow : true) &&
          a.status === 'IN_CONSULTATION'
        );
        const currentServingQueueNumber = currentServingAppt?.queueNumber || 0;

        // Count patients ahead waiting in this slot in memory from batch
        const patientsAhead = activeBatchAppointments.filter((a) =>
          a.doctorId === appt.doctorId &&
          a.appointmentDate === appt.appointmentDate &&
          (appt.clinicId ? a.clinicId === appt.clinicId : true) &&
          (appt.slotId ? a.slotId === appt.slotId : appt.checkingWindow ? a.checkingWindow === appt.checkingWindow : true) &&
          a.queueNumber > 0 &&
          a.queueNumber < appt.queueNumber
        ).length;

        // Check shift timing for today strictly using IST timezone (BUG-23)
        const slotStartMins = timeToMinutes(slot.startTime);
        let slotEndMins = timeToMinutes(slot.endTime);
        if (slotEndMins <= slotStartMins) slotEndMins += 24 * 60;

        const now = new Date();
        const istTodayStr = getLocalDateString(now);
        const isToday = appt.appointmentDate === istTodayStr;
        const currentMinutes = getIndianTimeMinutes(now);

        const isShiftPassed = isToday && currentMinutes >= slotEndMins;
        const isShiftActive = isToday && currentMinutes >= slotStartMins && currentMinutes < slotEndMins;

        const estWaitMinutes = Math.round(patientsAhead * pace);
        const isYourTurn = appt.status === 'IN_CONSULTATION' || (isShiftActive && patientsAhead === 0);

        let liveEstimatedTime = appt.estimatedTime;
        if (isToday) {
          if (isShiftPassed) {
            liveEstimatedTime = 'Shift Ended';
          } else if (isShiftActive) {
            liveEstimatedTime = minutesTo12Hour(currentMinutes + estWaitMinutes);
          }
        }

        return {
          ...apptWithRec,
          fee: clinicFee,
          estimatedQueueNumber: appt.queueNumber,
          liveQueue: {
            currentServingQueueNumber: currentServingQueueNumber || (isShiftActive ? 1 : 0),
            patientsAway: patientsAhead,
            estimatedWaitMinutes: estWaitMinutes,
            isYourTurn,
            isShiftActive,
            isShiftPassed,
            liveEstimatedTime,
            estimatedQueueNumber: appt.queueNumber,
          },
        };
      }

      // Check if PENDING_APPROVAL has expired today due to passed shift
      if (appt.status === 'PENDING_APPROVAL') {
        let slots = parseDoctorSlots(appt.doctor);
        if (targetClinicAffiliation?.slots) {
          try {
            const parsed = typeof targetClinicAffiliation.slots === 'string' ? JSON.parse(targetClinicAffiliation.slots) : targetClinicAffiliation.slots;
            if (Array.isArray(parsed) && parsed.length > 0) slots = parsed;
          } catch {}
        }
        const slot = (appt.slotId && slots.find((s) => s.id === appt.slotId)) || slots[0];
        let isShiftPassed = false;
        let effectiveStatus = appt.status;

        // Calculate estimated token / queue number for this shift based on confirmed queue numbers
        const confirmedForShift = activeBatchAppointments.filter((a) =>
          a.doctorId === appt.doctorId &&
          a.appointmentDate === appt.appointmentDate &&
          (appt.clinicId ? a.clinicId === appt.clinicId : true) &&
          (appt.slotId ? a.slotId === appt.slotId : appt.checkingWindow ? a.checkingWindow === appt.checkingWindow : true)
        );
        const maxConfirmedQueue = confirmedForShift.reduce((max, a) => Math.max(max, a.queueNumber), 0);
        const estimatedQueueNumber = Math.max(1, maxConfirmedQueue + 1);

        if (slot) {
          const slotStartMins = timeToMinutes(slot.startTime);
          let slotEndMins = timeToMinutes(slot.endTime);
          if (slotEndMins <= slotStartMins) slotEndMins += 24 * 60;

          if (appt.appointmentDate < istTodayStr || (appt.appointmentDate === istTodayStr && currentMinutes >= slotEndMins)) {
            effectiveStatus = 'EXPIRED';
            isShiftPassed = true;
            // Update in database asynchronously
            prisma.appointment.update({
              where: { id: appt.id },
              data: { status: 'EXPIRED' },
            }).catch(() => {});
          }
        }

        return {
          ...apptWithRec,
          status: effectiveStatus,
          fee: clinicFee,
          estimatedQueueNumber,
          liveQueue: {
            currentServingQueueNumber: 0,
            patientsAway: maxConfirmedQueue,
            estimatedWaitMinutes: Math.round(maxConfirmedQueue * (slot?.avgConsultationMinutes || 3.0)),
            isYourTurn: false,
            isShiftActive: false,
            isShiftPassed,
            liveEstimatedTime: isShiftPassed ? 'Shift Ended' : appt.estimatedTime,
            estimatedQueueNumber,
          },
        };
      }

      return {
        ...apptWithRec,
        fee: clinicFee,
      };
    });

    res.json({ success: true, count: enrichedAppointments.length, data: enrichedAppointments });
  } catch (error: any) {
    console.error('getPatientAppointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

export const cancelAppointment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    const appointment: any = await prisma.appointment.findUnique({
      where: { id },
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

    // Verify ownership and permissions
    if (req.user?.role === 'PATIENT' && appointment.patient.userId !== req.user.id) {
      res.status(403).json({ success: false, message: 'You do not have permission to cancel this appointment' });
      return;
    }

    if (req.user?.role === 'DOCTOR') {
      if (appointment.doctor.userId !== req.user.id) {
        res.status(403).json({ success: false, message: 'You do not have permission to cancel another doctor\'s appointment' });
        return;
      }
      const docCheck = isDoctorEligibleForClinicalPractice(appointment.doctor);
      if (!docCheck.eligible) {
        res.status(403).json({ success: false, message: docCheck.reason });
        return;
      }
    }

    if (req.user?.role === 'RECEPTIONIST') {
      const access = await verifyReceptionistDoctorAccess(req.user.id, appointment.doctorId, appointment.clinicId);
      if (!access.authorized) {
        res.status(403).json({ success: false, message: access.reason || 'You do not have permission to cancel appointments for this doctor' });
        return;
      }
    } else if (req.user?.role === 'CLINIC') {
      const clinic = await prisma.clinicProfile.findUnique({
        where: { userId: req.user.id },
      });
      const clinicCheck = isClinicActive(clinic);
      if (!clinicCheck.active) {
        res.status(403).json({ success: false, message: clinicCheck.reason });
        return;
      }
      if (!clinic || appointment.clinicId !== clinic.id) {
        res.status(403).json({ success: false, message: 'You do not have permission to cancel appointments for this clinic' });
        return;
      }
    } else if (req.user?.role !== 'ADMIN' && req.user?.role !== 'PATIENT' && req.user?.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const transitionCheck = canTransition(appointment.status, 'CANCELLED', req.user?.role as any);
    if (!transitionCheck.allowed) {
      res.status(400).json({
        success: false,
        message: transitionCheck.reason || 'Cannot cancel appointment in its current status.',
      });
      return;
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    if (req.user?.role === 'PATIENT' && appointment.doctor?.userId) {
      createNotification(
        appointment.doctor.userId,
        'Appointment Cancelled by Patient',
        `The appointment for ${appointment.appointmentDate} (Token #${appointment.queueNumber}) was cancelled by the patient.`,
        'APPOINTMENT'
      ).catch(() => {});
    } else if (req.user?.role !== 'PATIENT' && appointment.patient?.userId) {
      createNotification(
        appointment.patient.userId,
        'Appointment Cancelled',
        `Your appointment with Dr. ${appointment.doctor?.user?.fullName || 'Practitioner'} for ${appointment.appointmentDate} was cancelled.`,
        'APPOINTMENT'
      ).catch(() => {});
    }

    res.json({ success: true, message: 'Appointment cancelled successfully', data: updated });
  } catch (error: any) {
    console.error('cancelAppointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel appointment',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Patient Physical Clinic Check-In via Scanned Clinic QR Code
 * Accessible by authenticated PATIENT.
 * Requires clinicId and the clinic's physical QR security code.
 */
export const checkInAppointmentWithQR = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required to check in' });
      return;
    }

    const { clinicId, code, appointmentId } = req.body;

    if (!clinicId || !code) {
      res.status(400).json({
        success: false,
        message: 'Clinic ID and physical QR security code are required to verify clinic arrival.',
      });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { id: String(clinicId) },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic facility not found' });
      return;
    }

    // Anti-spoofing verification: check security code on physical poster
    const normalizedCode = String(code).trim();
    if (!clinic.checkinCode || clinic.checkinCode !== normalizedCode) {
      res.status(403).json({
        success: false,
        message: 'Invalid clinic check-in security code. Please scan the physical QR poster displayed at the clinic.',
      });
      return;
    }

    const todayStr = getLocalDateString(new Date());
    let appointment: any = null;

    if (appointmentId) {
      appointment = await prisma.appointment.findUnique({
        where: { id: String(appointmentId) },
        include: {
          patient: true,
          doctor: { include: { user: { select: { fullName: true } } } },
          clinic: true,
        },
      });

      if (!appointment || appointment.patient.userId !== req.user.id) {
        res.status(404).json({ success: false, message: 'Appointment not found or not owned by your account' });
        return;
      }
      if (appointment.clinicId && appointment.clinicId !== clinic.id) {
        res.status(400).json({
          success: false,
          message: `This appointment is booked at a different venue (${appointment.clinic?.clinicName || 'another clinic'}).`,
        });
        return;
      }
    } else {
      // Find today's active appointment for this patient at this clinic
      const patient = await prisma.patientProfile.findUnique({
        where: { userId: req.user.id },
      });

      if (!patient) {
        res.status(404).json({ success: false, message: 'Patient profile not found' });
        return;
      }

      appointment = await prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          appointmentDate: todayStr,
          status: { in: ['WAITING', 'IN_CONSULTATION'] },
          OR: [
            { clinicId: clinic.id },
            { clinicId: null },
          ],
        },
        include: {
          patient: true,
          doctor: { include: { user: { select: { fullName: true } } } },
          clinic: true,
        },
        orderBy: { queueNumber: 'asc' },
      });
    }

    if (!appointment) {
      res.status(404).json({
        success: false,
        message: `No active consultation appointment found for today (${todayStr}) at ${clinic.clinicName}.`,
      });
      return;
    }

    if (appointment.appointmentDate !== todayStr) {
      res.status(400).json({
        success: false,
        message: `Check-in is only available on the date of your consultation (${appointment.appointmentDate}). Today is ${todayStr}.`,
      });
      return;
    }

    if (appointment.status === 'PENDING_APPROVAL') {
      res.status(400).json({
        success: false,
        message: 'Your booking request is awaiting desk confirmation. Please pay your consultation fee at the reception desk to confirm your queue spot.',
      });
      return;
    }

    if (appointment.status === 'EXPIRED') {
      res.status(400).json({
        success: false,
        message: 'This appointment request has expired because the consultation shift has already concluded. Please book for the next available shift.',
      });
      return;
    }

    if (appointment.status !== 'WAITING' && appointment.status !== 'IN_CONSULTATION') {
      res.status(400).json({
        success: false,
        message: `Cannot check in appointment in '${appointment.status}' status.`,
      });
      return;
    }

    if (appointment.isCheckedIn) {
      res.json({
        success: true,
        alreadyCheckedIn: true,
        message: `You are already checked in at ${clinic.clinicName} (Queue #${appointment.queueNumber}).`,
        data: appointment,
      });
      return;
    }

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        isCheckedIn: true,
        checkedInAt: new Date(),
      },
      include: {
        doctor: { include: { user: { select: { fullName: true } } } },
        clinic: true,
      },
    });

    if (updated.doctor?.user) {
      const docProfile = await prisma.doctorProfile.findUnique({
        where: { id: updated.doctorId },
        select: { userId: true },
      });
      if (docProfile?.userId) {
        createNotification(
          docProfile.userId,
          'Patient Arrived at Clinic Desk',
          `Queue Token #${updated.queueNumber} (${appointment.patientName || 'Patient'}) has checked in at ${clinic.clinicName}.`,
          'QUEUE'
        ).catch(() => {});
      }
    }

    if (updated.clinicId) {
      prisma.receptionistProfile
        .findMany({
          where: { clinicId: updated.clinicId, status: 'ACTIVE' },
          include: { doctors: true },
        })
        .then((receptionists) => {
          const patientDisplayName = appointment.patientName || appointment.patient?.user?.fullName || 'Patient';
          for (const rec of receptionists) {
            const isAssigned =
              rec.doctors.length === 0 ||
              rec.doctors.some((d) => d.doctorId === updated.doctorId);
            if (isAssigned && rec.userId) {
              createNotification(
                rec.userId,
                'Patient Arrived at Clinic Desk',
                `${patientDisplayName} (Queue #${updated.queueNumber}) has checked in on-site for Dr. ${updated.doctor?.user?.fullName || 'Doctor'}.`,
                'QUEUE'
              ).catch(() => {});
            }
          }
        })
        .catch(() => {});
    }

    res.json({
      success: true,
      message: `Arrival verified! You are checked in at ${clinic.clinicName} (Queue #${updated.queueNumber}). Dr. ${updated.doctor.user.fullName} and reception desk are notified.`,
      data: updated,
    });
  } catch (error: any) {
    console.error('checkInAppointmentWithQR error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process physical clinic check-in',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Direct Receptionist / Doctor Check-In Toggle
 * Accessible by RECEPTIONIST, DOCTOR, or ADMIN.
 */
export const checkInAppointmentDirect = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !['RECEPTIONIST', 'DOCTOR', 'ADMIN', 'PATIENT'].includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Access denied: valid account required' });
      return;
    }

    const id = String(req.params.id);
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { doctor: true, clinic: true },
    });

    if (!appointment) {
      res.status(404).json({ success: false, message: 'Appointment not found' });
      return;
    }

    if (req.user.role === 'DOCTOR') {
      if (appointment.doctor.userId !== req.user.id) {
        res.status(403).json({ success: false, message: "Unauthorized for another practitioner's appointment" });
        return;
      }
    } else if (req.user.role === 'RECEPTIONIST') {
      const access = await verifyReceptionistDoctorAccess(req.user.id, appointment.doctorId, appointment.clinicId);
      if (!access.authorized) {
        res.status(403).json({ success: false, message: access.reason || 'Unauthorized for this doctor' });
        return;
      }
    } else if (req.user.role === 'PATIENT') {
      const patProfile = await prisma.patientProfile.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (!patProfile || appointment.patientId !== patProfile.id) {
        res.status(403).json({ success: false, message: "Unauthorized for another patient's appointment" });
        return;
      }

      // Security: Patients cannot self-attest physical arrival. They must scan the on-site clinic QR standee!
      const targetState = req.body.isCheckedIn !== undefined ? Boolean(req.body.isCheckedIn) : !appointment.isCheckedIn;
      if (targetState) {
        res.status(403).json({
          success: false,
          message: 'Patients must scan the on-site clinic QR standee to verify physical arrival.',
        });
        return;
      }
    }

    if (['EXPIRED', 'CANCELLED', 'REJECTED'].includes(appointment.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot update check-in status for an appointment with status '${appointment.status}'.`,
      });
      return;
    }

    const todayIso = getLocalDateString();
    const newCheckedInState =
      req.body.isCheckedIn !== undefined ? Boolean(req.body.isCheckedIn) : !appointment.isCheckedIn;

    if (newCheckedInState && appointment.appointmentDate !== todayIso) {
      res.status(400).json({
        success: false,
        message: `Cannot check in an appointment scheduled for ${appointment.appointmentDate}. Check-in is only available on the scheduled date (${todayIso}).`,
      });
      return;
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        isCheckedIn: newCheckedInState,
        checkedInAt: newCheckedInState ? new Date() : null,
      },
      include: {
        patient: { include: { user: { select: { fullName: true } } } },
      },
    });

    res.json({
      success: true,
      message: newCheckedInState
        ? `Patient marked as arrived at clinic (Queue #${updated.queueNumber})`
        : `Patient check-in removed (Queue #${updated.queueNumber})`,
      data: updated,
    });
  } catch (error: any) {
    console.error('checkInAppointmentDirect error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update patient check-in status',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Submit verified patient review and rating for completed consultation (BUG-08)
 */
export const submitAppointmentReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'PATIENT') {
      res.status(403).json({ success: false, message: 'Only patients can submit reviews' });
      return;
    }

    const { id } = req.params;
    const appointmentId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
    const { rating, comment } = req.body;

    const numRating = Math.round(Number(rating));
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5 stars' });
      return;
    }

    const patient = await prisma.patientProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!patient) {
      res.status(404).json({ success: false, message: 'Patient profile not found' });
      return;
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { review: true, doctor: true },
    });

    if (!appointment || appointment.patientId !== patient.id) {
      res.status(404).json({ success: false, message: 'Appointment not found or unauthorized' });
      return;
    }

    if (appointment.status !== 'COMPLETED') {
      res.status(400).json({ success: false, message: 'Reviews can only be submitted for completed consultations' });
      return;
    }

    if (appointment.review) {
      res.status(409).json({ success: false, message: 'Review has already been submitted for this consultation' });
      return;
    }

    const review = await prisma.review.create({
      data: {
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        patientId: req.user.id,
        rating: numRating,
        comment: comment ? String(comment).trim() : null,
      },
    });

    // Recompute doctor's average rating and totalReviews
    const allReviews = await prisma.review.findMany({
      where: { doctorId: appointment.doctorId },
      select: { rating: true },
    });

    const totalReviews = allReviews.length;
    const avgRating = totalReviews > 0
      ? Number((allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
      : 5.0;

    await prisma.doctorProfile.update({
      where: { id: appointment.doctorId },
      data: {
        rating: avgRating,
        totalReviews,
      },
    });

    // Notify doctor
    createNotification(
      appointment.doctor.userId,
      'New Consultation Review',
      `A patient rated your consultation ${numRating}/5 stars.`,
      'CLINICAL'
    ).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully. Thank you for your feedback!',
      data: review,
    });
  } catch (error: any) {
    console.error('submitAppointmentReview error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit review' });
  }
};

