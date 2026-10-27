import type { Appointment } from '../services/api';

/** Patients this close to their turn refresh as soon as the queue moves. */
export const NEAR_TURN_PATIENTS = 5;

/**
 * Does a live "queue moved" event concern any of these doctors?
 * No doctor on the event, or our doctors not known yet, counts as yes.
 */
export const isEventForDoctors = (eventDoctorId: string | undefined, doctorIds: Array<string | undefined> | undefined): boolean => {
  if (!eventDoctorId) return true;
  const known = (doctorIds || []).filter(Boolean);
  if (known.length === 0) return true;
  return known.includes(eventDoctorId);
};

/**
 * Should a patient's page re-fetch right away when a doctor's queue moves?
 * Only for visits that can change soon: today's tokens within NEAR_TURN_PATIENTS
 * of their turn, and visits not yet confirmed or already in the cabin.
 * Everyone else catches up on their 60-second refresh, which keeps a busy
 * clinic from sending every patient's phone to the server at once.
 */
export const needsInstantQueueRefresh = (
  appointments: Appointment[],
  eventDoctorId: string | undefined,
  today: string
): boolean =>
  appointments.some((a) => {
    if (eventDoctorId && a.doctorId !== eventDoctorId) return false;
    if (a.status !== 'WAITING') return true;
    if (a.appointmentDate !== today) return false;
    const live = a.liveQueue;
    if (!live || typeof live.patientsAway !== 'number') return true;
    return live.isYourTurn || live.patientsAway <= NEAR_TURN_PATIENTS;
  });
