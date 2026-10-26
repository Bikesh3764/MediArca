import React from 'react';
import { Search, MapPin, X, SlidersHorizontal } from 'lucide-react';
import { useHome } from './state';
export const DoctorsIntroSection: React.FC = () => {
  const {
    doctorSearchQuery,
    setDoctorSearchQuery,
    doctorLocationQuery,
    setDoctorLocationQuery,
    selectedSpecialty,
    selectedCity,
    selectedState,
    maxFee,
    minExperience,
    doctorMobileFiltersOpen,
    setDoctorMobileFiltersOpen,
    resetDoctorFilters,
  } = useHome();
  return (
<div className="flex-1 w-full h-11 bg-white px-3.5 rounded-full border border-[#e5e5ea] flex items-center gap-2 sm:gap-3 ">
              <div className="flex items-center gap-2 flex-1 h-full min-w-0">
                <Search className="w-4 h-4 text-[#86868b] shrink-0" />
                <input
                  type="text"
                  value={doctorSearchQuery}
                  onChange={(e) => setDoctorSearchQuery(e.target.value)}
                  placeholder="Search doctors"
                  className="w-full h-full bg-transparent text-xs sm:text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none truncate"
                />
                {doctorSearchQuery && (
                  <button aria-label="Close"
                    type="button"
                    onClick={() => setDoctorSearchQuery('')}
                    className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="hidden sm:block w-px h-5 bg-[#e5e5ea] shrink-0" />

              <div className="hidden sm:flex items-center gap-2 w-36 sm:w-44 h-full shrink-0">
                <MapPin className="w-4 h-4 text-[#86868b] shrink-0" />
                <input
                  type="text"
                  value={doctorLocationQuery}
                  onChange={(e) => setDoctorLocationQuery(e.target.value)}
                  placeholder="City or locality..."
                  className="w-full h-full bg-transparent text-xs sm:text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none truncate"
                />
                {doctorLocationQuery && (
                  <button aria-label="Close"
                    type="button"
                    onClick={() => setDoctorLocationQuery('')}
                    className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Mobile Filter Toggle */}
              <button
                type="button"
                onClick={() => setDoctorMobileFiltersOpen(!doctorMobileFiltersOpen)}
                className="lg:hidden h-7 px-2.5 sm:px-3 rounded-full border border-[#e5e5ea] bg-[#f5f5f7] text-xs font-normal text-[#1d1d1f] flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#86868b]" />
                <span>Filters</span>
              </button>

              {(doctorSearchQuery || doctorLocationQuery || selectedSpecialty !== 'All' || selectedCity !== 'All' || selectedState !== 'All' || minExperience > 0 || maxFee < 3000) && (
                <button
                  type="button"
                  onClick={resetDoctorFilters}
                  className="h-7 px-2.5 rounded-full text-xs font-normal text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.04] cursor-pointer active:scale-95 shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
  );
};
