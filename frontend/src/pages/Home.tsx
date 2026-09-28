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
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AppleButton } from '../components/ui/AppleButton';
import { BrandLogo } from '../components/ui/BrandLogo';
import { SearchableSpecialtySelect } from '../components/ui/SearchableSpecialtySelect';
import {
  Search,
  MapPin,
  Clock,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  Star,
  Building2,
  UserCheck,
  Stethoscope,
  RotateCcw,
  ChevronRight,
  X,
  AlertCircle,
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
      {/* 1. Hero Section - Search-Driven Apple Aesthetic */}
      <section className="bg-white border-b border-[#e5e5ea] pt-12 pb-14 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Role Aware Status Bar */}
          {user ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#f0fdf4] border border-[#d1fae5] text-xs font-semibold text-[#059669] mb-6 shadow-xs">
              <BrandLogo variant="icon" size="xs" />
              <span>
                Welcome back, {user.fullName?.split(' ')[0] || user.fullName} •{' '}
                {isDoctor
                  ? 'Doctor Console'
                  : isClinic
                  ? 'Clinic Partner Portal'
                  : isReceptionist
                  ? 'Receptionist Desk'
                  : isAdmin
                  ? 'Admin Control Center'
                  : 'Patient Dashboard'}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#f0f9ff] border border-[#e0f2fe] text-xs font-medium text-[#0088e8] mb-6 shadow-xs">
              <BrandLogo variant="icon" size="xs" />
              <span>Live Queue • Zero Wait Guesswork</span>
            </div>
          )}

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-[#1d1d1f] tracking-tight leading-[1.1] mb-4">
            Healthcare. Organized with clinical clarity.
          </h1>

          <p className="text-base sm:text-lg font-normal text-[#86868b] max-w-2xl mx-auto leading-relaxed mb-8">
            Find verified specialists, inspect real-time checking shifts, and secure guaranteed appointment tokens.
          </p>

          {/* Central Integrated Search Bar */}
          <form
            onSubmit={handleHeroSearch}
            className="bg-white sm:bg-[#f5f5f7] p-2 sm:p-2.5 rounded-[24px] sm:rounded-full border border-[#e5e5ea] shadow-sm max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-2 transition-all focus-within:border-[#0088e8] focus-within:shadow-[0_4px_24px_-4px_rgba(0,136,232,0.18)] focus-within:bg-white"
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

          {/* 4 Clean Clinical Metrics Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto mt-8">
            <div className="flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-full bg-white border border-[#e5e5ea] text-xs font-medium text-[#1d1d1f] shadow-2xs hover:shadow-xs hover:border-[#0088e8]/30 transition-all duration-200">
              <ShieldCheck className="w-4 h-4 text-[#10b981] flex-shrink-0" />
              <span className="font-semibold text-[#1d1d1f]">Verified Specialists</span>
            </div>
            <div className="flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-full bg-white border border-[#e5e5ea] text-xs font-medium text-[#1d1d1f] shadow-2xs hover:shadow-xs hover:border-[#0088e8]/30 transition-all duration-200">
              <Clock className="w-4 h-4 text-[#0088e8] flex-shrink-0" />
              <span className="font-semibold text-[#1d1d1f]">Live Queue Tokens</span>
            </div>
            <div className="flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-full bg-white border border-[#e5e5ea] text-xs font-medium text-[#1d1d1f] shadow-2xs hover:shadow-xs hover:border-[#0088e8]/30 transition-all duration-200">
              <Calendar className="w-4 h-4 text-[#0088e8] flex-shrink-0" />
              <span className="font-semibold text-[#1d1d1f]">Zero Wait Guesswork</span>
            </div>
            <div className="flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-full bg-white border border-[#e5e5ea] text-xs font-medium text-[#1d1d1f] shadow-2xs hover:shadow-xs hover:border-[#0088e8]/30 transition-all duration-200">
              <Layers className="w-4 h-4 text-[#10b981] flex-shrink-0" />
              <span className="font-semibold text-[#1d1d1f]">Direct Settlement</span>
            </div>
          </div>
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
              <button
                type="button"
                onClick={() => setAvailabilityFilter(availabilityFilter === 'ACTIVE_NOW' ? 'ALL' : 'ACTIVE_NOW')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 border cursor-pointer active:scale-[0.98] ${
                  availabilityFilter === 'ACTIVE_NOW'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold shadow-xs'
                    : 'bg-[#f5f5f7] border-[#e5e5ea] text-[#48484a] hover:bg-[#ebebee]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${availabilityFilter === 'ACTIVE_NOW' ? 'bg-emerald-500 animate-pulse' : 'bg-[#c7c7cc]'}`} />
                <span>Active Shift Now</span>
              </button>

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
                <option value="rating">Top Rated ★</option>
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
          <div className="flex flex-col gap-4 w-full">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-36 rounded-[24px] bg-white border border-[#e5e5ea] animate-pulse p-6"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
            {filteredDoctors.map((doctor) => {
                const slots = parseDoctorSlots(doctor);
                const todayStr = getLocalDateString();
                const firstSlotStatus = slots[0]
                  ? evaluateSlotStatus(slots[0], todayStr, 0, new Date())
                  : null;
                const getHomeDoctorDetailPath = (docId: string) =>
                  user?.role === 'PATIENT' ? `/patient/doctor/${docId}` : `/doctor/${docId}`;
                const getHomeDoctorBookPath = (docId: string) =>
                  user?.role === 'PATIENT' ? `/patient/book/${docId}` : `/book/${docId}`;
                const cleanDegrees = formatDoctorDegrees(doctor.qualifications);
                const hasClinics = Boolean(doctor.clinics && doctor.clinics.length > 0);
                const primaryClinic = hasClinics && doctor.clinics ? doctor.clinics[0].clinic : null;

                return (
                  <div
                    key={doctor.id}
                    className="bg-white rounded-[24px] border border-[#e5e5ea] p-5 sm:p-6 shadow-xs hover:shadow-apple-card hover:border-[#0088e8]/30 transition-all duration-300 flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top: Avatar + Identity Header */}
                      <div className="flex items-start gap-4">
                        <div
                          onClick={() => navigate(getHomeDoctorDetailPath(doctor.id))}
                          className="w-16 h-16 sm:w-18 sm:h-18 rounded-[20px] bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex-shrink-0 cursor-pointer group-hover:scale-[1.02] transition-transform relative flex items-center justify-center"
                        >
                          {doctor.user.avatarUrl ? (
                            <img
                              src={doctor.user.avatarUrl}
                              alt={doctor.user.fullName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : null}
                          <div className="w-full h-full flex items-center justify-center font-bold text-xl text-[#0088e8] bg-gradient-to-br from-blue-50 to-indigo-100/80">
                            {doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] || 'D'}
                          </div>
                          <div className="absolute bottom-1 right-1 bg-white rounded-full p-0.5 shadow-xs" title="Verified Practitioner">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3
                              onClick={() => navigate(getHomeDoctorDetailPath(doctor.id))}
                              className="text-base sm:text-lg font-bold text-[#1d1d1f] hover:text-[#0088e8] cursor-pointer tracking-tight truncate"
                            >
                              {doctor.user.fullName}
                            </h3>
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/80 text-[11px] font-semibold text-amber-800 flex-shrink-0">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                              <span>{doctor.rating ? doctor.rating.toFixed(1) : '5.0'}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#0088e8]/10 text-[#0088e8]">
                              {doctor.specialty}
                            </span>
                            <span className="text-[11px] font-medium text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full border border-[#e5e5ea]">
                              {cleanDegrees}
                            </span>
                            <span className="text-[11px] text-[#86868b] font-medium">
                              • {doctor.experienceYears}y exp
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Practice Venue & Shifts Compartment */}
                      <div className="mt-4 p-3.5 rounded-2xl bg-[#f5f5f7]/80 border border-[#e5e5ea] space-y-2">
                        <div className="flex items-center gap-2 text-xs text-[#1d1d1f]">
                          <Building2 className="w-4 h-4 text-[#0088e8] flex-shrink-0" />
                          {hasClinics && primaryClinic ? (
                            <span className="font-medium truncate">
                              {primaryClinic.clinicName}
                              {primaryClinic.city ? ` • ${primaryClinic.city}` : ''}
                              {(doctor.clinics?.length ?? 0) > 1 ? (
                                <span className="text-[#86868b] font-normal ml-1">
                                  (+{(doctor.clinics?.length ?? 0) - 1} more)
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                              No Clinic Associated (Unavailable)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-[#1d1d1f]">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[#0088e8] flex-shrink-0" />
                            <span className="font-medium">
                              {slots.length > 0
                                ? `${format12Hour(slots[0].startTime)} – ${format12Hour(slots[0].endTime)}`
                                : doctor.checkingStartTime
                                ? `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`
                                : 'Outpatient Shift'}
                            </span>
                          </div>
                          {firstSlotStatus?.isInProgress ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300/70">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active Now
                            </span>
                          ) : slots.length > 1 ? (
                            <span className="text-[10px] text-[#86868b] font-medium bg-white px-2 py-0.5 rounded-full border border-[#e5e5ea]">
                              {slots.length} Shifts Today
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Consultation Fee & Actions */}
                    <div className="mt-5 pt-4 border-t border-[#f0f0f0] flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-[#86868b] tracking-wider block">
                          Consultation
                        </span>
                        <div className="text-xl font-bold text-[#1d1d1f] tracking-tight leading-none mt-0.5">
                          ₹{doctor.consultationFee.toFixed(0)}
                        </div>
                        <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">Pay at Clinic Reception</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <AppleButton
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(getHomeDoctorDetailPath(doctor.id))}
                          className="text-xs px-3.5 py-1.5 rounded-full border border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#f5f5f7] font-medium"
                        >
                          Profile
                        </AppleButton>
                        {hasClinics ? (
                          <AppleButton
                            variant="primary"
                            size="sm"
                            onClick={() => navigate(getHomeDoctorBookPath(doctor.id))}
                            className="text-xs px-4 py-1.5 rounded-full flex items-center gap-1 font-semibold shadow-apple-button"
                          >
                            <span>Book Token</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </AppleButton>
                        ) : (
                          <AppleButton
                            variant="secondary"
                            size="sm"
                            disabled
                            className="text-xs px-3.5 py-1.5 rounded-full opacity-60 cursor-not-allowed bg-gray-100 border border-gray-200 text-gray-500 font-medium"
                          >
                            <span>No Clinic</span>
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

      {/* 4. Clinical Portals Operations Quick Strip */}
      <section className="bg-white border-t border-[#e5e5ea] py-12 px-4 sm:px-6 mt-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-8">
            <span className="text-xs font-semibold text-[#0088e8] uppercase tracking-wider block mb-1">
              Operational Portals
            </span>
            <h3 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">
              Designed for patients, clinics, and care teams.
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Patient Portal */}
            <div
              onClick={() => navigate('/patient/appointments')}
              className="p-6 rounded-[24px] bg-white border border-[#e5e5ea] hover:border-[#0088e8]/40 cursor-pointer transition-all duration-300 hover:shadow-apple-card hover:-translate-y-0.5 flex flex-col justify-between group shadow-2xs"
            >
              <div>
                <div className="w-11 h-11 rounded-2xl bg-sky-50 text-[#0088e8] border border-sky-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <UserCheck className="w-5 h-5" />
                </div>
                <h4 className="text-base font-semibold text-[#1d1d1f] mb-1.5 group-hover:text-[#0088e8] transition-colors">Patient Portal</h4>
                <p className="text-xs text-[#86868b] leading-relaxed">
                  Track your active live token, check remaining queue numbers, and manage medical files.
                </p>
              </div>
              <span className="text-xs text-[#0088e8] font-semibold flex items-center gap-1 mt-5 group-hover:translate-x-0.5 transition-transform">
                Open Portal <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Doctor Console */}
            <div
              onClick={() => navigate('/doctor/dashboard')}
              className="p-6 rounded-[24px] bg-white border border-[#e5e5ea] hover:border-[#0088e8]/40 cursor-pointer transition-all duration-300 hover:shadow-apple-card hover:-translate-y-0.5 flex flex-col justify-between group shadow-2xs"
            >
              <div>
                <div className="w-11 h-11 rounded-2xl bg-teal-50 text-[#0088e8] border border-teal-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <h4 className="text-base font-semibold text-[#1d1d1f] mb-1.5 group-hover:text-[#0088e8] transition-colors">Doctor Console</h4>
                <p className="text-xs text-[#86868b] leading-relaxed">
                  Call next patient, review clinical history, write digital Rx, and manage clinic affiliations.
                </p>
              </div>
              <span className="text-xs text-[#0088e8] font-semibold flex items-center gap-1 mt-5 group-hover:translate-x-0.5 transition-transform">
                Open Console <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Clinic Partner Portal */}
            <div
              onClick={() => navigate(user?.role === 'CLINIC' ? '/clinic/dashboard' : '/clinic/login')}
              className="p-6 rounded-[24px] bg-white border border-[#e5e5ea] hover:border-[#0088e8]/40 cursor-pointer transition-all duration-300 hover:shadow-apple-card hover:-translate-y-0.5 flex flex-col justify-between group shadow-2xs"
            >
              <div>
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Building2 className="w-5 h-5" />
                </div>
                <h4 className="text-base font-semibold text-[#1d1d1f] mb-1.5 group-hover:text-[#0088e8] transition-colors">Clinic Partner Portal</h4>
                <p className="text-xs text-[#86868b] leading-relaxed">
                  Onboard doctors, view appointments booked at your clinic, and track clinic-specific revenue.
                </p>
              </div>
              <span className="text-xs text-[#0088e8] font-semibold flex items-center gap-1 mt-5 group-hover:translate-x-0.5 transition-transform">
                {user?.role === 'CLINIC' ? 'Open Dashboard' : 'Clinic Sign In'} <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Receptionist Desk */}
            <div
              onClick={() => navigate(user?.role === 'RECEPTIONIST' ? '/receptionist/dashboard' : '/receptionist/login')}
              className="p-6 rounded-[24px] bg-white border border-[#e5e5ea] hover:border-[#0088e8]/40 cursor-pointer transition-all duration-300 hover:shadow-apple-card hover:-translate-y-0.5 flex flex-col justify-between group shadow-2xs"
            >
              <div>
                <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Clock className="w-5 h-5" />
                </div>
                <h4 className="text-base font-semibold text-[#1d1d1f] mb-1.5 group-hover:text-[#0088e8] transition-colors">Reception Desk</h4>
                <p className="text-xs text-[#86868b] leading-relaxed">
                  Book walk-in patients into doctor's live queue, print tokens, and advance consultation queue.
                </p>
              </div>
              <span className="text-xs text-[#0088e8] font-semibold flex items-center gap-1 mt-5 group-hover:translate-x-0.5 transition-transform">
                {user?.role === 'RECEPTIONIST' ? 'Open Desk' : 'Desk Sign In'} <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
