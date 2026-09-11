import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  parseDoctorSlots,
  evaluateSlotStatus,
  getLocalDateString,
  timeToMinutes,
  minutesTo12Hour,
} from '../utils/scheduleUtils';

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

    const todayStr = getLocalDateString();

    // Compute today's queue count for each linked doctor
    const doctorsWithQueue = await Promise.all(
      receptionist.doctors.map(async (dr) => {
        const todayCount = await prisma.appointment.count({
          where: {
            doctorId: dr.doctorId,
            appointmentDate: todayStr,
            status: { in: ['WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
          },
        });

        const waitingCount = await prisma.appointment.count({
          where: {
            doctorId: dr.doctorId,
            appointmentDate: todayStr,
            status: 'WAITING',
          },
        });

        const activeSlot = parseDoctorSlots(dr.doctor);

        return {
          affiliationId: dr.id,
          doctorId: dr.doctor.id,
          fullName: dr.doctor.user.fullName,
          email: dr.doctor.user.email,
          phone: dr.doctor.user.phone,
          avatarUrl: dr.doctor.user.avatarUrl,
          specialty: dr.doctor.specialty,
          clinicAddress: dr.doctor.clinicAddress,
          consultationFee: dr.doctor.consultationFee,
          slots: activeSlot,
          clinics: dr.doctor.clinics,
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
        },
        doctors: doctorsWithQueue,
      },
    });
  } catch (error: any) {
    console.error('getMyReceptionist error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve receptionist profile', error: error.message });
  }
};

/**
 * Link doctor to this receptionist
 */
export const addDoctorToReceptionist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'RECEPTIONIST') {
      res.status(403).json({ success: false, message: 'Access denied: receptionist role required' });
      return;
    }

    const { doctorEmail, doctorId } = req.body;

    if (!doctorEmail && !doctorId) {
      res.status(400).json({ success: false, message: 'Doctor email or ID is required' });
      return;
    }

    const receptionist = await prisma.receptionistProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist profile not found' });
      return;
    }

    let doctor: any;
    if (doctorId) {
      doctor = await prisma.doctorProfile.findUnique({
        where: { id: doctorId },
        include: { user: true },
      });
    } else if (doctorEmail) {
      const user = await prisma.user.findUnique({
        where: { email: doctorEmail.toLowerCase().trim() },
        include: { doctorProfile: true },
      });
      if (user && user.doctorProfile) {
        doctor = { ...user.doctorProfile, user };
      }
    }

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found with provided identifier' });
      return;
    }

    const existing = await prisma.doctorReceptionist.findUnique({
      where: {
        doctorId_receptionistId: {
          doctorId: doctor.id,
          receptionistId: receptionist.id,
        },
      },
    });

    if (existing) {
      res.status(400).json({ success: false, message: 'Doctor is already linked to your receptionist account' });
      return;
    }

    const link = await prisma.doctorReceptionist.create({
      data: {
        doctorId: doctor.id,
        receptionistId: receptionist.id,
        status: 'ACTIVE',
      },
      include: {
        doctor: {
          include: {
            user: { select: { fullName: true, email: true } },
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: `Successfully linked ${doctor.user.fullName} to your desk`,
      data: link,
    });
  } catch (error: any) {
    console.error('addDoctorToReceptionist error:', error);
    res.status(500).json({ success: false, message: 'Failed to link doctor', error: error.message });
  }
};

/**
 * Remove doctor link from receptionist
 */
export const removeDoctorFromReceptionist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'RECEPTIONIST') {
      res.status(403).json({ success: false, message: 'Access denied: receptionist role required' });
      return;
    }

    const doctorId = String(req.params.doctorId);

    const receptionist = await prisma.receptionistProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist profile not found' });
      return;
    }

    await prisma.doctorReceptionist.deleteMany({
      where: {
        receptionistId: receptionist.id,
        doctorId,
      },
    });

    res.json({
      success: true,
      message: 'Doctor removed from your desk successfully',
    });
  } catch (error: any) {
    console.error('removeDoctorFromReceptionist error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove doctor link', error: error.message });
  }
};

/**
 * Get live queue for a specific linked doctor on a date
 */
export const getDoctorQueue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doctorId = String(req.params.doctorId);
    const appointmentDate = String(req.query.date || getLocalDateString());

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { user: { select: { fullName: true, email: true } } },
    });

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found' });
      return;
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctorId,
        appointmentDate: appointmentDate,
      },
      include: {
        patient: {
          include: {
            user: { select: { fullName: true, phone: true, email: true } },
          },
        },
        prescription: true,
      },
      orderBy: { queueNumber: 'asc' },
    });

    const slots = parseDoctorSlots(doctor);

    res.json({
      success: true,
      data: {
        doctor: {
          id: doctor.id,
          fullName: doctor.user.fullName,
          specialty: doctor.specialty,
          slots,
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
          patientName: a.patient?.user?.fullName || 'Walk-in Patient',
          patientPhone: a.patient?.user?.phone || 'N/A',
          gender: a.patient?.gender,
          bloodGroup: a.patient?.bloodGroup,
          checkingWindow: a.checkingWindow,
          estimatedTime: a.estimatedTime,
          slotId: a.slotId,
          status: a.status,
          reasonForVisit: a.reasonForVisit,
          symptoms: a.symptoms,
          hasPrescription: Boolean(a.prescription),
          createdAt: a.createdAt,
        })),
      },
    });
  } catch (error: any) {
    console.error('getDoctorQueue error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve doctor queue', error: error.message });
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

    const {
      doctorId,
      patientName,
      patientPhone,
      gender,
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

    const appointmentDate = requestedDate || getLocalDateString();

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { user: { select: { fullName: true } } },
    });

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found' });
      return;
    }

    // Find or create walk-in patient profile
    const cleanPhone = String(patientPhone).trim();
    let patientUser = await prisma.user.findFirst({
      where: { phone: cleanPhone },
      include: { patientProfile: true },
    });

    if (!patientUser) {
      const dummySalt = await bcrypt.genSalt(10);
      const dummyHash = await bcrypt.hash('walkin123', dummySalt);
      const walkinEmail = `walkin.${cleanPhone.replace(/\D/g, '') || Date.now()}@mediarca.local`;

      patientUser = await prisma.user.create({
        data: {
          fullName: patientName,
          phone: cleanPhone,
          email: walkinEmail,
          passwordHash: dummyHash,
          role: 'PATIENT',
          patientProfile: {
            create: {
              gender: gender || null,
            },
          },
        },
        include: { patientProfile: true },
      });
    }

    let patientProfile = patientUser.patientProfile;
    if (!patientProfile) {
      patientProfile = await prisma.patientProfile.create({
        data: {
          userId: patientUser.id,
          gender: gender || null,
        },
      });
    }

    // Slot determination
    const slots = parseDoctorSlots(doctor);
    let chosenSlot = slots.find((s) => s.id === slotId) || slots[0];

    // Concurrency-safe atomic transaction
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
            if (a.slotId) return a.slotId === chosenSlot.id;
            if (a.checkingWindow && a.checkingWindow.includes(chosenSlot.startTime)) return true;
            if (slots.length === 1) return true;
            return false;
          }).length;

          const highestQueue = dayAppointments.reduce((max, a) => Math.max(max, a.queueNumber), 0);
          const queueNumber = highestQueue + 1;

          let targetClinicId = clinicId;
          if (!targetClinicId) {
            const activeAffiliation = await tx.clinicDoctor.findFirst({
              where: { doctorId: doctor.id, status: 'ACTIVE' },
            });
            if (activeAffiliation) {
              targetClinicId = activeAffiliation.clinicId;
            }
          }

          const slotStartMins = timeToMinutes(chosenSlot.startTime);
          const offsetMins = bookedInSlot * chosenSlot.avgConsultationMinutes;
          const estimatedTime = minutesTo12Hour(slotStartMins + offsetMins);
          const checkingWindow = `${chosenSlot.startTime} – ${chosenSlot.endTime}`;

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
        if (attempts >= maxAttempts) {
          throw err;
        }
      }
    }

    res.status(201).json({
      success: true,
      message: `Token #${newAppointment.queueNumber} created successfully for ${patientName}`,
      data: newAppointment,
    });
  } catch (error: any) {
    console.error('bookWalkin error:', error);
    res.status(500).json({ success: false, message: 'Failed to book walk-in appointment', error: error.message });
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

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status },
      include: {
        doctor: { include: { user: { select: { fullName: true } } } },
        patient: { include: { user: { select: { fullName: true, phone: true } } } },
      },
    });

    res.json({
      success: true,
      message: `Appointment status updated to ${status}`,
      data: updated,
    });
  } catch (error: any) {
    console.error('updateAppointmentStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to update appointment status', error: error.message });
  }
};
