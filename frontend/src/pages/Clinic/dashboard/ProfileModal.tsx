import React from 'react';
import { sanitizeIndianPhone } from '../../../utils/phoneUtils';
import { AlertCircle, X, RefreshCw, MapPin } from 'lucide-react';
import { INDIAN_STATES, getCitiesForState } from '../../../utils/indiaStates';
import { useClinicDashboard } from './state';
export const ProfileModal: React.FC = () => {
  const {
    showProfileModal,
    setShowProfileModal,
    profileAddress,
    setProfileAddress,
    profileState,
    setProfileState,
    profileCity,
    setProfileCity,
    profilePhone,
    setProfilePhone,
    profileError,
    savingProfile,
    handleSaveProfile,
  } = useClinicDashboard();
  if (!showProfileModal) return null;
  return (
<div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowProfileModal(false);
          }}
        >
          <div className="relative w-full max-w-[500px] max-h-[92vh] overflow-y-auto bg-white rounded-t-[28px] sm:rounded-[28px] border border-[#e5e5ea] shadow-[0_24px_64px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.04)] p-6 sm:p-7 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-7 text-left">
            {/* Mobile Drag Handle */}
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-4" />
            <button aria-label="Close"
              type="button"
              onClick={() => setShowProfileModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-[#0066cc]/10 flex items-center justify-center text-[#0066cc]">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[19px] font-semibold text-[#1d1d1f] tracking-tight">Clinic Location & Details</h3>
                <p className="text-xs text-[#86868b]">Set your facility address so patients can discover your clinic.</p>
              </div>
            </div>

            {profileError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Clinic Street Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={profileAddress}
                  onChange={(e) => setProfileAddress(e.target.value)}
                  placeholder="e.g. Plot 42, Civil Township, Near Hanuman Mandir"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                    State <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={profileState}
                    onChange={(e) => {
                      setProfileState(e.target.value);
                      setProfileCity('');
                    }}
                    className="w-full h-11 px-3 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                    City <span className="text-rose-500">*</span>
                  </label>
                  {profileState && getCitiesForState(profileState).length > 0 ? (
                    <select
                      required
                      value={profileCity}
                      onChange={(e) => setProfileCity(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                    >
                      <option value="">Select City</option>
                      {getCitiesForState(profileState).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={profileCity}
                      onChange={(e) => setProfileCity(e.target.value)}
                      placeholder={profileState ? 'Enter City' : 'Select State First'}
                      disabled={!profileState}
                      className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 disabled:bg-[#f5f5f7] disabled:cursor-not-allowed"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Facility Contact Phone (Optional)
                </label>
                <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white overflow-hidden focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all duration-150">
                  <div className="h-full px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] flex items-center justify-center text-xs font-semibold text-[#1d1d1f]">
                    +91
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={sanitizeIndianPhone(profilePhone)}
                    onChange={(e) => setProfilePhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210"
                    className="flex-1 h-full px-3.5 bg-transparent text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#f0f0f2] flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="h-10 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="h-10 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {savingProfile ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    'Save Location'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
  );
};
