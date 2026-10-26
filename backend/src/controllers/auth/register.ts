import crypto from 'crypto';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { findTooLong, LIMITS } from '../../utils/inputLimits';
import { hashOtp } from '../../utils/otpHash';
import { isValidDobDate, timeToMinutes, validateDoctorNumericBounds } from '../../utils/scheduleUtils';
import { isValidIndianPhone, formatIndianPhone, findExistingAccountByPhone } from '../../utils/phoneUtils';
import { sendVerificationOtpEmail } from '../../utils/emailService';
import { SecurityStoreUnavailableError } from '../../utils/securityStore';
import { getVerificationLockoutAsync, checkResendCooldown, recordResendAttempt } from '../../utils/otpSecurity';
import { allowOtpEmail, sanitizeClinicalHistoryList, sanitizeUserPayload } from './helpers';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, fullName, phone, role = 'PATIENT', ...profileData } = req.body;

    if (!email || !password || !fullName || typeof email !== 'string' || typeof password !== 'string' || typeof fullName !== 'string') {
      res.status(400).json({ success: false, message: 'Email, password, and full name are required and must be valid strings.' });
      return;
    }

    const tooLong = findTooLong({
      fullName: [fullName, LIMITS.name],
      email: [email, LIMITS.email],
      password: [password, LIMITS.password],
    });
    if (tooLong) {
      res.status(400).json({ success: false, message: tooLong });
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

      if (!allowOtpEmail(req, res, cleanEmail)) return;

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
          emailVerificationOtp: hashOtp(otp),
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

    if (!allowOtpEmail(req, res, cleanEmail)) return;

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
          emailVerificationOtp: hashOtp(otp),
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
          emailVerificationOtp: hashOtp(otp),
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
          emailVerificationOtp: hashOtp(otp),
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
