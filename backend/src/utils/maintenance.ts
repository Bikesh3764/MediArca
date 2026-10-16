import prisma from '../config/database';
import { getLocalDateString } from './scheduleUtils';

/**
 * Dedicated background maintenance to auto-expire past unconfirmed PENDING_APPROVAL appointments.
 * Strictly separates write/expiry logic from high-frequency GET/polling paths (Eliminating Write-on-Read).
 * Only targets records that have genuinely expired (status === 'PENDING_APPROVAL' with appointmentDate < today).
 */
export const expireStalePendingAppointments = async (force: boolean = false): Promise<number> => {
  if (!force && (process.env.NODE_ENV === 'test' || process.env.MEDIARCA_TEST_SUITE)) {
    return 0;
  }
  if (!prisma?.appointment?.updateMany) {
    return 0;
  }
  try {
    const istTodayStr = getLocalDateString(new Date());
    const result = await prisma.appointment.updateMany({
      where: {
        status: 'PENDING_APPROVAL',
        appointmentDate: { lt: istTodayStr },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    if (result.count > 0) {
      console.log(`[Maintenance] Auto-expired ${result.count} stale pending appointment(s).`);
    }
    return result.count;
  } catch (error) {
    console.error('[Maintenance] Error expiring stale pending appointments:', error);
    return 0;
  }
};
