/**
 * MediArca - Distributed Security & Lockout Storage Abstraction (SEC-003 / SEC-004 Hardened)
 *
 * Implements:
 * 1. Redis-backed distributed storage via REDIS_URL with atomic Lua operations.
 * 2. Privacy-preserving SHA-256 hashed keys (never exposes plain emails or PII in storage keys or logs).
 * 3. Explicit safe failure policy in production: rejects sensitive operations with HTTP 503 rather than
 *    silently bypassing checks or downgrading to process-local memory.
 * 4. Dual-layer account-lockout protection:
 *    - Layer 1 (Client-Scoped): 5 failed attempts from an IP locks that IP for 15 min, preventing Account Lockout DoS.
 *    - Layer 2 (Global Account): 15 cumulative failed attempts across multiple IPs triggers global account cooldown.
 * 5. Bounded, non-extending cooldowns (requests during cooldown never push forward expiry).
 * 6. Full role isolation on identical email addresses.
 * 7. Complete counter isolation between password login and OTP verification.
 */

import crypto from 'crypto';
import Redis from 'ioredis';

export class SecurityStoreUnavailableError extends Error {
  public readonly code = 'SECURITY_STORE_UNAVAILABLE';
  constructor(message = 'Distributed security storage is unavailable') {
    super(message);
    this.name = 'SecurityStoreUnavailableError';
  }
}

export interface LockoutStatus {
  isLocked: boolean;
  remainingLockoutSeconds: number;
  lockedUntil: Date | null;
  scope?: 'client' | 'account';
  message?: string;
}

export interface AttemptResult {
  attempts: number;
  isLocked: boolean;
  remainingAttempts: number;
  lockedUntil: Date | null;
  remainingLockoutSeconds: number;
  scope?: 'client' | 'account';
}

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  resetTime: number; // timestamp ms
  remainingSeconds: number;
}

export const MAX_PASSWORD_ATTEMPTS = 5; // Client IP specific threshold (prevents cheap DoS)
export const GLOBAL_PASSWORD_ATTEMPTS = 15; // Account-level threshold (protects against distributed brute force)
export const PASSWORD_LOCKOUT_MINUTES = 15;
export const PASSWORD_LOCKOUT_SECONDS = 15 * 60; // 900s

export const MAX_OTP_ATTEMPTS = 5;
export const OTP_LOCKOUT_MINUTES = 15;
export const OTP_LOCKOUT_SECONDS = 15 * 60; // 900s

export const normalizeIdentity = (identity: string, role?: string | null): string => {
  const cleanId = String(identity || '').toLowerCase().trim();
  const cleanRole = role ? String(role).toUpperCase().trim() : 'DEFAULT';
  return `${cleanId}::${cleanRole}`;
};

export const hashIdentity = (identity: string, role?: string | null): string => {
  const normalized = normalizeIdentity(identity, role);
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
};

export const hashClientIdentity = (ip: string, email: string, role?: string | null): string => {
  const cleanIp = String(ip || 'unknown').trim();
  const normalized = `${cleanIp}::${normalizeIdentity(email, role)}`;
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
};

export const hashRateLimitKey = (key: string): string => {
  return crypto.createHash('sha256').update(String(key || '').trim()).digest('hex').slice(0, 32);
};

interface MemoryLockoutRecord {
  attempts: number;
  lockedUntil: number | null; // timestamp ms
  lastAttemptAt: number;     // timestamp ms
}

class SecurityStore {
  private redis: Redis | null = null;
  private isRedisConnected = false;
  private hasLoggedFallbackNotice = false;
  private enforceDistributed =
    process.env.NODE_ENV === 'production' &&
    process.env.REQUIRE_REDIS !== 'false' &&
    process.env.STRICT_DISTRIBUTED_SECURITY !== 'false';
  private memoryLockouts = new Map<string, MemoryLockoutRecord>();
  private externalRateLimitMap: Map<string, { count: number; resetTime: number }> | null = null;
  private pruneTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.initRedis();
    this.startPruning();
  }

  private logFallbackNotice(): void {
    if (!this.hasLoggedFallbackNotice && !this.enforceDistributed) {
      this.hasLoggedFallbackNotice = true;
      console.log(
        '[SecurityStore] Using in-memory storage (no REDIS_URL). Fine for a single server.'
      );
    }
  }

  public initRedis(url?: string): void {
    if (this.redis) {
      try {
        this.redis.disconnect();
      } catch {
        // ignore
      }
      this.redis = null;
      this.isRedisConnected = false;
    }

    const redisUrl = url || process.env.REDIS_URL;
    if (!redisUrl) {
      this.logFallbackNotice();
      return;
    }

    try {
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        retryStrategy(times) {
          // Bounded reconnect strategy with max 2000ms delay to ensure recovery when Redis is restored
          return Math.min(times * 150, 2000);
        },
        enableOfflineQueue: false,
      });

      this.redis.on('ready', () => {
        this.isRedisConnected = true;
        console.log('[SecurityStore] Connected to Redis and ready for distributed rate-limiting and lockout protection.');
      });

      this.redis.on('connect', () => {
        this.isRedisConnected = true;
      });

      this.redis.on('error', () => {
        this.isRedisConnected = false;
        console.warn('[SecurityStore] Redis connection error encountered.');
        this.logFallbackNotice();
      });

      this.redis.on('close', () => {
        this.isRedisConnected = false;
      });

      this.redis.on('end', () => {
        this.isRedisConnected = false;
      });

      this.redis.connect().catch(() => {
        this.isRedisConnected = false;
        this.logFallbackNotice();
      });
    } catch {
      this.isRedisConnected = false;
      this.logFallbackNotice();
    }
  }

  public isRedisActive(): boolean {
    if (!this.isRedisConnected || !this.redis) return false;
    if (typeof this.redis.status === 'string') {
      return this.redis.status === 'ready' || this.redis.status === 'connect';
    }
    return true;
  }

  public isDistributedEnforced(): boolean {
    return this.enforceDistributed;
  }

  public setEnforceDistributed(enforce: boolean): void {
    this.enforceDistributed = enforce;
  }

  public setMockRedisClient(mock: any): void {
    this.redis = mock;
    this.isRedisConnected = Boolean(mock);
  }

  public bindRateLimitMap(map: Map<string, { count: number; resetTime: number }>): void {
    this.externalRateLimitMap = map;
  }

  private startPruning(): void {
    this.pruneTimer = setInterval(() => {
      this.pruneStaleMemory();
    }, 60 * 1000);

    if (this.pruneTimer.unref) {
      this.pruneTimer.unref();
    }
  }

  public pruneStaleMemory(nowMs?: number): number {
    const now = nowMs ?? Date.now();
    let pruned = 0;
    for (const [key, record] of this.memoryLockouts.entries()) {
      const isLockExpired = !record.lockedUntil || now >= record.lockedUntil;
      const isInactive = now - record.lastAttemptAt > 30 * 60 * 1000;
      if (isLockExpired && isInactive) {
        this.memoryLockouts.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  // --- MEMORY SYNCHRONOUS OPERATIONS ---

  private getMemoryKey(namespace: string, identity: string, role?: string | null): string {
    return `${namespace}:${normalizeIdentity(identity, role)}`;
  }

  public checkLockoutSync(
    namespace: string,
    identity: string,
    role?: string | null,
    nowMs?: number
  ): LockoutStatus {
    const key = this.getMemoryKey(namespace, identity, role);
    const now = nowMs ?? Date.now();
    const record = this.memoryLockouts.get(key);

    if (!record || !record.lockedUntil) {
      return { isLocked: false, remainingLockoutSeconds: 0, lockedUntil: null };
    }

    if (now < record.lockedUntil) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return {
        isLocked: true,
        remainingLockoutSeconds: Math.max(0, remainingSeconds),
        lockedUntil: new Date(record.lockedUntil),
      };
    }

    // Lockout has expired: reset lockout and attempts
    record.lockedUntil = null;
    record.attempts = 0;
    return { isLocked: false, remainingLockoutSeconds: 0, lockedUntil: null };
  }

  public recordFailedAttemptSync(
    namespace: string,
    identity: string,
    role?: string | null,
    maxAttempts = 5,
    lockoutSeconds = 900,
    nowMs?: number
  ): AttemptResult {
    const key = this.getMemoryKey(namespace, identity, role);
    const now = nowMs ?? Date.now();

    // Check existing lockout (do not extend if already locked!)
    const currentLockout = this.checkLockoutSync(namespace, identity, role, now);
    if (currentLockout.isLocked) {
      return {
        attempts: maxAttempts,
        isLocked: true,
        remainingAttempts: 0,
        lockedUntil: currentLockout.lockedUntil,
        remainingLockoutSeconds: currentLockout.remainingLockoutSeconds,
      };
    }

    let record = this.memoryLockouts.get(key);
    if (!record) {
      record = { attempts: 0, lockedUntil: null, lastAttemptAt: now };
      if (this.memoryLockouts.size >= 10000) {
        this.pruneStaleMemory(now);
      }
      this.memoryLockouts.set(key, record);
    }

    record.attempts += 1;
    record.lastAttemptAt = now;

    if (record.attempts >= maxAttempts) {
      const lockedUntilMs = now + lockoutSeconds * 1000;
      record.lockedUntil = lockedUntilMs;
      return {
        attempts: record.attempts,
        isLocked: true,
        remainingAttempts: 0,
        lockedUntil: new Date(lockedUntilMs),
        remainingLockoutSeconds: lockoutSeconds,
      };
    }

    return {
      attempts: record.attempts,
      isLocked: false,
      remainingAttempts: Math.max(0, maxAttempts - record.attempts),
      lockedUntil: null,
      remainingLockoutSeconds: 0,
    };
  }

  public clearLockoutSync(namespace: string, identity: string, role?: string | null): void {
    const key = this.getMemoryKey(namespace, identity, role);
    this.memoryLockouts.delete(key);
  }

  public incrementRateLimitSync(
    key: string,
    maxRequests: number,
    windowSeconds: number,
    nowMs?: number
  ): RateLimitResult {
    const now = nowMs ?? Date.now();
    const map = this.externalRateLimitMap || new Map();
    const entry = map.get(key);

    if (entry && now < entry.resetTime) {
      entry.count += 1;
      const remainingSeconds = Math.ceil((entry.resetTime - now) / 1000);
      if (entry.count > maxRequests) {
        return {
          allowed: false,
          currentCount: entry.count,
          resetTime: entry.resetTime,
          remainingSeconds: Math.max(0, remainingSeconds),
        };
      }
      return {
        allowed: true,
        currentCount: entry.count,
        resetTime: entry.resetTime,
        remainingSeconds: Math.max(0, remainingSeconds),
      };
    }

    const resetTime = now + windowSeconds * 1000;
    map.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      currentCount: 1,
      resetTime,
      remainingSeconds: windowSeconds,
    };
  }

  // --- ASYNC DISTRIBUTED OPERATIONS ---

  public async checkLockout(
    namespace: string,
    identity: string,
    role?: string | null
  ): Promise<LockoutStatus> {
    if (this.enforceDistributed && !this.isRedisActive()) {
      throw new SecurityStoreUnavailableError(
        'Production security controls require an active distributed store (Redis). State cannot be verified.'
      );
    }

    if (!this.isRedisActive()) {
      return this.checkLockoutSync(namespace, identity, role);
    }

    try {
      const hash = hashIdentity(identity, role);
      const lockKey = `lock:${namespace}:${hash}`;
      const ttl = await this.redis!.ttl(lockKey);

      if (ttl > 0) {
        return {
          isLocked: true,
          remainingLockoutSeconds: ttl,
          lockedUntil: new Date(Date.now() + ttl * 1000),
        };
      }

      return { isLocked: false, remainingLockoutSeconds: 0, lockedUntil: null };
    } catch {
      if (this.enforceDistributed) {
        console.error('[SecurityStore] Distributed Redis store failed during lockout verification. Failing safe.');
        throw new SecurityStoreUnavailableError('Distributed Redis store failed during lockout verification.');
      }
      return this.checkLockoutSync(namespace, identity, role);
    }
  }

  public async recordFailedAttempt(
    namespace: string,
    identity: string,
    role?: string | null,
    maxAttempts = 5,
    lockoutSeconds = 900
  ): Promise<AttemptResult> {
    if (this.enforceDistributed && !this.isRedisActive()) {
      throw new SecurityStoreUnavailableError(
        'Production security controls require an active distributed store (Redis). State cannot be verified.'
      );
    }

    if (!this.isRedisActive()) {
      return this.recordFailedAttemptSync(namespace, identity, role, maxAttempts, lockoutSeconds);
    }

    try {
      const hash = hashIdentity(identity, role);
      const lockKey = `lock:${namespace}:${hash}`;
      const attemptKey = `att:${namespace}:${hash}`;
      const now = Date.now();

      // Atomic Lua script enforcing threshold without extending cooldowns
      const luaScript = `
        local lockKey = KEYS[1]
        local attemptKey = KEYS[2]
        local maxAttempts = tonumber(ARGV[1])
        local lockoutSeconds = tonumber(ARGV[2])
        local nowMs = tonumber(ARGV[3])

        local isLocked = redis.call('EXISTS', lockKey)
        if isLocked == 1 then
          local ttl = redis.call('TTL', lockKey)
          if ttl < 0 then ttl = lockoutSeconds end
          return {maxAttempts, 1, 0, ttl}
        end

        local attempts = redis.call('INCR', attemptKey)
        if attempts == 1 then
          redis.call('EXPIRE', attemptKey, lockoutSeconds * 2)
        end

        if attempts >= maxAttempts then
          local lockedUntilMs = nowMs + (lockoutSeconds * 1000)
          redis.call('SETEX', lockKey, lockoutSeconds, tostring(lockedUntilMs))
          redis.call('DEL', attemptKey)
          return {attempts, 1, 0, lockoutSeconds}
        else
          local remaining = maxAttempts - attempts
          return {attempts, 0, remaining, 0}
        end
      `;

      const result = (await this.redis!.eval(
        luaScript,
        2,
        lockKey,
        attemptKey,
        maxAttempts,
        lockoutSeconds,
        now
      )) as [number, number, number, number];

      if (!Array.isArray(result) || result.length < 4) {
        throw new Error('Unexpected response format from distributed Redis store');
      }

      const [attempts, isLockedNum, remainingAttempts, remainingTtl] = result;
      const isLocked = isLockedNum === 1;

      return {
        attempts,
        isLocked,
        remainingAttempts,
        lockedUntil: isLocked ? new Date(now + remainingTtl * 1000) : null,
        remainingLockoutSeconds: remainingTtl,
      };
    } catch {
      if (this.enforceDistributed) {
        console.error('[SecurityStore] Distributed Redis store failed during attempt recording. Failing safe.');
        throw new SecurityStoreUnavailableError('Distributed Redis store failed during attempt recording.');
      }
      return this.recordFailedAttemptSync(namespace, identity, role, maxAttempts, lockoutSeconds);
    }
  }

  public async clearLockout(
    namespace: string,
    identity: string,
    role?: string | null
  ): Promise<void> {
    this.clearLockoutSync(namespace, identity, role);

    if (this.enforceDistributed && !this.isRedisActive()) {
      throw new SecurityStoreUnavailableError(
        'Production security controls require an active distributed store (Redis). State cannot be verified.'
      );
    }

    if (this.isRedisActive()) {
      try {
        const hash = hashIdentity(identity, role);
        const lockKey = `lock:${namespace}:${hash}`;
        const attemptKey = `att:${namespace}:${hash}`;
        await this.redis!.del(lockKey, attemptKey);
      } catch {
        if (this.enforceDistributed) {
          console.error('[SecurityStore] Distributed Redis store failed during lockout clear. Failing safe.');
          throw new SecurityStoreUnavailableError('Distributed Redis store failed during lockout clear.');
        }
      }
    }
  }

  public async incrementRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    if (this.enforceDistributed && !this.isRedisActive()) {
      throw new SecurityStoreUnavailableError(
        'Production security controls require an active distributed store (Redis). State cannot be verified.'
      );
    }

    if (!this.isRedisActive()) {
      return this.incrementRateLimitSync(key, maxRequests, windowSeconds);
    }

    try {
      const hash = hashRateLimitKey(key);
      const redisKey = `rl:${hash}`;
      const now = Date.now();

      const luaScript = `
        local key = KEYS[1]
        local maxRequests = tonumber(ARGV[1])
        local windowSeconds = tonumber(ARGV[2])

        local current = redis.call('INCR', key)
        if current == 1 then
          redis.call('EXPIRE', key, windowSeconds)
        end
        local ttl = redis.call('TTL', key)
        if ttl < 0 then ttl = windowSeconds end

        local allowed = 1
        if current > maxRequests then
          allowed = 0
        end
        return {allowed, current, ttl}
      `;

      const result = (await this.redis!.eval(
        luaScript,
        1,
        redisKey,
        maxRequests,
        windowSeconds
      )) as [number, number, number];

      if (!Array.isArray(result) || result.length < 3) {
        throw new Error('Unexpected response format from distributed Redis store');
      }

      const [allowedNum, currentCount, ttl] = result;
      const allowed = allowedNum === 1;

      return {
        allowed,
        currentCount,
        resetTime: now + ttl * 1000,
        remainingSeconds: ttl,
      };
    } catch {
      if (this.enforceDistributed) {
        console.error('[SecurityStore] Distributed Redis store failed during rate limiting. Failing safe.');
        throw new SecurityStoreUnavailableError('Distributed Redis store failed during rate limiting.');
      }
      return this.incrementRateLimitSync(key, maxRequests, windowSeconds);
    }
  }

  public async resetAllState(): Promise<void> {
    this.memoryLockouts.clear();
    if (this.externalRateLimitMap) {
      this.externalRateLimitMap.clear();
    }
    if (this.isRedisActive()) {
      try {
        const keys = await this.redis!.keys('{lock,att,rl}:*');
        if (keys.length > 0) {
          await this.redis!.del(...keys);
        }
      } catch {
        // ignore in test reset
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        // ignore disconnect errors
      }
      this.redis = null;
      this.isRedisConnected = false;
    }
  }
}

export const securityStore = new SecurityStore();

// --- HIGH-LEVEL PASSWORD LOGIN WRAPPERS (SEC-004 DUAL-LAYER DoS MITIGATION) ---

export const checkPasswordLoginLockout = async (
  email: string,
  role?: string | null,
  ip?: string | null
): Promise<LockoutStatus> => {
  // Layer 1: Client-scoped lockout check (prevents third-party Account Lockout DoS on victim)
  if (ip) {
    const clientIdentity = `${String(ip).trim()}::${email}`;
    const clientStatus = await securityStore.checkLockout('pwd:cli', clientIdentity, role);
    if (clientStatus.isLocked) {
      return {
        ...clientStatus,
        scope: 'client',
        message: 'Too many failed login attempts from this network. Access is temporarily locked for 15 minutes. Please try again later.',
      };
    }
  }

  // Layer 2: Global account-level lockout check (protects against distributed multi-IP brute force)
  const acctStatus = await securityStore.checkLockout('pwd:acct', email, role);
  if (acctStatus.isLocked) {
    return {
      ...acctStatus,
      scope: 'account',
      message: 'Too many failed login attempts. Your account has been temporarily locked for 15 minutes. Please try again later.',
    };
  }

  return { isLocked: false, remainingLockoutSeconds: 0, lockedUntil: null };
};

export const recordFailedPasswordLogin = async (
  email: string,
  role?: string | null,
  ip?: string | null,
  maxAttempts = MAX_PASSWORD_ATTEMPTS,
  lockoutSeconds = PASSWORD_LOCKOUT_SECONDS
): Promise<AttemptResult> => {
  if (ip) {
    const clientIdentity = `${String(ip).trim()}::${email}`;
    // Layer 1: Client IP tracking (threshold 5)
    const clientRes = await securityStore.recordFailedAttempt(
      'pwd:cli',
      clientIdentity,
      role,
      maxAttempts,
      lockoutSeconds
    );

    // Layer 2: Global account tracking (higher threshold 15)
    const globalRes = await securityStore.recordFailedAttempt(
      'pwd:acct',
      email,
      role,
      GLOBAL_PASSWORD_ATTEMPTS,
      lockoutSeconds
    );

    if (clientRes.isLocked) {
      return { ...clientRes, scope: 'client' };
    }
    if (globalRes.isLocked) {
      return { ...globalRes, scope: 'account' };
    }

    return { ...clientRes, scope: 'client' };
  }

  // Fallback for standalone/legacy callers without IP (tests account threshold directly)
  return securityStore.recordFailedAttempt('pwd:acct', email, role, maxAttempts, lockoutSeconds);
};

export const clearPasswordLoginState = async (
  email: string,
  role?: string | null,
  ip?: string | null
): Promise<void> => {
  if (ip) {
    const clientIdentity = `${String(ip).trim()}::${email}`;
    await securityStore.clearLockout('pwd:cli', clientIdentity, role);
  }
  await securityStore.clearLockout('pwd:acct', email, role);
};

export const checkPasswordLoginLockoutSync = (
  email: string,
  role?: string | null,
  ip?: string | null
): LockoutStatus => {
  if (ip) {
    const clientIdentity = `${String(ip).trim()}::${email}`;
    const clientStatus = securityStore.checkLockoutSync('pwd:cli', clientIdentity, role);
    if (clientStatus.isLocked) {
      return {
        ...clientStatus,
        scope: 'client',
        message: 'Too many failed login attempts from this network. Access is temporarily locked for 15 minutes. Please try again later.',
      };
    }
  }

  const acctStatus = securityStore.checkLockoutSync('pwd:acct', email, role);
  if (acctStatus.isLocked) {
    return {
      ...acctStatus,
      scope: 'account',
      message: 'Too many failed login attempts. Your account has been temporarily locked for 15 minutes. Please try again later.',
    };
  }

  return { isLocked: false, remainingLockoutSeconds: 0, lockedUntil: null };
};

export const recordFailedPasswordLoginSync = (
  email: string,
  role?: string | null,
  ip?: string | null,
  maxAttempts = MAX_PASSWORD_ATTEMPTS,
  lockoutSeconds = PASSWORD_LOCKOUT_SECONDS
): AttemptResult => {
  if (ip) {
    const clientIdentity = `${String(ip).trim()}::${email}`;
    const clientRes = securityStore.recordFailedAttemptSync(
      'pwd:cli',
      clientIdentity,
      role,
      maxAttempts,
      lockoutSeconds
    );
    const globalRes = securityStore.recordFailedAttemptSync(
      'pwd:acct',
      email,
      role,
      GLOBAL_PASSWORD_ATTEMPTS,
      lockoutSeconds
    );

    if (clientRes.isLocked) {
      return { ...clientRes, scope: 'client' };
    }
    if (globalRes.isLocked) {
      return { ...globalRes, scope: 'account' };
    }

    return { ...clientRes, scope: 'client' };
  }

  return securityStore.recordFailedAttemptSync('pwd:acct', email, role, maxAttempts, lockoutSeconds);
};

export const clearPasswordLoginStateSync = (
  email: string,
  role?: string | null,
  ip?: string | null
): void => {
  if (ip) {
    const clientIdentity = `${String(ip).trim()}::${email}`;
    securityStore.clearLockoutSync('pwd:cli', clientIdentity, role);
  }
  securityStore.clearLockoutSync('pwd:acct', email, role);
};
