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
import { formatIndianPhone, sanitizeIndianPhone, isValidIndianPhone } from '../utils/phoneUtils';
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
          clinics: dr.doctor.clinics,
          cabinStatus: (dr.doctor as any).cabinStatus || 'IN_CABIN',
          expectedReturnTime: (dr.doctor as any).expectedReturnTime || null,
          cabinStatusUpdatedAt: (dr.doctor as any).cabinStatusUpdatedAt || null,
          todayTotalBookings: todayCount,
          todayWaitingPatients: waitingCount,
          joinedAt: dr.createdAt,
        };
      })
    );

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
              checkinCode: (receptionist.clinic as any).checkinCode || null,
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
          status: { in: ['WAITING', 'PENDING_APPROVAL'] },
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
          // Concurrency control: lock practitioner row for this booking without swallowing errors (BUG-05)
          await tx.$executeRaw`SELECT id FROM "DoctorProfile" WHERE id = ${doctor.id} FOR UPDATE;`;

          // Duplicate booking check within transaction (Finding H7)
          const existingInTx = await tx.appointment.findFirst({
            where: {
              patientId: patientProfile!.id,
              doctorId: doctor.id,
              appointmentDate,
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
              throw new Error(
                `DUPLICATE_ACTIVE_BOOKING: Patient already has an active booking (Queue #${existingInTx.queueNumber}) with this doctor on ${appointmentDate}.`
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

          // Highest queue number on this date across ALL appointments (including CANCELLED) to avoid unique constraint collision
          const maxQueueAppt = await tx.appointment.findFirst({
            where: {
              doctorId: doctor.id,
              appointmentDate,
            },
            orderBy: { queueNumber: 'desc' },
            select: { queueNumber: true },
          });
          const highestQueue = maxQueueAppt?.queueNumber || 0;
          const queueNumber = highestQueue + 1;

          const estimatedTime = slotStatus.estimatedTime;
          const checkingWindow = chosenSlot.name;

          return await tx.appointment.create({
            data: {
              patientId: patientProfile!.id,
              doctorId: doctor.id,
              clinicId: targetClinicId || null,
              appointmentDate,
              queueNumber,
              checkingWindow,
              estimatedTime,
              slotId: chosenSlot.id,
              status: 'WAITING',
              reasonForVisit: reasonForVisit || 'Walk-in Consultation',
              symptoms: symptoms || null,
              isForOther: isOther,
              patientName: patientName ? String(patientName).trim() : null,
              patientAge: patientAge ? String(patientAge).trim() : null,
              patientGender: gender || null,
            },
            include: {
              doctor: {
                include: { user: { select: { fullName: true } } },
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
      await prisma.appointment.updateMany({
        where: {
          doctorId: targetAppointment.doctorId,
          appointmentDate: targetAppointment.appointmentDate,
          status: 'IN_CONSULTATION',
          id: { not: appointmentId },
        },
        data: { status: 'WAITING' },
      });
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status },
      include: {
        doctor: { include: { user: { select: { fullName: true } } } },
        patient: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
      },
    });

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
      }
    }

    res.json({
      success: true,
      message: `Appointment status updated to ${status}`,
      data: updated,
    });
  } catch (error: any) {
    console.error('updateAppointmentStatus error:', error);
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

    if (!currentPassword || !newPassword) {
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
              include: { clinic: true },
            },
          },
        },
        clinic: true,
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
        clinic: true,
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

    const transition = canTransition(appointment.status, 'WAITING', req.user?.role || 'RECEPTIONIST');
    if (!transition.allowed) {
      res.status(400).json({
        success: false,
        message: transition.reason || `Appointment cannot be approved because current status is ${appointment.status}.`,
      });
      return;
    }

    // Atomic transaction: assign real sequential queue token (positive integer), mark WAITING and PAID
    let updated: any;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        updated = await prisma.$transaction(async (tx) => {
          // Concurrency control: lock practitioner row for this approval without swallowing errors
          await tx.$executeRaw`SELECT id FROM "DoctorProfile" WHERE id = ${appointment.doctorId} FOR UPDATE;`;

          // Find max positive queue number on this date
          const maxQueueAppt = await tx.appointment.findFirst({
            where: {
              doctorId: appointment.doctorId,
              appointmentDate: appointment.appointmentDate,
              queueNumber: { gt: 0 },
            },
            orderBy: { queueNumber: 'desc' },
            select: { queueNumber: true },
          });

          const nextToken = (maxQueueAppt?.queueNumber || 0) + 1;

          // Recalculate estimated time based on newly assigned token
          let slots = parseDoctorSlots(appointment.doctor);
          const cd =
            (appointment.doctor as any)?.clinics?.find((c: any) => c.clinicId === appointment.clinicId) ||
            (appointment.doctor as any)?.clinics?.[0];
          if (cd?.slots) {
            try {
              const p = typeof cd.slots === 'string' ? JSON.parse(cd.slots) : cd.slots;
              if (Array.isArray(p) && p.length > 0) slots = p;
            } catch {}
          }
          const slot = (appointment.slotId && slots.find((s) => s.id === appointment.slotId)) || slots[0];

          // Check if slot has already reached capacity
          if (slot && slot.maxPatients) {
            const confirmedInSlot = await tx.appointment.count({
              where: {
                doctorId: appointment.doctorId,
                appointmentDate: appointment.appointmentDate,
                status: { in: ['WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
                ...(slot.id ? { slotId: slot.id } : {}),
                ...(appointment.clinicId ? { clinicId: appointment.clinicId } : {}),
              },
            });
            if (confirmedInSlot >= slot.maxPatients) {
              throw new Error(`Cannot approve: checking shift (${slot.name}) has already reached its maximum capacity (${slot.maxPatients} patients).`);
            }
          }

          const pace = slot?.avgConsultationMinutes || 3.0;

          // Estimate start time = slot start + (nextToken - 1) * pace
          let estTime = appointment.estimatedTime;
          if (slot?.startTime) {
            const [sh, sm] = slot.startTime.split(':').map(Number);
            const totalMins = sh * 60 + sm + Math.round((nextToken - 1) * pace);
            const eh = Math.floor(totalMins / 60) % 24;
            const em = totalMins % 60;
            const period = eh >= 12 ? 'PM' : 'AM';
            const h12 = eh % 12 === 0 ? 12 : eh % 12;
            estTime = `${String(h12).padStart(2, '0')}:${String(em).padStart(2, '0')} ${period}`;
          }

          return await tx.appointment.update({
            where: { id: appointment.id },
            data: {
              queueNumber: nextToken,
              status: 'WAITING',
              paymentStatus: 'PAID',
              approvedBy: receptionist.id,
              approvedAt: new Date(),
              estimatedTime: estTime,
            },
            include: {
              doctor: { include: { user: { select: { fullName: true } } } },
              clinic: true,
              patient: { include: { user: { select: { fullName: true, phone: true } } } },
            },
          });
        });
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
      createNotification(
        appointment.patient.userId,
        'Appointment Approved & Token Assigned',
        `Your appointment with Dr. ${appointment.doctor?.user?.fullName || 'Practitioner'} has been approved. Queue Token #${updated.queueNumber}.`,
        'QUEUE'
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

/**
 * Decline/reject booking request
 */
export const rejectAppointment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'RECEPTIONIST') {
      res.status(403).json({ success: false, message: 'Access denied: Receptionist role required' });
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

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: 'REJECTED',
        paymentStatus: 'FAILED',
        clinicalNotes: reason ? `Declined by reception: ${reason}` : 'Declined by reception',
      },
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

    const existingUser = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });

    if (existingUser) {
      res.status(400).json({ success: false, message: 'An account with this email already exists' });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { id: String(clinicId) },
    });

    if (!clinic || !clinic.isVerified) {
      res.status(400).json({ success: false, message: 'Selected clinic is invalid or not verified' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const formattedPhone = phone ? formatIndianPhone(phone) : null;

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

