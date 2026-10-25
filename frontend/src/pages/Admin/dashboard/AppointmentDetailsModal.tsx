import React from 'react';
import { cleanSlotName } from '../../../services/api';
import { AppleButton } from '../../../components/ui/AppleButton';
import { X } from 'lucide-react';
import { useAdminDashboard } from './state';
export const AppointmentDetailsModal: React.FC = () => {
  const {
    selectedAppointment,
    setSelectedAppointment,
    resolveClinic,
    formatDisplayDate,
    renderAppointmentStatusBadge,
  } = useAdminDashboard();
  if (!selectedAppointment) return null;
  return (
<div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedAppointment(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
        >
          <div className="bg-white rounded-2xl border border-[#e5e5ea] max-w-lg w-full p-6 sm:p-8  space-y-5">
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">Queue Token #{selectedAppointment.queueNumber}</h3>
                  {renderAppointmentStatusBadge(selectedAppointment.status)}
                </div>
                <p className="text-[13px] text-[#86868b] mt-1">
                  {formatDisplayDate(selectedAppointment.appointmentDate)} • {selectedAppointment.estimatedTime || 'Estimated Time N/A'}
                </p>
              </div>
              <button aria-label="Close"
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="p-1.5 rounded-full hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] active:scale-95 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#1d1d1f]">
              {/* Patient Block */}
              <div className="p-3.5 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] space-y-2">
                <span className="text-xs font-semibold text-[#1d1d1f] block">Patient Information</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Patient Name</span>
                    <strong className="text-[#1d1d1f] mt-0.5 block">
                      {selectedAppointment.patient?.user?.fullName || selectedAppointment.patientName || 'Walk-in Patient'}
                    </strong>
                    {selectedAppointment.isForOther && (
                      <span className="text-[11px] text-[#86868b] font-normal">(Family Member)</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Contact Phone</span>
                    <span className="font-normal text-[#1d1d1f] mt-0.5 block">
                      {selectedAppointment.patientPhone || selectedAppointment.patient?.user?.phone || 'Not Provided'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Email Address</span>
                    <span className="font-normal text-[#1d1d1f] truncate block mt-0.5">
                      {selectedAppointment.patient?.user?.email || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Arrival Status</span>
                    <span className="font-normal text-[#1d1d1f] mt-0.5 block">
                      {selectedAppointment.isCheckedIn ? 'Checked-in at Desk' : 'Not Checked-in'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Doctor & Clinic Block */}
              <div className="p-3.5 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] space-y-2">
                <span className="text-xs font-semibold text-[#1d1d1f] block">Clinical Facility & Practitioner</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Attending Practitioner</span>
                    <strong className="text-[#1d1d1f] mt-0.5 block">{selectedAppointment.doctor?.user?.fullName || 'Practitioner'}</strong>
                    <span className="text-[11px] text-[#0066cc] block">{selectedAppointment.doctor?.specialty}</span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Facility Name</span>
                    <strong className="text-[#1d1d1f] mt-0.5 block">{resolveClinic(selectedAppointment).name}</strong>
                    {resolveClinic(selectedAppointment).city && (
                      <span className="text-[11px] text-[#86868b] block">{resolveClinic(selectedAppointment).city}</span>
                    )}
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#86868b] block text-[11px]">Shift</span>
                    <span className="text-[#1d1d1f] font-normal mt-0.5 block">{cleanSlotName(selectedAppointment.checkingWindow, 'Shift 1')}</span>
                  </div>
                </div>
              </div>

              {/* Clinical Notes / Reason */}
              {(selectedAppointment.reasonForVisit || selectedAppointment.symptoms) && (
                <div className="p-3.5 bg-white border border-[#e5e5ea] rounded-xl space-y-1">
                  <span className="text-xs font-semibold text-[#1d1d1f] block">Reason for Visit / Symptoms</span>
                  <p className="text-xs text-[#48484a] leading-relaxed">
                    {selectedAppointment.reasonForVisit || selectedAppointment.symptoms}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#f0f0f2] flex justify-end">
              <AppleButton variant="ghost" size="sm" onClick={() => setSelectedAppointment(null)}>
                Close
              </AppleButton>
            </div>
          </div>
        </div>
  );
};
