import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  api,
  Doctor,
  parseDoctorSlots,
  format12Hour,
  formatDoctorDegrees,
  getFileUrl,
  ALL_SPECIALTIES,
} from '../../services/api';
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
  MapPin,
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
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState(initialSpecialty);
  const [maxFee, setMaxFee] = useState<number>(3000);
  const [sortBy, setSortBy] = useState('rating');
  const [minExp, setMinExp] = useState<number>(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const quickCategories = useMemo(() => [
    'All',
    'Cardiology',
    'Dermatology',
    'Pediatrics',
    'Orthopedics',
    'General Medicine',
    'Neurology',
    'Dentistry',
    'Gynecology',
  ], []);

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

  const loadDoctors = async (queryText: string, specialtyFilter: string, sortOrder: string, expFilter = minExp, feeCap = maxFee) => {
    setLoading(true);
    try {
      const data = await api.getDoctors({
        search: queryText.trim() || undefined,
        specialty: specialtyFilter !== 'All' ? specialtyFilter : undefined,
        minExp: expFilter > 0 ? expFilter : undefined,
        maxFee: feeCap < 3000 ? feeCap : undefined,
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
      loadDoctors(search, selectedSpecialty, sortBy, minExp, maxFee);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selectedSpecialty, sortBy, minExp, maxFee]);

  // Specialty counts
  const specialtyCounts = useMemo(() => {
    const counts: Record<string, number> = { All: doctors.length };
    ALL_SPECIALTIES.forEach((s) => {
      counts[s] = doctors.filter((d) => d.specialty.toLowerCase() === s.toLowerCase()).length;
    });
    return counts;
  }, [doctors]);

  // Client-side location filtering and fee guard
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      if (locationQuery.trim()) {
        const lq = locationQuery.toLowerCase();
        const matchesClinic = doc.clinicAddress?.toLowerCase().includes(lq);
        const matchesAffiliated = doc.clinics?.some((c) =>
          c.clinic.address.toLowerCase().includes(lq) ||
          c.clinic.city?.toLowerCase().includes(lq) ||
          c.clinic.clinicName.toLowerCase().includes(lq)
        );
        if (!matchesClinic && !matchesAffiliated) return false;
      }
      if (maxFee < 3000 && doc.consultationFee > maxFee) return false;
      return true;
    });
  }, [doctors, locationQuery, maxFee]);

  const resetFilters = () => {
    setSearch('');
    setLocationQuery('');
    setSelectedSpecialty('All');
    setMaxFee(3000);
    setMinExp(0);
    setSortBy('rating');
    setSearchParams({});
  };

  const hasActiveFilters = Boolean(
    selectedSpecialty !== 'All' ||
    search.trim() ||
    locationQuery.trim() ||
    maxFee < 3000 ||
    minExp > 0 ||
    sortBy !== 'rating'
  );

  const activeFilterCount =
    (selectedSpecialty !== 'All' ? 1 : 0) +
    (search.trim() ? 1 : 0) +
    (locationQuery.trim() ? 1 : 0) +
    (maxFee < 3000 ? 1 : 0) +
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
      {/* Top Horizontal Category Filter Pills (Hoardspace style) */}
      <div className="border border-[#e5e5ea] bg-white rounded-2xl p-2.5 shadow-2xs">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
          {quickCategories.map((cat) => {
            const isActive = selectedSpecialty.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedSpecialty(cat);
                  setSearchParams(cat === 'All' ? {} : { specialty: cat });
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#0088e8] text-white shadow-xs'
                    : 'bg-[#f5f5f7] text-[#48484a] hover:bg-[#e5e5ea] hover:text-[#1d1d1f] border border-[#e5e5ea]'
                }`}
              >
                {cat === 'All' ? 'All Specialists' : cat}
              </button>
            );
          })}
        </div>
      </div>

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
              {/* Location Input */}
              <div>
                <label className="block text-xs font-semibold text-[#48484a] mb-1">
                  City or Location
                </label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] focus-within:border-[#0088e8] focus-within:bg-white transition-all">
                  <MapPin className="w-4 h-4 text-[#86868b] flex-shrink-0" />
                  <input
                    type="text"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    placeholder="Filter by city or address..."
                    className="w-full bg-transparent text-xs text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
                  />
                  {locationQuery && (
                    <button type="button" onClick={() => setLocationQuery('')} className="text-[#86868b] hover:text-[#1d1d1f]">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Specialty Select */}
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
                  counts={specialtyCounts}
                />
              </div>

              {/* Max Consultation Fee Slider */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-[#48484a] mb-1">
                  <span>Max Fee</span>
                  <span className="text-[#0088e8] font-bold">Up to ₹{maxFee}</span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="3000"
                  step="100"
                  value={maxFee}
                  onChange={(e) => setMaxFee(Number(e.target.value))}
                  className="w-full accent-[#0088e8] cursor-pointer"
                />
              </div>

              {/* Experience & Sort Grid */}
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
                    <option value="fee_low">Price: Low to High</option>
                    <option value="fee_high">Price: High to Low</option>
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
        <aside className="hidden lg:block w-64 xl:w-72 flex-shrink-0 lg:sticky lg:top-24 space-y-4">
          <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-5 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#f0f0f2]">
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

            {/* Location Input */}
            <div>
              <label className="block text-xs font-semibold text-[#48484a] mb-1.5">
                City or Location
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] focus-within:border-[#0088e8] focus-within:ring-2 focus-within:ring-[#0088e8]/20 focus-within:bg-white transition-all">
                <MapPin className="w-4 h-4 text-[#86868b] flex-shrink-0" />
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="Filter by city or address..."
                  className="w-full bg-transparent text-xs text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
                />
                {locationQuery && (
                  <button type="button" onClick={() => setLocationQuery('')} className="text-[#86868b] hover:text-[#1d1d1f]">
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
                counts={specialtyCounts}
                placeholder="Select specialty..."
              />
            </div>

            {/* Max Consultation Fee Slider */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#48484a] mb-1.5">
                <span>Max Fee</span>
                <span className="text-[#0088e8] font-bold">Up to ₹{maxFee}</span>
              </div>
              <input
                type="range"
                min="300"
                max="3000"
                step="100"
                value={maxFee}
                onChange={(e) => setMaxFee(Number(e.target.value))}
                className="w-full accent-[#0088e8] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#86868b] mt-0.5">
                <span>₹300</span>
                <span>₹3000</span>
              </div>
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
                <option value="fee_low">Price: Low to High</option>
                <option value="fee_high">Price: High to Low</option>
              </select>
            </div>
          </div>
        </aside>

        {/* RIGHT MAIN AREA: Results Header + 4-Column Doctor Cards Grid */}
        <div className="flex-1 w-full min-w-0">
          <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#e5e5ea] p-4 sm:p-5 mb-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#1d1d1f] tracking-tight">
                {selectedSpecialty === 'All' ? 'Verified Specialists' : `${selectedSpecialty} Specialists`}
              </h2>
              <p className="text-xs text-[#86868b] mt-0.5">
                Showing 1–{filteredDoctors.length} of {doctors.length} verified practitioners
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Active Filter Chips */}
              {hasActiveFilters && (
                <div className="hidden sm:flex flex-wrap items-center gap-1.5">
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
                  {maxFee < 3000 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0088e8]/10 text-[#0088e8] text-xs font-medium border border-[#0088e8]/20">
                      ≤ ₹{maxFee}
                      <button type="button" onClick={() => setMaxFee(3000)} className="hover:opacity-75 cursor-pointer">
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
                  {locationQuery && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0088e8]/10 text-[#0088e8] text-xs font-medium border border-[#0088e8]/20">
                      {locationQuery}
                      <button type="button" onClick={() => setLocationQuery('')} className="hover:opacity-75 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}

              {/* Desktop Sort Dropdown */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-[#86868b] font-medium hidden md:inline">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="py-1.5 px-3 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] text-xs font-medium text-[#1d1d1f] focus:outline-none focus:border-[#0088e8] cursor-pointer"
                >
                  <option value="rating">Recommended</option>
                  <option value="experience">Most Experienced</option>
                  <option value="fee_low">Price: Low to High</option>
                  <option value="fee_high">Price: High to Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Doctor Cards 4-Column Grid (Hoardspace style) */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 w-full">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-80 rounded-[22px] bg-white border border-[#e5e5ea] animate-pulse p-4"></div>
              ))}
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-[24px] border border-[#e5e5ea] shadow-xs max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-full bg-[#f5f5f7] text-[#86868b] flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 text-[#86868b]" />
              </div>
              <p className="text-base font-semibold text-[#1d1d1f]">No doctors found matching your criteria.</p>
              <p className="text-xs text-[#86868b] mt-1">Try clearing your filters or selecting 'All' specialties.</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 w-full">
              {filteredDoctors.map((doctor) => {
                const slots = parseDoctorSlots(doctor);
                const cleanDegrees = formatDoctorDegrees(doctor.qualifications);
                const primaryClinic = doctor.clinics?.find((c) => c?.clinic)?.clinic || null;
                const hasClinics = Boolean(primaryClinic);
                const clinicCity = primaryClinic?.city || doctor.clinicAddress?.split(',').pop()?.trim() || '';

                return (
                  <div
                    key={doctor.id}
                    className="w-full bg-white rounded-[20px] sm:rounded-[22px] border border-[#e5e5ea] overflow-hidden hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] hover:border-[#0088e8]/35 transition-all duration-300 flex flex-col justify-between group"
                  >
                    {/* 1. Full-Width Doctor Photo Banner with Floating Badges (Hoardspace Pattern) */}
                    <div
                      onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                      className="relative w-full aspect-[16/10] bg-[#f5f5f7] border-b border-[#f0f0f2] overflow-hidden cursor-pointer flex items-center justify-center"
                    >
                      {doctor.user?.avatarUrl ? (
                        <img
                          src={getFileUrl(doctor.user.avatarUrl)}
                          alt={doctor.user?.fullName || 'Doctor'}
                          className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                          loading="eager"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement?.querySelector('.doc-fallback-banner');
                            if (fallback) (fallback as HTMLElement).style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className={`doc-fallback-banner w-full h-full ${doctor.user?.avatarUrl ? 'hidden' : 'flex'} items-center justify-center font-bold text-4xl text-white bg-gradient-to-br from-[#0088e8] to-[#0066cc] select-none`}
                      >
                        {(doctor.user?.fullName ? doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] : null) || 'D'}
                      </div>

                      {/* Floating Specialty Badge on Bottom Left */}
                      <div className="absolute bottom-2.5 left-2.5 z-10">
                        <span className="backdrop-blur-md bg-black/65 text-white text-[11px] font-medium px-2.5 py-0.5 rounded-full shadow-xs">
                          {doctor.specialty}
                        </span>
                      </div>

                      {/* Floating Clinic / City Badge on Bottom Right */}
                      {clinicCity && (
                        <div className="absolute bottom-2.5 right-2.5 z-10">
                          <span className="backdrop-blur-md bg-black/65 text-white text-[11px] font-medium px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-[#0088e8]" />
                            <span>{clinicCity}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 2. Doctor Details Flowing Down Lengthwise */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      {/* Doctor Name, Qualifications & Experience */}
                      <div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3
                            onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                            className="text-base font-bold text-[#1d1d1f] hover:text-[#0088e8] cursor-pointer tracking-tight transition-colors truncate"
                            title={doctor.user?.fullName || 'Doctor'}
                          >
                            {doctor.user?.fullName || 'Doctor'}
                          </h3>
                          <CheckCircle2 className="w-4 h-4 text-[#0088e8] fill-[#0088e8]/10 shrink-0" />
                        </div>

                        <div className="mt-1 flex items-center gap-1.5 text-xs text-[#86868b] truncate">
                          <span>{doctor.experienceYears} yrs exp</span>
                          {cleanDegrees && (
                            <>
                              <span className="text-[#d1d1d6]">•</span>
                              <span className="text-[#48484a] font-normal truncate" title={cleanDegrees}>
                                {cleanDegrees}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Practice Venue & Shift Timing */}
                      <div className="mt-3 pt-2.5 border-t border-[#f0f0f2] space-y-1.5 text-xs">
                        {/* Practice Venue */}
                        <div className="flex items-center gap-1.5 text-[#48484a] min-w-0">
                          <Building2 className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                          {hasClinics && primaryClinic ? (
                            <span
                              className="font-medium text-[#1d1d1f] truncate"
                              title={`${primaryClinic.clinicName}${primaryClinic.city ? ` • ${primaryClinic.city}` : ''}`}
                            >
                              {primaryClinic.clinicName}
                              {(doctor.clinics?.length ?? 0) > 1 && (
                                <span className="text-[#0088e8] font-normal ml-1">
                                  (+{(doctor.clinics?.length ?? 0) - 1})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                              <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                              Direct Practice
                            </span>
                          )}
                        </div>

                        {/* Shift Timing */}
                        <div className="flex items-center gap-1.5 text-[#86868b] min-w-0">
                          <Clock className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                          <span className="font-normal truncate">
                            {slots.length > 0
                              ? `${format12Hour(slots[0].startTime)} – ${format12Hour(slots[0].endTime)}`
                              : doctor.checkingStartTime
                              ? `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`
                              : 'Outpatient Shift'}
                            {slots.length > 1 && (
                              <span className="text-[#86868b] font-normal ml-1">
                                (+{slots.length - 1})
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* 3. Bottom Section: Consultation Fee & Action CTA */}
                      <div className="mt-3.5 pt-2.5 border-t border-[#f0f0f2] flex items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Fee</span>
                          <span className="text-base sm:text-lg font-bold text-[#1d1d1f] tracking-tight">
                            ₹{doctor.consultationFee.toFixed(0)} <span className="text-[10px] font-normal text-[#86868b]">/ visit</span>
                          </span>
                        </div>

                        <div>
                          {hasClinics ? (
                            <AppleButton
                              variant="primary"
                              size="sm"
                              onClick={() => navigate(getBookPath(doctor.id))}
                              className="text-xs px-3.5 py-1.5 rounded-full flex items-center gap-1 font-semibold shadow-xs hover:shadow-apple-button active:scale-[0.98] transition-all bg-[#0088e8] hover:bg-[#0077cc] text-white"
                            >
                              <span>Book Token</span>
                              <ChevronRight className="w-3 h-3 stroke-[2.5]" />
                            </AppleButton>
                          ) : (
                            <AppleButton
                              variant="secondary"
                              size="sm"
                              disabled
                              className="text-xs px-3 py-1.5 rounded-full opacity-60 cursor-not-allowed bg-[#f5f5f7] border border-[#e5e5ea] text-[#86868b] font-medium"
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

      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {discoveryContent}
      </div>
    </div>
  );
};
