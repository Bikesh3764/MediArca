import prisma from '../config/database';
import { publishNotification } from '../utils/liveEvents';

/*
 * What MediArca sends (keep it to things the person needs to know or act on):
 * - Patient: booking sent / confirmed / declined / moved / cancelled, token for a walk-in,
 *   "It's your turn", visit complete, doctor on leave, doctor stepped out / back in.
 * - Receptionist: new booking or request, patient checked in by QR, patient cancelled.
 * - Doctor: account approved / suspended, clinic invites, join request answered.
 * - Clinic: clinic approved / suspended, doctor or receptionist wants to join, invite answered.
 * - Admin: new contact message.
 * Never notify someone about an action they did themselves, and never send queue
 * updates the doctor already sees live on the dashboard.
 */

/** "2026-10-27" → "Tue, 27 Oct". Leaves anything else as it is. */
export const formatVisitDate = (ymd?: string | null): string => {
  if (!ymd) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd).trim());
  if (!match) return String(ymd);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};

/** Adds "Dr." once: "Sarah Jenkins" → "Dr. Sarah Jenkins", "Dr Sarah" → "Dr. Sarah". */
export const withDr = (name?: string | null): string => {
  const clean = String(name || '').trim();
  if (!clean) return 'your doctor';
  return `Dr. ${clean.replace(/^dr\.?\s*/i, '')}`;
};

export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type = 'SYSTEM'
): Promise<any> => {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return null;
  }
  try {
    const created = await prisma.notification.create({
      data: {
        userId: userId.trim(),
        title: String(title || '').trim(),
        message: String(message || '').trim(),
        type: type || 'SYSTEM',
      },
    });
    publishNotification(userId.trim());
    return created;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};

/**
 * Finds the upcoming visits that are about to be cancelled because a doctor and a clinic part ways,
 * so the patients can be told afterwards. Call before cancelling; send with `notifyDetachCancellations`.
 */
export const findVisitsCancelledByDetach = async (doctorId: string, clinicId: string, fromDate: string) =>
  prisma.appointment.findMany({
    where: {
      clinicId,
      doctorId,
      appointmentDate: { gte: fromDate },
      status: { in: ['PENDING_APPROVAL', 'WAITING'] },
    },
    select: {
      appointmentDate: true,
      patient: { select: { userId: true } },
      doctor: { select: { user: { select: { fullName: true } } } },
      clinic: { select: { clinicName: true } },
    },
  });

export const notifyDetachCancellations = (visits: Awaited<ReturnType<typeof findVisitsCancelledByDetach>>): void => {
  for (const v of visits) {
    if (!v.patient?.userId) continue;
    createNotification(
      v.patient.userId,
      'Visit cancelled',
      `${withDr(v.doctor?.user?.fullName)} no longer sees patients at ${v.clinic?.clinicName || 'this clinic'}, so your visit on ${formatVisitDate(v.appointmentDate)} was cancelled. Please book again.`,
      'APPOINTMENT'
    ).catch(() => {});
  }
};

export const getUserNotifications = async (userId: string, limit = 50): Promise<any[]> => {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
};

/** Counts every unread notification, not only the ones in the latest page. */
export const countUnreadNotifications = async (userId: string): Promise<number> => {
  return prisma.notification.count({ where: { userId, isRead: false } });
};

export const markNotificationRead = async (notificationId: string, userId: string): Promise<boolean> => {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
  return result.count > 0;
};

/** Marks a set of notifications as read in one call (used when they scroll into view). */
export const markNotificationsRead = async (ids: string[], userId: string): Promise<number> => {
  const cleanIds = ids.filter((id) => typeof id === 'string' && id.trim()).slice(0, 100);
  if (cleanIds.length === 0) return 0;
  const result = await prisma.notification.updateMany({
    where: { id: { in: cleanIds }, userId, isRead: false },
    data: { isRead: true },
  });
  return result.count;
};

export const markAllNotificationsRead = async (userId: string): Promise<number> => {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return result.count;
};
