import prisma from '../config/database';
import { getLocalDateString, getIndianTimeMinutes } from './scheduleUtils';

/** Doctors may still call yesterday's checked-in patients until 6 AM (overnight carryover). */
const CARRYOVER_ENDS_MINUTES = 6 * 60;

/**
 * Background clean-up that closes visits whose day is over. Runs every 15 minutes, never on GET paths.
 * - Unconfirmed requests (PENDING_APPROVAL) from past dates become EXPIRED.
 * - Confirmed tokens still WAITING after their day (the patient never came) become EXPIRED,
 *   so they leave the "Upcoming" list and show in the patient's history. Yesterday's tokens
 *   wait until 6 AM because a late shift may still call them.
 */
export const expireStalePendingAppointments = async (force: boolean = false, now: Date = new Date()): Promise<number> => {
  if (!force && (process.env.NODE_ENV === 'test' || process.env.MEDIARCA_TEST_SUITE)) {
    return 0;
  }
  if (!prisma?.appointment?.updateMany) {
    return 0;
  }
  try {
    const istTodayStr = getLocalDateString(now);
    const pending = await prisma.appointment.updateMany({
      where: {
        status: 'PENDING_APPROVAL',
        appointmentDate: { lt: istTodayStr },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    const waitingCutoff =
      getIndianTimeMinutes(now) >= CARRYOVER_ENDS_MINUTES
        ? istTodayStr
        : getLocalDateString(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const missed = await prisma.appointment.updateMany({
      where: {
        status: 'WAITING',
        appointmentDate: { lt: waitingCutoff },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    const total = pending.count + missed.count;
    if (total > 0) {
      console.log(`[Maintenance] Closed ${pending.count} stale request(s) and ${missed.count} missed visit(s).`);
    }
    return total;
  } catch (error) {
    console.error('[Maintenance] Error expiring stale appointments:', error);
    return 0;
  }
};
