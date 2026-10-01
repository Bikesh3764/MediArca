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
  CheckCircle2,
  SlidersHorizontal,
  RotateCcw,
  X,
  Search,
  MapPin,
} from 'lucide-react';

import { SearchableSpecialtySelect } from '../../components/ui/SearchableSpecialtySelect';
import { INDIAN_STATES, getCitiesForState } from '../../utils/indiaStates';

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
  const [allCatalogDoctors, setAllCatalogDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState(initialSpecialty);
  const [selectedState, setSelectedState] = useState('All');
  const [selectedCity, setSelectedCity] = useState('All');
  const [maxFee, setMaxFee] = useState<number>(3000);
  const [sortBy, setSortBy] = useState('rating');
  const [minExp, setMinExp] = useState<number>(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const availableCities = useMemo(() => {
    if (selectedState !== 'All') {
      return getCitiesForState(selectedState);
    }
    const citiesFromDocs = new Set<string>();
    const source = allCatalogDoctors.length > 0 ? allCatalogDoctors : doctors;
    source.forEach((d) => {
      d.clinics?.forEach((c) => {
        if (c.clinic?.city) citiesFromDocs.add(c.clinic.city.trim());
      });
    });
    return Array.from(citiesFromDocs).sort((a, b) => a.localeCompare(b));
  }, [selectedState, allCatalogDoctors, doctors]);

  const handleStateChange = (newState: string) => {
    setSelectedState(newState);
    setSelectedCity('All');
  };


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

  const loadDoctors = async (
    queryText: string,
    specialtyFilter: string,
    sortOrder: string,
    expFilter = minExp,
    feeCap = maxFee,
    stateFilter = selectedState,
    cityFilter = selectedCity
  ) => {
    setLoading(true);
    try {
      const data = await api.getDoctors({
        search: queryText.trim() || undefined,
        specialty: specialtyFilter !== 'All' ? specialtyFilter : undefined,
        minExp: expFilter > 0 ? expFilter : undefined,
        maxFee: feeCap < 3000 ? feeCap : undefined,
        sortBy: sortOrder,
        state: stateFilter !== 'All' ? stateFilter : undefined,
        city: cityFilter !== 'All' ? cityFilter : undefined,
      });
      setDoctors(data);
      if (specialtyFilter === 'All' && !queryText.trim() && expFilter === 0 && feeCap >= 3000 && stateFilter === 'All' && cityFilter === 'All') {
        setAllCatalogDoctors(data);
      }
    } catch (err) {
      console.error('Failed to load doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load full catalog once for persistent global specialty counts
  useEffect(() => {
    api.getDoctors({}).then((data) => {
      setAllCatalogDoctors(data);
    }).catch(() => {});
  }, []);

  // Instant debounced search & filter sync
  useEffect(() => {
    const timer = setTimeout(() => {
      loadDoctors(search, selectedSpecialty, sortBy, minExp, maxFee, selectedState, selectedCity);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selectedSpecialty, sortBy, minExp, maxFee, selectedState, selectedCity]);

  // Specialty counts computed against unfiltered doctors catalog
  const specialtyCounts = useMemo(() => {
    const source = allCatalogDoctors.length > 0 ? allCatalogDoctors : doctors;
    const counts: Record<string, number> = { All: source.length };
    ALL_SPECIALTIES.forEach((s) => {
      counts[s] = source.filter((d) => d.specialty.toLowerCase() === s.toLowerCase()).length;
    });
    return counts;
  }, [allCatalogDoctors, doctors]);

  // Client-side location filtering, state filtering, and fee guard
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      if (locationQuery.trim()) {
        const lq = locationQuery.toLowerCase();
        const matchesClinic = doc.clinicAddress?.toLowerCase().includes(lq);
        const matchesAffiliated = doc.clinics?.some((c) =>
          c.clinic.address.toLowerCase().includes(lq) ||
          c.clinic.city?.toLowerCase().includes(lq) ||
          c.clinic.state?.toLowerCase().includes(lq) ||
          c.clinic.clinicName.toLowerCase().includes(lq)
        );
        if (!matchesClinic && !matchesAffiliated) return false;
      }
      if (selectedState !== 'All') {
        const sLower = selectedState.toLowerCase();
        const matchesState =
          doc.clinics?.some((c) => c.clinic?.state?.toLowerCase() === sLower) ||
          doc.clinicAddress?.toLowerCase().includes(sLower);
        if (!matchesState) return false;
      }
      if (selectedCity !== 'All') {
        const cLower = selectedCity.toLowerCase();
        const matchesCity =
          doc.clinics?.some((c) => c.clinic?.city?.toLowerCase() === cLower) ||
          doc.clinicAddress?.toLowerCase().includes(cLower);
        if (!matchesCity) return false;
      }
      if (maxFee < 3000 && doc.consultationFee > maxFee) return false;
      return true;
    });
  }, [doctors, locationQuery, maxFee, selectedState, selectedCity]);

  const resetFilters = () => {
    setSearch('');
    setLocationQuery('');
    setSelectedSpecialty('All');
    setSelectedState('All');
    setSelectedCity('All');
    setMaxFee(3000);
    setMinExp(0);
    setSortBy('rating');
    setSearchParams({});
  };

  const hasActiveFilters = Boolean(
    selectedSpecialty !== 'All' ||
    selectedState !== 'All' ||
    selectedCity !== 'All' ||
    search.trim() ||
    locationQuery.trim() ||
    maxFee < 3000 ||
    minExp > 0 ||
    sortBy !== 'rating'
  );

  const activeFilterCount =
    (selectedSpecialty !== 'All' ? 1 : 0) +
    (selectedState !== 'All' ? 1 : 0) +
    (selectedCity !== 'All' ? 1 : 0) +
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

              {/* State Filter */}
              <div>
                <label className="block text-xs font-semibold text-[#48484a] mb-1">
                  State
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => handleStateChange(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] text-xs font-medium text-[#1d1d1f] focus:outline-none focus:border-[#0088e8] cursor-pointer"
                >
                  <option value="All">All States</option>
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* City Filter */}
              <div>
                <label className="block text-xs font-semibold text-[#48484a] mb-1">
                  City
                </label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] text-xs font-medium text-[#1d1d1f] focus:outline-none focus:border-[#0088e8] cursor-pointer"
                >
                  <option value="All">
                    {selectedState !== 'All' ? `All Cities in ${selectedState}` : 'All Cities'}
                  </option>
                  {availableCities.map((ct) => (
                    <option key={ct} value={ct}>
                      {ct}
                    </option>
                  ))}
                </select>
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
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-5 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#f0f0f2]">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#0088e8]" />
                <h3 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">Filters</h3>
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

            {/* Search Doctor or Clinic */}
            <div>
              <label className="block text-xs font-medium text-[#86868b] mb-1.5">
                Search
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] focus-within:border-[#0088e8] focus-within:ring-2 focus-within:ring-[#0088e8]/20 focus-within:bg-white transition-all">
                <Search className="w-4 h-4 text-[#86868b] flex-shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Doctor, clinic, keyword..."
                  className="w-full bg-transparent text-xs text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="text-[#86868b] hover:text-[#1d1d1f]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* State Filter */}
            <div>
              <label className="block text-xs font-medium text-[#86868b] mb-1.5">
                State
              </label>
              <select
                value={selectedState}
                onChange={(e) => handleStateChange(e.target.value)}
                className="w-full py-2 px-3 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] text-xs font-medium text-[#1d1d1f] focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20 cursor-pointer"
              >
                <option value="All">All States</option>
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* City Filter */}
            <div>
              <label className="block text-xs font-medium text-[#86868b] mb-1.5">
                City
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full py-2 px-3 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] text-xs font-medium text-[#1d1d1f] focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20 cursor-pointer"
              >
                <option value="All">
                  {selectedState !== 'All' ? `All Cities in ${selectedState}` : 'All Cities'}
                </option>
                {availableCities.map((ct) => (
                  <option key={ct} value={ct}>
                    {ct}
                  </option>
                ))}
              </select>
            </div>

            {/* Specialty Select */}
            <div>
              <label className="block text-xs font-medium text-[#86868b] mb-1.5">
                Specialty
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
              <div className="flex items-center justify-between text-xs font-medium text-[#86868b] mb-1.5">
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
              <label className="block text-xs font-medium text-[#86868b] mb-1.5">
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
          </div>
        </aside>

        {/* RIGHT MAIN AREA: Results Header + Doctor Cards Grid */}
        <div className="flex-1 w-full min-w-0">
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-4 sm:p-5 mb-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg sm:text-xl font-bold text-[#1d1d1f] tracking-tight">
                {selectedSpecialty === 'All' ? 'Verified Specialists' : `${selectedSpecialty} Specialists`}
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#86868b]">
                {filteredDoctors.length}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
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
                  {selectedState !== 'All' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0088e8]/10 text-[#0088e8] text-xs font-medium border border-[#0088e8]/20">
                      {selectedState}
                      <button
                        type="button"
                        onClick={() => handleStateChange('All')}
                        className="hover:opacity-75 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {selectedCity !== 'All' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0088e8]/10 text-[#0088e8] text-xs font-medium border border-[#0088e8]/20">
                      {selectedCity}
                      <button
                        type="button"
                        onClick={() => setSelectedCity('All')}
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
                </div>
              )}

              {/* Desktop Sort Dropdown */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-[#86868b] font-medium hidden md:inline">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="py-1.5 px-3 rounded-full border border-[#e5e5ea] bg-[#f5f5f7] text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:border-[#0088e8] cursor-pointer"
                >
                  <option value="rating">Recommended</option>
                  <option value="experience">Most Experienced</option>
                  <option value="fee_low">Price: Low to High</option>
                  <option value="fee_high">Price: High to Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Doctor Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 w-full">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-64 rounded-[20px] bg-white border border-[#e5e5ea] animate-pulse p-5"></div>
              ))}
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-[20px] border border-[#e5e5ea] shadow-xs max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-full bg-[#f5f5f7] text-[#86868b] flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 text-[#86868b]" />
              </div>
              <p className="text-base font-semibold text-[#1d1d1f]">No doctors found matching your criteria</p>
              <p className="text-xs text-[#86868b] mt-1">Try adjusting your filters or search terms</p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 h-9 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f] text-xs font-semibold border border-[#e5e5ea] transition-all cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 w-full">
              {filteredDoctors.map((doctor) => {
                const slots = parseDoctorSlots(doctor);
                const cleanDegrees = formatDoctorDegrees(doctor.qualifications);
                const primaryClinic = doctor.clinics?.find((c) => c?.clinic)?.clinic || null;
                const hasClinics = Boolean(primaryClinic);

                // Extract all unique clinic cities for this doctor
                const affiliatedClinics = doctor.clinics?.map((c) => c?.clinic).filter(Boolean) || [];
                const uniqueCities = Array.from(
                  new Set(
                    affiliatedClinics
                      .map((c) => c?.city?.trim())
                      .filter((city): city is string => Boolean(city && city.length > 0))
                  )
                );
                if (uniqueCities.length === 0 && doctor.clinicAddress) {
                  const fallbackCity = doctor.clinicAddress.split(',').pop()?.trim();
                  if (fallbackCity) uniqueCities.push(fallbackCity);
                }
                const displayCity = uniqueCities[0] || '';
                const extraCitiesCount = uniqueCities.length > 1 ? uniqueCities.length - 1 : 0;
                const clinicLocationLabel = displayCity
                  ? extraCitiesCount > 0
                    ? `${displayCity} (+${extraCitiesCount})`
                    : displayCity
                  : '';

                const locationStrings = affiliatedClinics
                  .map((c) => [c?.city?.trim(), c?.state?.trim()].filter(Boolean).join(', '))
                  .filter((s) => s.length > 0);
                const allCitiesTooltip = locationStrings.length > 0
                  ? `Practicing in: ${Array.from(new Set(locationStrings)).join(' • ')}`
                  : uniqueCities.length > 0
                  ? `Practicing in: ${uniqueCities.join(', ')}`
                  : 'Clinic practice';

                return (
                  <div
                    key={doctor.id}
                    className="w-full bg-white rounded-[20px] border border-[#e5e5ea] overflow-hidden shadow-xs hover:shadow-md hover:border-[#0088e8]/30 transition-all duration-200 flex flex-col justify-between group"
                  >
                    {/* 1. Doctor Top Photo Banner */}
                    <div
                      onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                      className="relative w-full aspect-[16/10] bg-gradient-to-b from-[#f5f5f7] to-[#e5e5ea] border-b border-[#e5e5ea] overflow-hidden cursor-pointer flex items-center justify-center"
                    >
                      {doctor.user?.avatarUrl ? (
                        <img
                          src={getFileUrl(doctor.user.avatarUrl)}
                          alt={doctor.user?.fullName || 'Doctor'}
                          className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
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
                        <span className="backdrop-blur-md bg-white/95 text-[#1d1d1f] text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-xs border border-white/80">
                          {doctor.specialty}
                        </span>
                      </div>

                      {/* Floating Clinic / City Badge on Bottom Right */}
                      {clinicLocationLabel && (
                        <div className="absolute bottom-2.5 right-2.5 z-10" title={allCitiesTooltip}>
                          <span className="backdrop-blur-md bg-white/95 text-[#1d1d1f] text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-xs border border-white/80 flex items-center gap-1 cursor-default">
                            <MapPin className="w-2.5 h-2.5 text-[#0088e8]" />
                            <span>{clinicLocationLabel}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 2. Doctor Details Flowing Down Lengthwise */}
                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Doctor Name, Qualifications & Experience */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3
                            onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                            className="text-base sm:text-[17px] font-bold text-[#1d1d1f] hover:text-[#0088e8] cursor-pointer tracking-tight transition-colors truncate"
                            title={doctor.user?.fullName || 'Doctor'}
                          >
                            {doctor.user?.fullName || 'Doctor'}
                          </h3>
                          <CheckCircle2 className="w-4 h-4 text-[#0088e8] shrink-0" />
                        </div>

                        <div className="mt-1 flex items-center gap-1.5 text-xs text-[#86868b] truncate">
                          <span className="font-semibold text-[#48484a]">{doctor.experienceYears} yrs exp</span>
                          {cleanDegrees && (
                            <>
                              <span className="text-[#d1d1d6]">•</span>
                              <span className="truncate" title={cleanDegrees}>
                                {cleanDegrees}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Clinical Venue & Shifts Details */}
                        <div className="mt-3.5 pt-3 border-t border-[#f5f5f7] space-y-2 text-xs">
                          {/* Primary Clinic */}
                          <div className="flex items-center gap-2 text-[#1d1d1f] min-w-0">
                            <Building2 className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                            {hasClinics && primaryClinic ? (
                              <span
                                className="font-medium truncate"
                                title={`${primaryClinic.clinicName}${primaryClinic.city ? ` • ${primaryClinic.city}` : ''}`}
                              >
                                {primaryClinic.clinicName}
                                {(doctor.clinics?.length ?? 0) > 1 && (
                                  <span className="text-[#0088e8] font-normal ml-1">
                                    (+{(doctor.clinics?.length ?? 0) - 1} clinics)
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-[#86868b]">Direct Practice</span>
                            )}
                          </div>

                          {/* Practice Hours / Shift */}
                          <div className="flex items-center gap-2 text-[#86868b] min-w-0">
                            <Clock className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                            <span className="truncate">
                              {slots.length > 0
                                ? `${format12Hour(slots[0].startTime)} – ${format12Hour(slots[0].endTime)}`
                                : doctor.checkingStartTime
                                ? `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`
                                : 'Outpatient Shift'}
                              {slots.length > 1 && (
                                <span className="text-[#86868b] ml-1">
                                  (+{slots.length - 1} shifts)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer: Fee & Booking CTA */}
                      <div className="mt-4 pt-3 border-t border-[#f5f5f7] flex items-center justify-between gap-3">
                        <div>
                          <span className="text-base font-bold text-[#1d1d1f]">
                            ₹{doctor.consultationFee.toFixed(0)}
                          </span>
                          <span className="text-xs text-[#86868b] ml-1">/ visit</span>
                        </div>

                        <div>
                          {hasClinics ? (
                            <button
                              type="button"
                              onClick={() => navigate(getBookPath(doctor.id))}
                              className="h-9 px-4 rounded-full bg-[#0088e8] hover:bg-[#0077cc] text-white text-xs font-semibold flex items-center gap-1 transition-all active:scale-[0.98] shadow-xs cursor-pointer"
                            >
                              <span>Book Token</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="h-9 px-4 rounded-full bg-[#f5f5f7] text-[#86868b] text-xs font-medium border border-[#e5e5ea] cursor-not-allowed"
                            >
                              Unavailable
                            </button>
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

      <div className="w-full max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8">
        {discoveryContent}
      </div>
    </div>
  );
};
