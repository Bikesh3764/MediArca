import React from 'react';
import { X } from 'lucide-react';
import { useClinicDashboard } from './state';
export const InviteDoctorModal: React.FC = () => {
  const {
    data,
    allDoctors,
    showAddModal,
    setShowAddModal,
    doctorEmail,
    setDoctorEmail,
    adding,
    doctorSearchQuery,
    setDoctorSearchQuery,
    handleAddDoctor,
    handleQuickAdd,
    doctors,
  } = useClinicDashboard();
  if (!showAddModal) return null;
  return (
<div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget && !adding) setShowAddModal(false);
          }}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-[#e5e5ea] max-w-md w-full p-6 sm:p-8 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-8  max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
            {/* Apple Drag Handle Pill */}
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">Invite Doctor</h3>
              <button aria-label="Close"
                disabled={adding}
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-full hover:bg-[#f5f5f7] active:scale-[0.98] text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDoctor} className="space-y-4 pt-5">
              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Doctor's Registered Email
                </label>
                <input
                  type="email"
                  required
                  disabled={adding}
                  value={doctorEmail}
                  onChange={(e) => setDoctorEmail(e.target.value)}
                  placeholder="dr.sarah@mediarca.com"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              {/* Quick Select from Platform Doctors */}
              {allDoctors.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-normal text-[#86868b]">
                      Or search from verified doctors
                    </label>
                    <span className="text-xs text-[#86868b]">{allDoctors.length} available</span>
                  </div>
                  <input
                    type="text"
                    value={doctorSearchQuery}
                    onChange={(e) => setDoctorSearchQuery(e.target.value)}
                    placeholder="Filter by name, specialty, or email..."
                    className="w-full h-10 px-3.5 rounded-xl border border-[#d2d2d7] text-base sm:text-xs bg-white text-[#1d1d1f] placeholder:text-[#a1a1a6] transition-all focus:outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] mb-2.5"
                  />
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {allDoctors
                      .filter((d) => {
                        if (!doctorSearchQuery.trim()) return true;
                        const q = doctorSearchQuery.toLowerCase().trim();
                        const name = (d.user?.fullName || '').toLowerCase();
                        const spec = (d.specialty || '').toLowerCase();
                        const email = (d.user?.email || '').toLowerCase();
                        return name.includes(q) || spec.includes(q) || email.includes(q);
                      })
                      .map((d) => {
                        const isAlreadyAdded = doctors.some((doc) => doc.doctorId === d.id);
                        const isPendingInvitation = data?.outgoingRequests?.some((req) => req.doctorId === d.id);
                        const isIncomingRequest = data?.incomingRequests?.some((req) => req.doctorId === d.id);
                        const docEmail = d.user?.email || '';
                        const docName = d.user?.fullName || 'Dr. Specialist';
                        return (
                          <div
                            key={d.id}
                            className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-between text-xs hover:border-[#d2d2d7] transition-all"
                          >
                            <div
                              className="cursor-pointer flex-1 mr-2"
                              onClick={() => {
                                if (docEmail) setDoctorEmail(docEmail);
                              }}
                              title={docEmail ? 'Click to select email' : undefined}
                            >
                              <div className="font-semibold text-[13px] text-[#1d1d1f] hover:text-[#0066cc] transition-colors">{docName}</div>
                              <div className="text-[11px] text-[#86868b] mt-0.5">
                                {d.specialty}{docEmail ? ` • ${docEmail}` : ''}
                              </div>
                            </div>
                            {isAlreadyAdded ? (
                              <span className="text-[11px] text-[#86868b] px-2.5 py-1 rounded-full bg-white border border-[#e5e5ea] font-normal shrink-0">
                                Affiliated
                              </span>
                            ) : isPendingInvitation ? (
                              <span className="text-[11px] text-warning bg-warning-soft border border-warning-line/80 px-2.5 py-1 rounded-full font-normal shrink-0">
                                Invited
                              </span>
                            ) : isIncomingRequest ? (
                              <button
                                type="button"
                                disabled={adding}
                                onClick={() => handleQuickAdd(docEmail, d.id)}
                                className="h-7 px-3 rounded-full bg-success hover:bg-success text-white text-xs font-semibold cursor-pointer transition-all active:scale-[0.98] shrink-0"
                              >
                                {adding ? 'Accepting...' : 'Accept'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={adding}
                                onClick={() => handleQuickAdd(docEmail, d.id)}
                                className="h-7 px-3 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold cursor-pointer transition-all active:scale-[0.98] shrink-0"
                              >
                                {adding ? 'Adding...' : 'Add'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-[#f0f0f2] flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={adding}
                  onClick={() => setShowAddModal(false)}
                  className="h-10 px-5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] active:scale-[0.98] text-[#1d1d1f] border border-black/[0.08] text-xs font-normal transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="h-10 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-normal  transition-all cursor-pointer disabled:opacity-50"
                >
                  {adding ? 'Inviting...' : 'Invite Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
  );
};
