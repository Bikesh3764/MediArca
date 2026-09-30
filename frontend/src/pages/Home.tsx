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
        {/* Apple Healthcare Themed Hero Background - Vibrant & Clearly Visible */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          <img
            src={healthcareHeroBg}
            alt="Healthcare clinical setting"
            className="w-full h-full object-cover object-center filter saturate-[1.12] contrast-[1.02]"
          />
          {/* Subtle light wash - preserves full photo visibility */}
          <div className="absolute inset-0 bg-white/20" />
          {/* Soft center vignette for headline legibility without washing out the sides */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.25)_55%,transparent_100%)]" />
          {/* Smooth bottom transition into canvas */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#f5f5f7]/95" />
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

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-[#1d1d1f] tracking-tight leading-[1.1] mb-3 drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]">
            Find doctors. <span className="text-[#0088e8]">Book queue tokens.</span>
          </h1>

          <p className="text-sm sm:text-base text-[#1d1d1f]/85 max-w-xl mx-auto mb-8 font-medium leading-relaxed drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]">
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

      {/* Explore Doctors Catalog - Full Width Modern Apple Grid */}
      <section id="doctors-catalog" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full">
        {/* Section Header & Inline Refine Toolbar */}
        <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-5 sm:p-6 mb-8 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#f0f0f0]">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold text-[#1d1d1f] tracking-tight">
                {selectedSpecialty === 'All' ? 'Verified Specialists' : `${selectedSpecialty} Specialists`}
              </h2>
              <p className="text-xs text-[#86868b] mt-0.5">
                Showing {filteredDoctors.length} available medical practitioner{filteredDoctors.length === 1 ? '' : 's'}
              </p>
            </div>

            {/* Quick Filter & Sort Pills */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {/* Integrated Searchable Specialty Filter Dropdown */}
              <SearchableSpecialtySelect
                value={selectedSpecialty}
                onChange={setSelectedSpecialty}
                variant="pill"
                includeAll={true}
                counts={specialtyCounts}
              />

              <select
                value={minExperience}
                onChange={(e) => setMinExperience(Number(e.target.value))}
                className="h-8 px-3 rounded-full border border-[#e5e5ea] bg-[#f5f5f7] text-xs text-[#48484a] font-medium focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20 cursor-pointer hover:bg-[#ebebee] transition-all"
              >
                <option value={0}>All Experience</option>
                <option value={5}>5+ Years</option>
                <option value={10}>10+ Years</option>
                <option value={15}>15+ Years</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-8 px-3 rounded-full border border-[#e5e5ea] bg-[#f5f5f7] text-xs text-[#48484a] font-medium focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20 cursor-pointer hover:bg-[#ebebee] transition-all"
              >
                <option value="rating">Recommended</option>
                <option value="experience">Most Experienced</option>
                <option value="fee_low">Fee: Low to High</option>
                <option value="fee_high">Fee: High to Low</option>
              </select>

              {(selectedSpecialty !== 'All' || searchQuery || locationQuery || minExperience > 0 || availabilityFilter !== 'ALL' || sortBy !== 'rating') && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-3 py-1.5 rounded-full text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all flex items-center gap-1 cursor-pointer active:scale-[0.98]"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Search & Location Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] focus-within:border-[#0088e8] focus-within:ring-2 focus-within:ring-[#0088e8]/20 focus-within:bg-white transition-all">
              <Search className="w-4 h-4 text-[#86868b] flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by doctor name, condition, or clinic..."
                className="w-full bg-transparent text-xs text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[#86868b] hover:text-[#1d1d1f] p-0.5 cursor-pointer active:scale-90"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] focus-within:border-[#0088e8] focus-within:ring-2 focus-within:ring-[#0088e8]/20 focus-within:bg-white transition-all">
              <MapPin className="w-4 h-4 text-[#86868b] flex-shrink-0" />
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="Filter by city, state, or address..."
                className="w-full bg-transparent text-xs text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
              />
              {locationQuery && (
                <button
                  type="button"
                  onClick={() => setLocationQuery('')}
                  className="text-[#86868b] hover:text-[#1d1d1f] p-0.5 cursor-pointer active:scale-90"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Doctor Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 w-full">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 w-full">
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
                  className="w-full bg-white rounded-[28px] border border-[#e5e5ea] p-6 sm:p-7 hover:border-[#0088e8]/40 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition-all duration-200 flex flex-col justify-between group"
                >
                  {/* 1. Top Section: Large High-Res Doctor Avatar & Practitioner Info */}
                  <div className="flex items-start gap-4 sm:gap-5">
                    {/* Large, Clear Doctor Avatar (96px to 112px) */}
                    <div
                      onClick={() => navigate(getHomeDoctorDetailPath(doctor.id))}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#f5f5f7] ring-2 ring-black/[0.05] border-2 border-white shadow-md overflow-hidden shrink-0 flex items-center justify-center cursor-pointer hover:opacity-95 transition-all group-hover:scale-[1.02]"
                    >
                      {doctor.user?.avatarUrl ? (
                        <img
                          src={getFileUrl(doctor.user.avatarUrl)}
                          alt={doctor.user?.fullName || 'Doctor'}
                          className="w-full h-full object-cover"
                          loading="eager"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement?.querySelector('.doc-fallback-home');
                            if (fallback) (fallback as HTMLElement).style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className={`doc-fallback-home w-full h-full ${doctor.user?.avatarUrl ? 'hidden' : 'flex'} items-center justify-center font-bold text-3xl text-white bg-gradient-to-br from-[#0088e8] to-[#0066cc] select-none`}
                      >
                        {(doctor.user?.fullName ? doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] : null) || 'D'}
                      </div>
                    </div>

                    {/* Doctor Info */}
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <h3
                          onClick={() => navigate(getHomeDoctorDetailPath(doctor.id))}
                          className="text-lg sm:text-xl font-bold text-[#1d1d1f] hover:text-[#0088e8] cursor-pointer tracking-tight transition-colors line-clamp-1"
                          title={doctor.user?.fullName || 'Doctor'}
                        >
                          {doctor.user?.fullName || 'Doctor'}
                        </h3>
                        <CheckCircle2 className="w-5 h-5 text-[#0088e8] fill-[#0088e8]/10 shrink-0" />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold bg-[#0088e8]/8 text-[#0088e8] border border-[#0088e8]/15">
                          {doctor.specialty}
                        </span>
                        <span className="text-xs sm:text-sm text-[#86868b] font-medium">{doctor.experienceYears} yrs exp</span>
                      </div>

                      {cleanDegrees && (
                        <div className="mt-1.5 text-xs sm:text-sm text-[#48484a] font-normal truncate">
                          {cleanDegrees}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Middle Section: Inset Clinic Venue & Shift Capsule */}
                  <div className="mt-5 p-3.5 sm:p-4 rounded-[18px] bg-[#f5f5f7] border border-black/[0.03] flex flex-col gap-2.5 text-xs sm:text-sm">
                    {/* Practice Venue */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Building2 className="w-4 h-4 text-[#0088e8] shrink-0" />
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
                        <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-amber-600 font-medium">
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                          No Clinic Associated
                        </span>
                      )}
                    </div>

                    {/* Shift Timing */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Clock className="w-4 h-4 text-[#86868b] shrink-0" />
                      <span className="font-medium text-[#48484a] truncate">
                        {slots.length > 0
                          ? `${format12Hour(slots[0].startTime)} – ${format12Hour(slots[0].endTime)}`
                          : doctor.checkingStartTime
                          ? `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`
                          : 'Outpatient Shift'}
                        {slots.length > 1 && (
                          <span className="text-xs text-[#86868b] font-normal ml-1.5">
                            ({slots.length} shifts)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* 3. Bottom Section: Consultation Fee & Action CTA */}
                  <div className="mt-5 pt-4 border-t border-[#f5f5f7] flex items-center justify-between gap-4">
                    <span className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] tracking-tight">
                      ₹{doctor.consultationFee.toFixed(0)}
                    </span>

                    <div>
                      {hasClinics ? (
                        <AppleButton
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(getHomeDoctorBookPath(doctor.id))}
                          className="text-xs sm:text-sm px-6 py-2.5 sm:py-3 rounded-full flex items-center gap-2 font-semibold shadow-xs hover:shadow-apple-button active:scale-[0.98] transition-all bg-[#0088e8] hover:bg-[#0077cc]"
                        >
                          <span>Book Token</span>
                          <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                        </AppleButton>
                      ) : (
                        <AppleButton
                          variant="secondary"
                          size="sm"
                          disabled
                          className="text-xs sm:text-sm px-5 py-2.5 sm:py-3 rounded-full opacity-60 cursor-not-allowed bg-[#f5f5f7] border border-[#e5e5ea] text-[#86868b] font-medium"
                        >
                          <span>Unavailable</span>
                        </AppleButton>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
