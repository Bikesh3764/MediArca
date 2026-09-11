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
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const evaluateSlotStatus = (
  slot: DoctorSlot,
  appointmentDate: string,
  bookedCountForSlot: number,
  now = new Date(),
  overrideCurrentMinutes?: number
): SlotStatusResult => {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const isToday = appointmentDate === todayStr;
  const isPastDate = appointmentDate < todayStr;
  const currentMinutes =
    typeof overrideCurrentMinutes === 'number' && !isNaN(overrideCurrentMinutes)
      ? overrideCurrentMinutes
      : now.getHours() * 60 + now.getMinutes();

  const slotStartMins = timeToMinutes(slot.startTime);
  let slotEndMins = timeToMinutes(slot.endTime);
  if (slotEndMins <= slotStartMins) {
    slotEndMins += 24 * 60;
  }

  const patientsAhead = bookedCountForSlot;
  let isPassed = false;
  let isInProgress = false;
  let isUpcoming = false;
  let isFull = false;
  let statusLabel = 'Available';
  let estimatedTime = '';

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
      statusLabel = 'Active Now • In Progress';
      const offsetMins = patientsAhead * slot.avgConsultationMinutes;
      // When active, next consultation cannot happen before current time
      const estTotal = Math.max(slotStartMins + offsetMins, currentMinutes + offsetMins);
      if (estTotal >= slotEndMins) {
        isFull = true;
        statusLabel = 'Shift Over Capacity for Today';
        estimatedTime = 'Shift Full';
      } else {
        estimatedTime = minutesTo12Hour(estTotal);
      }
    } else {
      // Before slot start time today
      isUpcoming = true;
      statusLabel = 'Upcoming Today';
      const offsetMins = patientsAhead * slot.avgConsultationMinutes;
      const estTotal = slotStartMins + offsetMins;
      if (estTotal >= slotEndMins) {
        isFull = true;
        statusLabel = 'Fully Booked for Today';
        estimatedTime = 'Shift Full';
      } else {
        estimatedTime = minutesTo12Hour(estTotal);
      }
    }
  } else {
    // Future date
    isUpcoming = true;
    statusLabel = 'Upcoming';
    const offsetMins = patientsAhead * slot.avgConsultationMinutes;
    const estTotal = slotStartMins + offsetMins;
    estimatedTime = minutesTo12Hour(estTotal);
  }

  const isCapacityFull = bookedCountForSlot >= slot.maxPatients;
  if (isCapacityFull) {
    isFull = true;
    statusLabel = 'Fully Booked';
  }

  if (isFull && !isPassed) {
    if (!statusLabel || statusLabel === 'Available' || statusLabel === 'Active Now • In Progress' || statusLabel === 'Upcoming Today' || statusLabel === 'Upcoming') {
      statusLabel = 'Fully Booked';
    }
    if (!estimatedTime || estimatedTime === 'Shift Ended') {
      estimatedTime = 'Shift Full';
    }
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
