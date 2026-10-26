import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import type { AppNotification } from '../../services/api';
import { NotificationList } from './NotificationList';
import { getNotificationLink } from './notificationLinks';

interface NotificationPanelProps {
  onClose: () => void;
  /** Positioning classes for the panel box. */
  className?: string;
}

/**
 * The notifications dropdown. Notifications count as read once they've been on
 * screen for a moment; they keep their blue "new" look until the panel closes.
 */
export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  onClose,
  className = 'fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-96',
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markSeen, markAsRead, markAllRead } = useNotifications();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [freshIds] = useState(() => new Set(notifications.filter((n) => !n.isRead).map((n) => n.id)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleOpen = (n: AppNotification) => {
    markAsRead(n.id);
    const link = getNotificationLink(user?.role, n);
    onClose();
    if (link) navigate(link);
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label="Notifications"
        className={`${className} z-50 bg-white border border-[#e5e5ea] rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] overflow-hidden animate-fadeIn text-left`}
      >
        <div className="px-4 h-12 border-b border-[#e5e5ea] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-[#1d1d1f]">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc]">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="h-8 px-3 rounded-full text-xs text-[#0066cc] hover:bg-[#0066cc]/[0.06] inline-flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close notifications"
              className="w-8 h-8 rounded-full text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] inline-flex items-center justify-center cursor-pointer sm:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="max-h-[min(28rem,calc(100dvh-9rem))] overflow-y-auto overscroll-contain">
          <NotificationList
            notifications={notifications}
            freshIds={freshIds}
            onSeen={markSeen}
            onOpen={handleOpen}
            scrollRoot={scrollRef}
          />
        </div>
      </div>
    </>
  );
};
