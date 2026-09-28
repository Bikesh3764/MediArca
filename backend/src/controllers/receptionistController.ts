import { Request, Response } from 'express';
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
import { formatIndianPhone, sanitizeIndianPhone } from '../utils/phoneUtils';

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
      activeDoctorIds.includes(dr.doctorId)
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
            }
          : null,
        doctors: doctorsWithQueue,
      },
    });
  } catch (error: any) {
    console.error('getMyReceptionist error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve receptionist profile', error: error.message });
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

    if (!req.user || req.user.role !== 'RECEPTIONIST') {
      res.status(403).json({
        success: false,
        message: 'Access denied: Receptionist role required to access clinical queue.',
      });
      return;
    }

    const receptionist = await prisma.receptionistProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist profile not found' });
      return;
    }

    const assignment = await prisma.doctorReceptionist.findUnique({
      where: {
        doctorId_receptionistId: {
          doctorId,
          receptionistId: receptionist.id,
        },
      },
    });
    if (!assignment) {
      res.status(403).json({
        success: false,
        message: 'Access denied: You do not have queue management access for this doctor.',
      });
      return;
    }

        if (receptionist.clinicId) {
          const isAffiliated = await prisma.clinicDoctor.findUnique({
            where: {
              clinicId_doctorId: {
                clinicId: receptionist.clinicId,
                doctorId,
              },
            },
          });
          if (!isAffiliated || (isAffiliated.status !== 'ACTIVE' && isAffiliated.status !== 'ACCEPTED')) {
            res.status(403).json({
              success: false,
              message: 'Access denied: Practitioner is not currently affiliated with your clinic.',
            });
            return;
          }
        }

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
        ...(receptionist?.clinicId ? { clinicId: receptionist.clinicId } : {}),
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
          reasonForVisit: a.reasonForVisit,
          symptoms: a.symptoms,
          hasPrescription: Boolean(a.prescription),
          isForOther: Boolean(a.isForOther),
          patientAge: a.patientAge,
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

    const appointmentDate = requestedDate || getLocalDateString();

    const receptionist = await prisma.receptionistProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist profile not found' });
      return;
    }

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { user: { select: { fullName: true } } },
    });

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found' });
      return;
    }

    // Verify receptionist is assigned to this doctor
    const assignment = await prisma.doctorReceptionist.findUnique({
      where: {
        doctorId_receptionistId: {
          doctorId,
          receptionistId: receptionist.id,
        },
      },
    });

    if (!assignment) {
      res.status(403).json({
        success: false,
        message: 'Access denied: You are only authorized to book appointments for doctors assigned to your desk by your clinic.',
      });
      return;
    }

    // Verify doctor is actively affiliated with this receptionist's clinic
    if (receptionist.clinicId) {
      const clinic = await prisma.clinicProfile.findUnique({
        where: { id: receptionist.clinicId },
      });
      if (!clinic || !clinic.isVerified || clinic.verificationStatus === 'SUSPENDED') {
        res.status(403).json({
          success: false,
          message: 'Access denied: Your clinic facility is not verified or is suspended from desk operations.',
        });
        return;
      }

      const isAffiliated = await prisma.clinicDoctor.findUnique({
        where: {
          clinicId_doctorId: {
            clinicId: receptionist.clinicId,
            doctorId: doctor.id,
          },
        },
      });
      if (!isAffiliated || (isAffiliated.status !== 'ACTIVE' && isAffiliated.status !== 'ACCEPTED')) {
        res.status(403).json({
          success: false,
          message: 'Access denied: Practitioner is not currently affiliated with your facility.',
        });
        return;
      }
    }

    // Find or create walk-in patient profile with phone normalization
    const cleanPhone = String(patientPhone).trim();
    const normalizedPhone = formatIndianPhone(cleanPhone);
    const rawDigits = sanitizeIndianPhone(cleanPhone);

    let patientUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
          ...(rawDigits ? [{ phone: rawDigits }] : []),
          { phone: cleanPhone },
        ],
      },
      include: { patientProfile: true },
    });

    if (!patientUser) {
      const dummySalt = await bcrypt.genSalt(10);
      const dummyHash = await bcrypt.hash('walkin123', dummySalt);
      const walkinEmail = `walkin.${rawDigits || cleanPhone.replace(/\D/g, '') || Date.now()}@mediarca.local`;

      patientUser = await prisma.user.create({
        data: {
          fullName: patientName ? String(patientName).trim() : 'Walk-in Patient',
          phone: normalizedPhone || cleanPhone,
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
        if (err.code === 'P2002' && attempts < maxAttempts) {
          continue;
        }
        throw err;
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

    const targetAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!targetAppointment) {
      res.status(404).json({ success: false, message: 'Appointment not found' });
      return;
    }

    if (targetAppointment.status === 'COMPLETED' || targetAppointment.status === 'CANCELLED') {
      res.status(400).json({
        success: false,
        message: `Cannot update status of an appointment that is already ${targetAppointment.status.toLowerCase()}`,
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

    const receptionist = await prisma.receptionistProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!receptionist) {
      res.status(403).json({ success: false, message: 'Access denied: Receptionist profile not found' });
      return;
    }

    const assignment = await prisma.doctorReceptionist.findUnique({
      where: {
        doctorId_receptionistId: {
          doctorId: targetAppointment.doctorId,
          receptionistId: receptionist.id,
        },
      },
    });

    if (!assignment) {
      res.status(403).json({
        success: false,
        message: 'Access denied: You are only authorized to update appointments for doctors assigned to your desk.',
      });
      return;
    }

    if (receptionist.clinicId && targetAppointment.clinicId && targetAppointment.clinicId !== receptionist.clinicId) {
      res.status(403).json({
        success: false,
        message: 'Access denied: Appointment belongs to another clinic facility.',
      });
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

    if (newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
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
    res.json({
      success: true,
      message: 'Password updated successfully. Desk access unlocked.',
      data: safeUser,
    });
  } catch (error: any) {
    console.error('changeReceptionistPassword error:', error);
    res.status(500).json({ success: false, message: 'Failed to update password', error: error.message });
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
        doctors: { include: { doctor: { include: { user: true } } } },
      },
    });

    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist profile not found' });
      return;
    }

    const assignedDoctorIds = receptionist.doctors.map((d) => d.doctorId);

    const pendingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: { in: assignedDoctorIds },
        ...(receptionist.clinicId ? { clinicId: receptionist.clinicId } : {}),
        status: 'PENDING_APPROVAL',
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

    const enriched = pendingAppointments.map((appt) => {
      const cd = (appt.doctor as any)?.clinics?.[0];
      const fee = cd?.consultationFee ?? appt.doctor.consultationFee;
      return {
        ...appt,
        consultationFee: fee,
      };
    });

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (error: any) {
    console.error('getPendingAppointments error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve pending appointments', error: error.message });
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

    const receptionist = await prisma.receptionistProfile.findUnique({
      where: { userId: req.user.id },
      include: { doctors: true },
    });

    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist profile not found' });
      return;
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: {
          include: {
            user: true,
            clinics: {
              where: { clinicId: receptionist.clinicId || undefined },
            },
          },
        },
        clinic: true,
        patient: { include: { user: true } },
      },
    });

    if (!appointment) {
      res.status(404).json({ success: false, message: 'Appointment not found' });
      return;
    }

    // Verify receptionist is assigned to this doctor
    const isAssigned = receptionist.doctors.some((d) => d.doctorId === appointment.doctorId);
    if (!isAssigned) {
      res.status(403).json({ success: false, message: 'Access denied: You are not assigned to manage this doctor.' });
      return;
    }

    if (receptionist.clinicId && appointment.clinicId && appointment.clinicId !== receptionist.clinicId) {
      res.status(403).json({ success: false, message: 'Access denied: Appointment belongs to a different clinic facility.' });
      return;
    }

    if (appointment.status !== 'PENDING_APPROVAL') {
      res.status(400).json({ success: false, message: `Appointment cannot be approved because current status is ${appointment.status}.` });
      return;
    }

    // Atomic transaction: assign real sequential queue token (positive integer), mark WAITING and PAID
    let updated: any;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        updated = await prisma.$transaction(async (tx) => {
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
          const cd = (appointment.doctor as any)?.clinics?.[0];
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
        if (err.code === 'P2002' && attempts < maxAttempts) {
          continue;
        }
        throw err;
      }
    }

    res.json({
      success: true,
      message: `Appointment approved successfully. Queue Token #${updated.queueNumber} assigned and payment confirmed.`,
      data: updated,
    });
  } catch (error: any) {
    console.error('approveAppointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve appointment', error: error.message });
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

    const receptionist = await prisma.receptionistProfile.findUnique({
      where: { userId: req.user.id },
      include: { doctors: true },
    });

    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist profile not found' });
      return;
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      res.status(404).json({ success: false, message: 'Appointment not found' });
      return;
    }

    const isAssigned = receptionist.doctors.some((d) => d.doctorId === appointment.doctorId);
    if (!isAssigned) {
      res.status(403).json({ success: false, message: 'Access denied: You are not assigned to manage this doctor.' });
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

    res.json({
      success: true,
      message: 'Appointment booking request has been declined.',
      data: updated,
    });
  } catch (error: any) {
    console.error('rejectAppointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to decline appointment', error: error.message });
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
    res.status(500).json({ success: false, message: 'Failed to submit receptionist application', error: error.message });
  }
};

