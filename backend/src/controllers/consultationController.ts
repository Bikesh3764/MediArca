import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';
import { getLocalDateString } from '../utils/scheduleUtils';
import { canTransition } from '../utils/appointmentStateMachine';
import { isDoctorEligibleForClinicalPractice } from '../utils/authGuards';
import { createNotification } from '../services/notificationService';

export const getDoctorQueue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Access denied: Doctor only' });
      return;
    }

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    if (doctor.verificationStatus === 'SUSPENDED') {
      res.status(403).json({ success: false, message: 'Practitioner account is currently suspended from clinical practice.' });
      return;
    }
    if (doctor.verificationStatus === 'REJECTED') {
      res.status(403).json({ success: false, message: 'Practitioner registration has been declined by administration.' });
      return;
    }

    const dateStr = (req.query.date as string) || getLocalDateString();
    const scope = (req.query.scope as string) || 'date';

    const whereClause: any = {
      doctorId: doctor.id,
      queueNumber: { gt: 0 },
    };

    if (scope === 'all-upcoming') {
      whereClause.status = { in: ['WAITING', 'IN_CONSULTATION'] };
    } else {
      whereClause.appointmentDate = dateStr;
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: {
          include: {
            user: { select: { fullName: true, email: true, phone: true, avatarUrl: true } },
          },
        },
      },
      orderBy: scope === 'all-upcoming'
        ? [{ appointmentDate: 'asc' }, { queueNumber: 'asc' }]
        : { queueNumber: 'asc' },
    });

    const activeInConsultation = appointments.find((a) => a.status === 'IN_CONSULTATION') || null;
    const waitingQueue = appointments.filter((a) => a.status === 'WAITING');
    const completedQueue = appointments.filter((a) => a.status === 'COMPLETED');

    // Calculate upcoming bookings summary across dates for this doctor
    const todayIso = getLocalDateString();
    const upcomingWaiting = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        appointmentDate: { gte: todayIso },
        status: { in: ['WAITING', 'IN_CONSULTATION'] },
      },
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
        date: dateStr,
        scope,
        totalQueue: appointments.length,
        activeInConsultation,
        waitingQueue,
        completedQueue,
        allAppointments: appointments,
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

    // Reset any currently IN_CONSULTATION appointments on this date back to WAITING at the same practice/clinic
    await prisma.appointment.updateMany({
      where: {
        doctorId: doctor.id,
        appointmentDate: targetAppointment.appointmentDate,
        clinicId: targetAppointment.clinicId ?? null,
        status: 'IN_CONSULTATION',
      },
      data: { status: 'WAITING' },
    });

    // Update target to IN_CONSULTATION
    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'IN_CONSULTATION' },
      include: {
        patient: {
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true } },
          },
        },
      },
    });

    if (updated?.patient?.user) {
      const doctorName = (doctor as any)?.user?.fullName || req.user.fullName || 'Practitioner';
      createNotification(
        updated.patient.user.id || (updated.patient as any).userId,
        'Called to Consultation Cabin',
        `It is your turn! Dr. ${doctorName} has called Queue #${updated.queueNumber} into the cabin.`,
        'QUEUE'
      ).catch(() => {});
    }

    res.json({
      success: true,
      message: `Queue #${updated.queueNumber} (${updated.patient.user.fullName}) is now in consultation`,
      data: updated,
    });
  } catch (error: any) {
    console.error('callPatient error:', error);
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

    const { appointmentId, vitals, clinicalNotes } = req.body;

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

    // Verify appointment belongs to this doctor
    const targetAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!targetAppointment || targetAppointment.doctorId !== doctor.id) {
      res.status(403).json({ success: false, message: 'Appointment does not belong to this doctor' });
      return;
    }

    if (['CANCELLED', 'REJECTED', 'PENDING_APPROVAL', 'COMPLETED'].includes(targetAppointment.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot update clinical notes for an appointment with status '${targetAppointment.status}'. Clinical notes and vitals cannot be modified after consultation finalization.`,
      });
      return;
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        ...(vitals && { vitals: typeof vitals === 'object' ? JSON.stringify(vitals) : vitals }),
        ...(clinicalNotes !== undefined && { clinicalNotes }),
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

export const completeConsultation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Doctor only' });
      return;
    }

    const {
      appointmentId,
      diagnosis,
      medicines,
      advice,
      followUpDate,
      clinicalNotes,
      vitals,
    } = req.body;

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

    // Verify appointment belongs to this doctor
    const targetAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!targetAppointment || targetAppointment.doctorId !== doctor.id) {
      res.status(403).json({ success: false, message: 'Appointment does not belong to this doctor' });
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
    if (Array.isArray(medicines) && medicines.length > 0) {
      const medLines = medicines.map((m: any, idx: number) => {
        if (typeof m === 'string') return `${idx + 1}. ${m}`;
        const name = m.name || m.medicineName || '';
        const dosage = m.dosage ? ` - ${m.dosage}` : '';
        const freq = m.frequency ? ` (${m.frequency})` : '';
        const dur = m.duration ? ` for ${m.duration}` : '';
        const inst = m.instructions ? ` [${m.instructions}]` : '';
        return `${idx + 1}. ${name}${dosage}${freq}${dur}${inst}`.trim();
      }).filter(Boolean);
      if (medLines.length > 0) {
        notesParts.push(`Prescribed Medications:\n${medLines.join('\n')}`);
      }
    } else if (typeof medicines === 'string' && medicines.trim()) {
      notesParts.push(`Prescribed Medications:\n${medicines.trim()}`);
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

    const appt = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'COMPLETED',
        ...(finalNotes !== undefined && { clinicalNotes: finalNotes }),
        ...(vitals && { vitals: typeof vitals === 'object' ? JSON.stringify(vitals) : vitals }),
      },
    });

    const patProfile = await prisma.patientProfile.findUnique({
      where: { id: targetAppointment.patientId },
      select: { userId: true },
    });
    if (patProfile?.userId) {
      const docName = (doctor as any)?.user?.fullName || req.user.fullName || 'Practitioner';
      createNotification(
        patProfile.userId,
        'Consultation Completed',
        `Your consultation with Dr. ${docName} has concluded. Prescribed advice and medicines are available on your pass.`,
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

export const completeWithPrescription = completeConsultation;

