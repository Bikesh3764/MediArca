import React from 'react';
import { AppleFilterSelect } from '../../components/ui/AppleFilterSelect';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { useHome } from './state';
export const ClinicsGridSection: React.FC = () => {
  const {
    clinics,
    clinicSearchQuery,
    setClinicSearchQuery,
    clinicSelectedCity,
    setClinicSelectedCity,
    clinicSelectedState,
    setClinicSelectedState,
    clinicMobileFiltersOpen,
    setClinicMobileFiltersOpen,
    clinicStateOptions,
    clinicCityOptions,
    resetClinicFilters,
  } = useHome();
  return (
<div className="flex-1 w-full flex flex-col gap-2">
              <div className="w-full h-11 bg-white px-3.5 rounded-full border border-[#e5e5ea] flex items-center gap-2 sm:gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-2 flex-1 h-full min-w-0">
                  <Search className="w-4 h-4 text-[#86868b] shrink-0" />
                  <input
                    type="text"
                    value={clinicSearchQuery}
                    onChange={(e) => setClinicSearchQuery(e.target.value)}
                    placeholder="Search clinics by name or address..."
                    className="w-full h-full bg-transparent text-xs sm:text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none truncate"
                  />
                  {clinicSearchQuery && (
                    <button aria-label="Close"
                      type="button"
                      onClick={() => setClinicSearchQuery('')}
                      className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* State Filter - Desktop */}
                <div className="hidden sm:block w-px h-5 bg-[#e5e5ea] shrink-0" />
                <div className="hidden sm:flex w-36 sm:w-44 h-full items-center shrink-0">
                  <AppleFilterSelect
                    value={clinicSelectedState}
                    onChange={(val) => {
                      setClinicSelectedState(val);
                      setClinicSelectedCity('All');
                    }}
                    options={clinicStateOptions}
                    placeholder="All States"
                    allLabel="All States"
                    allCount={clinics.length}
                    variant="bar"
                    searchable={true}
                    align="right"
                  />
                </div>

                {/* City Filter - Desktop */}
                <div className="hidden sm:block w-px h-5 bg-[#e5e5ea] shrink-0" />
                <div className="hidden sm:flex w-36 sm:w-44 h-full items-center shrink-0">
                  <AppleFilterSelect
                    value={clinicSelectedCity}
                    onChange={setClinicSelectedCity}
                    options={clinicCityOptions}
                    placeholder={clinicSelectedState !== 'All' ? `All in ${clinicSelectedState}` : 'All Cities'}
                    allLabel={clinicSelectedState !== 'All' ? `All in ${clinicSelectedState}` : 'All Cities'}
                    allCount={
                      clinicSelectedState !== 'All'
                        ? clinics.filter((c) =>
                            (c.state && c.state.toLowerCase() === clinicSelectedState.toLowerCase()) ||
                            (c.address && c.address.toLowerCase().includes(clinicSelectedState.toLowerCase()))
                          ).length
                        : clinics.length
                    }
                    disabled={clinicSelectedState === 'All'}
                    variant="bar"
                    searchable={clinicCityOptions.length > 5}
                    align="right"
                  />
                </div>

                {/* Mobile Filter Toggle */}
                <button
                  type="button"
                  onClick={() => setClinicMobileFiltersOpen(!clinicMobileFiltersOpen)}
                  className="sm:hidden h-7 px-2.5 rounded-full border border-[#e5e5ea] bg-[#f5f5f7] text-[11px] font-medium text-[#1d1d1f] flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                >
                  <SlidersHorizontal className="w-3 h-3 text-[#86868b]" />
                  <span>Filters{(clinicSelectedState !== 'All' || clinicSelectedCity !== 'All') ? ' •' : ''}</span>
                </button>

                {(clinicSearchQuery || clinicSelectedCity !== 'All' || clinicSelectedState !== 'All') && (
                  <button
                    type="button"
                    onClick={resetClinicFilters}
                    className="h-7 px-2.5 rounded-full text-xs font-normal text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.04] cursor-pointer active:scale-95 shrink-0"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Mobile Filter Expandable Drawer for Clinics */}
              {clinicMobileFiltersOpen && (
                <div className="sm:hidden w-full bg-white rounded-2xl border border-[#e5e5ea] p-3.5 shadow-sm space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-[#e5e5ea]">
                    <span className="text-xs font-semibold text-[#1d1d1f]">Location Filters</span>
                    <button
                      type="button"
                      onClick={() => setClinicMobileFiltersOpen(false)}
                      className="text-xs font-medium text-[#0066cc]"
                    >
                      Done
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[#86868b]">Select State</label>
                    <div className="w-full h-10">
                      <AppleFilterSelect
                        value={clinicSelectedState}
                        onChange={(val) => {
                          setClinicSelectedState(val);
                          setClinicSelectedCity('All');
                        }}
                        options={clinicStateOptions}
                        placeholder="All States"
                        allLabel="All States"
                        allCount={clinics.length}
                        variant="bar"
                        searchable={true}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[#86868b]">Select City</label>
                    <div className="w-full h-10">
                      <AppleFilterSelect
                        value={clinicSelectedCity}
                        onChange={setClinicSelectedCity}
                        options={clinicCityOptions}
                        placeholder={clinicSelectedState !== 'All' ? `All in ${clinicSelectedState}` : 'All Cities'}
                        allLabel={clinicSelectedState !== 'All' ? `All in ${clinicSelectedState}` : 'All Cities'}
                        allCount={
                          clinicSelectedState !== 'All'
                            ? clinics.filter((c) =>
                                (c.state && c.state.toLowerCase() === clinicSelectedState.toLowerCase()) ||
                                (c.address && c.address.toLowerCase().includes(clinicSelectedState.toLowerCase()))
                              ).length
                            : clinics.length
                        }
                        disabled={clinicSelectedState === 'All'}
                        variant="bar"
                        searchable={clinicCityOptions.length > 5}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
  );
};
