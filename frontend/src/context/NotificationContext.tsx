import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, AppNotification } from '../services/api';
import { useAuth } from './AuthContext';
import { useLiveEvent } from '../utils/liveEvents';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  /** Marks notifications as read once the person has seen them on screen. */
  markSeen: (ids: string[]) => void;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const notificationsRef = useRef<AppNotification[]>([]);
  // Ids marked read here but maybe not saved yet, so a poll doesn't bring their dot back.
  const pendingReadIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.getNotifications();
      if (res && Array.isArray(res.notifications)) {
        const pending = pendingReadIds.current;
        const list = res.notifications.map((n: AppNotification) =>
          pending.has(n.id) && !n.isRead ? { ...n, isRead: true } : n
        );
        const serverUnread =
          typeof res.unreadCount === 'number'
            ? res.unreadCount
            : res.notifications.filter((n: AppNotification) => !n.isRead).length;
        const stillPending = res.notifications.filter((n: AppNotification) => pending.has(n.id) && !n.isRead).length;
        setNotifications(list);
        setUnreadCount(Math.max(0, serverUnread - stillPending));
      }
    } catch {
      // background polling fails gracefully
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => {
        setNotifications([]);
        setUnreadCount(0);
      });
      return;
    }
    queueMicrotask(() => {
      fetchNotifications();
    });
  }, [user, fetchNotifications]);

  // New notifications arrive instantly over the live stream
  useLiveEvent('notification', () => {
    fetchNotifications();
  }, Boolean(user));

  const applyRead = (ids: string[]) => {
    const idSet = new Set(ids);
    setNotifications((prev) => prev.map((n) => (idSet.has(n.id) ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - ids.length));
  };

  const markSeen = useCallback((ids: string[]) => {
    const unreadIds = ids.filter(
      (id) => !pendingReadIds.current.has(id) && notificationsRef.current.some((n) => n.id === id && !n.isRead)
    );
    if (unreadIds.length === 0) return;
    unreadIds.forEach((id) => pendingReadIds.current.add(id));
    applyRead(unreadIds);
    api
      .markNotificationsRead(unreadIds)
      .catch(() => {
        // Not saved: the next refresh shows them as unread again.
      })
      .finally(() => {
        unreadIds.forEach((id) => pendingReadIds.current.delete(id));
      });
  }, []);

  const markAsRead = async (id: string) => {
    if (!notificationsRef.current.some((n) => n.id === id && !n.isRead)) return;
    applyRead([id]);
    try {
      await api.markNotificationRead(id);
    } catch {
      // The next refresh fixes the state.
    }
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await api.markAllNotificationsRead();
    } catch {
      // The next refresh fixes the state.
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markSeen,
        markAllRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

// oxlint-disable-next-line react/only-export-components
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
