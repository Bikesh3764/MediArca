/**
 * Utilities for formatting and validating Indian (+91) phone numbers.
 */

/**
 * Extracts and sanitizes the 10-digit Indian mobile number from any raw input string.
 * Safely handles:
 * - "+91 9876543210" -> "9876543210"
 * - "+919876543210" -> "9876543210"
 * - "919876543210" -> "9876543210"
 * - "09876543210" -> "9876543210"
 * - "98765 43210" -> "9876543210"
 * - Typing keystrokes: "9", "98", etc. without injecting "91"
 */
export const sanitizeIndianPhone = (raw: string | undefined | null): string => {
  if (!raw) return '';
  let cleaned = raw.trim();

  // Strip explicit +91 or + prefix
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.slice(3).trim();
  } else if (cleaned.startsWith('+')) {
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

/**
 * Formats a 10-digit Indian phone number with the "+91 " prefix.
 * Returns empty string if no digits are provided.
 */
export const formatIndianPhone = (raw: string | undefined | null): string => {
  const digits = sanitizeIndianPhone(raw);
  return digits ? `+91 ${digits}` : '';
};

/**
 * Validates whether the given string contains a valid 10-digit Indian mobile number.
 */
export const isValidIndianPhone = (raw: string | undefined | null): boolean => {
  const digits = sanitizeIndianPhone(raw);
  return digits.length === 10;
};
