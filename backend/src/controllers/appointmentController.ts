import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';

// Helper to convert "09:00" to 12-hour AM/PM string
export const format12Hour = (time24: string): string => {
  if (!time24) return '09:00 AM';
  if (time24.includes('AM') || time24.includes('PM')) return time24;
  const parts = time24.split(':');
  let h = parseInt(parts[0], 10);
  if (isNaN(h)) return time24;
  const m = (parts[1] || '00').replace(/[^0-9]/g, '').slice(0, 2).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12; // 0 becomes 12
  return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
};

// Helper to calculate estimated time given start time "09:00" and offset minutes
export const calculateEstimatedTime = (startTime24: string, offsetMinutes: number): string => {
  if (!startTime24) startTime24 = '09:00';
  const cleanTime = startTime24.replace(/\s*(AM|PM)/i, '');
  const [hStr, mStr] = cleanTime.split(':');
  let startHour = parseInt(hStr, 10);
  if (startTime24.toUpperCase().includes('PM') && startHour < 12) startHour += 12;
  if (startTime24.toUpperCase().includes('AM') && startHour === 12) startHour = 0;
  const startTotalMinutes = (isNaN(startHour) ? 9 : startHour) * 60 + parseInt(mStr || '0', 10);
  const totalMinutes = startTotalMinutes + offsetMinutes;
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return format12Hour(`${hours24}:${minutes.toString().padStart(2, '0')}`);
};

export const getQueuePreview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { doctorId, appointmentDate } = req.query;

    if (!doctorId || !appointmentDate) {
      res.status(400).json({ success: false, message: 'doctorId and appointmentDate are required' });
      return;
    }

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: String(doctorId) },
      include: { user: { select: { fullName: true } } },
    });

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found' });
      return;
    }

    const dateStr = String(appointmentDate);

    // Count active appointments for capacity & patients ahead
    const activeCount = await prisma.appointment.count({
      where: {
        doctorId: doctor.id,
        appointmentDate: dateStr,
        status: { in: ['WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
      },
    });

    // Find highest assigned queue number to prevent duplicate key collisions
    const maxQueueAppt = await prisma.appointment.findFirst({
      where: {
        doctorId: doctor.id,
        appointmentDate: dateStr,
      },
      orderBy: { queueNumber: 'desc' },
    });

    const isFull = activeCount >= doctor.maxDailyPatients;
    const nextQueueNumber = (maxQueueAppt?.queueNumber || 0) + 1;
    const patientsAhead = activeCount;

    const checkingWindow = `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`;
    const offsetMinutes = patientsAhead * doctor.avgConsultationMinutes;
    const estimatedTime = calculateEstimatedTime(doctor.checkingStartTime, offsetMinutes);

    res.json({
      success: true,
      data: {
        doctorId: doctor.id,
        doctorName: doctor.user.fullName,
        appointmentDate: dateStr,
        checkingWindow,
        checkingStartTime: doctor.checkingStartTime,
        checkingEndTime: doctor.checkingEndTime,
        avgConsultationMinutes: doctor.avgConsultationMinutes,
        maxDailyPatients: doctor.maxDailyPatients,
        totalBooked: activeCount,
        nextQueueNumber,
        patientsAhead,
        estimatedTime,
        isFull,
      },
    });
  } catch (error: any) {
    console.error('getQueuePreview error:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate queue preview', error: error.message });
  }
};

export const bookAppointment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'PATIENT') {
      res.status(403).json({ success: false, message: 'Only registered patients can book appointments' });
      return;
    }

    const { doctorId, appointmentDate, reasonForVisit, symptoms } = req.body;

    if (!doctorId || !appointmentDate) {
      res.status(400).json({ success: false, message: 'Doctor ID and appointment date are required' });
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

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { user: { select: { fullName: true } } },
    });

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found' });
      return;
    }

    // Check if patient already has an active appointment with this doctor on this day
    const existingPatientBooking = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        doctorId: doctor.id,
        appointmentDate,
        status: { in: ['WAITING', 'IN_CONSULTATION'] },
      },
    });

    if (existingPatientBooking) {
      res.status(400).json({
        success: false,
        message: `You already have an active booking (Queue #${existingPatientBooking.queueNumber}) with this doctor on this date.`,
      });
      return;
    }

    // Perform atomic transaction with retry on concurrency collision
    let newAppointment: any;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        newAppointment = await prisma.$transaction(async (tx) => {
          const activeCount = await tx.appointment.count({
            where: {
              doctorId: doctor.id,
              appointmentDate,
              status: { in: ['WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
            },
          });

          if (activeCount >= doctor.maxDailyPatients) {
            throw new Error('Doctor schedule is fully booked for this date');
          }

          // Find highest queue number to avoid unique constraint collisions with cancelled appointments
          const maxQueueAppt = await tx.appointment.findFirst({
            where: {
              doctorId: doctor.id,
              appointmentDate,
            },
            orderBy: { queueNumber: 'desc' },
          });

          const queueNumber = (maxQueueAppt?.queueNumber || 0) + 1;
          const checkingWindow = `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`;
          const offsetMinutes = activeCount * doctor.avgConsultationMinutes;
          const estimatedTime = calculateEstimatedTime(doctor.checkingStartTime, offsetMinutes);

          const created = await tx.appointment.create({
            data: {
              patientId: patient.id,
              doctorId: doctor.id,
              appointmentDate,
              queueNumber,
              checkingWindow,
              estimatedTime,
              status: 'WAITING',
              reasonForVisit: reasonForVisit || 'General Medical Consultation',
              symptoms: symptoms || null,
            },
            include: {
              doctor: {
                include: {
                  user: { select: { fullName: true, avatarUrl: true } },
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
        if (err.code === 'P2002' && attempts < maxAttempts) {
          // Retry on unique constraint collision
          continue;
        }
        throw err;
      }
    }

    res.status(201).json({
      success: true,
      message: `Appointment confirmed! You are Queue #${newAppointment.queueNumber}`,
      data: newAppointment,
    });
  } catch (error: any) {
    console.error('bookAppointment error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to book appointment' });
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
        patient: {
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true } },
            medicalRecords: { orderBy: { uploadedAt: 'desc' } },
          },
        },
        prescription: true,
        review: true,
      },
    });

    if (!appointment) {
      res.status(404).json({ success: false, message: 'Appointment not found' });
      return;
    }

    // Access control: Doctor of appointment, patient of appointment, or Admin
    if (req.user) {
      const isDoctor = req.user.role === 'DOCTOR' && appointment.doctor.userId === req.user.id;
      const isPatient = req.user.role === 'PATIENT' && appointment.patient.userId === req.user.id;
      const isAdmin = req.user.role === 'ADMIN';

      if (!isDoctor && !isPatient && !isAdmin) {
        res.status(403).json({ success: false, message: 'Access denied: You are not authorized to view this appointment' });
        return;
      }
    }

    res.json({ success: true, data: appointment });
  } catch (error: any) {
    console.error('getAppointmentById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve appointment', error: error.message });
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

    const appointments = await prisma.appointment.findMany({
      where: { patientId: patient.id },
      include: {
        doctor: {
          include: {
            user: { select: { fullName: true, avatarUrl: true, email: true } },
          },
        },
        prescription: true,
        review: true,
      },
      orderBy: [{ appointmentDate: 'desc' }, { queueNumber: 'asc' }],
    });

    // Calculate real-time queue position for active appointments
    const enrichedAppointments = await Promise.all(
      appointments.map(async (appt) => {
        if (appt.status === 'WAITING' || appt.status === 'IN_CONSULTATION') {
          // Find currently serving queue number for that doctor and date
          const currentServingAppt = await prisma.appointment.findFirst({
            where: {
              doctorId: appt.doctorId,
              appointmentDate: appt.appointmentDate,
              status: 'IN_CONSULTATION',
            },
          });

          let currentServingQueueNumber = 0;
          if (currentServingAppt) {
            currentServingQueueNumber = currentServingAppt.queueNumber;
          } else {
            // Check lowest waiting
            const lowestWaiting = await prisma.appointment.findFirst({
              where: {
                doctorId: appt.doctorId,
                appointmentDate: appt.appointmentDate,
                status: 'WAITING',
              },
              orderBy: { queueNumber: 'asc' },
            });
            currentServingQueueNumber = lowestWaiting ? lowestWaiting.queueNumber : 0;
          }

          const patientsAway = Math.max(0, appt.queueNumber - currentServingQueueNumber);
          const estWaitMinutes = patientsAway * appt.doctor.avgConsultationMinutes;

          return {
            ...appt,
            liveQueue: {
              currentServingQueueNumber,
              patientsAway,
              estimatedWaitMinutes: estWaitMinutes,
              isYourTurn: appt.status === 'IN_CONSULTATION' || patientsAway === 0,
            },
          };
        }
        return appt;
      })
    );

    res.json({ success: true, count: enrichedAppointments.length, data: enrichedAppointments });
  } catch (error: any) {
    console.error('getPatientAppointments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch appointments', error: error.message });
  }
};

export const cancelAppointment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    const appointment: any = await prisma.appointment.findUnique({
      where: { id },
      include: { patient: true, doctor: true },
    });

    if (!appointment) {
      res.status(404).json({ success: false, message: 'Appointment not found' });
      return;
    }

    // Verify ownership
    if (req.user?.role === 'PATIENT' && appointment.patient.userId !== req.user.id) {
      res.status(403).json({ success: false, message: 'You do not have permission to cancel this appointment' });
      return;
    }

    if (req.user?.role === 'DOCTOR' && appointment.doctor.userId !== req.user.id) {
      res.status(403).json({ success: false, message: 'You do not have permission to cancel another doctor\'s appointment' });
      return;
    }

    if (appointment.status === 'CANCELLED') {
      res.status(400).json({ success: false, message: 'Appointment is already cancelled' });
      return;
    }

    if (appointment.status === 'IN_CONSULTATION') {
      res.status(400).json({ success: false, message: 'Cannot cancel an appointment actively in consultation' });
      return;
    }

    if (appointment.status === 'COMPLETED') {
      res.status(400).json({ success: false, message: 'Cannot cancel a completed consultation' });
      return;
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json({ success: true, message: 'Appointment cancelled successfully', data: updated });
  } catch (error: any) {
    console.error('cancelAppointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel appointment', error: error.message });
  }
};
