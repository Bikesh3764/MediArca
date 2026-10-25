import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';

/**
 * Public demo accounts (their passwords are shown on the login screens on purpose).
 * Anyone can sign in to them, so in production we block changes that would
 * deface or lock out the demo for the next visitor: renaming, phone/photo changes,
 * password changes and deleting staff. Queue actions (booking, calling, check-in) still work.
 *
 * Override the list with DEMO_ACCOUNT_EMAILS="a@x.com,b@y.com".
 * Turn the lock off with DEMO_ACCOUNT_LOCK="false"; force it on outside production with "true".
 */
const DEFAULT_DEMO_EMAILS = [
  'admin@mediarca.com',
  'dr.sarah@mediarca.com',
  'dr.arjun@mediarca.com',
  'dr.marcus@mediarca.com',
  'john.doe@gmail.com',
  'clinic@mediarca.com',
  'apex.health@mediarca.com',
  'priya.desk@mediarca.com',
  'receptionist@mediarca.com',
];

export const getDemoAccountEmails = (): string[] => {
  const raw = process.env.DEMO_ACCOUNT_EMAILS;
  const list = raw && raw.trim() ? raw.split(',') : DEFAULT_DEMO_EMAILS;
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean);
};

export const isDemoAccountEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return getDemoAccountEmails().includes(String(email).trim().toLowerCase());
};

const isDemoLockEnabled = (): boolean => {
  const flag = process.env.DEMO_ACCOUNT_LOCK;
  if (flag === 'false') return false;
  if (flag === 'true') return true;
  return process.env.NODE_ENV === 'production';
};

export const DEMO_LOCKED_MESSAGE = 'Demo account: this change is turned off so the demo keeps working for everyone.';

/** Route guard: rejects identity/destructive changes made from a public demo account. */
export const blockDemoAccountChanges = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (isDemoLockEnabled() && isDemoAccountEmail(req.user?.email)) {
    res.status(403).json({ success: false, code: 'DEMO_ACCOUNT_LOCKED', message: DEMO_LOCKED_MESSAGE });
    return;
  }
  next();
};
