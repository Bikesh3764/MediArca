import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { AuthRequest, getJwtSecret } from '../middleware/authMiddleware';
import crypto from 'crypto';
import {
  parseDoctorSlots,
  evaluateSlotStatus,
  getLocalDateString,
  getIndianTimeMinutes,
  timeToMinutes,
  minutesTo12Hour,
  isValidAppointmentDate,
} from '../utils/scheduleUtils';
import { formatIndianPhone, sanitizeIndianPhone, isValidIndianPhone, findExistingAccountByPhone } from '../utils/phoneUtils';
import { canTransition } from '../utils/appointmentStateMachine';
import {
  verifyReceptionistDoctorAccess,
  isDoctorEligibleForClinicalPractice,
  isClinicActive,
} from '../utils/authGuards';
import { createNotification } from '../services/notificationService';

/**
 * Get profile and linked doctors for logged-in receptionist
 */
export const getMyReceptionist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'RECEPTIONIST') {
      res.status(403).json({ success: false, message: 'Access denied: receptionist role required' });
      return;
    }

    const userRec = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { mustChangePassword: true },
    });
    const mustChangePassword = Boolean(userRec?.mustChangePassword || req.user.mustChangePassword);

    const receptionist = await prisma.receptionistProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        clinic: true,
        doctors: {
          include: {
            doctor: {
              include: {
                user: {
                  select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true },
                },
                clinics: {
                  include: {
                    clinic: true,
                  },
                },
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

    if ((receptionist as any).status !== 'ACTIVE') {
      res.status(403).json({
        success: false,
        message:
          (receptionist as any).status === 'REJECTED'
            ? 'Your receptionist application has been declined by clinic administration.'
            : 'Your receptionist application is pending approval by clinic administration.',
      });
      return;
    }

    const todayStr = getLocalDateString();

    // Only include doctors currently actively affiliated with receptionist's parent clinic
    const activeDoctorIds = receptionist.clinicId
      ? (
          await prisma.clinicDoctor.findMany({
            where: {
              clinicId: receptionist.clinicId,
              status: { in: ['ACTIVE', 'ACCEPTED'] },
            },
            select: { doctorId: true },
          })
        ).map((cd) => cd.doctorId)
      : [];

    const activeAssignments = receptionist.doctors.filter((dr) =>
      dr.status === 'ACTIVE' &&
      activeDoctorIds.includes(dr.doctorId) &&
      isDoctorEligibleForClinicalPractice(dr.doctor).eligible
    );

    // Compute today's queue count for each linked doctor (scoped to this clinic)
    const doctorsWithQueue = await Promise.all(
      activeAssignments.map(async (dr) => {
        const todayCount = await prisma.appointment.count({
          where: {
            doctorId: dr.doctorId,
            appointmentDate: todayStr,
            ...(receptionist.clinicId ? { clinicId: receptionist.clinicId } : {}),
            status: { in: ['WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
          },
        });

        const waitingCount = await prisma.appointment.count({
          where: {
            doctorId: dr.doctorId,
            appointmentDate: todayStr,
            ...(receptionist.clinicId ? { clinicId: receptionist.clinicId } : {}),
            status: 'WAITING',
          },
        });

        let activeSlots = parseDoctorSlots(dr.doctor);
        let consultationFee = dr.doctor.consultationFee;
        if (receptionist.clinicId) {
          const cd = dr.doctor.clinics?.find((c: any) => c.clinicId === receptionist.clinicId);
          if (cd) {
            if (cd.consultationFee !== null && cd.consultationFee !== undefined) {
              consultationFee = cd.consultationFee;
            }
            if (cd.slots) {
              try {
                const parsed = typeof cd.slots === 'string' ? JSON.parse(cd.slots) : cd.slots;
                if (Array.isArray(parsed) && parsed.length > 0) {
                  activeSlots = parsed;
                }
              } catch {}
            }
          }
        }

        const sanitizedDoctorClinics = (dr.doctor.clinics || []).map((c: any) => {
          if (!c?.clinic) return c;
          const { checkinCode: _secret, ...safeClinic } = c.clinic;
          return { ...c, clinic: safeClinic };
        });

        return {
          affiliationId: dr.id,
          doctorId: dr.doctor.id,
          fullName: dr.doctor.user.fullName,
          email: dr.doctor.user.email,
          phone: dr.doctor.user.phone,
          avatarUrl: dr.doctor.user.avatarUrl,
          specialty: dr.doctor.specialty,
          clinicAddress: dr.doctor.clinicAddress,
          consultationFee,
          slots: activeSlots,
          clinics: sanitizedDoctorClinics,
          cabinStatus: (dr.doctor as any).cabinStatus || 'IN_CABIN',
          expectedReturnTime: (dr.doctor as any).expectedReturnTime || null,
          cabinStatusUpdatedAt: (dr.doctor as any).cabinStatusUpdatedAt || null,
          todayTotalBookings: todayCount,
          todayWaitingPatients: waitingCount,
          joinedAt: dr.createdAt,
        };
      })
    );

    const canAccessClinicCheckinCode = !mustChangePassword && isClinicActive(receptionist.clinic).active;

    res.json({
      success: true,
      data: {
        receptionist: {
          id: receptionist.id,
          fullName: req.user.fullName,
          email: req.user.email,
          phone: receptionist.phone,
          clinicId: receptionist.clinicId,
        },
        clinic: receptionist.clinic
          ? {
              id: receptionist.clinic.id,
              clinicName: receptionist.clinic.clinicName,
              address: receptionist.clinic.address,
              city: receptionist.clinic.city,
              phone: receptionist.clinic.phone,
              isVerified: receptionist.clinic.isVerified,
              verificationStatus: receptionist.clinic.verificationStatus,
              ...(canAccessClinicCheckinCode ? { checkinCode: (receptionist.clinic as any).checkinCode || null } : {}),
            }
          : null,
        doctors: doctorsWithQueue,
      },
    });
  } catch (error: any) {
    console.error('getMyReceptionist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve receptionist profile',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Link doctor to this receptionist (Disabled: Managed by Clinic Administrator)
 */
export const addDoctorToReceptionist = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(400).json({
    success: false,
    message: 'Direct doctor assignment by receptionists is disabled. Your assigned doctor roster is managed by your Clinic Administrator.',
  });
};

/**
 * Remove doctor link from receptionist (Disabled: Managed by Clinic Administrator)
 */
export const removeDoctorFromReceptionist = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(400).json({
    success: false,
    message: 'Doctor removal by receptionists is disabled. Your assigned doctor roster is managed by your Clinic Administrator.',
  });
};

/**
 * Get live queue for a specific linked doctor on a date
 */
export const getDoctorQueue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doctorId = String(req.params.doctorId);
    const appointmentDate = String(req.query.date || getLocalDateString());

    if (req.query.date && !isValidAppointmentDate(String(req.query.date))) {
      res.status(400).json({
        success: false,
        message: 'Invalid appointment date format. Expected valid calendar date in YYYY-MM-DD format.',
      });
      return;
    }

    if (!req.user || req.user.role !== 'RECEPTIONIST') {
      res.status(403).json({
        success: false,
        message: 'Access denied: Receptionist role required to access clinical queue.',
      });
      return;
    }

    const access = await verifyReceptionistDoctorAccess(req.user.id, doctorId, null);
    if (!access.authorized) {
      res.status(403).json({ success: false, message: access.reason });
      return;
    }

    const receptionist = access.receptionist;

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { user: { select: { fullName: true, email: true } } },
    });

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found' });
      return;
    }

    const istTodayStr = getLocalDateString();
    if (appointmentDate < istTodayStr) {
      await prisma.appointment.updateMany({
        where: {
          doctorId: doctorId,
          appointmentDate: appointmentDate,
          status: 'PENDING_APPROVAL',
          ...(receptionist?.clinicId ? { clinicId: receptionist.clinicId } : {}),
        },
        data: { status: 'EXPIRED' },
      });
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctorId,
        appointmentDate: appointmentDate,
        queueNumber: { gt: 0 },
        ...(receptionist?.clinicId ? { clinicId: receptionist.clinicId } : {}),
      },
      include: {
        patient: {
          include: {
            user: { select: { fullName: true, phone: true, email: true } },
          },
        },
      },
      orderBy: { queueNumber: 'asc' },
    });

    const getApptStartMins = (a: any): number => {
      if (a.checkingWindow) {
        const match = a.checkingWindow.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
        if (match) return timeToMinutes(match[1]);
      }
      return 0;
    };

    // Chronologically order appointments by slot window start time, then queueNumber (Finding 4)
    appointments.sort((a, b) => {
      const aSlotMins = getApptStartMins(a);
      const bSlotMins = getApptStartMins(b);
      if (aSlotMins !== bSlotMins) {
        return aSlotMins - bSlotMins;
      }
      return a.queueNumber - b.queueNumber;
    });

    let targetAffiliation: any = null;
    let slots = parseDoctorSlots(doctor);
    if (receptionist?.clinicId) {
      targetAffiliation = await prisma.clinicDoctor.findUnique({
        where: {
          clinicId_doctorId: {
            clinicId: receptionist.clinicId,
            doctorId,
          },
        },
      });
      if (targetAffiliation?.slots) {
        try {
          const parsed = typeof targetAffiliation.slots === 'string' ? JSON.parse(targetAffiliation.slots) : targetAffiliation.slots;
          if (Array.isArray(parsed) && parsed.length > 0) {
            slots = parsed;
          }
        } catch {}
      }
    }

    res.json({
      success: true,
      data: {
        doctor: {
          id: doctor.id,
          fullName: doctor.user.fullName,
          specialty: doctor.specialty,
          consultationFee: targetAffiliation?.consultationFee ?? doctor.consultationFee,
          slots,
          cabinStatus: (doctor as any).cabinStatus || 'IN_CABIN',
          expectedReturnTime: (doctor as any).expectedReturnTime || null,
          cabinStatusUpdatedAt: (doctor as any).cabinStatusUpdatedAt || null,
        },
        appointmentDate,
        totalPatients: appointments.length,
        waitingCount: appointments.filter((a) => a.status === 'WAITING').length,
        inConsultationCount: appointments.filter((a) => a.status === 'IN_CONSULTATION').length,
        completedCount: appointments.filter((a) => a.status === 'COMPLETED').length,
        cancelledCount: appointments.filter((a) => a.status === 'CANCELLED').length,
        appointments: appointments.map((a) => ({
          id: a.id,
          doctorId: a.doctorId,
          queueNumber: a.queueNumber,
          patientName: a.patientName || a.patient?.user?.fullName || 'Walk-in Patient',
          registeredUserName: a.patient?.user?.fullName,
          patientPhone: a.patient?.user?.phone || 'N/A',
          gender: a.patientGender || a.patient?.gender,
          bloodGroup: a.patient?.bloodGroup,
          checkingWindow: a.checkingWindow,
          estimatedTime: a.estimatedTime,
          slotId: a.slotId,
          status: a.status,
          isCheckedIn: Boolean(a.isCheckedIn),
          checkedInAt: a.checkedInAt || null,
          reasonForVisit: a.reasonForVisit,
          symptoms: a.symptoms,
          isForOther: Boolean(a.isForOther),
          patientAge: a.patientAge,
          appointmentDate: a.appointmentDate,
          createdAt: a.createdAt,
        })),
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

    const access = await verifyReceptionistDoctorAccess(req.user.id, doctorId, clinicId);
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

    let patientUser = await prisma.user.findFirst({
      where: {
        role: 'PATIENT',
        OR: [
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
          ...(rawDigits ? [{ phone: rawDigits }] : []),
          ...(unspacedE164 ? [{ phone: unspacedE164 }] : []),
          ...(spacedSeedFormat ? [{ phone: spacedSeedFormat }] : []),
          { phone: cleanPhone },
        ],
      },
      include: { patientProfile: true },
    });

    if (!patientUser) {
      const unguessablePassword = crypto.randomBytes(32).toString('hex');
      const dummySalt = await bcrypt.genSalt(12);
      const dummyHash = await bcrypt.hash(unguessablePassword, dummySalt);
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
    let targetClinicId = receptionist.clinicId || clinicId;
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

          const dayAppointments = await tx.appointment.findMany({
            where: {
              doctorId: doctor.id,
              appointmentDate,
              ...(receptionist.clinicId ? { clinicId: receptionist.clinicId } : {}),
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
            if (a.slotId) return a.slotId === chosenSlot.id;
            if (a.checkingWindow) return a.checkingWindow.includes(chosenSlot.startTime);
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

          const estimatedTime = slotStatus.estimatedTime;
          const checkingWindow = chosenSlot.name;

          return await tx.appointment.create({
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
              isCheckedIn: true,
              checkedInAt: new Date(),
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
        });

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
        'Walk-in Token Booked',
        `Queue Token #${newAppointment.queueNumber} assigned for ${newAppointment.doctor?.user?.fullName || 'Practitioner'} on ${appointmentDate}.`,
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

export const executeReceptionistInConsultationTransaction = async (
  prismaClient: any,
  doctorId: string,
  appointmentDate: string,
  appointmentId: string,
  updatePayload: any,
  clinicId?: string | null
) => {
  return await prismaClient.$transaction(async (tx: any) => {
    // Concurrency control: acquire exclusive row lock on DoctorProfile to serialize queue transitions (BUG-05, A-02)
    if (typeof (tx as any).$queryRaw === 'function') {
      await (tx as any).$queryRaw`SELECT id FROM "DoctorProfile" WHERE id = ${doctorId} FOR UPDATE;`;
    } else if (typeof (tx as any).$executeRaw === 'function') {
      await (tx as any).$executeRaw`SELECT id FROM "DoctorProfile" WHERE id = ${doctorId} FOR UPDATE;`;
    }

    // Guard: ensure practitioner is not actively consulting a patient at another facility (Issue 7)
    if (clinicId) {
      const activeInOtherClinic = await tx.appointment.findFirst({
        where: {
          doctorId,
          appointmentDate,
          status: 'IN_CONSULTATION',
          clinicId: { not: clinicId },
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

    // Reset any other active consultations for this doctor on this date to WAITING at this facility (Finding 2)
    await tx.appointment.updateMany({
      where: {
        doctorId,
        appointmentDate,
        status: 'IN_CONSULTATION',
        id: { not: appointmentId },
        ...(clinicId !== undefined ? { clinicId } : {}),
      },
      data: { status: 'WAITING' },
    });

    // Atomically set target appointment to IN_CONSULTATION
    return await tx.appointment.update({
      where: { id: appointmentId },
      data: updatePayload,
      include: {
        clinic: true,
        doctor: { include: { user: { select: { fullName: true } } } },
        patient: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
      },
    });
  });
};

/**
 * Update appointment status (WAITING -> IN_CONSULTATION -> COMPLETED / CANCELLED)
 */
export const updateAppointmentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const appointmentId = String(req.params.appointmentId);
    const { status } = req.body;

    const validStatuses = ['WAITING', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const targetAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: {
          select: { id: true, cabinStatus: true, expectedReturnTime: true },
        },
      },
    });

    if (!targetAppointment) {
      res.status(404).json({ success: false, message: 'Appointment not found' });
      return;
    }

    const transition = canTransition(targetAppointment.status, status, req.user?.role || 'RECEPTIONIST');
    if (!transition.allowed) {
      res.status(400).json({
        success: false,
        message: transition.reason || `Cannot transition appointment from ${targetAppointment.status} to ${status}.`,
      });
      return;
    }

    if (!req.user || req.user.role !== 'RECEPTIONIST') {
      res.status(403).json({
        success: false,
        message: 'Access denied: Receptionist role required to update clinical desk appointments.',
      });
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

    const access = await verifyReceptionistDoctorAccess(req.user.id, targetAppointment.doctorId, targetAppointment.clinicId);
    if (!access.authorized) {
      res.status(403).json({
        success: false,
        message: access.reason || 'Access denied: You are not authorized to update appointments for this doctor.',
      });
      return;
    }

    if (status === 'IN_CONSULTATION') {
      // Verify doctor is physically present in the cabin (cannot call if stepped out or not in cabin)
      if (targetAppointment.doctor?.cabinStatus && targetAppointment.doctor.cabinStatus !== 'IN_CABIN') {
        const statusLabel = targetAppointment.doctor.cabinStatus === 'STEPPED_OUT'
          ? `stepped out${targetAppointment.doctor.expectedReturnTime ? ` (expected return ~${targetAppointment.doctor.expectedReturnTime})` : ''}`
          : 'not in cabin';
        res.status(400).json({
          success: false,
          message: `Doctor has ${statusLabel}. Patient cannot be called into consultation while doctor is away from cabin.`,
        });
        return;
      }
    }

    if (status === 'IN_CONSULTATION' || status === 'COMPLETED') {
      const todayIso = getLocalDateString();
      if (targetAppointment.appointmentDate !== todayIso) {
        res.status(400).json({
          success: false,
          message: `Cannot update an appointment scheduled for ${targetAppointment.appointmentDate} to '${status}' today. Status updates are only allowed on the scheduled consultation date.`,
        });
        return;
      }

      if (!targetAppointment.isCheckedIn) {
        res.status(400).json({
          success: false,
          message: `Patient has not checked in at the clinic yet. Patient must arrive at the clinic before appointment can be updated to '${status}'.`,
        });
        return;
      }
    }

    const updatePayload: any = { status };
    let updated: any;

    if (status === 'IN_CONSULTATION') {
      updated = await executeReceptionistInConsultationTransaction(
        prisma,
        targetAppointment.doctorId,
        targetAppointment.appointmentDate,
        appointmentId,
        updatePayload,
        targetAppointment.clinicId
      );
    } else {
      updated = await prisma.appointment.update({
        where: { id: appointmentId },
        data: updatePayload,
        include: {
          doctor: { include: { user: { select: { fullName: true } } } },
          patient: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
        },
      });
    }

    if (updated?.patient) {
      const patientUserId = (updated.patient as any).userId || (updated.patient.user as any)?.id;
      const docName = updated.doctor?.user?.fullName || 'Practitioner';

      if (status === 'CANCELLED' && patientUserId) {
        createNotification(
          patientUserId,
          'Appointment Cancelled by Reception',
          `Your appointment with Dr. ${docName} (Token #${updated.queueNumber}) was cancelled by the clinic reception desk.`,
          'APPOINTMENT'
        ).catch(() => {});
      } else if (status === 'IN_CONSULTATION' && patientUserId) {
        createNotification(
          patientUserId,
          'Called to Consultation Cabin',
          `It is your turn! Queue #${updated.queueNumber} has been called into Dr. ${docName}'s cabin.`,
          'QUEUE'
        ).catch(() => {});
      } else if (status === 'COMPLETED' && patientUserId) {
        createNotification(
          patientUserId,
          'Consultation Completed',
          `Your consultation with Dr. ${docName} (Token #${updated.queueNumber}) has been completed.`,
          'APPOINTMENT'
        ).catch(() => {});
      }
    }

    res.json({
      success: true,
      message: `Appointment status updated to ${status}`,
      data: updated,
    });
  } catch (error: any) {
    console.error('updateAppointmentStatus error:', error);
    if (error?.message?.includes('Cannot call patient into consultation')) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update appointment status',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Mandatory first-login or on-demand password change for receptionists
 */
export const changeReceptionistPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'RECEPTIONIST') {
      res.status(403).json({ success: false, message: 'Access denied: receptionist role required' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ success: false, message: 'Current password and new password are required' });
      return;
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 8) {
      res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User account not found' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ success: false, message: 'Current temporary password does not match' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
      include: { receptionistProfile: true },
    });

    const { passwordHash: _, ...safeUser } = updatedUser;

    const token = jwt.sign(
      {
        id: updatedUser.id,
        userId: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        mustChangePassword: false,
      },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Password updated successfully. Desk access unlocked.',
      token,
      data: { ...safeUser, token, user: safeUser },
      user: safeUser,
    });
  } catch (error: any) {
    console.error('changeReceptionistPassword error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update password',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

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

    const now = new Date();
    const istTodayStr = getLocalDateString(now);
    const currentMinutes = getIndianTimeMinutes(now);

    // Auto-expire past pending requests in database
    await prisma.appointment.updateMany({
      where: {
        doctorId: { in: assignedDoctorIds },
        ...(receptionist.clinicId ? { clinicId: receptionist.clinicId } : {}),
        status: 'PENDING_APPROVAL',
        appointmentDate: { lt: istTodayStr },
      },
      data: { status: 'EXPIRED' },
    });

    const pendingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: { in: assignedDoctorIds },
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

    // Filter and auto-expire requests for today whose shift has already ended
    const unexpiredAppointments = eligibleAppointments.filter((appt) => {
      if (appt.appointmentDate === istTodayStr) {
        let slots = parseDoctorSlots(appt.doctor);
        const cd = (appt.doctor as any)?.clinics?.find((c: any) => c.clinicId === appt.clinicId);
        if (cd?.slots) {
          try {
            const parsed = typeof cd.slots === 'string' ? JSON.parse(cd.slots) : cd.slots;
            if (Array.isArray(parsed) && parsed.length > 0) slots = parsed;
          } catch {}
        }
        const slot = (appt.slotId && slots.find((s) => s.id === appt.slotId)) || slots[0];
        if (slot) {
          const slotStartMins = timeToMinutes(slot.startTime);
          let slotEndMins = timeToMinutes(slot.endTime);
          if (slotEndMins <= slotStartMins) slotEndMins += 24 * 60;
          if (currentMinutes >= slotEndMins) {
            prisma.appointment.update({
              where: { id: appt.id },
              data: { status: 'EXPIRED' },
            }).catch(() => {});
            return false;
          }
        }
      }
      return true;
    });

    const enriched = unexpiredAppointments.map((appt) => {
      const cd =
        (appt.doctor as any)?.clinics?.find((c: any) => c.clinicId === appt.clinicId) ||
        (appt.doctor as any)?.clinics?.[0];
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

    const access = await verifyReceptionistDoctorAccess(req.user.id, appointment.doctorId, appointment.clinicId);
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

    if (appointment.status === 'EXPIRED' || appointment.appointmentDate < istTodayStr) {
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

    if (appointment.appointmentDate === istTodayStr) {
      let slots = parseDoctorSlots(appointment.doctor);
      const targetClinic = appointment.doctor.clinics?.find((c: any) => c.clinicId === appointment.clinicId);
      if (targetClinic?.slots) {
        try {
          const parsed = typeof targetClinic.slots === 'string' ? JSON.parse(targetClinic.slots) : targetClinic.slots;
          if (Array.isArray(parsed) && parsed.length > 0) slots = parsed;
        } catch {}
      }
      const slot = (appointment.slotId && slots.find((s) => s.id === appointment.slotId)) || slots[0];
      if (slot) {
        const slotStartMins = timeToMinutes(slot.startTime);
        let slotEndMins = timeToMinutes(slot.endTime);
        if (slotEndMins <= slotStartMins) slotEndMins += 24 * 60;
        if (currentMinutes >= slotEndMins) {
          await prisma.appointment.update({
            where: { id: appointment.id },
            data: { status: 'EXPIRED' },
          });
          res.status(400).json({
            success: false,
            message: `Cannot approve appointment request: the consultation shift (${slot.name || slot.startTime}) has already concluded for today.`,
          });
          return;
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

    // Atomic transaction: assign real sequential queue token (positive integer), mark WAITING and PAID, set isCheckedIn: true
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
      const rawDocName = appointment.doctor?.user?.fullName || 'Practitioner';
      const cleanDocName = rawDocName.startsWith('Dr.') ? rawDocName : `Dr. ${rawDocName}`;
      createNotification(
        appointment.patient.userId,
        'Appointment Booking Confirmed',
        `Your visit request with ${cleanDocName} for ${appointment.appointmentDate} has been confirmed. You are Queue #${updated.queueNumber}.`,
        'APPOINTMENT'
      ).catch(() => {});
    }

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
    res.status(500).json({
      success: false,
      message: 'Failed to approve appointment',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
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
    if (!targetClinicId) {
      const activeClinic = currentAppt.doctor.clinics?.find((c: any) => !c.status || c.status === 'ACTIVE' || c.status === 'ACCEPTED');
      targetClinicId = activeClinic?.clinicId || null;
    }

    if (!targetClinicId) {
      throw new Error('A valid clinic affiliation is required to approve appointments and issue queue tokens.');
    }

    // Find max positive queue number on this date for this clinic and shift (FIX-014)
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

    // Recalculate estimated time based on newly assigned token
    let slots = parseDoctorSlots(currentAppt.doctor);
    const cd =
      (currentAppt.doctor as any)?.clinics?.find((c: any) => c.clinicId === currentAppt.clinicId) ||
      (currentAppt.doctor as any)?.clinics?.[0];
    if (cd?.slots) {
      try {
        const p = typeof cd.slots === 'string' ? JSON.parse(cd.slots) : cd.slots;
        if (Array.isArray(p) && p.length > 0) slots = p;
      } catch {}
    }
    const slot = (currentAppt.slotId && slots.find((s: any) => s.id === currentAppt.slotId)) || slots[0];

    // Check if slot has already reached capacity and count patients ahead for shift ETA (Issue 6)
    const confirmedInSlot = slot ? await tx.appointment.count({
      where: {
        doctorId: currentAppt.doctorId,
        appointmentDate: currentAppt.appointmentDate,
        status: { in: ['WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
        ...(slot.id ? { slotId: slot.id } : {}),
        ...(currentAppt.clinicId ? { clinicId: currentAppt.clinicId } : {}),
      },
    }) : 0;

    if (slot && slot.maxPatients && confirmedInSlot >= slot.maxPatients) {
      throw new Error(`Cannot approve: checking shift (${slot.name}) has already reached its maximum capacity (${slot.maxPatients} patients).`);
    }

    const pace = slot?.avgConsultationMinutes || 3.0;

    // Estimate start time based on ordinal position inside their specific slot (Issue 6)
    let estTime = currentAppt.estimatedTime;
    if (slot?.startTime) {
      const [sh, sm] = slot.startTime.split(':').map(Number);
      const totalMins = sh * 60 + sm + Math.round(confirmedInSlot * pace);
      const eh = Math.floor(totalMins / 60) % 24;
      const em = totalMins % 60;
      const period = eh >= 12 ? 'PM' : 'AM';
      const h12 = eh % 12 === 0 ? 12 : eh % 12;
      estTime = `${String(h12).padStart(2, '0')}:${String(em).padStart(2, '0')} ${period}`;
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
        isCheckedIn: true,
        checkedInAt: new Date(),
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
      const docName = appointment.doctor?.user?.fullName || 'Practitioner';
      const declineMsg = reason ? `Reason: ${reason}` : 'Please contact the clinic reception for more details.';
      createNotification(
        appointment.patient.userId,
        'Appointment Request Declined',
        `Your appointment booking request with Dr. ${docName} was declined by clinic reception. ${declineMsg}`,
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

/**
 * Receptionist self-registration / application to join a verified clinic
 */
export const applyReceptionist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, email, password, phone, clinicId } = req.body;

    if (!fullName || !email || !password || !clinicId) {
      res.status(400).json({ success: false, message: 'Please provide full name, email, password, and target clinic' });
      return;
    }

    if (typeof password !== 'string' || password.trim().length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
      return;
    }

    let formattedPhone: string | null = null;
    if (phone && String(phone).trim() !== '') {
      if (!isValidIndianPhone(String(phone))) {
        res.status(400).json({
          success: false,
          message: 'Invalid phone number. Please enter a valid 10-digit Indian mobile number (+91).',
        });
        return;
      }
      formattedPhone = formatIndianPhone(String(phone));
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });

    if (existingUser) {
      res.status(409).json({ success: false, message: 'An account with this email already exists' });
      return;
    }

    if (formattedPhone) {
      const existingByPhone = await findExistingAccountByPhone(prisma, formattedPhone);
      if (existingByPhone) {
        res.status(409).json({
          success: false,
          message: 'An account with this mobile number already exists.',
        });
        return;
      }
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { id: String(clinicId) },
    });

    const clinicCheck = isClinicActive(clinic);
    if (!clinicCheck.active || !clinic) {
      res.status(400).json({ success: false, message: clinicCheck.reason || 'Selected clinic is invalid or not verified' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        fullName: String(fullName).trim(),
        email: String(email).toLowerCase().trim(),
        passwordHash: hashedPassword,
        role: 'RECEPTIONIST',
        phone: formattedPhone,
        mustChangePassword: false,
      },
    });

    const receptionist = await prisma.receptionistProfile.create({
      data: {
        userId: user.id,
        phone: formattedPhone,
        clinicId: clinic.id,
        status: 'PENDING', // Awaiting clinic administrator approval
      },
    });

    res.json({
      success: true,
      message: `Your application to join ${clinic.clinicName} has been submitted. The clinic administrator will review and activate your desk access.`,
      data: {
        userId: user.id,
        receptionistId: receptionist.id,
        status: 'PENDING',
      },
    });
  } catch (error: any) {
    console.error('applyReceptionist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit receptionist application',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

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
    if (!req.user || !['RECEPTIONIST', 'CLINIC'].includes(req.user.role)) {
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
    if (req.user.role === 'RECEPTIONIST') {
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
                const cd =
                  appointment.doctor?.clinics?.find((c: any) => c.clinicId === appointment.clinicId) ||
                  appointment.doctor?.clinics?.[0];
                if (cd?.slots) {
                  try {
                    const parsed = typeof cd.slots === 'string' ? JSON.parse(cd.slots) : cd.slots;
                    if (Array.isArray(parsed) && parsed.length > 0) activeSlots = parsed;
                  } catch {}
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
          const cd =
            appointment.doctor?.clinics?.find((c: any) => c.clinicId === appointment.clinicId) ||
            appointment.doctor?.clinics?.[0];
          if (cd?.slots) {
            try {
              const p = typeof cd.slots === 'string' ? JSON.parse(cd.slots) : cd.slots;
              if (Array.isArray(p) && p.length > 0) slots = p;
            } catch {}
          }
          const chosenSlotId = newSlotId || appointment.slotId;
          const slot = (chosenSlotId && slots.find((s) => s.id === chosenSlotId)) || slots[0];

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
              },
            });

            bookedInSlot = dayAppointments.filter((a) => {
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
          const checkingWindow = slot ? `${slot.startTime} – ${slot.endTime}` : (appointment.checkingWindow || 'General Hours');

          const updatedRecord = await tx.appointment.update({
            where: { id: appointment.id },
            data: {
              appointmentDate: newDate,
              queueNumber: nextQueueNumber,
              slotId: slot?.id || chosenSlotId || null,
              checkingWindow,
              estimatedTime,
              status: isPending ? 'PENDING_APPROVAL' : 'WAITING',
              isCheckedIn: false, // Reset arrival for new date
              checkedInAt: null,
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
      ? `Queue #${updatedAppt.queueNumber}`
      : `Provisional Token #${Math.abs(updatedAppt.queueNumber)} (Pending Approval)`;

    // Dispatch notification to patient
    if (appointment.patient?.userId) {
      createNotification(
        appointment.patient.userId,
        'Appointment Rescheduled',
        `Your visit with ${docName} has been shifted to ${newDate} by the reception desk. Your token is ${tokenDisplay}.`,
        'APPOINTMENT'
      ).catch(() => {});
    }

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


