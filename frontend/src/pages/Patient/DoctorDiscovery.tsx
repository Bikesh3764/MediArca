import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { api, Doctor, parseDoctorSlots, format12Hour, formatDoctorDegrees } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { SearchInput } from '../../components/ui/SearchInput';
import { AppleButton } from '../../components/ui/AppleButton';
import { SubNav } from '../../components/layout/SubNav';
import {
  ShieldCheck,
  Star,
  Clock,
  MapPin,
  SlidersHorizontal,
  ArrowRight,
  Calendar,
  Stethoscope,
  User as UserIcon,
  RefreshCw,
  Building2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
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

  const loadDoctors = async (queryText: string, specialtyFilter: string, sortOrder: string) => {
    setLoading(true);
    try {
      const data = await api.getDoctors({
        search: queryText.trim() || undefined,
        specialty: specialtyFilter !== 'All' ? specialtyFilter : undefined,
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
      loadDoctors(search, selectedSpecialty, sortBy);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selectedSpecialty, sortBy]);

  // Synchronize specialty filter when query param changes
  useEffect(() => {
    const paramSpec = searchParams.get('specialty') || 'All';
    if (paramSpec !== selectedSpecialty) {
      setSelectedSpecialty(paramSpec);
    }
  }, [searchParams, selectedSpecialty]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDoctors(search, selectedSpecialty, sortBy);
  };

  const getDoctorDetailPath = (doctorId: string) =>
    isPatientPortal ? `/patient/doctor/${doctorId}` : `/doctor/${doctorId}`;

  const getBookPath = (doctorId: string) =>
    isPatientPortal ? `/patient/book/${doctorId}` : `/book/${doctorId}`;

  const discoveryContent = (
    <>
      {/* Search & Specialty Filter Controls */}
      <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-5 sm:p-6 mb-8 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by doctor name, specialty, condition, or clinic..."
            className="flex-1"
          />
          <div className="flex flex-wrap items-center gap-2">
            {/* Searchable Specialty Filter Dropdown */}
            <SearchableSpecialtySelect
              value={selectedSpecialty}
              onChange={(spec) => {
                setSelectedSpecialty(spec);
                setSearchParams(spec === 'All' ? {} : { specialty: spec });
              }}
              variant="pill"
              includeAll={true}
            />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-8 px-3.5 rounded-full border border-[#e5e5ea] text-xs font-medium bg-[#f5f5f7] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] cursor-pointer hover:bg-[#e8e8ed] transition-all"
            >
              <option value="rating">Top Rated ★</option>
              <option value="experience">Most Experienced</option>
              <option value="fee_low">Fee: Low to High</option>
              <option value="fee_high">Fee: High to Low</option>
            </select>

            {(selectedSpecialty !== 'All' || search) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSpecialty('All');
                  setSearch('');
                  setSearchParams({});
                }}
                className="px-3.5 py-1 rounded-full text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all flex items-center gap-1 cursor-pointer active:scale-[0.98]"
                title="Reset filters"
              >
                Reset
              </button>
            )}

            <AppleButton variant="primary" size="sm" type="submit" className="h-8 px-4 text-xs font-medium rounded-full">
              Search
            </AppleButton>
          </div>
        </form>
      </div>

      {/* Doctor Grid */}
      {loading ? (
        <div className="flex flex-col gap-4 w-full">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-[24px] bg-white border border-[#e5e5ea] animate-pulse p-6"></div>
          ))}
        </div>
      ) : doctors.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-[20px] border border-[#e5e5ea] shadow-sm max-w-lg mx-auto">
          <p className="text-base font-semibold text-[#1d1d1f]">No doctors found matching your criteria.</p>
          <p className="text-xs text-[#86868b] mt-1">Try clearing your search term or selecting 'All' specialties.</p>
          <AppleButton
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setSelectedSpecialty('All');
              setSearchParams({});
            }}
            className="mt-5"
          >
            Reset All Filters
          </AppleButton>
        </div>
      ) : (
        <div className="space-y-4 w-full">
          {doctors.map((doctor) => {
            const slots = parseDoctorSlots(doctor);
            const cleanDegrees = formatDoctorDegrees(doctor.qualifications);
            const hasClinics = Boolean(doctor.clinics && doctor.clinics.length > 0);
            const primaryClinic = hasClinics && doctor.clinics ? doctor.clinics[0].clinic : null;

            return (
              <div
                key={doctor.id}
                className="w-full bg-white rounded-[22px] border border-[#e5e5ea] p-5 sm:p-6 hover:border-[#0088e8]/30 hover:shadow-apple-card transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-5 group"
              >
                {/* Left Side: Avatar & Practitioner Credentials */}
                <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                  {/* Clean Circular Avatar */}
                  <div
                    onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    {doctor.user.avatarUrl ? (
                      <img
                        src={doctor.user.avatarUrl}
                        alt={doctor.user.fullName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.parentElement?.querySelector('.doc-fallback');
                          if (fallback) (fallback as HTMLElement).style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className={`doc-fallback w-full h-full ${doctor.user.avatarUrl ? 'hidden' : 'flex'} items-center justify-center font-bold text-lg text-[#0088e8] bg-gradient-to-br from-[#0088e8]/10 to-[#10b981]/15`}
                    >
                      {doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] || 'D'}
                    </div>
                  </div>

                  {/* Doctor Info */}
                  <div className="min-w-0 flex-1">
                    {/* Name + Verified Badge + Rating */}
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                        className="text-base sm:text-lg font-bold text-[#1d1d1f] hover:text-[#0088e8] cursor-pointer tracking-tight transition-colors"
                      >
                        {doctor.user.fullName}
                      </h3>
                      <CheckCircle2 className="w-4 h-4 text-[#0088e8] flex-shrink-0" />
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/60 text-[11px] font-semibold text-amber-800">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        <span>{doctor.rating ? doctor.rating.toFixed(1) : '5.0'}</span>
                      </div>
                    </div>

                    {/* Specialty & Qualifications */}
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#86868b]">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-[#0088e8]/10 to-[#10b981]/10 text-[#0088e8] border border-[#0088e8]/20">
                        {doctor.specialty}
                      </span>
                      <span className="font-medium text-[#48484a]">{cleanDegrees}</span>
                      <span>•</span>
                      <span>{doctor.experienceYears}y exp</span>
                    </div>

                    {/* Meta Row: Clinic & Shift Timings */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-xs text-[#6e6e73]">
                      {/* Clinic Venue */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Building2 className="w-3.5 h-3.5 text-[#0088e8] flex-shrink-0" />
                        {hasClinics && primaryClinic ? (
                          <span className="truncate max-w-[240px] sm:max-w-md font-medium text-[#1d1d1f]">
                            {primaryClinic.clinicName}
                            {primaryClinic.city ? ` • ${primaryClinic.city}` : ''}
                            {(doctor.clinics?.length ?? 0) > 1 && (
                              <span className="text-[#86868b] font-normal ml-1">
                                (+{(doctor.clinics?.length ?? 0) - 1} more)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/70">
                            <AlertCircle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                            No Clinic Associated
                          </span>
                        )}
                      </div>

                      {/* Shift Timing */}
                      <div className="flex items-center gap-1.5 font-medium text-[#1d1d1f]">
                        <Clock className="w-3.5 h-3.5 text-[#0088e8] flex-shrink-0" />
                        <span>
                          {slots.length > 0
                            ? `${format12Hour(slots[0].startTime)} – ${format12Hour(slots[0].endTime)}`
                            : doctor.checkingStartTime
                            ? `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`
                            : 'Outpatient Shift'}
                        </span>
                        {slots.length > 1 && (
                          <span className="text-[11px] text-[#86868b] font-normal">
                            ({slots.length} shifts)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Consultation Fee & Single Action CTA */}
                <div className="flex sm:flex-row md:flex-col lg:flex-row items-center justify-between md:justify-center lg:justify-end gap-3 sm:gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-[#f5f5f7] flex-shrink-0">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] uppercase font-semibold text-[#86868b] tracking-wider block">
                      Consultation
                    </span>
                    <div className="text-xl sm:text-2xl font-bold text-[#1d1d1f] tracking-tight leading-tight">
                      ₹{doctor.consultationFee.toFixed(0)}
                    </div>
                    <span className="text-[10px] text-emerald-600 font-medium block">Pay at Clinic</span>
                  </div>

                  <div>
                    {hasClinics ? (
                      <AppleButton
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(getBookPath(doctor.id))}
                        className="text-xs px-5 py-2.5 rounded-full flex items-center gap-1.5 font-semibold shadow-xs hover:shadow-apple-button"
                      >
                        <span>Book Token</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </AppleButton>
                    ) : (
                      <AppleButton
                        variant="secondary"
                        size="sm"
                        disabled
                        className="text-xs px-4 py-2.5 rounded-full opacity-60 cursor-not-allowed bg-[#f5f5f7] border border-[#e5e5ea] text-[#86868b] font-medium"
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
    </>
  );

  if (isPatientPortal) {
    return (
      <DashboardLayout
        portalType="PATIENT"
        portalSubtitle="PATIENT PORTAL"
        navItems={patientNavItems}
        title="Find Healthcare Specialists"
        subtitle="Browse verified practitioners, compare checking shifts, and book instant queue tokens"
        headerAction={
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-[#0088e8]/10 to-[#10b981]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20">
              {doctors.length} Specialist{doctors.length === 1 ? '' : 's'} Available
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
        <div className="space-y-6">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        {discoveryContent}
      </div>
    </div>
  );
};
