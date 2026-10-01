import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  api,
  Doctor,
  parseDoctorSlots,
  format12Hour,
  evaluateSlotStatus,
  getLocalDateString,
  formatDoctorDegrees,
  ALL_SPECIALTIES,
  getFileUrl,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AppleButton } from '../components/ui/AppleButton';
import { BrandLogo } from '../components/ui/BrandLogo';
import { SearchableSpecialtySelect } from '../components/ui/SearchableSpecialtySelect';
import healthcareHeroBg from '../assets/healthcare-hero-bg.jpg';
import {
  Search,
  MapPin,
  Clock,
  ArrowRight,
  Building2,
  UserCheck,
  Stethoscope,
  RotateCcw,
  ChevronRight,
  X,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';

export const Home: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [sortBy, setSortBy] = useState<'rating' | 'experience' | 'fee_low' | 'fee_high'>('rating');
  const [minExperience, setMinExperience] = useState<number>(0);
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'ACTIVE_NOW'>('ALL');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const data = await api.getDoctors();
        setDoctors(data);
      } catch (err) {
        console.error('Failed to load doctors:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, []);

  const role = user?.role?.toUpperCase();
  const isDoctor = role === 'DOCTOR';
  const isClinic = role === 'CLINIC';
  const isReceptionist = role === 'RECEPTIONIST';
  const isAdmin = role === 'ADMIN';

  // Compute specialty counts
  const specialtyCounts = useMemo(() => {
    const counts: Record<string, number> = { All: doctors.length };
    ALL_SPECIALTIES.forEach((s) => {
      counts[s] = doctors.filter((d) => d.specialty.toLowerCase() === s.toLowerCase()).length;
    });
    return counts;
  }, [doctors]);

  // Dynamic filter and sort
  const filteredDoctors = useMemo(() => {
    const todayStr = getLocalDateString();
    const now = new Date();

    return doctors
      .filter((doc) => {
        // Specialty Filter
        if (
          selectedSpecialty !== 'All' &&
          doc.specialty.toLowerCase() !== selectedSpecialty.toLowerCase()
        ) {
          return false;
        }

        // Search Query (Doctor name, qualifications, clinic address, bio, clinic names)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesName = doc.user.fullName.toLowerCase().includes(q);
          const matchesSpec = doc.specialty.toLowerCase().includes(q);
          const matchesQual = doc.qualifications?.toLowerCase().includes(q);
          const matchesClinic = doc.clinicAddress?.toLowerCase().includes(q);
          const matchesAffiliated = doc.clinics?.some((c) =>
            c.clinic.clinicName.toLowerCase().includes(q) ||
            c.clinic.address.toLowerCase().includes(q) ||
            c.clinic.city?.toLowerCase().includes(q)
          );
          if (!matchesName && !matchesSpec && !matchesQual && !matchesClinic && !matchesAffiliated) {
            return false;
          }
        }

        // Location Query
        if (locationQuery.trim()) {
          const lq = locationQuery.toLowerCase();
          const matchesClinic = doc.clinicAddress?.toLowerCase().includes(lq);
          const matchesAffiliated = doc.clinics?.some((c) =>
            c.clinic.address.toLowerCase().includes(lq) ||
            c.clinic.city?.toLowerCase().includes(lq) ||
            c.clinic.clinicName.toLowerCase().includes(lq)
          );
          if (!matchesClinic && !matchesAffiliated) {
            return false;
          }
        }

        // Experience Filter
        if (minExperience > 0 && doc.experienceYears < minExperience) {
          return false;
        }

        // Active Now Filter
        if (availabilityFilter === 'ACTIVE_NOW') {
          const slots = parseDoctorSlots(doc);
          const hasActiveSlot = slots.some((s) => {
            const status = evaluateSlotStatus(s, todayStr, 0, now);
            return status.isInProgress;
          });
          if (!hasActiveSlot) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'fee_low') return a.consultationFee - b.consultationFee;
        if (sortBy === 'fee_high') return b.consultationFee - a.consultationFee;
        if (sortBy === 'experience') return b.experienceYears - a.experienceYears;
        return (b.rating || 5) - (a.rating || 5);
      });
  }, [doctors, selectedSpecialty, searchQuery, locationQuery, minExperience, availabilityFilter, sortBy]);

  const resetFilters = () => {
    setSearchQuery('');
    setLocationQuery('');
    setSelectedSpecialty('All');
    setMinExperience(0);
    setAvailabilityFilter('ALL');
    setSortBy('rating');
  };

  const hasActiveFilters = Boolean(
    selectedSpecialty !== 'All' ||
    searchQuery.trim() ||
    locationQuery.trim() ||
    minExperience > 0 ||
    sortBy !== 'rating'
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedSpecialty !== 'All') count++;
    if (searchQuery.trim()) count++;
    if (locationQuery.trim()) count++;
    if (minExperience > 0) count++;
    if (sortBy !== 'rating') count++;
    return count;
  }, [selectedSpecialty, searchQuery, locationQuery, minExperience, sortBy]);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const catalogElement = document.getElementById('doctors-catalog');
    if (catalogElement) {
      catalogElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f5f7]">
      {/* 1. Hero Section - Search-Driven Apple Aesthetic with Healthcare Background */}
      <section className="relative overflow-hidden border-b border-[#e5e5ea] py-20 sm:py-28 md:py-32 lg:py-36 px-4 sm:px-6 min-h-[500px] sm:min-h-[560px] flex items-center justify-center">
        {/* Apple Healthcare Themed Hero Background - Crystal Clear & Crisp (No Milky Fog) */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          <img
            src={healthcareHeroBg}
            alt="Healthcare clinical setting"
            className="w-full h-full object-cover object-center filter saturate-[1.06] contrast-[1.06]"
          />
          {/* Subtle soft center backlight behind text to preserve razor-sharp photo visibility */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.28)_0%,transparent_65%)]" />
          {/* Subtle bottom edge blend into canvas */}
          <div className="absolute bottom-0 inset-x-0 h-16 sm:h-20 bg-gradient-to-t from-[#f5f5f7] to-transparent" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center w-full">
          {/* Role Aware Status Bar */}
          {user ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-md bg-white/90 border border-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.06)] text-xs font-semibold text-[#1d1d1f] mb-6">
              <BrandLogo variant="icon" size="xs" />
              <span>
                {user.fullName?.split(' ')[0] || user.fullName} •{' '}
                {isDoctor
                  ? 'Doctor Console'
                  : isClinic
                  ? 'Clinic Portal'
                  : isReceptionist
                  ? 'Reception Desk'
                  : isAdmin
                  ? 'Admin Portal'
                  : 'Patient Portal'}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-md bg-white/90 border border-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.06)] text-xs font-semibold text-[#1d1d1f] mb-6">
              <BrandLogo variant="icon" size="xs" />
              <span>Live Queue & Instant Booking</span>
            </div>
          )}

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-[#1d1d1f] tracking-tight leading-[1.1] mb-3 drop-shadow-[0_2px_12px_rgba(255,255,255,0.95)]">
            Find doctors. <span className="text-[#0088e8]">Book queue tokens.</span>
          </h1>

          <p className="text-sm sm:text-base text-[#1d1d1f] max-w-xl mx-auto mb-8 font-medium leading-relaxed drop-shadow-[0_1px_8px_rgba(255,255,255,0.95)]">
            Book live token passes, verify queue status in real-time, and skip clinic waiting rooms.
          </p>

          {/* Central Integrated Search Bar */}
          <form
            onSubmit={handleHeroSearch}
            className="backdrop-blur-2xl bg-white/95 sm:bg-white/90 p-2 sm:p-2.5 rounded-[24px] sm:rounded-full border border-white/90 sm:border-[#e5e5ea] shadow-[0_16px_48px_rgba(0,0,0,0.12)] max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-2 transition-all focus-within:border-[#0088e8] focus-within:shadow-[0_20px_50px_rgba(0,136,232,0.22)] focus-within:bg-white"
          >
            {/* Doctor or Keyword Input */}
            <div className="flex items-center gap-2.5 flex-1 w-full px-4 py-2 sm:py-0">
              <Search className="w-4 h-4 text-[#86868b] flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search doctor, condition, or clinic..."
                className="w-full bg-transparent text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
              />
            </div>

            <div className="hidden sm:block w-px h-6 bg-[#e5e5ea]"></div>

            {/* City / Location Input */}
            <div className="flex items-center gap-2.5 w-full sm:w-48 px-4 py-2 sm:py-0">
              <MapPin className="w-4 h-4 text-[#86868b] flex-shrink-0" />
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="City or location..."
                className="w-full bg-transparent text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
              />
            </div>

            <div className="hidden sm:block w-px h-6 bg-[#e5e5ea]"></div>

            {/* Specialty Selector Dropdown */}
            <div className="w-full sm:w-48 px-3 py-1 sm:py-0">
              <select
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-medium text-[#1d1d1f] focus:outline-none cursor-pointer py-1.5"
              >
                <option value="All">All Specialties</option>
                {ALL_SPECIALTIES.filter((s) => s !== 'Other').map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Button */}
            <AppleButton
              variant="primary"
              size="md"
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 rounded-full flex-shrink-0 font-medium active:scale-[0.98]"
            >
              Search Doctors
            </AppleButton>
          </form>
        </div>
      </section>

      {/* Explore Doctors Catalog - Responsive Layout with Left Filter Sidebar on Desktop */}
      <section id="doctors-catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1 w-full">
        {/* Mobile Filter Toggle Drawer */}
        <div className="lg:hidden mb-6">
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-3.5 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] focus-within:border-[#0088e8] focus-within:bg-white transition-all">
                <Search className="w-4 h-4 text-[#86868b] flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Quick search doctor, clinic..."
                  className="w-full bg-transparent text-xs text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="text-[#86868b] hover:text-[#1d1d1f]">
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
                    onChange={setSelectedSpecialty}
                    variant="form"
                    includeAll={true}
                    counts={specialtyCounts}
                  />
                </div>

                {/* Experience & Sort Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#48484a] mb-1">
                      Min Experience
                    </label>
                    <select
                      value={minExperience}
                      onChange={(e) => setMinExperience(Number(e.target.value))}
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
                      onChange={(e) => setSortBy(e.target.value as any)}
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
              {/* Header */}
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
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search doctor or clinic..."
                    className="w-full bg-transparent text-xs text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} className="text-[#86868b] hover:text-[#1d1d1f]">
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
                  onChange={setSelectedSpecialty}
                  variant="form"
                  includeAll={true}
                  counts={specialtyCounts}
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
                      onClick={() => setMinExperience(item.value)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                        minExperience === item.value
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
                  onChange={(e) => setSortBy(e.target.value as any)}
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
            {/* Results Status Header */}
            <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#e5e5ea] p-4 sm:p-5 mb-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-[#1d1d1f] tracking-tight">
                  {selectedSpecialty === 'All' ? 'Verified Specialists' : `${selectedSpecialty} Specialists`}
                </h2>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Showing {filteredDoctors.length} available medical practitioner{filteredDoctors.length === 1 ? '' : 's'}
                </p>
              </div>

              {/* Active Filter Chips */}
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {selectedSpecialty !== 'All' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0088e8]/10 text-[#0088e8] text-xs font-medium border border-[#0088e8]/20">
                      {selectedSpecialty}
                      <button type="button" onClick={() => setSelectedSpecialty('All')} className="hover:opacity-75 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {minExperience > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0088e8]/10 text-[#0088e8] text-xs font-medium border border-[#0088e8]/20">
                      {minExperience}+ Yrs
                      <button type="button" onClick={() => setMinExperience(0)} className="hover:opacity-75 cursor-pointer">
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
            </div>

            {/* Doctor Cards Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5 sm:gap-6 w-full">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-72 rounded-[28px] bg-white border border-[#e5e5ea] animate-pulse p-7"
                  ></div>
                ))}
              </div>
            ) : filteredDoctors.length === 0 ? (
              <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-12 text-center shadow-xs max-w-lg mx-auto">
                <div className="w-12 h-12 rounded-full bg-[#f5f5f7] text-[#86868b] flex items-center justify-center mx-auto mb-4">
                  <Search className="w-6 h-6 text-[#86868b]" />
                </div>
                <h3 className="text-base font-semibold text-[#1d1d1f] mb-1">
                  No specialists matched your criteria
                </h3>
                <p className="text-xs text-[#86868b] max-w-sm mx-auto mb-5">
                  Try clearing your filters or searching with different keywords to explore available doctors.
                </p>
                <AppleButton variant="secondary" size="sm" onClick={resetFilters}>
                  Clear All Filters
                </AppleButton>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5 sm:gap-6 w-full">
            {filteredDoctors.map((doctor) => {
              const slots = parseDoctorSlots(doctor);
              const getHomeDoctorDetailPath = (docId: string) =>
                user?.role === 'PATIENT' ? `/patient/doctor/${docId}` : `/doctor/${docId}`;
              const getHomeDoctorBookPath = (docId: string) =>
                user?.role === 'PATIENT' ? `/patient/book/${docId}` : `/book/${docId}`;
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
                    onClick={() => navigate(getHomeDoctorDetailPath(doctor.id))}
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
                          onClick={() => navigate(getHomeDoctorDetailPath(doctor.id))}
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
                            onClick={() => navigate(getHomeDoctorBookPath(doctor.id))}
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
      </section>

      {/* 4. Operational Portals */}
      <section className="bg-white border-t border-[#e5e5ea] py-10 px-4 sm:px-6 mt-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-6">
            <h3 className="text-xl font-semibold text-[#1d1d1f] tracking-tight">
              Operational Portals
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Patient Portal */}
            <div
              onClick={() => navigate('/patient/appointments')}
              className="p-5 rounded-2xl bg-[#f5f5f7] hover:bg-white border border-[#e5e5ea] hover:border-[#0088e8]/30 cursor-pointer transition-all duration-200 hover:shadow-xs flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white border border-[#e5e5ea] text-[#0088e8] flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                  <UserCheck className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#1d1d1f] group-hover:text-[#0088e8] transition-colors">
                  Patient Portal
                </h4>
              </div>
              <ArrowRight className="w-4 h-4 text-[#86868b] group-hover:text-[#0088e8] group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* Doctor Console */}
            <div
              onClick={() => navigate('/doctor/dashboard')}
              className="p-5 rounded-2xl bg-[#f5f5f7] hover:bg-white border border-[#e5e5ea] hover:border-[#0088e8]/30 cursor-pointer transition-all duration-200 hover:shadow-xs flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white border border-[#e5e5ea] text-[#0088e8] flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#1d1d1f] group-hover:text-[#0088e8] transition-colors">
                  Doctor Console
                </h4>
              </div>
              <ArrowRight className="w-4 h-4 text-[#86868b] group-hover:text-[#0088e8] group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* Clinic Partner Portal */}
            <div
              onClick={() => navigate(user?.role === 'CLINIC' ? '/clinic/dashboard' : '/clinic/login')}
              className="p-5 rounded-2xl bg-[#f5f5f7] hover:bg-white border border-[#e5e5ea] hover:border-[#0088e8]/30 cursor-pointer transition-all duration-200 hover:shadow-xs flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white border border-[#e5e5ea] text-[#0088e8] flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#1d1d1f] group-hover:text-[#0088e8] transition-colors">
                  Clinic Portal
                </h4>
              </div>
              <ArrowRight className="w-4 h-4 text-[#86868b] group-hover:text-[#0088e8] group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* Receptionist Desk */}
            <div
              onClick={() => navigate(user?.role === 'RECEPTIONIST' ? '/receptionist/dashboard' : '/receptionist/login')}
              className="p-5 rounded-2xl bg-[#f5f5f7] hover:bg-white border border-[#e5e5ea] hover:border-[#0088e8]/30 cursor-pointer transition-all duration-200 hover:shadow-xs flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white border border-[#e5e5ea] text-[#0088e8] flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                  <Clock className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#1d1d1f] group-hover:text-[#0088e8] transition-colors">
                  Reception Desk
                </h4>
              </div>
              <ArrowRight className="w-4 h-4 text-[#86868b] group-hover:text-[#0088e8] group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
