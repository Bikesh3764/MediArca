import React from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useReceptionistDashboard } from './state';
export const NotificationsTab: React.FC = () => {
  const {
    notifications,
    unreadNotifCount,
    handleMarkOneNotifRead,
    handleMarkAllNotifsRead,
    expandedNotifId,
    setExpandedNotifId,
    notifFilter,
    setNotifFilter,
  } = useReceptionistDashboard();
  return (
<div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#f0f0f2]">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-[#1d1d1f] tracking-tight">
                    Notifications
                  </h3>
                  <p className="text-xs text-[#86868b] mt-0.5">
                    New bookings and arrivals.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {unreadNotifCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllNotifsRead}
                      className="h-8 px-3.5 rounded-full text-xs font-normal text-[#0066cc] hover:bg-[#0066cc]/5 transition-all cursor-pointer inline-flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark all read</span>
                    </button>
                  )}
                  <div className="bg-[#f5f5f7] p-1 rounded-full border border-[#e5e5ea] flex">
                    <button
                      type="button"
                      onClick={() => setNotifFilter('ALL')}
                      className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                        notifFilter === 'ALL'
                          ? 'bg-white text-[#1d1d1f] font-semibold '
                          : 'text-[#86868b] hover:text-[#1d1d1f]'
                      }`}
                    >
                      All ({notifications.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifFilter('UNREAD')}
                      className={`h-8 px-3.5 rounded-full text-xs transition-all cursor-pointer ${
                        notifFilter === 'UNREAD'
                          ? 'bg-white text-[#1d1d1f] font-semibold '
                          : 'text-[#86868b] hover:text-[#1d1d1f]'
                      }`}
                    >
                      Unread ({unreadNotifCount})
                    </button>
                  </div>
                </div>
              </div>

              {(() => {
                const filtered = notifications.filter((n) =>
                  notifFilter === 'UNREAD' ? !n.isRead : true
                );

                if (filtered.length === 0) {
                  return (
                    <div className="py-14 text-center">
                      <h4 className="text-sm font-semibold text-[#1d1d1f]">
                        {notifFilter === 'UNREAD' ? 'No Unread Notifications' : 'No Notifications Yet'}
                      </h4>
                      <p className="text-xs text-[#86868b] mt-1 max-w-sm mx-auto">
                        New alerts will show up here.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-[#f0f0f2] border border-[#e5e5ea] rounded-2xl overflow-hidden bg-white">
                    {filtered.map((item) => {
                      const isExpanded = expandedNotifId === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (!item.isRead) handleMarkOneNotifRead(item.id);
                            setExpandedNotifId(isExpanded ? null : item.id);
                          }}
                          className={`p-4 sm:px-5 transition-colors cursor-pointer ${
                            !item.isRead ? 'bg-[#0066cc]/[0.02] hover:bg-[#0066cc]/[0.04]' : 'hover:bg-[#fafafc]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {!item.isRead && (
                                  <span className="w-2 h-2 rounded-full bg-[#0066cc] shrink-0" />
                                )}
                                <h4 className="text-xs font-semibold text-[#1d1d1f] tracking-tight">
                                  {item.title}
                                </h4>
                                <span className="text-[11px] text-[#86868b]">
                                  • {new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              </div>
                              <p
                                className={`text-xs text-[#48484a] mt-1 leading-relaxed ${
                                  isExpanded ? '' : 'line-clamp-2'
                                }`}
                              >
                                {item.message}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="p-1 text-[#86868b] hover:text-[#1d1d1f] shrink-0"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
  );
};
