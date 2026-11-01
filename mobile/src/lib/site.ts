// Website links the app hands out (QR codes, receptionist sign-in). Same pages as the website.
export const SITE_URL = 'https://mediarca.in';

/** Front desk check-in QR: the patient app scans it (shared/src/utils/checkinQr.ts reads it). */
export const checkinQrUrl = (clinicId: string, code?: string | null) =>
  `${SITE_URL}/clinic-checkin?clinicId=${encodeURIComponent(clinicId)}${code ? `&code=${encodeURIComponent(code)}` : ''}`;

/** Booking QR: opens the clinic page. */
export const clinicBookingUrl = (clinicId: string) => `${SITE_URL}/clinics/${encodeURIComponent(clinicId)}`;

export const receptionistLoginUrl = `${SITE_URL}/receptionist/login`;
