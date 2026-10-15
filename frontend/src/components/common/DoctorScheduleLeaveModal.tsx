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
  ChevronDown,
  Building2,
} from 'lucide-react';
import {
  api,
  ALL_WEEKDAYS,
  WEEKDAY_NAMES,
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

  // Leave form state
  const [showRangeForm, setShowRangeForm] = useState(false);
  const [leaveType, setLeaveType] = useState<'TODAY' | 'DATE_RANGE'>('TODAY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [savingLeave, setSavingLeave] = useState(false);
  const [cancellingLeaveId, setCancellingLeaveId] = useState<string | null>(null);

  const getLocalDateString = () => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };

  const todayStr = getLocalDateString();

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
      setError(err?.message || 'Failed to load doctor schedule and leave records');
    } finally {
      setLoading(false);
    }
  }, [doctorId, clinicId]);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      setStartDate(todayStr);
      setEndDate(todayStr);
      setReason('');
      setShowRangeForm(false);
      setSuccessMsg(null);
      setError(null);
    }
  }, [isOpen, loadConfig, todayStr]);

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
      setSuccessMsg('Working days updated successfully.');
      await loadConfig();
      if (onUpdated) onUpdated();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to update working days');
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
      setError(err?.message || 'Failed to update leave status');
    } finally {
      setSavingLeave(false);
    }
  };

  const handleSaveRangeLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError('Start date and end date are required');
      return;
    }
    if (startDate > endDate) {
      setError('Start date cannot be after end date');
      return;
    }
    if (endDate < todayStr) {
      setError('Cannot schedule leave in the past');
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
      setError(err?.message || 'Failed to schedule leave period');
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
      setSuccessMsg('Leave cancelled successfully.');
      await loadConfig();
      if (onUpdated) onUpdated();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel leave');
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
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-[#e5e5ea] overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
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
                <span>{clinicName || config?.clinicName || 'Facility Schedule & Leaves'}</span>
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
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-[#fff1f0] border border-[#ff3b30]/20 flex items-start gap-2.5 text-xs text-[#ff3b30]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1 font-medium">{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-[#f2fbf4] border border-[#34c759]/20 flex items-start gap-2.5 text-xs text-[#34c759]">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1 font-medium">{successMsg}</span>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-[#86868b] space-y-3">
              <Loader2 className="w-6 h-6 animate-spin text-[#0066cc]" />
              <p className="text-xs font-medium">Loading schedule and leaves...</p>
            </div>
          ) : (
            <>
              {/* SECTION 1: TODAY'S LEAVE QUICK TOGGLE */}
              <div className="p-4 rounded-2xl bg-[#fbfbfd] border border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#86868b]">
                      Today's Attendance
                    </span>
                    {config?.isOnLeaveToday ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#fff1f0] text-[#ff3b30] border border-[#ff3b30]/20">
                        <CalendarX className="w-3 h-3" />
                        On Leave Today
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#f2fbf4] text-[#34c759] border border-[#34c759]/20">
                        <CalendarCheck className="w-3 h-3" />
                        Active & Available
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#86868b]">
                    {config?.isOnLeaveToday
                      ? `Doctor is marked on leave today${config.todayLeave?.reason ? `: ${config.todayLeave.reason}` : ''}. Walk-ins & bookings are paused.`
                      : 'Doctor is scheduled for physical consultations today.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleToggleTodayLeave}
                  disabled={savingLeave}
                  className={`h-9 px-4 rounded-full text-xs font-medium transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                    config?.isOnLeaveToday
                      ? 'bg-[#34c759] hover:bg-[#30b753] text-white shadow-sm'
                      : 'bg-[#ff3b30] hover:bg-[#e0352b] text-white shadow-sm'
                  } disabled:opacity-50`}
                >
                  {savingLeave ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : config?.isOnLeaveToday ? (
                    <>
                      <CalendarCheck className="w-3.5 h-3.5" />
                      <span>Resume Today</span>
                    </>
                  ) : (
                    <>
                      <CalendarX className="w-3.5 h-3.5" />
                      <span>Mark On Leave Today</span>
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
                      <span>Clinic Sitting Days (Weekly Schedule)</span>
                    </h4>
                    <p className="text-xs text-[#86868b] mt-0.5">
                      Select which days of the week the doctor sits at this physical clinic.
                    </p>
                  </div>
                  {/* Presets */}
                  <div className="flex items-center gap-1 self-start sm:self-auto bg-[#f5f5f7] p-0.5 rounded-full border border-[#e5e5ea]">
                    <button
                      type="button"
                      onClick={() => applyPreset('MON_SAT')}
                      className="px-2.5 py-1 text-[11px] font-medium text-[#1d1d1f] hover:text-[#0066cc] rounded-full transition-all cursor-pointer"
                    >
                      Mon–Sat
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('MON_FRI')}
                      className="px-2.5 py-1 text-[11px] font-medium text-[#1d1d1f] hover:text-[#0066cc] rounded-full transition-all cursor-pointer"
                    >
                      Mon–Fri
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('ALL')}
                      className="px-2.5 py-1 text-[11px] font-medium text-[#1d1d1f] hover:text-[#0066cc] rounded-full transition-all cursor-pointer"
                    >
                      All 7
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
                        className={`py-3 px-1 rounded-2xl text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 border ${
                          isSelected
                            ? 'bg-[#0066cc] border-[#0066cc] text-white shadow-sm shadow-[#0066cc]/20'
                            : 'bg-[#f5f5f7] hover:bg-[#e5e5ea] border-[#e5e5ea] text-[#86868b]'
                        } active:scale-95`}
                      >
                        <span className="text-xs font-bold leading-none">
                          {WEEKDAY_SHORT_NAMES[dayCode]}
                        </span>
                        <span
                          className={`text-[9px] font-medium ${
                            isSelected ? 'text-white/80' : 'text-[#86868b]'
                          }`}
                        >
                          {isSelected ? 'Sits' : 'Off'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-[#86868b]">
                    {selectedDays.length} {selectedDays.length === 1 ? 'day' : 'days'} selected: (
                    {selectedDays.map((d) => WEEKDAY_SHORT_NAMES[d as WeekdayCode]).join(', ')})
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveWorkingDays}
                    disabled={savingDays}
                    className="h-8 px-4 rounded-full text-xs font-semibold bg-[#0066cc] hover:bg-[#0071e3] text-white transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingDays && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>Save Sitting Days</span>
                  </button>
                </div>
              </div>

              {/* SECTION 3: TIME PERIOD LEAVE MANAGEMENT */}
              <div className="p-5 rounded-2xl bg-white border border-[#e5e5ea] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-[#1d1d1f] tracking-tight flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#ff3b30]" />
                      <span>Leave Periods & Vacation</span>
                    </h4>
                    <p className="text-xs text-[#86868b] mt-0.5">
                      Put doctor on leave for multiple days or specific upcoming date ranges.
                    </p>
                  </div>
                  {!showRangeForm && (
                    <button
                      type="button"
                      onClick={() => setShowRangeForm(true)}
                      className="h-8 px-3.5 rounded-full text-xs font-medium text-[#0066cc] bg-[#0066cc]/5 hover:bg-[#0066cc]/10 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Schedule Leave</span>
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
                      <span className="text-xs font-semibold text-[#1d1d1f]">Schedule Doctor Leave</span>
                      <button
                        type="button"
                        onClick={() => setShowRangeForm(false)}
                        className="text-xs text-[#86868b] hover:text-[#1d1d1f]"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-xs font-medium text-[#1d1d1f] cursor-pointer">
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
                        Single Day (Today)
                      </label>
                      <label className="flex items-center gap-2 text-xs font-medium text-[#1d1d1f] cursor-pointer">
                        <input
                          type="radio"
                          name="leaveType"
                          value="DATE_RANGE"
                          checked={leaveType === 'DATE_RANGE'}
                          onChange={() => setLeaveType('DATE_RANGE')}
                          className="accent-[#0066cc]"
                        />
                        Date Range (Custom Period)
                      </label>
                    </div>

                    {leaveType === 'DATE_RANGE' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-[#86868b] mb-1">
                            From Date
                          </label>
                          <input
                            type="date"
                            min={todayStr}
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required
                            className="w-full h-9 px-3 text-xs rounded-xl border border-[#d2d2d7] bg-white focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-[#86868b] mb-1">
                            To Date
                          </label>
                          <input
                            type="date"
                            min={startDate || todayStr}
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            required
                            className="w-full h-9 px-3 text-xs rounded-xl border border-[#d2d2d7] bg-white focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-medium text-[#86868b] mb-1">
                        Reason (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Medical Conference, Personal Vacation, Sick Leave"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full h-9 px-3 text-xs rounded-xl border border-[#d2d2d7] bg-white focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={savingLeave}
                        className="h-8 px-4 rounded-full text-xs font-semibold bg-[#0066cc] hover:bg-[#0071e3] text-white transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {savingLeave && <Loader2 className="w-3 h-3 animate-spin" />}
                        <span>Confirm Leave</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* SCHEDULED LEAVES LIST */}
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                    Active & Upcoming Leaves
                  </div>
                  {(!config?.leaves || config.leaves.length === 0) ? (
                    <p className="text-xs text-[#86868b] italic py-3 text-center">
                      No active or upcoming leaves recorded. Doctor is available per weekly sitting days.
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
                              isTodayActive ? 'bg-[#fff1f0]/40' : 'bg-white hover:bg-[#fbfbfd]'
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
                                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#ff3b30] text-white">
                                    Active Today
                                  </span>
                                )}
                                {leave.clinicName && (
                                  <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
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
                              className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#fff1f0] hover:text-[#ff3b30] text-[#86868b] flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
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
