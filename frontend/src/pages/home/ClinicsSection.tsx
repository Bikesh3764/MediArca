import React from 'react';
import { parseDoctorSlots, format12Hour, formatDoctorDegrees, getFileUrl } from '../../services/api';
import { AppleButton } from '../../components/ui/AppleButton';
import clinicLobbyBg from '../../assets/clinic-lobby-bg.webp';
import { formatDisplayPhone } from '../../utils/phoneUtils';
import { MapPin, Clock, ArrowLeft, Phone, Building2, Stethoscope, ChevronRight } from 'lucide-react';
import { EmptyState } from '../../components/common/EmptyState';
import { getClinicLocationDisplay } from './helpers';
import { useHome } from './state';
export const ClinicsSection: React.FC = () => {
  const {
    navigate,
    loadingClinics,
    selectedClinic,
    handleSelectClinic,
    handleClearClinic,
    filteredClinics,
    clinicPracticingDoctors,
    resetClinicFilters,
    getDoctorDetailPath,
    getDoctorBookPath,
  } = useHome();
  return (
<div>
            {/* If a clinic is selected, show its full dedicated view with practicing doctors & time slots */}
            {selectedClinic ? (
              <div className="space-y-8 animate-fadeIn">
                {/* Selected Clinic Header Card */}
                <div className="bg-white rounded-2xl border border-[#e5e5ea] p-6 ">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#f5f5f7] border border-[#e5e5ea] shrink-0  flex items-center justify-center">
                        <img
                          src={selectedClinic.avatarUrl ? getFileUrl(selectedClinic.avatarUrl) : clinicLobbyBg}
                          alt={selectedClinic.clinicName}
                          className="w-full h-full object-cover object-center"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = clinicLobbyBg;
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug truncate mb-1.5">
                          {selectedClinic.clinicName}
                        </h2>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#86868b]">
                          <span className="inline-flex items-center gap-1.5 font-normal text-[#48484a]">
                            <MapPin className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />
                            <span className="truncate max-w-xs sm:max-w-md font-normal">
                              {getClinicLocationDisplay(selectedClinic)}
                            </span>
                          </span>
                          {selectedClinic.phone && (
                            <a
                              href={`tel:${selectedClinic.phone}`}
                              className="inline-flex items-center gap-1.5 font-normal text-[#48484a] hover:text-[#0066cc] transition-colors"
                            >
                              <Phone className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />
                              <span className="font-normal">{formatDisplayPhone(selectedClinic.phone)}</span>
                            </a>
                          )}
                          <span className="inline-flex items-center text-[11px] px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f] font-normal border border-[#e5e5ea]">
                            {clinicPracticingDoctors.length} {clinicPracticingDoctors.length === 1 ? 'Specialist' : 'Specialists'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearClinic}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-xs font-semibold text-[#1d1d1f] transition-all cursor-pointer self-start sm:self-center shrink-0 border border-[#e5e5ea]"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>All Clinics</span>
                    </button>
                  </div>
                </div>

                {/* Practicing Doctors Section */}
                <div>
                  <div className="mb-6">
                    <h3 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                      Doctors at this clinic
                    </h3>
                  </div>

                  {clinicPracticingDoctors.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-[#e5e5ea] p-12 text-center max-w-md mx-auto ">
                      <h4 className="text-base font-semibold text-[#1d1d1f] mb-1">
                        No doctors listed
                      </h4>
                      <p className="text-xs text-[#86868b] mb-5">
                        This clinic has no doctors yet.
                      </p>
                      <AppleButton variant="secondary" size="sm" onClick={handleClearClinic}>
                        Back to Clinics
                      </AppleButton>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fill,minmax(320px,1fr))] gap-4 sm:gap-6 w-full">
                      {clinicPracticingDoctors.map((docItem) => {
                        const doctor = docItem.doctor;
                        const slots = parseDoctorSlots({
                          ...doctor,
                          slots: docItem.slots || doctor.slots,
                        });
                        const effectiveFee = docItem.consultationFee ?? doctor.consultationFee;
                        const cleanDegrees = formatDoctorDegrees(doctor.qualifications);

                        return (
                          <div
                            key={doctor.id}
                            className="w-full bg-white rounded-2xl border border-[#e5e5ea]  overflow-hidden hover:border-primary-line hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group"
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
                                    const fallback = e.currentTarget.parentElement?.querySelector('.doc-fallback-banner');
                                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div
                                className={`doc-fallback-banner w-full h-full ${
                                  doctor.user?.avatarUrl ? 'hidden' : 'flex'
                                } items-center justify-center font-semibold text-[44px] text-primary/40 bg-gradient-to-br from-[#eef4fc] to-[#f5f5f7] select-none`}
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

                                {/* Shift Timing: Bold, Clear Apple Row */}
                                <div className="mt-3.5 space-y-2 text-xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Clock className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                                    <span className="truncate text-[#48484a] font-normal tracking-tight">
                                      {slots.length > 0
                                        ? `${format12Hour(slots[0].startTime)} – ${format12Hour(slots[0].endTime)}`
                                        : doctor.checkingStartTime
                                        ? `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`
                                        : 'Consultation hours'}
                                    </span>
                                    {slots.length > 1 && (
                                      <span className="text-[11px] font-normal text-[#0066cc] bg-[#0066cc]/8 px-2 py-0.5 rounded-full border border-[#0066cc]/15 shrink-0 select-none">
                                        +{slots.length - 1} slots
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Card Footer: Fee & Apple Action Blue Pill Button */}
                              <div className="mt-4 pt-3.5 border-t border-[#f0f0f2] flex items-center justify-between gap-3">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-[21px] font-semibold text-[#1d1d1f] tracking-tight">
                                    ₹{effectiveFee.toFixed(0)}
                                  </span>
                                  <span className="text-xs text-[#86868b] font-normal">/ visit</span>
                                </div>

                                {docItem.hasReceptionist === false ? (
                                  <span
                                    className="h-8 px-3.5 rounded-full text-[11px] font-normal text-[#86868b] bg-[#f5f5f7] border border-[#e5e5ea] inline-flex items-center justify-center select-none"
                                    title="Online booking is closed at this clinic for now."
                                  >
                                    Closed
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => navigate(getDoctorBookPath(doctor.id, selectedClinic.id, slots[0]?.id))}
                                    className="h-8 min-w-[78px] px-5 rounded-full text-xs font-normal text-white bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.97] transition-all duration-150 ease-out cursor-pointer select-none  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc]/40 inline-flex items-center justify-center"
                                  >
                                    Book
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* If no clinic is selected, show list of verified clinics */
              <div className="space-y-6">
                {/* Clinics Cards Grid */}
                {loadingClinics ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fill,minmax(320px,1fr))] gap-4 sm:gap-6 w-full">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div
                        key={i}
                        className="h-72 rounded-2xl bg-white border border-[#e5e5ea] animate-pulse p-4"
                      />
                    ))}
                  </div>
                ) : filteredClinics.length === 0 ? (
                  <EmptyState
                    icon={Building2}
                    title="No clinics found"
                    description="No clinics match your search."
                    actionText="Reset Filters"
                    onAction={resetClinicFilters}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fill,minmax(320px,1fr))] gap-4 sm:gap-6 w-full">
                    {filteredClinics.map((clinic) => {
                      const docCount = (clinic.doctors && Array.isArray(clinic.doctors))
                        ? clinic.doctors.length
                        : (clinic._count?.doctors ?? 0);
                      const locationDisplay = getClinicLocationDisplay(clinic);

                      return (
                        <div
                          key={clinic.id}
                          onClick={() => handleSelectClinic(clinic)}
                          className="w-full bg-white rounded-2xl border border-[#e5e5ea]  overflow-hidden hover:border-primary-line hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
                        >
                          {/* Top Facility Photography Banner */}
                          <div className="relative w-full aspect-[16/10] bg-[#f5f5f7] border-b border-[#f0f0f2] overflow-hidden flex items-center justify-center">
                            <img
                              src={clinic.avatarUrl ? getFileUrl(clinic.avatarUrl) : clinicLobbyBg}
                              alt={clinic.clinicName}
                              className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = clinicLobbyBg;
                              }}
                            />
                            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />
                            {clinic.city && (
                              <span className="absolute left-3 bottom-3 inline-flex items-center gap-1 h-7 px-3 rounded-full bg-white/90 backdrop-blur-md text-[11px] font-semibold text-[#1d1d1f]">
                                <MapPin className="w-3 h-3 text-primary" />
                                {clinic.city}
                              </span>
                            )}
                          </div>

                          {/* Card Body */}
                          <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                            <div>
                              {/* Clinic Name */}
                              <h3
                                className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight leading-snug group-hover:text-[#0066cc] transition-colors truncate"
                                title={clinic.clinicName}
                              >
                                {clinic.clinicName}
                              </h3>

                              {/* Location & Contact Info */}
                              <div className="mt-2.5 space-y-1.5">
                                <p className="flex items-start gap-2 text-xs text-[#48484a] font-normal leading-snug">
                                  <MapPin className="w-3.5 h-3.5 text-[#86868b] shrink-0 mt-0.5" />
                                  <span className="line-clamp-2 font-normal text-[#48484a]">
                                    {locationDisplay}
                                  </span>
                                </p>
                                {clinic.phone && (
                                  <p className="flex items-center gap-2 text-xs text-[#48484a] font-normal leading-snug">
                                    <Phone className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                                    <span className="font-normal text-[#48484a]">{formatDisplayPhone(clinic.phone)}</span>
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Apple HIG Card Footer */}
                            <div className="mt-4 pt-3.5 border-t border-[#f0f0f2] flex items-center justify-between gap-3">
                              <span className="inline-flex items-center gap-1.5 text-xs text-[#48484a]">
                                <Stethoscope className="w-3.5 h-3.5 text-primary" />
                                {docCount === 1 ? '1 doctor' : `${docCount} doctors`}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectClinic(clinic);
                                }}
                                className="h-9 pl-4 pr-3.5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-normal transition-all duration-150 active:scale-[0.97] inline-flex items-center justify-center gap-1 cursor-pointer select-none"
                              >
                                View doctors
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
  );
};
