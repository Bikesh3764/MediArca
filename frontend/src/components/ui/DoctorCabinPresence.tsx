import React, { useState } from 'react';
import { api } from '../../services/api';
import { Check, AlertCircle, Timer } from 'lucide-react';

export type CabinStatus = 'IN_CABIN' | 'STEPPED_OUT' | 'NOT_IN_CABIN';

interface CabinStatusBadgeProps {
  status?: string | null;
  expectedReturnTime?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

export const CabinStatusBadge: React.FC<CabinStatusBadgeProps> = ({
  status = 'IN_CABIN',
  expectedReturnTime,
  size = 'md',
  className = '',
}) => {
  const normalized = (status || 'IN_CABIN').toUpperCase() as CabinStatus;

  if (normalized === 'STEPPED_OUT') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-500/10 text-amber-800 border border-amber-500/20 shadow-2xs ${
          size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
        } ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 animate-pulse"></span>
        <span>
          {size === 'sm' ? 'Stepped Out' : 'Doctor Stepped Out'}
          {expectedReturnTime ? ` • Back ~${expectedReturnTime}` : ' • Back soon'}
        </span>
      </span>
    );
  }

  if (normalized === 'NOT_IN_CABIN') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-gray-100 text-gray-700 border border-gray-200 shadow-2xs ${
          size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
        } ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0"></span>
        <span>{size === 'sm' ? 'Not in Cabin' : 'Doctor has not yet arrived'}</span>
      </span>
    );
  }

  // Default: IN_CABIN
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 shadow-2xs ${
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      } ${className}`}
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse"></span>
      <span>{size === 'sm' ? 'In Cabin' : 'Doctor is in Cabin'}</span>
    </span>
  );
};

interface CabinStatusControlProps {
  currentStatus?: string | null;
  expectedReturnTime?: string | null;
  doctorId?: string; // Required when a receptionist is changing status for an assigned doctor
  doctorName?: string;
  onStatusChange?: (newStatus: CabinStatus, returnTime: string | null) => void;
  className?: string;
}

export const CabinStatusControl: React.FC<CabinStatusControlProps> = ({
  currentStatus = 'IN_CABIN',
  expectedReturnTime: initialReturnTime,
  doctorId,
  doctorName,
  onStatusChange,
  className = '',
}) => {
  const [status, setStatus] = useState<CabinStatus>(
    ((currentStatus || 'IN_CABIN').toUpperCase() as CabinStatus) || 'IN_CABIN'
  );
  const [returnTime, setReturnTime] = useState<string | null>(initialReturnTime || null);
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync with prop changes if they happen externally
  React.useEffect(() => {
    if (currentStatus) {
      setStatus(currentStatus.toUpperCase() as CabinStatus);
    }
  }, [currentStatus]);

  React.useEffect(() => {
    setReturnTime(initialReturnTime || null);
  }, [initialReturnTime]);

  const updateStatus = async (
    newStatus: CabinStatus,
    estimateMinutes?: number | null,
    explicitTime?: string | null
  ) => {
    setLoading(true);
    setErrorMsg(null);
    setFeedback(null);

    try {
      const payload: {
        status: CabinStatus;
        doctorId?: string;
        returnEstimateMinutes?: number | null;
        expectedReturnTime?: string | null;
      } = {
        status: newStatus,
        ...(doctorId ? { doctorId } : {}),
      };

      if (newStatus === 'STEPPED_OUT') {
        if (estimateMinutes !== undefined) {
          payload.returnEstimateMinutes = estimateMinutes;
        } else if (explicitTime !== undefined) {
          payload.expectedReturnTime = explicitTime;
        } else if (returnTime) {
          payload.expectedReturnTime = returnTime;
        }
      }

      const res = await api.updateDoctorCabinStatus(payload);
      if (res.success && res.data) {
        setStatus(res.data.cabinStatus as CabinStatus);
        setReturnTime(res.data.expectedReturnTime);
        if (onStatusChange) {
          onStatusChange(res.data.cabinStatus as CabinStatus, res.data.expectedReturnTime);
        }
        setFeedback(res.message || 'Status updated');
        setTimeout(() => setFeedback(null), 3500);
      }
    } catch (err: any) {
      console.error('Failed to update doctor presence:', err);
      setErrorMsg(err.message || 'Failed to update presence status');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomTimeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTimeInput.trim()) return;

    // Convert 24-hr input (e.g. "14:30") to 12-hr format if needed
    let formatted = customTimeInput.trim();
    if (/^\d{1,2}:\d{2}$/.test(formatted)) {
      const [hStr, mStr] = formatted.split(':');
      let h = parseInt(hStr, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      if (h > 12) h -= 12;
      if (h === 0) h = 12;
      formatted = `${h}:${mStr} ${ampm}`;
    }

    updateStatus('STEPPED_OUT', null, formatted);
    setCustomTimeInput('');
  };

  return (
    <div className={`p-4 sm:p-5 rounded-2xl bg-white border border-[#e5e5ea] shadow-xs ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f]">
              Doctor Cabin Availability
            </h4>
            {doctorName && (
              <span className="text-xs text-[#86868b] font-medium">• {doctorName}</span>
            )}
          </div>
          <p className="text-[11px] text-[#86868b] mt-0.5">
            Patients see this live presence on their queue ticket in real time.
          </p>
        </div>

        {/* Live Active Badge & Feedback */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {feedback && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 animate-fadeIn">
              <Check className="w-3 h-3" />
              {feedback}
            </span>
          )}
          {errorMsg && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
              <AlertCircle className="w-3 h-3" />
              {errorMsg}
            </span>
          )}
          <CabinStatusBadge status={status} expectedReturnTime={returnTime} size="sm" />
        </div>
      </div>

      {/* Segmented Control Bar */}
      <div className="inline-flex p-1 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] w-full sm:w-auto">
        <button
          type="button"
          disabled={loading}
          onClick={() => updateStatus('IN_CABIN')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
            status === 'IN_CABIN'
              ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200'
              : 'text-[#86868b] hover:text-[#1d1d1f]'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>In Cabin (Arrived)</span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => {
            if (status !== 'STEPPED_OUT') {
              updateStatus('STEPPED_OUT', 15);
            }
          }}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
            status === 'STEPPED_OUT'
              ? 'bg-white text-amber-900 shadow-xs border border-amber-200'
              : 'text-[#86868b] hover:text-[#1d1d1f]'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <span>Stepped Out</span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => updateStatus('NOT_IN_CABIN')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
            status === 'NOT_IN_CABIN'
              ? 'bg-white text-gray-800 shadow-xs border border-gray-300'
              : 'text-[#86868b] hover:text-[#1d1d1f]'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-gray-400"></span>
          <span>Not in Cabin</span>
        </button>
      </div>

      {/* Stepped Out - Return Estimate Row (Inline, No Popup) */}
      {status === 'STEPPED_OUT' && (
        <div className="mt-3.5 pt-3 border-t border-[#f0f0f0] animate-fadeIn">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1d1d1f] mb-2">
            <Timer className="w-3.5 h-3.5 text-amber-600" />
            <span>Estimated Return Time:</span>
            {returnTime ? (
              <span className="text-amber-800 font-bold bg-amber-100/60 px-2 py-0.5 rounded-md">
                Around {returnTime}
              </span>
            ) : (
              <span className="text-[#86868b] font-normal">No estimate set (Back soon)</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => updateStatus('STEPPED_OUT', 15)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#f5f5f7] hover:bg-amber-100 hover:text-amber-900 text-[#1d1d1f] border border-[#e5e5ea] transition-all active:scale-[0.97]"
            >
              ~15 mins
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => updateStatus('STEPPED_OUT', 30)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#f5f5f7] hover:bg-amber-100 hover:text-amber-900 text-[#1d1d1f] border border-[#e5e5ea] transition-all active:scale-[0.97]"
            >
              ~30 mins
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => updateStatus('STEPPED_OUT', 45)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#f5f5f7] hover:bg-amber-100 hover:text-amber-900 text-[#1d1d1f] border border-[#e5e5ea] transition-all active:scale-[0.97]"
            >
              ~45 mins
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => updateStatus('STEPPED_OUT', 60)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#f5f5f7] hover:bg-amber-100 hover:text-amber-900 text-[#1d1d1f] border border-[#e5e5ea] transition-all active:scale-[0.97]"
            >
              ~1 hour
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => updateStatus('STEPPED_OUT', null, null)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#f5f5f7] hover:bg-gray-200 text-[#86868b] hover:text-[#1d1d1f] border border-[#e5e5ea] transition-all active:scale-[0.97]"
            >
              No Estimate (Back Soon)
            </button>

            {/* Custom Time Input Form */}
            <form onSubmit={handleCustomTimeSubmit} className="flex items-center gap-1.5 ml-auto">
              <div className="relative">
                <input
                  type="time"
                  value={customTimeInput}
                  onChange={(e) => setCustomTimeInput(e.target.value)}
                  className="h-7 px-2.5 rounded-lg border border-[#e5e5ea] text-xs bg-[#f5f5f7] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  title="Specific Return Time"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !customTimeInput}
                className="h-7 px-2.5 rounded-lg bg-[#1d1d1f] hover:bg-black text-white text-[11px] font-semibold transition-all disabled:opacity-40"
              >
                Set Time
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
