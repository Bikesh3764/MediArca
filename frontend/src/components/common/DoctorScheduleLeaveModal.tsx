import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Calendar,
  CalendarDays,
  CalendarX,
  CalendarCheck,
  Clock,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Plus,
  Loader2,
  Building2,
} from 'lucide-react';
import {
  api,
  getLocalDateString,
  ALL_WEEKDAYS,
  WEEKDAY_SHORT_NAMES,
  WeekdayCode,
  DoctorScheduleConfig,
} from '../../services/api';

interface DoctorScheduleLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
  doctorName: string;
  clinicId?: string | null;
  clinicName?: string | null;
  onUpdated?: () => void;
  onSuccess?: () => void;
}

export const DoctorScheduleLeaveModal: React.FC<DoctorScheduleLeaveModalProps> = ({
  isOpen,
  onClose,
  doctorId,
  doctorName,
  clinicId,
  clinicName,
  onUpdated,
  onSuccess,
}) => {
  const [config, setConfig] = useState<DoctorScheduleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Working days edit state
  const [selectedDays, setSelectedDays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
  const [savingDays, setSavingDays] = useState(false);

  // Uses canonical IST getLocalDateString imported from services/api
  const todayStr = getLocalDateString();

  // Leave form state
  const [showRangeForm, setShowRangeForm] = useState(false);
  const [leaveType, setLeaveType] = useState<'TODAY' | 'DATE_RANGE'>('TODAY');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [reason, setReason] = useState('');
  const [savingLeave, setSavingLeave] = useState(false);
  const [cancellingLeaveId, setCancellingLeaveId] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    if (!doctorId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDoctorScheduleConfig(doctorId, clinicId || undefined);
      setConfig(data);
      if (data.workingDays && data.workingDays.length > 0) {
        setSelectedDays(data.workingDays);
      }
    } catch (err: any) {
      console.error('Failed to load schedule config:', err);
      setError(err?.message || 'Couldn’t load schedule.');
    } finally {
      setLoading(false);
    }
  }, [doctorId, clinicId]);

  useEffect(() => {
    if (!isOpen) {
      queueMicrotask(() => {
        setConfig(null);
        setLoading(true);
        setStartDate(todayStr);
        setEndDate(todayStr);
        setReason('');
        setShowRangeForm(false);
        setSuccessMsg(null);
        setError(null);
      });
      return;
    }
    queueMicrotask(() => {
      loadConfig();
    });
  }, [isOpen, loadConfig, todayStr]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleDay = (day: WeekdayCode) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) {
          setError('A doctor must have at least one working day.');
          return prev;
        }
        setError(null);
        return prev.filter((d) => d !== day);
      } else {
        setError(null);
        return [...prev, day];
      }
    });
  };

  const applyPreset = (preset: 'MON_SAT' | 'MON_FRI' | 'ALL') => {
    if (preset === 'MON_SAT') {
      setSelectedDays(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
    } else if (preset === 'MON_FRI') {
      setSelectedDays(['MON', 'TUE', 'WED', 'THU', 'FRI']);
    } else {
      setSelectedDays(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
    }
  };

  const handleSaveWorkingDays = async () => {
    setSavingDays(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await api.updateDoctorWorkingDays(doctorId, selectedDays, clinicId || undefined);
      setSuccessMsg('Days saved.');
      await loadConfig();
      if (onUpdated) onUpdated();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Couldn’t save days.');
    } finally {
      setSavingDays(false);
    }
  };

  const handleToggleTodayLeave = async () => {
    setSavingLeave(true);
    setError(null);
    setSuccessMsg(null);
    try {
      if (config?.isOnLeaveToday && config.todayLeave) {
        // Cancel today's leave
        await api.cancelDoctorLeave(doctorId, config.todayLeave.id);
        setSuccessMsg('Doctor resumed from leave. Now active today.');
      } else {
        // Mark on leave today
        await api.addDoctorLeave(doctorId, {
          type: 'TODAY',
          reason: 'Marked on leave today',
          clinicId: clinicId || undefined,
        });
        setSuccessMsg('Doctor marked on leave for today.');
      }
      await loadConfig();
      if (onUpdated) onUpdated();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Couldn’t update leave.');
    } finally {
      setSavingLeave(false);
    }
  };

  const handleSaveRangeLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError('Pick a start and end date.');
      return;
    }
    if (startDate > endDate) {
      setError('Start date must be before end date.');
      return;
    }
    if (endDate < todayStr) {
      setError('Pick a date from today on.');
      return;
    }

    setSavingLeave(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await api.addDoctorLeave(doctorId, {
        type: leaveType,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
        clinicId: clinicId || undefined,
      });
      setSuccessMsg(`Leave scheduled from ${startDate} to ${endDate}.`);
      setShowRangeForm(false);
      setReason('');
      await loadConfig();
      if (onUpdated) onUpdated();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Couldn’t save leave.');
    } finally {
      setSavingLeave(false);
    }
  };

  const handleCancelLeave = async (leaveId: string) => {
    setCancellingLeaveId(leaveId);
    setError(null);
    setSuccessMsg(null);
    try {
      await api.cancelDoctorLeave(doctorId, leaveId);
      setSuccessMsg('Leave cancelled.');
      await loadConfig();
      if (onUpdated) onUpdated();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Couldn’t cancel leave.');
    } finally {
      setCancellingLeaveId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl  border border-[#e5e5ea] overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#f0f0f2] bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#0066cc]/10 flex items-center justify-center text-[#0066cc] shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-[#1d1d1f] tracking-tight truncate">
                {doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`}
              </h3>
              <p className="text-xs text-[#86868b] flex items-center gap-1.5 truncate">
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>{clinicName || config?.clinicName || 'Schedule & Leave'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] active:scale-95 flex items-center justify-center text-[#1d1d1f] transition-all cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* FEEDBACK BANNERS */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-danger-soft border border-danger-line flex items-start gap-2.5 text-xs text-danger">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1 font-normal">{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-success-soft border border-success-line flex items-start gap-2.5 text-xs text-success">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1 font-normal">{successMsg}</span>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-[#86868b] space-y-3">
              <Loader2 className="w-6 h-6 animate-spin text-[#0066cc]" />
              <p className="text-xs font-normal">Loading…</p>
            </div>
          ) : (
            <>
              {/* SECTION 1: TODAY'S LEAVE QUICK TOGGLE */}
              <div className="p-4 rounded-2xl bg-[#fbfbfd] border border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#86868b]">
                      Today
                    </span>
                    {config?.isOnLeaveToday ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-danger-soft text-danger border border-danger-line">
                        <CalendarX className="w-3 h-3" />
                        On Leave
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-success-soft text-success border border-success-line">
                        <CalendarCheck className="w-3 h-3" />
                        Available
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#86868b]">
                    {config?.isOnLeaveToday
                      ? `On leave today${config.todayLeave?.reason ? ` (${config.todayLeave.reason})` : ''}.`
                      : 'Available today.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleToggleTodayLeave}
                  disabled={savingLeave}
                  className={`h-9 px-4 rounded-full text-xs font-normal transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                    config?.isOnLeaveToday
                      ? 'bg-[#0066cc] hover:bg-[#0071e3] text-white'
                      : 'bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]'
                  } disabled:opacity-50`}
                >
                  {savingLeave ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : config?.isOnLeaveToday ? (
                    <>
                      <CalendarCheck className="w-3.5 h-3.5" />
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <CalendarX className="w-3.5 h-3.5" />
                      <span>Take today off</span>
                    </>
                  )}
                </button>
              </div>

              {/* SECTION 2: WORKING DAYS (SITTING DAYS) */}
              <div className="p-5 rounded-2xl bg-white border border-[#e5e5ea] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-[#1d1d1f] tracking-tight flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-[#0066cc]" />
                      <span>Days</span>
                    </h4>
                    <p className="text-xs text-[#86868b] mt-0.5">
                      Days you see patients.
                    </p>
                  </div>
                  {/* Presets */}
                  <div className="flex items-center gap-1 self-start sm:self-auto bg-[#f5f5f7] p-0.5 rounded-full border border-[#e5e5ea] max-w-full overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => applyPreset('MON_SAT')}
                      className="px-2.5 py-1 text-[11px] font-normal text-[#1d1d1f] hover:text-[#0066cc] rounded-full transition-all cursor-pointer active:scale-95"
                    >
                      Mon–Sat
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('MON_FRI')}
                      className="px-2.5 py-1 text-[11px] font-normal text-[#1d1d1f] hover:text-[#0066cc] rounded-full transition-all cursor-pointer active:scale-95"
                    >
                      Mon–Fri
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('ALL')}
                      className="px-2.5 py-1 text-[11px] font-normal text-[#1d1d1f] hover:text-[#0066cc] rounded-full transition-all cursor-pointer active:scale-95"
                    >
                      All Days
                    </button>
                  </div>
                </div>

                {/* Day selector pills */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2 pt-1">
                  {ALL_WEEKDAYS.map((dayCode) => {
                    const isSelected = selectedDays.includes(dayCode);
                    return (
                      <button
                        key={dayCode}
                        type="button"
                        onClick={() => toggleDay(dayCode)}
                        className={`h-11 rounded-full text-center transition-all cursor-pointer flex items-center justify-center border font-semibold text-xs active:scale-95 ${
                          isSelected
                            ? 'bg-[#0066cc] border-[#0066cc] text-white '
                            : 'bg-[#f5f5f7] hover:bg-[#e8e8ed] border-[#e5e5ea] text-[#1d1d1f]'
                        }`}
                      >
                        {WEEKDAY_SHORT_NAMES[dayCode]}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-[#86868b]">
                    {selectedDays.length} {selectedDays.length === 1 ? 'day' : 'days'} selected
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveWorkingDays}
                    disabled={savingDays}
                    className="h-8 px-4 rounded-full text-xs font-semibold bg-[#0066cc] hover:bg-[#0071e3] text-white transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingDays && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>Save Days</span>
                  </button>
                </div>
              </div>

              {/* SECTION 3: TIME PERIOD LEAVE MANAGEMENT */}
              <div className="p-5 rounded-2xl bg-white border border-[#e5e5ea] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-[#1d1d1f] tracking-tight flex items-center gap-2">
                      <Clock className="w-4 h-4 text-danger" />
                      <span>Leave</span>
                    </h4>
                    <p className="text-xs text-[#86868b] mt-0.5">
                      Block upcoming dates.
                    </p>
                  </div>
                  {!showRangeForm && (
                    <button
                      type="button"
                      onClick={() => setShowRangeForm(true)}
                      className="h-8 px-3.5 rounded-full text-xs font-normal text-[#0066cc] bg-[#0066cc]/5 hover:bg-[#0066cc]/10 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Leave</span>
                    </button>
                  )}
                </div>

                {/* SCHEDULE LEAVE FORM */}
                {showRangeForm && (
                  <form
                    onSubmit={handleSaveRangeLeave}
                    className="p-4 rounded-2xl bg-[#fbfbfd] border border-[#e5e5ea] space-y-3.5 animate-fade-in"
                  >
                    <div className="flex items-center justify-between border-b border-[#f0f0f2] pb-2">
                      <span className="text-xs font-semibold text-[#1d1d1f]">New Leave</span>
                      <button
                        type="button"
                        onClick={() => setShowRangeForm(false)}
                        className="text-xs text-[#86868b] hover:text-[#1d1d1f] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-xs font-normal text-[#1d1d1f] cursor-pointer">
                        <input
                          type="radio"
                          name="leaveType"
                          value="TODAY"
                          checked={leaveType === 'TODAY'}
                          onChange={() => {
                            setLeaveType('TODAY');
                            setStartDate(todayStr);
                            setEndDate(todayStr);
                          }}
                          className="accent-[#0066cc]"
                        />
                        One day
                      </label>
                      <label className="flex items-center gap-2 text-xs font-normal text-[#1d1d1f] cursor-pointer">
                        <input
                          type="radio"
                          name="leaveType"
                          value="DATE_RANGE"
                          checked={leaveType === 'DATE_RANGE'}
                          onChange={() => setLeaveType('DATE_RANGE')}
                          className="accent-[#0066cc]"
                        />
                        Date Range
                      </label>
                    </div>

                    {leaveType === 'DATE_RANGE' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-normal text-[#86868b] mb-1">
                            From
                          </label>
                          <input
                            type="date"
                            min={todayStr}
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required
                            className="w-full h-9 px-3 text-base sm:text-xs rounded-xl border border-[#d2d2d7] bg-white focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-normal text-[#86868b] mb-1">
                            To
                          </label>
                          <input
                            type="date"
                            min={startDate || todayStr}
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            required
                            className="w-full h-9 px-3 text-base sm:text-xs rounded-xl border border-[#d2d2d7] bg-white focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-normal text-[#86868b] mb-1">
                        Reason (optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Conference, Personal, Illness"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full h-9 px-3 text-base sm:text-xs rounded-xl border border-[#d2d2d7] bg-white focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={savingLeave}
                        className="h-8 px-4 rounded-full text-xs font-semibold bg-[#0066cc] hover:bg-[#0071e3] text-white transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {savingLeave && <Loader2 className="w-3 h-3 animate-spin" />}
                        <span>Save Leave</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* SCHEDULED LEAVES LIST */}
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                    Upcoming leave
                  </div>
                  {(!config?.leaves || config.leaves.length === 0) ? (
                    <p className="text-xs text-[#86868b] italic py-3 text-center">
                      No upcoming leave.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#f0f0f2] border border-[#f0f0f2] rounded-2xl overflow-hidden">
                      {config.leaves.map((leave) => {
                        const isTodayActive = todayStr >= leave.startDate && todayStr <= leave.endDate;
                        const isCancelling = cancellingLeaveId === leave.id;
                        return (
                          <div
                            key={leave.id}
                            className={`p-3.5 flex items-center justify-between gap-3 text-xs transition-colors ${
                              isTodayActive ? 'bg-danger-soft/40' : 'bg-white hover:bg-[#fbfbfd]'
                            }`}
                          >
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-[#1d1d1f]">
                                  {leave.startDate === leave.endDate
                                    ? leave.startDate
                                    : `${leave.startDate} → ${leave.endDate}`}
                                </span>
                                {isTodayActive && (
                                  <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-danger text-white">
                                    Today
                                  </span>
                                )}
                                {leave.clinicName && (
                                  <span className="px-2 py-0.5 text-[11px] font-normal rounded-full bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
                                    {leave.clinicName}
                                  </span>
                                )}
                              </div>
                              <p className="text-[#86868b] text-[11px]">
                                {leave.reason ? `Reason: ${leave.reason}` : 'Leave period'}{' '}
                                • Set by {leave.createdByName || leave.createdByRole}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleCancelLeave(leave.id)}
                              disabled={isCancelling}
                              className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-danger-soft hover:text-danger text-[#86868b] flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
                              title="Cancel this leave"
                            >
                              {isCancelling ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 border-t border-[#f0f0f2] bg-[#fbfbfd] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-5 rounded-full text-xs font-semibold bg-[#1d1d1f] hover:bg-black text-white transition-all active:scale-95 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
