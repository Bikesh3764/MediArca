import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { api, Doctor, parseDoctorSlots, format12Hour } from '../../services/api';
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
} from 'lucide-react';

const SPECIALTIES = [
  'All',
  'Cardiology',
  'Dermatology',
  'Pediatrics',
  'Orthopedics',
  'General Medicine',
];

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
      label: 'Medical Records Vault',
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
      <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 mb-8 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 mb-5">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by doctor name, specialty, condition, or clinic..."
            className="flex-1"
          />
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-11 px-4 rounded-full border border-[#e5e5ea] text-xs font-medium bg-[#f5f5f7] text-[#1d1d1f] focus:outline-none focus:border-[#0088e8]"
            >
              <option value="rating">Top Rated</option>
              <option value="experience">Most Experienced</option>
              <option value="fee_low">Fee: Low to High</option>
              <option value="fee_high">Fee: High to Low</option>
            </select>
            <AppleButton variant="primary" size="md" type="submit" className="sm:w-28">
              Search
            </AppleButton>
          </div>
        </form>

        {/* Specialty Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-semibold text-[#86868b] mr-2 flex items-center gap-1 flex-shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#0088e8]" />
            Specialty:
          </span>
          {SPECIALTIES.map((spec) => (
            <button
              key={spec}
              type="button"
              onClick={() => {
                setSelectedSpecialty(spec);
                setSearchParams(spec === 'All' ? {} : { specialty: spec });
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0 flex items-center gap-1.5 ${
                selectedSpecialty === spec
                  ? 'bg-gradient-to-r from-[#0088e8] to-[#10b981] text-white shadow-xs'
                  : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#ebebee] border border-[#e5e5ea]'
              }`}
            >
              {spec}
            </button>
          ))}
        </div>
      </div>

      {/* Doctor Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-72 rounded-[20px] bg-white border border-[#e5e5ea] animate-pulse"></div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doctor) => {
            const slots = parseDoctorSlots(doctor);
            return (
              <div
                key={doctor.id}
                className="bg-white rounded-[24px] border border-[#e5e5ea] p-5 sm:p-6 shadow-xs hover:shadow-apple-card hover:border-[#0088e8]/30 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  {/* Top: Avatar, Name & Specialties, Rating */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                        className="w-14 h-14 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex-shrink-0 cursor-pointer group-hover:scale-105 transition-transform"
                      >
                        {doctor.user.avatarUrl ? (
                          <img
                            src={doctor.user.avatarUrl}
                            alt={doctor.user.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-lg text-[#0088e8]">
                            {doctor.user.fullName[0]}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3
                            onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                            className="text-base font-semibold text-[#1d1d1f] hover:text-[#0088e8] cursor-pointer truncate tracking-tight"
                          >
                            {doctor.user.fullName}
                          </h3>
                          <ShieldCheck className="w-4 h-4 text-[#10b981] flex-shrink-0" />
                        </div>

                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0088e8]/10 text-[#0088e8]">
                            {doctor.specialty}
                          </span>
                          <span className="text-[11px] text-[#86868b]">•</span>
                          <span className="text-[11px] font-medium text-[#86868b]">
                            {doctor.experienceYears} yrs exp
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rating Chip */}
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/80 text-xs font-semibold text-amber-800 flex-shrink-0">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>{doctor.rating ? doctor.rating.toFixed(1) : '5.0'}</span>
                    </div>
                  </div>

                  {/* Qualifications / Medical Background */}
                  <p className="text-xs text-[#6e6e73] font-normal mb-4 line-clamp-1">
                    {doctor.qualifications || 'Certified Clinical Specialist'}
                  </p>

                  {/* Clinical Practice Details Compartment */}
                  <div className="my-4 p-3.5 rounded-2xl bg-[#f5f5f7]/80 border border-[#e5e5ea]/80 space-y-2.5">
                    {/* Facility / Location */}
                    <div className="flex items-center gap-2 text-xs">
                      <Building2 className="w-3.5 h-3.5 text-[#0088e8] flex-shrink-0" />
                      <span className="text-[#1d1d1f] font-medium truncate">
                        {doctor.clinics && doctor.clinics.length > 0 ? (
                          <>
                            {doctor.clinics[0].clinic.clinicName}
                            {doctor.clinics[0].clinic.city ? ` • ${doctor.clinics[0].clinic.city}` : ''}
                            {doctor.clinics.length > 1 ? ` (+${doctor.clinics.length - 1} more)` : ''}
                          </>
                        ) : (
                          doctor.clinicAddress || 'MediArca Healthcare Facility'
                        )}
                      </span>
                    </div>

                    {/* Shift Timing */}
                    <div className="flex items-center justify-between gap-2 text-xs pt-2 border-t border-[#e5e5ea]/70">
                      <div className="flex items-center gap-2 text-[#48484a] min-w-0">
                        <Clock className="w-3.5 h-3.5 text-[#0088e8] flex-shrink-0" />
                        <span className="font-medium text-[#1d1d1f] truncate">
                          {slots.length > 0
                            ? `${format12Hour(slots[0].startTime)} – ${format12Hour(slots[0].endTime)}`
                            : doctor.checkingStartTime
                            ? `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`
                            : 'Flexible Outpatient Hours'}
                        </span>
                      </div>

                      <span className="text-[11px] text-[#86868b] font-medium flex-shrink-0">
                        {slots.length > 1 ? `${slots.length} Shifts Today` : 'Scheduled Today'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer: Fee & Booking CTA */}
                <div className="pt-3.5 border-t border-[#f0f0f0] flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-[#86868b] tracking-wider block">
                      Consultation
                    </span>
                    <div className="text-xl font-bold text-[#1d1d1f] tracking-tight leading-none mt-0.5">
                      ${doctor.consultationFee.toFixed(0)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <AppleButton
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                      className="text-xs px-3.5 py-1.5 rounded-full border border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#f5f5f7]"
                    >
                      Details
                    </AppleButton>
                    <AppleButton
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(getBookPath(doctor.id))}
                      className="text-xs px-4 py-1.5 rounded-full flex items-center gap-1.5 font-medium shadow-xs"
                    >
                      <span>Book Token</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </AppleButton>
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
