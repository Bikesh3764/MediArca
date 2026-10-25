export interface DoctorSlot {
  id: string;
  name: string;
  startTime: string; // "09:00"
  endTime: string; // "11:00"
  maxPatients: number; // e.g. 50
  avgConsultationMinutes: number; // calculated: durationInMinutes / maxPatients (e.g. 120/50 = 2.4)
}

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
  isOnLeave?: boolean;
  leaveReason?: string;
  isDayOff?: boolean;
}

export const ALL_WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export type WeekdayCode = (typeof ALL_WEEKDAYS)[number];

export const WEEKDAY_NAMES: Record<string, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};

export const WEEKDAY_SHORT_NAMES: Record<string, string> = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
  SUN: 'Sun',
};

export const WEEKDAY_SINGLE_LETTERS: Record<string, string> = {
  MON: 'M',
  TUE: 'T',
  WED: 'W',
  THU: 'T',
  FRI: 'F',
  SAT: 'S',
  SUN: 'S',
};

export function formatWeekdaySummary(days: string[] = []): string {
  if (!days || days.length === 0) return 'No days';
  if (days.length === 7) return 'All Days';

  const order = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const sorted = [...days].sort((a, b) => order.indexOf(a) - order.indexOf(b));

  if (sorted.length === 6 && sorted[0] === 'MON' && sorted[5] === 'SAT') return 'Mon – Sat';
  if (sorted.length === 5 && sorted[0] === 'MON' && sorted[4] === 'FRI') return 'Mon – Fri';

  return sorted.map((d) => WEEKDAY_SHORT_NAMES[d] || d).join(', ');
}

export interface DoctorLeave {
  id: string;
  type: 'TODAY' | 'DATE_RANGE';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason?: string;
  clinicId?: string | null;
  clinicName?: string;
  createdAt: string;
  createdByRole: 'DOCTOR' | 'RECEPTIONIST';
  createdByName?: string;
}

export interface DoctorScheduleConfig {
  doctorId: string;
  doctorName: string;
  clinicId?: string | null;
  clinicName?: string | null;
  workingDays: string[];
  leaves: DoctorLeave[];
  slots: DoctorSlot[];
  consultationFee: number;
  isOnLeaveToday: boolean;
  todayLeave?: DoctorLeave | null;
  isWorkingToday: boolean;
}

// Time calculation helpers
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

export const minutesTo12Hour = (totalMinutes: number): string => {
  const normalized = ((Math.floor(totalMinutes) % (24 * 60)) + (24 * 60)) % (24 * 60);
  let hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

export const format12Hour = (time24: string): string => {
  if (!time24) return '09:00 AM';
  if (time24.includes('AM') || time24.includes('PM')) return time24;
  return minutesTo12Hour(timeToMinutes(time24));
};

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

export const cleanSlotName = (name?: string | null, fallback = 'Shift'): string => {
  if (!name || !name.trim()) return fallback;
  const shiftNumMatch = name.match(/shift\s*(\d+)/i);
  if (shiftNumMatch) {
    return `Shift ${shiftNumMatch[1]}`;
  }
  let cleaned = name.replace(/\s*\([^)]*\)/g, '').trim();
  cleaned = cleaned.replace(/\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\s*[-–to]\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?/gi, '').trim();
  cleaned = cleaned.replace(/\s*(?:morning|afternoon|evening|night)/gi, '').trim();
  return cleaned || fallback;
};

export const formatShiftOption = (
  slot: { name?: string | null; startTime?: string; endTime?: string },
  isEnded?: boolean
): string => {
  const baseName = cleanSlotName(slot.name, 'Shift');
  return `${baseName}${isEnded ? ' • Ended' : ''}`;
};

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
            name: cleanSlotName(s.name, `Shift ${idx + 1}`),
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

  const startTime = doctor?.checkingStartTime || '09:00';
  const endTime = doctor?.checkingEndTime || '13:00';
  const maxPatients = Number(doctor?.maxDailyPatients) || 25;
  const { avgConsultationMinutes } = calculateSlotMetrics(startTime, endTime, maxPatients);

  return [
    {
      id: 'slot_1',
      name: 'Shift 1',
      startTime,
      endTime,
      maxPatients,
      avgConsultationMinutes: doctor?.avgConsultationMinutes || avgConsultationMinutes,
    },
  ];
};

export const formatDoctorDegrees = (qualifications?: string | null): string => {
  if (!qualifications || !qualifications.trim()) return 'Certified Specialist';

  // Recognized primary & postgrad medical/dental/AYUSH degrees & recognized clinical PG diplomas
  const RECOGNIZED_DEGREES_MAP: Record<string, string> = {
    MBBS: 'MBBS',
    MD: 'MD',
    MS: 'MS',
    DM: 'DM',
    MCH: 'MCh',
    BDS: 'BDS',
    MDS: 'MDS',
    DNB: 'DNB',
    BAMS: 'BAMS',
    BHMS: 'BHMS',
    BUMS: 'BUMS',
    BSMS: 'BSMS',
    BNYS: 'BNYS',
    BVSC: 'BVSc',
    BPT: 'BPT',
    MPT: 'MPT',
    BOT: 'BOT',
    MOT: 'MOT',
    DO: 'DO',
    PHD: 'PhD',
    MPH: 'MPH',
    MHA: 'MHA',
    DGO: 'DGO',
    DCH: 'DCH',
    DMRD: 'DMRD',
    DORTHO: 'DOrtho',
    DA: 'DA',
    DTCD: 'DTCD',
    DDVL: 'DDVL',
    DVD: 'DVD',
    DPM: 'DPM',
    DOMS: 'DOMS',
    DLO: 'DLO',
    MBCHB: 'MBChB',
    BMBS: 'BMBS',
    BCHIR: 'BChir',
    BMED: 'BMed',
    MRCGP: 'MRCGP',
  };

  // Strip parenthetical text such as "(Cardiology)", "(Pediatrics)", etc. to extract core degree
  const cleanedInput = qualifications.replace(/\([^)]*\)/g, ' ');

  // Non-degree patterns:
  // 1. Fellowships starting with F followed by 2-5 uppercase letters (FACC, FACS, FAAP, FACP, FRCS, FRCP, FRCOG, FICOG, FAGE, FAOI, FIAP, FNB, FAMS, FICO, FICS, FCCP, FCPS, FACR, FAAD, FESC, FAHA, FICM, etc.)
  // 2. Fluff words: fellow, fellowship, diplomate, member, board certified, board eligible, certified, specialist, consultant, physician, surgeon, general
  // 3. Institution/University/Hospital/Location fluff: university, college, school, hospital, institute, academy, faculty, campus, stanford, harvard, hopkins, oxford, cambridge, aiims, pgi, yale, columbia, boston, london, etc.
  const NON_DEGREE_PATTERN = /\b(f[a-z]{2,5}|fellow|fellowship|diplomate|member|board\s*certified|board\s*eligible|certified|specialist|consultant|physician|surgeon|general|university|college|school|hospital|institute|academy|faculty|campus|stanford|harvard|hopkins|oxford|cambridge|aiims|pgi|yale|columbia|boston|london)\b/i;

  const parts = cleanedInput.split(/[,;\n/]+/);
  const collectedDegrees: string[] = [];

  for (const part of parts) {
    const subSegments = part.split(/\s*[-–—]\s*/);
    for (const sub of subSegments) {
      const trimmed = sub.trim().replace(/\.+/g, '');
      if (!trimmed) continue;
      if (NON_DEGREE_PATTERN.test(trimmed)) continue;

      const upper = trimmed.toUpperCase();
      if (RECOGNIZED_DEGREES_MAP[upper]) {
        const canonical = RECOGNIZED_DEGREES_MAP[upper];
        if (!collectedDegrees.includes(canonical)) {
          collectedDegrees.push(canonical);
        }
      }
    }
  }

  if (collectedDegrees.length > 0) {
    return collectedDegrees.join(', ');
  }

  return 'Certified Specialist';
};

export const getLocalDateString = (d: Date = new Date()): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  } catch {
    const istMs = d.getTime() + 330 * 60 * 1000;
    const istDate = new Date(istMs);
    const year = istDate.getUTCFullYear();
    const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istDate.getUTCDate()).padStart(2, '0');
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
    const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();
    return (utcMinutes + 330) % (24 * 60);
  }
};

export const getTomorrowDateString = (d: Date = new Date()): string => {
  const tomorrow = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  return getLocalDateString(tomorrow);
};

export const getDayOfWeekCode = (dateStr?: string): WeekdayCode => {
  const targetStr = dateStr || getLocalDateString();
  const match = targetStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return 'MON';
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const d = new Date(Date.UTC(year, month - 1, day));
  const codes: WeekdayCode[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return codes[d.getUTCDay()] || 'MON';
};

export const DEFAULT_PHONE_PREFIX = '+91 ';

export const ALL_SPECIALTIES: string[] = [
  'General Medicine',
  'Cardiology',
  'Dermatology',
  'Pediatrics',
  'Orthopedics',
  'Neurology',
  'Gynecology & Obstetrics',
  'Gastroenterology',
  'Oncology',
  'Ophthalmology',
  'ENT / Otorhinolaryngology',
  'Pulmonology',
  'Nephrology',
  'Urology',
  'Psychiatry',
  'Endocrinology',
  'Rheumatology',
  'Dentistry',
  'Physiotherapy',
  'General Surgery',
  'Plastic Surgery',
  'Neurosurgery',
  'Cardiothoracic Surgery',
  'Anesthesiology',
  'Radiology',
  'Pathology',
  'Emergency Medicine',
  'Hematology',
  'Allergy & Immunology',
  'Infectious Disease',
  'Ayurveda',
  'Homeopathy',
  'Dietetics & Nutrition',
  'Other',
];

export const evaluateSlotStatus = (
  slot: DoctorSlot,
  appointmentDate: string,
  bookedCountForSlot: number,
  now = new Date(),
  overrideCurrentMinutes?: number
): SlotStatusResult => {
  const todayStr = getLocalDateString(now);

  const isToday = appointmentDate === todayStr;
  const isPastDate = appointmentDate < todayStr;
  const currentMinutes =
    typeof overrideCurrentMinutes === 'number' && !isNaN(overrideCurrentMinutes)
      ? overrideCurrentMinutes
      : getIndianTimeMinutes(now);

  const slotStartMins = timeToMinutes(slot.startTime);
  let slotEndMins = timeToMinutes(slot.endTime);
  if (slotEndMins <= slotStartMins) {
    slotEndMins += 24 * 60;
  }

  const patientsAhead = bookedCountForSlot;
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
