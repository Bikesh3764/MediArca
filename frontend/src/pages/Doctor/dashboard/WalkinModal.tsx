import React from 'react';
import { parseDoctorSlots, formatShiftOption, getLocalDateString, getTomorrowDateString, getMaxBookingDateString } from '../../../services/api';
import { sanitizeIndianPhone } from '../../../utils/phoneUtils';
import { CheckCircle2, Plus, AlertCircle, X, ChevronDown } from 'lucide-react';
import { useDoctorDashboard } from './state';
export const WalkinModal: React.FC = () => {
  const {
    user,
    affiliations,
    showAddModal,
    setShowAddModal,
    walkinName,
    setWalkinName,
    walkinAge,
    setWalkinAge,
    walkinGender,
    setWalkinGender,
    walkinPhone,
    setWalkinPhone,
    walkinDate,
    setWalkinDate,
    walkinReason,
    setWalkinReason,
    walkinSlotId,
    setWalkinSlotId,
    walkinClinicId,
    setWalkinClinicId,
    walkinSubmitting,
    walkinError,
    setWalkinError,
    walkinSuccess,
    setWalkinSuccess,
    handleCreateWalkin,
  } = useDoctorDashboard();
  if (!showAddModal) return null;
  return (
<div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
              setWalkinError(null);
              setWalkinSuccess(null);
            }
          }}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-[#e5e5ea] max-w-md w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-8  relative text-left">
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <button aria-label="Close"
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setWalkinError(null);
                setWalkinSuccess(null);
              }}
              className="absolute top-5 right-5 p-2 text-[#86868b] hover:text-[#1d1d1f] rounded-full hover:bg-[#f5f5f7] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <h3 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                Add Walk-in Patient
              </h3>
            </div>

            {walkinError && (
              <div className="mb-4 p-3 rounded-xl bg-danger-soft/70 border border-danger-line/80 text-danger text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
                <span>{walkinError}</span>
              </div>
            )}

            {walkinSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
                <span>{walkinSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateWalkin} className="space-y-4">
              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Patient name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Full name"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                    Age
                  </label>
                  <input
                    type="number"
                    placeholder="Years"
                    value={walkinAge}
                    onChange={(e) => setWalkinAge(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                  />
                </div>
                <div>
                  <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                    Gender
                  </label>
                  <div className="relative">
                    <select
                      value={walkinGender}
                      onChange={(e) => setWalkinGender(e.target.value)}
                      className="w-full h-11 pl-3.5 pr-9 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 appearance-none cursor-pointer"
                    >
                      <option value="Not Specified">Not specified</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
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
                    placeholder="98765 43210"
                    maxLength={10}
                    value={sanitizeIndianPhone(walkinPhone)}
                    onChange={(e) => setWalkinPhone(sanitizeIndianPhone(e.target.value))}
                    className="w-full h-full px-3.5 bg-transparent text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none tracking-wide"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Date
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWalkinDate(getLocalDateString())}
                    className={`h-9 px-3.5 rounded-xl text-xs font-normal border transition-all cursor-pointer ${
                      walkinDate === getLocalDateString()
                        ? 'bg-[#0066cc] text-white border-[#0066cc]'
                        : 'bg-white text-[#1d1d1f] border-[#d2d2d7] hover:bg-[#f5f5f7]'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalkinDate(getTomorrowDateString())}
                    className={`h-9 px-3.5 rounded-xl text-xs font-normal border transition-all cursor-pointer ${
                      walkinDate === getTomorrowDateString()
                        ? 'bg-[#0066cc] text-white border-[#0066cc]'
                        : 'bg-white text-[#1d1d1f] border-[#d2d2d7] hover:bg-[#f5f5f7]'
                    }`}
                  >
                    Tomorrow
                  </button>
                  <input
                    type="date"
                    min={getLocalDateString()}
                    max={getMaxBookingDateString()}
                    value={walkinDate}
                    onChange={(e) => setWalkinDate(e.target.value)}
                    className="flex-1 h-9 px-3 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-xs text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 cursor-pointer"
                  />
                </div>
              </div>

              {/* Clinic Affiliation Venue Selector */}
              {affiliations?.clinics && affiliations.clinics.length > 1 && (
                <div>
                  <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                    Clinic
                  </label>
                  <div className="relative">
                    <select
                      required
                      value={walkinClinicId}
                      onChange={(e) => {
                        setWalkinClinicId(e.target.value);
                        setWalkinSlotId('');
                      }}
                      className="w-full h-11 pl-3.5 pr-9 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 appearance-none cursor-pointer"
                    >
                      <option value="">Choose clinic</option>
                      {affiliations.clinics.map((c) => (
                        <option key={c.clinicId} value={c.clinicId}>
                          {c.clinicName} {c.city ? `(${c.city})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              )}

              {affiliations && affiliations.clinics.length === 0 && (
                <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs">
                  <span>Add a clinic to create walk-in tokens.</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Shift
                </label>
                <div className="relative">
                  <select
                    value={walkinSlotId}
                    onChange={(e) => setWalkinSlotId(e.target.value)}
                    className="w-full h-11 pl-3.5 pr-9 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 appearance-none cursor-pointer"
                  >
                    <option value="">Current shift</option>
                    {(
                      (walkinClinicId && affiliations?.clinics.find((c) => c.clinicId === walkinClinicId)?.slots) ||
                      (affiliations?.clinics?.length === 1 && affiliations.clinics[0].slots) ||
                      parseDoctorSlots(user?.doctorProfile)
                    ).map((slot, i) => (
                      <option key={slot.id || i} value={slot.id}>
                        {formatShiftOption(slot)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fever, cough"
                  value={walkinReason}
                  onChange={(e) => setWalkinReason(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={walkinSubmitting}
                  className="w-full h-11 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.99] text-white text-[14px] font-semibold tracking-tight  transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  {walkinSubmitting ? 'Issuing Ticket...' : 'Queue Walk-in Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
  );
};
