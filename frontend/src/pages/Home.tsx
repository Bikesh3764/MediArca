import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  api,
  Doctor,
  parseDoctorSlots,
  format12Hour,
  evaluateSlotStatus,
  getLocalDateString,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AppleButton } from '../components/ui/AppleButton';
import { BrandLogo } from '../components/ui/BrandLogo';
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
  Filter,
  RotateCcw,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';

const SPECIALTIES = [
  'All',
  'Cardiology',
  'Dermatology',
  'Pediatrics',
  'Orthopedics',
  'General Medicine',
];

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
    SPECIALTIES.forEach((s) => {
      if (s !== 'All') {
        counts[s] = doctors.filter((d) => d.specialty.toLowerCase() === s.toLowerCase()).length;
      }
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
            className="bg-[#f5f5f7] p-2 sm:p-2.5 rounded-[24px] sm:rounded-full border border-[#e5e5ea] shadow-sm max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-2 transition-all focus-within:border-[#0066cc] focus-within:shadow-md"
          >
            {/* Doctor or Keyword Input */}
            <div className="flex items-center gap-2 flex-1 w-full px-4 py-2 sm:py-0">
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
            <div className="flex items-center gap-2 w-full sm:w-48 px-4 py-2 sm:py-0">
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
            <div className="w-full sm:w-44 px-3 py-1 sm:py-0">
              <select
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-medium text-[#1d1d1f] focus:outline-none cursor-pointer py-1.5"
              >
                {SPECIALTIES.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec === 'All' ? 'All Specialties' : spec}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Button */}
            <AppleButton
              variant="primary"
              size="md"
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 rounded-full flex-shrink-0 font-medium"
            >
              Search Doctors
            </AppleButton>
          </form>

          {/* 4 Clean Clinical Metrics Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto mt-8">
            <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#fafafc] border border-[#e5e5ea] text-xs font-medium text-[#1d1d1f]">
              <ShieldCheck className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
              <span>Verified Specialists</span>
            </div>
            <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#fafafc] border border-[#e5e5ea] text-xs font-medium text-[#1d1d1f]">
              <Clock className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
              <span>Atomic Queue Tokens</span>
            </div>
            <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#fafafc] border border-[#e5e5ea] text-xs font-medium text-[#1d1d1f]">
              <Calendar className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
              <span>Zero Wait Guesswork</span>
            </div>
            <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#fafafc] border border-[#e5e5ea] text-xs font-medium text-[#1d1d1f]">
              <Layers className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
              <span>Direct Clinic Settlement</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Quick Specialty Filter Pills Bar */}
      <section className="bg-white border-b border-[#e5e5ea] py-3.5 sticky top-12 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
            <span className="text-xs font-semibold text-[#86868b] mr-2 flex items-center gap-1 flex-shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#0066cc]" />
              Specialty:
            </span>
            {SPECIALTIES.map((spec) => {
              const isSelected = selectedSpecialty === spec;
              const count = specialtyCounts[spec] || 0;
              return (
                <button
                  key={spec}
                  onClick={() => setSelectedSpecialty(spec)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 flex-shrink-0 ${
                    isSelected
                      ? 'bg-[#0066cc] text-white shadow-sm'
                      : 'bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] hover:bg-[#ebebee]'
                  }`}
                >
                  <span>{spec === 'All' ? 'All Specialties' : spec}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#e5e5ea] text-[#86868b]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. Explore Doctors Catalog - Two Column Layout */}
      <section id="doctors-catalog" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Filter Sidebar / Drawer */}
          <aside className="w-full lg:w-64 flex-shrink-0 space-y-6">
            <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#f0f0f0]">
                <h3 className="text-sm font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-[#0066cc]" />
                  Refine Catalog
                </h3>
                <button
                  onClick={resetFilters}
                  className="text-[11px] text-[#0066cc] hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>

              {/* Keyword Search */}
              <div className="space-y-1.5 mb-5">
                <label className="text-xs font-medium text-[#86868b]">Doctor or Clinic</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Doctor name or clinic..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] focus:outline-none focus:border-[#0066cc]"
                />
              </div>

              {/* City / Location */}
              <div className="space-y-1.5 mb-5">
                <label className="text-xs font-medium text-[#86868b]">City or Address</label>
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="e.g. New York, Chicago"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] focus:outline-none focus:border-[#0066cc]"
                />
              </div>

              {/* Availability Filter */}
              <div className="space-y-1.5 mb-5">
                <label className="text-xs font-medium text-[#86868b]">Checking Shifts</label>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-xs text-[#1d1d1f] cursor-pointer">
                    <input
                      type="radio"
                      name="avail"
                      checked={availabilityFilter === 'ALL'}
                      onChange={() => setAvailabilityFilter('ALL')}
                      className="text-[#0066cc] focus:ring-0"
                    />
                    <span>All Available Doctors</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#1d1d1f] cursor-pointer">
                    <input
                      type="radio"
                      name="avail"
                      checked={availabilityFilter === 'ACTIVE_NOW'}
                      onChange={() => setAvailabilityFilter('ACTIVE_NOW')}
                      className="text-[#0066cc] focus:ring-0"
                    />
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Active Shift Right Now
                    </span>
                  </label>
                </div>
              </div>

              {/* Minimum Experience */}
              <div className="space-y-1.5 mb-5">
                <label className="text-xs font-medium text-[#86868b]">Experience Level</label>
                <select
                  value={minExperience}
                  onChange={(e) => setMinExperience(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] text-[#1d1d1f] focus:outline-none focus:border-[#0066cc]"
                >
                  <option value={0}>Any Clinical Experience</option>
                  <option value={5}>5+ Years Experience</option>
                  <option value={10}>10+ Years Experience</option>
                  <option value={15}>15+ Years Experience</option>
                </select>
              </div>

              {/* Sort Order */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#86868b]">Sort Catalog By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] text-[#1d1d1f] focus:outline-none focus:border-[#0066cc]"
                >
                  <option value="rating">Highest Rated</option>
                  <option value="experience">Most Experienced</option>
                  <option value="fee_low">Consultation Fee: Low to High</option>
                  <option value="fee_high">Consultation Fee: High to Low</option>
                </select>
              </div>
            </div>
          </aside>

          {/* Right Doctor Cards Grid */}
          <main className="flex-1 min-w-0">
            {/* Catalog Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-[#1d1d1f] tracking-tight">
                  {selectedSpecialty === 'All' ? 'Verified Specialists' : `${selectedSpecialty} Specialists`}
                </h2>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Showing {filteredDoctors.length} available medical practitioner
                  {filteredDoctors.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-64 rounded-[20px] bg-white border border-[#e5e5ea] animate-pulse p-6"
                  ></div>
                ))}
              </div>
            ) : filteredDoctors.length === 0 ? (
              <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-12 text-center shadow-xs">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredDoctors.map((doctor) => {
                  const slots = parseDoctorSlots(doctor);
                  const todayStr = getLocalDateString();
                  const firstSlotStatus = slots[0]
                    ? evaluateSlotStatus(slots[0], todayStr, 0, new Date())
                    : null;

                  return (
                    <div
                      key={doctor.id}
                      className="bg-white rounded-[20px] border border-[#e5e5ea] p-5 shadow-xs hover:shadow-apple-card hover:border-[#0066cc]/40 transition-all duration-200 flex flex-col justify-between"
                    >
                      <div>
                        {/* Top: Avatar, Name, Rating */}
                        <div className="flex items-start gap-3.5 mb-4">
                          <div
                            onClick={() => navigate(`/doctor/${doctor.id}`)}
                            className="w-14 h-14 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex-shrink-0 cursor-pointer"
                          >
                            {doctor.user.avatarUrl ? (
                              <img
                                src={doctor.user.avatarUrl}
                                alt={doctor.user.fullName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-semibold text-lg text-[#0066cc]">
                                {doctor.user.fullName[0]}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3
                                onClick={() => navigate(`/doctor/${doctor.id}`)}
                                className="text-[15px] font-semibold text-[#1d1d1f] hover:text-[#0066cc] cursor-pointer truncate"
                              >
                                {doctor.user.fullName}
                              </h3>
                              <ShieldCheck className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
                            </div>

                            <p className="text-xs font-medium text-[#0066cc] mt-0.5">
                              {doctor.specialty}
                            </p>

                            <p className="text-[11px] text-[#86868b] truncate mt-0.5">
                              {doctor.qualifications} • {doctor.experienceYears} yrs exp.
                            </p>
                          </div>

                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-xs font-semibold text-[#1d1d1f] flex-shrink-0">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            <span>{doctor.rating ? doctor.rating.toFixed(1) : '5.0'}</span>
                          </div>
                        </div>

                        {/* Clinic / Practice Venue */}
                        <div className="flex items-center gap-1.5 text-xs text-[#86868b] mb-3.5 line-clamp-1">
                          {doctor.clinics && doctor.clinics.length > 0 ? (
                            <>
                              <Building2 className="w-3.5 h-3.5 text-[#0066cc] flex-shrink-0" />
                              <span className="truncate">
                                {doctor.clinics[0].clinic.clinicName}
                                {doctor.clinics.length > 1 ? ` (+${doctor.clinics.length - 1} more)` : ''}
                                {doctor.clinics[0].clinic.city ? ` • ${doctor.clinics[0].clinic.city}` : ''}
                              </span>
                            </>
                          ) : (
                            <>
                              <MapPin className="w-3.5 h-3.5 text-[#86868b] flex-shrink-0" />
                              <span className="truncate">{doctor.clinicAddress || 'MediArca Healthcare Centre'}</span>
                            </>
                          )}
                        </div>

                        {/* Checking Shifts Badges */}
                        <div className="p-3 rounded-xl bg-[#fafafc] border border-[#f0f0f0] mb-4 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#86868b] font-medium flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#0066cc]" /> Checking Shifts:
                            </span>
                            {firstSlotStatus?.isInProgress && (
                              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                Active Shift Now
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {slots.slice(0, 2).map((slot) => (
                              <span
                                key={slot.id}
                                className="text-[11px] font-medium text-[#1d1d1f] bg-white px-2.5 py-1 rounded-lg border border-[#e5e5ea]"
                              >
                                {slot.name || `${format12Hour(slot.startTime)} – ${format12Hour(slot.endTime)}`}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Footer: Fee & Booking CTA */}
                      <div className="pt-3 border-t border-[#f0f0f0] flex items-center justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-[#1d1d1f]">
                            ${doctor.consultationFee.toFixed(0)}
                          </div>
                          <span className="text-[10px] text-[#86868b] block">Direct clinic settlement</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <AppleButton
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/doctor/${doctor.id}`)}
                            className="text-xs"
                          >
                            Details
                          </AppleButton>
                          <AppleButton
                            variant="primary"
                            size="sm"
                            onClick={() => navigate(`/book/${doctor.id}`)}
                            className="flex items-center gap-1 text-xs"
                          >
                            Book Token
                            <ChevronRight className="w-3.5 h-3.5" />
                          </AppleButton>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </section>

      {/* 4. Clinical Portals Operations Quick Strip */}
      <section className="bg-white border-t border-[#e5e5ea] py-12 px-4 sm:px-6 mt-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-8">
            <span className="text-xs font-semibold text-[#0066cc] uppercase tracking-wider block mb-1">
              Operational Portals
            </span>
            <h3 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">
              Designed for patients, clinics, and care teams.
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Patient Portal */}
            <div
              onClick={() => navigate('/patient/appointments')}
              className="p-5 rounded-[20px] bg-[#fafafc] border border-[#e5e5ea] hover:border-[#0066cc]/40 cursor-pointer transition-all hover:shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center mb-3">
                  <UserCheck className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#1d1d1f] mb-1">Patient Portal</h4>
                <p className="text-xs text-[#86868b] leading-relaxed">
                  Track your active live token, check remaining queue numbers, and manage medical files.
                </p>
              </div>
              <span className="text-xs text-[#0066cc] font-medium flex items-center gap-1 mt-4">
                Open Portal <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Doctor Console */}
            <div
              onClick={() => navigate('/doctor/dashboard')}
              className="p-5 rounded-[20px] bg-[#fafafc] border border-[#e5e5ea] hover:border-[#0066cc]/40 cursor-pointer transition-all hover:shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#0066cc] flex items-center justify-center mb-3">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#1d1d1f] mb-1">Doctor Console</h4>
                <p className="text-xs text-[#86868b] leading-relaxed">
                  Call next patient, review clinical history, write digital Rx, and manage clinic affiliations.
                </p>
              </div>
              <span className="text-xs text-[#0066cc] font-medium flex items-center gap-1 mt-4">
                Open Console <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Clinic Partner Portal */}
            <div
              onClick={() => navigate('/clinic/login')}
              className="p-5 rounded-[20px] bg-[#fafafc] border border-[#e5e5ea] hover:border-[#0066cc]/40 cursor-pointer transition-all hover:shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <Building2 className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#1d1d1f] mb-1">Clinic Partner Portal</h4>
                <p className="text-xs text-[#86868b] leading-relaxed">
                  Onboard doctors, view appointments booked at your clinic, and track clinic-specific revenue.
                </p>
              </div>
              <span className="text-xs text-[#0066cc] font-medium flex items-center gap-1 mt-4">
                Clinic Sign In <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Receptionist Desk */}
            <div
              onClick={() => navigate('/receptionist/login')}
              className="p-5 rounded-[20px] bg-[#fafafc] border border-[#e5e5ea] hover:border-[#0066cc]/40 cursor-pointer transition-all hover:shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                  <Clock className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#1d1d1f] mb-1">Receptionist Desk</h4>
                <p className="text-xs text-[#86868b] leading-relaxed">
                  Book walk-in patients into doctor's live queue, print tokens, and advance consultation queue.
                </p>
              </div>
              <span className="text-xs text-[#0066cc] font-medium flex items-center gap-1 mt-4">
                Desk Sign In <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
