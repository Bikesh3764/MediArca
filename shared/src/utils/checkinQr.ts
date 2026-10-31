// Reading the clinic QR codes in the app. Same rules as the website scanner
// (frontend/src/components/common/CameraQrScannerModal.tsx parseQrText) — keep both in step.
// Desk check-in QR: .../clinic-checkin?clinicId=X&code=Y (or JSON {clinicId, code}).
// Booking QR: .../clinics/X (no code) — it opens the clinic page, it never checks anyone in.

const readParam = (query: string, name: string): string => {
  for (const part of query.split('&')) {
    const eq = part.indexOf('=');
    const key = eq === -1 ? part : part.slice(0, eq);
    if (key === name) {
      try {
        return decodeURIComponent((eq === -1 ? '' : part.slice(eq + 1)).replace(/\+/g, ' '));
      } catch {
        return '';
      }
    }
  }
  return '';
};

/** clinicId + code from the desk check-in QR, or null for anything else. */
export const parseCheckinQr = (text: string): { clinicId: string; code: string } | null => {
  const raw = String(text || '').trim();
  try {
    if (raw.includes('clinicId')) {
      const query = (raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : raw).split('#')[0];
      const clinicId = readParam(query, 'clinicId');
      const code = readParam(query, 'code') || readParam(query, 'checkinCode');
      if (clinicId && code) return { clinicId, code };
    }
    if (raw.startsWith('{') && raw.endsWith('}')) {
      const parsed = JSON.parse(raw);
      if (parsed?.clinicId) return { clinicId: String(parsed.clinicId), code: String(parsed.code || parsed.checkinCode || '') };
    }
  } catch {
    // Not one of ours
  }
  return null;
};

/** Clinic id from the booking QR (…/clinics/X), or null. */
export const parseBookingQr = (text: string): string | null => {
  const raw = String(text || '').trim();
  const match = raw.match(/\/clinics\/([^/?#\s]+)/);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }
  if (raw.includes('clinicId=') && !parseCheckinQr(raw)) {
    const query = raw.slice(raw.indexOf('?') + 1).split('#')[0];
    return readParam(query, 'clinicId') || null;
  }
  return null;
};
