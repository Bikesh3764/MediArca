import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';

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

    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        appointmentDate: dateStr,
      },
      include: {
        patient: {
          include: {
            user: { select: { fullName: true, email: true, phone: true, avatarUrl: true } },
            medicalRecords: { take: 5, orderBy: { uploadedAt: 'desc' } },
          },
        },
        prescription: true,
      },
      orderBy: { queueNumber: 'asc' },
    });

    const activeInConsultation = appointments.find((a) => a.status === 'IN_CONSULTATION') || null;
    const waitingQueue = appointments.filter((a) => a.status === 'WAITING');
    const completedQueue = appointments.filter((a) => a.status === 'COMPLETED');

    res.json({
      success: true,
      data: {
        date: dateStr,
        totalQueue: appointments.length,
        activeInConsultation,
        waitingQueue,
        completedQueue,
        allAppointments: appointments,
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
            medicalRecords: true,
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
            medicalRecords: true,
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

export const completeWithPrescription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Doctor only' });
      return;
    }

    const { appointmentId, diagnosis, medicines, advice, followUpDate, clinicalNotes, vitals } = req.body;

    if (!appointmentId || !diagnosis || !medicines) {
      res.status(400).json({ success: false, message: 'appointmentId, diagnosis, and medicines are required' });
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

    const medicinesJson = typeof medicines === 'string' ? medicines : JSON.stringify(medicines);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark appointment as completed
      const appt = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: 'COMPLETED',
          ...(clinicalNotes && { clinicalNotes }),
          ...(vitals && { vitals: typeof vitals === 'object' ? JSON.stringify(vitals) : vitals }),
        },
      });

      // 2. Upsert prescription
      const prescription = await tx.prescription.upsert({
        where: { appointmentId },
        update: {
          diagnosis,
          medicines: medicinesJson,
          advice: advice || null,
          followUpDate: followUpDate || null,
        },
        create: {
          appointmentId,
          diagnosis,
          medicines: medicinesJson,
          advice: advice || null,
          followUpDate: followUpDate || null,
        },
      });

      return { appointment: appt, prescription };
    });

    res.json({
      success: true,
      message: 'Consultation completed and digital prescription issued!',
      data: result,
    });
  } catch (error: any) {
    console.error('completeWithPrescription error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete consultation', error: error.message });
  }
};
