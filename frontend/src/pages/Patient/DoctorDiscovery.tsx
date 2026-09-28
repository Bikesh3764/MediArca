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
  FileText,
  Stethoscope,
  User as UserIcon,
  RefreshCw,
  Building2,
  ChevronRight,
  AlertCircle,
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
      id: 'records',
      label: 'Clinical Records',
      icon: FileText,
      path: '/patient/records',
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
          {doctors.map((doctor) => {
            const slots = parseDoctorSlots(doctor);
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
                    {/* Squircle Avatar with Verified Badge & Error Handling */}
                    <div
                      onClick={() => navigate(getDoctorDetailPath(doctor.id))}
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

                    {/* Practitioner Title & Badges */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3
                          onClick={() => navigate(getDoctorDetailPath(doctor.id))}
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

                  {/* Practice Venue & Checking Shifts Compartment */}
                  <div className="mt-4 p-3.5 rounded-2xl bg-[#f5f5f7]/80 border border-[#e5e5ea] space-y-2">
                    {/* Clinic Affiliation */}
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

                    {/* Practice Shift Timing */}
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
                      {slots.length > 1 && (
                        <span className="text-[10px] text-[#86868b] font-medium bg-white px-2 py-0.5 rounded-full border border-[#e5e5ea]">
                          {slots.length} Shifts Today
                        </span>
                      )}
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
                      onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                      className="text-xs px-3.5 py-1.5 rounded-full border border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#f5f5f7] font-medium"
                    >
                      Profile
                    </AppleButton>
                    {hasClinics ? (
                      <AppleButton
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(getBookPath(doctor.id))}
                        className="text-xs px-4 py-1.5 rounded-full flex items-center gap-1 font-semibold shadow-xs hover:shadow-sm"
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
            <span className="text-xs px-3 py-1 rounded-full bg-[#0088e8]/10 text-[#0088e8] font-medium border border-[#0088e8]/20">
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
