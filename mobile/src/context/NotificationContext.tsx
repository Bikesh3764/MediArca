// In-app notifications for the signed-in account: the list, the unread count for the bell,
// and marking them read. Same server calls as frontend/src/context/NotificationContext.tsx.
// Refreshes quietly every 30s while the app is open.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { type AppNotification, api } from '@mediarca/shared/api';
import { useAuth } from '@/context/AuthContext';

interface NotificationContextType {
  notifications: AppNotification[] | null;
  unreadCount: number;
  failed: boolean;
  reload: () => Promise<void>;
  /** Marks these as read on the server; the dots go at once. */
  markRead: (ids: string[]) => void;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const signedIn = Boolean(user);
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    if (!signedIn) return;
    try {
      const res = await api.getNotifications();
      const list: AppNotification[] = Array.isArray(res?.notifications) ? res.notifications : [];
      setNotifications(list);
      setUnreadCount(typeof res?.unreadCount === 'number' ? res.unreadCount : list.filter((n) => !n.isRead).length);
      setFailed(false);
    } catch {
      // Keep what is on screen
      setFailed(true);
    }
  }, [signedIn]);

  // Load on sign-in, clear on sign-out, then every 30s while the app is in front
  useEffect(() => {
    if (!signedIn) {
      queueMicrotask(() => {
        setNotifications(null);
        setUnreadCount(0);
      });
      return;
    }
    queueMicrotask(() => {
      reload();
    });
    let timer: ReturnType<typeof setInterval> | null = setInterval(reload, 30000);
    const sub = AppState.addEventListener('change', (state) => {
      if (timer) clearInterval(timer);
      timer = null;
      if (state === 'active') {
        reload();
        timer = setInterval(reload, 30000);
      }
    });
    return () => {
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [signedIn, reload]);

  const markRead = useCallback(
    (ids: string[]) => {
      const unread = ids.filter((id) => notifications?.some((n) => n.id === id && !n.isRead));
      if (!unread.length) return;
      const set = new Set(unread);
      setNotifications((prev) => (prev ? prev.map((n) => (set.has(n.id) ? { ...n, isRead: true } : n)) : prev));
      setUnreadCount((c) => Math.max(0, c - unread.length));
      api.markNotificationsRead(unread).catch(() => {
        // Not saved: the next refresh shows them as unread again
      });
    },
    [notifications]
  );

  const markAllRead = useCallback(() => {
    setNotifications((prev) => (prev ? prev.map((n) => ({ ...n, isRead: true })) : prev));
    setUnreadCount(0);
    api.markAllNotificationsRead().catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ notifications, unreadCount, failed, reload, markRead, markAllRead }),
    [notifications, unreadCount, failed, reload, markRead, markAllRead]
  );
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
};
