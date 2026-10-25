import prisma from '../config/database';

/**
 * Sign-out of old sessions after a password change.
 *
 * Tokens last 7 days. When a password changes we remember the time, and any token
 * issued before it is rejected. Kept in memory so `authenticate` stays a zero-query
 * check; it is reloaded from `User.passwordChangedAt` on startup so restarts don't
 * resurrect old sessions. (Single Render instance; share via Redis if you scale out.)
 */
const TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const revokedBefore = new Map<string, number>(); // userId -> unix seconds

export const markPasswordChanged = (userId: string, changedAt: Date = new Date()): void => {
  revokedBefore.set(userId, Math.floor(changedAt.getTime() / 1000));
};

/** True when the token was issued before the user's latest password change. */
export const isTokenRevoked = (userId?: string, issuedAt?: number): boolean => {
  if (!userId || typeof issuedAt !== 'number') return false;
  const cutoff = revokedBefore.get(userId);
  return cutoff !== undefined && issuedAt < cutoff;
};

export const loadRecentPasswordChanges = async (): Promise<number> => {
  try {
    const since = new Date(Date.now() - TOKEN_LIFETIME_MS);
    const users = await prisma.user.findMany({
      where: { passwordChangedAt: { gte: since } },
      select: { id: true, passwordChangedAt: true },
    });
    for (const u of users) {
      if (u.passwordChangedAt) markPasswordChanged(u.id, u.passwordChangedAt);
    }
    return users.length;
  } catch (err) {
    console.error('[Sessions] Could not load recent password changes:', (err as Error)?.message);
    return 0;
  }
};

export const clearRevocationsForTesting = (): void => {
  revokedBefore.clear();
};
