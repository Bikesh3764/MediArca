import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notificationService';

export const getMyNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const notifications = await getUserNotifications(req.user.id);
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error: any) {
    console.error('getMyNotifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve notifications' });
  }
};

export const markRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const notificationId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
    const updated = await markNotificationRead(notificationId, req.user.id);

    res.json({
      success: true,
      message: updated ? 'Notification marked as read' : 'Notification not found or already read',
      data: { updated },
    });
  } catch (error: any) {
    console.error('markRead error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notification' });
  }
};

export const markAllRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const count = await markAllNotificationsRead(req.user.id);

    res.json({
      success: true,
      message: `Marked ${count} notifications as read`,
      data: { count },
    });
  } catch (error: any) {
    console.error('markAllRead error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notifications' });
  }
};
