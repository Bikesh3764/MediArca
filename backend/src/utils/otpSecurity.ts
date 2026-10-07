/**
 * MediArca - OTP Security & Abuse Protection Utility (FIX-005)
 *
 * Implements:
 * 1. Account-level brute-force protection (max 5 failed attempts per account -> 15 min lockout)
 * 2. Resend abuse protection (60-second cooldown per account)
 * 3. State reset on successful OTP verification
 * 4. In-memory tracking with periodic pruning (zero Prisma schema modifications)
 */

export interface VerificationLockoutStatus {
  isLocked: boolean;
  remainingLockoutSeconds: number;
  lockedUntil: Date | null;
}

export interface VerificationAttemptResult {
  attempts: number;
  isLocked: boolean;
  remainingAttempts: number;
  lockedUntil: Date | null;
  remainingLockoutSeconds: number;
}

export interface ResendCooldownStatus {
  allowed: boolean;
  remainingSeconds: number;
  isLocked?: boolean;
}

interface VerificationAttemptRecord {
  attempts: number;
  lockedUntil: number | null; // timestamp ms
  lastAttemptAt: number;     // timestamp ms
}

interface ResendRecord {
  lastResentAt: number;      // timestamp ms
}

export const MAX_OTP_VERIFY_ATTEMPTS = 5;
export const OTP_LOCKOUT_MINUTES = 15;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

const verificationAttemptMap = new Map<string, VerificationAttemptRecord>();
const resendCooldownMap = new Map<string, ResendRecord>();

const normalizeEmail = (email: string): string => {
  return String(email || '').toLowerCase().trim();
};

/**
 * Checks whether the given account is currently locked out due to excessive failed OTP attempts.
 * If the lockout period has expired, automatically clears the lockout and resets the attempt count.
 */
export const getVerificationLockout = (email: string, nowMs?: number): VerificationLockoutStatus => {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) {
    return { isLocked: false, remainingLockoutSeconds: 0, lockedUntil: null };
  }

  const record = verificationAttemptMap.get(cleanEmail);
  if (!record || !record.lockedUntil) {
    return { isLocked: false, remainingLockoutSeconds: 0, lockedUntil: null };
  }

  const now = nowMs ?? Date.now();
  if (now < record.lockedUntil) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      isLocked: true,
      remainingLockoutSeconds: remainingSeconds > 0 ? remainingSeconds : 0,
      lockedUntil: new Date(record.lockedUntil),
    };
  }

  // Lockout duration has expired: reset lockout and attempts
  record.lockedUntil = null;
  record.attempts = 0;
  return { isLocked: false, remainingLockoutSeconds: 0, lockedUntil: null };
};

/**
 * Records an incorrect OTP verification attempt for the given account.
 * Triggers a temporary lockout if failed attempts reach maxAttempts (default: 5).
 */
export const recordFailedVerificationAttempt = (
  email: string,
  maxAttempts = MAX_OTP_VERIFY_ATTEMPTS,
  lockoutMinutes = OTP_LOCKOUT_MINUTES,
  nowMs?: number
): VerificationAttemptResult => {
  const cleanEmail = normalizeEmail(email);
  const now = nowMs ?? Date.now();

  if (!cleanEmail) {
    return { attempts: 0, isLocked: false, remainingAttempts: maxAttempts, lockedUntil: null, remainingLockoutSeconds: 0 };
  }

  // Check if already locked out
  const currentLockout = getVerificationLockout(cleanEmail, now);
  if (currentLockout.isLocked) {
    return {
      attempts: maxAttempts,
      isLocked: true,
      remainingAttempts: 0,
      lockedUntil: currentLockout.lockedUntil,
      remainingLockoutSeconds: currentLockout.remainingLockoutSeconds,
    };
  }

  let record = verificationAttemptMap.get(cleanEmail);
  if (!record) {
    record = { attempts: 0, lockedUntil: null, lastAttemptAt: now };
    verificationAttemptMap.set(cleanEmail, record);
  }

  record.attempts += 1;
  record.lastAttemptAt = now;

  if (record.attempts >= maxAttempts) {
    const lockoutUntilMs = now + lockoutMinutes * 60 * 1000;
    record.lockedUntil = lockoutUntilMs;
    const remainingLockoutSeconds = lockoutMinutes * 60;
    return {
      attempts: record.attempts,
      isLocked: true,
      remainingAttempts: 0,
      lockedUntil: new Date(lockoutUntilMs),
      remainingLockoutSeconds,
    };
  }

  return {
    attempts: record.attempts,
    isLocked: false,
    remainingAttempts: Math.max(0, maxAttempts - record.attempts),
    lockedUntil: null,
    remainingLockoutSeconds: 0,
  };
};

/**
 * Clears failed attempt counters and lockout state for the given account.
 * Must be called upon successful OTP verification.
 */
export const clearVerificationState = (email: string): void => {
  const cleanEmail = normalizeEmail(email);
  if (cleanEmail) {
    verificationAttemptMap.delete(cleanEmail);
  }
};

/**
 * Checks whether a resend request is permitted under the 60-second cooldown policy.
 * Also verifies if the account is currently locked out.
 */
export const checkResendCooldown = (
  email: string,
  cooldownSeconds = OTP_RESEND_COOLDOWN_SECONDS,
  nowMs?: number
): ResendCooldownStatus => {
  const cleanEmail = normalizeEmail(email);
  const now = nowMs ?? Date.now();

  if (!cleanEmail) {
    return { allowed: false, remainingSeconds: 0, isLocked: false };
  }

  // 1. Account lockout check
  const lockout = getVerificationLockout(cleanEmail, now);
  if (lockout.isLocked) {
    return {
      allowed: false,
      remainingSeconds: lockout.remainingLockoutSeconds,
      isLocked: true,
    };
  }

  // 2. Cooldown check
  const record = resendCooldownMap.get(cleanEmail);
  if (!record) {
    return { allowed: true, remainingSeconds: 0, isLocked: false };
  }

  const elapsedSeconds = Math.floor((now - record.lastResentAt) / 1000);
  if (elapsedSeconds < cooldownSeconds) {
    const remainingSeconds = cooldownSeconds - elapsedSeconds;
    return {
      allowed: false,
      remainingSeconds: remainingSeconds > 0 ? remainingSeconds : 0,
      isLocked: false,
    };
  }

  return { allowed: true, remainingSeconds: 0, isLocked: false };
};

/**
 * Records an OTP send or resend event to enforce the 60-second cooldown on subsequent requests.
 */
export const recordResendAttempt = (email: string, nowMs?: number): void => {
  const cleanEmail = normalizeEmail(email);
  if (cleanEmail) {
    resendCooldownMap.set(cleanEmail, { lastResentAt: nowMs ?? Date.now() });
  }
};

/**
 * Prunes stale entries from memory to maintain minimal memory footprint in long-running processes.
 */
export const pruneOtpSecurityRecords = (nowMs?: number): void => {
  const now = nowMs ?? Date.now();

  for (const [email, record] of verificationAttemptMap.entries()) {
    const isLockExpired = !record.lockedUntil || now >= record.lockedUntil;
    const isInactive = now - record.lastAttemptAt > 30 * 60 * 1000;
    if (isLockExpired && isInactive) {
      verificationAttemptMap.delete(email);
    }
  }

  for (const [email, record] of resendCooldownMap.entries()) {
    if (now - record.lastResentAt > 10 * 60 * 1000) {
      resendCooldownMap.delete(email);
    }
  }
};

/**
 * Resets all in-memory OTP security tracking state. Useful for test isolation.
 */
export const resetOtpSecurityState = (): void => {
  verificationAttemptMap.clear();
  resendCooldownMap.clear();
};

// Periodic pruning timer (every 60 seconds)
const pruneTimer = setInterval(() => {
  pruneOtpSecurityRecords();
}, 60 * 1000);

if (pruneTimer.unref) {
  pruneTimer.unref();
}
