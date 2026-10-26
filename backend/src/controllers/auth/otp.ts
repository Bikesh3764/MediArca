import crypto from 'crypto';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import { getJwtSecret } from '../../middleware/authMiddleware';
import { findExistingAccountByPhone, getPhoneSearchVariants } from '../../utils/phoneUtils';
import { sendVerificationOtpEmail } from '../../utils/emailService';
import { SecurityStoreUnavailableError } from '../../utils/securityStore';
import { recordFailedVerificationAttemptAsync, getVerificationLockoutAsync, clearVerificationStateAsync, checkResendCooldown, recordResendAttempt } from '../../utils/otpSecurity';
import { sanitizeUserPayload } from './helpers';
import { createNotification, withDr } from '../../services/notificationService';

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

    // New doctors and clinics wait for admin checks, so tell the admins.
    if (updatedUser.role === 'DOCTOR' || updatedUser.role === 'CLINIC') {
      const isDoctor = updatedUser.role === 'DOCTOR';
      const who = isDoctor ? withDr(updatedUser.fullName) : (updatedUser as any).clinicProfile?.clinicName || updatedUser.fullName;
      prisma.user
        .findMany({ where: { role: 'ADMIN' }, select: { id: true } })
        .then((admins) => {
          for (const admin of admins) {
            createNotification(
              admin.id,
              isDoctor ? 'New doctor to verify' : 'New clinic to verify',
              `${who} signed up and is waiting for approval.`,
              'SYSTEM'
            ).catch(() => {});
          }
        })
        .catch(() => {});
    }

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
