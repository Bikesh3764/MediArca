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
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] ${
          size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
        } ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
        <span>
          Stepped Out
          {expectedReturnTime ? ` • ~${expectedReturnTime}` : ''}
        </span>
      </span>
    );
  }

  if (normalized === 'NOT_IN_CABIN') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea] ${
          size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
        } ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></span>
        <span>Not in Cabin</span>
      </span>
    );
  }

  // Default: IN_CABIN
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] ${
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      } ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#0088e8] flex-shrink-0"></span>
      <span>In Cabin</span>
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
    queueMicrotask(() => {
      if (currentStatus) {
        setStatus(currentStatus.toUpperCase() as CabinStatus);
      }
    });
  }, [currentStatus]);

  React.useEffect(() => {
    queueMicrotask(() => {
      setReturnTime(initialReturnTime || null);
    });
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

      const res: any = await api.updateDoctorCabinStatus(payload);
      const resultData = res?.data || res;
      const updatedStatus = (resultData?.cabinStatus || newStatus) as CabinStatus;
      const updatedReturn =
        resultData?.expectedReturnTime !== undefined
          ? resultData.expectedReturnTime
          : newStatus === 'STEPPED_OUT'
          ? (explicitTime !== undefined ? explicitTime : (estimateMinutes ? `in ~${estimateMinutes} mins` : returnTime))
          : null;

      setStatus(updatedStatus);
      setReturnTime(updatedReturn);
      if (onStatusChange) {
        onStatusChange(updatedStatus, updatedReturn);
      }
      setFeedback('Status updated');
      setTimeout(() => setFeedback(null), 3500);
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
    <div className={`p-3.5 sm:p-4 rounded-2xl bg-[#fafafc] border border-[#f0f0f0] ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5">
        <h4 className="text-xs font-semibold text-[#1d1d1f]">
          Cabin Presence
        </h4>

        {/* Feedback & Notifications */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {feedback && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1d1d1f] bg-white px-2 py-0.5 rounded-full border border-[#e5e5ea] shadow-xs">
              <Check className="w-3 h-3 text-[#0088e8]" />
              {feedback}
            </span>
          )}
          {errorMsg && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-white px-2 py-0.5 rounded-full border border-rose-200 shadow-xs">
              <AlertCircle className="w-3 h-3" />
              {errorMsg}
            </span>
          )}
        </div>
      </div>

      {/* Segmented Control Bar */}
      <div className="inline-flex p-1 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] w-full sm:w-auto">
        <button
          type="button"
          disabled={loading}
          onClick={() => updateStatus('IN_CABIN')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all active:scale-[0.98] ${
            status === 'IN_CABIN'
              ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs border border-black/5'
              : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#0088e8]"></span>
          <span>In Cabin</span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => updateStatus('STEPPED_OUT', 15)}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all active:scale-[0.98] ${
            status === 'STEPPED_OUT'
              ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs border border-black/5'
              : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          <span>Stepped Out</span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => updateStatus('NOT_IN_CABIN')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all active:scale-[0.98] ${
            status === 'NOT_IN_CABIN'
              ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs border border-black/5'
              : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
          <span>Not in Cabin</span>
        </button>
      </div>

      {/* Stepped Out - Return Estimate Row (Inline, No Popup) */}
      {status === 'STEPPED_OUT' && (
        <div className="mt-3 pt-2.5 border-t border-[#f0f0f0] animate-fadeIn">
          <div className="flex items-center gap-1.5 text-xs text-[#86868b] mb-2">
            <Timer className="w-3.5 h-3.5 text-[#86868b]" />
            <span>Expected Return:</span>
            {returnTime ? (
              <span className="text-[#1d1d1f] font-semibold">
                ~{returnTime}
              </span>
            ) : (
              <span className="text-[#86868b]">Soon</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[15, 30, 45, 60].map((mins) => (
              <button
                key={mins}
                type="button"
                disabled={loading}
                onClick={() => updateStatus('STEPPED_OUT', mins)}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-white hover:bg-gray-100 text-[#1d1d1f] border border-[#e5e5ea] transition-all active:scale-[0.97]"
              >
                ~{mins === 60 ? '1h' : `${mins}m`}
              </button>
            ))}
            <button
              type="button"
              disabled={loading}
              onClick={() => updateStatus('STEPPED_OUT', null, null)}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-white hover:bg-gray-100 text-[#86868b] hover:text-[#1d1d1f] border border-[#e5e5ea] transition-all active:scale-[0.97]"
            >
              Clear
            </button>

            {/* Custom Time Input Form */}
            <form onSubmit={handleCustomTimeSubmit} className="flex items-center gap-1.5 ml-auto">
              <input
                type="time"
                value={customTimeInput}
                onChange={(e) => setCustomTimeInput(e.target.value)}
                className="h-6 px-2 rounded-lg border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] focus:outline-none focus:border-[#0088e8]"
                title="Specific Return Time"
              />
              <button
                type="submit"
                disabled={loading || !customTimeInput}
                className="h-6 px-2.5 rounded-lg bg-[#1d1d1f] hover:bg-black text-white text-[11px] font-medium transition-all disabled:opacity-40"
              >
                Set
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
