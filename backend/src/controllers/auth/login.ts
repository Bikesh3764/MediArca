import crypto from 'crypto';
import { Request, Response } from 'express';
import { verifyPassword, hashPassword } from '../../utils/passwords';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import { hashOtp } from '../../utils/otpHash';
import { getJwtSecret } from '../../middleware/authMiddleware';
import { sendVerificationOtpEmail } from '../../utils/emailService';
import { checkPasswordLoginLockout, recordFailedPasswordLogin, clearPasswordLoginState, SecurityStoreUnavailableError } from '../../utils/securityStore';
import { getVerificationLockoutAsync, checkResendCooldown, recordResendAttempt } from '../../utils/otpSecurity';
import { getTrustedClientIp } from '../../utils/clientIp';
import { allowOtpEmail, googleClient, sanitizeUserPayload } from './helpers';
import { isDemoAccountEmail, isDemoLockEnabled } from '../../utils/demoAccounts';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string' || !email.trim()) {
      res.status(400).json({ success: false, message: 'Email and password are required and must be valid strings.' });
      return;
    }

    // Secure client IP extraction: Rely on Express-computed req.ip which respects 'trust proxy'
    // Cloudflare's CF-Connecting-IP first: X-Forwarded-For can be faked by the client (FIX-043)
    const clientIp = getTrustedClientIp(req) || req.ip || req.socket?.remoteAddress || 'unknown';

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
          if (await verifyPassword(password, candidate.passwordHash)) {
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

    const isMatch = passwordAlreadyVerified ? true : await verifyPassword(password, user.passwordHash);
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

    // A public demo password must never open the admin panel on the live site
    if (user.role === 'ADMIN' && isDemoLockEnabled() && isDemoAccountEmail(user.email)) {
      res.status(403).json({
        success: false,
        code: 'DEMO_ADMIN_DISABLED',
        message: 'The demo admin account is turned off on the live site.',
      });
      return;
    }

    // Suspended or rejected doctors and clinics can't sign in (same rule as Google sign-in)
    if (user.role === 'DOCTOR' && user.doctorProfile) {
      const st = user.doctorProfile.verificationStatus;
      if (st === 'SUSPENDED' || st === 'REJECTED') {
        res.status(403).json({
          success: false,
          message:
            st === 'SUSPENDED'
              ? 'Your doctor account is paused. Contact MediArca support for help.'
              : 'Your doctor registration was not approved. Contact MediArca support for help.',
        });
        return;
      }
    }
    if (user.role === 'CLINIC' && user.clinicProfile) {
      const st = user.clinicProfile.verificationStatus;
      if (st === 'SUSPENDED' || st === 'REJECTED') {
        res.status(403).json({
          success: false,
          message:
            st === 'SUSPENDED'
              ? 'Your clinic account is paused. Contact MediArca support for help.'
              : 'Your clinic registration was not approved. Contact MediArca support for help.',
        });
        return;
      }
    }

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

      if (!allowOtpEmail(req, res, user.email)) return;

      const otp = crypto.randomInt(100000, 1000000).toString();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationOtp: hashOtp(otp),
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
      const defaultPassword = await hashPassword(crypto.randomBytes(24).toString('hex'), 10);
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
