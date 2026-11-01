import { cleanSlotName, shiftLabel } from '../../../services/api';

export interface TokenPassData {
  queueNumber: number;
  estimatedTime?: string;
  checkingWindow?: string;
  shiftTime?: string | null;
  appointmentDate: string;
  patientName: string;
  patientPhone?: string;
  doctorName: string;
  doctorSpecialty?: string;
  clinicName?: string;
  clinicAddress?: string;
  /** Code the patient uses with their mobile number to track the queue (FIX-058). */
  walkInCode?: string | null;
}
export const cleanDoctorName = (name?: string | null): string => {
  if (!name) return 'Doctor';
  const trimmed = name.trim();
  return /^dr\.?\s+/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
};
export const getCleanReason = (reason?: string | null, patientName?: string | null): string | null => {
  if (!reason) return null;
  const r = reason.trim();
  if (!r) return null;

  const normReason = r.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normName = (patientName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normName && (normName.includes(normReason) || normReason.includes(normName))) {
    return null;
  }

  const lower = r.toLowerCase();
  if (
    lower.includes('walkin') ||
    lower.includes('walk-in') ||
    lower.includes('verification') ||
    lower.includes('approval test') ||
    lower === 'general consultation' ||
    lower === 'general medical consultation' ||
    lower === 'routine checkup' ||
    lower === 'consultation' ||
    lower === 'checkup' ||
    lower === 'general visit' ||
    lower === 'clinic walk-in consultation' ||
    lower === 'rapid walk-in consultation'
  ) {
    return null;
  }

  return r;
};
// Keeps the doctor's own shift name ("Morning Shift"); it used to strip "Morning"/"Evening",
// which merged different shifts into one "Shift" group.
/** A visit's shift as shown on the desk: its timing when known ("9:00 AM – 1:00 PM"), else its name. */
export const cleanShiftDisplayName = (visit?: string | { shiftTime?: string | null; checkingWindow?: string | null } | null): string =>
  typeof visit === 'string' || !visit ? cleanSlotName(visit, 'Shift 1') : shiftLabel(visit, 'Shift 1');
