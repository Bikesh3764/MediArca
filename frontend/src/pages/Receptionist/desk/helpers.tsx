
export interface TokenPassData {
  queueNumber: number;
  estimatedTime?: string;
  checkingWindow?: string;
  appointmentDate: string;
  patientName: string;
  patientPhone?: string;
  doctorName: string;
  doctorSpecialty?: string;
  clinicName?: string;
  clinicAddress?: string;
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
export const cleanShiftDisplayName = (shiftStr?: string | null): string => {
  if (!shiftStr || !shiftStr.trim()) return 'Shift 1';
  const shiftNumMatch = shiftStr.match(/shift\s*(\d+)/i);
  if (shiftNumMatch) {
    return `Shift ${shiftNumMatch[1]}`;
  }
  let cleaned = shiftStr.replace(/\s*\([^)]*\)/g, '').trim();
  cleaned = cleaned.replace(/\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\s*[-–to]\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?/gi, '').trim();
  cleaned = cleaned.replace(/\s*(?:morning|afternoon|evening|night)/gi, '').trim();
  return cleaned || 'Shift 1';
};
