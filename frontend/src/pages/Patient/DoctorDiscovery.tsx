import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, Doctor, parseDoctorSlots, format12Hour } from '../../services/api';
import { SearchInput } from '../../components/ui/SearchInput';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import { SubNav } from '../../components/layout/SubNav';
import { ShieldCheck, Star, Clock, MapPin, SlidersHorizontal } from 'lucide-react';

const SPECIALTIES = [
  'All',
  'Cardiology',
  'Dermatology',
  'Pediatrics',
  'Orthopedics',
  'General Medicine',
];

export const DoctorDiscovery: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSpecialty = searchParams.get('specialty') || 'All';

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState(initialSpecialty);
  const [sortBy, setSortBy] = useState('rating');

  const navigate = useNavigate();

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDoctors(search, selectedSpecialty, sortBy);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav title="Doctor Directory" subtitle="Verified healthcare practitioners">
        <span className="text-xs text-[#7a7a7a]">
          {doctors.length} Verified Specialist{doctors.length === 1 ? '' : 's'} Available
        </span>
      </SubNav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        {/* Search & Specialty Filter Controls */}
        <div className="bg-white rounded-[20px] border border-[#e0e0e0] p-6 mb-8 shadow-sm">
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
                className="h-11 px-4 rounded-xl border border-[#e0e0e0] text-xs font-medium bg-[#f5f5f7] text-[#1d1d1f] focus:outline-none focus:border-[#0066cc]"
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
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <span className="text-xs font-semibold text-[#7a7a7a] mr-2 flex items-center gap-1 flex-shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#0066cc]" />
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
                    ? 'bg-[#1d1d1f] text-white shadow-sm ring-1 ring-black/10'
                    : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]'
                }`}
              >
                {selectedSpecialty === spec && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2997ff]"></span>
                )}
                {spec}
              </button>
            ))}
          </div>
        </div>

        {/* Doctor Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-72 rounded-[20px] bg-white border border-[#e0e0e0] animate-pulse"></div>
            ))}
          </div>
        ) : doctors.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-[20px] border border-[#e0e0e0] shadow-sm">
            <p className="text-base font-semibold text-[#1d1d1f]">No doctors found matching your criteria.</p>
            <p className="text-xs text-[#7a7a7a] mt-1">Try clearing your search term or selecting 'All' specialties.</p>
            <AppleButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setSelectedSpecialty('All');
                setSearchParams({});
              }}
              className="mt-4"
            >
              Reset All Filters
            </AppleButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctors.map((doctor) => {
              const slots = parseDoctorSlots(doctor);
              return (
                <UtilityCard
                  key={doctor.id}
                  hoverEffect
                  className="flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-16 h-16 rounded-full bg-[#f5f5f7] border border-[#e0e0e0] overflow-hidden flex-shrink-0">
                        {doctor.user.avatarUrl ? (
                          <img
                            src={doctor.user.avatarUrl}
                            alt={doctor.user.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-lg text-[#0066cc]">
                            {doctor.user.fullName[0]}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-[17px] font-semibold text-[#1d1d1f] truncate">
                            {doctor.user.fullName}
                          </h3>
                          <span title="Verified Practitioner by MediArca">
                            <ShieldCheck className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
                          </span>
                        </div>
                        <span className="text-[13px] text-[#0066cc] font-medium block">
                          {doctor.specialty}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-[#7a7a7a] mt-0.5">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span className="font-semibold text-[#1d1d1f]">{doctor.rating.toFixed(1)}</span>
                          <span>({doctor.totalReviews} reviews)</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-[#7a7a7a] line-clamp-2 leading-relaxed mb-4">
                      {doctor.bio}
                    </p>

                    {/* Doctor Checking Schedule Badge */}
                    <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0]/70 space-y-1.5 text-xs text-[#1d1d1f] mb-5">
                      <div className="flex items-center justify-between">
                        <span className="text-[#7a7a7a] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#0066cc]" />
                          Practice Shifts:
                        </span>
                        <strong className="text-[#0066cc] font-semibold">
                          {slots.length > 1
                            ? `${slots.length} Shifts (${format12Hour(slots[0].startTime)}–${format12Hour(slots[0].endTime)})`
                            : `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#7a7a7a]">Experience:</span>
                        <span>{doctor.experienceYears} Years</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#7a7a7a]">Consultation:</span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                          ${doctor.consultationFee} • Zero Upfront
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#f0f0f0] gap-2">
                    <div className="flex items-center gap-1 text-xs text-[#7a7a7a] truncate max-w-[130px]">
                      <MapPin className="w-3 h-3 flex-shrink-0 text-[#0066cc]" />
                      <span className="truncate">{doctor.clinicAddress || 'MediArca Clinic'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <AppleButton
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/doctor/${doctor.id}`)}
                      >
                        Details
                      </AppleButton>
                      <AppleButton
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/book/${doctor.id}`)}
                      >
                        Book Queue
                      </AppleButton>
                    </div>
                  </div>
                </UtilityCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
