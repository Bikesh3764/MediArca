import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/authMiddleware';
import { timeToMinutes, minutesTo12Hour, parseDoctorSlots, getLocalDateString, getIndianTimeMinutes, parseAffiliationSlots } from '../../utils/scheduleUtils';
import { canTransition } from '../../utils/appointmentStateMachine';
import { verifyReceptionistDoctorAccess, isDoctorEligibleForClinicalPractice, isClinicActive } from '../../utils/authGuards';
import { createNotification } from '../../services/notificationService';
import { getCachedActiveBatch, invalidateDoctorQueueCache } from '../../utils/queueStateCache';
import { resolveReceptionistContact } from './helpers';

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
    const sanitizedDoctor = { ...appointment.doctor };
    delete (sanitizedDoctor as any).receptionists;
    const sanitizedClinic = appointment.clinic ? { ...appointment.clinic } : null;
    if (sanitizedClinic) {
      delete (sanitizedClinic as any).receptionists;
    }

    const sanitizedPatient = appointment.patient ? {
      ...appointment.patient,
      ...(isClinicOrRec && !isDoctor && !isPatient && !isAdmin ? {
        allergies: undefined,
        existingConditions: undefined,
        currentMedications: undefined,
        pastSurgeries: undefined,
      } : {}),
    } : null;

    res.json({
      success: true,
      data: {
        ...appointment,
        patient: sanitizedPatient,
        doctor: sanitizedDoctor,
        clinic: sanitizedClinic,
        receptionistPhone: recContact.phone || null,
        receptionistName: recContact.name || null,
        estimatedQueueNumber,
        ...(isClinicOrRec && !isDoctor && !isPatient && !isAdmin ? {
          clinicalNotes: null,
          vitals: null,
        } : {}),
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

    const statusQuery = String(req.query.status || '').toLowerCase();
    const isOnlyActive = statusQuery === 'active' || req.query.activeOnly === 'true';
    const isOnlyPast = statusQuery === 'past';

    // Query Bounding: Scope to active visits OR recent visits within last 60 days, capped at take: 50
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgoDateStr = getLocalDateString(sixtyDaysAgo);

    let whereClause: any;
    let takeLimit = 50;
    let skipCount: number | undefined = undefined;

    if (isOnlyActive) {
      whereClause = {
        patientId: patient.id,
        status: { in: ['WAITING', 'IN_CONSULTATION', 'PENDING_APPROVAL'] },
      };
      takeLimit = 50;
    } else if (isOnlyPast) {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.min(Math.max(1, parseInt(String(req.query.limit || '10'), 10)), 50);
      takeLimit = limit;
      skipCount = (page - 1) * limit;

      whereClause = {
        patientId: patient.id,
        status: { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'EXPIRED'] },
      };
    } else {
      whereClause = {
        patientId: patient.id,
        OR: [
          { status: { in: ['WAITING', 'IN_CONSULTATION', 'PENDING_APPROVAL'] } },
          { appointmentDate: { gte: sixtyDaysAgoDateStr } },
          { createdAt: { gte: sixtyDaysAgo } },
        ],
      };
      takeLimit = 50;
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      take: takeLimit,
      ...(skipCount !== undefined ? { skip: skipCount } : {}),
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
        ? await getCachedActiveBatch(doctorIds, dates, () =>
            prisma.appointment.findMany({
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
          )
        : [];

    // Calculate real-time queue position for active appointments in-memory
    const enrichedAppointments = appointments.map((appt) => {
      const targetClinicAffiliation = appt.clinicId
        ? (appt.doctor as any)?.clinics?.find((c: any) => c.clinicId === appt.clinicId)
        : null;
      const clinicFee = targetClinicAffiliation?.consultationFee ?? appt.doctor.consultationFee;

      const recContact = resolveReceptionistContact(appt.clinic, appt.doctorId, appt.doctor);
      const sanitizedDoctor: any = { ...appt.doctor };
      delete sanitizedDoctor.receptionists;
      if (Array.isArray(sanitizedDoctor.clinics)) {
        sanitizedDoctor.clinics = sanitizedDoctor.clinics.map((cd: any) => {
          if (!cd?.clinic) return cd;
          const { checkinCode: _secret, ...safeClinic } = cd.clinic;
          return { ...cd, clinic: safeClinic };
        });
      }
      const sanitizedClinic: any = appt.clinic ? { ...appt.clinic } : null;
      if (sanitizedClinic) {
        delete sanitizedClinic.receptionists;
        delete sanitizedClinic.checkinCode;
      }

      const apptWithRec = {
        ...appt,
        doctor: sanitizedDoctor,
        clinic: sanitizedClinic,
        receptionistPhone: recContact.phone || null,
        receptionistName: recContact.name || null,
      };

      if (appt.status === 'WAITING' || appt.status === 'IN_CONSULTATION') {
        let slots = parseDoctorSlots(appt.doctor);
        if (targetClinicAffiliation?.slots) {
          slots = parseAffiliationSlots(targetClinicAffiliation.slots) ?? slots;
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
        const patientsAhead =
          appt.status === 'IN_CONSULTATION'
            ? 0
            : activeBatchAppointments.filter((a) =>
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

        const estWaitMinutes = appt.status === 'IN_CONSULTATION' ? 0 : Math.round(patientsAhead * pace);
        const isYourTurn =
          appt.status === 'IN_CONSULTATION' ||
          (isToday && isShiftActive && currentServingQueueNumber > 0 && currentServingQueueNumber === appt.queueNumber);

        let liveEstimatedTime = appt.estimatedTime;
        if (appt.status === 'IN_CONSULTATION') {
          liveEstimatedTime = 'In Cabin Now';
        } else if (isToday) {
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
            currentServingQueueNumber: currentServingQueueNumber,
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
          slots = parseAffiliationSlots(targetClinicAffiliation.slots) ?? slots;
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
        const maxConfirmedQueue = confirmedForShift.length;
        const estimatedQueueNumber = Math.max(1, maxConfirmedQueue + 1);

        if (slot) {
          const slotStartMins = timeToMinutes(slot.startTime);
          let slotEndMins = timeToMinutes(slot.endTime);
          if (slotEndMins <= slotStartMins) slotEndMins += 24 * 60;

          if (appt.appointmentDate < istTodayStr || (appt.appointmentDate === istTodayStr && currentMinutes >= slotEndMins)) {
            effectiveStatus = 'EXPIRED';
            isShiftPassed = true;
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

    res.json({
      success: true,
      count: enrichedAppointments.length,
      data: enrichedAppointments,
      hasMore: isOnlyPast ? enrichedAppointments.length === takeLimit : undefined,
    });
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

    // Atomic status transition: update only if status still matches the pre-validated state (Finding 2)
    const updateResult = await prisma.appointment.updateMany({
      where: {
        id,
        status: appointment.status,
      },
      data: { status: 'CANCELLED' },
    });

    if (updateResult.count === 0) {
      res.status(409).json({
        success: false,
        message: 'Appointment cannot be cancelled as its status was changed concurrently.',
      });
      return;
    }

    invalidateDoctorQueueCache(appointment.doctorId, appointment.appointmentDate);

    const updated = await prisma.appointment.findUnique({ where: { id } });

    if (req.user?.role === 'PATIENT' && appointment.doctor?.userId) {
      createNotification(
        appointment.doctor.userId,
        'Appointment Cancelled by Patient',
        `The appointment for ${appointment.appointmentDate} (Token #${appointment.queueNumber}) was cancelled by the patient.`,
        'APPOINTMENT'
      ).catch(() => {});
      if (appointment.clinicId) {
        prisma.receptionistProfile
          .findMany({
            where: {
              clinicId: appointment.clinicId,
              status: 'ACTIVE',
            },
            include: { doctors: true },
          })
          .then((recs) => {
            for (const rec of recs) {
              const isAssigned =
                rec.doctors.length === 0 ||
                rec.doctors.some((d) => d.doctorId === appointment.doctorId && d.status === 'ACTIVE');
              if (isAssigned && rec.userId) {
                createNotification(
                  rec.userId,
                  'Appointment Cancelled by Patient',
                  `Patient cancelled Token #${appointment.queueNumber} scheduled for ${appointment.appointmentDate}.`,
                  'APPOINTMENT'
                ).catch(() => {});
              }
            }
          })
          .catch(() => {});
      }
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
