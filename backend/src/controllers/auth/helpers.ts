import { OAuth2Client } from 'google-auth-library';
import type { Request, Response } from 'express';
import { guardOtpEmail } from '../../utils/otpEmailBudget';
import { getClientIp } from '../../utils/clientIp';

export const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

/**
 * Counts one code email against the inbox, visitor and site caps (FIX-044).
 * Sends the 429 itself and returns false when a cap is reached.
 */
export const allowOtpEmail = (req: Request, res: Response, email: string): boolean => {
  const budget = guardOtpEmail(email, getClientIp(req));
  if (budget.allowed) return true;
  res.setHeader('Retry-After', String(budget.retryAfterSeconds || 60));
  res.status(429).json({ success: false, message: budget.message, retryAfterSeconds: budget.retryAfterSeconds });
  return false;
};
