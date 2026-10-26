/**
 * Caps on how many code emails (sign-up, resend, login re-verify, password reset) go out.
 *
 * The 60-second cooldown in otpSecurity is per (email, role, purpose), so before this one inbox
 * could get a code every minute from each role and from password reset, all day long, and one
 * visitor could send codes to any number of addresses. These caps count every code email together:
 * - per inbox:   5 an hour, 10 a day
 * - per visitor (IP): 10 an hour, 30 a day
 * - whole site:  OTP_EMAIL_DAILY_CAP a day (default 400), so a flood can't burn the mail provider quota
 *
 * Kept in memory: the backend runs as one instance. A restart clears the counts. (FIX-044)
 */

type Window = { count: number; resetAt: number };

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const OTP_EMAIL_LIMITS = {
  perEmailHour: 5,
  perEmailDay: 10,
  perIpHour: 10,
  perIpDay: 30,
};

const dailyCap = (): number => {
  const raw = Number(process.env.OTP_EMAIL_DAILY_CAP);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 400;
};

const windows = new Map<string, Window>();

const current = (key: string, now: number): Window | null => {
  const w = windows.get(key);
  if (!w || now >= w.resetAt) return null;
  return w;
};

const bump = (key: string, span: number, now: number): void => {
  const w = current(key, now);
  if (w) w.count += 1;
  else windows.set(key, { count: 1, resetAt: now + span });
};

export interface OtpEmailBudgetResult {
  allowed: boolean;
  /** Which cap stopped it: the inbox, the visitor, or the whole site */
  reason?: 'email' | 'ip' | 'global';
  retryAfterSeconds?: number;
  message?: string;
}

const deny = (reason: 'email' | 'ip' | 'global', w: Window, now: number): OtpEmailBudgetResult => {
  const retryAfterSeconds = Math.max(1, Math.ceil((w.resetAt - now) / 1000));
  const message =
    reason === 'email'
      ? 'Too many codes sent to this email. Try again later.'
      : reason === 'ip'
      ? 'Too many codes requested from this network. Try again later.'
      : 'Code emails are paused for now. Try again later.';
  return { allowed: false, reason, retryAfterSeconds, message };
};

/**
 * Checks every cap and, only when all pass, counts one email against each.
 * Call it right before a code email is actually sent.
 */
export const reserveOtpEmail = (email: string, ip: string | null | undefined, nowMs?: number): OtpEmailBudgetResult => {
  const now = nowMs ?? Date.now();
  const inbox = String(email || '').trim().toLowerCase();
  const visitor = String(ip || 'unknown');
  const checks: Array<[string, number, number, 'email' | 'ip' | 'global']> = [
    [`email:h:${inbox}`, OTP_EMAIL_LIMITS.perEmailHour, HOUR, 'email'],
    [`email:d:${inbox}`, OTP_EMAIL_LIMITS.perEmailDay, DAY, 'email'],
    [`ip:h:${visitor}`, OTP_EMAIL_LIMITS.perIpHour, HOUR, 'ip'],
    [`ip:d:${visitor}`, OTP_EMAIL_LIMITS.perIpDay, DAY, 'ip'],
    ['global:d', dailyCap(), DAY, 'global'],
  ];

  for (const [key, max, , reason] of checks) {
    const w = current(key, now);
    if (w && w.count >= max) {
      if (reason === 'global') console.warn('[otpEmailBudget] Daily code email cap reached');
      return deny(reason, w, now);
    }
  }
  for (const [key, , span] of checks) bump(key, span, now);
  return { allowed: true };
};

/**
 * What the auth controllers call. The automated test suites register hundreds of accounts from
 * one fake address, so they skip the caps; the caps themselves are tested by calling reserveOtpEmail.
 */
export const guardOtpEmail = (email: string, ip: string | null | undefined): OtpEmailBudgetResult =>
  process.env.MEDIARCA_TEST_SUITE && !process.env.OTP_EMAIL_BUDGET_IN_TESTS ? { allowed: true } : reserveOtpEmail(email, ip);

export const pruneOtpEmailBudget =(nowMs?: number): void => {
  const now = nowMs ?? Date.now();
  for (const [key, w] of windows.entries()) {
    if (now >= w.resetAt) windows.delete(key);
  }
};

export const resetOtpEmailBudget = (): void => {
  windows.clear();
};

const pruneTimer = setInterval(() => pruneOtpEmailBudget(), 10 * 60 * 1000);
if (pruneTimer.unref) pruneTimer.unref();
