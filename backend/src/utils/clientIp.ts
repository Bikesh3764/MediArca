import { isIP } from 'net';
import type { Request } from 'express';

/**
 * The visitor's real IP address, used as the rate-limit key.
 *
 * Render sits behind Cloudflare. Cloudflare always overwrites `CF-Connecting-IP` with the
 * address that actually connected, so a client can't fake it. `X-Forwarded-For` keeps
 * whatever the client sent at its start, and a fake value there used to give every request
 * a fresh rate-limit bucket (FIX-043). Local runs have no Cloudflare and use `req.ip`.
 */
export const getTrustedClientIp = (req: Request): string | null => {
  const cf = req.headers?.['cf-connecting-ip'];
  const value = Array.isArray(cf) ? cf[0] : cf;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (isIP(trimmed)) return trimmed;
  }
  return null;
};

export const getClientIp = (req: Request): string =>
  getTrustedClientIp(req) || req.ip || req.socket?.remoteAddress || 'unknown';
