/**
 * Utilities for formatting and validating Indian (+91) phone numbers.
 */

export const sanitizeIndianPhone = (raw: string | undefined | null): string => {
  if (!raw) return '';
  let cleaned = raw.trim();

  // Strip explicit +91 or + prefix
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.slice(3).trim();
  } else if (cleaned.startsWith('+') && /^\+[6-9]/.test(cleaned)) {
    // If user typed + before an Indian mobile starting with 6-9
    cleaned = cleaned.slice(1).trim();
  }

  // Extract digits only
  let digits = cleaned.replace(/\D/g, '');

  // If user pasted a 12-digit number starting with 91 (e.g. 919876543210)
  if (digits.length > 10 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    // If user typed 11 digits starting with 0 (e.g. 09876543210)
    digits = digits.slice(1);
  }

  // Clamp to max 10 digits
  return digits.slice(0, 10);
};

export const formatIndianPhone = (raw: string | undefined | null): string => {
  const digits = sanitizeIndianPhone(raw);
  return digits ? `+91 ${digits}` : '';
};

export const isValidIndianPhone = (raw: string | undefined | null): boolean => {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;

  // If starts with +, it MUST start with +91
  if (trimmed.startsWith('+')) {
    if (!trimmed.startsWith('+91')) return false;
    const remainder = trimmed.slice(3);
    const digits = remainder.replace(/\D/g, '');
    return digits.length === 10 && /^[6-9]/.test(digits);
  }

  // Without leading +
  const allDigits = trimmed.replace(/\D/g, '');

  // 12 digits starting with country code 91: e.g. 919820012345
  if (allDigits.length === 12 && allDigits.startsWith('91')) {
    const mobileDigits = allDigits.slice(2);
    return /^[6-9]/.test(mobileDigits);
  }

  // 11 digits starting with trunk prefix 0: e.g. 09820012345
  if (allDigits.length === 11 && allDigits.startsWith('0')) {
    const mobileDigits = allDigits.slice(1);
    return /^[6-9]/.test(mobileDigits);
  }

  // Exactly 10 digits starting with 6-9: e.g. 9820012345
  if (allDigits.length === 10) {
    return /^[6-9]/.test(allDigits);
  }

  return false;
};

/**
 * Generates all canonical and legacy storage variants for a 10-digit Indian mobile number
 * so uniqueness checks match regardless of spacing or +91 prefix formatting.
 */
export const getPhoneSearchVariants = (raw: string | undefined | null): string[] => {
  const digits = sanitizeIndianPhone(raw);
  if (!digits || digits.length !== 10 || !/^[6-9]/.test(digits)) {
    return [];
  }
  return Array.from(
    new Set([
      `+91 ${digits}`,
      `+91${digits}`,
      digits,
      `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`,
      `91${digits}`,
      `0${digits}`,
    ])
  );
};

/**
 * Checks if any real (non-synthetic walk-in) user account already holds the given mobile number.
 * Excludes synthetic walk-in placeholder rows (`@mediarca.local` / `walkin.`) and optionally excludes a specific userId.
 */
export const findExistingAccountByPhone = async (
  prismaClient: any,
  rawPhone: string | undefined | null,
  options?: { excludeUserId?: string }
): Promise<{ id: string; email: string; role: string; phone: string | null; isEmailVerified?: boolean } | null> => {
  const variants = getPhoneSearchVariants(rawPhone);
  if (variants.length === 0 || !prismaClient?.user?.findFirst) {
    return null;
  }

  const whereClause: any = {
    phone: { in: variants },
    NOT: [
      { email: { endsWith: '@mediarca.local', mode: 'insensitive' } },
      { email: { startsWith: 'walkin.', mode: 'insensitive' } },
    ],
  };

  if (options?.excludeUserId) {
    whereClause.id = { not: options.excludeUserId };
  }

  return await prismaClient.user.findFirst({
    where: whereClause,
    select: {
      id: true,
      email: true,
      role: true,
      phone: true,
      isEmailVerified: true,
    },
  });
};

