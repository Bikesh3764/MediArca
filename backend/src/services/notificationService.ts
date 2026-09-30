import prisma from '../config/database';

export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type = 'SYSTEM'
): Promise<any> => {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
      },
    });
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
