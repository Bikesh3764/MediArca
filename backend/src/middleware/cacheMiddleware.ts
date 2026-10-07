import { Request, Response, NextFunction } from 'express';

/**
 * Granular HTTP Caching Middleware (FIX-015)
 * Safely applies short-lived public caching headers to genuinely public read-only discovery routes.
 *
 * Security & Data Isolation Guarantees:
 * 1. Only GET or HEAD requests can ever be cached.
 * 2. If the request carries an Authorization header or an authenticated user object,
 *    it is NEVER cached publicly. It is forced to 'private, no-store'.
 * 3. Default fallback for all other API routes remains 'no-store, no-cache, must-revalidate, proxy-revalidate'.
 */
export const publicCache = (maxAge = 60, staleWhileRevalidate = 30) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only cache GET or HEAD requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      next();
      return;
    }

    // Safety guard: if request carries an Authorization header or authenticated user, NEVER cache publicly!
    const authHeader = req.headers['authorization'];
    const hasAuth = Boolean(authHeader && authHeader.trim().length > 0) || Boolean((req as any).user);

    if (hasAuth) {
      res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      next();
      return;
    }

    // Genuinely public, unauthenticated discovery response: safe short-lived cache
    res.setHeader(
      'Cache-Control',
      `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
    );
    // Remove legacy HTTP/1.0 no-cache headers so CDN/browser can cache
    res.removeHeader('Pragma');
    res.removeHeader('Expires');

    next();
  };
};
