import type { NextFunction, Request, Response } from 'express';
import { getClientIp } from '../utils/clientIp';

/**
 * Cloudflare Turnstile bot check for public forms that create rows or send email:
 * sign-up, forgot password and the contact form (FIX-045).
 *
 * The browser gets a token from the Turnstile widget and sends it as `turnstileToken`
 * (or the `cf-turnstile-response` header). Off until TURNSTILE_SECRET_KEY is set, and
 * skipped in the automated test suites.
 */
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const isTurnstileEnabled = (): boolean =>
  Boolean(process.env.TURNSTILE_SECRET_KEY) && !process.env.MEDIARCA_TEST_SUITE;

export const verifyTurnstileToken = async (token: string, ip?: string): Promise<boolean | null> => {
  const body = new URLSearchParams({ secret: String(process.env.TURNSTILE_SECRET_KEY), response: token });
  if (ip && ip !== 'unknown') body.set('remoteip', ip);
  try {
    const res = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    const data: any = await res.json();
    return Boolean(data?.success);
  } catch (err: any) {
    console.warn('[Turnstile] Could not reach Cloudflare:', err?.message || err);
    return null; // unknown
  }
};

export const requireHuman = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!isTurnstileEnabled()) {
    next();
    return;
  }

  const header = req.headers['cf-turnstile-response'];
  const fromBody = req.body?.turnstileToken;
  const token = typeof fromBody === 'string' ? fromBody : typeof header === 'string' ? header : '';
  if (!token || token.length > 2048) {
    res.status(400).json({ success: false, code: 'BOT_CHECK_REQUIRED', message: 'Please complete the security check.' });
    return;
  }

  const ok = await verifyTurnstileToken(token, getClientIp(req));
  // If Cloudflare itself is unreachable, let real people through; the rate limits still apply
  if (ok === false) {
    res.status(400).json({ success: false, code: 'BOT_CHECK_FAILED', message: 'Security check failed. Please try again.' });
    return;
  }
  if (req.body && typeof req.body === 'object') delete req.body.turnstileToken;
  next();
};
