import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { api, Doctor, parseDoctorSlots, format12Hour, formatDoctorDegrees, getFileUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { SearchInput } from '../../components/ui/SearchInput';
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
    queueMicrotask(() => {
      const paramSpec = searchParams.get('specialty') || 'All';
      if (paramSpec !== selectedSpecialty) {
        setSelectedSpecialty(paramSpec);
      }
    });
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
              <option value="rating">Recommended</option>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 w-full">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 w-full">
          {doctors.map((doctor) => {
            const slots = parseDoctorSlots(doctor);
            const cleanDegrees = formatDoctorDegrees(doctor.qualifications);
            const primaryClinic = doctor.clinics?.find((c) => c?.clinic)?.clinic || null;
            const hasClinics = Boolean(primaryClinic);

            return (
              <div
                key={doctor.id}
                className="w-full bg-white rounded-[22px] sm:rounded-[26px] border border-[#e5e5ea] p-5 sm:p-6 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:border-[#0088e8]/30 transition-all duration-200 flex flex-col justify-between group"
              >
                {/* 1. Top Section: Clean Doctor Avatar & Practitioner Info */}
                <div className="flex items-start gap-3.5 sm:gap-4">
                  {/* Refined Doctor Avatar (Squircle Apple Style) */}
                  <div
                    onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                    className="w-16 h-16 sm:w-18 sm:h-18 rounded-[18px] sm:rounded-[20px] bg-[#f5f5f7] border border-black/[0.06] overflow-hidden shrink-0 flex items-center justify-center cursor-pointer transition-transform group-hover:scale-[1.02] shadow-xs"
                  >
                    {doctor.user?.avatarUrl ? (
                      <img
                        src={getFileUrl(doctor.user.avatarUrl)}
                        alt={doctor.user?.fullName || 'Doctor'}
                        className="w-full h-full object-cover"
                        loading="eager"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.parentElement?.querySelector('.doc-fallback');
                          if (fallback) (fallback as HTMLElement).style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className={`doc-fallback w-full h-full ${doctor.user?.avatarUrl ? 'hidden' : 'flex'} items-center justify-center font-semibold text-2xl text-white bg-gradient-to-br from-[#0088e8] to-[#0066cc] select-none`}
                    >
                      {(doctor.user?.fullName ? doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] : null) || 'D'}
                    </div>
                  </div>

                  {/* Doctor Info */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <h3
                        onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                        className="text-base sm:text-lg font-semibold text-[#1d1d1f] hover:text-[#0088e8] cursor-pointer tracking-tight transition-colors line-clamp-1"
                        title={doctor.user?.fullName || 'Doctor'}
                      >
                        {doctor.user?.fullName || 'Doctor'}
                      </h3>
                      <CheckCircle2 className="w-4 h-4 text-[#0088e8] fill-[#0088e8]/10 shrink-0" />
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-[#86868b]">
                      <span className="font-medium text-[#0088e8]">{doctor.specialty}</span>
                      <span className="text-[#d1d1d6]">•</span>
                      <span>{doctor.experienceYears} yrs exp</span>
                    </div>

                    {cleanDegrees && (
                      <div className="mt-0.5 text-xs text-[#86868b] truncate">
                        {cleanDegrees}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Middle Section: Practice Venue & Shift Timing */}
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
                <div className="mt-4 pt-3.5 border-t border-[#f0f0f2] flex items-center justify-between gap-4">
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
