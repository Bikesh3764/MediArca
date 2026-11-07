// Booking rules shared by the doctor profile and booking screens.
// Same logic as frontend/src/pages/Patient/DoctorDetail.tsx and BookAppointment.tsx.
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type React from 'react';
import {
  type Doctor,
  type QueuePreview,
  getLocalDateString,
  getMaxBookingDateString,
  parseDoctorSlots,
} from '@mediarca/shared/api';

type McIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Specialty choices in Filters (same list as the website home page). Filled icons read better small. */
export const SPECIALTY_TILES: { label: string; value: string; icon: McIcon }[] = [
  { label: 'All', value: 'All', icon: 'view-grid' },
  { label: 'General', value: 'General Medicine', icon: 'stethoscope' },
  { label: 'Children', value: 'Pediatrics', icon: 'baby-face' },
  { label: 'Women', value: 'Gynecology & Obstetrics', icon: 'gender-female' },
  { label: 'Skin', value: 'Dermatology', icon: 'face-woman-shimmer' },
  { label: 'Bones', value: 'Orthopedics', icon: 'arm-flex' },
  { label: 'Heart', value: 'Cardiology', icon: 'heart-pulse' },
  { label: 'ENT', value: 'ENT / Otorhinolaryngology', icon: 'ear-hearing' },
  { label: 'Dental', value: 'Dentistry', icon: 'tooth' },
  { label: 'Eyes', value: 'Ophthalmology', icon: 'eye' },
  { label: 'Brain', value: 'Neurology', icon: 'brain' },
];

/** "Rahul Sharma" → "Dr. Rahul Sharma", without doubling an existing "Dr.". */
export const doctorName = (name?: string | null) => {
  const n = (name || 'Doctor').trim();
  return /^dr\.?\s/i.test(n) ? n : `Dr. ${n}`;
};

/** Clinics with a receptionist first, since only those take online bookings. */
/** A desk person's name without the "(Front Desk)" tag the server adds. */
export const deskName = (name?: string | null) => (name || '').replace(/\s*\([^)]*\)\s*$/, '').trim();

export const sortClinics =(doctor: Doctor) =>
  [...(doctor.clinics || [])].sort((a, b) => Number(Boolean(b.hasReceptionist)) - Number(Boolean(a.hasReceptionist)));

export const clinicFor = (doctor: Doctor | null, clinicId?: string | null) =>
  doctor?.clinics?.find((c) => c.clinicId === clinicId) || doctor?.clinics?.[0];

export const slotsFor = (doctor: Doctor, clinicId?: string | null) => {
  const clinic = clinicFor(doctor, clinicId);
  return clinic?.slots && clinic.slots.length > 0 ? clinic.slots : parseDoctorSlots(doctor);
};

export const feeFor = (doctor: Doctor | null, clinicId?: string | null, preview?: QueuePreview | null) =>
  clinicFor(doctor, clinicId)?.consultationFee ?? preview?.consultationFee ?? doctor?.consultationFee ?? 0;

/** Receptionists at the chosen clinic, for the "call to pay" card. */
export const receptionistsFor = (doctor: Doctor, clinicId?: string | null) => {
  const clinic = clinicFor(doctor, clinicId);
  const list: { id: string; name: string; phone?: string }[] = [];
  const add = (r: { id: string; name: string; phone?: string }) => {
    if (!list.some((item) => (r.phone && item.phone === r.phone) || item.name === r.name)) list.push(r);
  };
  (doctor.receptionists || []).forEach((r) => {
    if (!clinicId || !r.clinicId || r.clinicId === clinicId) add({ id: r.id, name: r.name, phone: r.phone || undefined });
  });
  (clinic?.receptionists || []).forEach((r) => add({ id: r.id, name: r.name, phone: r.phone || undefined }));
  return list;
};

export const clinicTakesBookings = (doctor: Doctor, clinicId?: string | null, preview?: QueuePreview | null) => {
  if (preview && typeof preview.hasReceptionist === 'boolean') return preview.hasReceptionist;
  return receptionistsFor(doctor, clinicId).length > 0 || Boolean(clinicFor(doctor, clinicId)?.hasReceptionist);
};

const titleDay = (d: string) => d.charAt(0) + d.slice(1).toLowerCase();

/** Why this choice can't be booked, as a short button label and message. Null when it can. */
export const bookingBlock = (
  doctor: Doctor,
  clinicId: string | null,
  preview: QueuePreview | null
): { button: string; message: string } | null => {
  if (!doctor.clinics || doctor.clinics.length === 0) {
    return { button: 'Booking closed', message: 'This doctor isn’t taking bookings right now.' };
  }
  if (!clinicTakesBookings(doctor, clinicId, preview)) {
    return { button: 'Booking closed', message: 'Online booking is closed at this clinic for now.' };
  }
  if (!preview) return null;
  if (preview.isOnLeave) {
    return {
      button: 'Doctor on leave',
      message: `The doctor is on leave this day${preview.leaveReason ? ` (${preview.leaveReason})` : ''}. Pick another date.`,
    };
  }
  if (preview.isDayOff) {
    const days = (preview.workingDays || ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']).map(titleDay).join(', ');
    return { button: 'Day off', message: `The doctor isn’t here on ${preview.dayName || 'this day'}s. Available: ${days}.` };
  }
  if (preview.isPassed) return { button: 'Shift ended', message: 'This shift has ended. Pick another shift or date.' };
  if (preview.isFull) return { button: 'Shift full', message: 'This shift is full. Pick another shift or date.' };
  return null;
};

/** Bookable dates (IST) from today up to the server's limit. */
export const bookableDates = (): string[] => {
  const today = getLocalDateString();
  const max = getMaxBookingDateString();
  const [y, m, d] = today.split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; i < 120; i++) {
    const s = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
    if (s > max) break;
    out.push(s);
  }
  return out;
};

/** Days the doctor works, as weekday codes, if the server told us. */
export const workingDaysOf = (preview: QueuePreview | null) =>
  preview?.workingDays && preview.workingDays.length > 0 ? new Set(preview.workingDays) : null;
