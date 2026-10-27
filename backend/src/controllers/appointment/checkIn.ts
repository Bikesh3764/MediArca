import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/authMiddleware';
import { getLocalDateString, getIndianTimeMinutes, parseDoctorSlots, parseAffiliationSlots, timeToMinutes } from '../../utils/scheduleUtils';
import crypto from 'crypto';
import { verifyReceptionistDoctorAccess, isDoctorEligibleForClinicalPractice, isClinicActive } from '../../utils/authGuards';
import { createNotification, withDr } from '../../services/notificationService';
import { invalidateDoctorQueueCache } from '../../utils/queueStateCache';

/** How early before a shift starts a patient may scan the clinic QR. */
export const CHECKIN_OPENS_BEFORE_MINUTES = 180;

/** Minutes after midnight (IST) when QR check-in opens and closes for this visit, or null if the shift is unknown. */
export const getCheckInWindow = async (appointment: any): Promise<{ opensAt: number; closesAt: number } | null> => {
  try {
    let slots = parseDoctorSlots(appointment.doctor || {});
    if (appointment.clinicId && typeof (prisma.clinicDoctor as any)?.findUnique === 'function') {
      const aff = await prisma.clinicDoctor.findUnique({
        where: { clinicId_doctorId: { clinicId: appointment.clinicId, doctorId: appointment.doctorId } },
        select: { slots: true },
      });
      slots = parseAffiliationSlots(aff?.slots) ?? slots;
    }
    const slot = appointment.slotId ? slots.find((s: any) => s.id === appointment.slotId) : null;
    if (!slot) return null;
    const start = timeToMinutes(slot.startTime);
    let end = timeToMinutes(slot.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    // Overnight shifts: allow until midnight; the date check above already pins the day
    if (end <= start) end = 24 * 60 - 1;
    return { opensAt: Math.max(0, start - CHECKIN_OPENS_BEFORE_MINUTES), closesAt: end };
  } catch {
    return null;
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

    if (req.user.role && req.user.role !== 'PATIENT') {
      res.status(403).json({
        success: false,
        message: 'Only patient accounts can perform QR arrival check-in.',
      });
      return;
    }

    const { clinicId, appointmentId, code, checkinCode } = req.body;

    if (!clinicId) {
      res.status(400).json({
        success: false,
        message: 'Clinic ID is required to verify clinic arrival from QR scan.',
      });
      return;
    }

    let clinic = await prisma.clinicProfile.findUnique({
      where: { id: String(clinicId) },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic facility not found' });
      return;
    }

    // Verify clinic is active and verified before allowing check-in (Issue 10)
    const clinicCheck = isClinicActive(clinic);
    if (!clinicCheck.active) {
      res.status(403).json({
        success: false,
        message: clinicCheck.reason || 'This clinic facility is currently inactive or not verified for arrival check-ins.',
      });
      return;
    }

    if (!clinic.checkinCode && typeof (prisma.clinicProfile as any).update === 'function') {
      clinic = await prisma.clinicProfile.update({
        where: { id: clinic.id },
        data: { checkinCode: crypto.randomUUID() },
      });
    }

    const submittedCode = String(code ?? checkinCode ?? '').trim();
    if (!submittedCode || (clinic.checkinCode && submittedCode !== String(clinic.checkinCode).trim())) {
      res.status(403).json({
        success: false,
        message: 'Invalid or missing clinic QR verification code. Please scan the official QR standee at the clinic reception desk.',
      });
      return;
    }

    const todayStr = getLocalDateString(new Date());
    let appointment: any = null;

    if (appointmentId) {
      appointment = await prisma.appointment.findUnique({
        where: { id: String(appointmentId) },
        include: {
          patient: { include: { user: { select: { fullName: true } } } },
          doctor: { include: { user: { select: { fullName: true } } } },
          clinic: true,
        },
      });

      if (!appointment || appointment.patient.userId !== req.user.id) {
        res.status(404).json({ success: false, message: 'Appointment not found or not owned by your account' });
        return;
      }
      if (appointment.clinicId !== clinic.id) {
        res.status(400).json({
          success: false,
          message: `This appointment is booked at a different venue (${appointment.clinic?.clinicName || 'another clinic'}).`,
        });
        return;
      }
    } else {
      // Find today's appointment for this patient at this clinic, prioritizing unchecked-in WAITING appointments
      const patient = await prisma.patientProfile.findUnique({
        where: { userId: req.user.id },
      });

      if (!patient) {
        res.status(404).json({ success: false, message: 'Patient profile not found' });
        return;
      }

      if (typeof (prisma.appointment as any).findMany === 'function') {
        const candidates = await prisma.appointment.findMany({
          where: {
            patientId: patient.id,
            appointmentDate: todayStr,
            clinicId: clinic.id,
          },
          include: {
            patient: { include: { user: { select: { fullName: true } } } },
            doctor: { include: { user: { select: { fullName: true } } } },
            clinic: true,
          },
          orderBy: { queueNumber: 'asc' },
        });
        appointment =
          candidates.find((a: any) => a.status === 'WAITING' && !a.isCheckedIn) ||
          candidates.find((a: any) => (a.status === 'WAITING' || a.status === 'IN_CONSULTATION') && a.isCheckedIn) ||
          candidates.find((a: any) => a.status === 'PENDING_APPROVAL') ||
          candidates.find((a: any) => a.status === 'EXPIRED') ||
          candidates[0] ||
          null;
      } else {
        appointment = await prisma.appointment.findFirst({
          where: {
            patientId: patient.id,
            appointmentDate: todayStr,
            status: { in: ['WAITING', 'IN_CONSULTATION'] },
            clinicId: clinic.id,
          },
          include: {
            patient: { include: { user: { select: { fullName: true } } } },
            doctor: { include: { user: { select: { fullName: true } } } },
            clinic: true,
          },
          orderBy: { queueNumber: 'asc' },
        });
      }
    }

    if (!appointment) {
      res.status(404).json({
        success: false,
        message: `No active consultation appointment found for today (${todayStr}) at ${clinic.clinicName}.`,
      });
      return;
    }

    if (appointment.doctor && (appointment.doctor.isVerified !== undefined || appointment.doctor.verificationStatus !== undefined)) {
      const docCheck = isDoctorEligibleForClinicalPractice(appointment.doctor);
      if (!docCheck.eligible) {
        res.status(403).json({
          success: false,
          message: docCheck.reason || 'This practitioner is currently unavailable for clinical check-ins.',
        });
        return;
      }
    }

    if (appointment.appointmentDate !== todayStr) {
      res.status(400).json({
        success: false,
        message: `Check-in is only available on the date of your consultation (${appointment.appointmentDate}). Today is ${todayStr}.`,
      });
      return;
    }

    // The standee QR never changes, so a photo of it must not work from home all day:
    // scanning only counts from a few hours before the shift starts until it ends.
    const checkInWindow = await getCheckInWindow(appointment);
    if (checkInWindow) {
      const nowMins = getIndianTimeMinutes(new Date());
      if (nowMins < checkInWindow.opensAt) {
        res.status(400).json({
          success: false,
          message: `Check-in opens ${CHECKIN_OPENS_BEFORE_MINUTES / 60} hours before your shift. Scan again closer to your visit.`,
        });
        return;
      }
      if (nowMins > checkInWindow.closesAt) {
        res.status(400).json({
          success: false,
          message: 'This shift has ended, so check-in is closed. Please contact the front desk.',
        });
        return;
      }
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
      const safeAppointment = { ...appointment };
      if (safeAppointment.clinic) {
        const { checkinCode: _secret, ...safeClinic } = safeAppointment.clinic;
        safeAppointment.clinic = safeClinic;
      }
      res.json({
        success: true,
        alreadyCheckedIn: true,
        message: `You are already checked in at ${clinic.clinicName} (Queue #${appointment.queueNumber}).`,
        data: safeAppointment,
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

    invalidateDoctorQueueCache(updated.doctorId, updated.appointmentDate);

    // The doctor's queue updates live; only the front desk gets a notification.
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
                'Patient arrived',
                `${patientDisplayName} (Token #${updated.queueNumber}) checked in for ${withDr(updated.doctor?.user?.fullName)}.`,
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

    const id = String(req.params.id || req.params.appointmentId || '');
    if (!id) {
      res.status(400).json({ success: false, message: 'Appointment ID is required' });
      return;
    }

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
      const docCheck = isDoctorEligibleForClinicalPractice(appointment.doctor);
      if (!docCheck.eligible) {
        res.status(403).json({ success: false, message: docCheck.reason });
        return;
      }
    } else if (req.user.role === 'RECEPTIONIST') {
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

    if (appointment.status !== 'WAITING' && appointment.status !== 'IN_CONSULTATION') {
      res.status(400).json({
        success: false,
        message:
          appointment.status === 'PENDING_APPROVAL'
            ? 'Cannot mark arrival for an unapproved booking request. Please approve the booking request and confirm fee receipt first.'
            : `Cannot update check-in status for an appointment with status '${appointment.status}'.`,
      });
      return;
    }

    const todayIso = getLocalDateString();
    const newCheckedInState =
      req.body.isCheckedIn !== undefined ? Boolean(req.body.isCheckedIn) : !appointment.isCheckedIn;

    if (appointment.status === 'IN_CONSULTATION' && !newCheckedInState) {
      res.status(400).json({
        success: false,
        message: 'Cannot remove check-in while consultation is actively in progress.',
      });
      return;
    }

    if (req.user.role === 'PATIENT' && appointment.status !== 'WAITING') {
      res.status(400).json({
        success: false,
        message: 'Cannot modify check-in state while consultation is in progress.',
      });
      return;
    }

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

    invalidateDoctorQueueCache(appointment.doctorId, appointment.appointmentDate);

    // Desk check-ins show up live in the doctor's queue, so no notification is sent.

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
