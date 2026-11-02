/**
 * Live wait-time estimate for a patient's token. Kept deliberately simple:
 *
 *   wait = (shift start, if not started yet)
 *        + (doctor's expected arrival, if the doctor is out of the cabin and gave a time)
 *        + patients ahead × average minutes per patient
 *
 * All times are minutes since midnight in IST.
 */

export type CabinStatus = 'IN_CABIN' | 'STEPPED_OUT' | 'NOT_IN_CABIN' | string | null | undefined;

export interface QueueEtaInput {
  nowMins: number;
  slotStartMins: number;
  /** Average minutes per patient set for this shift. */
  avgMinutes: number;
  /** Tokens before this one that are not done yet (waiting, plus the one in the cabin). */
  patientsAhead: number;
  cabinStatus: CabinStatus;
  /** Doctor's expected arrival (minutes since midnight), if they gave one. */
  returnAtMins: number | null;
}

export type QueueDelayReason = 'BEFORE_SHIFT' | 'STEPPED_OUT' | 'DOCTOR_NOT_IN' | null;

export interface QueueEtaResult {
  /** Minutes from now until this patient is likely called. */
  waitMinutes: number;
  /** Why the queue isn't moving yet, if it isn't. */
  delayReason: QueueDelayReason;
}

export const estimateQueueWait = (input: QueueEtaInput): QueueEtaResult => {
  const avg = Number.isFinite(input.avgMinutes) && input.avgMinutes > 0 ? input.avgMinutes : 3;
  const now = input.nowMins;

  // The queue starts at the shift start, or now if the shift is on
  let moveFrom = Math.max(now, input.slotStartMins);
  let delayReason: QueueDelayReason = now < input.slotStartMins ? 'BEFORE_SHIFT' : null;

  // Doctor out of the cabin: add the time until their expected arrival, only if they gave one
  const out = input.cabinStatus === 'STEPPED_OUT' || input.cabinStatus === 'NOT_IN_CABIN';
  if (out) {
    if (input.returnAtMins !== null && input.returnAtMins > moveFrom) moveFrom = input.returnAtMins;
    if (!delayReason) delayReason = input.cabinStatus === 'STEPPED_OUT' ? 'STEPPED_OUT' : 'DOCTOR_NOT_IN';
  }

  const waitMinutes = Math.max(0, Math.round(moveFrom - now + Math.max(0, input.patientsAhead) * avg));
  return { waitMinutes, delayReason };
};

/** "10:30 AM", "~ 10:30 AM" or "10:30" → minutes since midnight; null when no time is given. */
export const parseReturnTime = (value?: string | null): number | null => {
  const m = value?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3]?.toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
};

/** Minutes before a shift starts when patients start caring about the doctor's cabin status. */
export const SHIFT_NOTIFY_LEAD_MINS = 60;

/**
 * Is a shift ("09:00" to "13:00", or "09:00 AM") on right now, or starting within the hour?
 * Missing times count as current, so nobody silently loses alerts.
 */
export const isShiftCurrent = (
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  nowMins: number
): boolean => {
  if (!startTime || !endTime) return true;
  const toMins = (t: string) => {
    const [h, m] = t.replace(/\s*(AM|PM)/i, '').split(':').map((x) => parseInt(x, 10) || 0);
    let hours = h;
    if (/PM/i.test(t) && hours < 12) hours += 12;
    if (/AM/i.test(t) && hours === 12) hours = 0;
    return hours * 60 + m;
  };
  const start = toMins(startTime);
  let end = toMins(endTime);
  if (end <= start) end += 24 * 60;
  return nowMins >= start - SHIFT_NOTIFY_LEAD_MINS && nowMins < end;
};

/** Whole minutes between two timestamps, or null when either is missing. */
export const minutesBetween = (from?: Date | string | null, to?: Date | string | null): number | null => {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Number.isFinite(ms) ? ms / 60000 : null;
};
