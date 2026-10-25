import prisma from '../config/database';
import { publishNotification } from '../utils/liveEvents';

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

export const getUserNotifications = async (userId: string, limit = 50): Promise<any[]> => {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
};

export const markNotificationRead = async (notificationId: string, userId: string): Promise<boolean> => {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
  return result.count > 0;
};

export const markAllNotificationsRead = async (userId: string): Promise<number> => {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return result.count;
};
