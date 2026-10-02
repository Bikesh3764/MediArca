import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  api,
  Doctor,
  ClinicProfile,
  PublicClinicDoctor,
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
import { SearchableSpecialtySelect } from '../components/ui/SearchableSpecialtySelect';
import { INDIAN_STATES, getCitiesForState } from '../utils/indiaStates';
import {
  Search,
  MapPin,
  Clock,
  ArrowRight,
  ArrowLeft,
  Building2,
  UserCheck,
  Stethoscope,
  X,
  CheckCircle2,
  SlidersHorizontal,
  Phone,
  ExternalLink,
} from 'lucide-react';

const getClinicLocationDisplay = (clinic?: { address?: string; city?: string | null; state?: string | null } | null): string => {
  if (!clinic) return 'Clinical Facility';
  const addressParts: string[] = [];
  const addrLower = (clinic.address || '').toLowerCase();
  if (clinic.address) addressParts.push(clinic.address);
  if (clinic.city && !addrLower.includes(clinic.city.toLowerCase())) {
    addressParts.push(clinic.city);
  }
  if (clinic.state && !addrLower.includes(clinic.state.toLowerCase())) {
    addressParts.push(clinic.state);
  }
  return addressParts.join(', ') || 'Clinical Facility';
};

export const Home: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active section tab: 'clinics' or 'doctors'
  const initialSection = searchParams.get('tab') === 'doctors' ? 'doctors' : 'clinics';
  const [activeSection, setActiveSection] = useState<'clinics' | 'doctors'>(initialSection);

  // Data State
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinics, setClinics] = useState<ClinicProfile[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingClinics, setLoadingClinics] = useState(true);

  // Clinic Selection State (for deep clinic view & doctor booking)
  const [selectedClinic, setSelectedClinic] = useState<ClinicProfile | null>(null);

  // Dedicated Clinic Search & Filter State
  const [clinicSearchQuery, setClinicSearchQuery] = useState('');
  const [clinicSelectedCity, setClinicSelectedCity] = useState('All');
  const [clinicSelectedState, setClinicSelectedState] = useState('All');

  // Dedicated Doctor Search & Filter State
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');
  const [doctorLocationQuery, setDoctorLocationQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [selectedCity, setSelectedCity] = useState('All');
  const [selectedState, setSelectedState] = useState('All');
  const [maxFee, setMaxFee] = useState<number>(3000);
  const [sortBy, setSortBy] = useState<'rating' | 'experience' | 'fee_low' | 'fee_high'>('rating');
  const [minExperience, setMinExperience] = useState<number>(0);
  const [doctorMobileFiltersOpen, setDoctorMobileFiltersOpen] = useState(false);

  // Synchronize section tab changes
  const handleSectionSwitch = (section: 'clinics' | 'doctors') => {
    setActiveSection(section);
    setSelectedClinic(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', section);
    setSearchParams(newParams, { replace: true });
  };

  // Fetch Doctors and Clinics
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [docsData, clinicsData] = await Promise.all([
          api.getDoctors(),
          api.getPublicClinics(),
        ]);
        setDoctors(docsData);
        setClinics(clinicsData);
      } catch (err) {
        console.error('Failed to load discovery data:', err);
      } finally {
        setLoadingDoctors(false);
        setLoadingClinics(false);
      }
    };
    fetchData();
  }, []);

  // Available Cities for Clinics - only populated when a specific state is selected
  const availableClinicCities = useMemo(() => {
    if (clinicSelectedState === 'All') {
      return [];
    }
    return getCitiesForState(clinicSelectedState);
  }, [clinicSelectedState]);

  // Available Cities for Doctors - only populated when a specific state is selected
  const availableDoctorCities = useMemo(() => {
    if (selectedState === 'All') {
      return [];
    }
    return getCitiesForState(selectedState);
  }, [selectedState]);

  // Compute specialty counts for doctors
  const specialtyCounts = useMemo(() => {
    const counts: Record<string, number> = { All: doctors.length };
    ALL_SPECIALTIES.forEach((s) => {
      counts[s] = doctors.filter((d) => d.specialty.toLowerCase() === s.toLowerCase()).length;
    });
    return counts;
  }, [doctors]);

  // Filtered Clinics List
  const filteredClinics = useMemo(() => {
    return clinics.filter((c) => {
      if (clinicSelectedState !== 'All') {
        const sLower = clinicSelectedState.toLowerCase();
        const matchesState =
          (c.state && c.state.toLowerCase() === sLower) ||
          (c.address && c.address.toLowerCase().includes(sLower));
        if (!matchesState) return false;
      }
      if (clinicSelectedCity !== 'All') {
        const cLower = clinicSelectedCity.toLowerCase();
        const matchesCity =
          (c.city && c.city.toLowerCase() === cLower) ||
          (c.address && c.address.toLowerCase().includes(cLower));
        if (!matchesCity) return false;
      }
      if (clinicSearchQuery.trim()) {
        const q = clinicSearchQuery.toLowerCase().trim();
        const matchName = c.clinicName.toLowerCase().includes(q);
        const matchAddr = c.address.toLowerCase().includes(q);
        const matchCity = c.city?.toLowerCase().includes(q);
        const matchState = c.state?.toLowerCase().includes(q);
        if (!matchName && !matchAddr && !matchCity && !matchState) {
          return false;
        }
      }
      return true;
    });
  }, [clinics, clinicSearchQuery, clinicSelectedCity, clinicSelectedState]);

  // Filtered Doctors List
  const filteredDoctors = useMemo(() => {
    return doctors
      .filter((doc) => {
        if (selectedSpecialty !== 'All' && doc.specialty.toLowerCase() !== selectedSpecialty.toLowerCase()) {
          return false;
        }

        if (doctorSearchQuery.trim()) {
          const q = doctorSearchQuery.toLowerCase().trim();
          const matchesName = doc.user.fullName.toLowerCase().includes(q);
          const matchesSpec = doc.specialty.toLowerCase().includes(q);
          const matchesQual = doc.qualifications?.toLowerCase().includes(q);
          const matchesBio = doc.bio?.toLowerCase().includes(q);
          if (!matchesName && !matchesSpec && !matchesQual && !matchesBio) {
            return false;
          }
        }

        if (doctorLocationQuery.trim()) {
          const lq = doctorLocationQuery.toLowerCase().trim();
          const matchesClinic = doc.clinicAddress?.toLowerCase().includes(lq);
          const matchesAffiliated = doc.clinics?.some((c) =>
            (c.clinic?.address && c.clinic.address.toLowerCase().includes(lq)) ||
            (c.clinic?.city && c.clinic.city.toLowerCase().includes(lq)) ||
            (c.clinic?.state && c.clinic.state.toLowerCase().includes(lq)) ||
            (c.clinic?.clinicName && c.clinic.clinicName.toLowerCase().includes(lq))
          );
          if (!matchesClinic && !matchesAffiliated) {
            return false;
          }
        }

        if (minExperience > 0 && doc.experienceYears < minExperience) {
          return false;
        }

        if (selectedState !== 'All') {
          const sLower = selectedState.toLowerCase();
          const matchesState =
            doc.clinics?.some((c) => c.clinic?.state?.toLowerCase() === sLower) ||
            Boolean(doc.clinicAddress?.toLowerCase().includes(sLower));
          if (!matchesState) return false;
        }

        if (selectedCity !== 'All') {
          const cLower = selectedCity.toLowerCase();
          const matchesCity =
            doc.clinics?.some((c) => c.clinic?.city?.toLowerCase() === cLower) ||
            Boolean(doc.clinicAddress?.toLowerCase().includes(cLower));
          if (!matchesCity) return false;
        }

        if (maxFee < 3000 && doc.consultationFee > maxFee) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'fee_low') return a.consultationFee - b.consultationFee;
        if (sortBy === 'fee_high') return b.consultationFee - a.consultationFee;
        if (sortBy === 'experience') return b.experienceYears - a.experienceYears;
        return (b.rating || 5) - (a.rating || 5);
      });
  }, [doctors, selectedSpecialty, selectedState, selectedCity, maxFee, doctorSearchQuery, doctorLocationQuery, minExperience, sortBy]);

  // Doctors practicing at the selected clinic
  const clinicPracticingDoctors = useMemo(() => {
    if (!selectedClinic) return [];
    if (selectedClinic.doctors && selectedClinic.doctors.length > 0) {
      return selectedClinic.doctors;
    }
    // Fallback: match from full doctor catalog by clinic ID
    const matched = doctors.filter((d) =>
      d.clinics?.some((c) => c.clinicId === selectedClinic.id || c.clinic?.id === selectedClinic.id)
    );
    return matched.map((d) => {
      const cd = d.clinics?.find((c) => c.clinicId === selectedClinic.id || c.clinic?.id === selectedClinic.id);
      return {
        id: cd?.id || `cd_${d.id}`,
        clinicId: selectedClinic.id,
        doctorId: d.id,
        status: 'ACCEPTED',
        consultationFee: cd?.consultationFee ?? d.consultationFee,
        slots: cd?.slots || d.slots,
        doctor: d,
      } as PublicClinicDoctor;
    });
  }, [selectedClinic, doctors]);

  const resetDoctorFilters = () => {
    setDoctorSearchQuery('');
    setDoctorLocationQuery('');
    setSelectedSpecialty('All');
    setSelectedState('All');
    setSelectedCity('All');
    setMaxFee(3000);
    setMinExperience(0);
    setSortBy('rating');
  };

  const resetClinicFilters = () => {
    setClinicSearchQuery('');
    setClinicSelectedCity('All');
    setClinicSelectedState('All');
  };

  const getDoctorDetailPath = (docId: string) =>
    user?.role === 'PATIENT' ? `/patient/doctor/${docId}` : `/doctor/${docId}`;

  const getDoctorBookPath = (docId: string, clinicId?: string, slotId?: string) => {
    const params = new URLSearchParams();
    if (clinicId) params.append('clinic', clinicId);
    if (slotId) params.append('slot', slotId);
    const qs = params.toString();
    const basePath = user?.role === 'PATIENT' ? `/patient/book/${docId}` : `/book/${docId}`;
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f5f7]">
      {/* 1. Hero Section - Apple HIG Minimalist Canvas */}
      <section className="relative overflow-hidden border-b border-[#e5e5ea] bg-[#f5f5f7] py-16 sm:py-20 md:py-24 px-4 sm:px-6 flex items-center justify-center">
        <div className="relative z-10 max-w-4xl mx-auto text-center w-full">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold text-[#1d1d1f] tracking-tight leading-[1.07]">
            Certified clinics & <span className="text-[#0066cc]">specialists</span> across India.
          </h1>
        </div>
      </section>

      {/* 2. Main Discovery Workspace */}
      <section id="catalog-section" className="w-full max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8 sm:py-12 flex-1">
        {/* Navigation & Segmented Tabs Bar */}
        <div className="flex items-center justify-between gap-4 mb-8 pb-4 border-b border-[#e5e5ea]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex p-1 bg-[#e5e5ea] rounded-full border border-[#d2d2d7]/50">
              <button
                type="button"
                onClick={() => handleSectionSwitch('clinics')}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer active:scale-95 ${
                  activeSection === 'clinics'
                    ? 'bg-white text-[#1d1d1f]'
                    : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                <Building2 className={`w-4 h-4 ${activeSection === 'clinics' ? 'text-[#0066cc]' : 'text-[#86868b]'}`} />
                <span>Clinics</span>
              </button>
              <button
                type="button"
                onClick={() => handleSectionSwitch('doctors')}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer active:scale-95 ${
                  activeSection === 'doctors'
                    ? 'bg-white text-[#1d1d1f]'
                    : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                <Stethoscope className={`w-4 h-4 ${activeSection === 'doctors' ? 'text-[#0066cc]' : 'text-[#86868b]'}`} />
                <span>Doctors</span>
              </button>
            </div>

            {activeSection === 'doctors' && (
              <button
                type="button"
                onClick={() => navigate(user?.role === 'PATIENT' ? '/patient/doctors' : '/doctors')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#0066cc] hover:text-[#0071e3] hover:bg-[#0066cc]/5 transition-all cursor-pointer active:scale-95"
              >
                <span>Browse Dedicated Doctor Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* SECTION A: CLINICS DISCOVERY */}
        {activeSection === 'clinics' && (
          <div>
            {/* If a clinic is selected, show its full dedicated view with practicing doctors & time slots */}
            {selectedClinic ? (
              <div className="space-y-8 animate-fadeIn">
                {/* Back button */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedClinic(null)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#e5e5ea] text-xs font-semibold text-[#1d1d1f] hover:border-[#0066cc] hover:text-[#0066cc] transition-all cursor-pointer shadow-2xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to All Clinics</span>
                  </button>

                  <div className="flex items-center gap-1.5 text-xs text-[#0066cc] font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verified Clinical Center</span>
                  </div>
                </div>

                {/* Selected Clinic Header Card */}
                <div className="bg-white rounded-[24px] border border-[#e0e0e0] p-6 sm:p-8">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0066cc]/10 text-[#0066cc] text-xs font-semibold mb-3 border border-[#0066cc]/20">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Clinical Facility</span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight mb-2">
                        {selectedClinic.clinicName}
                      </h2>
                      <div className="space-y-1.5 text-xs text-[#7a7a7a]">
                        <p className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                          <span>
                            {getClinicLocationDisplay(selectedClinic)}
                          </span>
                        </p>
                        {selectedClinic.phone && (
                          <p className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                            <span>{selectedClinic.phone}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <div className="px-4 py-3 rounded-2xl bg-[#f5f5f7] border border-[#e0e0e0] text-center min-w-[130px]">
                        <span className="block text-2xl font-semibold text-[#1d1d1f] tracking-tight">
                          {clinicPracticingDoctors.length}
                        </span>
                        <span className="text-[11px] text-[#86868b] font-normal">
                          Practicing Specialists
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Practicing Doctors & Time Slots Section */}
                <div>
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-[#1d1d1f] tracking-tight">
                      Available Doctors at {selectedClinic.clinicName}
                    </h3>
                    <p className="text-xs text-[#86868b] mt-1">
                      Choose any specialist below to book directly into their scheduled time slots at this facility.
                    </p>
                  </div>

                  {clinicPracticingDoctors.length === 0 ? (
                    <div className="bg-white rounded-[20px] border border-[#e0e0e0] p-12 text-center max-w-md mx-auto">
                      <Stethoscope className="w-8 h-8 text-[#86868b] mx-auto mb-3" />
                      <h4 className="text-sm font-semibold text-[#1d1d1f] mb-1">
                        No specialists currently listed
                      </h4>
                      <p className="text-xs text-[#86868b] mb-4">
                        This facility is active, but doctor shifts are being updated. Check back shortly.
                      </p>
                      <AppleButton variant="secondary" size="sm" onClick={() => setSelectedClinic(null)}>
                        Explore Other Clinics
                      </AppleButton>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {clinicPracticingDoctors.map((docItem) => {
                        const doctor = docItem.doctor;
                        const slots = parseDoctorSlots({
                          ...doctor,
                          slots: docItem.slots || doctor.slots,
                        });
                        const effectiveFee = docItem.consultationFee ?? doctor.consultationFee;
                        const cleanDegrees = formatDoctorDegrees(doctor.qualifications);
                        const todayStr = getLocalDateString();
                        const now = new Date();

                        return (
                          <div
                            key={doctor.id}
                            className="bg-white rounded-[20px] border border-[#e0e0e0] p-5 hover:border-[#0066cc]/40 transition-all flex flex-col justify-between"
                          >
                            <div>
                              {/* Doctor Head Info */}
                              <div className="flex items-start gap-3 mb-4">
                                <div className="w-14 h-14 rounded-2xl bg-[#f5f5f7] border border-[#e0e0e0] overflow-hidden shrink-0 flex items-center justify-center">
                                  {doctor.user?.avatarUrl ? (
                                    <img
                                      src={getFileUrl(doctor.user.avatarUrl)}
                                      alt={doctor.user.fullName}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <span className="font-semibold text-lg text-[#0066cc]">
                                      {doctor.user.fullName.replace(/^Dr\.\s*/i, '')[0] || 'D'}
                                    </span>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <h4
                                      onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                                      className="text-base font-semibold text-[#1d1d1f] hover:text-[#0066cc] cursor-pointer tracking-tight truncate"
                                      title={doctor.user.fullName}
                                    >
                                      {doctor.user.fullName}
                                    </h4>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />
                                  </div>

                                  {/* Specialty & Clean Degrees (NO FACC) */}
                                  <p className="text-xs text-[#86868b] truncate mt-0.5">
                                    <span className="text-[#0066cc] font-semibold">{doctor.specialty}</span>
                                    {cleanDegrees ? ` • ${cleanDegrees}` : ''}
                                  </p>

                                  <div className="mt-1 flex items-center gap-2">
                                    <span className="text-[11px] font-normal text-[#48484a] bg-[#f5f5f7] px-2 py-0.5 rounded-full border border-[#e0e0e0]">
                                      {doctor.experienceYears} yrs exp
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Time Slots / Shifts at this clinic */}
                              <div className="mb-4">
                                <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">
                                  Practicing Shifts at Facility
                                </label>
                                <div className="space-y-1.5">
                                  {slots.map((slot) => {
                                    const _status = evaluateSlotStatus(slot, todayStr, 0, now);
                                    return (
                                      <div
                                        key={slot.id}
                                        className="p-2.5 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] flex items-center justify-between gap-2 text-xs"
                                      >
                                        <div className="min-w-0">
                                          <p className="font-semibold text-[#1d1d1f] truncate">
                                            {slot.name}
                                          </p>
                                          <p className="text-[11px] text-[#86868b] flex items-center gap-1 mt-0.5">
                                            <Clock className="w-3 h-3 text-[#86868b]" />
                                            <span>
                                              {format12Hour(slot.startTime)} – {format12Hour(slot.endTime)}
                                            </span>
                                          </p>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            navigate(getDoctorBookPath(doctor.id, selectedClinic.id, slot.id))
                                          }
                                          className="px-3.5 py-1.5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-[11px] font-normal transition-all active:scale-95 shrink-0 cursor-pointer"
                                        >
                                          Book Slot
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Card Footer: Fee & Booking */}
                            <div className="pt-3 border-t border-[#f0f0f2] flex items-center justify-between">
                              <div>
                                <span className="text-lg font-semibold text-[#1d1d1f] tracking-tight">
                                  ₹{effectiveFee.toFixed(0)}
                                </span>
                                <span className="text-xs text-[#86868b]"> / visit</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => navigate(getDoctorBookPath(doctor.id, selectedClinic.id))}
                                className="px-5 py-2 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-normal transition-all active:scale-95 cursor-pointer"
                              >
                                Book Appointment
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* If no clinic is selected, show clinic search & list of verified clinics */
              <div className="space-y-6">
                {/* Dedicated Clinic Search Bar (Apple Pill Style) */}
                <div className="bg-white p-3 rounded-[20px] sm:rounded-full border border-[#e0e0e0] flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex items-center gap-2.5 flex-1 w-full px-3">
                    <Search className="w-4 h-4 text-[#86868b] shrink-0" />
                    <input
                      type="text"
                      value={clinicSearchQuery}
                      onChange={(e) => setClinicSearchQuery(e.target.value)}
                      placeholder="Search clinics by name, address, or locality..."
                      className="w-full bg-transparent text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
                    />
                    {clinicSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setClinicSearchQuery('')}
                        className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="hidden sm:block w-px h-6 bg-[#e0e0e0]" />

                  {/* State Filter */}
                  <div className="w-full sm:w-44 px-3 py-1">
                    <select
                      value={clinicSelectedState}
                      onChange={(e) => {
                        setClinicSelectedState(e.target.value);
                        setClinicSelectedCity('All');
                      }}
                      className="w-full bg-transparent text-xs sm:text-sm font-normal text-[#1d1d1f] focus:outline-none cursor-pointer"
                    >
                      <option value="All">All States</option>
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="hidden sm:block w-px h-6 bg-[#e0e0e0]" />

                  {/* City Filter */}
                  <div className="w-full sm:w-44 px-3 py-1">
                    <select
                      value={clinicSelectedCity}
                      onChange={(e) => setClinicSelectedCity(e.target.value)}
                      className="w-full bg-transparent text-xs sm:text-sm font-normal text-[#1d1d1f] focus:outline-none cursor-pointer"
                    >
                      <option value="All">
                        {clinicSelectedState !== 'All' ? `All Cities in ${clinicSelectedState}` : 'All Cities'}
                      </option>
                      {availableClinicCities.map((ct) => (
                        <option key={ct} value={ct}>
                          {ct}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(clinicSearchQuery || clinicSelectedCity !== 'All' || clinicSelectedState !== 'All') && (
                    <button
                      type="button"
                      onClick={resetClinicFilters}
                      className="px-4 py-2 rounded-full text-xs font-normal text-[#86868b] hover:text-[#1d1d1f] cursor-pointer active:scale-95"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Clinics Cards Grid */}
                {loadingClinics ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className="h-64 rounded-[20px] bg-white border border-[#e0e0e0] animate-pulse p-6"
                      />
                    ))}
                  </div>
                ) : filteredClinics.length === 0 ? (
                  <div className="bg-white rounded-[24px] border border-[#e0e0e0] p-12 text-center max-w-md mx-auto">
                    <Building2 className="w-10 h-10 text-[#86868b] mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-[#1d1d1f] mb-1">
                      No clinics matched your search
                    </h3>
                    <p className="text-xs text-[#86868b] mb-5">
                      Try adjusting your city filter or searching for another clinic name.
                    </p>
                    <AppleButton variant="secondary" size="sm" onClick={resetClinicFilters}>
                      Clear Clinic Filters
                    </AppleButton>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredClinics.map((clinic) => {
                      const docCount = clinic._count?.doctors ?? (clinic.doctors?.length || 0);

                      const locationDisplay = getClinicLocationDisplay(clinic);

                      return (
                        <div
                          key={clinic.id}
                          onClick={() => setSelectedClinic(clinic)}
                          className="bg-white rounded-[20px] border border-[#e0e0e0] p-6 hover:border-[#0066cc]/40 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
                        >
                          <div>
                            {/* Card Top Row */}
                            <div className="flex items-center justify-between gap-2 mb-3.5">
                              <div className="w-10 h-10 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[#0066cc] flex items-center justify-center transition-colors group-hover:bg-[#0066cc] group-hover:text-white">
                                <Building2 className="w-5 h-5" />
                              </div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] text-[11px] font-medium border border-[#0066cc]/20">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Verified Clinic</span>
                              </span>
                            </div>

                            {/* Clinic Name */}
                            <h3
                              className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight group-hover:text-[#0066cc] transition-colors mb-2 leading-snug truncate"
                              title={clinic.clinicName}
                            >
                              {clinic.clinicName}
                            </h3>

                            {/* Location & Contact Info */}
                            <div className="space-y-1.5 text-xs text-[#86868b] mb-4">
                              <p className="flex items-start gap-2">
                                <MapPin className="w-3.5 h-3.5 text-[#86868b] shrink-0 mt-0.5" />
                                <span className="line-clamp-2 leading-relaxed text-[#7a7a7a]">
                                  {locationDisplay}
                                </span>
                              </p>
                              {clinic.phone && (
                                <p className="flex items-center gap-2 text-[#86868b]">
                                  <Phone className="w-3.5 h-3.5 shrink-0" />
                                  <span>{clinic.phone}</span>
                                </p>
                              )}
                            </div>

                            {/* Specialists Available Capsule */}
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f5f5f7] text-[#1d1d1f] text-xs font-medium border border-[#e0e0e0]">
                              <Stethoscope className="w-3.5 h-3.5 text-[#0066cc]" />
                              <span>{docCount === 1 ? '1 Specialist Practicing' : `${docCount} Specialists Practicing`}</span>
                            </div>
                          </div>

                          {/* Refined Apple Footer CTA */}
                          <div className="mt-5 pt-3.5 border-t border-[#f0f0f2] flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs text-[#86868b] min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#34c759] shrink-0" />
                              <span className="truncate">{docCount > 0 ? 'Accepting Patients' : 'Clinical Facility'}</span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClinic(clinic);
                              }}
                              className="h-8 px-4 sm:px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-medium transition-all active:scale-95 inline-flex items-center gap-1.5 shrink-0 cursor-pointer shadow-none"
                            >
                              <span>View Doctors & Slots</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SECTION B: DOCTORS DISCOVERY */}
        {activeSection === 'doctors' && (
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Desktop Left Filter Sidebar */}
            <aside className="hidden lg:block w-72 bg-white rounded-[20px] border border-[#e0e0e0] p-5 shrink-0">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#f0f0f2]">
                <h3 className="text-sm font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-[#0066cc]" />
                  <span>Filter Practitioners</span>
                </h3>
                <button
                  type="button"
                  onClick={resetDoctorFilters}
                  className="text-xs text-[#0066cc] hover:underline"
                >
                  Reset
                </button>
              </div>

              <div className="space-y-4">
                {/* Specialty */}
                <div>
                  <label className="block text-xs font-semibold text-[#48484a] mb-1">
                    Specialty
                  </label>
                  <SearchableSpecialtySelect
                    value={selectedSpecialty}
                    onChange={setSelectedSpecialty}
                    variant="form"
                    includeAll={true}
                    counts={specialtyCounts}
                  />
                </div>

                {/* State */}
                <div>
                  <label className="block text-xs font-semibold text-[#48484a] mb-1">
                    State
                  </label>
                  <select
                    value={selectedState}
                    onChange={(e) => {
                      setSelectedState(e.target.value);
                      setSelectedCity('All');
                    }}
                    className="w-full py-2 px-3 rounded-xl border border-[#e0e0e0] bg-[#f5f5f7] text-xs font-medium text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] cursor-pointer"
                  >
                    <option value="All">All States</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                {/* City */}
                <div>
                  <label className="block text-xs font-semibold text-[#48484a] mb-1">
                    City
                  </label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl border border-[#e0e0e0] bg-[#f5f5f7] text-xs font-medium text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] cursor-pointer"
                  >
                    <option value="All">
                      {selectedState !== 'All' ? `All Cities in ${selectedState}` : 'All Cities'}
                    </option>
                    {availableDoctorCities.map((ct) => (
                      <option key={ct} value={ct}>
                        {ct}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Max Fee */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-[#48484a] mb-1">
                    <span>Max Fee</span>
                    <span className="text-[#0066cc]">₹{maxFee}</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="3000"
                    step="100"
                    value={maxFee}
                    onChange={(e) => setMaxFee(Number(e.target.value))}
                    className="w-full accent-[#0066cc] cursor-pointer"
                  />
                </div>

                {/* Min Experience */}
                <div>
                  <label className="block text-xs font-semibold text-[#48484a] mb-1">
                    Min Experience (Years)
                  </label>
                  <select
                    value={minExperience}
                    onChange={(e) => setMinExperience(Number(e.target.value))}
                    className="w-full py-2 px-3 rounded-xl border border-[#e0e0e0] bg-[#f5f5f7] text-xs font-medium text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] cursor-pointer"
                  >
                    <option value={0}>Any Experience</option>
                    <option value={5}>5+ Years</option>
                    <option value={10}>10+ Years</option>
                    <option value={15}>15+ Years</option>
                  </select>
                </div>
              </div>
            </aside>

            {/* Main Doctor Grid */}
            <div className="flex-1 w-full space-y-6">
              {/* Doctor Search Bar */}
              <div className="bg-white p-3 rounded-[20px] sm:rounded-full border border-[#e0e0e0] flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center gap-2.5 flex-1 w-full px-3">
                  <Search className="w-4 h-4 text-[#86868b] shrink-0" />
                  <input
                    type="text"
                    value={doctorSearchQuery}
                    onChange={(e) => setDoctorSearchQuery(e.target.value)}
                    placeholder="Search doctors by name, specialty, qualifications..."
                    className="w-full bg-transparent text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
                  />
                  {doctorSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDoctorSearchQuery('')}
                      className="text-[#86868b] hover:text-[#1d1d1f]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="hidden sm:block w-px h-6 bg-[#e0e0e0]" />

                <div className="flex items-center gap-2.5 w-full sm:w-48 px-3">
                  <MapPin className="w-4 h-4 text-[#86868b] shrink-0" />
                  <input
                    type="text"
                    value={doctorLocationQuery}
                    onChange={(e) => setDoctorLocationQuery(e.target.value)}
                    placeholder="City or locality..."
                    className="w-full bg-transparent text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
                  />
                </div>

                {/* Mobile Filter Toggle */}
                <button
                  type="button"
                  onClick={() => setDoctorMobileFiltersOpen(!doctorMobileFiltersOpen)}
                  className="lg:hidden px-4 py-2 rounded-full border border-[#e0e0e0] bg-[#f5f5f7] text-xs font-medium text-[#1d1d1f] flex items-center gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Filters</span>
                </button>
              </div>

              {/* Mobile Collapsible Filters */}
              {doctorMobileFiltersOpen && (
                <div className="lg:hidden bg-white p-4 rounded-[20px] border border-[#e0e0e0] space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#48484a] mb-1">
                      Specialty
                    </label>
                    <SearchableSpecialtySelect
                      value={selectedSpecialty}
                      onChange={setSelectedSpecialty}
                      variant="form"
                      includeAll={true}
                      counts={specialtyCounts}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-[#48484a] mb-1">
                        State
                      </label>
                      <select
                        value={selectedState}
                        onChange={(e) => {
                          setSelectedState(e.target.value);
                          setSelectedCity('All');
                        }}
                        className="w-full py-2 px-2.5 rounded-xl border border-[#e0e0e0] bg-[#f5f5f7] text-xs"
                      >
                        <option value="All">All States</option>
                        {INDIAN_STATES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#48484a] mb-1">
                        City
                      </label>
                      <select
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                        className="w-full py-2 px-2.5 rounded-xl border border-[#e0e0e0] bg-[#f5f5f7] text-xs"
                      >
                        <option value="All">
                          {selectedState !== 'All' ? `All Cities in ${selectedState}` : 'All Cities'}
                        </option>
                        {availableDoctorCities.map((ct) => (
                          <option key={ct} value={ct}>
                            {ct}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Doctor Cards Grid */}
              {loadingDoctors ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="h-80 rounded-[20px] bg-white border border-[#e0e0e0] animate-pulse p-4"
                    />
                  ))}
                </div>
              ) : filteredDoctors.length === 0 ? (
                <div className="bg-white rounded-[24px] border border-[#e0e0e0] p-12 text-center max-w-md mx-auto">
                  <Stethoscope className="w-10 h-10 text-[#86868b] mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-[#1d1d1f] mb-1">
                    No doctors match criteria
                  </h3>
                  <p className="text-xs text-[#86868b] mb-5">
                    Try adjusting your search keywords, clearing location, or exploring all specialties.
                  </p>
                  <AppleButton variant="secondary" size="sm" onClick={resetDoctorFilters}>
                    Clear Doctor Filters
                  </AppleButton>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredDoctors.map((doctor) => {
                    const slots = parseDoctorSlots(doctor);
                    // Strictly sanitize doctor degrees to legitimate medical degrees only (NO FACC!)
                    const cleanDegrees = formatDoctorDegrees(doctor.qualifications);
                    const primaryClinic = doctor.clinics?.find((c) => c?.clinic)?.clinic || null;

                    return (
                      <div
                        key={doctor.id}
                        className="w-full bg-white rounded-[20px] border border-[#e0e0e0] overflow-hidden hover:border-[#0066cc]/30 transition-all duration-200 flex flex-col justify-between group"
                      >
                        {/* Top Photo Banner */}
                        <div
                          onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                          className="relative w-full aspect-[16/10] bg-[#f5f5f7] border-b border-[#f0f0f2] overflow-hidden cursor-pointer flex items-center justify-center"
                        >
                          {doctor.user?.avatarUrl ? (
                            <img
                              src={getFileUrl(doctor.user.avatarUrl)}
                              alt={doctor.user.fullName}
                              className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.parentElement?.querySelector('.doc-fallback-banner');
                                if (fallback) (fallback as HTMLElement).style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            className={`doc-fallback-banner w-full h-full ${
                              doctor.user?.avatarUrl ? 'hidden' : 'flex'
                            } items-center justify-center font-bold text-3xl text-white bg-[#0066cc] select-none`}
                          >
                            {(doctor.user?.fullName ? doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] : null) || 'D'}
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <div>
                            {/* Doctor Name & Experience Badge */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <h3
                                    onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                                    className="text-[17px] font-semibold text-[#1d1d1f] hover:text-[#0066cc] cursor-pointer tracking-tight transition-colors truncate"
                                    title={doctor.user.fullName}
                                  >
                                    {doctor.user.fullName}
                                  </h3>
                                  <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0" />
                                </div>

                                {/* Specialty & Clean Degrees (NO FACC!) */}
                                <p className="mt-1 text-xs text-[#86868b] truncate font-normal">
                                  <span className="text-[#0066cc] font-medium">{doctor.specialty}</span>
                                  {cleanDegrees ? ` • ${cleanDegrees}` : ''}
                                </p>
                              </div>

                              <span className="text-[11px] font-medium text-[#48484a] bg-[#f5f5f7] px-2.5 py-1 rounded-full border border-[#e0e0e0] shrink-0">
                                {doctor.experienceYears} yrs exp
                              </span>
                            </div>

                            {/* Clinical Practice Venue & Timing */}
                            <div className="mt-4 space-y-2 text-xs text-[#636366]">
                              <div className="flex items-center gap-2 min-w-0">
                                <MapPin className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                                <span className="truncate text-[#1d1d1f]">
                                  {primaryClinic ? (
                                    <>
                                      <span className="font-medium">{primaryClinic.clinicName}</span>
                                      {primaryClinic.city ? ` • ${primaryClinic.city}` : ''}
                                    </>
                                  ) : (
                                    <span>Direct Clinic Practice</span>
                                  )}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 min-w-0 text-[#86868b]">
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate text-[11px]">
                                  {slots.length > 0
                                    ? `${format12Hour(slots[0].startTime)} – ${format12Hour(slots[0].endTime)}`
                                    : doctor.checkingStartTime
                                    ? `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`
                                    : 'Outpatient Shift'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Footer: Fee & Booking */}
                          <div className="mt-4 pt-3.5 border-t border-[#f0f0f2] flex items-center justify-between">
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-semibold text-[#1d1d1f] tracking-tight">
                                ₹{doctor.consultationFee.toFixed(0)}
                              </span>
                              <span className="text-xs text-[#86868b] font-normal">/ visit</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => navigate(getDoctorBookPath(doctor.id, primaryClinic?.id))}
                              className="h-8 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-medium transition-all active:scale-95 cursor-pointer"
                            >
                              Book
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 3. Operational Portals Section (Pristine Apple HIG Style) */}
      <section className="bg-white border-t border-[#e0e0e0] py-12 px-4 sm:px-6 mt-10">
        <div className="max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
          <div className="text-center max-w-xl mx-auto mb-8">
            <h3 className="text-xl font-semibold text-[#1d1d1f] tracking-tight">
              Operational Portals
            </h3>
            <p className="text-xs text-[#86868b] mt-1">
              Select your role to access management consoles and digital clinic desks.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Patient Portal */}
            <div
              onClick={() => navigate(user?.role === 'PATIENT' ? '/patient/appointments' : '/patient/login')}
              className="p-5 rounded-[20px] bg-[#f5f5f7] hover:bg-white border border-[#e0e0e0] hover:border-[#0066cc]/40 cursor-pointer transition-all duration-200 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white border border-[#e0e0e0] text-[#0066cc] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <UserCheck className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#1d1d1f] group-hover:text-[#0066cc] transition-colors">
                  Patient Portal
                </h4>
              </div>
              <ArrowRight className="w-4 h-4 text-[#86868b] group-hover:text-[#0066cc] group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* Doctor Console */}
            <div
              onClick={() => navigate(user?.role === 'DOCTOR' ? '/doctor/dashboard' : '/doctor/login')}
              className="p-5 rounded-[20px] bg-[#f5f5f7] hover:bg-white border border-[#e0e0e0] hover:border-[#0066cc]/40 cursor-pointer transition-all duration-200 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white border border-[#e0e0e0] text-[#0066cc] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#1d1d1f] group-hover:text-[#0066cc] transition-colors">
                  Doctor Console
                </h4>
              </div>
              <ArrowRight className="w-4 h-4 text-[#86868b] group-hover:text-[#0066cc] group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* Clinic Partner Portal */}
            <div
              onClick={() => navigate(user?.role === 'CLINIC' ? '/clinic/dashboard' : '/clinic/login')}
              className="p-5 rounded-[20px] bg-[#f5f5f7] hover:bg-white border border-[#e0e0e0] hover:border-[#0066cc]/40 cursor-pointer transition-all duration-200 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white border border-[#e0e0e0] text-[#0066cc] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Building2 className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#1d1d1f] group-hover:text-[#0066cc] transition-colors">
                  Clinic Portal
                </h4>
              </div>
              <ArrowRight className="w-4 h-4 text-[#86868b] group-hover:text-[#0066cc] group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* Receptionist Desk */}
            <div
              onClick={() => navigate(user?.role === 'RECEPTIONIST' ? '/receptionist/dashboard' : '/receptionist/login')}
              className="p-5 rounded-[20px] bg-[#f5f5f7] hover:bg-white border border-[#e0e0e0] hover:border-[#0066cc]/40 cursor-pointer transition-all duration-200 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white border border-[#e0e0e0] text-[#0066cc] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Clock className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#1d1d1f] group-hover:text-[#0066cc] transition-colors">
                  Reception Desk
                </h4>
              </div>
              <ArrowRight className="w-4 h-4 text-[#86868b] group-hover:text-[#0066cc] group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
