import React from 'react';
import { UtilityCard } from '../../../components/ui/UtilityCard';
import { Trash2, MessageSquare } from 'lucide-react';
import { EmptyState } from '../../../components/common/EmptyState';
import { useAdminDashboard } from './state';
export const MessagesTab: React.FC = () => {
  const {
    contactMessages,
    handleMarkMessageRead,
    handleDeleteContactMessage,
  } = useAdminDashboard();
  return (
<UtilityCard>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">User Contact Inquiries</h3>
                    <p className="text-[13px] text-[#86868b] mt-1 leading-relaxed">
                      Messages from the Contact page.
                    </p>
                  </div>
                  <span className="text-xs text-[#86868b]">{contactMessages.length} Total</span>
                </div>

                {contactMessages.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="No Messages Received Yet"
                    description="New messages will show up here."
                  />
                ) : (
                  <div className="space-y-4">
                    {contactMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          msg.status === 'NEW'
                            ? 'bg-[#0066cc]/[0.02] border-[#0066cc]/30 '
                            : 'bg-white border-[#e5e5ea]'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#f0f0f2]">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center font-semibold text-xs text-[#1d1d1f]">
                              {msg.fullName ? msg.fullName[0]?.toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-[#1d1d1f]">{msg.fullName}</span>
                                {msg.status === 'NEW' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
                                    New
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-normal bg-[#f5f5f7] text-[#86868b]">
                                    Read
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-[#86868b] mt-0.5">
                                <a href={`mailto:${msg.email}`} className="text-[#0066cc] hover:underline">
                                  {msg.email}
                                </a>
                                {msg.phone && <span>• {msg.phone}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <span className="text-[11px] text-[#86868b]">
                              {new Date(msg.createdAt).toLocaleDateString()} {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {msg.status === 'NEW' && (
                              <button
                                onClick={() => handleMarkMessageRead(msg.id)}
                                className="px-3 py-1 rounded-full text-xs font-normal border border-[#e5e5ea] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] cursor-pointer transition-all"
                              >
                                Mark Read
                              </button>
                            )}
                            <a
                              href={`mailto:${msg.email}?subject=Re: ${encodeURIComponent(msg.subject)}`}
                              className="px-3.5 py-1 rounded-full text-xs font-semibold bg-[#0066cc] hover:bg-[#0071e3] text-white cursor-pointer transition-all"
                            >
                              Reply Email
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteContactMessage(msg.id)}
                              className="p-1.5 rounded-full text-[#86868b] hover:text-danger hover:bg-danger-soft border border-transparent hover:border-danger-line transition-all cursor-pointer"
                              title="Delete Message"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3">
                          <p className="text-xs font-semibold text-[#1d1d1f]">Subject: {msg.subject}</p>
                          <p className="text-xs text-[#48484a] mt-1 whitespace-pre-wrap leading-relaxed">
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </UtilityCard>
  );
};
