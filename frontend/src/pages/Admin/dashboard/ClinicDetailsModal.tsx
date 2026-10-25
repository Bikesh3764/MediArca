import React from 'react';
import { AppleButton } from '../../../components/ui/AppleButton';
import { CheckCircle2, X, Ban, XCircle } from 'lucide-react';
import { useAdminDashboard } from './state';
export const ClinicDetailsModal: React.FC = () => {
  const {
    clinicActionId,
    selectedClinic,
    setSelectedClinic,
    getPractitionerStatus,
    renderStatusBadge,
    handleVerifyClinic,
  } = useAdminDashboard();
  if (!selectedClinic) return null;
  return (
<div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedClinic(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
        >
          <div className="bg-white rounded-[28px] border border-[#e5e5ea] max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">{selectedClinic.clinicName}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[13px] text-[#86868b]">Clinical Healthcare Facility Verification</p>
                  {renderStatusBadge(getPractitionerStatus(selectedClinic))}
                </div>
              </div>
              <button aria-label="Close"
                onClick={() => setSelectedClinic(null)}
                className="p-1.5 rounded-full hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] active:scale-95 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-[#1d1d1f]">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea]">
                <div>
                  <span className="text-xs font-medium text-[#86868b] block">Facility Address</span>
                  <p className="font-medium mt-0.5">{selectedClinic.address}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-[#86868b] block">City & State</span>
                  <p className="font-medium mt-0.5">{selectedClinic.city || 'Not Specified'}{selectedClinic.state ? `, ${selectedClinic.state}` : ''}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 p-3.5 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] text-center">
                <div>
                  <span className="text-xs font-medium text-[#86868b] block">Doctors</span>
                  <p className="text-base font-semibold text-[#1d1d1f] mt-0.5">
                    {selectedClinic._count?.doctors ?? selectedClinic.doctorsCount ?? 0}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-[#86868b] block">Receptionists</span>
                  <p className="text-base font-semibold text-[#0066cc] mt-0.5">
                    {selectedClinic._count?.receptionists ?? selectedClinic.receptionistsCount ?? 0}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-[#86868b] block">Bookings</span>
                  <p className="text-base font-semibold text-[#1d1d1f] mt-0.5">
                    {selectedClinic._count?.appointments ?? selectedClinic.appointmentsCount ?? 0}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-white border border-[#e5e5ea] rounded-xl space-y-2">
                <span className="text-xs font-semibold text-[#1d1d1f] block">
                  Affiliated Practitioners ({selectedClinic.doctors?.length || 0})
                </span>
                {selectedClinic.doctors && selectedClinic.doctors.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedClinic.doctors.map((dAff: any) => (
                      <div
                        key={dAff.id || dAff.doctor?.id}
                        className="p-2 rounded-lg bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-[#1d1d1f] block">
                            {dAff.doctor?.user?.fullName || 'Practitioner'}
                          </span>
                          <span className="text-[11px] text-[#0066cc]">
                            {dAff.doctor?.specialty || 'General Practitioner'}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#86868b]">{dAff.doctor?.user?.email}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#86868b]">No practitioner affiliations recorded yet.</p>
                )}
              </div>

              <div className="p-3.5 bg-white border border-[#e5e5ea] rounded-xl space-y-2">
                <span className="text-xs font-semibold text-[#1d1d1f] block">Primary Administrative Contact</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Admin Full Name</span>
                    <span className="font-medium mt-0.5 block">{selectedClinic.user?.fullName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Direct Email</span>
                    <span className="font-medium text-[#1d1d1f] mt-0.5 block">{selectedClinic.user?.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Facility Phone</span>
                    <span className="mt-0.5 block">{selectedClinic.phone || selectedClinic.user?.phone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Registration Date</span>
                    <span className="mt-0.5 block">{selectedClinic.createdAt ? new Date(selectedClinic.createdAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7]">
                <span className="text-[#86868b] font-medium">Platform Verification State</span>
                {renderStatusBadge(getPractitionerStatus(selectedClinic))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#f0f0f2] flex items-center justify-between">
              <AppleButton variant="ghost" size="sm" onClick={() => setSelectedClinic(null)}>
                Close
              </AppleButton>
              <div className="flex items-center gap-2">
                {getPractitionerStatus(selectedClinic) === 'VERIFIED' && (
                  <AppleButton
                    variant="ghost"
                    size="sm"
                    disabled={clinicActionId === selectedClinic.id}
                    onClick={async () => {
                      const ok = await handleVerifyClinic(selectedClinic.id, 'SUSPENDED');
                      if (ok) setSelectedClinic(null);
                    }}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200"
                  >
                    <Ban className="w-3.5 h-3.5 mr-1" />
                    Suspend Verification
                  </AppleButton>
                )}
                {getPractitionerStatus(selectedClinic) === 'SUSPENDED' && (
                  <AppleButton
                    variant="primary"
                    size="sm"
                    disabled={clinicActionId === selectedClinic.id}
                    onClick={async () => {
                      const ok = await handleVerifyClinic(selectedClinic.id, 'VERIFIED');
                      if (ok) setSelectedClinic(null);
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Re-activate Facility
                  </AppleButton>
                )}
                {getPractitionerStatus(selectedClinic) === 'REJECTED' && (
                  <AppleButton
                    variant="primary"
                    size="sm"
                    disabled={clinicActionId === selectedClinic.id}
                    onClick={async () => {
                      const ok = await handleVerifyClinic(selectedClinic.id, 'VERIFIED');
                      if (ok) setSelectedClinic(null);
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Re-evaluate & Approve
                  </AppleButton>
                )}
                {getPractitionerStatus(selectedClinic) === 'PENDING' && (
                  <>
                    <AppleButton
                      variant="ghost"
                      size="sm"
                      disabled={clinicActionId === selectedClinic.id}
                      onClick={async () => {
                        const ok = await handleVerifyClinic(selectedClinic.id, 'REJECTED');
                        if (ok) setSelectedClinic(null);
                      }}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Reject Application
                    </AppleButton>
                    <AppleButton
                      variant="primary"
                      size="sm"
                      disabled={clinicActionId === selectedClinic.id}
                      onClick={async () => {
                        const ok = await handleVerifyClinic(selectedClinic.id, 'VERIFIED');
                        if (ok) setSelectedClinic(null);
                      }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      {clinicActionId === selectedClinic.id ? 'Approving...' : 'Approve Facility'}
                    </AppleButton>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
  );
};
