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
        <span className="w-1.5 h-1.5 rounded-full bg-[#86868b] shrink-0"></span>
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
        <span className="w-1.5 h-1.5 rounded-full bg-[#d2d2d7] shrink-0"></span>
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
      <span className="w-1.5 h-1.5 rounded-full bg-[#0066cc] shrink-0"></span>
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
  doctorName: _doctorName,
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
    <div className={`rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] px-3.5 py-2.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#86868b] tracking-tight">
            Cabin Status
          </span>
          {feedback && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0066cc] bg-white px-2 py-0.5 rounded-full border border-[#e5e5ea]">
              <Check className="w-3 h-3 text-[#0066cc]" />
              {feedback}
            </span>
          )}
          {errorMsg && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-white px-2 py-0.5 rounded-full border border-rose-200">
              <AlertCircle className="w-3 h-3" />
              {errorMsg}
            </span>
          )}
        </div>

        {/* Segmented Control Bar */}
        <div className="inline-flex p-1 bg-white rounded-full border border-[#e5e5ea] w-full sm:w-auto gap-0.5 select-none">
          <button
            type="button"
            disabled={loading}
            onClick={() => updateStatus('IN_CABIN')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all duration-150 cursor-pointer ${
              status === 'IN_CABIN'
                ? 'bg-[#0066cc] text-white font-medium shadow-xs'
                : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'IN_CABIN' ? 'bg-white' : 'bg-[#0066cc]'}`}></span>
            <span>In Cabin</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => updateStatus('STEPPED_OUT', 15)}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all duration-150 cursor-pointer ${
              status === 'STEPPED_OUT'
                ? 'bg-[#1d1d1f] text-white font-medium shadow-xs'
                : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'STEPPED_OUT' ? 'bg-white' : 'bg-[#86868b]'}`}></span>
            <span>Stepped Out</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => updateStatus('NOT_IN_CABIN')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all duration-150 cursor-pointer ${
              status === 'NOT_IN_CABIN'
                ? 'bg-[#f5f5f7] text-[#1d1d1f] font-semibold border border-[#d2d2d7]'
                : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#d2d2d7]"></span>
            <span>Away</span>
          </button>
        </div>
      </div>

      {/* Stepped Out - Return Estimate Row (Inline, No Popup) */}
      {status === 'STEPPED_OUT' && (
        <div className="mt-2.5 pt-2.5 border-t border-[#e5e5ea] flex flex-wrap items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-1.5 text-xs text-[#86868b]">
            <Timer className="w-3.5 h-3.5 text-[#86868b]" />
            <span>Return:</span>
            <span className="text-[#1d1d1f] font-semibold">
              {returnTime ? `~${returnTime}` : 'Soon'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[15, 30, 45, 60].map((mins) => (
              <button
                key={mins}
                type="button"
                disabled={loading}
                onClick={() => updateStatus('STEPPED_OUT', mins)}
                className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] transition-all cursor-pointer"
              >
                ~{mins === 60 ? '1h' : `${mins}m`}
              </button>
            ))}
            <button
              type="button"
              disabled={loading}
              onClick={() => updateStatus('STEPPED_OUT', null, null)}
              className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white hover:bg-[#e8e8ed] text-[#86868b] hover:text-[#1d1d1f] border border-[#e5e5ea] transition-all cursor-pointer"
            >
              Clear
            </button>

            <form onSubmit={handleCustomTimeSubmit} className="flex items-center gap-1">
              <input
                type="time"
                value={customTimeInput}
                onChange={(e) => setCustomTimeInput(e.target.value)}
                className="h-6 px-2 rounded-full border border-[#d2d2d7] text-[11px] bg-white text-[#1d1d1f] focus:outline-none focus:border-[#0066cc]"
                title="Specific Return Time"
              />
              <button
                type="submit"
                disabled={loading || !customTimeInput}
                className="h-6 px-2.5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-[11px] font-medium transition-all disabled:opacity-40 cursor-pointer"
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

