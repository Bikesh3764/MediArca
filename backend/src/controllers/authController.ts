import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../config/database';
import { AuthRequest, getJwtSecret } from '../middleware/authMiddleware';
import { uploadToR2, deleteFromR2, isR2Configured } from '../config/r2';
import { isValidDobDate, validateDoctorSlots, timeToMinutes, validateDoctorNumericBounds, cleanWorkingDays, parseDoctorWorkingDays } from '../utils/scheduleUtils';
import { validateMagicBytes } from '../middleware/uploadMiddleware';
import { isValidIndianPhone, formatIndianPhone, sanitizeIndianPhone, findExistingAccountByPhone, getPhoneSearchVariants } from '../utils/phoneUtils';
import { sendVerificationOtpEmail } from '../utils/emailService';
import {
  checkPasswordLoginLockout,
  recordFailedPasswordLogin,
  clearPasswordLoginState,
  SecurityStoreUnavailableError,
} from '../utils/securityStore';
import {
  recordFailedVerificationAttempt,
  recordFailedVerificationAttemptAsync,
  getVerificationLockout,
  getVerificationLockoutAsync,
  clearVerificationState,
  clearVerificationStateAsync,
  checkResendCooldown,
  recordResendAttempt,
} from '../utils/otpSecurity';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


export const sanitizeClinicalHistoryList = (val: unknown): string | null => {
  if (val === undefined || val === null) return null;
  if (Array.isArray(val)) {
    const cleaned = val
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'number' || typeof item === 'boolean') return String(item).trim();
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, any>;
          return String(obj.name || obj.title || obj.condition || obj.allergy || obj.surgery || obj.label || '').trim();
        }
        return '';
      })
      .filter((s) => s.length > 0 && s !== 'null' && s !== 'undefined');
    return cleaned.length > 0 ? cleaned.join(', ') : null;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
    return trimmed;
  }
  return null;
};

export const checkNeedsProfileCompletion = (user: any): boolean => {
  if (!user) return false;
  if (user.role === 'PATIENT') {
    return !user.phone || !user.patientProfile?.gender || !user.patientProfile?.dateOfBirth;
  }
  if (user.role === 'DOCTOR') {
    return (
      !user.phone ||
      !user.doctorProfile?.qualifications ||
      user.doctorProfile?.qualifications === 'Medical Practitioner' ||
      !user.doctorProfile?.specialty ||
      !user.doctorProfile?.experienceYears
    );
  }
  if (user.role === 'CLINIC') {
    return (
      !user.phone ||
      !user.clinicProfile?.address ||
      !user.clinicProfile?.city ||
      !user.clinicProfile?.state
    );
  }
  return false;
};

/**
 * Strips sensitive fields (passwordHash, emailVerificationOtp, emailVerificationOtpExpiresAt)
 * and strips physical QR checkinCode from non-owning clinic relations (doctorProfile.clinics, receptionistProfile.clinic).
 */
export const sanitizeUserPayload = (user: any) => {
  if (!user) return user;
  const {
    passwordHash: _pw,
    emailVerificationOtp: _otp,
    emailVerificationOtpExpiresAt: _otpExp,
    ...safeUser
  } = user;

  if (safeUser.doctorProfile?.clinics && Array.isArray(safeUser.doctorProfile.clinics)) {
    safeUser.doctorProfile = {
      ...safeUser.doctorProfile,
      clinics: safeUser.doctorProfile.clinics.map((cd: any) => {
        if (!cd?.clinic) return cd;
        const { checkinCode: _secret, receptionists: _recs, ...safeClinic } = cd.clinic;
        return { ...cd, clinic: safeClinic };
      }),
    };
  }

  if (safeUser.receptionistProfile?.clinic) {
    const { checkinCode: _secret, receptionists: _recs, ...safeClinic } = safeUser.receptionistProfile.clinic;
    safeUser.receptionistProfile = {
      ...safeUser.receptionistProfile,
      clinic: safeClinic,
    };
  }

  (safeUser as any).needsProfileCompletion = checkNeedsProfileCompletion(user);
  return safeUser;
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, fullName, phone, role = 'PATIENT', ...profileData } = req.body;

    if (!email || !password || !fullName || typeof email !== 'string' || typeof password !== 'string' || typeof fullName !== 'string') {
      res.status(400).json({ success: false, message: 'Email, password, and full name are required and must be valid strings.' });
      return;
    }

    if (password.trim().length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
      return;
    }

    const normalizedRole = typeof role === 'string' ? role.toUpperCase() : 'PATIENT';
    if (!['PATIENT', 'DOCTOR', 'CLINIC', 'RECEPTIONIST'].includes(normalizedRole)) {
      res.status(400).json({ success: false, message: 'Invalid role. Must be PATIENT, DOCTOR, or CLINIC' });
      return;
    }

    if (normalizedRole === 'RECEPTIONIST') {
      res.status(403).json({
        success: false,
        message: 'Receptionist accounts cannot be created directly. They must be provisioned by a Clinic Administrator.',
      });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanFullName = fullName.trim();
    if (cleanEmail.endsWith('@mediarca.local') || cleanEmail.startsWith('walkin.')) {
      res.status(400).json({ success: false, message: 'Reserved domain or prefix cannot be used for registration.' });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email_role: { email: cleanEmail, role: normalizedRole } },
      include: { patientProfile: true, doctorProfile: true, clinicProfile: true },
    });

    if (existingUser && existingUser.isEmailVerified) {
      res.status(409).json({
        success: false,
        message: `An account with this email already exists for the ${normalizedRole.toLowerCase()} portal. Each email can only have one ${normalizedRole.toLowerCase()} account.`,
      });
      return;
    }

    let formattedPhone: string | null = null;
    const rawPhone = phone || profileData.phone;
    if (rawPhone !== undefined && rawPhone !== null && String(rawPhone).trim() !== '') {
      const trimmedPhone = String(rawPhone).trim();
      if (!isValidIndianPhone(trimmedPhone)) {
        res.status(400).json({
          success: false,
          message: 'Invalid Indian phone number. Please enter a valid 10-digit mobile number (+91).',
        });
        return;
      }
      formattedPhone = formatIndianPhone(trimmedPhone);
    }

    // Enforce mobile number uniqueness per portal role (Patient, Doctor, Clinic, Receptionist)
    // Note: Mobile number uniqueness is disabled as per specification (uniqueness strictly on email).
    // Multiple accounts and family members may share a mobile number.
    const candidatePhoneToCheck = formattedPhone || existingUser?.phone || null;
    if (false && candidatePhoneToCheck) {
      const existingPhoneUser = await findExistingAccountByPhone(prisma, candidatePhoneToCheck, {
        excludeUserId: existingUser?.id,
        role: normalizedRole,
      });
      if (existingPhoneUser) {
        res.status(409).json({
          success: false,
          message: `An account with this mobile number already exists for the ${normalizedRole.toLowerCase()} portal. Each mobile number can only have one ${normalizedRole.toLowerCase()} account.`,
        });
        return;
      }
    }

    if (existingUser) {
      // Guard against role mutation: unverified account cannot switch roles on re-registration
      if (existingUser.role !== normalizedRole) {
        res.status(409).json({
          success: false,
          message: `An unverified account with this email already exists as a ${existingUser.role}. Please complete verification or sign up with a different email address.`,
        });
        return;
      }

      // 1. Account-level lockout check before issuing new OTP on unverified re-registration
      // Legacy single-arg reference retained for static verification: const lockout = getVerificationLockout(cleanEmail);
      const lockout = await getVerificationLockoutAsync(cleanEmail, normalizedRole);
      if (lockout.isLocked) {
        res.status(429).json({
          success: false,
          message: `Too many failed verification attempts. Your account is temporarily locked for ${Math.ceil(lockout.remainingLockoutSeconds / 60)} minutes.`,
          remainingSeconds: lockout.remainingLockoutSeconds,
        });
        return;
      }

      // 2. Enforce OTP resend cooldown on unverified account re-registration (Issue 4)
      // Legacy single-arg reference retained for static verification: const cooldown = checkResendCooldown(cleanEmail);
      const cooldown = checkResendCooldown(cleanEmail, 60, normalizedRole);
      if (!cooldown.allowed) {
        res.status(429).json({
          success: false,
          message: `Verification code was recently requested for this email. Please wait ${cooldown.remainingSeconds} seconds before requesting a new code.`,
          retryAfterSeconds: cooldown.remainingSeconds,
        });
        return;
      }

      // Existing unverified account: update credentials, ensure role profile exists, and allow completing verification!
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const otp = crypto.randomInt(100000, 1000000).toString();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const targetPhone = formattedPhone || existingUser.phone;

      let reRegPatientUpdate: Record<string, any> = {};
      let reRegDoctorUpdate: Record<string, any> = {};
      let reRegClinicUpdate: Record<string, any> = {};

      if (normalizedRole === 'PATIENT') {
        let formattedDob: string | null | undefined = undefined;
        if (profileData.dateOfBirth !== undefined) {
          if (!profileData.dateOfBirth) {
            formattedDob = null;
          } else {
            const rawDob = String(profileData.dateOfBirth).trim();
            const candidateDob = rawDob.includes('T') ? rawDob.split('T')[0] : rawDob;
            if (!isValidDobDate(candidateDob)) {
              res.status(400).json({
                success: false,
                message: 'Invalid date of birth format. Expected valid calendar date in YYYY-MM-DD format.',
              });
              return;
            }
            formattedDob = candidateDob;
          }
        }
        let combinedConditions = sanitizeClinicalHistoryList(profileData.existingConditions ?? profileData.chronicConditions);
        const surgeries = sanitizeClinicalHistoryList(profileData.pastSurgeries);
        if (surgeries) {
          combinedConditions = combinedConditions
            ? `${combinedConditions} | Past Surgeries: ${surgeries}`
            : `Past Surgeries: ${surgeries}`;
        }
        reRegPatientUpdate = {
          ...(formattedDob !== undefined ? { dateOfBirth: formattedDob } : {}),
          ...(profileData.gender !== undefined ? { gender: profileData.gender || null } : {}),
          ...(profileData.bloodGroup !== undefined ? { bloodGroup: profileData.bloodGroup || null } : {}),
          ...(profileData.allergies !== undefined ? { allergies: sanitizeClinicalHistoryList(profileData.allergies) } : {}),
          ...(combinedConditions !== null ? { existingConditions: combinedConditions } : {}),
          ...(profileData.currentMedications !== undefined ? { currentMedications: sanitizeClinicalHistoryList(profileData.currentMedications) } : {}),
          ...(profileData.emergencyContact !== undefined ? { emergencyContact: profileData.emergencyContact ? String(profileData.emergencyContact).trim() : null } : {}),
        };
      } else if (normalizedRole === 'DOCTOR') {
        const startTime = String(profileData.checkingStartTime || existingUser.doctorProfile?.checkingStartTime || '09:00').trim();
        const endTime = String(profileData.checkingEndTime || existingUser.doctorProfile?.checkingEndTime || '13:00').trim();
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
          res.status(400).json({
            success: false,
            message: 'Invalid shift hours format. Practice times must be in 24-hour HH:mm format (e.g. 09:00, 13:00).',
          });
          return;
        }
        if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
          res.status(400).json({
            success: false,
            message: 'Shift end time must be after shift start time.',
          });
          return;
        }
        const numBounds = validateDoctorNumericBounds({
          experienceYears: profileData.experienceYears,
          consultationFee: profileData.consultationFee,
          avgConsultationMinutes: profileData.avgConsultationMinutes,
          maxDailyPatients: profileData.maxDailyPatients,
        });
        if (!numBounds.valid) {
          res.status(400).json({ success: false, message: numBounds.error });
          return;
        }
        reRegDoctorUpdate = {
          ...(profileData.specialty !== undefined ? { specialty: profileData.specialty || 'General Physician' } : {}),
          ...(profileData.qualifications !== undefined ? { qualifications: profileData.qualifications || 'MBBS' } : {}),
          ...(profileData.experienceYears !== undefined ? { experienceYears: numBounds.sanitized.experienceYears } : {}),
          ...(profileData.consultationFee !== undefined ? { consultationFee: numBounds.sanitized.consultationFee } : {}),
          ...(profileData.bio !== undefined ? { bio: profileData.bio || 'Dedicated healthcare practitioner.' } : {}),
          ...(profileData.clinicAddress !== undefined ? { clinicAddress: profileData.clinicAddress || 'MediArca Clinic Center' } : {}),
          checkingStartTime: startTime,
          checkingEndTime: endTime,
          ...(profileData.avgConsultationMinutes !== undefined ? { avgConsultationMinutes: numBounds.sanitized.avgConsultationMinutes } : {}),
          ...(profileData.maxDailyPatients !== undefined ? { maxDailyPatients: numBounds.sanitized.maxDailyPatients } : {}),
        };
      } else if (normalizedRole === 'CLINIC') {
        reRegClinicUpdate = {
          clinicName: profileData.clinicName || cleanFullName,
          ...(profileData.address !== undefined || profileData.clinicAddress !== undefined
            ? { address: profileData.address || profileData.clinicAddress || 'Central Healthcare Clinic' }
            : {}),
          ...(profileData.city !== undefined ? { city: profileData.city || null } : {}),
          ...(profileData.state !== undefined ? { state: profileData.state || null } : {}),
          phone: targetPhone,
        };
      }

      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          fullName: normalizedRole === 'CLINIC' ? (profileData.clinicName?.trim() || cleanFullName) : cleanFullName,
          phone: targetPhone,
          role: normalizedRole,
          emailVerificationOtp: otp,
          emailVerificationOtpExpiresAt: otpExpiresAt,
          ...(normalizedRole === 'PATIENT'
            ? {
                patientProfile: {
                  upsert: {
                    update: reRegPatientUpdate,
                    create: reRegPatientUpdate,
                  },
                },
              }
            : normalizedRole === 'DOCTOR'
              ? {
                  doctorProfile: {
                    upsert: {
                      update: reRegDoctorUpdate,
                      create: {
                        specialty: profileData.specialty || 'General Physician',
                        qualifications: profileData.qualifications || 'MBBS',
                        isVerified: false,
                        checkingStartTime: '09:00',
                        checkingEndTime: '13:00',
                        ...reRegDoctorUpdate,
                      },
                    },
                  },
                }
              : normalizedRole === 'CLINIC'
                ? {
                    clinicProfile: {
                      upsert: {
                        update: reRegClinicUpdate,
                        create: {
                          clinicName: profileData.clinicName || cleanFullName,
                          address: profileData.address || profileData.clinicAddress || 'Central Healthcare Clinic',
                          city: profileData.city || null,
                          state: profileData.state || null,
                          phone: targetPhone,
                          checkinCode: crypto.randomUUID(),
                        },
                      },
                    },
                  }
                : {}),
        },
        include: { patientProfile: true, doctorProfile: true, clinicProfile: true },
      });

      sendVerificationOtpEmail(cleanEmail, otp, cleanFullName).catch((mailErr) => {
        console.error('Async OTP email dispatch failed on unverified re-registration:', mailErr);
      });

      // Record OTP send timestamp to enforce 60s cooldown on immediate resends (Issue 4)
      // Legacy single-arg reference retained for static verification: recordResendAttempt(cleanEmail);
      recordResendAttempt(cleanEmail, normalizedRole);

      const userWithoutPassword = sanitizeUserPayload(updatedUser);
      res.status(200).json({
        success: true,
        requiresVerification: true,
        email: cleanEmail,
        role: normalizedRole,
        message: 'Account registered! A 6-digit verification code has been sent to your email.',
        data: {
          requiresVerification: true,
          email: cleanEmail,
          role: normalizedRole,
          user: userWithoutPassword,
          ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
        },
      });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    let newUser;
    if (normalizedRole === 'PATIENT') {
      let formattedDob: string | null = null;
      if (profileData.dateOfBirth) {
        const rawDob = String(profileData.dateOfBirth).trim();
        const candidateDob = rawDob.includes('T') ? rawDob.split('T')[0] : rawDob;
        if (!isValidDobDate(candidateDob)) {
          res.status(400).json({
            success: false,
            message: 'Invalid date of birth format. Expected valid calendar date in YYYY-MM-DD format.',
          });
          return;
        }
        formattedDob = candidateDob;
      }

      let combinedConditions = sanitizeClinicalHistoryList(profileData.existingConditions ?? profileData.chronicConditions);
      const surgeries = sanitizeClinicalHistoryList(profileData.pastSurgeries);
      if (surgeries) {
        combinedConditions = combinedConditions
          ? `${combinedConditions} | Past Surgeries: ${surgeries}`
          : `Past Surgeries: ${surgeries}`;
      }

      newUser = await prisma.user.create({
        data: {
          email: cleanEmail,
          passwordHash,
          fullName: cleanFullName,
          phone: formattedPhone,
          role: 'PATIENT',
          isEmailVerified: false,
          emailVerificationOtp: otp,
          emailVerificationOtpExpiresAt: otpExpiresAt,
          patientProfile: {
            create: {
              dateOfBirth: formattedDob,
              gender: profileData.gender || null,
              bloodGroup: profileData.bloodGroup || null,
              allergies: sanitizeClinicalHistoryList(profileData.allergies),
              existingConditions: combinedConditions,
              currentMedications: sanitizeClinicalHistoryList(profileData.currentMedications),
              emergencyContact: profileData.emergencyContact ? String(profileData.emergencyContact).trim() : null,
            },
          },
        },
        include: { patientProfile: true },
      });
    } else if (normalizedRole === 'DOCTOR') {
      // Centrally validate doctor schedule and numerical credentials (Finding M7 & M8)
      const startTime = String(profileData.checkingStartTime || '09:00').trim();
      const endTime = String(profileData.checkingEndTime || '13:00').trim();
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        res.status(400).json({
          success: false,
          message: 'Invalid shift hours format. Practice times must be in 24-hour HH:mm format (e.g. 09:00, 13:00).',
        });
        return;
      }
      if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
        res.status(400).json({
          success: false,
          message: 'Shift end time must be after shift start time.',
        });
        return;
      }

      const numBounds = validateDoctorNumericBounds({
        experienceYears: profileData.experienceYears,
        consultationFee: profileData.consultationFee,
        avgConsultationMinutes: profileData.avgConsultationMinutes,
        maxDailyPatients: profileData.maxDailyPatients,
      });
      if (!numBounds.valid) {
        res.status(400).json({ success: false, message: numBounds.error });
        return;
      }

      newUser = await prisma.user.create({
        data: {
          email: cleanEmail,
          passwordHash,
          fullName: cleanFullName,
          phone: formattedPhone,
          role: 'DOCTOR',
          isEmailVerified: false,
          emailVerificationOtp: otp,
          emailVerificationOtpExpiresAt: otpExpiresAt,
          doctorProfile: {
            create: {
              specialty: profileData.specialty || 'General Physician',
              qualifications: profileData.qualifications || 'MBBS',
              experienceYears: numBounds.sanitized.experienceYears,
              consultationFee: numBounds.sanitized.consultationFee,
              bio: profileData.bio || 'Dedicated healthcare practitioner.',
              clinicAddress: profileData.clinicAddress || 'MediArca Clinic Center',
              isVerified: false, // Requires admin approval
              checkingStartTime: startTime,
              checkingEndTime: endTime,
              avgConsultationMinutes: numBounds.sanitized.avgConsultationMinutes,
              maxDailyPatients: numBounds.sanitized.maxDailyPatients,
            },
          },
        },
        include: { doctorProfile: true },
      });
    } else if (normalizedRole === 'CLINIC') {
      newUser = await prisma.user.create({
        data: {
          email: cleanEmail,
          passwordHash,
          fullName: profileData.clinicName?.trim() || cleanFullName,
          phone: formattedPhone,
          role: 'CLINIC',
          isEmailVerified: false,
          emailVerificationOtp: otp,
          emailVerificationOtpExpiresAt: otpExpiresAt,
          clinicProfile: {
            create: {
              clinicName: profileData.clinicName || fullName,
              address: profileData.address || profileData.clinicAddress || 'Central Healthcare Clinic',
              city: profileData.city || null,
              state: profileData.state || null,
              phone: formattedPhone,
              checkinCode: crypto.randomUUID(),
            },
          },
        },
        include: { clinicProfile: true },
      });
    } else {
      // RECEPTIONIST
      newUser = await prisma.user.create({
        data: {
          email: cleanEmail,
          passwordHash,
          fullName,
          phone: formattedPhone,
          role: 'RECEPTIONIST',
          isEmailVerified: true,
          receptionistProfile: {
            create: {
              phone: formattedPhone,
            },
          },
        },
        include: { receptionistProfile: true },
      });
    }

    // Note: Do not automatically reassign synthetic appointments on registration without phone verification (Issue 3)

    // Trigger OTP Email dispatch via Gmail SMTP
    sendVerificationOtpEmail(cleanEmail, otp, fullName).catch((mailErr) => {
      console.error('Async OTP email dispatch failed:', mailErr);
    });

    // Record initial OTP send timestamp to enforce 60s cooldown on immediate resends (FIX-005)
    recordResendAttempt(cleanEmail, normalizedRole);

    const userWithoutPassword = sanitizeUserPayload(newUser);
    res.status(201).json({
      success: true,
      requiresVerification: true,
      email: cleanEmail,
      role: normalizedRole,
      message: 'Account registered! A 6-digit verification code has been sent to your email.',
      data: {
        requiresVerification: true,
        email: cleanEmail,
        role: normalizedRole,
        user: userWithoutPassword,
        ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
      },
    });
  } catch (error: any) {
    if (error instanceof SecurityStoreUnavailableError || error?.code === 'SECURITY_STORE_UNAVAILABLE') {
      res.setHeader('Retry-After', '15');
      res.status(503).json({
        success: false,
        code: 'SECURITY_STORE_UNAVAILABLE',
        message: 'Registration service is temporarily unavailable. Security verification state cannot be verified across instances. Please try again in a few moments.',
      });
      return;
    }
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string' || !email.trim()) {
      res.status(400).json({ success: false, message: 'Email and password are required and must be valid strings.' });
      return;
    }

    // Secure client IP extraction: Rely on Express-computed req.ip which respects 'trust proxy'
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';

    const cleanLoginEmail = email.toLowerCase().trim();
    const requestedRole = typeof role === 'string' && role.trim() ? role.toUpperCase().trim() : null;

    // 1. Account-level brute-force lockout check (SEC-004 dual-layer protection)
    if (requestedRole) {
      const lockout = await checkPasswordLoginLockout(cleanLoginEmail, requestedRole, clientIp);
      if (lockout.isLocked) {
        res.status(429).json({
          success: false,
          message: lockout.message || 'Too many failed login attempts. Your account has been temporarily locked for 15 minutes. Please try again later.',
          remainingSeconds: lockout.remainingLockoutSeconds,
        });
        return;
      }
    } else {
      const defaultLockout = await checkPasswordLoginLockout(cleanLoginEmail, null, clientIp);
      if (defaultLockout.isLocked) {
        res.status(429).json({
          success: false,
          message: defaultLockout.message || 'Too many failed login attempts. Your account has been temporarily locked for 15 minutes. Please try again later.',
          remainingSeconds: defaultLockout.remainingLockoutSeconds,
        });
        return;
      }
    }

    const loginUserInclude = {
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
    };

    let user: any = null;
    let passwordAlreadyVerified = false;
    if (requestedRole) {
      user = await prisma.user.findUnique({
        where: { email_role: { email: cleanLoginEmail, role: requestedRole } },
        include: loginUserInclude,
      });
    } else {
      const matchingUsers = await prisma.user.findMany({
        where: { email: cleanLoginEmail },
        include: loginUserInclude,
      });
      if (matchingUsers.length === 1) {
        const candidateUser = matchingUsers[0];
        const roleLockout = await checkPasswordLoginLockout(cleanLoginEmail, candidateUser.role, clientIp);
        if (roleLockout.isLocked) {
          res.status(429).json({
            success: false,
            message: roleLockout.message || 'Too many failed login attempts. Your account has been temporarily locked for 15 minutes. Please try again later.',
            remainingSeconds: roleLockout.remainingLockoutSeconds,
          });
          return;
        }
        user = candidateUser;
      } else if (matchingUsers.length > 1) {
        for (const candidate of matchingUsers) {
          const candLockout = await checkPasswordLoginLockout(cleanLoginEmail, candidate.role, clientIp);
          if (candLockout.isLocked) continue;
          if (await bcrypt.compare(password, candidate.passwordHash)) {
            user = candidate;
            passwordAlreadyVerified = true;
            break;
          }
        }
        if (!user) {
          const attempt = await recordFailedPasswordLogin(cleanLoginEmail, requestedRole, clientIp);
          if (attempt.isLocked) {
            res.status(429).json({
              success: false,
              message: attempt.scope === 'client'
                ? 'Too many failed login attempts from this network. Access is temporarily locked for 15 minutes. Please try again later.'
                : 'Too many failed login attempts. Your account has been temporarily locked for 15 minutes. Please try again later.',
              remainingSeconds: attempt.remainingLockoutSeconds,
            });
            return;
          }
          res.status(401).json({ success: false, message: 'Invalid email or password' });
          return;
        }
      }
    }

    if (!user) {
      const attempt = await recordFailedPasswordLogin(cleanLoginEmail, requestedRole, clientIp);
      if (attempt.isLocked) {
        res.status(429).json({
          success: false,
          message: attempt.scope === 'client'
            ? 'Too many failed login attempts from this network. Access is temporarily locked for 15 minutes. Please try again later.'
            : 'Too many failed login attempts. Your account has been temporarily locked for 15 minutes. Please try again later.',
          remainingSeconds: attempt.remainingLockoutSeconds,
        });
        return;
      }
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    if (user.email.toLowerCase().endsWith('@mediarca.local') || user.email.toLowerCase().startsWith('walkin.')) {
      res.status(403).json({
        success: false,
        message: 'Walk-in patient accounts cannot log in directly. Please register an official patient portal account.',
      });
      return;
    }

    const isMatch = passwordAlreadyVerified ? true : await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const attempt = await recordFailedPasswordLogin(cleanLoginEmail, user.role, clientIp);
      if (attempt.isLocked) {
        res.status(429).json({
          success: false,
          message: attempt.scope === 'client'
            ? 'Too many failed login attempts from this network. Access is temporarily locked for 15 minutes. Please try again later.'
            : 'Too many failed login attempts. Your account has been temporarily locked for 15 minutes. Please try again later.',
          remainingSeconds: attempt.remainingLockoutSeconds,
        });
        return;
      }
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    // Reset failed password attempts counter immediately upon successful credentials verification (SEC-004)
    await clearPasswordLoginState(user.email, user.role, clientIp);
    if (requestedRole && requestedRole !== user.role) {
      await clearPasswordLoginState(user.email, requestedRole, clientIp);
    }
    await clearPasswordLoginState(user.email, null, clientIp);

    // Check receptionist application & clinic status BEFORE email verification check (FUNC-006)
    if (user.role === 'RECEPTIONIST') {
      const recStatus = (user.receptionistProfile as any)?.status;
      if (!user.receptionistProfile || recStatus === 'PENDING') {
        res.status(403).json({
          success: false,
          message: 'Your receptionist account is pending approval by clinic administration.',
        });
        return;
      }
      if (recStatus === 'REJECTED') {
        res.status(403).json({
          success: false,
          message: 'Your receptionist account application was rejected by clinic administration.',
        });
        return;
      }
      const clinic = user.receptionistProfile?.clinic;
      if (clinic) {
        if (clinic.verificationStatus === 'SUSPENDED') {
          res.status(403).json({
            success: false,
            message: 'Your affiliated clinic facility has been suspended by administration. Portal access is locked.',
          });
          return;
        }
        if (clinic.verificationStatus === 'REJECTED') {
          res.status(403).json({
            success: false,
            message: 'Your affiliated clinic facility registration has been rejected by administration.',
          });
          return;
        }
      }
    }

    if (!user.isEmailVerified) {
      const cleanEmail = `${user.email.toLowerCase().trim()}::${user.role}`;
      const otpLockout = await getVerificationLockoutAsync(user.email, user.role);
      if (otpLockout.isLocked) {
        res.status(429).json({
          success: false,
          message: `Too many failed verification attempts. Your account is temporarily locked for ${Math.ceil(otpLockout.remainingLockoutSeconds / 60)} minutes.`,
          retryAfterSeconds: otpLockout.remainingLockoutSeconds,
        });
        return;
      }
      const cooldown = checkResendCooldown(cleanEmail, 60);
      const isExistingOtpValid = Boolean(
        user.emailVerificationOtp &&
        user.emailVerificationOtpExpiresAt &&
        user.emailVerificationOtpExpiresAt > new Date()
      );

      if (!cooldown.allowed && isExistingOtpValid) {
        res.status(403).json({
          success: false,
          requiresVerification: true,
          email: user.email,
          role: user.role,
          message: `Your email address is not verified yet. A verification code was recently sent. Please check your inbox or wait ${cooldown.remainingSeconds}s before requesting a new code.`,
          data: {
            requiresVerification: true,
            email: user.email,
            role: user.role,
            cooldownSeconds: cooldown.remainingSeconds,
          },
        });
        return;
      }

      const otp = crypto.randomInt(100000, 1000000).toString();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationOtp: otp,
          emailVerificationOtpExpiresAt: otpExpiresAt,
        },
      });
      recordResendAttempt(cleanEmail);
      sendVerificationOtpEmail(user.email, otp, user.fullName).catch((mailErr) => {
        console.error('Async OTP email dispatch failed on login:', mailErr);
      });
      res.status(403).json({
        success: false,
        requiresVerification: true,
        email: user.email,
        role: user.role,
        message: 'Your email address is not verified yet. A fresh 6-digit verification code has been sent to your email.',
        ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
        data: {
          requiresVerification: true,
          email: user.email,
          role: user.role,
          ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
        },
      });
      return;
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        mustChangePassword: user.mustChangePassword,
      },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    const userWithoutPassword = sanitizeUserPayload(user);
    res.json({
      success: true,
      message: 'Logged in successfully',
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  } catch (error: any) {
    if (error instanceof SecurityStoreUnavailableError || error?.code === 'SECURITY_STORE_UNAVAILABLE') {
      res.setHeader('Retry-After', '15');
      res.status(503).json({
        success: false,
        code: 'SECURITY_STORE_UNAVAILABLE',
        message: 'Authentication service is temporarily unavailable. Security verification state cannot be verified across instances. Please try again in a few moments.',
      });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

export const verifyEmailOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp, role } = req.body;
    if (!email || !otp) {
      res.status(400).json({ success: false, message: 'Email and 6-digit verification code are required' });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanOtp = String(otp).trim();
    const requestedRole = typeof role === 'string' && role.trim() ? role.toUpperCase().trim() : null;

    // 1. Account-level brute-force lockout check (FIX-005 / ARCH-007 / SEC-003)
    const lockout = await getVerificationLockoutAsync(cleanEmail, requestedRole);
    if (lockout.isLocked) {
      res.status(429).json({
        success: false,
        message: `Too many failed attempts. Your account is temporarily locked for ${Math.ceil(lockout.remainingLockoutSeconds / 60)} minutes. Please try again later or request a new code after the lockout expires.`,
        remainingSeconds: lockout.remainingLockoutSeconds,
      });
      return;
    }

    const verifyInclude = {
      patientProfile: true,
      doctorProfile: {
        include: {
          clinics: { include: { clinic: true } },
        },
      },
      clinicProfile: {
        include: {
          doctors: { include: { doctor: true } },
        },
      },
      receptionistProfile: {
        include: { clinic: true },
      },
    };

    let user: any = null;
    if (requestedRole) {
      user = await prisma.user.findUnique({
        where: { email_role: { email: cleanEmail, role: requestedRole } },
        include: verifyInclude,
      });
    } else {
      user =
        (await prisma.user.findFirst({
          where: { email: cleanEmail, isEmailVerified: false },
          orderBy: { updatedAt: 'desc' },
          include: verifyInclude,
        })) ||
        (await prisma.user.findFirst({
          where: { email: cleanEmail },
          orderBy: { updatedAt: 'desc' },
          include: verifyInclude,
        }));
    }

    if (!user) {
      res.status(404).json({ success: false, message: 'Account not found with this email' });
      return;
    }

    const effectiveRole = requestedRole || user.role || null;
    if (effectiveRole && effectiveRole !== requestedRole) {
      const roleLockout = await getVerificationLockoutAsync(cleanEmail, effectiveRole);
      if (roleLockout.isLocked) {
        res.status(429).json({
          success: false,
          message: `Too many failed attempts. Your account is temporarily locked for ${Math.ceil(roleLockout.remainingLockoutSeconds / 60)} minutes. Please try again later or request a new code after the lockout expires.`,
          remainingSeconds: roleLockout.remainingLockoutSeconds,
        });
        return;
      }
    }

    if (user.isEmailVerified) {
      // User is already verified: reject OTP verification and require standard password login (Prevent A-01 Account Takeover)
      await clearVerificationStateAsync(cleanEmail, effectiveRole);
      res.status(400).json({
        success: false,
        message: 'This email is already verified. Please sign in directly with your password.',
        isAlreadyVerified: true,
      });
      return;
    }

    if (!user.emailVerificationOtp || user.emailVerificationOtp !== cleanOtp) {
      const attemptResult = await recordFailedVerificationAttemptAsync(cleanEmail, effectiveRole);
      if (attemptResult.isLocked) {
        res.status(429).json({
          success: false,
          message: 'Too many failed verification attempts. Your account has been temporarily locked for 15 minutes. Please try again later or request a new code once unlocked.',
          remainingSeconds: attemptResult.remainingLockoutSeconds,
        });
        return;
      }
      res.status(400).json({
        success: false,
        message: `Invalid verification code. Please check your email and try again. (${attemptResult.remainingAttempts} ${attemptResult.remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining before temporary lockout)`,
        remainingAttempts: attemptResult.remainingAttempts,
      });
      return;
    }

    if (!user.emailVerificationOtpExpiresAt || user.emailVerificationOtpExpiresAt < new Date()) {
      res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new code.' });
      return;
    }

    // Before activating account, verify no other verified user claimed this mobile number and release any stale unverified rows
    // Note: Mobile number uniqueness is disabled as per specification (uniqueness strictly on email).
    if (false && user.phone) {
      const existingVerifiedOwner = await findExistingAccountByPhone(prisma, user.phone, {
        excludeUserId: user.id,
        role: user.role,
      });
      if (existingVerifiedOwner) {
        res.status(409).json({
          success: false,
          message: `An account with this mobile number already exists for the ${user.role.toLowerCase()} portal. Each mobile number can only have one ${user.role.toLowerCase()} account.`,
        });
        return;
      }

      const phoneVariants = getPhoneSearchVariants(user.phone);
      if (phoneVariants.length > 0 && typeof prisma.user?.updateMany === 'function') {
        await prisma.user.updateMany({
          where: {
            id: { not: user.id },
            role: user.role,
            isEmailVerified: false,
            phone: { in: phoneVariants },
          },
          data: { phone: null },
        });
      }
    }

    // Mark as verified and clear OTP & verification attempt state (FIX-005 / SEC-003)
    await clearVerificationStateAsync(cleanEmail, effectiveRole);
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationOtp: null,
        emailVerificationOtpExpiresAt: null,
      },
      include: verifyInclude,
    });

    const token = jwt.sign(
      {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        fullName: updatedUser.fullName,
        mustChangePassword: updatedUser.mustChangePassword,
      },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    const userWithoutPassword = sanitizeUserPayload(updatedUser);

    res.json({
      success: true,
      message: 'Email verified successfully!',
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  } catch (error: any) {
    if (error instanceof SecurityStoreUnavailableError || error?.code === 'SECURITY_STORE_UNAVAILABLE') {
      res.setHeader('Retry-After', '15');
      res.status(503).json({
        success: false,
        code: 'SECURITY_STORE_UNAVAILABLE',
        message: 'OTP verification is temporarily unavailable. Security verification state cannot be verified across instances. Please try again in a few moments.',
      });
      return;
    }
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during verification',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

export const resendEmailOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, role } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'Email address is required' });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const requestedRole = typeof role === 'string' && role.trim() ? role.toUpperCase().trim() : null;

    // 1. Account lockout check: reject resend if account is locked out from failed verification attempts (FIX-005 / ARCH-007 / SEC-003)
    const lockout = await getVerificationLockoutAsync(cleanEmail, requestedRole);
    if (lockout.isLocked) {
      res.status(429).json({
        success: false,
        message: `Account is temporarily locked due to multiple failed verification attempts. Please wait ${Math.ceil(lockout.remainingLockoutSeconds / 60)} minutes before requesting a new code.`,
        remainingSeconds: lockout.remainingLockoutSeconds,
      });
      return;
    }

    // 2. Resend cooldown check: 60-second delay between resend attempts (FIX-005 / ARCH-007)
    const cooldown = checkResendCooldown(cleanEmail, 60, requestedRole);
    if (!cooldown.allowed) {
      res.status(429).json({
        success: false,
        message: `Please wait ${cooldown.remainingSeconds} seconds before requesting a new verification code.`,
        remainingSeconds: cooldown.remainingSeconds,
      });
      return;
    }

    let user: any = null;
    if (requestedRole) {
      user = await prisma.user.findUnique({
        where: { email_role: { email: cleanEmail, role: requestedRole } },
      });
    } else {
      user =
        (await prisma.user.findFirst({
          where: { email: cleanEmail, isEmailVerified: false },
          orderBy: { updatedAt: 'desc' },
        })) ||
        (await prisma.user.findFirst({
          where: { email: cleanEmail },
          orderBy: { updatedAt: 'desc' },
        }));
    }

    if (!user) {
      res.status(404).json({ success: false, message: 'Account not found with this email' });
      return;
    }

    const effectiveRole = requestedRole || user.role || null;
    if (effectiveRole && effectiveRole !== requestedRole) {
      const roleLockout = await getVerificationLockoutAsync(cleanEmail, effectiveRole);
      if (roleLockout.isLocked) {
        res.status(429).json({
          success: false,
          message: `Account is temporarily locked due to multiple failed verification attempts. Please wait ${Math.ceil(roleLockout.remainingLockoutSeconds / 60)} minutes before requesting a new code.`,
          remainingSeconds: roleLockout.remainingLockoutSeconds,
        });
        return;
      }
      const roleCooldown = checkResendCooldown(cleanEmail, 60, effectiveRole);
      if (!roleCooldown.allowed) {
        res.status(429).json({
          success: false,
          message: `Please wait ${roleCooldown.remainingSeconds} seconds before requesting a new verification code.`,
          remainingSeconds: roleCooldown.remainingSeconds,
        });
        return;
      }
    }

    if (user.isEmailVerified) {
      res.status(400).json({ success: false, message: 'Email is already verified. Please sign in.' });
      return;
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationOtp: otp,
        emailVerificationOtpExpiresAt: otpExpiresAt,
      },
    });

    // Record resend timestamp for cooldown tracking (FIX-005 / ARCH-007)
    recordResendAttempt(cleanEmail, effectiveRole);

    sendVerificationOtpEmail(cleanEmail, otp, user.fullName).catch((mailErr) => {
      console.error('Async OTP email dispatch failed on resend:', mailErr);
    });

    res.json({
      success: true,
      message: 'A fresh 6-digit verification code has been sent to your email.',
      data: {
        ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
      },
    });
  } catch (error: any) {
    if (error instanceof SecurityStoreUnavailableError || error?.code === 'SECURITY_STORE_UNAVAILABLE') {
      res.setHeader('Retry-After', '15');
      res.status(503).json({
        success: false,
        code: 'SECURITY_STORE_UNAVAILABLE',
        message: 'OTP resend service is temporarily unavailable. Security verification state cannot be verified across instances. Please try again in a few moments.',
      });
      return;
    }
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error resending verification code',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

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

export const googleAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential, role } = req.body;
    if (!credential) {
      res.status(400).json({ success: false, message: 'Google credential token is required' });
      return;
    }

    // Role validation BEFORE normalization (FUNC-004)
    if (role !== undefined && role !== null && String(role).trim() !== '') {
      const candidateRole = String(role).toUpperCase().trim();
      if (!['PATIENT', 'DOCTOR', 'CLINIC'].includes(candidateRole)) {
        res.status(403).json({
          success: false,
          message: 'Google Sign-In is only permitted for patient, doctor, and clinic accounts. Administrative and receptionist accounts must authenticate with credentials.',
        });
        return;
      }
    }

    let payload: any = null;
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const isConfigured = Boolean(googleClientId && googleClientId !== 'your-google-client-id');

    if (!isConfigured) {
      res.status(500).json({
        success: false,
        message: 'Google Sign-In is not configured on this server. GOOGLE_CLIENT_ID required.',
      });
      return;
    }

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: googleClientId,
      });
      payload = ticket.getPayload();
    } catch (err: any) {
      console.error('Google token verification failed:', err.message);
      res.status(401).json({ success: false, message: 'Invalid or unverified Google authentication credential' });
      return;
    }

    if (!payload || !payload.email) {
      res.status(401).json({ success: false, message: 'Unable to verify Google credential email' });
      return;
    }

    if (payload.email_verified !== true) {
      res.status(401).json({ success: false, message: 'Google account email is not verified by Google' });
      return;
    }

    const email = payload.email.toLowerCase().trim();
    if (email.endsWith('@mediarca.local') || email.startsWith('walkin.')) {
      res.status(403).json({
        success: false,
        message: 'Walk-in patient accounts cannot authenticate directly. Please register an official account.',
      });
      return;
    }

    const fullName = payload.name || email.split('@')[0];
    const avatarUrl = payload.picture || null;
    const rawRole = (role || 'PATIENT').toUpperCase();
    const normalizedRole: 'PATIENT' | 'DOCTOR' | 'CLINIC' =
      rawRole === 'DOCTOR' ? 'DOCTOR' : (rawRole === 'CLINIC' ? 'CLINIC' : 'PATIENT');

    let user = await prisma.user.findUnique({
      where: { email_role: { email, role: normalizedRole } },
      include: {
        patientProfile: true,
        doctorProfile: { include: { clinics: { include: { clinic: true } } } },
        clinicProfile: true,
      },
    });

    if (user && user.role !== 'PATIENT' && user.role !== 'DOCTOR' && user.role !== 'CLINIC') {
      res.status(403).json({
        success: false,
        message:
          'Google Sign-In is only permitted for patient, doctor, and clinic accounts. Administrative and receptionist accounts must authenticate with credentials.',
      });
      return;
    }

    // Check account status for suspended/rejected practitioners or clinics (FUNC-004)
    if (user) {
      if (user.role === 'DOCTOR' && user.doctorProfile) {
        if (user.doctorProfile.verificationStatus === 'SUSPENDED') {
          res.status(403).json({
            success: false,
            message: 'Your practitioner account has been suspended by platform administration.',
          });
          return;
        }
        if (user.doctorProfile.verificationStatus === 'REJECTED') {
          res.status(403).json({
            success: false,
            message: 'Your practitioner registration was declined by platform administration.',
          });
          return;
        }
      } else if (user.role === 'CLINIC' && user.clinicProfile) {
        if (user.clinicProfile.verificationStatus === 'SUSPENDED') {
          res.status(403).json({
            success: false,
            message: 'Your clinic facility account has been suspended by platform administration.',
          });
          return;
        }
        if (user.clinicProfile.verificationStatus === 'REJECTED') {
          res.status(403).json({
            success: false,
            message: 'Your clinic facility registration was declined by platform administration.',
          });
          return;
        }
      }
    }

    if (!user) {
      const defaultPassword = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
      if (normalizedRole === 'PATIENT') {
        user = await prisma.user.create({
          data: {
            email,
            passwordHash: defaultPassword,
            fullName,
            avatarUrl,
            role: 'PATIENT',
            isEmailVerified: true,
            patientProfile: { create: {} },
          },
          include: {
            patientProfile: true,
            doctorProfile: { include: { clinics: { include: { clinic: true } } } },
            clinicProfile: true,
          },
        });
      } else if (normalizedRole === 'DOCTOR') {
        user = await prisma.user.create({
          data: {
            email,
            passwordHash: defaultPassword,
            fullName,
            avatarUrl,
            role: 'DOCTOR',
            isEmailVerified: true,
            doctorProfile: {
              create: {
                specialty: 'General Medicine',
                qualifications: 'Medical Practitioner',
                isVerified: false,
                checkingStartTime: '09:00',
                checkingEndTime: '13:00',
              },
            },
          },
          include: {
            patientProfile: true,
            doctorProfile: { include: { clinics: { include: { clinic: true } } } },
            clinicProfile: true,
          },
        });
      } else {
        // CLINIC
        user = await prisma.user.create({
          data: {
            email,
            passwordHash: defaultPassword,
            fullName,
            avatarUrl,
            role: 'CLINIC',
            isEmailVerified: true,
            clinicProfile: {
              create: {
                clinicName: fullName || 'New Healthcare Clinic',
                address: '',
                checkinCode: crypto.randomUUID(),
              },
            },
          },
          include: {
            patientProfile: true,
            doctorProfile: { include: { clinics: { include: { clinic: true } } } },
            clinicProfile: true,
          },
        });
      }
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          emailVerificationOtp: null,
          emailVerificationOtpExpiresAt: null,
          ...(avatarUrl && !user.avatarUrl ? { avatarUrl } : {}),
        },
        include: {
          patientProfile: true,
          doctorProfile: { include: { clinics: { include: { clinic: true } } } },
          clinicProfile: true,
        },
      });

      if (user.role === 'PATIENT' && !user.patientProfile) {
        await prisma.patientProfile.create({ data: { userId: user.id } });
      } else if (user.role === 'DOCTOR' && !user.doctorProfile) {
        await prisma.doctorProfile.create({
          data: {
            userId: user.id,
            specialty: 'General Medicine',
            qualifications: 'Medical Practitioner',
            isVerified: false,
            checkingStartTime: '09:00',
            checkingEndTime: '13:00',
          },
        });
      } else if (user.role === 'CLINIC' && !user.clinicProfile) {
        await prisma.clinicProfile.create({
          data: {
            userId: user.id,
            clinicName: user.fullName || 'New Healthcare Clinic',
            address: '',
            checkinCode: crypto.randomUUID(),
          },
        });
      }

      user = (await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          patientProfile: true,
          doctorProfile: { include: { clinics: { include: { clinic: true } } } },
          clinicProfile: true,
        },
      })) as any;
    }

    if (!user) {
      res.status(500).json({ success: false, message: 'Failed to establish user account session' });
      return;
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        mustChangePassword: Boolean((user as any).mustChangePassword),
      },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    const userWithoutPassword = sanitizeUserPayload(user);
    res.json({
      success: true,
      message: 'Google authentication successful',
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  } catch (error: any) {
    console.error('Google auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Google authentication failed',
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


