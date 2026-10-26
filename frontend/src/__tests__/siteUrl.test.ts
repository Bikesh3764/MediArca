import { describe, expect, it } from 'vitest';
import { legacyHashToPath } from '../utils/siteUrl';

describe('Old #/ links still work', () => {
  it('turns printed QR poster links into clean addresses', () => {
    expect(legacyHashToPath('', '#/clinic-checkin?clinicId=abc&code=x1')).toBe('/clinic-checkin?clinicId=abc&code=x1');
    expect(legacyHashToPath('', '#/doctor/dashboard')).toBe('/doctor/dashboard');
    expect(legacyHashToPath('', '#/')).toBe('/');
  });

  it('keeps the GitHub Pages folder', () => {
    expect(legacyHashToPath('/MediArca', '#/doctors')).toBe('/MediArca/doctors');
  });

  it('leaves normal addresses and in-page anchors alone', () => {
    expect(legacyHashToPath('', '')).toBeNull();
    expect(legacyHashToPath('', '#faq')).toBeNull();
  });
});
