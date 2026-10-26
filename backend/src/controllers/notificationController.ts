import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  getUserNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markNotificationsRead,
  markAllNotificationsRead,
} from '../services/notificationService';

export const getMyNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const [notifications, unreadCount] = await Promise.all([
      getUserNotifications(req.user.id),
      countUnreadNotifications(req.user.id),
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error: any) {
    console.error('getMyNotifications error:', error);
    res.status(500).json({ success: false, message: 'Couldn’t load notifications. Try again.' });
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
      message: updated ? 'Marked as read' : 'Already read',
      data: { updated },
    });
  } catch (error: any) {
    console.error('markRead error:', error);
    res.status(500).json({ success: false, message: 'Couldn’t update notification. Try again.' });
  }
};

/** Marks the notifications the person has seen (sent as `ids`) as read. */
export const markSeenRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((v: unknown) => String(v)) : [];
    const count = await markNotificationsRead(ids, req.user.id);

    res.json({ success: true, message: `Marked ${count} as read`, data: { count } });
  } catch (error: any) {
    console.error('markSeenRead error:', error);
    res.status(500).json({ success: false, message: 'Couldn’t update notifications. Try again.' });
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
      message: `Marked ${count} as read`,
      data: { count },
    });
  } catch (error: any) {
    console.error('markAllRead error:', error);
    res.status(500).json({ success: false, message: 'Couldn’t update notifications. Try again.' });
  }
};
