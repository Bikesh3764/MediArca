import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import { AuthRequest, getJwtSecret } from '../../middleware/authMiddleware';
import crypto from 'crypto';
import { parseDoctorSlots, getLocalDateString, parseDoctorWorkingDays, parseDoctorLeaves, isDoctorOnLeave, isDoctorWorkingOnDate } from '../../utils/scheduleUtils';
import { formatIndianPhone, isValidIndianPhone, findExistingAccountByPhone } from '../../utils/phoneUtils';
import { isDoctorEligibleForClinicalPractice, isClinicActive } from '../../utils/authGuards';
import { markPasswordChanged } from '../../utils/sessionRevocation';
import { createNotification } from '../../services/notificationService';

/**
 * Get profile and linked doctors for logged-in receptionist
 */
export const getMyReceptionist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'RECEPTIONIST') {
      res.status(403).json({ success: false, message: 'Access denied: receptionist role required' });
      return;
    }

    const userRec = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { mustChangePassword: true },
    });
    const mustChangePassword = Boolean(userRec?.mustChangePassword || req.user.mustChangePassword);

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

    // General desk fallback: If receptionist has no explicit subset assignments, cover all active doctors of the clinic
    let targetDoctorRecords: { id?: string; doctor: any; doctorId: string; createdAt?: Date }[] = activeAssignments;
    if (activeAssignments.length === 0 && receptionist.clinicId && activeDoctorIds.length > 0) {
      const allClinicDocs = await prisma.clinicDoctor.findMany({
        where: { clinicId: receptionist.clinicId, status: { in: ['ACTIVE', 'ACCEPTED'] } },
        include: {
          doctor: {
            include: {
              user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true } },
              clinics: { include: { clinic: true } },
            },
          },
        },
      });
      targetDoctorRecords = allClinicDocs
        .filter((cd) => isDoctorEligibleForClinicalPractice(cd.doctor).eligible)
        .map((cd) => ({ id: cd.id, doctor: cd.doctor, doctorId: cd.doctorId, createdAt: cd.createdAt }));
    }

    // Compute today's queue count for each linked doctor (scoped to this clinic)
    const doctorsWithQueue = await Promise.all(
      targetDoctorRecords.map(async (dr) => {
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

        const sanitizedDoctorClinics = (dr.doctor.clinics || []).map((c: any) => {
          if (!c?.clinic) return c;
          const { checkinCode: _secret, ...safeClinic } = c.clinic;
          return { ...c, clinic: safeClinic };
        });

        const cd = dr.doctor.clinics?.find((c: any) => c.clinicId === receptionist.clinicId);
        const workingDays = cd?.workingDays
          ? parseDoctorWorkingDays(cd.workingDays)
          : parseDoctorWorkingDays((dr.doctor as any).workingDays);
        const doctorLeaves = [
          ...parseDoctorLeaves((dr.doctor as any).leaves),
          ...(cd?.leaves ? parseDoctorLeaves(cd.leaves) : []),
        ];
        const todayLeaveCheck = isDoctorOnLeave(doctorLeaves, todayStr, receptionist.clinicId);
        const todayWorkingCheck = isDoctorWorkingOnDate(workingDays, todayStr);

        return {
          affiliationId: dr.id || dr.doctorId,
          doctorId: dr.doctor.id,
          fullName: dr.doctor.user.fullName,
          email: dr.doctor.user.email,
          phone: dr.doctor.user.phone,
          avatarUrl: dr.doctor.user.avatarUrl,
          specialty: dr.doctor.specialty,
          clinicAddress: dr.doctor.clinicAddress,
          consultationFee,
          slots: activeSlots,
          workingDays,
          leaves: doctorLeaves,
          isOnLeaveToday: todayLeaveCheck.isOnLeave,
          todayLeave: todayLeaveCheck.leave || null,
          isWorkingToday: todayWorkingCheck.isWorking,
          clinics: sanitizedDoctorClinics,
          cabinStatus: (dr.doctor as any).cabinStatus || 'IN_CABIN',
          expectedReturnTime: (dr.doctor as any).expectedReturnTime || null,
          cabinStatusUpdatedAt: (dr.doctor as any).cabinStatusUpdatedAt || null,
          todayTotalBookings: todayCount,
          todayWaitingPatients: waitingCount,
          joinedAt: dr.createdAt || new Date(),
        };
      })
    );

    if (receptionist.clinic && !(receptionist.clinic as any).checkinCode && typeof (prisma.clinicProfile as any)?.update === 'function') {
      const generatedCode = crypto.randomUUID();
      await prisma.clinicProfile.update({
        where: { id: receptionist.clinic.id },
        data: { checkinCode: generatedCode },
      });
      (receptionist.clinic as any).checkinCode = generatedCode;
    }

    const canAccessClinicCheckinCode = !mustChangePassword && isClinicActive(receptionist.clinic).active;

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
              ...(canAccessClinicCheckinCode ? { checkinCode: (receptionist.clinic as any).checkinCode || null } : {}),
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
 * Mandatory first-login or on-demand password change for receptionists
 */
export const changeReceptionistPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'RECEPTIONIST') {
      res.status(403).json({ success: false, message: 'Access denied: receptionist role required' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
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

    const passwordChangedAt = new Date();
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        passwordChangedAt,
      },
      include: { receptionistProfile: true },
    });
    // Sign out every older session that used the previous password
    markPasswordChanged(updatedUser.id, passwordChangedAt);

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

    let formattedPhone: string | null = null;
    if (phone && String(phone).trim() !== '') {
      if (!isValidIndianPhone(String(phone))) {
        res.status(400).json({
          success: false,
          message: 'Invalid phone number. Please enter a valid 10-digit Indian mobile number (+91).',
        });
        return;
      }
      formattedPhone = formatIndianPhone(String(phone));
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({
      where: {
        email_role: {
          email: cleanEmail,
          role: 'RECEPTIONIST',
        },
      },
    });

    let existingRecProfile: any = (existingUser as any)?.receptionistProfile || null;
    if (existingUser && !existingRecProfile && typeof (prisma.receptionistProfile as any)?.findUnique === 'function') {
      existingRecProfile = await prisma.receptionistProfile.findUnique({
        where: { userId: existingUser.id },
      });
    }

    if (existingUser && existingRecProfile?.status !== 'REJECTED') {
      res.status(409).json({ success: false, message: 'A receptionist account with this email already exists' });
      return;
    }

    // Note: Mobile number uniqueness is disabled as per specification (uniqueness strictly on email).
    if (false && formattedPhone) {
      const existingByPhone = await findExistingAccountByPhone(prisma, formattedPhone, {
        role: 'RECEPTIONIST',
        excludeUserId: existingUser?.id,
      });
      if (existingByPhone) {
        res.status(409).json({
          success: false,
          message: 'A receptionist account with this mobile number already exists.',
        });
        return;
      }
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { id: String(clinicId) },
    });

    const clinicCheck = isClinicActive(clinic);
    if (!clinicCheck.active || !clinic) {
      res.status(400).json({ success: false, message: clinicCheck.reason || 'Selected clinic is invalid or not verified' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const runApply = async (db: any) => {
      if (existingUser) {
        const updatedUser = await db.user.update({
          where: { id: existingUser.id },
          data: {
            fullName: String(fullName).trim(),
            passwordHash: hashedPassword,
            phone: formattedPhone,
            isEmailVerified: false,
            mustChangePassword: false,
            passwordChangedAt: new Date(),
          },
        });
        markPasswordChanged(updatedUser.id);
        const updatedRec = existingRecProfile
          ? await db.receptionistProfile.update({
              where: { id: existingRecProfile.id },
              data: {
                phone: formattedPhone,
                clinicId: clinic.id,
                status: 'PENDING',
              },
            })
          : await db.receptionistProfile.create({
              data: {
                userId: updatedUser.id,
                phone: formattedPhone,
                clinicId: clinic.id,
                status: 'PENDING',
              },
            });
        return { user: updatedUser, receptionist: updatedRec };
      }

      const createdUser = await db.user.create({
        data: {
          fullName: String(fullName).trim(),
          email: cleanEmail,
          passwordHash: hashedPassword,
          role: 'RECEPTIONIST',
          phone: formattedPhone,
          isEmailVerified: false,
          mustChangePassword: false,
        },
      });

      const createdReceptionist = await db.receptionistProfile.create({
        data: {
          userId: createdUser.id,
          phone: formattedPhone,
          clinicId: clinic.id,
          status: 'PENDING', // Awaiting clinic administrator approval
        },
      });

      return { user: createdUser, receptionist: createdReceptionist };
    };

    const { user, receptionist } =
      typeof (prisma as any).$transaction === 'function'
        ? await prisma.$transaction(async (tx) => runApply(tx))
        : await runApply(prisma);

    createNotification(
      clinic.userId,
      'Receptionist request',
      `${String(fullName).trim()} wants to join your front desk.`,
      'SYSTEM'
    ).catch(() => {});

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
