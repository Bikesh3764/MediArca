import React from 'react';
import { formatDisplayPhone } from '../../../utils/phoneUtils';
import {
  ReceptionistQueueItem,
  formatDisplayDate,
  getLocalDateString,
  getTomorrowDateString,
  WEEKDAY_NAMES,
  getDayOfWeekCode,
} from '../../../services/api';
import { CabinStatusControl } from '../../../components/ui/DoctorCabinPresence';
import { Clock, CheckCircle2, X, Search, ChevronDown, CalendarX, CalendarOff, Users, Play, PauseCircle } from 'lucide-react';
import { EmptyState } from '../../../components/common/EmptyState';
import { cleanDoctorName, cleanShiftDisplayName } from './helpers';
import { useReceptionistDashboard } from './state';
import MoreLine from '../../../components/common/MoreLine';
import { RowMenu, type RowMenuItem } from '../../../components/ui/RowMenu';
import { WalkinCodeModal, type WalkinCodeTarget } from '../../../components/ui/WalkinCodeModal';

const isDoneStatus = (status: string) => ['COMPLETED', 'CANCELLED', 'EXPIRED', 'REJECTED'].includes(status);

export const QueueTab: React.FC = () => {
  const {
    setData,
    setActiveTab,
    setScheduleModalDoctor,
    setRescheduleTarget,
    setRescheduleDate,
    setRescheduleSlotId,
    setRescheduleError,
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
    deskLoadFailed,
    fetchDeskData: retryDeskData,
    handleStatusChange,
    togglingCheckinId,
    handleToggleCheckIn,
  } = useReceptionistDashboard();

  const today = getLocalDateString();
  const tomorrow = getTomorrowDateString();
  const isTodayQueue = queueDate === today;
  const queueDoctor = linkedDoctors.find((d) => d.doctorId === queueDoctorId);
  const isDoctorAway = Boolean(queueDoctor?.cabinStatus && queueDoctor.cabinStatus !== 'IN_CABIN');

  const inShift = (a: ReceptionistQueueItem) => queueShiftFilter === 'ALL' || cleanShiftDisplayName(a) === queueShiftFilter;
  const inCabin = isTodayQueue ? queueAppointments.find((a) => a.status === 'IN_CONSULTATION') : undefined;
  const waitingAll = queueAppointments.filter((a) => a.status === 'WAITING' && inShift(a));
  const doneAll = queueAppointments.filter((a) => isDoneStatus(a.status) && inShift(a));
  const arrivedCount = waitingAll.filter((a) => a.isCheckedIn).length;
  const showingDone = statusFilter === 'DONE';

  const openMove = (appt: ReceptionistQueueItem) => {
    setRescheduleTarget({
      appointmentId: appt.id,
      patientName: appt.patientName,
      doctorName: queueDoctor?.fullName || 'Doctor',
      currentDate: queueDate,
      currentQueueNumber: appt.queueNumber,
      doctorId: queueDoctorId,
      slotId: appt.slotId,
    });
    const baseDate = queueDate && queueDate > today ? queueDate : today;
    const [y, m, day] = baseDate.split('-').map(Number);
    setRescheduleDate(getLocalDateString(new Date(y, m - 1, day + 1)));
    setRescheduleSlotId(appt.slotId || '');
    setRescheduleError(null);
  };

  const [codeFor, setCodeFor] = React.useState<WalkinCodeTarget | null>(null);

  const dayButton = (value: string, label: string) => (
    <button
      type="button"
      onClick={() => setQueueDate(value)}
      className={`h-8 px-4 rounded-full text-xs transition-all whitespace-nowrap cursor-pointer ${
        queueDate === value ? 'bg-white text-[#1d1d1f] font-semibold border border-black/5' : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
      }`}
    >
      {label}
    </button>
  );

  const selectClass =
    'h-10 pl-4 pr-8 rounded-full border border-[#d2d2d7] text-base sm:text-xs font-normal bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] appearance-none cursor-pointer w-full sm:w-auto';

  return (
    <div className="space-y-5">
      {/* Top row: title, doctor, shift and day */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <h3 className="text-base sm:text-lg font-semibold text-[#1d1d1f] tracking-tight">Queue</h3>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {linkedDoctors.length > 1 && (
            <div className="relative">
              <select
                value={queueDoctorId}
                onChange={(e) => {
                  setQueueDoctorId(e.target.value);
                  setQueueShiftFilter('ALL');
                }}
                className={selectClass}
                aria-label="Doctor"
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

          {(availableQueueShifts.length > 1 || queueShiftFilter !== 'ALL') && (
            <div className="relative">
              <select value={queueShiftFilter} onChange={(e) => setQueueShiftFilter(e.target.value)} className={selectClass} aria-label="Shift">
                <option value="ALL">All Shifts</option>
                {availableQueueShifts.map((shiftName) => (
                  <option key={shiftName} value={shiftName}>
                    {shiftName}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#86868b] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-full inline-flex items-center gap-0.5 shrink-0">
              {dayButton(today, 'Today')}
              {dayButton(tomorrow, 'Tomorrow')}
            </div>
            <input
              type="date"
              value={queueDate}
              onChange={(e) => e.target.value && setQueueDate(e.target.value)}
              aria-label="Pick a date"
              className="h-10 px-3.5 rounded-full border border-[#d2d2d7] text-base sm:text-xs font-normal bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] flex-1 sm:flex-initial min-w-0"
            />
          </div>
        </div>
      </div>

      {/* Doctor and cabin status */}
      {queueDoctor && (
        <div className="p-4 rounded-2xl bg-[#f5f5f7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#1d1d1f] truncate">{cleanDoctorName(queueDoctor.fullName)}</p>
            {queueDoctor.specialty && <p className="text-xs text-[#86868b] truncate">{queueDoctor.specialty}</p>}
          </div>
          <CabinStatusControl
            currentStatus={queueDoctor.cabinStatus}
            expectedReturnTime={queueDoctor.expectedReturnTime}
            doctorId={queueDoctor.doctorId}
            doctorName={cleanDoctorName(queueDoctor.fullName)}
            onStatusChange={(newStatus, newReturnTime) => {
              setData((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  doctors: prev.doctors.map((d) =>
                    d.doctorId === queueDoctor.doctorId ? { ...d, cabinStatus: newStatus, expectedReturnTime: newReturnTime } : d
                  ),
                };
              });
            }}
          />
        </div>
      )}

      {/* Leave or day-off notice */}
      {(() => {
        const doc = queueDoctor;
        if (!doc) return null;
        if (isTodayQueue && doc.isOnLeaveToday) {
          return (
            <div className="p-3.5 rounded-2xl bg-danger-soft border border-danger-line text-xs text-danger flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2.5 min-w-0">
                <CalendarX className="w-4 h-4 text-danger shrink-0" />
                <span className="font-semibold text-danger">
                  {cleanDoctorName(doc.fullName)} is on leave today.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setScheduleModalDoctor({ doctorId: doc.doctorId, doctorName: cleanDoctorName(doc.fullName) })}
                className="h-8 px-3 rounded-full bg-white hover:bg-danger-soft text-danger border border-danger-line font-semibold text-xs shrink-0 transition-all cursor-pointer"
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
            <div className="p-3.5 rounded-2xl bg-warning-soft border border-warning-line text-xs text-warning flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <CalendarOff className="w-4 h-4 text-warning shrink-0" />
                <span>
                  {cleanDoctorName(doc.fullName)} doesn’t work here on {WEEKDAY_NAMES[dayCode as any] || dayCode}s.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setScheduleModalDoctor({ doctorId: doc.doctorId, doctorName: cleanDoctorName(doc.fullName) })}
                className="h-8 px-3 rounded-full bg-white hover:bg-warning-soft text-warning border border-warning-line font-semibold text-xs shrink-0 transition-all cursor-pointer"
              >
                Days
              </button>
            </div>
          );
        }
        return null;
      })()}

      {linkedDoctors.length === 0 && deskLoadFailed ? (
        <EmptyState icon={Users} title="Couldn’t load doctors" description="Check your connection and try again." actionText="Try Again" onAction={() => retryDeskData()} />
      ) : linkedDoctors.length === 0 ? (
        <EmptyState icon={Users} title="No doctors yet" description="Ask your clinic to assign doctors to you." />
      ) : queueLoading && !hasLoadedInitialQueue ? (
        <div className="py-14 text-center text-xs text-[#86868b]">Loading…</div>
      ) : (
        <>
          {/* In cabin */}
          {isTodayQueue && (
            <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {inCabin ? (
                <>
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-[#0066cc] text-white flex items-center justify-center font-semibold text-[16px] shrink-0">
                      #{inCabin.queueNumber}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-[#0066cc]">In cabin</p>
                      <p className="text-[15px] font-semibold text-[#1d1d1f] truncate">{inCabin.patientName}</p>
                      {(() => {
                        const line = [inCabin.patientPhone ? formatDisplayPhone(inCabin.patientPhone) : null]
                          .filter(Boolean)
                          .join(' · ');
                        return line ? <MoreLine className="text-xs text-[#86868b]" text={line} /> : null;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStatusChange(inCabin.id, 'COMPLETED')}
                      className="flex-1 sm:flex-none h-10 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(inCabin.id, 'WAITING')}
                      title="Send back to the waiting list"
                      className="h-10 px-4 rounded-full bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-normal flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <PauseCircle className="w-3.5 h-3.5" />
                      Hold
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-full bg-[#f5f5f7] flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-[#86868b]" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-[#1d1d1f]">No one in cabin</p>
                    <p className="text-xs text-[#86868b]">Tap Start consultation on an arrived patient.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Waiting / Done + search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
            <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-full inline-flex items-center gap-0.5">
              {(
                [
                  { id: 'WAITING', label: 'Waiting', count: waitingAll.length },
                  { id: 'DONE', label: 'Done', count: doneAll.length },
                ] as const
              ).map((tab) => {
                const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`h-8 px-4 rounded-full text-xs transition-all whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 ${
                      isActive ? 'bg-white text-[#1d1d1f] font-semibold border border-black/5' : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[11px] ${isActive ? 'text-[#0066cc] font-semibold' : 'text-[#86868b]'}`}>{tab.count}</span>
                  </button>
                );
              })}
            </div>
            {!showingDone && waitingAll.length > 0 && <span className="text-xs text-[#86868b]">{arrivedCount} arrived</span>}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                placeholder="Search name, phone or token"
                className="w-full h-10 pl-9 pr-8 rounded-full border border-[#e5e5ea] text-base sm:text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
              />
              {queueSearch && (
                <button
                  aria-label="Clear search"
                  type="button"
                  onClick={() => setQueueSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f] p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {(() => {
            const base = showingDone ? doneAll : waitingAll;
            const q = queueSearch.toLowerCase().trim();
            const rows = q
              ? base.filter(
                  (a) =>
                    (a.patientName || '').toLowerCase().includes(q) ||
                    (a.patientPhone || '').toLowerCase().includes(q) ||
                    String(a.queueNumber || '').includes(q)
                )
              : base;

            if (queueAppointments.length === 0) {
              return (
                <EmptyState
                  icon={Clock}
                  title="No patients"
                  description={`Nothing booked for ${formatDisplayDate(queueDate)}.`}
                  actionText="Add walk-in"
                  onAction={() => setActiveTab('walkin')}
                />
              );
            }

            if (rows.length === 0) {
              return q ? (
                <div className="py-14 text-center">
                  <p className="text-sm font-semibold text-[#1d1d1f]">No matches</p>
                  <button type="button" onClick={() => setQueueSearch('')} className="mt-2 text-xs text-[#0066cc] font-normal hover:underline cursor-pointer">
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="py-14 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto mb-3">
                    {showingDone ? <CheckCircle2 className="w-5 h-5 text-[#86868b]" /> : <Clock className="w-5 h-5 text-[#86868b]" />}
                  </div>
                  <p className="text-sm font-semibold text-[#1d1d1f]">{showingDone ? 'None done yet' : 'No one waiting'}</p>
                </div>
              );
            }

            // Group by shift, keep token order inside each shift
            const groups: Record<string, ReceptionistQueueItem[]> = {};
            rows.forEach((a) => {
              const key = cleanShiftDisplayName(a);
              (groups[key] ||= []).push(a);
            });
            Object.values(groups).forEach((list) => list.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)));
            const shiftKeys = Object.keys(groups).sort((a, b) => {
              const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
              const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
              return numA !== numB ? numA - numB : a.localeCompare(b);
            });
            const showShiftHeaders = shiftKeys.length > 1 || availableQueueShifts.length > 1;

            return (
              <div className="space-y-5">
                {shiftKeys.map((shiftName) => (
                  <div key={shiftName} className="border border-[#e5e5ea] rounded-2xl bg-white">
                    {showShiftHeaders && (
                      <div className="px-4 sm:px-5 py-2.5 bg-[#f5f5f7] rounded-t-2xl border-b border-[#e5e5ea] flex items-center justify-between gap-3">
                        <span className="text-[13px] font-semibold text-[#1d1d1f]">{shiftName}</span>
                        <span className="text-xs text-[#86868b]">{groups[shiftName].length}</span>
                      </div>
                    )}

                    <div className="divide-y divide-[#f0f0f2]">
                      {groups[shiftName].map((appt) => {
                        const isDone = isDoneStatus(appt.status);
                        const isCancelled = appt.status !== 'COMPLETED' && isDone;
                        const canStart = appt.status === 'WAITING' && appt.isCheckedIn && (appt.appointmentDate || queueDate) === today;

                        const menuItems: RowMenuItem[] = [];
                        if (!isDone && appt.isCheckedIn) {
                          menuItems.push({
                            label: 'Undo arrival',
                            disabled: togglingCheckinId === appt.id,
                            onSelect: () => handleToggleCheckIn(appt.id, appt.isCheckedIn),
                          });
                        }
                        if (!isDone) menuItems.push({ label: 'Move to another day', onSelect: () => openMove(appt) });
                        if (appt.walkInCode) {
                          const code = appt.walkInCode;
                          menuItems.push({ label: 'Show code', onSelect: () => setCodeFor({ token: appt.queueNumber, name: appt.patientName, code }) });
                        }
                        if (appt.status === 'WAITING') {
                          menuItems.push({ label: 'Cancel appointment', destructive: true, onSelect: () => handleStatusChange(appt.id, 'CANCELLED') });
                        }

                        return (
                          <div
                            key={appt.id}
                            className={`px-3 py-3.5 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isDone ? 'opacity-70' : ''}`}
                          >
                            {/* Token and patient */}
                            <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                              <div
                                className={`w-11 h-11 rounded-full flex items-center justify-center font-semibold text-[15px] shrink-0 ${
                                  appt.isCheckedIn && !isDone ? 'bg-[#0066cc]/10 text-[#0066cc]' : 'bg-[#f5f5f7] text-[#1d1d1f]'
                                } ${isCancelled ? 'line-through text-[#a1a1a6]' : ''}`}
                                title={appt.isCheckedIn ? 'Arrived' : undefined}
                              >
                                #{appt.queueNumber}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-semibold text-sm truncate ${isCancelled ? 'text-[#86868b] line-through' : 'text-[#1d1d1f]'}`}>
                                    {appt.patientName}
                                  </span>
                                  {isDone && (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-normal bg-[#f5f5f7] text-[#86868b]">
                                      {appt.status === 'COMPLETED' ? 'Done' : appt.status === 'CANCELLED' ? 'Cancelled' : 'Expired'}
                                    </span>
                                  )}
                                </div>
                                <MoreLine
                                  className="text-xs text-[#86868b] mt-0.5"
                                  text={[
                                    appt.patientPhone ? formatDisplayPhone(appt.patientPhone) : null,
                                    appt.estimatedTime && !isDone ? `Est. ${appt.estimatedTime}` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                />
                              </div>
                            </div>

                            {/* One main action + menu */}
                            <div className="flex items-center gap-2 justify-end shrink-0">
                              {!isDone && !appt.isCheckedIn && (
                                <button
                                  type="button"
                                  disabled={togglingCheckinId === appt.id}
                                  onClick={() => handleToggleCheckIn(appt.id, appt.isCheckedIn)}
                                  className="flex-1 sm:flex-none h-9 px-4 rounded-full text-xs font-normal border bg-white border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] disabled:opacity-50"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#86868b]" />
                                  Mark arrived
                                </button>
                              )}
                              {canStart && !isDoctorAway && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(appt.id, 'IN_CONSULTATION')}
                                  className="flex-1 sm:flex-none h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  Start consultation
                                </button>
                              )}
                              {canStart && isDoctorAway && (
                                <span className="h-9 px-3.5 rounded-full bg-[#f5f5f7] text-[#86868b] text-xs font-normal inline-flex items-center">Doctor away</span>
                              )}
                              {!isDone && appt.isCheckedIn && !canStart && (
                                <span className="h-9 px-3.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] text-xs font-normal inline-flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Arrived
                                </span>
                              )}
                              <RowMenu label={`More for ${appt.patientName}`} items={menuItems} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}
      <WalkinCodeModal target={codeFor} onClose={() => setCodeFor(null)} />
    </div>
  );
};
