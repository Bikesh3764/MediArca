import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { api, Doctor, parseDoctorSlots, format12Hour, formatDoctorDegrees, getFileUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { AppleButton } from '../../components/ui/AppleButton';
import { SubNav } from '../../components/layout/SubNav';
import {
  Clock,
  Calendar,
  Stethoscope,
  User as UserIcon,
  RefreshCw,
  Building2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  RotateCcw,
  X,
  Search,
} from 'lucide-react';

import { SearchableSpecialtySelect } from '../../components/ui/SearchableSpecialtySelect';

interface DoctorDiscoveryProps {
  isPortalView?: boolean;
}

export const DoctorDiscovery: React.FC<DoctorDiscoveryProps> = ({ isPortalView }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSpecialty = searchParams.get('specialty') || 'All';

  const isPatientPortal = Boolean(
    isPortalView ||
    user?.role === 'PATIENT' ||
    location.pathname.startsWith('/patient/')
  );

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState(initialSpecialty);
  const [sortBy, setSortBy] = useState('rating');
  const [minExp, setMinExp] = useState<number>(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const patientNavItems: DashboardNavItem[] = [
    {
      id: 'appointments',
      label: 'Live Queue & Passes',
      icon: Calendar,
      path: '/patient/appointments',
    },
    {
      id: 'find-doctors',
      label: 'Find Specialists',
      icon: Stethoscope,
      path: '/patient/doctors',
      active: true,
    },
    {
      id: 'profile',
      label: 'Patient Profile',
      icon: UserIcon,
      path: '/patient/profile',
    },
  ];

  const loadDoctors = async (queryText: string, specialtyFilter: string, sortOrder: string, expFilter = minExp) => {
    setLoading(true);
    try {
      const data = await api.getDoctors({
        search: queryText.trim() || undefined,
        specialty: specialtyFilter !== 'All' ? specialtyFilter : undefined,
        minExp: expFilter > 0 ? expFilter : undefined,
        sortBy: sortOrder,
      });
      setDoctors(data);
    } catch (err) {
      console.error('Failed to load doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  // Instant debounced search & filter sync
  useEffect(() => {
    const timer = setTimeout(() => {
      loadDoctors(search, selectedSpecialty, sortBy, minExp);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selectedSpecialty, sortBy, minExp]);

  const resetFilters = () => {
    setSearch('');
    setSelectedSpecialty('All');
    setMinExp(0);
    setSortBy('rating');
    setSearchParams({});
  };

  const hasActiveFilters = Boolean(
    selectedSpecialty !== 'All' ||
    search.trim() ||
    minExp > 0 ||
    sortBy !== 'rating'
  );

  const activeFilterCount =
    (selectedSpecialty !== 'All' ? 1 : 0) +
    (search.trim() ? 1 : 0) +
    (minExp > 0 ? 1 : 0) +
    (sortBy !== 'rating' ? 1 : 0);

  // Synchronize specialty filter when query param changes
  useEffect(() => {
    queueMicrotask(() => {
      const paramSpec = searchParams.get('specialty') || 'All';
      if (paramSpec !== selectedSpecialty) {
        setSelectedSpecialty(paramSpec);
      }
    });
  }, [searchParams, selectedSpecialty]);

  const getDoctorDetailPath = (doctorId: string) =>
    isPatientPortal ? `/patient/doctor/${doctorId}` : `/doctor/${doctorId}`;

  const getBookPath = (doctorId: string) =>
    isPatientPortal ? `/patient/book/${doctorId}` : `/book/${doctorId}`;

  const discoveryContent = (
    <div className="w-full space-y-6">
      {/* Mobile Filter Toggle Drawer */}
      <div className="lg:hidden">
        <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-3.5 shadow-xs">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] focus-within:border-[#0088e8] focus-within:bg-white transition-all">
              <Search className="w-4 h-4 text-[#86868b] flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search doctor or clinic..."
                className="w-full bg-transparent text-xs text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="text-[#86868b] hover:text-[#1d1d1f]">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                hasActiveFilters || mobileFiltersOpen
                  ? 'bg-[#0088e8] text-white border-[#0088e8] shadow-xs'
                  : 'bg-[#f5f5f7] text-[#1d1d1f] border-[#e5e5ea] hover:bg-[#ebebee]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-white text-[#0088e8] text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Mobile Expandable Filter Options */}
          {mobileFiltersOpen && (
            <div className="pt-4 mt-3 border-t border-[#f0f0f2] space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#48484a] mb-1">
                  Medical Specialty
                </label>
                <SearchableSpecialtySelect
                  value={selectedSpecialty}
                  onChange={(spec) => {
                    setSelectedSpecialty(spec);
                    setSearchParams(spec === 'All' ? {} : { specialty: spec });
                  }}
                  variant="form"
                  includeAll={true}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#48484a] mb-1">
                    Min Experience
                  </label>
                  <select
                    value={minExp}
                    onChange={(e) => setMinExp(Number(e.target.value))}
                    className="w-full py-2 px-3 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] text-xs font-medium text-[#1d1d1f] focus:outline-none focus:border-[#0088e8] cursor-pointer"
                  >
                    <option value={0}>All Experience</option>
                    <option value={5}>5+ Years</option>
                    <option value={10}>10+ Years</option>
                    <option value={15}>15+ Years</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#48484a] mb-1">
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] text-xs font-medium text-[#1d1d1f] focus:outline-none focus:border-[#0088e8] cursor-pointer"
                  >
                    <option value="rating">Recommended</option>
                    <option value="experience">Most Experienced</option>
                    <option value="fee_low">Fee: Low to High</option>
                    <option value="fee_high">Fee: High to Low</option>
                  </select>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="w-full py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset All Filters</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Desktop Layout: Left Sidebar + Right Results Grid */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start w-full">
        {/* LEFT SIDEBAR: Sticky Filters on Desktop */}
        <aside className="hidden lg:block w-72 xl:w-80 flex-shrink-0 lg:sticky lg:top-24 space-y-4">
          <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-[#f0f0f2]">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#0088e8]" />
                <h3 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">Filters & Refine</h3>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-full border border-rose-200/70 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Search Doctor or Keyword */}
            <div>
              <label className="block text-xs font-semibold text-[#48484a] mb-1.5">
                Doctor or Keyword
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] focus-within:border-[#0088e8] focus-within:ring-2 focus-within:ring-[#0088e8]/20 focus-within:bg-white transition-all">
                <Search className="w-4 h-4 text-[#86868b] flex-shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search doctor or clinic..."
                  className="w-full bg-transparent text-xs text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="text-[#86868b] hover:text-[#1d1d1f]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Specialty Select */}
            <div>
              <label className="block text-xs font-semibold text-[#48484a] mb-1.5">
                Medical Specialty
              </label>
              <SearchableSpecialtySelect
                value={selectedSpecialty}
                onChange={(spec) => {
                  setSelectedSpecialty(spec);
                  setSearchParams(spec === 'All' ? {} : { specialty: spec });
                }}
                variant="form"
                includeAll={true}
                placeholder="Select specialty..."
              />
            </div>

            {/* Experience Buttons */}
            <div>
              <label className="block text-xs font-semibold text-[#48484a] mb-1.5">
                Experience
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'All', value: 0 },
                  { label: '5+ Yrs', value: 5 },
                  { label: '10+ Yrs', value: 10 },
                  { label: '15+ Yrs', value: 15 },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setMinExp(item.value)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                      minExp === item.value
                        ? 'bg-[#0088e8] text-white border-[#0088e8] shadow-xs'
                        : 'bg-[#f5f5f7] text-[#48484a] border-[#e5e5ea] hover:bg-[#ebebee]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-xs font-semibold text-[#48484a] mb-1.5">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full py-2 px-3 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] text-xs font-medium text-[#1d1d1f] focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20 cursor-pointer"
              >
                <option value="rating">Recommended</option>
                <option value="experience">Most Experienced</option>
                <option value="fee_low">Fee: Low to High</option>
                <option value="fee_high">Fee: High to Low</option>
              </select>
            </div>
          </div>
        </aside>

        {/* RIGHT MAIN AREA: Results Header + Doctor Cards Grid */}
        <div className="flex-1 w-full min-w-0">
          <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#e5e5ea] p-4 sm:p-5 mb-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-[#1d1d1f] tracking-tight">
                {selectedSpecialty === 'All' ? 'Verified Specialists' : `${selectedSpecialty} Specialists`}
              </h2>
              <p className="text-xs text-[#86868b] mt-0.5">
                Showing {doctors.length} available medical practitioner{doctors.length === 1 ? '' : 's'}
              </p>
            </div>

            {/* Active Filter Chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedSpecialty !== 'All' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0088e8]/10 text-[#0088e8] text-xs font-medium border border-[#0088e8]/20">
                    {selectedSpecialty}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSpecialty('All');
                        setSearchParams({});
                      }}
                      className="hover:opacity-75 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {minExp > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0088e8]/10 text-[#0088e8] text-xs font-medium border border-[#0088e8]/20">
                    {minExp}+ Yrs
                    <button type="button" onClick={() => setMinExp(0)} className="hover:opacity-75 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Doctor Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5 sm:gap-6 w-full">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-72 rounded-[28px] bg-white border border-[#e5e5ea] animate-pulse p-7"></div>
              ))}
            </div>
          ) : doctors.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-[20px] border border-[#e5e5ea] shadow-sm max-w-lg mx-auto">
              <p className="text-base font-semibold text-[#1d1d1f]">No doctors found matching your criteria.</p>
              <p className="text-xs text-[#86868b] mt-1">Try clearing your search term or selecting 'All' specialties.</p>
              <AppleButton
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="mt-5"
              >
                Reset All Filters
              </AppleButton>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5 sm:gap-6 w-full">
          {doctors.map((doctor) => {
            const slots = parseDoctorSlots(doctor);
            const cleanDegrees = formatDoctorDegrees(doctor.qualifications);
            const primaryClinic = doctor.clinics?.find((c) => c?.clinic)?.clinic || null;
            const hasClinics = Boolean(primaryClinic);

            return (
              <div
                key={doctor.id}
                className="w-full bg-white rounded-[26px] sm:rounded-[28px] border border-[#e5e5ea] overflow-hidden hover:shadow-[0_16px_44px_rgba(0,0,0,0.08)] hover:border-[#0088e8]/30 transition-all duration-300 flex flex-col justify-between group"
              >
                {/* 1. Full-Width Doctor Photo Banner at Top */}
                <div
                  onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                  className="relative w-full h-56 sm:h-64 bg-white border-b border-[#f0f0f2] overflow-hidden cursor-pointer flex items-center justify-center p-2.5 sm:p-3"
                >
                  {doctor.user?.avatarUrl ? (
                    <img
                      src={getFileUrl(doctor.user.avatarUrl)}
                      alt={doctor.user?.fullName || 'Doctor'}
                      className="w-full h-full object-contain object-center transition-transform duration-500 group-hover:scale-[1.03]"
                      loading="eager"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.doc-fallback-banner');
                        if (fallback) (fallback as HTMLElement).style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className={`doc-fallback-banner w-full h-full ${doctor.user?.avatarUrl ? 'hidden' : 'flex'} items-center justify-center font-bold text-5xl text-white bg-gradient-to-br from-[#0088e8] to-[#0066cc] select-none`}
                  >
                    {(doctor.user?.fullName ? doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] : null) || 'D'}
                  </div>

                  {/* Floating Specialty Badge on Top Right */}
                  <div className="absolute top-3.5 right-3.5 z-20">
                    <span className="backdrop-blur-md bg-white/95 text-[#0088e8] text-xs font-semibold px-3 py-1 rounded-full border border-black/5 shadow-xs">
                      {doctor.specialty}
                    </span>
                  </div>
                </div>

                {/* 2. Doctor Details Flowing Down Lengthwise */}
                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                  {/* Doctor Name, Qualifications & Experience */}
                  <div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <h3
                        onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                        className="text-lg sm:text-xl font-bold text-[#1d1d1f] hover:text-[#0088e8] cursor-pointer tracking-tight transition-colors line-clamp-1"
                        title={doctor.user?.fullName || 'Doctor'}
                      >
                        {doctor.user?.fullName || 'Doctor'}
                      </h3>
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#0088e8] fill-[#0088e8]/10 shrink-0" />
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-[#86868b]">
                      <span>{doctor.experienceYears} yrs experience</span>
                      {cleanDegrees && (
                        <>
                          <span className="text-[#d1d1d6]">•</span>
                          <span className="text-[#48484a] font-normal truncate">{cleanDegrees}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Practice Venue & Shift Timing */}
                  <div className="mt-4 pt-3.5 border-t border-[#f0f0f2] flex flex-col gap-2 text-xs sm:text-sm">
                    {/* Practice Venue */}
                    <div className="flex items-center gap-2 text-[#48484a] min-w-0">
                      <Building2 className="w-4 h-4 text-[#86868b] shrink-0" />
                      {hasClinics && primaryClinic ? (
                        <span
                          className="font-medium text-[#1d1d1f] truncate"
                          title={`${primaryClinic.clinicName}${primaryClinic.city ? ` • ${primaryClinic.city}` : ''}`}
                        >
                          {primaryClinic.clinicName}
                          {primaryClinic.city ? ` • ${primaryClinic.city}` : ''}
                          {(doctor.clinics?.length ?? 0) > 1 && (
                            <span className="text-[#0088e8] font-normal ml-1">
                              (+{(doctor.clinics?.length ?? 0) - 1} more)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          No Clinic Associated
                        </span>
                      )}
                    </div>

                    {/* Shift Timing */}
                    <div className="flex items-center gap-2 text-[#86868b] min-w-0">
                      <Clock className="w-4 h-4 text-[#86868b] shrink-0" />
                      <span className="font-normal truncate">
                        {slots.length > 0
                          ? `${format12Hour(slots[0].startTime)} – ${format12Hour(slots[0].endTime)}`
                          : doctor.checkingStartTime
                          ? `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`
                          : 'Outpatient Shift'}
                        {slots.length > 1 && (
                          <span className="text-[#86868b] font-normal ml-1">
                            ({slots.length} shifts)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* 3. Bottom Section: Consultation Fee & Action CTA */}
                  <div className="mt-5 pt-3.5 border-t border-[#f0f0f2] flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[#86868b]">Consultation</span>
                      <span className="text-xl sm:text-2xl font-bold text-[#1d1d1f] tracking-tight">
                        ₹{doctor.consultationFee.toFixed(0)}
                      </span>
                    </div>

                    <div>
                      {hasClinics ? (
                        <AppleButton
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(getBookPath(doctor.id))}
                          className="text-xs sm:text-sm px-5 py-2.5 rounded-full flex items-center gap-1.5 font-semibold shadow-xs hover:shadow-apple-button active:scale-[0.98] transition-all bg-[#0088e8] hover:bg-[#0077cc] text-white"
                        >
                          <span>Book Token</span>
                          <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </AppleButton>
                      ) : (
                        <AppleButton
                          variant="secondary"
                          size="sm"
                          disabled
                          className="text-xs sm:text-sm px-4 py-2.5 rounded-full opacity-60 cursor-not-allowed bg-[#f5f5f7] border border-[#e5e5ea] text-[#86868b] font-medium"
                        >
                          <span>Unavailable</span>
                        </AppleButton>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
        </div>
      </div>
    </div>
  );

  if (isPatientPortal) {
    return (
      <DashboardLayout
        portalType="PATIENT"
        portalSubtitle="PATIENT PORTAL"
        navItems={patientNavItems}
        title="Find Specialists"
        subtitle="Browse verified practitioners, compare checking shifts, and book instant queue tokens"
        headerAction={
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full bg-[#f5f5f7] text-[#1d1d1f] font-medium border border-[#e5e5ea]">
              {doctors.length} Specialist{doctors.length === 1 ? '' : 's'}
            </span>
            <AppleButton
              variant="ghost"
              size="sm"
              onClick={() => loadDoctors(search, selectedSpecialty, sortBy)}
              className="flex items-center gap-1.5 text-xs text-[#48484a]"
              title="Refresh doctor listings"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0088e8]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </AppleButton>
          </div>
        }
      >
        <div className="w-full space-y-6">
          {discoveryContent}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav title="Doctor Directory" subtitle="Verified healthcare practitioners">
        <span className="text-xs text-[#86868b] font-medium">
          {doctors.length} Verified Specialist{doctors.length === 1 ? '' : 's'}
        </span>
      </SubNav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {discoveryContent}
      </div>
    </div>
  );
};
