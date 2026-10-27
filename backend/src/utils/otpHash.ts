import crypto from 'crypto';
import { getJwtSecret } from '../middleware/authMiddleware';

/**
 * Email codes are stored hashed so a database leak doesn't hand out live codes.
 * A plain SHA-256 of a 6-digit code can be reversed in a moment (only a million options),
 * so codes are hashed with a server-side secret (HMAC). Codes saved before that change
 * (plain SHA-256, same `h1:` prefix) and older plain codes still match until they expire.
 */
const PREFIX = 'h1:';

const otpKey = (): string => process.env.OTP_HASH_SECRET || getJwtSecret();

export const hashOtp = (otp: string): string =>
  PREFIX + crypto.createHmac('sha256', otpKey()).update(String(otp).trim()).digest('hex');

const legacyHashOtp = (otp: string): string =>
  PREFIX + crypto.createHash('sha256').update(String(otp).trim()).digest('hex');

const same = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export const otpMatches = (stored: string | null | undefined, submitted: string | null | undefined): boolean => {
  if (!stored || !submitted) return false;
  if (!stored.startsWith(PREFIX)) return same(String(submitted).trim(), stored);
  return same(hashOtp(submitted), stored) || same(legacyHashOtp(submitted), stored);
};
