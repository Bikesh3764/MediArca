import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';
import { getLocalDateString } from '../utils/scheduleUtils';

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

    const dateStr = (req.query.date as string) || getLocalDateString();
    const scope = (req.query.scope as string) || 'date';

    const whereClause: any = {
      doctorId: doctor.id,
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
            medicalRecords: { take: 5, orderBy: { uploadedAt: 'desc' } },
          },
        },
        prescription: true,
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
    res.status(500).json({ success: false, message: 'Failed to retrieve doctor queue', error: error.message });
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

    // Set any currently in_consultation appointment to WAITING or leave as is, or mark target as IN_CONSULTATION
    const targetAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!targetAppointment || targetAppointment.doctorId !== doctor.id) {
      res.status(404).json({ success: false, message: 'Appointment not found for this doctor' });
      return;
    }

    if (targetAppointment.status === 'CANCELLED') {
      res.status(400).json({ success: false, message: 'Cannot call an appointment that has been cancelled' });
      return;
    }

    if (targetAppointment.status === 'COMPLETED') {
      res.status(400).json({ success: false, message: 'Cannot call an appointment that has already been completed' });
      return;
    }

    // Reset any currently IN_CONSULTATION appointments on this date back to WAITING
    await prisma.appointment.updateMany({
      where: {
        doctorId: doctor.id,
        appointmentDate: targetAppointment.appointmentDate,
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
            user: { select: { fullName: true, email: true, phone: true } },
            medicalRecords: { orderBy: { uploadedAt: 'desc' } },
          },
        },
        prescription: true,
      },
    });

    res.json({
      success: true,
      message: `Queue #${updated.queueNumber} (${updated.patient.user.fullName}) is now in consultation`,
      data: updated,
    });
  } catch (error: any) {
    console.error('callPatient error:', error);
    res.status(500).json({ success: false, message: 'Failed to call patient', error: error.message });
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

    // Verify appointment belongs to this doctor
    const targetAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!targetAppointment || targetAppointment.doctorId !== doctor.id) {
      res.status(403).json({ success: false, message: 'Appointment does not belong to this doctor' });
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
    res.status(500).json({ success: false, message: 'Failed to save notes', error: error.message });
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

    // Verify appointment belongs to this doctor
    const targetAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!targetAppointment || targetAppointment.doctorId !== doctor.id) {
      res.status(403).json({ success: false, message: 'Appointment does not belong to this doctor' });
      return;
    }

    if (targetAppointment.status === 'CANCELLED') {
      res.status(400).json({ success: false, message: 'Cannot complete consultation for a cancelled appointment' });
      return;
    }

    let filteredMedicines: any[] = [];
    if (Array.isArray(medicines)) {
      filteredMedicines = medicines.filter((m) => m && typeof m.name === 'string' && m.name.trim().length > 0);
    } else if (typeof medicines === 'string') {
      try {
        const parsed = JSON.parse(medicines);
        if (Array.isArray(parsed)) {
          filteredMedicines = parsed.filter((m) => m && typeof m.name === 'string' && m.name.trim().length > 0);
        }
      } catch {}
    }

    const medicinesJson = filteredMedicines.length > 0 ? JSON.stringify(filteredMedicines) : null;

    // Use transaction to update appointment and upsert prescription if provided
    const result = await prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: 'COMPLETED',
          ...(clinicalNotes !== undefined && { clinicalNotes }),
          ...(vitals && { vitals: typeof vitals === 'object' ? JSON.stringify(vitals) : vitals }),
        },
      });

      let prescription: any = null;
      if (diagnosis || medicinesJson) {
        prescription = await tx.prescription.upsert({
          where: { appointmentId },
          update: {
            diagnosis: diagnosis || 'General Medical Consultation',
            medicines: medicinesJson || '[]',
            advice: advice || null,
            followUpDate: followUpDate || null,
          },
          create: {
            appointmentId,
            diagnosis: diagnosis || 'General Medical Consultation',
            medicines: medicinesJson || '[]',
            advice: advice || null,
            followUpDate: followUpDate || null,
          },
        });
      }

      return { appointment: appt, prescription };
    });

    res.json({
      success: true,
      message: result.prescription
        ? 'Consultation completed and digital prescription issued!'
        : 'Consultation completed successfully!',
      data: result,
    });
  } catch (error: any) {
    console.error('completeConsultation error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete consultation', error: error.message });
  }
};

export const completeWithPrescription = completeConsultation;

