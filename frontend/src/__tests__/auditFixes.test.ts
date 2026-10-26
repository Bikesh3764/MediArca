import { describe, expect, it } from 'vitest';
import { safeStorage } from '../utils/safeStorage';
import { formatDisplayPhone } from '../utils/phoneUtils';
import { getLocalDateString, getMaxBookingDateString, MAX_BOOKING_DAYS_AHEAD } from '../services/api';

describe('Saved sign-in when browser storage is blocked', () => {
  // Tests run without a browser, so any localStorage access throws, like a blocked browser
  it('keeps working instead of crashing', () => {
    expect(() => safeStorage.setItem('mediarca_token', 'abc')).not.toThrow();
    expect(safeStorage.getItem('mediarca_token')).toBe('abc');
    safeStorage.removeItem('mediarca_token');
    expect(safeStorage.getItem('mediarca_token')).toBeNull();
  });
});

describe('Phone numbers look the same everywhere', () => {
  it('formats the different stored forms one way', () => {
    expect(formatDisplayPhone('9876543210')).toBe('+91 98765 43210');
    expect(formatDisplayPhone('+91 9876543210')).toBe('+91 98765 43210');
    expect(formatDisplayPhone('+919876543210')).toBe('+91 98765 43210');
    expect(formatDisplayPhone('+91 98765 43210')).toBe('+91 98765 43210');
  });
});

describe('Booking date limit', () => {
  it(`allows dates up to ${MAX_BOOKING_DAYS_AHEAD} days ahead (IST)`, () => {
    const now = new Date('2026-10-26T06:00:00Z');
    expect(getLocalDateString(now)).toBe('2026-10-26');
    expect(getMaxBookingDateString(now)).toBe('2027-01-24');
  });
});
