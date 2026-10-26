import { isIP } from 'net';
import type { Request } from 'express';

/**
 * The visitor's real IP address, used as the rate-limit key.
 *
 * Render sits behind Cloudflare. With `trust proxy 1`, `req.ip` is Render's internal load
 * balancer (10.x), so every visitor used to share a few rate-limit buckets (FIX-043). Cloudflare
 * sets `CF-Connecting-IP` to the address that actually connected and refuses requests that
 * try to send their own, so it can't be faked. Local runs have no Cloudflare and use `req.ip`.
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
