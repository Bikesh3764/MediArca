import React, { useEffect, useRef, useState } from 'react';
import { Bell, Calendar, CheckCircle2, Clock, Mail, Stethoscope, ChevronRight } from 'lucide-react';
import type { AppNotification } from '../../services/api';

/** "Just now", "5 min ago", "2 h ago", "Yesterday", "27 Oct". */
const formatNotificationTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return `${Math.floor(diff / 3600)} h ago`;
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const fullTime = (dateStr: string) =>
  new Date(dateStr).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

const groupLabel = (dateStr: string): string => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return 'Earlier';
};

const iconFor = (n: AppNotification) => {
  if (n.type === 'CONTACT_INQUIRY') return Mail;
  if (n.type === 'CABIN_STATUS') return Stethoscope;
  if (n.type === 'CLINICAL') return CheckCircle2;
  if (n.type === 'QUEUE') return Clock;
  if (n.type === 'APPOINTMENT') return Calendar;
  return Bell;
};

interface NotificationListProps {
  notifications: AppNotification[];
  /** Called with ids that have been on screen long enough to count as seen. */
  onSeen: (ids: string[]) => void;
  /** Tap on a notification. Omit to make rows plain text. */
  onOpen?: (n: AppNotification) => void;
  /** Ids that were unread when the list opened: they keep the "new" look until it closes. */
  freshIds: Set<string>;
  /** Element that scrolls the list, used to tell what is on screen. */
  scrollRoot?: React.RefObject<HTMLElement | null>;
  emptyText?: string;
}

const SEEN_AFTER_MS = 1200;

export const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  onSeen,
  onOpen,
  freshIds,
  scrollRoot,
  emptyText = 'Updates about your visits show up here.',
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const onSeenRef = useRef(onSeen);
  const [, forceTick] = useState(0);

  useEffect(() => {
    onSeenRef.current = onSeen;
  }, [onSeen]);

  // Refresh "5 min ago" labels while the list is open.
  useEffect(() => {
    const t = window.setInterval(() => forceTick((v) => v + 1), 60000);
    return () => window.clearInterval(t);
  }, []);

  // Mark a notification read once most of it has been visible for a moment.
  // Timers live across re-renders so marking one read doesn't restart the others,
  // and ids seen together are sent in one request.
  const timersRef = useRef<Map<string, number>>(new Map());
  const batchRef = useRef<string[]>([]);
  const flushRef = useRef<number | null>(null);
  const unreadKey = notifications.filter((n) => !n.isRead).map((n) => n.id).join(',');

  useEffect(() => {
    const timers = timersRef.current;
    const batch = batchRef.current;
    const flush = flushRef;
    const seen = onSeenRef;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
      if (flush.current) window.clearTimeout(flush.current);
      if (batch.length) seen.current(batch.splice(0));
    };
  }, []);

  useEffect(() => {
    const container = listRef.current;
    if (!container || !unreadKey) return;
    const timers = timersRef.current;
    const queueSeen = (id: string) => {
      batchRef.current.push(id);
      if (flushRef.current) return;
      flushRef.current = window.setTimeout(() => {
        flushRef.current = null;
        onSeenRef.current(batchRef.current.splice(0));
      }, 80);
    };
    if (typeof IntersectionObserver === 'undefined') {
      unreadKey.split(',').forEach(queueSeen);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.notifId;
          if (!id) continue;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            if (!timers.has(id)) {
              timers.set(
                id,
                window.setTimeout(() => {
                  timers.delete(id);
                  queueSeen(id);
                }, SEEN_AFTER_MS)
              );
            }
          } else if (timers.has(id)) {
            window.clearTimeout(timers.get(id));
            timers.delete(id);
          }
        }
      },
      { root: scrollRoot?.current ?? null, threshold: [0, 0.6, 1] }
    );
    container.querySelectorAll<HTMLElement>('[data-unread="true"]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [unreadKey, scrollRoot]);

  if (notifications.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <div className="w-10 h-10 mx-auto rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#86868b]">
          <Bell className="w-4 h-4" />
        </div>
        <p className="text-xs font-semibold text-[#1d1d1f] mt-3">No notifications</p>
        <p className="text-[11px] text-[#86868b] mt-0.5">{emptyText}</p>
      </div>
    );
  }

  const groups = notifications.map((n) => groupLabel(n.createdAt));
  return (
    <div ref={listRef} className="divide-y divide-[#f0f0f2]">
      {notifications.map((n, index) => {
        const group = groups[index];
        const showGroup = index === 0 || group !== groups[index - 1];
        const isFresh = freshIds.has(n.id);
        const Icon = iconFor(n);
        const Row = onOpen ? 'button' : 'div';
        return (
          <React.Fragment key={n.id}>
            {showGroup && (
              <div className="px-4 pt-3 pb-1 text-[11px] font-semibold text-[#86868b] bg-white sticky top-0 z-[1]">
                {group}
              </div>
            )}
            <Row
              {...(onOpen ? { type: 'button' as const, onClick: () => onOpen(n) } : {})}
              data-notif-id={n.id}
              data-unread={!n.isRead ? 'true' : undefined}
              className={`group w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                onOpen ? 'cursor-pointer' : ''
              } ${isFresh ? 'bg-[#0066cc]/[0.05] hover:bg-[#0066cc]/[0.08]' : 'bg-white hover:bg-[#f5f5f7]'}`}
            >
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  isFresh ? 'bg-[#0066cc] text-white' : 'bg-[#f5f5f7] text-[#86868b]'
                }`}
              >
                <Icon className="w-4 h-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-[#1d1d1f] leading-snug break-words">{n.title}</span>
                  <time
                    dateTime={n.createdAt}
                    title={fullTime(n.createdAt)}
                    className="text-[11px] text-[#86868b] shrink-0 leading-snug"
                  >
                    {formatNotificationTime(n.createdAt)}
                  </time>
                </span>
                <span className="block text-xs text-[#48484a] mt-0.5 leading-relaxed whitespace-pre-line break-words">
                  {n.message}
                </span>
              </span>
              {onOpen ? (
                <ChevronRight className="w-4 h-4 text-[#c7c7cc] shrink-0 self-center group-hover:text-[#86868b]" />
              ) : null}
              {!n.isRead && <span className="sr-only">Unread</span>}
            </Row>
          </React.Fragment>
        );
      })}
    </div>
  );
};
