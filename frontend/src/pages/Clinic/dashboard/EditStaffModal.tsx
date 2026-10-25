import React from 'react';
import { X, Check } from 'lucide-react';
import { cleanDoctorName } from './helpers';
import { useClinicDashboard } from './state';
export const EditStaffModal: React.FC = () => {
  const {
    editingRec,
    setEditingRec,
    editDoctorIds,
    setEditDoctorIds,
    savingAssignments,
    handleUpdateAssignedDoctors,
    doctors,
  } = useClinicDashboard();
  if (!editingRec) return null;
  return (
<div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingAssignments) setEditingRec(null);
          }}
        >
          <div className="bg-white rounded-t-[28px] sm:rounded-[28px] border border-[#e5e5ea] max-w-md w-full p-6 sm:p-8 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-8 shadow-[0_24px_60px_rgba(0,0,0,0.16)] max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
            {/* Apple Drag Handle Pill */}
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">Manage Doctor Desk Access</h3>
                <p className="text-[13px] text-[#86868b] mt-0.5">
                  {editingRec.fullName}
                </p>
              </div>
              <button aria-label="Close"
                disabled={savingAssignments}
                onClick={() => setEditingRec(null)}
                className="p-2 rounded-full hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAssignedDoctors} className="space-y-4 pt-5">
              <p className="text-xs text-[#86868b] leading-relaxed">
                Select which affiliated doctors this receptionist is authorized to book walk-ins and manage queues for:
              </p>

              {doctors.length === 0 ? (
                <div className="p-4 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl text-xs text-[#86868b] text-center">
                  No affiliated doctors currently onboarded to this clinic.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {doctors.map((doc) => {
                    const isSelected = editDoctorIds.includes(doc.doctorId);
                    return (
                      <div
                        key={doc.doctorId}
                        onClick={() => {
                          if (isSelected) {
                            setEditDoctorIds(editDoctorIds.filter((id) => id !== doc.doctorId));
                          } else {
                            setEditDoctorIds([...editDoctorIds, doc.doctorId]);
                          }
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-[#0066cc]/5 border-[#0066cc]/40 text-[#0066cc]'
                            : 'bg-white border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#f5f5f7]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                              isSelected
                                ? 'bg-[#0066cc] border-transparent text-white'
                                : 'border-[#d2d2d7] bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div>
                            <div className="font-semibold text-[13px] text-[#1d1d1f]">{cleanDoctorName(doc.fullName)}</div>
                            <div className="text-[11px] text-[#86868b]">{doc.specialty}</div>
                          </div>
                        </div>
                        <span className="text-xs text-[#86868b]">₹{doc.consultationFee}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-4 border-t border-[#f0f0f2] flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={savingAssignments}
                  onClick={() => setEditingRec(null)}
                  className="h-10 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAssignments}
                  className="h-10 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingAssignments ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </form>
          </div>
        </div>
  );
};
