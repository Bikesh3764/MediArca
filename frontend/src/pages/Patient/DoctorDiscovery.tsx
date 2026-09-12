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
                className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 shadow-sm hover:shadow-apple-card hover:border-[#0088e8]/40 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  {/* Doctor Header */}
                  <div className="flex items-start gap-4 mb-5">
                    <div
                      onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                      className="w-16 h-16 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex-shrink-0 cursor-pointer transition-transform group-hover:scale-105"
                    >
                      {doctor.user.avatarUrl ? (
                        <img
                          src={doctor.user.avatarUrl}
                          alt={doctor.user.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-semibold text-xl text-[#0088e8]">
                          {doctor.user.fullName[0]}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3
                          onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                          className="text-[18px] font-semibold text-[#1d1d1f] truncate hover:text-[#0088e8] transition-colors cursor-pointer tracking-tight"
                        >
                          {doctor.user.fullName}
                        </h3>
                        <span title="Verified Practitioner by MediArca">
                          <ShieldCheck className="w-4 h-4 text-[#10b981] flex-shrink-0" />
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center text-[11px] font-medium text-[#0088e8] bg-[#0088e8]/10 px-2.5 py-0.5 rounded-full">
                          {doctor.specialty}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#86868b] mt-2">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 flex-shrink-0" />
                        <span className="font-semibold text-[#1d1d1f]">{doctor.rating.toFixed(1)}</span>
                        <span>({doctor.totalReviews} reviews)</span>
                      </div>
                    </div>
                  </div>

                  {/* Apple Spec Tile Info Grid: Experience & Fee */}
                  <div className="grid grid-cols-2 gap-2.5 mb-4">
                    <div className="p-3 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]/70">
                      <span className="text-[10px] uppercase font-semibold text-[#86868b] tracking-wider block">
                        Experience
                      </span>
                      <span className="text-[14px] font-semibold text-[#1d1d1f] mt-0.5 block">
                        {doctor.experienceYears} Years
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]/70">
                      <span className="text-[10px] uppercase font-semibold text-[#86868b] tracking-wider block">
                        Consultation Fee
                      </span>
                      <span className="text-[14px] font-semibold text-[#1d1d1f] mt-0.5 block">
                        ${doctor.consultationFee} <span className="text-[10px] text-[#86868b] font-normal">at clinic</span>
                      </span>
                    </div>
                  </div>

                  {/* Checking Schedule Badge */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]/70 text-xs mb-4">
                    <span className="text-[#86868b] flex items-center gap-1.5 font-normal">
                      <Clock className="w-3.5 h-3.5 text-[#0088e8]" />
                      Checking Shift
                    </span>
                    <strong className="font-semibold text-[#0088e8]">
                      {slots.length > 1
                        ? `${slots.length} Shifts (${format12Hour(slots[0].startTime)}–${format12Hour(slots[0].endTime)})`
                        : `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`}
                    </strong>
                  </div>

                  {/* Dedicated Polished Clinic Address */}
                  <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]/70 text-xs mb-5">
                    <MapPin className="w-3.5 h-3.5 text-[#0088e8] flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-[#1d1d1f] block truncate">
                        {doctor.clinicAddress || 'MediArca Healthcare Clinic'}
                      </span>
                      <span className="text-[11px] text-[#86868b] block mt-0.5">
                        In-Person Outpatient Consultation
                      </span>
                    </div>
                  </div>
                </div>

                {/* Clean Action Buttons */}
                <div className="flex items-center gap-2 pt-3.5 border-t border-[#f0f0f0]">
                  <AppleButton
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                    className="px-4 text-xs font-medium"
                  >
                    Details
                  </AppleButton>
                  <AppleButton
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(getBookPath(doctor.id))}
                    className="flex-1 justify-center flex items-center gap-1.5 font-medium"
                  >
                    <span>Book Appointment</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </AppleButton>
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
