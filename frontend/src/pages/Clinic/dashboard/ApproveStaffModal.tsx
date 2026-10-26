import React from 'react';
import { X, Check } from 'lucide-react';
import { cleanDoctorName } from './helpers';
import { useClinicDashboard } from './state';
export const ApproveStaffModal: React.FC = () => {
  const {
    approvingRec,
    setApprovingRec,
    approvalDoctorIds,
    setApprovalDoctorIds,
    processingRecId,
    handleRespondReceptionist,
    doctors,
  } = useClinicDashboard();
  if (!approvingRec) return null;
  return (
<div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget && processingRecId === null) setApprovingRec(null);
          }}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-[#e5e5ea] max-w-md w-full p-6 sm:p-8 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-8  max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
            {/* Apple Drag Handle Pill */}
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">Approve Receptionist</h3>
                <p className="text-[13px] text-[#86868b] mt-0.5">
                  Assign practitioners to {approvingRec.fullName}
                </p>
              </div>
              <button aria-label="Close"
                disabled={processingRecId !== null}
                onClick={() => setApprovingRec(null)}
                className="p-2 rounded-full hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs">
                <div className="font-semibold text-[14px] text-[#1d1d1f]">{approvingRec.fullName}</div>
                <div className="text-xs text-[#86868b] mt-0.5">{approvingRec.email}</div>
              </div>

              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1 tracking-tight">
                  Doctors they handle
                </label>
                <p className="text-xs text-[#86868b] mb-3 leading-relaxed">
                  They only see these doctors’ queues.
                </p>

                {doctors.filter((d) => d.status === 'ACCEPTED' || d.status === 'ACTIVE').length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#f5f5f7] text-[#86868b] text-xs border border-[#e5e5ea]">
                    No doctors yet. You can add them later.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {doctors
                      .filter((d) => d.status === 'ACCEPTED' || d.status === 'ACTIVE')
                      .map((doc) => {
                        const isChecked = approvalDoctorIds.includes(doc.doctorId);
                        return (
                          <div
                            key={doc.doctorId}
                            onClick={() => {
                              if (isChecked) {
                                setApprovalDoctorIds(approvalDoctorIds.filter((id) => id !== doc.doctorId));
                              } else {
                                setApprovalDoctorIds([...approvalDoctorIds, doc.doctorId]);
                              }
                            }}
                            className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-center justify-between text-xs ${
                              isChecked
                                ? 'bg-[#0066cc]/5 border-[#0066cc]'
                                : 'bg-[#f5f5f7] border-[#e5e5ea] hover:bg-[#e8e8ed]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                                  isChecked
                                    ? 'bg-[#0066cc] border-[#0066cc] text-white'
                                    : 'bg-white border-[#d2d2d7]'
                                }`}
                              >
                                {isChecked && <Check className="w-3 h-3" />}
                              </div>
                              <span className="font-semibold text-[#1d1d1f]">{cleanDoctorName(doc.fullName)}</span>
                              <span className="text-xs text-[#0066cc]">({doc.specialty})</span>
                            </div>
                            <span className="text-xs text-[#86868b]">₹{doc.consultationFee}</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#f0f0f2] flex justify-end gap-2.5">
              <button
                type="button"
                disabled={processingRecId !== null}
                onClick={() => setApprovingRec(null)}
                className="h-10 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-normal transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingRecId !== null}
                onClick={() => handleRespondReceptionist(approvingRec.id, 'ACCEPT', approvalDoctorIds)}
                className="h-10 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                {processingRecId === approvingRec.id ? 'Approving...' : 'Approve & Activate'}
              </button>
            </div>
          </div>
        </div>
  );
};
