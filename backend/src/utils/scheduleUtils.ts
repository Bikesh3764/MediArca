export interface DoctorSlot {
  id: string;
  name: string;
  startTime: string; // "09:00"
  endTime: string; // "11:00"
  maxPatients: number; // e.g. 50
  avgConsultationMinutes: number; // e.g. 2.4
}

// Convert "09:00" or "09:00 AM" to minutes from midnight
export const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const clean = timeStr.replace(/\s*(AM|PM)/i, '').trim();
  const [hStr, mStr] = clean.split(':');
  let h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  if (timeStr.toUpperCase().includes('PM') && h < 12) h += 12;
  if (timeStr.toUpperCase().includes('AM') && h === 12) h = 0;
  return h * 60 + m;
};

// Convert minutes from midnight to "09:20 AM"
export const minutesTo12Hour = (totalMinutes: number): string => {
  const normalized = ((Math.floor(totalMinutes) % (24 * 60)) + (24 * 60)) % (24 * 60);
  let hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

// Format "09:00" to "09:00 AM"
export const format12Hour = (time24: string): string => {
  if (!time24) return '09:00 AM';
  if (time24.includes('AM') || time24.includes('PM')) return time24;
  return minutesTo12Hour(timeToMinutes(time24));
};

// Calculate duration and dynamic avg consultation minutes:
// formula: (slotDurationInMinutes / maxPatients)
export const calculateSlotMetrics = (
  startTime: string,
  endTime: string,
  maxPatients: number
): { durationMinutes: number; avgConsultationMinutes: number } => {
  const startMins = timeToMinutes(startTime);
  let endMins = timeToMinutes(endTime);
  if (endMins <= startMins) {
    endMins += 24 * 60;
  }
  const durationMinutes = Math.max(1, endMins - startMins);
  const safeMax = Math.max(1, maxPatients || 1);
  const rawAvg = durationMinutes / safeMax;
  const avgConsultationMinutes = Math.round(rawAvg * 10) / 10;
  return { durationMinutes, avgConsultationMinutes };
};

// Parse slots from doctor profile
export const parseDoctorSlots = (doctor: any): DoctorSlot[] => {
  if (doctor?.slots) {
    try {
      const parsed = typeof doctor.slots === 'string' ? JSON.parse(doctor.slots) : doctor.slots;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((s: any, idx: number) => {
          const startTime = s.startTime || '09:00';
          const endTime = s.endTime || '11:00';
          const maxPatients = Number(s.maxPatients) || 50;
          const { avgConsultationMinutes } = calculateSlotMetrics(startTime, endTime, maxPatients);
          return {
            id: s.id || `slot_${idx + 1}`,
            name: s.name || `Slot ${idx + 1} (${format12Hour(startTime)} – ${format12Hour(endTime)})`,
            startTime,
            endTime,
            maxPatients,
            avgConsultationMinutes: s.avgConsultationMinutes || avgConsultationMinutes,
          };
        });
      }
    } catch (e) {
      console.warn('Failed to parse doctor slots:', e);
    }
  }

  // Fallback single slot from legacy checkingStartTime & checkingEndTime
  const startTime = doctor?.checkingStartTime || '09:00';
  const endTime = doctor?.checkingEndTime || '13:00';
  const maxPatients = Number(doctor?.maxDailyPatients) || 25;
  const { avgConsultationMinutes } = calculateSlotMetrics(startTime, endTime, maxPatients);

  return [
    {
      id: 'slot_1',
      name: `Shift 1 (${format12Hour(startTime)} – ${format12Hour(endTime)})`,
      startTime,
      endTime,
      maxPatients,
      avgConsultationMinutes: doctor?.avgConsultationMinutes || avgConsultationMinutes,
    },
  ];
};

export interface SlotStatusResult {
  slot: DoctorSlot;
  isToday: boolean;
  isPassed: boolean;
  isInProgress: boolean;
  isUpcoming: boolean;
  isFull: boolean;
  totalBooked: number;
  patientsAhead: number;
  estimatedTime: string;
  statusLabel: string;
}

export const getLocalDateString = (d: Date = new Date()): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  } catch {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

export const getIndianTimeMinutes = (d: Date = new Date()): number => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(d);
    let hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    if (hour === 24) hour = 0;
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    return hour * 60 + minute;
  } catch {
    return d.getHours() * 60 + d.getMinutes();
  }
};

export const evaluateSlotStatus = (
  slot: DoctorSlot,
  appointmentDate: string,
  bookedCountForSlot: number,
  now = new Date(),
  overrideCurrentMinutes?: number,
  activeWaitingCount?: number
): SlotStatusResult => {
  const localYear = now.getFullYear();
  const localMonth = String(now.getMonth() + 1).padStart(2, '0');
  const localDay = String(now.getDate()).padStart(2, '0');
  const localTodayStr = `${localYear}-${localMonth}-${localDay}`;
  const istTodayStr = getLocalDateString(now);

  const isToday = appointmentDate === localTodayStr || appointmentDate === istTodayStr;
  const isPastDate = appointmentDate < localTodayStr && appointmentDate < istTodayStr;

  let currentMinutes: number;
  if (typeof overrideCurrentMinutes === 'number' && !isNaN(overrideCurrentMinutes)) {
    currentMinutes = overrideCurrentMinutes;
  } else if (now.getTimezoneOffset() === 0) {
    // When running on UTC server (Render cloud production), use IST minutes
    currentMinutes = getIndianTimeMinutes(now);
  } else {
    currentMinutes = now.getHours() * 60 + now.getMinutes();
  }

  const slotStartMins = timeToMinutes(slot.startTime);
  let slotEndMins = timeToMinutes(slot.endTime);
  if (slotEndMins <= slotStartMins) {
    slotEndMins += 24 * 60;
  }

  // Active waiting/in-consultation patients count toward estimated wait time; completed patients are not ahead
  const patientsAhead = typeof activeWaitingCount === 'number' ? activeWaitingCount : bookedCountForSlot;
  let isPassed = false;
  let isInProgress = false;
  let isUpcoming = false;
  let statusLabel = 'Available';
  let estimatedTime = '';

  // Check if slot has reached maximum allowed patients
  const isCapacityFull = bookedCountForSlot >= slot.maxPatients;
  const isFull = isCapacityFull;

  if (isPastDate) {
    isPassed = true;
    statusLabel = 'Date Expired';
    estimatedTime = 'Date Expired';
  } else if (isToday) {
    if (currentMinutes >= slotEndMins) {
      // Time has passed for this slot today!
      isPassed = true;
      statusLabel = 'Shift Ended for Today';
      estimatedTime = 'Shift Ended';
    } else if (currentMinutes >= slotStartMins && currentMinutes < slotEndMins) {
      // Active in-progress right now!
      isInProgress = true;
      statusLabel = isFull ? 'Fully Booked' : 'Active Now • In Progress';
      const offsetMins = patientsAhead * slot.avgConsultationMinutes;
      // When active, next consultation cannot happen before current time
      const estTotal = Math.max(slotStartMins + offsetMins, currentMinutes + offsetMins);
      estimatedTime = isFull ? 'Shift Full' : minutesTo12Hour(estTotal);
    } else {
      // Before slot start time today
      isUpcoming = true;
      statusLabel = isFull ? 'Fully Booked' : 'Upcoming Today';
      const offsetMins = patientsAhead * slot.avgConsultationMinutes;
      const estTotal = slotStartMins + offsetMins;
      estimatedTime = isFull ? 'Shift Full' : minutesTo12Hour(estTotal);
    }
  } else {
    // Future date
    isUpcoming = true;
    statusLabel = isFull ? 'Fully Booked' : 'Upcoming';
    const offsetMins = patientsAhead * slot.avgConsultationMinutes;
    const estTotal = slotStartMins + offsetMins;
    estimatedTime = isFull ? 'Shift Full' : minutesTo12Hour(estTotal);
  }

  return {
    slot,
    isToday,
    isPassed,
    isInProgress,
    isUpcoming,
    isFull,
    totalBooked: bookedCountForSlot,
    patientsAhead,
    estimatedTime,
    statusLabel,
  };
};

/**
 * Validates strict YYYY-MM-DD calendar date semantics
 */
export const isValidAppointmentDate = (dateStr: any): boolean => {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (year < 2020 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
};

/**
 * Validates strict YYYY-MM-DD calendar date semantics for date of birth.
 * Accepts years from 1900 up to the current calendar date, disallowing future dates.
 */
export const isValidDobDate = (dateStr: any): boolean => {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return false;
  }
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return d.getTime() <= todayUtc;
};

/**
 * Masks patient name for public doctor review display (e.g., "John Doe" -> "John D.")
 */
export const maskPatientName = (name?: string | null): string => {
  if (!name || !name.trim()) return 'Verified Patient';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return `${parts[0][0]}.`;
  }
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

/**
 * Centrally validates doctor checking slot schedule structure
 * Ensures valid 24h times, positive capacity, non-overlapping windows, and unique slot IDs.
 */
export const validateDoctorSlots = (
  slots: any[]
): { valid: boolean; error?: string; formatted?: DoctorSlot[] } => {
  if (!Array.isArray(slots) || slots.length === 0) {
    return { valid: false, error: 'At least one checking slot shift is required.' };
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const formatted: DoctorSlot[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const sTime = String(s.startTime || '').trim();
    const eTime = String(s.endTime || '').trim();

    if (!timeRegex.test(sTime) || !timeRegex.test(eTime)) {
      return {
        valid: false,
        error: `Slot ${i + 1} has invalid time format. Times must be in 24-hour HH:mm format (e.g. 09:00, 13:00).`,
      };
    }

    const startMins = timeToMinutes(sTime);
    const endMins = timeToMinutes(eTime);
    if (endMins <= startMins) {
      return {
        valid: false,
        error: `Slot ${i + 1} end time (${eTime}) must be after start time (${sTime}).`,
      };
    }

    const rawMax = Number(s.maxPatients);
    if (!Number.isFinite(rawMax) || Math.floor(rawMax) < 1 || Math.floor(rawMax) > 500) {
      return {
        valid: false,
        error: `Slot ${i + 1} maxPatients must be a finite integer between 1 and 500 patients.`,
      };
    }
    const maxPatients = Math.floor(rawMax);

    const slotId = String(s.id || `slot_${i + 1}`).trim();
    if (seenIds.has(slotId)) {
      return {
        valid: false,
        error: `Duplicate slot ID '${slotId}' found. Each slot must have a unique ID.`,
      };
    }
    seenIds.add(slotId);

    const { avgConsultationMinutes: calculatedAvg } = calculateSlotMetrics(sTime, eTime, maxPatients);
    const customAvg = Number(s.avgConsultationMinutes);
    const avgConsultationMinutes =
      Number.isFinite(customAvg) && customAvg >= 0.5 && customAvg <= 180
        ? Math.round(customAvg * 10) / 10
        : calculatedAvg;

    formatted.push({
      id: slotId,
      name: s.name ? String(s.name).trim() : `Slot ${i + 1} (${format12Hour(sTime)} – ${format12Hour(eTime)})`,
      startTime: sTime,
      endTime: eTime,
      maxPatients,
      avgConsultationMinutes,
    });
  }

  // Check for overlapping shifts
  const sorted = [...formatted].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = timeToMinutes(sorted[i - 1].endTime);
    const currStart = timeToMinutes(sorted[i].startTime);
    if (currStart < prevEnd) {
      return {
        valid: false,
        error: `Overlapping checking slots detected: '${sorted[i - 1].name}' ends at ${sorted[i - 1].endTime}, which overlaps with '${sorted[i].name}' starting at ${sorted[i].startTime}.`,
      };
    }
  }

  return { valid: true, formatted };
};

/**
 * Validates doctor numeric credentials and schedule boundaries (Finding M7 & M8)
 * Enforces Number.isFinite() and realistic clinical bounds.
 */
export const validateDoctorNumericBounds = (data: {
  experienceYears?: any;
  consultationFee?: any;
  avgConsultationMinutes?: any;
  maxDailyPatients?: any;
}): {
  valid: boolean;
  error?: string;
  sanitized: {
    experienceYears: number;
    consultationFee: number;
    avgConsultationMinutes: number;
    maxDailyPatients: number;
  };
} => {
  let experienceYears = 1;
  if (data.experienceYears !== undefined && data.experienceYears !== null && data.experienceYears !== '') {
    const rawExp = Number(data.experienceYears);
    if (!Number.isFinite(rawExp) || rawExp < 0 || rawExp > 75) {
      return {
        valid: false,
        error: 'Experience must be a valid number between 0 and 75 years.',
        sanitized: { experienceYears: 1, consultationFee: 50, avgConsultationMinutes: 15, maxDailyPatients: 30 },
      };
    }
    experienceYears = Math.floor(rawExp);
  }

  let consultationFee = 50;
  if (data.consultationFee !== undefined && data.consultationFee !== null && data.consultationFee !== '') {
    const rawFee = Number(data.consultationFee);
    if (!Number.isFinite(rawFee) || rawFee < 0 || rawFee > 100000) {
      return {
        valid: false,
        error: 'Consultation fee must be a valid number between 0 and 100,000.',
        sanitized: { experienceYears, consultationFee: 50, avgConsultationMinutes: 15, maxDailyPatients: 30 },
      };
    }
    consultationFee = Math.round(rawFee * 100) / 100;
  }

  let avgConsultationMinutes = 15;
  if (data.avgConsultationMinutes !== undefined && data.avgConsultationMinutes !== null && data.avgConsultationMinutes !== '') {
    const rawAvg = Number(data.avgConsultationMinutes);
    if (!Number.isFinite(rawAvg) || rawAvg < 1 || rawAvg > 180) {
      return {
        valid: false,
        error: 'Average consultation time must be a valid number between 1 and 180 minutes.',
        sanitized: { experienceYears, consultationFee, avgConsultationMinutes: 15, maxDailyPatients: 30 },
      };
    }
    avgConsultationMinutes = Math.round(rawAvg * 10) / 10;
  }

  let maxDailyPatients = 30;
  if (data.maxDailyPatients !== undefined && data.maxDailyPatients !== null && data.maxDailyPatients !== '') {
    const rawMax = Number(data.maxDailyPatients);
    if (!Number.isFinite(rawMax) || rawMax < 1 || rawMax > 500) {
      return {
        valid: false,
        error: 'Daily patient capacity must be a valid number between 1 and 500.',
        sanitized: { experienceYears, consultationFee, avgConsultationMinutes, maxDailyPatients: 30 },
      };
    }
    maxDailyPatients = Math.floor(rawMax);
  }

  return {
    valid: true,
    sanitized: { experienceYears, consultationFee, avgConsultationMinutes, maxDailyPatients },
  };
};

