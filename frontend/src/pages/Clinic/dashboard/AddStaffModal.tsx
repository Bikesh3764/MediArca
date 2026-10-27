import React from 'react';
import { sanitizeIndianPhone } from '../../../utils/phoneUtils';
import { X, Check } from 'lucide-react';
import { cleanDoctorName } from './helpers';
import { useClinicDashboard } from './state';
export const AddStaffModal: React.FC = () => {
  const {
    showRecModal,
    setShowRecModal,
    recFullName,
    setRecFullName,
    recEmail,
    setRecEmail,
    recPassword,
    setRecPassword,
    recPhone,
    setRecPhone,
    recDoctorIds,
    setRecDoctorIds,
    provisioning,
    handleProvisionReceptionist,
    doctors,
  } = useClinicDashboard();
  // Only doctors who have joined the clinic can be given to a desk
  const deskDoctors = doctors.filter((d) => d.status === 'ACCEPTED' || d.status === 'ACTIVE');
  if (!showRecModal) return null;
  return (
<div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget && !provisioning) setShowRecModal(false);
          }}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-[#e5e5ea] max-w-lg w-full p-6 sm:p-8 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-8  max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
            {/* Apple Drag Handle Pill */}
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">Add Receptionist</h3>
              <button aria-label="Close"
                disabled={provisioning}
                onClick={() => setShowRecModal(false)}
                className="p-2 rounded-full hover:bg-[#f5f5f7] active:scale-[0.98] text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProvisionReceptionist} className="space-y-4 pt-5">
              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  disabled={provisioning}
                  value={recFullName}
                  onChange={(e) => setRecFullName(e.target.value)}
                  placeholder="Full name"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                    Login Email
                  </label>
                  <input
                    type="email"
                    required
                    disabled={provisioning}
                    value={recEmail}
                    onChange={(e) => setRecEmail(e.target.value)}
                    placeholder="desk@clinic.com"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                  />
                </div>
                <div>
                  <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                    Temporary Password
                  </label>
                  <input
                    type="text"
                    required
                    disabled={provisioning}
                    value={recPassword}
                    onChange={(e) => setRecPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    minLength={8}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Mobile <span className="text-[#86868b] font-normal">(Optional)</span>
                </label>
                <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white  focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all duration-150 overflow-hidden">
                  <div className="h-full px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] flex items-center justify-center select-none">
                    <span className="text-[13px] font-semibold text-[#1d1d1f]">+91</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    disabled={provisioning}
                    value={sanitizeIndianPhone(recPhone)}
                    onChange={(e) => {
                      const digits = sanitizeIndianPhone(e.target.value);
                      setRecPhone(digits ? `+91 ${digits}` : '');
                    }}
                    placeholder="98765 43210"
                    maxLength={10}
                    className="w-full h-full px-3.5 bg-transparent text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none tracking-wide"
                  />
                </div>
              </div>

              {/* Doctor Assignments */}
              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-2 tracking-tight">
                  Assign Doctors
                </label>
                {deskDoctors.length === 0 ? (
                  <div className="p-3.5 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl text-xs text-[#86868b] text-center">
                    No doctors yet.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {deskDoctors.map((doc) => {
                      const isSelected = recDoctorIds.includes(doc.doctorId);
                      return (
                        <div
                          key={doc.doctorId}
                          onClick={() => {
                            if (isSelected) {
                              setRecDoctorIds(recDoctorIds.filter((id) => id !== doc.doctorId));
                            } else {
                              setRecDoctorIds([...recDoctorIds, doc.doctorId]);
                            }
                          }}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all duration-150 flex items-center justify-between text-xs select-none ${
                            isSelected
                              ? 'bg-[#0066cc]/5 border-[#0066cc]/40 text-[#0066cc]'
                              : 'bg-white border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#f5f5f7]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all duration-150 ${
                                isSelected
                                  ? 'bg-[#0066cc] border-[#0066cc] text-white '
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
                          <span className="text-xs text-[#86868b] font-normal">₹{doc.consultationFee}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#f0f0f2] flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={provisioning}
                  onClick={() => setShowRecModal(false)}
                  className="h-10 px-5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] active:scale-[0.98] text-[#1d1d1f] border border-black/[0.08] text-xs font-normal transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provisioning}
                  className="h-10 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-normal  transition-all cursor-pointer disabled:opacity-50"
                >
                  {provisioning ? 'Adding...' : 'Add Receptionist'}
                </button>
              </div>
            </form>
          </div>
        </div>
  );
};
