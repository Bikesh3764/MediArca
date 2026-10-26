import crypto from 'crypto';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import { AuthRequest, getJwtSecret } from '../../middleware/authMiddleware';
import { sendVerificationOtpEmail } from '../../utils/emailService';
import { hashOtp, otpMatches } from '../../utils/otpHash';
import {
  checkResendCooldown,
  recordResendAttempt,
  getVerificationLockoutAsync,
  recordFailedVerificationAttemptAsync,
  clearVerificationStateAsync,
} from '../../utils/otpSecurity';
import { clearPasswordLoginState } from '../../utils/securityStore';
import { markPasswordChanged } from '../../utils/sessionRevocation';
import { isDemoAccountEmail } from '../../utils/demoAccounts';
import { sanitizeUserPayload } from './helpers';

const ROLES = ['PATIENT', 'DOCTOR', 'CLINIC', 'RECEPTIONIST', 'ADMIN'];
const RESET_SENT_MESSAGE = 'If an account exists for this email, we sent a 6-digit code to it.';
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

const cleanRole = (role: unknown): string | null => {
  const r = typeof role === 'string' ? role.trim().toUpperCase() : '';
  return ROLES.includes(r) ? r : null;
};

const isSyntheticEmail = (email: string) => email.endsWith('@mediarca.local') || email.startsWith('walkin.');

const passwordProblem = (pw: unknown): string | null => {
  if (typeof pw !== 'string' || pw.trim().length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters long.`;
  if (pw.length > MAX_PASSWORD) return `Password must be ${MAX_PASSWORD} characters or fewer.`;
  return null;
};

/** POST /api/auth/forgot-password — emails a reset code. Same reply whether or not the account exists. */
export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, role } = req.body || {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const requestedRole = cleanRole(role);
    if (!cleanEmail || !requestedRole) {
      res.status(400).json({ success: false, message: 'Email and account type are required.' });
      return;
    }

    const cooldownKey = `reset::${cleanEmail}::${requestedRole}`;
    const cooldown = checkResendCooldown(cooldownKey, 60);
    if (!cooldown.allowed) {
      res.status(429).json({
        success: false,
        message: `Please wait ${cooldown.remainingSeconds}s before asking for another code.`,
        cooldownSeconds: cooldown.remainingSeconds,
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email_role: { email: cleanEmail, role: requestedRole as any } },
      select: { id: true, email: true, fullName: true },
    });

    // Demo and walk-in accounts can't reset; reply the same way so nobody learns which emails exist.
    if (!user || isSyntheticEmail(cleanEmail) || isDemoAccountEmail(cleanEmail)) {
      recordResendAttempt(cooldownKey);
      res.json({ success: true, message: RESET_SENT_MESSAGE, data: { cooldownSeconds: 60 } });
      return;
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationOtp: hashOtp(otp),
        emailVerificationOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    recordResendAttempt(cooldownKey);
    sendVerificationOtpEmail(user.email, otp, user.fullName, 'reset').catch((err) => {
      console.error('Password reset email failed:', err?.message);
    });

    res.json({
      success: true,
      message: RESET_SENT_MESSAGE,
      data: {
        cooldownSeconds: 60,
        ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
      },
    });
  } catch (error: any) {
    console.error('requestPasswordReset error:', error);
    res.status(500).json({ success: false, message: 'Could not send the reset code. Please try again.' });
  }
};

/** POST /api/auth/reset-password — sets a new password using the emailed code. */
export const resetPasswordWithCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, role, otp, newPassword } = req.body || {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const requestedRole = cleanRole(role);
    const cleanOtp = typeof otp === 'string' || typeof otp === 'number' ? String(otp).trim() : '';
    if (!cleanEmail || !requestedRole || !/^\d{6}$/.test(cleanOtp)) {
      res.status(400).json({ success: false, message: 'Email, account type and the 6-digit code are required.' });
      return;
    }
    const pwProblem = passwordProblem(newPassword);
    if (pwProblem) {
      res.status(400).json({ success: false, message: pwProblem });
      return;
    }

    const lockout = await getVerificationLockoutAsync(cleanEmail, requestedRole);
    if (lockout.isLocked) {
      res.status(429).json({
        success: false,
        message: `Too many wrong codes. Try again in ${Math.ceil(lockout.remainingLockoutSeconds / 60)} minutes.`,
        remainingSeconds: lockout.remainingLockoutSeconds,
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email_role: { email: cleanEmail, role: requestedRole as any } },
      select: { id: true, email: true, role: true, emailVerificationOtp: true, emailVerificationOtpExpiresAt: true },
    });

    const valid =
      user &&
      !isDemoAccountEmail(cleanEmail) &&
      otpMatches(user.emailVerificationOtp, cleanOtp) &&
      user.emailVerificationOtpExpiresAt &&
      user.emailVerificationOtpExpiresAt > new Date();

    if (!valid || !user) {
      const attempt = await recordFailedVerificationAttemptAsync(cleanEmail, requestedRole);
      if (attempt.isLocked) {
        res.status(429).json({
          success: false,
          message: 'Too many wrong codes. Try again in 15 minutes.',
          remainingSeconds: attempt.remainingLockoutSeconds,
        });
        return;
      }
      res.status(400).json({
        success: false,
        message: 'That code is wrong or has expired. Ask for a new one.',
        remainingAttempts: attempt.remainingAttempts,
      });
      return;
    }

    const passwordChangedAt = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(String(newPassword), 10),
        passwordChangedAt,
        mustChangePassword: false,
        // The code reached their inbox, so the email is proven
        isEmailVerified: true,
        emailVerificationOtp: null,
        emailVerificationOtpExpiresAt: null,
      },
    });
    markPasswordChanged(user.id, passwordChangedAt);
    await clearVerificationStateAsync(cleanEmail, requestedRole);
    await clearPasswordLoginState(cleanEmail, requestedRole, req.ip || null);
    await clearPasswordLoginState(cleanEmail, null, req.ip || null);

    res.json({ success: true, message: 'Password updated. Sign in with your new password.' });
  } catch (error: any) {
    console.error('resetPasswordWithCode error:', error);
    res.status(500).json({ success: false, message: 'Could not reset the password. Please try again.' });
  }
};

/** PUT /api/auth/change-password — signed-in users change their own password. */
export const changeOwnPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Please sign in again.' });
      return;
    }
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || !currentPassword) {
      res.status(400).json({ success: false, message: 'Enter your current password.' });
      return;
    }
    const pwProblem = passwordProblem(newPassword);
    if (pwProblem) {
      res.status(400).json({ success: false, message: pwProblem });
      return;
    }
    if (currentPassword === newPassword) {
      res.status(400).json({ success: false, message: 'Choose a password different from your current one.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    }
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      res.status(400).json({ success: false, message: 'Current password is wrong.' });
      return;
    }

    const passwordChangedAt = new Date();
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(String(newPassword), 10),
        passwordChangedAt,
        mustChangePassword: false,
      },
      include: { patientProfile: true, doctorProfile: true, clinicProfile: true, receptionistProfile: true },
    });
    // Sign out other devices; this device gets a fresh token
    markPasswordChanged(updated.id, passwordChangedAt);
    const token = jwt.sign(
      { id: updated.id, email: updated.email, role: updated.role, fullName: updated.fullName, mustChangePassword: false },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Password changed. Other devices are signed out.',
      data: { token, user: sanitizeUserPayload(updated) },
    });
  } catch (error: any) {
    console.error('changeOwnPassword error:', error);
    res.status(500).json({ success: false, message: 'Could not change the password. Please try again.' });
  }
};
