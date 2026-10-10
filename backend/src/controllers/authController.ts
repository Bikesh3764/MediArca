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
import { isValidDobDate, validateDoctorSlots, timeToMinutes, validateDoctorNumericBounds } from '../utils/scheduleUtils';
import { validateMagicBytes } from '../middleware/uploadMiddleware';
import { isValidIndianPhone, formatIndianPhone, sanitizeIndianPhone, findExistingAccountByPhone, getPhoneSearchVariants } from '../utils/phoneUtils';
import { sendVerificationOtpEmail } from '../utils/emailService';
import {
  recordFailedVerificationAttempt,
  getVerificationLockout,
  clearVerificationState,
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
    if (cleanEmail.endsWith('@mediarca.local') || cleanEmail.startsWith('walkin.')) {
      res.status(400).json({ success: false, message: 'Reserved domain or prefix cannot be used for registration.' });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { patientProfile: true, doctorProfile: true, clinicProfile: true },
    });

    if (existingUser && existingUser.isEmailVerified) {
      res.status(409).json({
        success: false,
        message: 'An account with this email already exists. Each email address can only be linked to a single account.',
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

    // Enforce strict mobile number uniqueness across all real accounts (Patient, Doctor, Clinic, Receptionist)
    const candidatePhoneToCheck = formattedPhone || existingUser?.phone || null;
    if (candidatePhoneToCheck) {
      const existingPhoneUser = await findExistingAccountByPhone(prisma, candidatePhoneToCheck, {
        excludeUserId: existingUser?.id,
      });
      if (existingPhoneUser) {
        res.status(409).json({
          success: false,
          message: 'An account with this mobile number already exists. Each mobile number can only be linked to a single account.',
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
      const lockout = getVerificationLockout(cleanEmail);
      if (lockout.isLocked) {
        res.status(429).json({
          success: false,
          message: `Too many failed verification attempts. Your account is temporarily locked for ${Math.ceil(lockout.remainingLockoutSeconds / 60)} minutes.`,
          remainingSeconds: lockout.remainingLockoutSeconds,
        });
        return;
      }

      // 2. Enforce OTP resend cooldown on unverified account re-registration (Issue 4)
      const cooldown = checkResendCooldown(cleanEmail);
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

      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          fullName: normalizedRole === 'CLINIC' ? (profileData.clinicName || fullName) : fullName,
          phone: targetPhone,
          role: normalizedRole,
          emailVerificationOtp: otp,
          emailVerificationOtpExpiresAt: otpExpiresAt,
          ...(normalizedRole === 'PATIENT'
            ? {
                patientProfile: {
                  upsert: {
                    update: {},
                    create: {},
                  },
                },
              }
            : normalizedRole === 'DOCTOR'
              ? {
                  doctorProfile: {
                    upsert: {
                      update: {},
                      create: {
                        specialty: profileData.specialty || 'General Physician',
                        qualifications: profileData.qualifications || 'MBBS',
                        isVerified: false,
                        checkingStartTime: '09:00',
                        checkingEndTime: '13:00',
                      },
                    },
                  },
                }
              : normalizedRole === 'CLINIC'
                ? {
                    clinicProfile: {
                      upsert: {
                        update: {},
                        create: {
                          clinicName: profileData.clinicName || fullName,
                          address: profileData.address || profileData.clinicAddress || 'Central Healthcare Clinic',
                          city: profileData.city || null,
                          state: profileData.state || null,
                          phone: targetPhone,
                          checkinCode: crypto.randomInt(100000, 1000000).toString(),
                        },
                      },
                    },
                  }
                : {}),
        },
        include: { patientProfile: true, doctorProfile: true, clinicProfile: true },
      });

      sendVerificationOtpEmail(cleanEmail, otp, fullName).catch((mailErr) => {
        console.error('Async OTP email dispatch failed on unverified re-registration:', mailErr);
      });

      // Record OTP send timestamp to enforce 60s cooldown on immediate resends (Issue 4)
      recordResendAttempt(cleanEmail);

      const userWithoutPassword = sanitizeUserPayload(updatedUser);
      res.status(200).json({
        success: true,
        requiresVerification: true,
        email: cleanEmail,
        message: 'Account registered! A 6-digit verification code has been sent to your email.',
        data: {
          requiresVerification: true,
          email: cleanEmail,
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
          fullName,
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
          fullName,
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
          fullName: profileData.clinicName || fullName,
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
              checkinCode: crypto.randomInt(100000, 1000000).toString(),
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
    recordResendAttempt(cleanEmail);

    const userWithoutPassword = sanitizeUserPayload(newUser);
    res.status(201).json({
      success: true,
      requiresVerification: true,
      email: cleanEmail,
      message: 'Account registered! A 6-digit verification code has been sent to your email.',
      data: {
        requiresVerification: true,
        email: cleanEmail,
        user: userWithoutPassword,
        ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
      },
    });
  } catch (error: any) {
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
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string' || !email.trim()) {
      res.status(400).json({ success: false, message: 'Email and password are required and must be valid strings.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
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

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    if (!user.isEmailVerified) {
      const cleanEmail = user.email.toLowerCase().trim();
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
          message: `Your email address is not verified yet. A verification code was recently sent. Please check your inbox or wait ${cooldown.remainingSeconds}s before requesting a new code.`,
          data: {
            requiresVerification: true,
            email: user.email,
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
        message: 'Your email address is not verified yet. A fresh 6-digit verification code has been sent to your email.',
        data: {
          requiresVerification: true,
          email: user.email,
        },
      });
      return;
    }

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
    const { email, otp } = req.body;
    if (!email || !otp) {
      res.status(400).json({ success: false, message: 'Email and 6-digit verification code are required' });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanOtp = String(otp).trim();

    // 1. Account-level brute-force lockout check (FIX-005)
    const lockout = getVerificationLockout(cleanEmail);
    if (lockout.isLocked) {
      res.status(429).json({
        success: false,
        message: `Too many failed attempts. Your account is temporarily locked for ${Math.ceil(lockout.remainingLockoutSeconds / 60)} minutes. Please try again later or request a new code after the lockout expires.`,
        remainingSeconds: lockout.remainingLockoutSeconds,
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: {
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
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'Account not found with this email' });
      return;
    }

    if (user.isEmailVerified) {
      // User is already verified: reject OTP verification and require standard password login (Prevent A-01 Account Takeover)
      clearVerificationState(cleanEmail);
      res.status(400).json({
        success: false,
        message: 'This email is already verified. Please sign in directly with your password.',
        isAlreadyVerified: true,
      });
      return;
    }

    if (!user.emailVerificationOtp || user.emailVerificationOtp !== cleanOtp) {
      const attemptResult = recordFailedVerificationAttempt(cleanEmail);
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
    if (user.phone) {
      const existingVerifiedOwner = await findExistingAccountByPhone(prisma, user.phone, {
        excludeUserId: user.id,
      });
      if (existingVerifiedOwner) {
        res.status(409).json({
          success: false,
          message: 'An account with this mobile number already exists. Each mobile number can only be linked to a single account.',
        });
        return;
      }

      const phoneVariants = getPhoneSearchVariants(user.phone);
      if (phoneVariants.length > 0 && typeof prisma.user?.updateMany === 'function') {
        await prisma.user.updateMany({
          where: {
            id: { not: user.id },
            isEmailVerified: false,
            phone: { in: phoneVariants },
          },
          data: { phone: null },
        });
      }
    }

    // Mark as verified and clear OTP & verification attempt state (FIX-005)
    clearVerificationState(cleanEmail);
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationOtp: null,
        emailVerificationOtpExpiresAt: null,
      },
      include: {
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
      },
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
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'Email address is required' });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();

    // 1. Account lockout check: reject resend if account is locked out from failed verification attempts (FIX-005)
    const lockout = getVerificationLockout(cleanEmail);
    if (lockout.isLocked) {
      res.status(429).json({
        success: false,
        message: `Account is temporarily locked due to multiple failed verification attempts. Please wait ${Math.ceil(lockout.remainingLockoutSeconds / 60)} minutes before requesting a new code.`,
        remainingSeconds: lockout.remainingLockoutSeconds,
      });
      return;
    }

    // 2. Resend cooldown check: 60-second delay between resend attempts (FIX-005)
    const cooldown = checkResendCooldown(cleanEmail, 60);
    if (!cooldown.allowed) {
      res.status(429).json({
        success: false,
        message: `Please wait ${cooldown.remainingSeconds} seconds before requesting a new verification code.`,
        remainingSeconds: cooldown.remainingSeconds,
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'Account not found with this email' });
      return;
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

    // Record resend timestamp for cooldown tracking (FIX-005)
    recordResendAttempt(cleanEmail);

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

        // Enforce strict mobile number uniqueness across accounts
        const existingPhoneUser = await findExistingAccountByPhone(prisma, formattedPhone, {
          excludeUserId: req.user.id,
        });
        if (existingPhoneUser) {
          res.status(409).json({
            success: false,
            message: 'An account with this mobile number already exists. Each mobile number can only be linked to a single account.',
          });
          return;
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
      // Strict allowlist: Prevent doctors from modifying isVerified, verificationStatus, rating, totalReviews, userId, id
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
      if (safeDoctorData.checkingStartTime && safeDoctorData.checkingEndTime) {
        if (timeToMinutes(safeDoctorData.checkingEndTime) <= timeToMinutes(safeDoctorData.checkingStartTime)) {
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
            checkinCode: crypto.randomInt(100000, 1000000).toString(),
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
    const { credential, role = 'PATIENT' } = req.body;
    if (!credential) {
      res.status(400).json({ success: false, message: 'Google credential token is required' });
      return;
    }

    let payload: any = null;
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const isConfigured = Boolean(googleClientId && googleClientId !== 'your-google-client-id');

    if (isConfigured) {
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
    } else {
      if (process.env.NODE_ENV === 'production') {
        res.status(500).json({
          success: false,
          message: 'Google Sign-In is not configured on this server. GOOGLE_CLIENT_ID required.',
        });
        return;
      }
      try {
        payload = jwt.decode(credential);
      } catch {
        payload = null;
      }
    }

    if (!payload || !payload.email) {
      res.status(401).json({ success: false, message: 'Unable to verify Google credential email' });
      return;
    }

    if (isConfigured && payload.email_verified !== true) {
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
      where: { email },
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
                checkinCode: crypto.randomInt(100000, 1000000).toString(),
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
            checkinCode: crypto.randomInt(100000, 1000000).toString(),
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


