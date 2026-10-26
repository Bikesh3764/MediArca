import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useNotifications } from '../../../context/NotificationContext';
import type { AppNotification } from '../../../services/api';
import { NotificationList } from '../../../components/notifications/NotificationList';
import { getNotificationLink } from '../../../components/notifications/notificationLinks';

export const NotificationsTab: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markSeen, markAsRead, markAllRead } = useNotifications();
  // Unread when the tab opened: they keep the "new" look while you're here.
  const [freshIds] = useState(() => new Set(notifications.filter((n) => !n.isRead).map((n) => n.id)));

  const handleOpen = (n: AppNotification) => {
    markAsRead(n.id);
    const link = getNotificationLink(user?.role, n);
    if (link) navigate(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-[#1d1d1f] tracking-tight">Notifications</h3>
          <p className="text-xs text-[#86868b] mt-0.5">
            {unreadCount > 0 ? `${unreadCount} new` : 'New bookings, requests and arrivals.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="h-9 px-4 rounded-full text-xs text-[#0066cc] bg-white border border-[#e5e5ea] hover:bg-[#f5f5f7] transition-all active:scale-[0.98] cursor-pointer inline-flex items-center gap-1.5 shrink-0"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      <div className="border border-[#e5e5ea] rounded-2xl overflow-hidden bg-white">
        <NotificationList
          notifications={notifications}
          freshIds={freshIds}
          onSeen={markSeen}
          onOpen={handleOpen}
          emptyText="New bookings, requests and arrivals show up here."
        />
      </div>
    </div>
  );
};
