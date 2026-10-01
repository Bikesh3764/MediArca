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
import { isValidIndianPhone, formatIndianPhone, sanitizeIndianPhone } from '../utils/phoneUtils';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Reclaims and reassigns past appointments from synthetic walk-in accounts with matching phone (BUG-12, BUG-17)
 */
export const migrateSyntheticWalkinAppointments = async (userId: string, formattedPhone: string): Promise<number> => {
  try {
    const rawDigits = sanitizeIndianPhone(formattedPhone);
    const plainWithPlus = rawDigits ? `+91${rawDigits}` : null;
    const spacedPhone = rawDigits && rawDigits.length === 10 ? `+91 ${rawDigits.slice(0, 5)} ${rawDigits.slice(5)}` : null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { patientProfile: true },
    });
    if (!user || !user.patientProfile) return 0;

    const syntheticUsers = await prisma.user.findMany({
      where: {
        id: { not: userId },
        OR: [
          { phone: formattedPhone },
          ...(rawDigits ? [{ phone: rawDigits }] : []),
          ...(plainWithPlus ? [{ phone: plainWithPlus }] : []),
          ...(spacedPhone ? [{ phone: spacedPhone }] : []),
        ],
        email: { contains: '@mediarca.local' },
      },
      include: { patientProfile: true },
    });

    let migratedCount = 0;
    for (const synUser of syntheticUsers) {
      if (synUser.patientProfile) {
        const updateResult = await prisma.appointment.updateMany({
          where: { patientId: synUser.patientProfile.id },
          data: { patientId: user.patientProfile.id },
        });
        migratedCount += updateResult.count;
        await prisma.patientProfile.delete({ where: { id: synUser.patientProfile.id } }).catch(() => {});
        await prisma.user.delete({ where: { id: synUser.id } }).catch(() => {});
      }
    }
    return migratedCount;
  } catch (migrationErr) {
    console.error('Failed to migrate synthetic walk-in appointments:', migrationErr);
    return 0;
  }
};

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

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, fullName, phone, role = 'PATIENT', ...profileData } = req.body;

    if (!email || !password || !fullName) {
      res.status(400).json({ success: false, message: 'Email, password, and full name are required' });
      return;
    }

    if (typeof password !== 'string' || password.trim().length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
      return;
    }

    const normalizedRole = role.toUpperCase();
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
    });

    if (existingUser) {
      res.status(400).json({ success: false, message: 'An account with this email already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

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

      newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          fullName,
          phone: formattedPhone,
          role: 'PATIENT',
          patientProfile: {
            create: {
              dateOfBirth: formattedDob,
              gender: profileData.gender || null,
              bloodGroup: profileData.bloodGroup || null,
              allergies: sanitizeClinicalHistoryList(profileData.allergies),
              existingConditions: sanitizeClinicalHistoryList(profileData.existingConditions ?? profileData.chronicConditions),
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
          email: email.toLowerCase().trim(),
          passwordHash,
          fullName,
          phone: formattedPhone,
          role: 'DOCTOR',
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
          email: email.toLowerCase().trim(),
          passwordHash,
          fullName: profileData.clinicName || fullName,
          phone: formattedPhone,
          role: 'CLINIC',
          clinicProfile: {
            create: {
              clinicName: profileData.clinicName || fullName,
              address: profileData.address || profileData.clinicAddress || 'Central Healthcare Clinic',
              city: profileData.city || null,
              state: profileData.state || null,
              phone: formattedPhone,
              checkinCode: crypto.randomBytes(3).toString('hex').toUpperCase(),
            },
          },
        },
        include: { clinicProfile: true },
      });
    } else {
      // RECEPTIONIST
      newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          fullName,
          phone: formattedPhone,
          role: 'RECEPTIONIST',
          receptionistProfile: {
            create: {
              phone: formattedPhone,
            },
          },
        },
        include: { receptionistProfile: true },
      });
    }

    // Reclaim/reassign past appointments from any synthetic walk-in account with the same phone (BUG-12, BUG-17)
    if (normalizedRole === 'PATIENT' && formattedPhone) {
      await migrateSyntheticWalkinAppointments(newUser.id, formattedPhone);
    }

    const token = jwt.sign(
      {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        fullName: newUser.fullName,
        mustChangePassword: newUser.mustChangePassword,
      },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    const { passwordHash: _, ...userWithoutPassword } = newUser;
    res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      data: {
        user: userWithoutPassword,
        token,
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

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required' });
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

    const { passwordHash: _, ...userWithoutPassword } = user;
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

    const { passwordHash: _, ...userWithoutPassword } = user;
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

    let formattedPhone: string | null | undefined = undefined;
    if (phone !== undefined) {
      if (phone === null || String(phone).trim() === '') {
        formattedPhone = null;
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
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(fullName && { fullName: String(fullName).trim() }),
        ...(formattedPhone !== undefined && { phone: formattedPhone }),
        ...(avatarUrl && { avatarUrl }),
      },
    });

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
      const safePatientData: any = {};
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

      await prisma.patientProfile.upsert({
        where: { userId: req.user.id },
        update: safePatientData,
        create: {
          userId: req.user.id,
          ...safePatientData,
        },
      });

      if (formattedPhone) {
        await migrateSyntheticWalkinAppointments(req.user.id, formattedPhone);
      }
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

      const safeDoctorData: any = {};
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

      await prisma.doctorProfile.upsert({
        where: { userId: req.user.id },
        update: safeDoctorData,
        create: {
          userId: req.user.id,
          specialty: safeDoctorData.specialty || 'General Physician',
          qualifications: safeDoctorData.qualifications || 'MBBS',
          ...safeDoctorData,
        },
      });
    }

    const refreshedUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { patientProfile: true, doctorProfile: true },
    });

    const { passwordHash: _, ...result } = refreshedUser!;
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
    const normalizedRole = role.toUpperCase() === 'DOCTOR' ? 'DOCTOR' : 'PATIENT';

    let user = await prisma.user.findUnique({
      where: { email },
      include: { patientProfile: true, doctorProfile: true },
    });

    if (user && user.role !== 'PATIENT' && user.role !== 'DOCTOR') {
      res.status(403).json({
        success: false,
        message:
          'Google Sign-In is only permitted for patient and doctor accounts. Clinic and administrative accounts must authenticate with email and password.',
      });
      return;
    }

    if (!user) {
      const defaultPassword = await bcrypt.hash(Math.random().toString(36).substring(2), 10);
      if (normalizedRole === 'PATIENT') {
        user = await prisma.user.create({
          data: {
            email,
            passwordHash: defaultPassword,
            fullName,
            avatarUrl,
            role: 'PATIENT',
            patientProfile: { create: {} },
          },
          include: { patientProfile: true, doctorProfile: true },
        });
      } else {
        user = await prisma.user.create({
          data: {
            email,
            passwordHash: defaultPassword,
            fullName,
            avatarUrl,
            role: 'DOCTOR',
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
          include: { patientProfile: true, doctorProfile: true },
        });
      }
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(avatarUrl && !user.avatarUrl ? { avatarUrl } : {}),
        },
        include: { patientProfile: true, doctorProfile: true },
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
      }

      user = (await prisma.user.findUnique({
        where: { id: user.id },
        include: { patientProfile: true, doctorProfile: true },
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

    const { passwordHash: _, ...userWithoutPassword } = user;
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

    const { passwordHash: _, ...userWithoutPassword } = updatedUser;
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


