import React from 'react';
import { parseDoctorSlots, format12Hour, formatDoctorDegrees, getFileUrl } from '../../services/api';
import { SearchableSpecialtySelect } from '../../components/ui/SearchableSpecialtySelect';
import { AppleFilterSelect } from '../../components/ui/AppleFilterSelect';
import { MapPin, Clock, RotateCcw, ChevronDown, Stethoscope } from 'lucide-react';
import { EmptyState } from '../../components/common/EmptyState';
import { useHome } from './state';
export const DoctorsSection: React.FC = () => {
  const {
    navigate,
    loadingDoctors,
    doctorSearchQuery,
    doctorLocationQuery,
    selectedSpecialty,
    setSelectedSpecialty,
    selectedCity,
    setSelectedCity,
    selectedState,
    setSelectedState,
    maxFee,
    setMaxFee,
    sortBy,
    setSortBy,
    minExperience,
    setMinExperience,
    doctorMobileFiltersOpen,
    doctorStateOptions,
    doctorCityOptions,
    specialtyCounts,
    filteredDoctors,
    resetDoctorFilters,
    getDoctorDetailPath,
    getDoctorBookPath,
  } = useHome();
  return (
<div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start w-full">
            {/* Desktop Left Filter Sidebar */}
            <aside className="hidden lg:block w-64 xl:w-72 bg-white rounded-2xl border border-[#e5e5ea] p-5 shrink-0 space-y-5 ">
              <div className="flex items-center justify-between pb-3.5 border-b border-[#f0f0f2]">
                <h3 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">Filters</h3>
                {(doctorSearchQuery || doctorLocationQuery || selectedSpecialty !== 'All' || selectedCity !== 'All' || selectedState !== 'All' || minExperience > 0 || maxFee < 3000) && (
                  <button
                    type="button"
                    onClick={resetDoctorFilters}
                    className="h-6 px-2.5 rounded-full text-xs font-normal text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e5e5ea] transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Reset all filters"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {/* State */}
                <div>
                  <AppleFilterSelect
                    label="State"
                    value={selectedState}
                    onChange={(st) => {
                      setSelectedState(st);
                      setSelectedCity('All');
                    }}
                    options={doctorStateOptions}
                    placeholder="All States"
                    variant="form"
                  />
                </div>

                {/* City */}
                <div>
                  <AppleFilterSelect
                    label="City"
                    value={selectedCity}
                    onChange={setSelectedCity}
                    options={doctorCityOptions}
                    placeholder={selectedState !== 'All' ? `All Cities in ${selectedState}` : 'All Cities'}
                    disabled={selectedState === 'All'}
                    variant="form"
                  />
                </div>

                {/* Specialty */}
                <div>
                  <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                    Specialty
                  </label>
                  <SearchableSpecialtySelect
                    value={selectedSpecialty}
                    onChange={setSelectedSpecialty}
                    variant="form"
                    includeAll={true}
                    counts={specialtyCounts}
                    placeholder="Select specialty..."
                  />
                </div>

                {/* Max Consultation Fee Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                    <span>Fee Limit</span>
                    <span className="text-[#0066cc] font-semibold">Up to ₹{maxFee}</span>
                  </div>
                  <input
                    type="range"
                    min="300"
                    max="3000"
                    step="100"
                    value={maxFee}
                    onChange={(e) => setMaxFee(Number(e.target.value))}
                    className="w-full h-1 bg-[#e5e5ea] rounded-lg appearance-none cursor-pointer accent-[#0066cc]"
                  />
                  <div className="flex justify-between text-[11px] text-[#86868b] mt-1 font-normal">
                    <span>₹300</span>
                    <span>₹3000</span>
                  </div>
                </div>

                {/* Experience Segmented Control */}
                <div>
                  <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                    Experience
                  </label>
                  <div className="p-1 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] grid grid-cols-4 gap-1 select-none">
                    {[
                      { label: 'All', value: 0 },
                      { label: '5+ yr', value: 5 },
                      { label: '10+ yr', value: 10 },
                      { label: '15+ yr', value: 15 },
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setMinExperience(item.value)}
                        className={`py-1.5 rounded-lg text-[11px] transition-all duration-150 text-center cursor-pointer ${
                          minExperience === item.value
                            ? 'bg-white text-[#1d1d1f] font-semibold  border border-black/5'
                            : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            {/* Main Doctor Grid */}
            <div className="flex-1 w-full min-w-0 space-y-6">
              {/* Mobile Collapsible Filters */}
              {doctorMobileFiltersOpen && (
                <div className="lg:hidden bg-white p-5 rounded-2xl border border-[#e5e5ea]  space-y-4">
                  <div className="flex items-center justify-between pb-2.5 border-b border-[#f0f0f2]">
                    <span className="text-xs font-semibold text-[#1d1d1f] tracking-tight">Filter Options</span>
                    {(doctorSearchQuery || doctorLocationQuery || selectedSpecialty !== 'All' || selectedCity !== 'All' || selectedState !== 'All' || minExperience > 0 || maxFee < 3000) && (
                      <button
                        type="button"
                        onClick={resetDoctorFilters}
                        className="text-xs text-[#0066cc] font-normal flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                      Specialty
                    </label>
                    <SearchableSpecialtySelect
                      value={selectedSpecialty}
                      onChange={setSelectedSpecialty}
                      variant="form"
                      includeAll={true}
                      counts={specialtyCounts}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <AppleFilterSelect
                        label="State"
                        value={selectedState}
                        onChange={(st) => {
                          setSelectedState(st);
                          setSelectedCity('All');
                        }}
                        options={doctorStateOptions}
                        placeholder="All States"
                        variant="form"
                      />
                    </div>
                    <div>
                      <AppleFilterSelect
                        label="City"
                        value={selectedCity}
                        onChange={setSelectedCity}
                        options={doctorCityOptions}
                        placeholder={selectedState !== 'All' ? `All Cities` : 'All Cities'}
                        disabled={selectedState === 'All'}
                        variant="form"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                      <span>Fee Limit</span>
                      <span className="text-[#0066cc] font-semibold">Up to ₹{maxFee}</span>
                    </div>
                    <input
                      type="range"
                      min="300"
                      max="3000"
                      step="100"
                      value={maxFee}
                      onChange={(e) => setMaxFee(Number(e.target.value))}
                      className="w-full h-1 bg-[#e5e5ea] rounded-lg appearance-none cursor-pointer accent-[#0066cc]"
                    />
                    <div className="flex justify-between text-[11px] text-[#86868b] mt-1 font-normal">
                      <span>₹300</span>
                      <span>₹3000</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                      Experience
                    </label>
                    <div className="p-1 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] grid grid-cols-4 gap-1 select-none">
                      {[
                        { label: 'All', value: 0 },
                        { label: '5+ yr', value: 5 },
                        { label: '10+ yr', value: 10 },
                        { label: '15+ yr', value: 15 },
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setMinExperience(item.value)}
                          className={`py-1.5 rounded-lg text-[11px] transition-all duration-150 text-center cursor-pointer ${
                            minExperience === item.value
                              ? 'bg-white text-[#1d1d1f] font-semibold  border border-black/5'
                              : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Open Apple Catalog Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5e5ea]">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                    {selectedSpecialty === 'All' ? 'Specialists' : selectedSpecialty}
                  </h2>
                  <span className="text-sm text-[#86868b] font-normal">
                    ({filteredDoctors.length})
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
                  <div className="relative inline-flex items-center">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'experience' | 'fee_low' | 'fee_high')}
                      className="appearance-none h-9 pl-3.5 pr-8 rounded-full border border-[#d2d2d7] bg-white hover:bg-[#f5f5f7] text-xs font-normal text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] cursor-pointer  transition-all"
                    >
                      <option value="experience">Most Experienced</option>
                      <option value="fee_low">Price: Low to High</option>
                      <option value="fee_high">Price: High to Low</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[#86868b] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              {/* Doctor Cards Grid */}
              {loadingDoctors ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fill,minmax(320px,1fr))] gap-4 sm:gap-6 w-full">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="h-80 rounded-2xl bg-white border border-[#e5e5ea] animate-pulse p-4"
                    />
                  ))}
                </div>
              ) : filteredDoctors.length === 0 ? (
                <EmptyState
                  icon={Stethoscope}
                  title="No doctors found"
                  description="No doctors match your filters."
                  actionText="Reset All Filters"
                  onAction={resetDoctorFilters}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fill,minmax(320px,1fr))] gap-4 sm:gap-6 w-full">
                  {filteredDoctors.map((doctor) => {
                    const slots = parseDoctorSlots(doctor);
                    // Strictly sanitize doctor degrees to legitimate medical degrees only (NO FACC!)
                    const cleanDegrees = formatDoctorDegrees(doctor.qualifications);
                    const primaryClinic = doctor.clinics?.find((c) => c?.clinic)?.clinic || null;

                    return (
                      <div
                        key={doctor.id}
                        className="w-full bg-white rounded-2xl border border-[#e5e5ea]  overflow-hidden hover:border-[#0066cc]/40 transition-all duration-200 flex flex-col justify-between group"
                      >
                        {/* Doctor Photo Banner - Natural 16:10 proportion displaying the full photo */}
                        <div
                          onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                          className="relative w-full aspect-[16/10] bg-[#f5f5f7] border-b border-[#f0f0f2] overflow-hidden cursor-pointer flex items-center justify-center"
                        >
                          {doctor.user?.avatarUrl ? (
                            <img
                              src={getFileUrl(doctor.user.avatarUrl)}
                              alt={doctor.user.fullName}
                              className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.parentElement?.querySelector('.doc-cat-fallback-banner');
                                if (fallback) (fallback as HTMLElement).style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            className={`doc-cat-fallback-banner w-full h-full ${
                              doctor.user?.avatarUrl ? 'hidden' : 'flex'
                            } items-center justify-center font-semibold text-[44px] text-[#c7c7cc] bg-[#f5f5f7] select-none`}
                          >
                            {(doctor.user?.fullName ? doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] : null) || 'D'}
                          </div>
                        </div>

                        {/* Card Body with Refined Apple Typography */}
                        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                          <div>
                            {/* Header: Doctor Name & Experience */}
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="min-w-0">
                                <h3
                                  onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                                  className="text-[17px] font-semibold text-[#1d1d1f] hover:text-[#0066cc] cursor-pointer tracking-tight transition-colors duration-150 truncate leading-snug"
                                  title={doctor.user.fullName}
                                >
                                  {doctor.user.fullName}
                                </h3>
                                <div className="mt-1 flex items-center gap-1.5 text-xs text-[#86868b] truncate">
                                  <span className="font-normal text-[#0066cc]">{doctor.specialty}</span>
                                  {cleanDegrees && (
                                    <>
                                      <span className="text-[#c7c7cc] select-none">•</span>
                                      <span className="font-normal text-[#48484a]">{cleanDegrees}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <span className="text-[11px] font-normal text-[#48484a] bg-[#f5f5f7] px-2.5 py-0.5 rounded-full border border-[#e5e5ea] shrink-0 whitespace-nowrap select-none">
                                {doctor.experienceYears} yrs exp
                              </span>
                            </div>

                            {/* Practice Clinic & Shift Timing */}
                            <div className="mt-3.5 space-y-2 text-xs">
                              {primaryClinic && (
                                <div className="flex items-center gap-2 min-w-0">
                                  <MapPin className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                                  <span className="truncate text-[#1d1d1f] font-normal">
                                    {primaryClinic.clinicName}
                                    {primaryClinic.city ? <span className="text-[#86868b] font-normal"> · {primaryClinic.city}</span> : ''}
                                  </span>
                                  {(doctor.clinics?.length ?? 0) > 1 && (
                                    <span className="text-[11px] font-normal text-[#0066cc] bg-[#0066cc]/8 px-2 py-0.5 rounded-full border border-[#0066cc]/15 shrink-0 select-none">
                                      +{(doctor.clinics?.length ?? 0) - 1} more
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center gap-2 min-w-0">
                                <Clock className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                                <span className="truncate text-[#48484a] font-normal tracking-tight">
                                  {slots.length > 0
                                    ? `${format12Hour(slots[0].startTime)} – ${format12Hour(slots[0].endTime)}`
                                    : doctor.checkingStartTime
                                    ? `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`
                                    : 'Consultation hours'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Card Footer: Fee & Apple Action Blue Pill Button */}
                          <div className="mt-4 pt-3.5 border-t border-[#f0f0f2] flex items-center justify-between gap-3">
                            <div className="flex items-baseline gap-1">
                              <span className="text-[21px] font-semibold text-[#1d1d1f] tracking-tight">
                                ₹{doctor.consultationFee.toFixed(0)}
                              </span>
                              <span className="text-xs text-[#86868b] font-normal">/ visit</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => navigate(getDoctorBookPath(doctor.id, primaryClinic?.id))}
                              className="h-8 min-w-[78px] px-5 rounded-full text-xs font-normal text-white bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.97] transition-all duration-150 ease-out cursor-pointer select-none  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc]/40 inline-flex items-center justify-center"
                            >
                              Book
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
  );
};
