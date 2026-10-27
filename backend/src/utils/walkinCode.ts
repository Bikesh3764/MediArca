import crypto from 'crypto';

/**
 * Walk-in tracking codes (FIX-058).
 *
 * Staff give every walk-in a 6-character code. The patient types it with their mobile number
 * on the home page to see their live queue. Letters and digits that look alike (0/O, 1/I/L)
 * are left out so the code is easy to read out loud or copy from a slip.
 * Codes are unique per visit date and stop working after that day.
 */
export const WALKIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const WALKIN_CODE_LENGTH = 6;
const WALKIN_CODE_PATTERN = /^[A-HJKMNP-Z2-9]{6}$/;

export const generateWalkinCode = (): string => {
  let code = '';
  for (let i = 0; i < WALKIN_CODE_LENGTH; i++) {
    code += WALKIN_CODE_ALPHABET[crypto.randomInt(WALKIN_CODE_ALPHABET.length)];
  }
  return code;
};

/** Uppercases and strips spaces/dashes; returns null when it can't be a walk-in code. */
export const normalizeWalkinCode = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const code = value.toUpperCase().replace(/[\s-]/g, '');
  return WALKIN_CODE_PATTERN.test(code) ? code : null;
};

/**
 * A code not yet used on this date. The database unique index is the final guard;
 * a clash there makes the booking transaction retry with a new code.
 */
export const pickFreeWalkinCode = async (tx: any, appointmentDate: string): Promise<string> => {
  for (let i = 0; i < 5; i++) {
    const code = generateWalkinCode();
    if (typeof tx?.appointment?.findFirst !== 'function') return code;
    const taken = await tx.appointment.findFirst({
      where: { appointmentDate, walkInCode: code },
      select: { id: true },
    });
    if (!taken) return code;
  }
  return generateWalkinCode();
};
