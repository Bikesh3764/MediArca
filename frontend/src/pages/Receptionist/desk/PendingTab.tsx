import React from 'react';
import { getLocalDateString } from '../../../services/api';
import { CheckCircle2, X, Phone, Check, Search } from 'lucide-react';
import { EmptyState } from '../../../components/common/EmptyState';
import { cleanDoctorName, cleanShiftDisplayName } from './helpers';
import { useReceptionistDashboard } from './state';
export const PendingTab: React.FC = () => {
  const {
    setRescheduleTarget,
    setRescheduleDate,
    setRescheduleSlotId,
    setRescheduleError,
    pendingAppointments,
    pendingLoading,
    approvingId,
    rejectingId,
    pendingSearch,
    setPendingSearch,
    handleApprovePendingAppointment,
    handleRejectPendingAppointment,
  } = useReceptionistDashboard();
  return (
<div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#f0f0f2]">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base sm:text-lg font-semibold text-[#1d1d1f] tracking-tight">
                    Pending Approvals
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
                    {pendingAppointments.length}
                  </span>
                </div>

                {pendingAppointments.length > 0 && (
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={pendingSearch}
                      onChange={(e) => setPendingSearch(e.target.value)}
                      placeholder="Search patient, phone, doctor..."
                      className="w-full h-10 sm:h-9 pl-9 pr-8 rounded-full border border-[#e5e5ea] text-base sm:text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
                    />
                    {pendingSearch && (
                      <button aria-label="Close"
                        type="button"
                        onClick={() => setPendingSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f] p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {pendingLoading && pendingAppointments.length === 0 ? (
                <div className="py-14 text-center text-xs text-[#86868b]">
                  Loading pending online bookings...
                </div>
              ) : pendingAppointments.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="All Bookings Processed"
                  description="No online bookings are awaiting reception confirmation. New patient booking requests will appear here instantly."
                />
              ) : (() => {
                const filteredPending = pendingAppointments.filter((appt) => {
                  if (!pendingSearch.trim()) return true;
                  const q = pendingSearch.toLowerCase().trim();
                  const patient = (appt.patientName || appt.patient?.user?.fullName || '').toLowerCase();
                  const phone = (appt.patientPhone || appt.patient?.user?.phone || '').toLowerCase();
                  const doctor = (appt.doctor?.user?.fullName || '').toLowerCase();
                  const specialty = (appt.doctor?.specialty || '').toLowerCase();
                  return patient.includes(q) || phone.includes(q) || doctor.includes(q) || specialty.includes(q);
                });

                if (filteredPending.length === 0) {
                  return (
                    <div className="py-12 text-center">
                      <p className="font-semibold text-sm text-[#1d1d1f]">No Matching Requests</p>
                      <p className="mt-1 text-xs text-[#86868b] mb-3">
                        No pending bookings match "{pendingSearch}".
                      </p>
                      <button
                        type="button"
                        onClick={() => setPendingSearch('')}
                        className="h-8 px-4 rounded-full text-xs font-medium bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#e8e8ed] transition-all cursor-pointer"
                      >
                        Clear Search
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-[#f0f0f2] border border-[#e5e5ea] rounded-2xl overflow-hidden bg-white">
                    {filteredPending.map((appt) => {
                      const fee = appt.fee || appt.doctor?.consultationFee || 0;
                      const isApproving = approvingId === appt.id;
                      const isRejecting = rejectingId === appt.id;
                      const patientDisplay = appt.patientName || appt.patient?.user?.fullName || 'Patient';
                      const phoneDisplay = appt.patientPhone || appt.patient?.user?.phone || '';

                      return (
                        <div
                          key={appt.id}
                          className="p-4 sm:px-5 sm:py-4 hover:bg-[#fafafc] transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                        >
                          {/* Patient & Visit Summary */}
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-[#1d1d1f]">
                                {patientDisplay}
                              </span>
                              {appt.isForOther && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
                                  Family{appt.patientAge ? ` • ${appt.patientAge}y` : ''}
                                </span>
                              )}
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0066cc]/10 text-[#0066cc]">
                                ₹{fee}
                              </span>
                            </div>

                            <div className="flex items-center gap-2.5 text-xs text-[#86868b] flex-wrap">
                              <span className="font-medium text-[#1d1d1f]">
                                {cleanDoctorName(appt.doctor?.user?.fullName)} ({appt.doctor?.specialty})
                              </span>
                              <span>•</span>
                              <span>
                                {appt.appointmentDate} • {cleanShiftDisplayName(appt.checkingWindow)}
                              </span>
                              {phoneDisplay && (
                                <>
                                  <span>•</span>
                                  <a
                                    href={`tel:${phoneDisplay}`}
                                    className="inline-flex items-center gap-1 text-[#0066cc] hover:underline font-medium"
                                  >
                                    <Phone className="w-3 h-3" />
                                    <span>{phoneDisplay}</span>
                                  </a>
                                </>
                              )}
                            </div>

                            {appt.reasonForVisit && appt.reasonForVisit !== 'General Medical Consultation' && (
                              <p className="text-xs text-[#86868b] pt-0.5 truncate max-w-xl">
                                Reason: {appt.reasonForVisit}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap pt-2 lg:pt-0 border-t lg:border-t-0 border-[#f0f0f2]">
                            <button
                              type="button"
                              disabled={isRejecting || isApproving}
                              onClick={() => {
                                setRescheduleTarget({
                                  appointmentId: appt.id,
                                  patientName: patientDisplay,
                                  doctorName: cleanDoctorName(appt.doctor?.user?.fullName),
                                  currentDate: appt.appointmentDate,
                                  currentQueueNumber: appt.queueNumber,
                                  doctorId: appt.doctorId,
                                  slotId: appt.slotId,
                                });
                                const baseDate = appt.appointmentDate && appt.appointmentDate > getLocalDateString() ? appt.appointmentDate : getLocalDateString();
                                const [y, m, day] = baseDate.split('-').map(Number);
                                const d = new Date(y, m - 1, day + 1);
                                setRescheduleDate(getLocalDateString(d));
                                setRescheduleSlotId(appt.slotId || '');
                                setRescheduleError(null);
                              }}
                              className="h-8 px-3 rounded-full text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] border border-[#e5e5ea] transition-all cursor-pointer disabled:opacity-50"
                            >
                              Shift Date
                            </button>

                            <button
                              type="button"
                              disabled={isRejecting || isApproving}
                              onClick={() => handleRejectPendingAppointment(appt.id)}
                              className="h-8 px-3.5 rounded-full text-xs font-medium text-[#86868b] hover:text-rose-600 hover:bg-rose-50 border border-[#e5e5ea] transition-all cursor-pointer disabled:opacity-50"
                            >
                              {isRejecting ? 'Declining...' : 'Decline'}
                            </button>

                            <button
                              type="button"
                              disabled={isApproving || isRejecting}
                              onClick={() => handleApprovePendingAppointment(appt.id)}
                              className="h-8 px-4 rounded-full text-xs font-medium text-white bg-[#0066cc] hover:bg-[#0071e3] transition-all active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{isApproving ? 'Confirming...' : 'Confirm & Issue Token'}</span>
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
