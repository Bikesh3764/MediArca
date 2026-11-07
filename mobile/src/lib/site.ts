// Website links the app hands out (QR codes, receptionist sign-in). Same pages as the website.
export const SITE_URL = 'https://mediarca.in';

/** Front desk check-in QR: the patient app scans it (shared/src/utils/checkinQr.ts reads it). */
export const checkinQrUrl = (clinicId: string, code?: string | null) =>
  `${SITE_URL}/clinic-checkin?clinicId=${encodeURIComponent(clinicId)}${code ? `&code=${encodeURIComponent(code)}` : ''}`;

/** Booking QR: opens the clinic page. */
export const clinicBookingUrl = (clinicId: string) => `${SITE_URL}/clinics/${encodeURIComponent(clinicId)}`;

export const receptionistLoginUrl = `${SITE_URL}/receptionist/login`;

/** A doctor's public page, where patients book. */
export const doctorBookingUrl = (doctorId: string) => `${SITE_URL}/doctor/${encodeURIComponent(doctorId)}`;

/** Track walk-in page (mobile number + code). */
export const trackUrl = `${SITE_URL}/track`;

/** Help and legal pages (Account / Profile, sign-up). */
export const helpUrl = `${SITE_URL}/faq`;
export const contactUrl = `${SITE_URL}/contact`;
export const privacyUrl = `${SITE_URL}/privacy`;
export const termsUrl = `${SITE_URL}/terms`;
