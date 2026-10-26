import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { Response } from 'express';
import prisma from '../../config/database';
import { findTooLongInBody } from '../../utils/inputLimits';
import { AuthRequest } from '../../middleware/authMiddleware';
import { uploadToR2, deleteFromR2, isR2Configured } from '../../config/r2';
import { isValidDobDate, validateDoctorSlots, timeToMinutes, validateDoctorNumericBounds, cleanWorkingDays, parseDoctorWorkingDays } from '../../utils/scheduleUtils';
import { validateMagicBytes } from '../../middleware/uploadMiddleware';
import { isValidIndianPhone, formatIndianPhone, findExistingAccountByPhone } from '../../utils/phoneUtils';
import { sanitizeClinicalHistoryList, sanitizeUserPayload } from './helpers';

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        patientProfile: true,
        doctorProfile: {
          include: {
            clinics: { include: { clinic: true } },
            receptionists: {
              include: {
                receptionist: {
                  include: {
                    user: { select: { id: true, fullName: true, email: true, phone: true } },
                  },
                },
              },
            },
          },
        },
        clinicProfile: {
          include: {
            doctors: {
              include: {
                doctor: {
                  include: {
                    user: { select: { id: true, fullName: true, email: true, phone: true } },
                  },
                },
              },
            },
          },
        },
        receptionistProfile: {
          include: {
            clinic: true,
            doctors: {
              include: {
                doctor: {
                  include: {
                    user: { select: { id: true, fullName: true, email: true, phone: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const userWithoutPassword = sanitizeUserPayload(user);
    res.json({ success: true, data: userWithoutPassword });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving user profile',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tooLongField = findTooLongInBody(req.body);
    if (tooLongField) {
      res.status(400).json({ success: false, message: tooLongField });
      return;
    }
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { fullName, phone, avatarUrl, ...roleSpecificData } = req.body;

    // Validate avatarUrl: Disallow base64 data URLs in profile updates to prevent Postgres database bloat (Bug 12)
    if (avatarUrl !== undefined && avatarUrl !== null) {
      if (typeof avatarUrl === 'string' && avatarUrl.startsWith('data:image/')) {
        res.status(400).json({
          success: false,
          message: 'Base64 image data URLs are not permitted. Please upload your avatar via the official avatar upload endpoint.',
        });
        return;
      }
    }

    let formattedPhone: string | null | undefined = undefined;
    if (phone !== undefined) {
      if (phone === null || String(phone).trim() === '') {
        res.status(400).json({
          success: false,
          message: 'A valid 10-digit Indian mobile number (+91) is required and cannot be removed.',
        });
        return;
      } else {
        const trimmedPhone = String(phone).trim();
        if (!isValidIndianPhone(trimmedPhone)) {
          res.status(400).json({
            success: false,
            message: 'Invalid Indian phone number. Please enter a valid 10-digit mobile number (+91).',
          });
          return;
        }
        formattedPhone = formatIndianPhone(trimmedPhone);

        // Enforce mobile number uniqueness per portal role
        // Note: Mobile number uniqueness is disabled as per specification (uniqueness strictly on email).
        if (false && req.user) {
          const existingPhoneUser = await findExistingAccountByPhone(prisma, formattedPhone, {
            excludeUserId: req.user?.id,
            role: req.user?.role,
          });
          if (existingPhoneUser) {
            res.status(409).json({
              success: false,
              message: `An account with this mobile number already exists for the ${req.user?.role?.toLowerCase()} portal. Each mobile number can only have one ${req.user?.role?.toLowerCase()} account.`,
            });
            return;
          }
        }
      }
    }

    // Role-specific validation BEFORE any database write (Bug 6: Fix partial-write)
    const safePatientData: any = {};
    const safeDoctorData: any = {};
    const safeClinicData: any = {};

    if (req.user.role === 'PATIENT') {
      const {
        dateOfBirth,
        gender,
        bloodGroup,
        allergies,
        existingConditions,
        chronicConditions,
        pastSurgeries,
        currentMedications,
        emergencyContact,
      } = roleSpecificData;

      if (dateOfBirth !== undefined) {
        if (!dateOfBirth) {
          safePatientData.dateOfBirth = null;
        } else {
          const rawDob = String(dateOfBirth).trim();
          const candidateDob = rawDob.includes('T') ? rawDob.split('T')[0] : rawDob;
          if (!isValidDobDate(candidateDob)) {
            res.status(400).json({
              success: false,
              message: 'Invalid date of birth format. Expected valid calendar date in YYYY-MM-DD format.',
            });
            return;
          }
          safePatientData.dateOfBirth = candidateDob;
        }
      }
      if (gender !== undefined) safePatientData.gender = gender ? String(gender).trim() : null;
      if (bloodGroup !== undefined) safePatientData.bloodGroup = bloodGroup ? String(bloodGroup).trim() : null;
      if (allergies !== undefined) safePatientData.allergies = sanitizeClinicalHistoryList(allergies);

      if (existingConditions !== undefined || chronicConditions !== undefined || pastSurgeries !== undefined) {
        const conditions = sanitizeClinicalHistoryList(existingConditions ?? chronicConditions);
        const surgeries = sanitizeClinicalHistoryList(pastSurgeries);
        let combinedConditions = conditions;
        if (surgeries) {
          combinedConditions = combinedConditions
            ? `${combinedConditions} | Past Surgeries: ${surgeries}`
            : `Past Surgeries: ${surgeries}`;
        }
        safePatientData.existingConditions = combinedConditions;
      }

      if (currentMedications !== undefined) safePatientData.currentMedications = sanitizeClinicalHistoryList(currentMedications);
      if (emergencyContact !== undefined) safePatientData.emergencyContact = emergencyContact ? String(emergencyContact).trim() : null;
    } else if (req.user.role === 'DOCTOR') {
      // Strict allowlist: Prevent doctors from modifying isVerified, verificationStatus, userId, id
      const {
        specialty,
        qualifications,
        experienceYears,
        consultationFee,
        bio,
        clinicAddress,
        checkingStartTime,
        checkingEndTime,
        avgConsultationMinutes,
        maxDailyPatients,
        slots,
      } = roleSpecificData;

      if (specialty !== undefined) safeDoctorData.specialty = String(specialty).trim();
      if (qualifications !== undefined) safeDoctorData.qualifications = String(qualifications).trim();
      const numBounds = validateDoctorNumericBounds({
        experienceYears,
        consultationFee,
        avgConsultationMinutes,
        maxDailyPatients,
      });
      if (!numBounds.valid) {
        res.status(400).json({ success: false, message: numBounds.error });
        return;
      }
      if (experienceYears !== undefined) safeDoctorData.experienceYears = numBounds.sanitized.experienceYears;
      if (consultationFee !== undefined) safeDoctorData.consultationFee = numBounds.sanitized.consultationFee;
      if (bio !== undefined) safeDoctorData.bio = bio ? String(bio).trim() : null;
      if (clinicAddress !== undefined) safeDoctorData.clinicAddress = clinicAddress ? String(clinicAddress).trim() : null;

      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (checkingStartTime !== undefined) {
        const sTime = String(checkingStartTime).trim();
        if (!timeRegex.test(sTime)) {
          res.status(400).json({ success: false, message: 'checkingStartTime must be in 24-hour HH:mm format (e.g. 09:00).' });
          return;
        }
        safeDoctorData.checkingStartTime = sTime;
      }
      if (checkingEndTime !== undefined) {
        const eTime = String(checkingEndTime).trim();
        if (!timeRegex.test(eTime)) {
          res.status(400).json({ success: false, message: 'checkingEndTime must be in 24-hour HH:mm format (e.g. 13:00).' });
          return;
        }
        safeDoctorData.checkingEndTime = eTime;
      }
      if (safeDoctorData.checkingStartTime || safeDoctorData.checkingEndTime) {
        const existingDocTimes = await prisma.doctorProfile.findUnique({
          where: { userId: req.user.id },
          select: { checkingStartTime: true, checkingEndTime: true },
        });
        const effStart = safeDoctorData.checkingStartTime || existingDocTimes?.checkingStartTime;
        const effEnd = safeDoctorData.checkingEndTime || existingDocTimes?.checkingEndTime;
        if (effStart && effEnd && timeToMinutes(effEnd) <= timeToMinutes(effStart)) {
          res.status(400).json({ success: false, message: 'checkingEndTime must be after checkingStartTime.' });
          return;
        }
      }

      if (avgConsultationMinutes !== undefined) safeDoctorData.avgConsultationMinutes = numBounds.sanitized.avgConsultationMinutes;
      if (maxDailyPatients !== undefined) safeDoctorData.maxDailyPatients = numBounds.sanitized.maxDailyPatients;

      if (slots !== undefined) {
        let parsed: any[] = [];
        try {
          parsed = typeof slots === 'string' ? JSON.parse(slots) : slots;
        } catch {
          res.status(400).json({ success: false, message: 'Invalid slots format: JSON parsing failed.' });
          return;
        }
        const validation = validateDoctorSlots(parsed);
        if (!validation.valid) {
          res.status(400).json({ success: false, message: validation.error || 'Invalid schedule slots.' });
          return;
        }

        // Check cross-clinic shift overlaps against active affiliations (ARCH-008)
        const activeDoctorWithAffiliations = await prisma.doctorProfile.findUnique({
          where: { userId: req.user.id },
          include: {
            clinics: {
              where: { status: { in: ['ACTIVE', 'ACCEPTED'] } },
              include: { clinic: true },
            },
          },
        });
        if (activeDoctorWithAffiliations?.clinics && activeDoctorWithAffiliations.clinics.length > 0) {
          const profileWorkingDays = roleSpecificData.workingDays
            ? parseDoctorWorkingDays(roleSpecificData.workingDays)
            : parseDoctorWorkingDays(activeDoctorWithAffiliations?.workingDays);

          for (const aff of activeDoctorWithAffiliations.clinics) {
            if (!aff.slots) continue;
            let affSlots: any[] = [];
            try {
              affSlots = typeof aff.slots === 'string' ? JSON.parse(aff.slots) : aff.slots;
            } catch {
              continue;
            }
            if (!Array.isArray(affSlots)) continue;

            const affWorkingDays = parseDoctorWorkingDays(aff.workingDays);

            for (const sNew of validation.formatted || []) {
              const daysA = (Array.isArray((sNew as any).days) && (sNew as any).days.length > 0)
                ? cleanWorkingDays((sNew as any).days)
                : (Array.isArray((sNew as any).workingDays) && (sNew as any).workingDays.length > 0)
                ? cleanWorkingDays((sNew as any).workingDays)
                : profileWorkingDays;

              const newStart = timeToMinutes(sNew.startTime);
              let newEnd = timeToMinutes(sNew.endTime);
              if (newEnd <= newStart) newEnd += 24 * 60;

              for (const sAff of affSlots) {
                if (!sAff?.startTime || !sAff?.endTime) continue;

                const daysB = (Array.isArray(sAff.days) && sAff.days.length > 0)
                  ? cleanWorkingDays(sAff.days)
                  : (Array.isArray(sAff.workingDays) && sAff.workingDays.length > 0)
                  ? cleanWorkingDays(sAff.workingDays)
                  : affWorkingDays;

                const hasCommonDays = daysA.some((d: string) => daysB.includes(d));
                if (!hasCommonDays) {
                  // No day intersection - doctor sits on different days
                  continue;
                }

                const affStart = timeToMinutes(sAff.startTime);
                let affEnd = timeToMinutes(sAff.endTime);
                if (affEnd <= affStart) affEnd += 24 * 60;

                if (Math.max(newStart, affStart) < Math.min(newEnd, affEnd)) {
                  res.status(400).json({
                    success: false,
                    message: `Configured practice hours (${sNew.startTime}-${sNew.endTime}) overlap with an active shift (${sAff.startTime}-${sAff.endTime}) at ${aff.clinic?.clinicName || 'another affiliated clinic'}. Practitioners cannot practice at multiple clinics simultaneously.`,
                  });
                  return;
                }
              }
            }
          }
        }

        safeDoctorData.slots = JSON.stringify(validation.formatted);
      }
    } else if (req.user.role === 'CLINIC') {
      const { clinicName, address, city, state } = roleSpecificData;
      if (clinicName !== undefined) safeClinicData.clinicName = String(clinicName).trim();
      if (address !== undefined) safeClinicData.address = String(address).trim();
      if (city !== undefined) safeClinicData.city = city ? String(city).trim() : null;
      if (state !== undefined) safeClinicData.state = state ? String(state).trim() : null;
      if (formattedPhone !== undefined) safeClinicData.phone = formattedPhone;
    }

    // Now execute ALL user and profile modifications inside a single atomic transaction (Bug 6)
    const userUpdatePayload: any = {};
    if (fullName) userUpdatePayload.fullName = String(fullName).trim();
    if (formattedPhone !== undefined) userUpdatePayload.phone = formattedPhone;
    if (avatarUrl !== undefined) userUpdatePayload.avatarUrl = avatarUrl;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdatePayload).length > 0) {
        await tx.user.update({
          where: { id: req.user!.id },
          data: userUpdatePayload,
        });
      }

      if (req.user!.role === 'PATIENT') {
        await tx.patientProfile.upsert({
          where: { userId: req.user!.id },
          update: safePatientData,
          create: {
            userId: req.user!.id,
            ...safePatientData,
          },
        });
      } else if (req.user!.role === 'DOCTOR') {
        await tx.doctorProfile.upsert({
          where: { userId: req.user!.id },
          update: safeDoctorData,
          create: {
            userId: req.user!.id,
            specialty: safeDoctorData.specialty || 'General Physician',
            qualifications: safeDoctorData.qualifications || 'MBBS',
            ...safeDoctorData,
          },
        });
      } else if (req.user!.role === 'CLINIC') {
        await tx.clinicProfile.upsert({
          where: { userId: req.user!.id },
          update: safeClinicData,
          create: {
            userId: req.user!.id,
            clinicName: safeClinicData.clinicName || req.user!.fullName,
            address: safeClinicData.address || '',
            city: safeClinicData.city || null,
            state: safeClinicData.state || null,
            phone: formattedPhone || null,
            checkinCode: crypto.randomUUID(),
          },
        });
      }
    });

    // Note: Do not automatically reassign synthetic appointments on profile update without verified phone ownership (Issue 3)

    const refreshedUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        patientProfile: true,
        doctorProfile: { include: { clinics: { include: { clinic: true } } } },
        clinicProfile: true,
      },
    });

    const result = sanitizeUserPayload(refreshedUser);
    res.json({ success: true, message: 'Profile updated successfully', data: result });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

export const uploadAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No avatar image file uploaded' });
      return;
    }

    const mime = (file.mimetype || '').toLowerCase();
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mime)) {
      res.status(400).json({
        success: false,
        message: 'Avatar must be a valid image file (JPEG, PNG, or WebP). PDF documents are not allowed.',
      });
      return;
    }

    if (file.buffer && !validateMagicBytes(file.buffer, mime)) {
      res.status(400).json({
        success: false,
        message: 'Invalid file signature. The uploaded avatar content does not match its declared image format.',
      });
      return;
    }

    const ext = path.extname(file.originalname) || '.jpg';
    const key = `avatars/${req.user.id}-${Date.now()}${ext}`;

    let avatarUrl: string;
    if (isR2Configured() && file.buffer) {
      avatarUrl = await uploadToR2(file.buffer, key, file.mimetype || 'image/jpeg', false);
    } else if (file.buffer) {
      // Save locally to disk under uploads/avatars/ to prevent multi-megabyte base64 text bloat in PostgreSQL column (BUG-18 & BUG-24)
      const filename = `${req.user.id}-${Date.now()}${ext}`;
      const avatarsDir = path.join(__dirname, '../../uploads/avatars');
      if (!fs.existsSync(avatarsDir)) {
        fs.mkdirSync(avatarsDir, { recursive: true });
      }
      const filepath = path.join(avatarsDir, filename);
      await fs.promises.writeFile(filepath, file.buffer);
      avatarUrl = `/uploads/avatars/${filename}`;
    } else {
      avatarUrl = `/uploads/avatars/${(file as any).filename || 'avatar' + ext}`;
    }

    // Clean up previous avatar if it was on R2
    const existingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { avatarUrl: true },
    });
    if (existingUser?.avatarUrl && (existingUser.avatarUrl.includes('.r2.dev') || existingUser.avatarUrl.startsWith('avatars/'))) {
      await deleteFromR2(existingUser.avatarUrl);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl },
      include: {
        patientProfile: true,
        doctorProfile: true,
        clinicProfile: true,
        receptionistProfile: true,
      },
    });

    const userWithoutPassword = sanitizeUserPayload(updatedUser);
    res.json({
      success: true,
      message: 'Avatar photo uploaded and profile updated successfully',
      data: {
        avatarUrl,
        user: userWithoutPassword,
      },
    });
  } catch (error: any) {
    console.error('uploadAvatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload avatar',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};
