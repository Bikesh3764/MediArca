/**
 * Live wait-time estimate for a patient's token.
 *
 * "Patients ahead × average minutes" alone is wrong whenever the day doesn't go to plan,
 * so the estimate also looks at:
 *  - shift not started yet → the queue starts moving at the shift start, not now
 *  - doctor stepped out → nothing moves until the expected return time
 *  - doctor not in the cabin during the shift (late) → nothing moves until they arrive
 *  - the patient already inside → only the rest of their visit counts
 *  - the doctor's real pace today (from finished visits), blended with the planned pace
 *  - patients ahead who haven't reached the clinic yet → they are often skipped, so they count half
 * All times are minutes since midnight in IST.
 */

export type CabinStatus = 'IN_CABIN' | 'STEPPED_OUT' | 'NOT_IN_CABIN' | string | null | undefined;

export interface QueueEtaInput {
  nowMins: number;
  slotStartMins: number;
  slotEndMins: number;
  /** Minutes per patient the doctor set for this shift. */
  plannedPace: number;
  /** Waiting patients with a smaller token who have checked in at the clinic. */
  aheadArrived: number;
  /** Waiting patients with a smaller token who haven't checked in yet. */
  aheadNotArrived: number;
  /** Minutes the current patient has been inside, or null when the cabin is free. */
  inConsultationElapsedMins: number | null;
  /** Lengths in minutes of visits finished today in this shift. */
  recentDurations: number[];
  cabinStatus: CabinStatus;
  /** Expected return (minutes since midnight) when the doctor stepped out, if known. */
  returnAtMins: number | null;
}

export type QueueDelayReason = 'BEFORE_SHIFT' | 'STEPPED_OUT' | 'DOCTOR_NOT_IN' | null;

export interface QueueEtaResult {
  /** Minutes from now until this patient is likely called. */
  waitMinutes: number;
  /** Minutes per patient actually used for the estimate. */
  pace: number;
  /** Why the queue isn't moving yet, if it isn't. */
  delayReason: QueueDelayReason;
}

/** Assumed wait when a doctor is late or stepped out with no return time. */
export const DOCTOR_LATE_GRACE_MINS = 10;
export const STEPPED_OUT_DEFAULT_MINS = 10;
/** Weight of the planned pace against real visits: after 3 visits it's 50/50. */
const PLANNED_PACE_WEIGHT = 3;
/** Share of a not-yet-arrived patient ahead that is counted (some get skipped). */
const NOT_ARRIVED_WEIGHT = 0.5;

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Planned pace blended with today's real visit lengths (median, so one long visit doesn't skew it). */
export const learnPace = (plannedPace: number, recentDurations: number[]): number => {
  const planned = Number.isFinite(plannedPace) && plannedPace > 0 ? plannedPace : 3;
  const samples = recentDurations.filter((d) => Number.isFinite(d) && d > 0 && d <= 180);
  if (samples.length === 0) return planned;
  const n = samples.length;
  const blended = (median(samples) * n + planned * PLANNED_PACE_WEIGHT) / (n + PLANNED_PACE_WEIGHT);
  return Math.min(Math.max(blended, 1), 180);
};

export const estimateQueueWait = (input: QueueEtaInput): QueueEtaResult => {
  const pace = learnPace(input.plannedPace, input.recentDurations);
  const now = input.nowMins;
  const beforeShift = now < input.slotStartMins;

  // When does the queue start moving again?
  let moveFrom = now;
  let delayReason: QueueDelayReason = null;
  if (beforeShift) {
    moveFrom = input.slotStartMins;
    delayReason = 'BEFORE_SHIFT';
  } else if (input.cabinStatus === 'STEPPED_OUT') {
    moveFrom =
      input.returnAtMins !== null && input.returnAtMins > now
        ? input.returnAtMins
        : now + STEPPED_OUT_DEFAULT_MINS;
    delayReason = 'STEPPED_OUT';
  } else if (input.cabinStatus === 'NOT_IN_CABIN' && input.inConsultationElapsedMins === null) {
    // Doctor late or not arrived. (Someone inside the cabin means the status was just never switched.)
    moveFrom = now + DOCTOR_LATE_GRACE_MINS;
    delayReason = 'DOCTOR_NOT_IN';
  }

  // Rest of the visit already in progress. A long-running visit still needs a little time.
  let currentRemaining = 0;
  if (input.inConsultationElapsedMins !== null) {
    const elapsed = Math.max(0, input.inConsultationElapsedMins);
    currentRemaining = Math.max(pace - elapsed, Math.max(1, pace * 0.25));
  }

  // Before the shift nobody has checked in yet, so everyone ahead counts fully.
  const notArrivedWeight = beforeShift ? 1 : NOT_ARRIVED_WEIGHT;
  const aheadWork =
    (Math.max(0, input.aheadArrived) + Math.max(0, input.aheadNotArrived) * notArrivedWeight) * pace;

  const waitMinutes = Math.max(0, Math.round(moveFrom - now + currentRemaining + aheadWork));
  return { waitMinutes, pace: Math.round(pace * 10) / 10, delayReason };
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
