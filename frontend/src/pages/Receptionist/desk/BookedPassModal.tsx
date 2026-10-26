import { formatDisplayDate } from '../../../services/api';
import React from 'react';
import { cleanSlotName } from '../../../services/api';
import { X, Printer } from 'lucide-react';
import { cleanDoctorName } from './helpers';
import { useReceptionistDashboard } from './state';
export const BookedPassModal: React.FC = () => {
  const {
    bookedPass,
    setBookedPass,
  } = useReceptionistDashboard();
  if (!bookedPass) return null;
  return (
<div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn print:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBookedPass(null);
          }}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-[#e5e5ea] max-w-md w-full p-6 sm:p-7 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-7  max-h-[92vh] overflow-y-auto">
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex items-start justify-between pb-4 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                  Token issued
                </h3>
                <p className="text-xs text-[#86868b] mt-0.5">Walk-in</p>
              </div>
              <button aria-label="Close"
                type="button"
                onClick={() => setBookedPass(null)}
                className="p-1.5 rounded-full text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-5 p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-center space-y-2.5">
              <span className="text-xs font-normal text-[#86868b] block">Token</span>
              <div className="text-5xl font-semibold text-[#0066cc] tracking-tight">
                #{bookedPass.queueNumber}
              </div>
              <div className="pt-2.5 border-t border-[#e5e5ea] grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[11px] text-[#86868b] block">Est. time</span>
                  <span className="font-semibold text-[#1d1d1f]">{bookedPass.estimatedTime || 'Active'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-[#86868b] block">Shift</span>
                  <span className="font-semibold text-[#1d1d1f]">{cleanSlotName(bookedPass.checkingWindow) || 'General'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs mb-6 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]">
              <div className="flex justify-between">
                <span className="text-[#86868b]">Patient</span>
                <span className="font-semibold text-[#1d1d1f]">{bookedPass.patientName}</span>
              </div>
              {bookedPass.patientPhone && (
                <div className="flex justify-between">
                  <span className="text-[#86868b]">Phone</span>
                  <span className="font-semibold text-[#1d1d1f]">{bookedPass.patientPhone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#86868b]">Doctor</span>
                <span className="font-semibold text-[#1d1d1f]">{cleanDoctorName(bookedPass.doctorName)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868b]">Date</span>
                <span className="font-semibold text-[#1d1d1f]">{formatDisplayDate(bookedPass.appointmentDate)}</span>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 h-11 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-normal inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Slip</span>
              </button>
              <button
                type="button"
                onClick={() => setBookedPass(null)}
                className="flex-1 h-11 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-normal transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
  );
};
