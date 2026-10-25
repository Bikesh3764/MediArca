import { Request, Response, NextFunction } from 'express';

/**
 * Short-lived in-memory cache for public, signed-out GET responses
 * (doctor/clinic discovery). A discovery request costs several database
 * round trips; repeat visits within the TTL are answered from memory instead.
 *
 * Freshness: any successful write (POST/PUT/PATCH/DELETE) anywhere in the API
 * clears the whole cache, so cabin status, fees and slot counts update on the
 * next request. The TTL only bounds staleness from background jobs.
 */
interface CachedResponse {
  status: number;
  body: unknown;
  expiresAt: number;
}

const cache = new Map<string, CachedResponse>();
const MAX_ENTRIES = 500;

export const clearPublicResponseCache = (): void => {
  cache.clear();
};

export const publicResponseCache = (ttlMs = 15000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET' || req.headers.authorization) {
      next();
      return;
    }

    const key = req.originalUrl;
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      res.setHeader('X-Cache', 'HIT');
      res.status(hit.status).json(hit.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode === 200) {
        if (cache.size >= MAX_ENTRIES) {
          const oldest = cache.keys().next().value;
          if (oldest !== undefined) cache.delete(oldest);
        }
        cache.set(key, { status: 200, body, expiresAt: Date.now() + ttlMs });
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };
    next();
  };
};

/** Clears the public cache after any successful write so readers see changes immediately. */
export const invalidatePublicCacheOnWrite = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    res.on('finish', () => {
      if (res.statusCode < 400) clearPublicResponseCache();
    });
  }
  next();
};
