import React from 'react';
import { ReceptionistQueueItem, getLocalDateString, WEEKDAY_NAMES, getDayOfWeekCode } from '../../../services/api';
import { CabinStatusControl } from '../../../components/ui/DoctorCabinPresence';
import { Clock, CheckCircle2, X, Printer, Stethoscope, Search, ChevronDown, CalendarX, CalendarOff, Users } from 'lucide-react';
import { EmptyState } from '../../../components/common/EmptyState';
import { cleanDoctorName, cleanShiftDisplayName, getCleanReason } from './helpers';
import { useReceptionistDashboard } from './state';
export const QueueTab: React.FC = () => {
  const {
    data,
    setData,
    setActiveTab,
    setScheduleModalDoctor,
    setRescheduleTarget,
    setRescheduleDate,
    setRescheduleSlotId,
    setRescheduleError,
    selectedDoctorId,
    setBookedPass,
    queueDoctorId,
    setQueueDoctorId,
    queueDate,
    setQueueDate,
    queueAppointments,
    queueLoading,
    queueSearch,
    setQueueSearch,
    statusFilter,
    setStatusFilter,
    queueShiftFilter,
    setQueueShiftFilter,
    hasLoadedInitialQueue,
    linkedDoctors,
    availableQueueShifts,
    handleStatusChange,
    togglingCheckinId,
    handleToggleCheckIn,
  } = useReceptionistDashboard();
  return (
<div className="space-y-5">
              {/* Top Controls Row: Title + Doctor & Date Selectors */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#f0f0f2]">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base sm:text-lg font-semibold text-[#1d1d1f] tracking-tight">
                    Live Patient Queue
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-normal bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
                    {queueAppointments.length}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  {linkedDoctors.length > 0 && (
                    <div className="relative">
                      <select
                        value={queueDoctorId}
                        onChange={(e) => {
                          setQueueDoctorId(e.target.value);
                          setQueueShiftFilter('ALL');
                        }}
                        className="h-10 pl-3.5 pr-8 rounded-xl border border-[#d2d2d7] text-base sm:text-xs font-normal bg-white text-[#1d1d1f]  transition-all focus:outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] appearance-none cursor-pointer w-full sm:w-auto"
                      >
                        {linkedDoctors.map((doc) => (
                          <option key={doc.doctorId} value={doc.doctorId}>
                            {cleanDoctorName(doc.fullName)} — {doc.specialty}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-[#86868b] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  )}

                  {/* Shift Selector Drawer (Like Doctor Wise) */}
                  <div className="relative">
                    <select
                      value={queueShiftFilter}
                      onChange={(e) => setQueueShiftFilter(e.target.value)}
                      className="h-10 pl-3.5 pr-8 rounded-xl border border-[#d2d2d7] text-base sm:text-xs font-normal bg-white text-[#1d1d1f]  transition-all focus:outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] appearance-none cursor-pointer w-full sm:w-auto"
                      title="Filter queue by clinical shift"
                    >
                      <option value="ALL">All Shifts</option>
                      {availableQueueShifts.map((shiftName) => (
                        <option key={shiftName} value={shiftName}>
                          {shiftName}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[#86868b] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={queueDate}
                      onChange={(e) => setQueueDate(e.target.value)}
                      className="h-10 px-3.5 rounded-xl border border-[#d2d2d7] text-base sm:text-xs font-normal bg-white text-[#1d1d1f]  transition-all focus:outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] flex-1 sm:flex-initial"
                    />
                    {queueDate !== getLocalDateString() && (
                      <button
                        type="button"
                        onClick={() => setQueueDate(getLocalDateString())}
                        className="h-10 px-3.5 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] text-xs font-normal text-[#0066cc] border border-[#e5e5ea] transition-all cursor-pointer shrink-0"
                      >
                        Today
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Selected Doctor Cabin Presence Bar */}
              {(() => {
                const targetDoctor = linkedDoctors.find((d) => d.doctorId === queueDoctorId);
                if (!targetDoctor) return null;
                return (
                  <div className="pb-4 border-b border-[#f0f0f2]">
                    <CabinStatusControl
                      currentStatus={targetDoctor.cabinStatus}
                      expectedReturnTime={targetDoctor.expectedReturnTime}
                      doctorId={targetDoctor.doctorId}
                      doctorName={cleanDoctorName(targetDoctor.fullName)}
                      onStatusChange={(newStatus, newReturnTime) => {
                        setData((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            doctors: prev.doctors.map((d) =>
                              d.doctorId === targetDoctor.doctorId
                                ? { ...d, cabinStatus: newStatus, expectedReturnTime: newReturnTime }
                                : d
                            ),
                          };
                        });
                      }}
                    />
                  </div>
                );
              })()}

              {/* Filter Segmented Bar & Search Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-full inline-flex items-center gap-0.5 overflow-x-auto max-w-full no-scrollbar">
                  {(
                    [
                      { id: 'WAITING', label: 'Waiting' },
                      { id: 'IN_CONSULTATION', label: 'In Cabin' },
                      { id: 'COMPLETED', label: 'Completed' },
                      { id: 'CANCELLED', label: 'Cancelled' },
                      { id: 'ALL', label: 'All' },
                    ] as const
                  ).map((tab) => {
                    const count =
                      tab.id === 'ALL'
                        ? (queueShiftFilter === 'ALL'
                            ? queueAppointments.length
                            : queueAppointments.filter((a) => cleanShiftDisplayName(a.checkingWindow) === queueShiftFilter).length)
                        : (queueShiftFilter === 'ALL'
                            ? queueAppointments.filter((a) => a.status === tab.id).length
                            : queueAppointments.filter((a) => a.status === tab.id && cleanShiftDisplayName(a.checkingWindow) === queueShiftFilter).length);
                    const isActive = statusFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStatusFilter(tab.id)}
                        className={`h-8 px-3.5 rounded-full text-xs transition-all whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-white text-[#1d1d1f] font-semibold  border border-black/5'
                            : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span className={`text-[11px] ${isActive ? 'text-[#0066cc] font-semibold' : 'text-[#86868b]'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="relative w-full lg:w-64">
                  <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    placeholder="Search patient, phone, token..."
                    className="w-full h-10 pl-9 pr-8 rounded-full border border-[#e5e5ea] text-base sm:text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
                  />
                  {queueSearch && (
                    <button aria-label="Close"
                      type="button"
                      onClick={() => setQueueSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f] p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Doctor On Leave / Off Day Alert */}
              {(() => {
                const doc = linkedDoctors.find((d) => d.doctorId === queueDoctorId);
                if (!doc) return null;
                const isToday = queueDate === getLocalDateString();
                if (isToday && doc.isOnLeaveToday) {
                  return (
                    <div className="mb-4 p-3.5 rounded-2xl bg-danger-soft border border-danger-line text-xs text-danger flex items-center justify-between gap-3 animate-fadeIn">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CalendarX className="w-4 h-4 text-danger shrink-0" />
                        <span className="font-semibold text-danger">
                          {cleanDoctorName(doc.fullName)} is marked on leave today{doc.todayLeave?.reason ? ` (${doc.todayLeave.reason})` : ''}.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setScheduleModalDoctor({
                            doctorId: doc.doctorId,
                            doctorName: cleanDoctorName(doc.fullName),
                          })
                        }
                        className="h-7 px-3 rounded-full bg-white hover:bg-danger-soft text-danger border border-danger-line font-semibold text-[11px] shrink-0 transition-all cursor-pointer"
                      >
                        Schedule
                      </button>
                    </div>
                  );
                }
                const dayCode = getDayOfWeekCode(queueDate);
                const docDays = doc.workingDays || ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                if (!docDays.includes(dayCode)) {
                  return (
                    <div className="mb-4 p-3 rounded-2xl bg-warning-soft border border-warning-line text-xs text-warning flex items-center justify-between gap-3 animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <CalendarOff className="w-4 h-4 text-warning shrink-0" />
                        <span>
                          {cleanDoctorName(doc.fullName)} does not usually sit on {WEEKDAY_NAMES[dayCode as any] || dayCode}s at this clinic.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setScheduleModalDoctor({
                            doctorId: doc.doctorId,
                            doctorName: cleanDoctorName(doc.fullName),
                          })
                        }
                        className="h-7 px-2.5 rounded-full bg-white hover:bg-warning-soft text-warning border border-warning-line font-semibold text-[11px] shrink-0 transition-all cursor-pointer"
                      >
                        Days
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Queue Content */}
              {linkedDoctors.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No Doctors Assigned"
                  description="Ask your clinic to assign doctors to you."
                />
              ) : queueLoading && !hasLoadedInitialQueue ? (
                <div className="py-14 text-center text-xs text-[#86868b]">Loading…</div>
              ) : queueAppointments.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No Patients in Queue"
                  description={`No appointments scheduled for ${queueDate}.`}
                  actionText="Issue Walk-in Token"
                  onAction={() => setActiveTab('walkin')}
                />
              ) : (() => {
                const filteredAppointments = queueAppointments.filter((appt) => {
                  if (statusFilter !== 'ALL' && appt.status !== statusFilter) return false;
                  if (queueShiftFilter !== 'ALL' && cleanShiftDisplayName(appt.checkingWindow) !== queueShiftFilter) return false;
                  if (!queueSearch.trim()) return true;
                  const q = queueSearch.toLowerCase().trim();
                  const name = (appt.patientName || '').toLowerCase();
                  const phone = (appt.patientPhone || '').toLowerCase();
                  const token = String(appt.queueNumber || '');
                  return name.includes(q) || phone.includes(q) || token.includes(q);
                });

                const queueDoctor = linkedDoctors.find((d) => d.doctorId === queueDoctorId);
                const isDoctorAway = Boolean(queueDoctor?.cabinStatus && queueDoctor.cabinStatus !== 'IN_CABIN');
                const isTodayQueue = queueDate === getLocalDateString();

                if (filteredAppointments.length === 0) {
                  if (queueSearch.trim()) {
                    return (
                      <div className="py-14 text-center">
                        <p className="text-sm font-semibold text-[#1d1d1f]">No Results Found</p>
                        <p className="text-xs text-[#86868b] mt-1 mb-2">
                          No patients match &ldquo;{queueSearch}&rdquo;.
                        </p>
                        <button
                          type="button"
                          onClick={() => setQueueSearch('')}
                          className="text-xs text-[#0066cc] font-normal hover:underline cursor-pointer"
                        >
                          Clear Search
                        </button>
                      </div>
                    );
                  }

                  if (statusFilter === 'WAITING') {
                    return (
                      <div className="py-14 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center mx-auto mb-3 text-[#86868b]">
                          <Clock className="w-5 h-5 text-[#86868b]" />
                        </div>
                        <p className="text-sm font-semibold text-[#1d1d1f]">No Patients in Waiting Queue</p>
                        <p className="text-xs text-[#86868b] mt-1 max-w-sm mx-auto">
                          There are currently no patients waiting for consultation{queueShiftFilter !== 'ALL' ? ` in ${queueShiftFilter}` : ''}.
                        </p>
                      </div>
                    );
                  }

                  if (statusFilter === 'IN_CONSULTATION') {
                    return (
                      <div className="py-14 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center mx-auto mb-3 text-[#86868b]">
                          <Stethoscope className="w-5 h-5 text-[#86868b]" />
                        </div>
                        <p className="text-sm font-semibold text-[#1d1d1f]">No Patient in Cabin</p>
                        <p className="text-xs text-[#86868b] mt-1 max-w-sm mx-auto">
                          Doctor cabin is currently clear{queueShiftFilter !== 'ALL' ? ` for ${queueShiftFilter}` : ''}.
                        </p>
                      </div>
                    );
                  }

                  if (statusFilter === 'COMPLETED') {
                    return (
                      <div className="py-14 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center mx-auto mb-3 text-[#86868b]">
                          <CheckCircle2 className="w-5 h-5 text-[#86868b]" />
                        </div>
                        <p className="text-sm font-semibold text-[#1d1d1f]">No Completed Consultations</p>
                        <p className="text-xs text-[#86868b] mt-1 max-w-sm mx-auto">
                          No completed visits yet{queueShiftFilter !== 'ALL' ? ` in ${queueShiftFilter}` : ''}.
                        </p>
                      </div>
                    );
                  }

                  if (statusFilter === 'CANCELLED') {
                    return (
                      <div className="py-14 text-center">
                        <p className="text-sm font-semibold text-[#1d1d1f]">No Cancelled Appointments</p>
                        <p className="text-xs text-[#86868b] mt-1 max-w-sm mx-auto">
                          There are no cancelled appointments for this date{queueShiftFilter !== 'ALL' ? ` in ${queueShiftFilter}` : ''}.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="py-14 text-center">
                      <p className="text-sm font-semibold text-[#1d1d1f]">
                        No Patients {queueShiftFilter !== 'ALL' ? `in ${queueShiftFilter}` : 'Scheduled'}
                      </p>
                      <p className="text-xs text-[#86868b] mt-1 max-w-sm mx-auto">
                        No appointments found for this selection on {queueDate}.
                      </p>
                    </div>
                  );
                }

                const getStatusPriority = (status: string): number => {
                  switch (status) {
                    case 'IN_CONSULTATION':
                      return 0;
                    case 'WAITING':
                      return 1;
                    case 'COMPLETED':
                      return 2;
                    case 'CANCELLED':
                    case 'EXPIRED':
                    case 'REJECTED':
                      return 3;
                    default:
                      return 4;
                  }
                };

                const groupedByShift: Record<string, ReceptionistQueueItem[]> = {};

                filteredAppointments.forEach((appt) => {
                  const shiftKey = cleanShiftDisplayName(appt.checkingWindow);
                  if (!groupedByShift[shiftKey]) {
                    groupedByShift[shiftKey] = [];
                  }
                  groupedByShift[shiftKey].push(appt);
                });

                Object.keys(groupedByShift).forEach((shiftKey) => {
                  groupedByShift[shiftKey].sort((a, b) => {
                    const prioA = getStatusPriority(a.status);
                    const prioB = getStatusPriority(b.status);
                    if (prioA !== prioB) return prioA - prioB;
                    return (a.queueNumber || 0) - (b.queueNumber || 0);
                  });
                });

                const sortedShiftKeys = Object.keys(groupedByShift).sort((a, b) => {
                  const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
                  const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
                  if (numA !== numB) return numA - numB;
                  return a.localeCompare(b);
                });

                return (
                  <div className="space-y-5">
                    {sortedShiftKeys.map((shiftName) => {
                      const shiftAppts = groupedByShift[shiftName];
                      const waitingCount = shiftAppts.filter((a) => a.status === 'WAITING').length;
                      const inCabinCount = shiftAppts.filter((a) => a.status === 'IN_CONSULTATION').length;
                      const completedCount = shiftAppts.filter((a) => a.status === 'COMPLETED').length;
                      const cancelledCount = shiftAppts.filter((a) => a.status === 'CANCELLED' || a.status === 'EXPIRED').length;

                      return (
                        <div key={shiftName} className="border border-[#e5e5ea] rounded-2xl overflow-hidden bg-white ">
                          {/* Apple Shift Section Header */}
                          <div className="px-4 sm:px-5 py-3 bg-[#f5f5f7] border-b border-[#e5e5ea] flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2.5">
                              <span className="text-[13px] font-semibold text-[#1d1d1f]">
                                {shiftName}
                              </span>
                              <span className="text-[11px] font-normal text-[#86868b] px-2.5 py-0.5 rounded-full bg-white border border-[#e5e5ea]">
                                {shiftAppts.length} {shiftAppts.length === 1 ? 'patient' : 'patients'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-[#86868b] flex-wrap">
                              {inCabinCount > 0 && (
                                <span className="inline-flex items-center gap-1 font-normal text-[#0066cc]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#0066cc] animate-pulse" />
                                  {inCabinCount} in cabin
                                </span>
                              )}
                              {waitingCount > 0 && (
                                <span className="font-normal text-[#1d1d1f]">
                                  {waitingCount} waiting
                                </span>
                              )}
                              {completedCount > 0 && (
                                <span className="text-[#86868b]">
                                  {waitingCount > 0 ? '• ' : ''}{completedCount} done
                                </span>
                              )}
                              {cancelledCount > 0 && (
                                <span className="text-[#86868b]">
                                  • {cancelledCount} cancelled
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="divide-y divide-[#f0f0f2]">
                            {shiftAppts.map((appt) => {
                      const canMarkArrival = !['EXPIRED', 'CANCELLED', 'REJECTED', 'COMPLETED'].includes(appt.status);
                      const canCallIn =
                        appt.status === 'WAITING' &&
                        appt.isCheckedIn &&
                        !isDoctorAway &&
                        (appt.appointmentDate || queueDate) === getLocalDateString();

                      const isCancelledOrExpired = appt.status === 'CANCELLED' || appt.status === 'EXPIRED';

                      return (
                        <div
                          key={appt.id}
                          className={`p-4 sm:px-5 sm:py-4 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 ${
                            isCancelledOrExpired ? 'bg-[#fafafc]/60 opacity-75' : 'hover:bg-[#fafafc]'
                          }`}
                        >
                          {/* Left: Token + Patient Details */}
                          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                            <div
                              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-semibold text-[15px] shrink-0 transition-all ${
                                appt.status === 'IN_CONSULTATION'
                                  ? 'bg-[#1d1d1f] text-white '
                                  : appt.status === 'COMPLETED'
                                  ? 'bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]'
                                  : isCancelledOrExpired
                                  ? 'bg-[#f5f5f7] text-[#a1a1a6] border border-[#e5e5ea] line-through'
                                  : 'bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]'
                              }`}
                            >
                              #{appt.queueNumber}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`font-semibold text-sm truncate ${
                                    isCancelledOrExpired ? 'text-[#86868b] line-through' : 'text-[#1d1d1f]'
                                  }`}
                                >
                                  {appt.patientName}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]">
                                  {cleanShiftDisplayName(appt.checkingWindow)}
                                </span>
                                {(() => {
                                  const doc = linkedDoctors.find((d) => d.doctorId === (appt.doctorId || selectedDoctorId));
                                  if (!doc?.fullName) return null;
                                  return (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-normal bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]">
                                      {cleanDoctorName(doc.fullName)}
                                    </span>
                                  );
                                })()}
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-normal border ${
                                    appt.status === 'IN_CONSULTATION'
                                      ? 'bg-[#0066cc]/10 text-[#0066cc] border-[#0066cc]/20'
                                      : appt.status === 'WAITING'
                                      ? 'bg-[#f5f5f7] text-[#1d1d1f] border-[#e5e5ea]'
                                      : 'bg-[#f5f5f7] text-[#86868b] border-[#e5e5ea]'
                                  }`}
                                >
                                  {appt.status === 'IN_CONSULTATION'
                                    ? 'In Cabin'
                                    : appt.status === 'WAITING'
                                    ? 'Waiting'
                                    : appt.status === 'COMPLETED'
                                    ? 'Completed'
                                    : appt.status === 'CANCELLED'
                                    ? 'Cancelled'
                                    : 'Expired'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2.5 text-xs text-[#86868b] mt-1 flex-wrap">
                                {appt.patientPhone && <span>{appt.patientPhone}</span>}
                                {appt.estimatedTime && (
                                  <>
                                    <span>•</span>
                                    <span>
                                      Est. <span className="text-[#1d1d1f] font-normal">{appt.estimatedTime}</span>
                                    </span>
                                  </>
                                )}
                                {(() => {
                                  const cleanReason = getCleanReason(appt.reasonForVisit, appt.patientName);
                                  if (!cleanReason) return null;
                                  return (
                                    <>
                                      <span>•</span>
                                      <span className="truncate max-w-[220px]">{cleanReason}</span>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>

                          {/* Right: Arrival Toggle + Queue Actions */}
                          <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap pt-2 lg:pt-0 border-t lg:border-t-0 border-[#f0f0f2]">
                            {/* Arrival Check-In Pill */}
                            {canMarkArrival && (
                              <button
                                type="button"
                                disabled={togglingCheckinId === appt.id}
                                onClick={() => handleToggleCheckIn(appt.id, appt.isCheckedIn)}
                                className={`h-8 px-3 rounded-full text-xs font-normal inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                                  appt.isCheckedIn
                                    ? 'bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/25'
                                    : 'bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea]'
                                }`}
                                title={appt.isCheckedIn ? 'Click to undo arrival' : 'Mark patient arrived at clinic'}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    appt.isCheckedIn ? 'bg-[#0066cc]' : 'bg-[#86868b]'
                                  }`}
                                />
                                <span>{appt.isCheckedIn ? 'Arrived' : 'Mark arrived'}</span>
                              </button>
                            )}

                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Primary Action: Call In or Complete */}
                              {canCallIn && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(appt.id, 'IN_CONSULTATION')}
                                  className="h-8 px-3.5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-normal transition-all active:scale-[0.98] cursor-pointer"
                                >
                                  Call In
                                </button>
                              )}

                              {appt.status === 'WAITING' && appt.isCheckedIn && isDoctorAway && isTodayQueue && (
                                <span className="h-8 px-3 rounded-full bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea] text-xs font-normal inline-flex items-center">
                                  Doctor Away
                                </span>
                              )}

                              {appt.status === 'IN_CONSULTATION' && (
                                <span className="h-8 px-3 rounded-full bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20 text-xs font-normal inline-flex items-center">
                                  In Cabin
                                </span>
                              )}

                              {/* Shift Date */}
                              {(appt.status === 'WAITING' || appt.status === 'PENDING_APPROVAL') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRescheduleTarget({
                                      appointmentId: appt.id,
                                      patientName: appt.patientName,
                                      doctorName: queueDoctor?.fullName || 'Practitioner',
                                      currentDate: queueDate,
                                      currentQueueNumber: appt.queueNumber,
                                      doctorId: queueDoctorId,
                                      slotId: appt.slotId,
                                    });
                                    const baseDate = queueDate && queueDate > getLocalDateString() ? queueDate : getLocalDateString();
                                    const [y, m, day] = baseDate.split('-').map(Number);
                                    const d = new Date(y, m - 1, day + 1);
                                    setRescheduleDate(getLocalDateString(d));
                                    setRescheduleSlotId(appt.slotId || '');
                                    setRescheduleError(null);
                                  }}
                                  className="h-8 px-3 rounded-full text-[#1d1d1f] hover:bg-[#f5f5f7] text-xs font-normal border border-[#e5e5ea] transition-all cursor-pointer"
                                  title="Reschedule to another date"
                                >
                                  Move
                                </button>
                              )}

                              {/* Cancel */}
                              {appt.status === 'WAITING' && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(appt.id, 'CANCELLED')}
                                  className="h-8 px-3 rounded-full text-[#86868b] hover:text-danger hover:bg-danger-soft text-xs font-normal border border-[#e5e5ea] transition-all cursor-pointer"
                                >
                                  Cancel
                                </button>
                              )}

                              {/* Reprint Pass */}
                              <button
                                type="button"
                                onClick={() => {
                                  setBookedPass({
                                    queueNumber: appt.queueNumber,
                                    estimatedTime: appt.estimatedTime,
                                    checkingWindow: appt.checkingWindow,
                                    appointmentDate: queueDate,
                                    patientName: appt.patientName,
                                    patientPhone: appt.patientPhone,
                                    doctorName: queueDoctor?.fullName || 'Practitioner',
                                    doctorSpecialty: queueDoctor?.specialty,
                                    clinicName: data?.clinic?.clinicName,
                                    clinicAddress: data?.clinic?.address,
                                  });
                                }}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] border border-[#e5e5ea] transition-colors cursor-pointer"
                                title="Print Token Slip"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                              );
                            })}
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
