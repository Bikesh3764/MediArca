/**
 * Picks which existing patient account a staff walk-in belongs to.
 *
 * Staff type a name and a phone number. We only reuse an account whose name matches
 * what they typed. Otherwise a phone number alone would reveal who owns it (their
 * name, and the visit would land in a stranger's app). With no match the caller
 * creates a separate walk-in record.
 */
const normalizeName = (name: unknown): string =>
  String(name ?? '')
    .trim()
    .replace(/^dr\.?\s+/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

const isSynthetic = (u: any): boolean => {
  const em = String(u?.email || '').toLowerCase();
  return em.endsWith('@mediarca.local') || em.startsWith('walkin.');
};

export const pickWalkinAccount = <T extends { fullName?: string | null; email?: string | null; isEmailVerified?: boolean | null }>(
  candidates: T[] | null | undefined,
  patientName: unknown
): T | null => {
  const wanted = normalizeName(patientName);
  if (!wanted || !Array.isArray(candidates) || candidates.length === 0) return null;
  const sameName = candidates.filter((u) => normalizeName(u.fullName) === wanted);
  if (sameName.length === 0) return null;
  return (
    sameName.find((u) => !isSynthetic(u) && u.isEmailVerified !== false) ||
    sameName.find((u) => !isSynthetic(u)) ||
    sameName[0]
  );
};
