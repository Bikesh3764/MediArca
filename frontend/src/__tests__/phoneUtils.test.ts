import { describe, expect, it } from 'vitest';
import { formatIndianPhone, isValidIndianPhone, sanitizeIndianPhone, toTelUri } from '../utils/phoneUtils';

describe('Indian phone numbers', () => {
  it('reduces any common way of typing a number to 10 digits', () => {
    expect(sanitizeIndianPhone('+91 98765 43210')).toBe('9876543210');
    expect(sanitizeIndianPhone('919876543210')).toBe('9876543210');
    expect(sanitizeIndianPhone('09876543210')).toBe('9876543210');
    expect(sanitizeIndianPhone('')).toBe('');
  });

  it('formats to the stored "+91 XXXXXXXXXX" shape', () => {
    expect(formatIndianPhone('98765-43210')).toBe('+91 9876543210');
    expect(formatIndianPhone(null)).toBe('');
  });

  it('accepts only real Indian mobile numbers', () => {
    expect(isValidIndianPhone('+91 9876543210')).toBe(true);
    expect(isValidIndianPhone('9876543210')).toBe(true);
    expect(isValidIndianPhone('1234567890')).toBe(false); // must start with 6-9
    expect(isValidIndianPhone('+1 9876543210')).toBe(false);
    expect(isValidIndianPhone('98765')).toBe(false);
  });

  it('builds a tap-to-call link', () => {
    expect(toTelUri('+91 9876543210')).toContain('9876543210');
    expect(toTelUri('+91 9876543210').startsWith('tel:')).toBe(true);
  });
});
