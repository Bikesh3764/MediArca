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
  const cleanReturn = expectedReturnTime ? expectedReturnTime.replace(/^~\s*/, '').trim() : '';

  if (normalized === 'STEPPED_OUT') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] ${
          size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
        } ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
        <span>
          Stepped Out
          {cleanReturn ? ` • Back ${cleanReturn}` : ''}
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
        <span>Away</span>
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
  const [selectedMins, setSelectedMins] = useState<number | null>(15);
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
    if (estimateMinutes !== undefined) {
      setSelectedMins(estimateMinutes);
    }

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
          ? explicitTime !== undefined
            ? explicitTime
            : estimateMinutes
            ? `in ${estimateMinutes} mins`
            : returnTime
          : null;

      setStatus(updatedStatus);
      setReturnTime(updatedReturn);
      if (onStatusChange) {
        onStatusChange(updatedStatus, updatedReturn);
      }
      setFeedback('Saved');
      setTimeout(() => setFeedback(null), 2500);
    } catch (err: any) {
      console.error('Failed to update doctor presence:', err);
      setErrorMsg(err.message || 'Update failed');
      setTimeout(() => setErrorMsg(null), 3500);
    } finally {
      setLoading(false);
    }
  };

  const cleanReturnDisplay = returnTime ? returnTime.replace(/^~\s*/, '').trim() : null;

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#86868b] tracking-tight">
            Cabin Status
          </span>
          {feedback && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0066cc] bg-[#0066cc]/8 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3 text-[#0066cc]" />
              {feedback}
            </span>
          )}
          {errorMsg && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
              <AlertCircle className="w-3 h-3" />
              {errorMsg}
            </span>
          )}
        </div>

        {/* Apple Segmented Control Track */}
        <div className="p-1 bg-[#f5f5f7] rounded-full border border-[#e5e5ea] inline-flex items-center w-full sm:w-auto gap-0.5 select-none">
          <button
            type="button"
            disabled={loading}
            onClick={() => updateStatus('IN_CABIN')}
            className={`flex-1 sm:flex-initial h-8 px-3.5 rounded-full text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              status === 'IN_CABIN'
                ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs border border-black/5'
                : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                status === 'IN_CABIN' ? 'bg-[#0066cc]' : 'bg-[#d2d2d7]'
              }`}
            />
            <span>In Cabin</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => updateStatus('STEPPED_OUT', 15)}
            className={`flex-1 sm:flex-initial h-8 px-3.5 rounded-full text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              status === 'STEPPED_OUT'
                ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs border border-black/5'
                : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                status === 'STEPPED_OUT' ? 'bg-amber-500' : 'bg-[#d2d2d7]'
              }`}
            />
            <span>Stepped Out</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => updateStatus('NOT_IN_CABIN')}
            className={`flex-1 sm:flex-initial h-8 px-3.5 rounded-full text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              status === 'NOT_IN_CABIN'
                ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs border border-black/5'
                : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                status === 'NOT_IN_CABIN' ? 'bg-[#86868b]' : 'bg-[#d2d2d7]'
              }`}
            />
            <span>Away</span>
          </button>
        </div>
      </div>

      {/* Stepped Out — Clean Inline Return Duration Selector */}
      {status === 'STEPPED_OUT' && (
        <div className="pt-2.5 border-t border-[#f0f0f2] flex flex-wrap items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-1.5 text-xs text-[#86868b]">
            <Timer className="w-3.5 h-3.5 text-[#86868b]" />
            <span>Expected return:</span>
            <span className="text-[#1d1d1f] font-semibold">
              {cleanReturnDisplay || 'Shortly'}
            </span>
          </div>

          <div className="inline-flex items-center p-0.5 bg-[#f5f5f7] rounded-full border border-[#e5e5ea] gap-0.5">
            {[
              { mins: 15, label: '15m' },
              { mins: 30, label: '30m' },
              { mins: 45, label: '45m' },
              { mins: 60, label: '1h' },
            ].map(({ mins, label }) => {
              const isSelected = selectedMins === mins && Boolean(cleanReturnDisplay);
              return (
                <button
                  key={mins}
                  type="button"
                  disabled={loading}
                  onClick={() => updateStatus('STEPPED_OUT', mins)}
                  className={`h-6 px-2.5 rounded-full text-[11px] transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs border border-black/5'
                      : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
                  }`}
                >
                  {label}
                </button>
              );
            })}
            {cleanReturnDisplay && (
              <button
                type="button"
                disabled={loading}
                onClick={() => updateStatus('STEPPED_OUT', null, null)}
                className="h-6 px-2.5 rounded-full text-[11px] font-medium text-[#86868b] hover:text-[#1d1d1f] transition-all cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


