import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  getUserNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markNotificationsRead,
  markAllNotificationsRead,
} from '../services/notificationService';
import { isExpoPushToken, removePushToken, savePushToken } from '../services/pushService';

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

/** The phone app saves its push address after sign-in (body: token, platform). */
export const registerPushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const { token, platform } = req.body || {};
    if (!isExpoPushToken(token)) {
      res.status(400).json({ success: false, message: 'Invalid push token' });
      return;
    }
    await savePushToken(req.user.id, token, typeof platform === 'string' ? platform : 'android');
    res.json({ success: true, message: 'Notifications on' });
  } catch (error: any) {
    console.error('registerPushToken error:', error);
    res.status(500).json({ success: false, message: 'Couldn’t turn on notifications. Try again.' });
  }
};

/** Called on sign-out so this phone stops getting the account's alerts. */
export const unregisterPushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const { token } = req.body || {};
    if (typeof token === 'string' && token.trim()) await removePushToken(req.user.id, token);
    res.json({ success: true, message: 'Notifications off' });
  } catch (error: any) {
    console.error('unregisterPushToken error:', error);
    res.status(500).json({ success: false, message: 'Couldn’t update notifications. Try again.' });
  }
};
