import crypto from 'crypto';

/**
 * Email codes are stored hashed so a database leak doesn't hand out live codes.
 * Older rows may still hold a plain 6-digit code; `otpMatches` accepts both.
 */
const PREFIX = 'h1:';

export const hashOtp = (otp: string): string =>
  PREFIX + crypto.createHash('sha256').update(String(otp).trim()).digest('hex');

export const otpMatches = (stored: string | null | undefined, submitted: string | null | undefined): boolean => {
  if (!stored || !submitted) return false;
  const candidate = stored.startsWith(PREFIX) ? hashOtp(submitted) : String(submitted).trim();
  const a = Buffer.from(candidate);
  const b = Buffer.from(stored);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
