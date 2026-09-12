import { Response } from 'express';
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
} from '../utils/scheduleUtils';

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

export const getQueuePreview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { doctorId, appointmentDate, slotId, clientMinutes } = req.query;

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
    const slots = parseDoctorSlots(doctor);
    const clientMinsNum = clientMinutes !== undefined ? Number(clientMinutes) : undefined;

    // Fetch all active appointments for this doctor on this date
    const dayAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        appointmentDate: dateStr,
        status: { in: ['WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
      },
      select: {
        id: true,
        queueNumber: true,
        slotId: true,
        checkingWindow: true,
        status: true,
      },
    });

    // Highest queue number on this date to prevent duplicate collisions
    const highestQueue = dayAppointments.reduce((max, a) => Math.max(max, a.queueNumber), 0);
    const nextQueueNumber = highestQueue + 1;

    // Evaluate status for each slot
    const availableSlots: SlotStatusResult[] = slots.map((slot) => {
      const bookedInSlot = dayAppointments.filter((a) => {
        if (a.slotId) return a.slotId === slot.id;
        if (a.checkingWindow && a.checkingWindow.includes(slot.startTime)) return true;
        if (slots.length === 1) return true;
        return false;
      }).length;

      return evaluateSlotStatus(
        slot,
        dateStr,
        bookedInSlot,
        new Date(),
        clientMinsNum
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

    const {
      doctorId,
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
    } = req.body;

    if (!doctorId || !appointmentDate) {
      res.status(400).json({ success: false, message: 'Doctor ID and appointment date are required' });
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

    const slots = parseDoctorSlots(doctor);
    const clientMinsNum = typeof clientMinutes === 'number' && !isNaN(clientMinutes) ? clientMinutes : undefined;

    let chosenSlot = slots.find((s) => s.id === slotId);
    if (!chosenSlot) {
      chosenSlot = slots.find((s) => {
        const st = evaluateSlotStatus(s, appointmentDate, 0, new Date(), clientMinsNum);
        return !st.isPassed && !st.isFull;
      }) || slots[0];
    }

    // Check if patient already has an active appointment with this doctor on this day
    const existingPatientBooking = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        doctorId: doctor.id,
        appointmentDate,
        isForOther: Boolean(isForOther),
        ...(isForOther && patientName
          ? { patientName: { equals: String(patientName).trim(), mode: 'insensitive' } }
          : {}),
        status: { in: ['WAITING', 'IN_CONSULTATION'] },
      },
    });

    if (existingPatientBooking) {
      const recipient = isForOther ? `for ${patientName}` : 'for yourself';
      res.status(400).json({
        success: false,
        message: `You already have an active booking (Queue #${existingPatientBooking.queueNumber}) ${recipient} with this doctor on this date.`,
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
          const dayAppointments = await tx.appointment.findMany({
            where: {
              doctorId: doctor.id,
              appointmentDate,
              status: { in: ['WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
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
            if (a.checkingWindow && a.checkingWindow.includes(chosenSlot!.startTime)) return true;
            if (slots.length === 1) return true;
            return false;
          }).length;

          // Check if slot has passed or reached max patients
          const slotStatus = evaluateSlotStatus(
            chosenSlot!,
            appointmentDate,
            bookedInSlot,
            new Date(),
            clientMinsNum
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

          const highestQueue = dayAppointments.reduce((max, a) => Math.max(max, a.queueNumber), 0);
          const queueNumber = highestQueue + 1;

          let targetClinicId: string | null = null;
          if (clinicId) {
            const verifiedClinic = await tx.clinicProfile.findFirst({
              where: { id: clinicId, isVerified: true },
            });
            if (verifiedClinic) {
              targetClinicId = verifiedClinic.id;
            }
          }
          if (!targetClinicId) {
            const activeAffiliation = await tx.clinicDoctor.findFirst({
              where: {
                doctorId: doctor.id,
                status: { in: ['ACTIVE', 'ACCEPTED'] },
                clinic: { isVerified: true },
              },
            });
            if (activeAffiliation) {
              targetClinicId = activeAffiliation.clinicId;
            }
          }

          const created = await tx.appointment.create({
            data: {
              patientId: patient!.id,
              doctorId: doctor.id,
              clinicId: targetClinicId || null,
              appointmentDate,
              queueNumber,
              slotId: chosenSlot!.id,
              checkingWindow: chosenSlot!.name,
              estimatedTime: slotStatus.estimatedTime,
              status: 'WAITING',
              reasonForVisit: reasonForVisit || 'General Medical Consultation',
              symptoms: symptoms || null,
              isForOther: Boolean(isForOther),
              patientName: isForOther && patientName ? String(patientName).trim() : null,
              patientAge: isForOther && patientAge ? String(patientAge).trim() : null,
              patientGender: isForOther && patientGender ? String(patientGender).trim() : null,
            },
            include: {
              doctor: {
                include: {
                  user: { select: { fullName: true, avatarUrl: true } },
                },
              },
              clinic: {
                select: { id: true, clinicName: true, address: true, city: true, phone: true },
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
      message: `Appointment confirmed! You are Queue #${newAppointment.queueNumber} (${chosenSlot.name})`,
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
        clinic: {
          select: { id: true, clinicName: true, address: true, city: true, phone: true },
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

    // Access control: Doctor of appointment, patient of appointment, Admin, or authorized Clinic/Receptionist
    if (req.user) {
      const isDoctor = req.user.role === 'DOCTOR' && appointment.doctor.userId === req.user.id;
      const isPatient = req.user.role === 'PATIENT' && appointment.patient.userId === req.user.id;
      const isAdmin = req.user.role === 'ADMIN';

      let isClinicOrRec = false;
      if (req.user.role === 'CLINIC' && appointment.clinicId) {
        const clinic = await prisma.clinicProfile.findUnique({
          where: { userId: req.user.id },
        });
        isClinicOrRec = Boolean(clinic && clinic.id === appointment.clinicId);
      } else if (req.user.role === 'RECEPTIONIST') {
        const rec = await prisma.receptionistProfile.findUnique({
          where: { userId: req.user.id },
          include: { doctors: true },
        });
        if (rec) {
          isClinicOrRec = Boolean(
            (rec.clinicId && appointment.clinicId === rec.clinicId) ||
            rec.doctors.some((d) => d.doctorId === appointment.doctorId)
          );
        }
      }

      if (!isDoctor && !isPatient && !isAdmin && !isClinicOrRec) {
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
        clinic: {
          select: { id: true, clinicName: true, address: true, city: true, phone: true },
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
          const slots = parseDoctorSlots(appt.doctor);
          const slot = (appt.slotId && slots.find((s) => s.id === appt.slotId)) || slots[0];
          const pace = slot?.avgConsultationMinutes || 3.0;

          // Find currently serving queue number for that doctor, date, and matching slot
          const currentServingAppt = await prisma.appointment.findFirst({
            where: {
              doctorId: appt.doctorId,
              appointmentDate: appt.appointmentDate,
              ...(appt.slotId ? { slotId: appt.slotId } : {}),
              status: 'IN_CONSULTATION',
            },
          });

          let currentServingQueueNumber = 0;
          if (currentServingAppt) {
            currentServingQueueNumber = currentServingAppt.queueNumber;
          }

          // Count how many patients are ahead waiting in this slot
          const patientsAhead = await prisma.appointment.count({
            where: {
              doctorId: appt.doctorId,
              appointmentDate: appt.appointmentDate,
              ...(appt.slotId ? { slotId: appt.slotId } : {}),
              queueNumber: { lt: appt.queueNumber },
              status: { in: ['WAITING', 'IN_CONSULTATION'] },
            },
          });

          // Check shift timing for today
          const slotStartMins = timeToMinutes(slot.startTime);
          let slotEndMins = timeToMinutes(slot.endTime);
          if (slotEndMins <= slotStartMins) slotEndMins += 24 * 60;

          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const isToday = appt.appointmentDate === todayStr;
          const currentMinutes = now.getHours() * 60 + now.getMinutes();

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
            ...appt,
            liveQueue: {
              currentServingQueueNumber: currentServingQueueNumber || (isShiftActive ? 1 : 0),
              patientsAway: patientsAhead,
              estimatedWaitMinutes: estWaitMinutes,
              isYourTurn,
              isShiftActive,
              isShiftPassed,
              liveEstimatedTime,
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
