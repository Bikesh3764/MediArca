/**
 * A doctor can't sit at two clinics at the same time (AGENTS rule: no cross-clinic shift overlaps).
 *
 * Each clinic the doctor works at has "effective" shifts: its own clinic shifts, or the doctor's
 * default shifts when the clinic has none, on its own working days (or the doctor's).
 * These helpers compare those sets. FIX-052.
 */
import { cleanWorkingDays, parseAffiliationSlots, parseDoctorSlots, parseDoctorWorkingDays, timeToMinutes } from './scheduleUtils';
import { isClinicActive } from './authGuards';
import prisma from '../config/database';

export interface ClinicShiftSet {
  clinicId: string;
  clinicName: string;
  joinedAt?: Date | string | null;
  slots: Array<{ name?: string; startTime: string; endTime: string; days?: unknown; workingDays?: unknown }>;
  days: string[];
}

const slotDays = (slot: any, fallback: string[]): string[] => {
  if (Array.isArray(slot?.days) && slot.days.length > 0) return cleanWorkingDays(slot.days);
  if (Array.isArray(slot?.workingDays) && slot.workingDays.length > 0) return cleanWorkingDays(slot.workingDays);
  return fallback;
};

const span = (slot: { startTime: string; endTime: string }): [number, number] => {
  const start = timeToMinutes(slot.startTime);
  let end = timeToMinutes(slot.endTime);
  if (end <= start) end += 24 * 60;
  return [start, end];
};

/** The doctor's effective shifts at one clinic affiliation. */
export const effectiveShiftSet = (doctor: any, affiliation: any): ClinicShiftSet => ({
  clinicId: affiliation.clinicId,
  clinicName: affiliation.clinic?.clinicName || 'another clinic',
  joinedAt: affiliation.createdAt,
  slots: parseAffiliationSlots(affiliation.slots) ?? parseDoctorSlots(doctor),
  days: affiliation.workingDays ? parseDoctorWorkingDays(affiliation.workingDays) : parseDoctorWorkingDays(doctor?.workingDays),
});

/**
 * First clash between `target` and any of `others`, as a message for the user, or null.
 * Only shifts on a common weekday count.
 */
export const findShiftClash = (target: ClinicShiftSet, others: ClinicShiftSet[]): string | null => {
  for (const other of others) {
    if (other.clinicId === target.clinicId) continue;
    for (const a of target.slots) {
      if (!a?.startTime || !a?.endTime) continue;
      const daysA = slotDays(a, target.days);
      const [startA, endA] = span(a);
      for (const b of other.slots) {
        if (!b?.startTime || !b?.endTime) continue;
        const common = daysA.filter((d) => slotDays(b, other.days).includes(d));
        if (common.length === 0) continue;
        const [startB, endB] = span(b);
        if (startA < endB && startB < endA) {
          return `${a.startTime}–${a.endTime} at ${target.clinicName} clashes with ${b.startTime}–${b.endTime} at ${other.clinicName} (${common.join(', ')}). A doctor can't sit at two clinics at the same time.`;
        }
      }
    }
  }
  return null;
};

/**
 * Effective shift sets for all of a doctor's active clinics (verified clinic, ACTIVE/ACCEPTED link).
 * `affiliations` must include `clinic`.
 */
export const activeShiftSets = (doctor: any, affiliations: any[]): ClinicShiftSet[] =>
  (affiliations || [])
    .filter((aff) => ['ACTIVE', 'ACCEPTED'].includes(aff.status) && (!aff.clinic || isClinicActive(aff.clinic).active))
    .map((aff) => effectiveShiftSet(doctor, aff));

/**
 * After a doctor joins a clinic: a short warning when the new clinic's hours clash with another
 * clinic, else null. Joining is still allowed (hours can only be set once joined); online bookings
 * for the clashing hours wait until they are changed.
 */
export const joinClashWarning = async (doctorId: string, clinicId: string): Promise<string | null> => {
  try {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { clinics: { include: { clinic: true } } },
    });
    if (!doctor) return null;
    const sets = activeShiftSets(doctor, doctor.clinics);
    const target = sets.find((s) => s.clinicId === clinicId);
    if (!target) return null;
    const clash = findShiftClash(target, sets);
    return clash ? `Set this clinic's own hours: ${clash}` : null;
  } catch {
    return null;
  }
};

/** True when the given weekday code is a sitting day for this shift at this clinic. */
const sitsOn = (set: ClinicShiftSet, slot: any, dayCode: string): boolean => slotDays(slot, set.days).includes(dayCode);

/**
 * For bookings: does this shift at `target` clash, on that weekday, with a clinic the doctor joined earlier?
 * The clinic joined later must change its hours first, so existing clinics keep working.
 */
export const clashWithEarlierClinic = (
  target: ClinicShiftSet,
  others: ClinicShiftSet[],
  slot: { startTime: string; endTime: string },
  dayCode: string
): ClinicShiftSet | null => {
  const targetJoined = target.joinedAt ? new Date(target.joinedAt).getTime() : 0;
  if (!sitsOn(target, slot, dayCode)) return null;
  const [startA, endA] = span(slot);
  for (const other of others) {
    if (other.clinicId === target.clinicId) continue;
    const otherJoined = other.joinedAt ? new Date(other.joinedAt).getTime() : 0;
    if (otherJoined > targetJoined) continue;
    for (const b of other.slots) {
      if (!b?.startTime || !b?.endTime || !sitsOn(other, b, dayCode)) continue;
      const [startB, endB] = span(b);
      if (startA < endB && startB < endA) return other;
    }
  }
  return null;
};
