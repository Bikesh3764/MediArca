import React from 'react';
import { format12Hour, getFileUrl, formatDoctorDegrees } from '../../../services/api';
import { AppleButton } from '../../../components/ui/AppleButton';
import { CheckCircle2, X, Ban, XCircle } from 'lucide-react';
import { useAdminDashboard } from './state';
export const DoctorDetailsModal: React.FC = () => {
  const {
    actionId,
    selectedDoctor,
    setSelectedDoctor,
    getPractitionerStatus,
    renderStatusBadge,
    handleVerify,
  } = useAdminDashboard();
  if (!selectedDoctor) return null;
  return (
<div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedDoctor(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
        >
          <div className="bg-white rounded-[28px] border border-[#e5e5ea] max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex items-center justify-center font-bold text-lg text-[#0066cc]">
                  {selectedDoctor.user.avatarUrl ? (
                    <img src={getFileUrl(selectedDoctor.user.avatarUrl)} alt={selectedDoctor.user.fullName} className="w-full h-full object-cover" />
                  ) : (
                    selectedDoctor.user.fullName[0]
                  )}
                </div>
                <div>
                  <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">{selectedDoctor.user.fullName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-[#0066cc] font-medium">{selectedDoctor.specialty}</p>
                    {renderStatusBadge(getPractitionerStatus(selectedDoctor))}
                  </div>
                </div>
              </div>
              <button aria-label="Close"
                onClick={() => setSelectedDoctor(null)}
                className="p-1.5 rounded-full hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] active:scale-95 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]">
                <div>
                  <span className="text-[#86868b] block">Qualifications</span>
                  <strong className="text-[#1d1d1f] mt-0.5 block">{formatDoctorDegrees(selectedDoctor.qualifications)}</strong>
                </div>
                <div>
                  <span className="text-[#86868b] block">Experience</span>
                  <strong className="text-[#1d1d1f] mt-0.5 block">{selectedDoctor.experienceYears} Years</strong>
                </div>
                <div>
                  <span className="text-[#86868b] block">Consultation Fee</span>
                  <strong className="text-[#1d1d1f] mt-0.5 block">₹{selectedDoctor.consultationFee}</strong>
                </div>
                <div>
                  <span className="text-[#86868b] block">Checking Window</span>
                  <strong className="text-[#0066cc] mt-0.5 block">
                    {selectedDoctor.checkingStartTime ? `${format12Hour(selectedDoctor.checkingStartTime)} – ${format12Hour(selectedDoctor.checkingEndTime)}` : 'Flexible'}
                  </strong>
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">Clinic Address / Base</span>
                <p className="text-[#1d1d1f] p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]">
                  {selectedDoctor.clinicAddress || 'MediArca Direct Outpatient Practice'}
                </p>
              </div>

              <div>
                <span className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Affiliated Clinical Facilities ({selectedDoctor.clinics?.length || 0})
                </span>
                {selectedDoctor.clinics && selectedDoctor.clinics.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedDoctor.clinics.map((cAff) => (
                      <div
                        key={cAff.id || cAff.clinicId}
                        className="p-2.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-between"
                      >
                        <div>
                          <strong className="text-[#1d1d1f] block font-medium">
                            {cAff.clinic?.clinicName || 'Clinical Facility'}
                          </strong>
                          <span className="text-[11px] text-[#86868b] block">
                            {cAff.clinic?.address || ''}{cAff.clinic?.city ? `, ${cAff.clinic.city}` : ''}
                          </span>
                        </div>
                        {cAff.clinic?.phone && (
                          <span className="text-[11px] text-[#86868b] font-medium">{cAff.clinic.phone}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#86868b] p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs">
                    {selectedDoctor.clinicAddress ? `Primary: ${selectedDoctor.clinicAddress}` : 'No multi-clinic affiliations recorded yet.'}
                  </p>
                )}
              </div>

              <div>
                <span className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">Professional Bio & Practice Philosophy</span>
                <p className="text-[#1d1d1f] p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] leading-relaxed">
                  {selectedDoctor.bio || 'Dedicated medical practitioner accepting outpatient consultations.'}
                </p>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[#86868b]">Email: {selectedDoctor.user.email}</span>
                <span className="text-[#86868b]">Phone: {selectedDoctor.user.phone || 'N/A'}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#f0f0f2] flex items-center justify-between">
              <AppleButton variant="ghost" size="sm" onClick={() => setSelectedDoctor(null)}>
                Close
              </AppleButton>
              <div className="flex items-center gap-2">
                {getPractitionerStatus(selectedDoctor) === 'VERIFIED' && (
                  <AppleButton
                    variant="ghost"
                    size="sm"
                    disabled={actionId === selectedDoctor.id}
                    onClick={async () => {
                      const ok = await handleVerify(selectedDoctor.id, 'SUSPENDED');
                      if (ok) setSelectedDoctor(null);
                    }}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200"
                  >
                    <Ban className="w-3.5 h-3.5 mr-1" />
                    Suspend Credentials
                  </AppleButton>
                )}
                {getPractitionerStatus(selectedDoctor) === 'SUSPENDED' && (
                  <AppleButton
                    variant="primary"
                    size="sm"
                    disabled={actionId === selectedDoctor.id}
                    onClick={async () => {
                      const ok = await handleVerify(selectedDoctor.id, 'VERIFIED');
                      if (ok) setSelectedDoctor(null);
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Re-activate Practitioner
                  </AppleButton>
                )}
                {getPractitionerStatus(selectedDoctor) === 'REJECTED' && (
                  <AppleButton
                    variant="primary"
                    size="sm"
                    disabled={actionId === selectedDoctor.id}
                    onClick={async () => {
                      const ok = await handleVerify(selectedDoctor.id, 'VERIFIED');
                      if (ok) setSelectedDoctor(null);
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Re-evaluate & Approve
                  </AppleButton>
                )}
                {getPractitionerStatus(selectedDoctor) === 'PENDING' && (
                  <>
                    <AppleButton
                      variant="ghost"
                      size="sm"
                      disabled={actionId === selectedDoctor.id}
                      onClick={async () => {
                        const ok = await handleVerify(selectedDoctor.id, 'REJECTED');
                        if (ok) setSelectedDoctor(null);
                      }}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Reject Application
                    </AppleButton>
                    <AppleButton
                      variant="primary"
                      size="sm"
                      disabled={actionId === selectedDoctor.id}
                      onClick={async () => {
                        const ok = await handleVerify(selectedDoctor.id, 'VERIFIED');
                        if (ok) setSelectedDoctor(null);
                      }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      {actionId === selectedDoctor.id ? 'Approving...' : 'Approve & Verify License'}
                    </AppleButton>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
  );
};
