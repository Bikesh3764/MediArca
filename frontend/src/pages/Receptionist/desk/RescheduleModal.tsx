import React from 'react';
import { getLocalDateString, formatShiftOption } from '../../../services/api';
import { AlertCircle, X, ChevronDown } from 'lucide-react';
import { cleanDoctorName } from './helpers';
import { useReceptionistDashboard } from './state';
export const RescheduleModal: React.FC = () => {
  const {
    rescheduleTarget,
    setRescheduleTarget,
    rescheduleDate,
    setRescheduleDate,
    rescheduleSlotId,
    setRescheduleSlotId,
    rescheduling,
    rescheduleError,
    handleConfirmReschedule,
    linkedDoctors,
  } = useReceptionistDashboard();
  if (!rescheduleTarget) return null;
  return (
<div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn print:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRescheduleTarget(null);
          }}
        >
          <div className="bg-white rounded-t-[28px] sm:rounded-[28px] border border-[#e5e5ea] max-w-md w-full p-6 sm:p-7 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-7 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex items-start justify-between pb-3 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                  Reschedule Appointment
                </h3>
                <p className="text-xs text-[#86868b] mt-0.5">Shift patient visit to another date or shift</p>
              </div>
              <button aria-label="Close"
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="text-[#86868b] hover:text-[#1d1d1f] p-1.5 rounded-full hover:bg-[#f5f5f7] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#86868b]">Patient</span>
                <span className="font-semibold text-[#1d1d1f]">{rescheduleTarget.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868b]">Doctor</span>
                <span className="font-semibold text-[#1d1d1f]">{cleanDoctorName(rescheduleTarget.doctorName)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868b]">Current Date</span>
                <span className="font-medium text-[#1d1d1f]">
                  {rescheduleTarget.currentDate}
                  {rescheduleTarget.currentQueueNumber ? ` (#${rescheduleTarget.currentQueueNumber})` : ''}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                New Appointment Date
              </label>
              <input
                type="date"
                min={getLocalDateString()}
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] text-base sm:text-sm bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc]"
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    setRescheduleDate(getLocalDateString(d));
                  }}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] transition-all cursor-pointer"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 2);
                    setRescheduleDate(getLocalDateString(d));
                  }}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] transition-all cursor-pointer"
                >
                  In 2 Days
                </button>
              </div>
            </div>

            {(() => {
              const doc = linkedDoctors.find((d) => d.doctorId === rescheduleTarget.doctorId);
              if (!doc || !doc.slots || doc.slots.length <= 1) return null;
              return (
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                    Consultation Shift
                  </label>
                  <div className="relative">
                    <select
                      value={rescheduleSlotId}
                      onChange={(e) => setRescheduleSlotId(e.target.value)}
                      className="w-full h-11 pl-3.5 pr-9 rounded-xl border border-[#d2d2d7] text-base sm:text-sm bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] appearance-none cursor-pointer"
                    >
                      <option value="">Standard Hours / Any Shift</option>
                      {doc.slots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {formatShiftOption(s)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              );
            })()}

            {rescheduleError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{rescheduleError}</span>
              </div>
            )}

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                disabled={rescheduling}
                className="flex-1 h-11 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReschedule}
                disabled={rescheduling}
                className="flex-1 h-11 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-medium transition-all cursor-pointer disabled:opacity-60"
              >
                {rescheduling ? 'Shifting...' : 'Confirm Shift'}
              </button>
            </div>
          </div>
        </div>
  );
};
