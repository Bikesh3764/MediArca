import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  api,
  Doctor,
  ClinicProfile,
  PublicClinicDoctor,
  parseDoctorSlots,
  format12Hour,
  formatDoctorDegrees,
  ALL_SPECIALTIES,
  getFileUrl,
} from '../services/api';
import { AppleButton } from '../components/ui/AppleButton';
import { SearchableSpecialtySelect } from '../components/ui/SearchableSpecialtySelect';
import { AppleFilterSelect } from '../components/ui/AppleFilterSelect';
import clinicLobbyBg from '../assets/clinic-lobby-bg.jpg';
import healthcareHeroBg from '../assets/healthcare-hero-bg.jpg';
import { INDIAN_STATES, getCitiesForState } from '../utils/indiaStates';
import { formatDisplayPhone } from '../utils/phoneUtils';
import {
  Search,
  MapPin,
  Clock,
  ArrowLeft,
  Building2,
  Stethoscope,
  X,
  SlidersHorizontal,
  Phone,
  RotateCcw,
  ChevronRight,
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

  // Hero Unified Dual Search State
  const [heroSearchQuery, setHeroSearchQuery] = useState('');
  const [heroLocationQuery, setHeroLocationQuery] = useState('');

  const handleHeroSearch = () => {
    const q = heroSearchQuery.trim();
    const loc = heroLocationQuery.trim();
    if (q) {
      setClinicSearchQuery(q);
      setDoctorSearchQuery(q);
    }
    if (loc) {
      setDoctorLocationQuery(loc);
      setClinicSearchQuery((prev) => (prev ? `${prev} ${loc}` : loc));
    }
    const el = document.getElementById('catalog-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

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

  // Clinic State Options with dynamic facility counts
  const clinicStateOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    clinics.forEach((c) => {
      let matchedState = c.state?.trim();
      if (!matchedState && c.address) {
        for (const st of INDIAN_STATES) {
          if (c.address.toLowerCase().includes(st.toLowerCase())) {
            matchedState = st;
            break;
          }
        }
      }
      if (matchedState) {
        counts[matchedState] = (counts[matchedState] || 0) + 1;
      }
    });

    return INDIAN_STATES.map((st) => ({
      label: st,
      value: st,
      count: counts[st] || 0,
    })).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });
  }, [clinics]);

  // Clinic City Options with counts for currently selected state
  const clinicCityOptions = useMemo(() => {
    if (clinicSelectedState === 'All') return [];
    const counts: Record<string, number> = {};
    const cities = getCitiesForState(clinicSelectedState);

    clinics.forEach((c) => {
      const isMatchingState =
        (c.state && c.state.toLowerCase() === clinicSelectedState.toLowerCase()) ||
        (c.address && c.address.toLowerCase().includes(clinicSelectedState.toLowerCase()));
      if (!isMatchingState) return;

      let matchedCity = c.city?.trim();
      if (!matchedCity && c.address) {
        for (const ct of cities) {
          if (c.address.toLowerCase().includes(ct.toLowerCase())) {
            matchedCity = ct;
            break;
          }
        }
      }
      if (matchedCity) {
        counts[matchedCity] = (counts[matchedCity] || 0) + 1;
      }
    });

    return cities.map((ct) => ({
      label: ct,
      value: ct,
      count: counts[ct] || 0,
    })).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });
  }, [clinics, clinicSelectedState]);

  // Doctor State Options with specialist counts
  const doctorStateOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    doctors.forEach((doc) => {
      const statesFound = new Set<string>();
      doc.clinics?.forEach((c) => {
        if (c.clinic?.state) statesFound.add(c.clinic.state.trim());
      });
      if (statesFound.size === 0 && doc.clinicAddress) {
        for (const st of INDIAN_STATES) {
          if (doc.clinicAddress.toLowerCase().includes(st.toLowerCase())) {
            statesFound.add(st);
            break;
          }
        }
      }
      statesFound.forEach((st) => {
        counts[st] = (counts[st] || 0) + 1;
      });
    });

    return INDIAN_STATES.map((st) => ({
      label: st,
      value: st,
      count: counts[st] || 0,
    })).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });
  }, [doctors]);

  // Doctor City Options with specialist counts
  const doctorCityOptions = useMemo(() => {
    if (selectedState === 'All') return [];
    const counts: Record<string, number> = {};
    const cities = getCitiesForState(selectedState);

    doctors.forEach((doc) => {
      const citiesFound = new Set<string>();
      doc.clinics?.forEach((c) => {
        const isMatchState =
          !c.clinic?.state ||
          c.clinic.state.toLowerCase() === selectedState.toLowerCase() ||
          (c.clinic.address && c.clinic.address.toLowerCase().includes(selectedState.toLowerCase()));
        if (isMatchState && c.clinic?.city) {
          citiesFound.add(c.clinic.city.trim());
        }
      });
      if (citiesFound.size === 0 && doc.clinicAddress) {
        for (const ct of cities) {
          if (doc.clinicAddress.toLowerCase().includes(ct.toLowerCase())) {
            citiesFound.add(ct);
            break;
          }
        }
      }
      citiesFound.forEach((ct) => {
        counts[ct] = (counts[ct] || 0) + 1;
      });
    });

    return cities.map((ct) => ({
      label: ct,
      value: ct,
      count: counts[ct] || 0,
    })).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });
  }, [doctors, selectedState]);

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

  const getDoctorDetailPath = (docId: string) => `/book/${docId}`;

  const getDoctorBookPath = (docId: string, clinicId?: string, slotId?: string) => {
    const params = new URLSearchParams();
    if (clinicId) params.append('clinic', clinicId);
    if (slotId) params.append('slot', slotId);
    const qs = params.toString();
    const basePath = `/book/${docId}`;
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f5f7]">
      {/* 1. Hero Section — Clean, Calm, Focused Queue Discovery */}
      <section className="relative overflow-hidden border-b border-[#e5e5ea] py-12 sm:py-16 md:py-20 px-4 sm:px-6 flex items-center justify-center">
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          <img
            src={healthcareHeroBg}
            alt="Healthcare clinical facility"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px]" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center w-full">
          <h1 className="font-display text-[28px] sm:text-[36px] md:text-[44px] font-semibold text-[#1d1d1f] tracking-[-0.026em] leading-[1.12] max-w-2xl mx-auto">
            Book doctor queue tokens.{' '}
            <span className="text-[#0066cc]">Skip the waiting room.</span>
          </h1>
          <p className="mt-3 text-[14px] sm:text-[16px] text-[#48484a] max-w-xl mx-auto leading-relaxed">
            Find verified clinics and specialists near you, reserve your live queue pass online, and arrive right on time.
          </p>

          {/* Unified Search Experience: Search -> Location -> Find */}
          <div className="mt-7 sm:mt-8 max-w-2xl mx-auto bg-white/95 backdrop-blur-xl p-2 rounded-[20px] sm:rounded-full border border-[#e5e5ea] shadow-apple-hover flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-2.5 flex-1 min-w-0 h-11 sm:h-10 px-3.5">
              <Search className="w-4 h-4 text-[#86868b] shrink-0" />
              <input
                type="text"
                value={heroSearchQuery}
                onChange={(e) => setHeroSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleHeroSearch()}
                placeholder="Doctor, clinic, or specialty..."
                className="w-full bg-transparent text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none truncate"
              />
              {heroSearchQuery && (
                <button
                  type="button"
                  onClick={() => setHeroSearchQuery('')}
                  className="text-[#86868b] hover:text-[#1d1d1f] p-0.5 cursor-pointer shrink-0"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="sm:hidden h-px w-full bg-[#f0f0f2]" />
            <div className="hidden sm:block w-px h-5 bg-[#e5e5ea] shrink-0" />

            <div className="flex items-center gap-2.5 w-full sm:w-48 h-11 sm:h-10 px-3.5 shrink-0">
              <MapPin className="w-4 h-4 text-[#86868b] shrink-0" />
              <input
                type="text"
                value={heroLocationQuery}
                onChange={(e) => setHeroLocationQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleHeroSearch()}
                placeholder="City or location..."
                className="w-full bg-transparent text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none truncate"
              />
              {heroLocationQuery && (
                <button
                  type="button"
                  onClick={() => setHeroLocationQuery('')}
                  className="text-[#86868b] hover:text-[#1d1d1f] p-0.5 cursor-pointer shrink-0"
                  aria-label="Clear location"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <AppleButton
              type="button"
              variant="primary"
              size="md"
              onClick={handleHeroSearch}
              className="w-full sm:w-auto px-6 shrink-0"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </AppleButton>
          </div>
        </div>
      </section>

      {/* 2. Main Discovery Workspace */}
      <section id="catalog-section" className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex-1">
        {/* Navigation & Search Controls Header */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pb-6 mb-6 sm:mb-8 border-b border-[#e5e5ea]">
          {/* Segmented Switcher: Clinics vs Doctors */}
          <div className="h-11 grid grid-cols-2 sm:inline-flex items-center p-1 bg-[#e8e8ed]/70 rounded-full border border-[#e5e5ea] shrink-0">
            <button
              type="button"
              onClick={() => handleSectionSwitch('clinics')}
              className={`h-full flex items-center justify-center gap-2 px-5 rounded-full text-[13px] font-semibold transition-all cursor-pointer active:scale-[0.98] ${
                activeSection === 'clinics'
                  ? 'bg-white text-[#1d1d1f] shadow-2xs'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              <Building2 className={`w-4 h-4 ${activeSection === 'clinics' ? 'text-[#0066cc]' : 'text-[#86868b]'}`} />
              <span>Clinics</span>
            </button>
            <button
              type="button"
              onClick={() => handleSectionSwitch('doctors')}
              className={`h-full flex items-center justify-center gap-2 px-5 rounded-full text-[13px] font-semibold transition-all cursor-pointer active:scale-[0.98] ${
                activeSection === 'doctors'
                  ? 'bg-white text-[#1d1d1f] shadow-2xs'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              <Stethoscope className={`w-4 h-4 ${activeSection === 'doctors' ? 'text-[#0066cc]' : 'text-[#86868b]'}`} />
              <span>Doctors</span>
            </button>
          </div>

          {/* Search & Location Bar for Clinics */}
          {activeSection === 'clinics' && !selectedClinic && (
            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 min-w-0">
              <div className="flex-1 h-11 bg-white px-3.5 rounded-xl sm:rounded-full border border-[#d2d2d7]/80 focus-within:border-[#0066cc] focus-within:ring-[3px] focus-within:ring-[#0066cc]/15 flex items-center gap-2.5 min-w-0 transition-all">
                <Search className="w-4 h-4 text-[#86868b] shrink-0" />
                <input
                  type="text"
                  value={clinicSearchQuery}
                  onChange={(e) => setClinicSearchQuery(e.target.value)}
                  placeholder="Search clinics by name or locality..."
                  className="w-full h-full bg-transparent text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none truncate"
                />
                {clinicSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setClinicSearchQuery('')}
                    className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
                <div className="h-11 bg-white px-3.5 rounded-xl sm:rounded-full border border-[#d2d2d7]/80 flex items-center sm:w-40 min-w-0">
                  <AppleFilterSelect
                    value={clinicSelectedState}
                    onChange={(val) => {
                      setClinicSelectedState(val);
                      setClinicSelectedCity('All');
                    }}
                    options={clinicStateOptions}
                    placeholder="All States"
                    allLabel="All States"
                    allCount={clinics.length}
                    variant="bar"
                    searchable={true}
                  />
                </div>

                <div className="h-11 bg-white px-3.5 rounded-xl sm:rounded-full border border-[#d2d2d7]/80 flex items-center sm:w-40 min-w-0">
                  <AppleFilterSelect
                    value={clinicSelectedCity}
                    onChange={setClinicSelectedCity}
                    options={clinicCityOptions}
                    placeholder={clinicSelectedState !== 'All' ? `All in ${clinicSelectedState}` : 'All Cities'}
                    allLabel={clinicSelectedState !== 'All' ? `All in ${clinicSelectedState}` : 'All Cities'}
                    allCount={
                      clinicSelectedState !== 'All'
                        ? clinics.filter((c) =>
                            (c.state && c.state.toLowerCase() === clinicSelectedState.toLowerCase()) ||
                            (c.address && c.address.toLowerCase().includes(clinicSelectedState.toLowerCase()))
                          ).length
                        : clinics.length
                    }
                    variant="bar"
                    searchable={clinicCityOptions.length > 5}
                  />
                </div>

                {(clinicSearchQuery || clinicSelectedCity !== 'All' || clinicSelectedState !== 'All') && (
                  <button
                    type="button"
                    onClick={resetClinicFilters}
                    className="col-span-2 sm:col-span-1 h-9 sm:h-11 px-3.5 rounded-full text-[13px] font-medium text-[#6e6e73] hover:text-[#1d1d1f] bg-white sm:bg-transparent border border-[#e5e5ea] sm:border-transparent hover:bg-black/[0.04] cursor-pointer active:scale-95 shrink-0"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Search & Location Bar for Doctors */}
          {activeSection === 'doctors' && (
            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 min-w-0">
              <div className="flex-1 h-11 bg-white px-3.5 rounded-xl sm:rounded-full border border-[#d2d2d7]/80 focus-within:border-[#0066cc] focus-within:ring-[3px] focus-within:ring-[#0066cc]/15 flex items-center gap-2.5 min-w-0 transition-all">
                <Search className="w-4 h-4 text-[#86868b] shrink-0" />
                <input
                  type="text"
                  value={doctorSearchQuery}
                  onChange={(e) => setDoctorSearchQuery(e.target.value)}
                  placeholder="Search doctors by name or specialty..."
                  className="w-full h-full bg-transparent text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none truncate"
                />
                {doctorSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setDoctorSearchQuery('')}
                    className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex-1 sm:w-48 h-11 bg-white px-3.5 rounded-xl sm:rounded-full border border-[#d2d2d7]/80 focus-within:border-[#0066cc] focus-within:ring-[3px] focus-within:ring-[#0066cc]/15 flex items-center gap-2 min-w-0 transition-all">
                  <MapPin className="w-4 h-4 text-[#86868b] shrink-0" />
                  <input
                    type="text"
                    value={doctorLocationQuery}
                    onChange={(e) => setDoctorLocationQuery(e.target.value)}
                    placeholder="City or locality..."
                    className="w-full h-full bg-transparent text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none truncate"
                  />
                  {doctorLocationQuery && (
                    <button
                      type="button"
                      onClick={() => setDoctorLocationQuery('')}
                      className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Mobile Filter Toggle */}
                <button
                  type="button"
                  onClick={() => setDoctorMobileFiltersOpen(!doctorMobileFiltersOpen)}
                  className={`lg:hidden h-11 px-4 rounded-xl sm:rounded-full border text-[13px] font-medium flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                    doctorMobileFiltersOpen
                      ? 'bg-[#0066cc]/10 border-[#0066cc]/30 text-[#0066cc]'
                      : 'bg-white border-[#d2d2d7]/80 text-[#1d1d1f]'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Filters</span>
                </button>

                {(doctorSearchQuery || doctorLocationQuery || selectedSpecialty !== 'All' || selectedCity !== 'All' || selectedState !== 'All' || minExperience > 0 || maxFee < 3000) && (
                  <button
                    type="button"
                    onClick={resetDoctorFilters}
                    className="h-11 px-3 rounded-xl sm:rounded-full text-[13px] font-medium text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04] cursor-pointer active:scale-95 shrink-0"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SECTION A: CLINICS DISCOVERY */}
        {activeSection === 'clinics' && (
          <div>
            {selectedClinic ? (
              <div className="space-y-6 sm:space-y-8">
                {/* Selected Clinic Header Card */}
                <div className="apple-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-[#0066cc]/10 flex items-center justify-center text-[#0066cc] shrink-0">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-section-title truncate mb-1">
                        {selectedClinic.clinicName}
                      </h2>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-[#86868b]">
                        <span className="inline-flex items-center gap-1.5 text-[#48484a]">
                          <MapPin className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />
                          <span className="truncate max-w-[260px] sm:max-w-md">
                            {getClinicLocationDisplay(selectedClinic)}
                          </span>
                        </span>
                        {selectedClinic.phone && (
                          <a
                            href={`tel:${selectedClinic.phone}`}
                            className="inline-flex items-center gap-1.5 text-[#48484a] hover:text-[#0066cc] transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />
                            <span>{formatDisplayPhone(selectedClinic.phone)}</span>
                          </a>
                        )}
                        <span className="inline-flex items-center gap-1 text-[12px] px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f] font-medium border border-[#e5e5ea]">
                          <Stethoscope className="w-3 h-3 text-[#0066cc]" />
                          {clinicPracticingDoctors.length} {clinicPracticingDoctors.length === 1 ? 'Doctor' : 'Doctors'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <AppleButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedClinic(null)}
                    className="self-start sm:self-center shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>All Clinics</span>
                  </AppleButton>
                </div>

                {/* Practicing Doctors Section */}
                <div>
                  <div className="mb-5">
                    <h3 className="text-section-title">
                      Doctors at this clinic
                    </h3>
                    <p className="text-secondary mt-0.5">
                      Select a doctor to book your live outpatient queue token.
                    </p>
                  </div>

                  {clinicPracticingDoctors.length === 0 ? (
                    <div className="apple-card p-10 text-center max-w-md mx-auto">
                      <div className="w-11 h-11 rounded-2xl bg-[#f5f5f7] flex items-center justify-center mx-auto mb-3 text-[#86868b]">
                        <Stethoscope className="w-5 h-5" />
                      </div>
                      <h4 className="text-card-title mb-1">
                        No doctors listed
                      </h4>
                      <p className="text-secondary mb-5">
                        No active specialists are listed at this facility right now.
                      </p>
                      <AppleButton variant="secondary" size="sm" onClick={() => setSelectedClinic(null)}>
                        Back to Clinics
                      </AppleButton>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {clinicPracticingDoctors.map((docItem) => {
                        const doctor = docItem.doctor;
                        const slots = parseDoctorSlots({
                          ...doctor,
                          slots: docItem.slots || doctor.slots,
                        });
                        const effectiveFee = docItem.consultationFee ?? doctor.consultationFee;
                        const cleanDegrees = formatDoctorDegrees(doctor.qualifications);

                        return (
                          <div
                            key={doctor.id}
                            className="w-full bg-white rounded-[20px] border border-[#e5e5ea] shadow-apple-card hover:border-[#d2d2d7] hover:shadow-apple-hover overflow-hidden transition-all duration-200 flex flex-col justify-between group"
                          >
                            {/* Doctor Photo Banner */}
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
                                } items-center justify-center font-semibold text-3xl text-white bg-[#0066cc] select-none`}
                              >
                                {(doctor.user?.fullName ? doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] : null) || 'D'}
                              </div>
                            </div>

                            {/* Card Body: Name -> Specialty -> Location -> Availability -> Fee -> Action */}
                            <div className="p-5 flex-1 flex flex-col justify-between">
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <h3
                                      onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                                      className="text-card-title hover:text-[#0066cc] cursor-pointer transition-colors truncate"
                                      title={doctor.user.fullName}
                                    >
                                      {doctor.user.fullName}
                                    </h3>
                                    <p className="mt-0.5 text-[13px] font-medium text-[#0066cc] truncate">
                                      {doctor.specialty}
                                      {cleanDegrees ? (
                                        <span className="text-[#86868b] font-normal"> · {cleanDegrees}</span>
                                      ) : null}
                                    </p>
                                  </div>
                                  <span className="text-[11px] font-medium text-[#6e6e73] bg-[#f5f5f7] px-2.5 py-0.5 rounded-full border border-[#e5e5ea] shrink-0 whitespace-nowrap">
                                    {doctor.experienceYears}y exp
                                  </span>
                                </div>

                                <div className="mt-3.5 space-y-1.5 text-[13px] text-[#48484a]">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <MapPin className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                                    <span className="truncate">{selectedClinic.clinicName}</span>
                                  </div>
                                  <div className="flex items-center gap-2 min-w-0 text-[#86868b]">
                                    <Clock className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                                    <span className="truncate">
                                      {slots.length > 0
                                        ? `${format12Hour(slots[0].startTime)} – ${format12Hour(slots[0].endTime)}`
                                        : doctor.checkingStartTime
                                        ? `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`
                                        : 'Consultation hours'}
                                    </span>
                                    {slots.length > 1 && (
                                      <span className="text-[11px] font-medium text-[#0066cc] shrink-0">
                                        +{slots.length - 1} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Card Footer: Fee & Primary Action */}
                              <div className="mt-4 pt-3.5 border-t border-[#f0f0f2] flex items-center justify-between gap-3">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight">
                                    ₹{effectiveFee.toFixed(0)}
                                  </span>
                                  <span className="text-[12px] text-[#86868b]">/ visit</span>
                                </div>

                                {docItem.hasReceptionist === false ? (
                                  <span
                                    className="h-8 px-3.5 rounded-full text-[12px] font-medium text-[#86868b] bg-[#f5f5f7] border border-[#e5e5ea] inline-flex items-center justify-center select-none"
                                    title="Online booking is closed because no receptionist is currently assigned for this doctor at this facility."
                                  >
                                    No Desk Staff
                                  </span>
                                ) : (
                                  <AppleButton
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    onClick={() => navigate(getDoctorBookPath(doctor.id, selectedClinic.id, slots[0]?.id))}
                                  >
                                    Book
                                  </AppleButton>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Verified Clinics Grid */
              <div>
                {loadingClinics ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div
                        key={i}
                        className="h-72 rounded-[20px] bg-white border border-[#e5e5ea] shadow-apple-card animate-pulse p-5"
                      />
                    ))}
                  </div>
                ) : filteredClinics.length === 0 ? (
                  <div className="apple-card p-10 text-center max-w-md mx-auto">
                    <div className="w-11 h-11 rounded-2xl bg-[#f5f5f7] flex items-center justify-center mx-auto mb-3 text-[#86868b]">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <h3 className="text-card-title mb-1">
                      No clinics found
                    </h3>
                    <p className="text-secondary mb-5">
                      Try searching with a different clinic name or location.
                    </p>
                    <AppleButton variant="secondary" size="sm" onClick={resetClinicFilters}>
                      Reset Filters
                    </AppleButton>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filteredClinics.map((clinic) => {
                      const docCount = (clinic.doctors && Array.isArray(clinic.doctors))
                        ? clinic.doctors.length
                        : (clinic._count?.doctors ?? 0);
                      const locationDisplay = getClinicLocationDisplay(clinic);

                      return (
                        <div
                          key={clinic.id}
                          onClick={() => setSelectedClinic(clinic)}
                          className="w-full bg-white rounded-[20px] border border-[#e5e5ea] shadow-apple-card hover:border-[#d2d2d7] hover:shadow-apple-hover overflow-hidden transition-all duration-200 flex flex-col justify-between group cursor-pointer"
                        >
                          {/* Top Facility Photography Banner */}
                          <div className="relative w-full aspect-[16/10] bg-[#f5f5f7] border-b border-[#f0f0f2] overflow-hidden flex items-center justify-center">
                            <img
                              src={clinicLobbyBg}
                              alt={clinic.clinicName}
                              className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                            />
                          </div>

                          {/* Card Body — Same Visual Hierarchy as Doctor Cards */}
                          <div className="p-5 flex-1 flex flex-col justify-between">
                            <div>
                              <h3
                                className="text-card-title group-hover:text-[#0066cc] transition-colors truncate"
                                title={clinic.clinicName}
                              >
                                {clinic.clinicName}
                              </h3>
                              <p className="mt-0.5 text-[13px] font-medium text-[#0066cc]">
                                {docCount === 1 ? '1 Specialist Doctor' : `${docCount} Specialist Doctors`}
                              </p>

                              <div className="mt-3.5 space-y-1.5 text-[13px] text-[#48484a]">
                                <div className="flex items-start gap-2 min-w-0">
                                  <MapPin className="w-3.5 h-3.5 text-[#86868b] shrink-0 mt-0.5" />
                                  <span className="line-clamp-2 leading-snug">
                                    {locationDisplay}
                                  </span>
                                </div>
                                {clinic.phone && (
                                  <div className="flex items-center gap-2 text-[#86868b]">
                                    <Phone className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                                    <span className="truncate">{formatDisplayPhone(clinic.phone)}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Card Footer — Matching Doctor Card Footer */}
                            <div className="mt-4 pt-3.5 border-t border-[#f0f0f2] flex items-center justify-between gap-3">
                              <span className="text-[12px] font-medium text-[#86868b]">
                                Verified Clinic
                              </span>

                              <AppleButton
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedClinic(clinic);
                                }}
                              >
                                <span>View Doctors</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </AppleButton>
                            </div>
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
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
            {/* Desktop Left Filter Sidebar — Subordinate to Search */}
            <aside className="hidden lg:block w-64 bg-white rounded-[20px] border border-[#e5e5ea] shadow-apple-card p-5 shrink-0 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#86868b]" />
                  <h3 className="text-[13px] font-semibold text-[#1d1d1f]">Filters</h3>
                </div>
                {(doctorSearchQuery || doctorLocationQuery || selectedSpecialty !== 'All' || selectedCity !== 'All' || selectedState !== 'All' || minExperience > 0 || maxFee < 3000) && (
                  <button
                    type="button"
                    onClick={resetDoctorFilters}
                    className="text-[12px] font-medium text-[#0066cc] hover:text-[#0071e3] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <AppleFilterSelect
                    label="State"
                    value={selectedState}
                    onChange={(st) => {
                      setSelectedState(st);
                      setSelectedCity('All');
                    }}
                    options={doctorStateOptions}
                    placeholder="All States"
                    variant="form"
                  />
                </div>

                <div>
                  <AppleFilterSelect
                    label="City"
                    value={selectedCity}
                    onChange={setSelectedCity}
                    options={doctorCityOptions}
                    placeholder={selectedState !== 'All' ? `All Cities in ${selectedState}` : 'All Cities'}
                    disabled={selectedState === 'All'}
                    variant="form"
                  />
                </div>

                <div>
                  <label className="ui-label">
                    Specialty
                  </label>
                  <SearchableSpecialtySelect
                    value={selectedSpecialty}
                    onChange={setSelectedSpecialty}
                    variant="form"
                    includeAll={true}
                    counts={specialtyCounts}
                    placeholder="Select specialty..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-medium text-[#1d1d1f]">Max Fee</span>
                    <span className="text-[13px] font-semibold text-[#0066cc]">Up to ₹{maxFee}</span>
                  </div>
                  <input
                    type="range"
                    min="300"
                    max="3000"
                    step="100"
                    value={maxFee}
                    onChange={(e) => setMaxFee(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#e5e5ea] rounded-lg appearance-none cursor-pointer accent-[#0066cc]"
                  />
                  <div className="flex justify-between text-[11px] text-[#86868b] mt-1">
                    <span>₹300</span>
                    <span>₹3000</span>
                  </div>
                </div>

                <div>
                  <label className="ui-label">
                    Experience
                  </label>
                  <div className="p-1 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] grid grid-cols-4 gap-1">
                    {[
                      { label: 'All', value: 0 },
                      { label: '5+ yr', value: 5 },
                      { label: '10+ yr', value: 10 },
                      { label: '15+ yr', value: 15 },
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setMinExperience(item.value)}
                        className={`py-1.5 rounded-lg text-[11px] font-medium transition-all text-center cursor-pointer ${
                          minExperience === item.value
                            ? 'bg-white text-[#1d1d1f] font-semibold shadow-2xs'
                            : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            {/* Main Doctor Grid */}
            <div className="flex-1 w-full space-y-5">
              {/* Mobile Collapsible Filters */}
              {doctorMobileFiltersOpen && (
                <div className="lg:hidden apple-card space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
                    <span className="text-[13px] font-semibold text-[#1d1d1f]">Filters</span>
                    {(doctorSearchQuery || doctorLocationQuery || selectedSpecialty !== 'All' || selectedCity !== 'All' || selectedState !== 'All' || minExperience > 0 || maxFee < 3000) && (
                      <button
                        type="button"
                        onClick={resetDoctorFilters}
                        className="text-[12px] text-[#0066cc] font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="ui-label">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <AppleFilterSelect
                        label="State"
                        value={selectedState}
                        onChange={(st) => {
                          setSelectedState(st);
                          setSelectedCity('All');
                        }}
                        options={doctorStateOptions}
                        placeholder="All States"
                        variant="form"
                      />
                    </div>
                    <div>
                      <AppleFilterSelect
                        label="City"
                        value={selectedCity}
                        onChange={setSelectedCity}
                        options={doctorCityOptions}
                        placeholder={selectedState !== 'All' ? 'All Cities' : 'All Cities'}
                        disabled={selectedState === 'All'}
                        variant="form"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-medium text-[#1d1d1f]">Max Fee</span>
                      <span className="text-[13px] font-semibold text-[#0066cc]">Up to ₹{maxFee}</span>
                    </div>
                    <input
                      type="range"
                      min="300"
                      max="3000"
                      step="100"
                      value={maxFee}
                      onChange={(e) => setMaxFee(Number(e.target.value))}
                      className="w-full h-1.5 bg-[#e5e5ea] rounded-lg appearance-none cursor-pointer accent-[#0066cc]"
                    />
                    <div className="flex justify-between text-[11px] text-[#86868b] mt-1">
                      <span>₹300</span>
                      <span>₹3000</span>
                    </div>
                  </div>

                  <div>
                    <label className="ui-label">
                      Experience
                    </label>
                    <div className="p-1 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] grid grid-cols-4 gap-1">
                      {[
                        { label: 'All', value: 0 },
                        { label: '5+ yr', value: 5 },
                        { label: '10+ yr', value: 10 },
                        { label: '15+ yr', value: 15 },
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setMinExperience(item.value)}
                          className={`py-1.5 rounded-lg text-[11px] font-medium transition-all text-center cursor-pointer ${
                            minExperience === item.value
                              ? 'bg-white text-[#1d1d1f] font-semibold shadow-2xs'
                              : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
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
                      className="h-80 rounded-[20px] bg-white border border-[#e5e5ea] shadow-apple-card animate-pulse p-5"
                    />
                  ))}
                </div>
              ) : filteredDoctors.length === 0 ? (
                <div className="apple-card p-10 text-center max-w-md mx-auto">
                  <div className="w-11 h-11 rounded-2xl bg-[#f5f5f7] flex items-center justify-center mx-auto mb-3 text-[#86868b]">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <h3 className="text-card-title mb-1">
                    No doctors found
                  </h3>
                  <p className="text-secondary mb-5">
                    Try searching with different terms or reset your filters.
                  </p>
                  <AppleButton variant="secondary" size="sm" onClick={resetDoctorFilters}>
                    Reset Filters
                  </AppleButton>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredDoctors.map((doctor) => {
                    const slots = parseDoctorSlots(doctor);
                    const cleanDegrees = formatDoctorDegrees(doctor.qualifications);
                    const primaryClinic = doctor.clinics?.find((c) => c?.clinic)?.clinic || null;

                    return (
                      <div
                        key={doctor.id}
                        className="w-full bg-white rounded-[20px] border border-[#e5e5ea] shadow-apple-card hover:border-[#d2d2d7] hover:shadow-apple-hover overflow-hidden transition-all duration-200 flex flex-col justify-between group"
                      >
                        {/* Doctor Photo Banner */}
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
                                const fallback = e.currentTarget.parentElement?.querySelector('.doc-cat-fallback-banner');
                                if (fallback) (fallback as HTMLElement).style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            className={`doc-cat-fallback-banner w-full h-full ${
                              doctor.user?.avatarUrl ? 'hidden' : 'flex'
                            } items-center justify-center font-semibold text-3xl text-white bg-[#0066cc] select-none`}
                          >
                            {(doctor.user?.fullName ? doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] : null) || 'D'}
                          </div>
                        </div>

                        {/* Card Body: Doctor Name -> Specialty -> Clinic/location -> Availability -> Fee -> Primary Action */}
                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3
                                  onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                                  className="text-card-title hover:text-[#0066cc] cursor-pointer transition-colors truncate"
                                  title={doctor.user.fullName}
                                >
                                  {doctor.user.fullName}
                                </h3>
                                <p className="mt-0.5 text-[13px] font-medium text-[#0066cc] truncate">
                                  {doctor.specialty}
                                  {cleanDegrees ? (
                                    <span className="text-[#86868b] font-normal"> · {cleanDegrees}</span>
                                  ) : null}
                                </p>
                              </div>
                              <span className="text-[11px] font-medium text-[#6e6e73] bg-[#f5f5f7] px-2.5 py-0.5 rounded-full border border-[#e5e5ea] shrink-0 whitespace-nowrap">
                                {doctor.experienceYears}y exp
                              </span>
                            </div>

                            <div className="mt-3.5 space-y-1.5 text-[13px] text-[#48484a]">
                              {primaryClinic && (
                                <div className="flex items-center gap-2 min-w-0">
                                  <MapPin className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                                  <span className="truncate">
                                    {primaryClinic.clinicName}
                                    {primaryClinic.city ? (
                                      <span className="text-[#86868b]"> · {primaryClinic.city}</span>
                                    ) : ''}
                                  </span>
                                  {(doctor.clinics?.length ?? 0) > 1 && (
                                    <span className="text-[11px] font-medium text-[#0066cc] shrink-0">
                                      +{(doctor.clinics?.length ?? 0) - 1} more
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center gap-2 min-w-0 text-[#86868b]">
                                <Clock className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                                <span className="truncate">
                                  {slots.length > 0
                                    ? `${format12Hour(slots[0].startTime)} – ${format12Hour(slots[0].endTime)}`
                                    : doctor.checkingStartTime
                                    ? `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`
                                    : 'Consultation hours'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Card Footer: Fee & Primary Action */}
                          <div className="mt-4 pt-3.5 border-t border-[#f0f0f2] flex items-center justify-between gap-3">
                            <div className="flex items-baseline gap-1">
                              <span className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight">
                                ₹{doctor.consultationFee.toFixed(0)}
                              </span>
                              <span className="text-[12px] text-[#86868b]">/ visit</span>
                            </div>

                            <AppleButton
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => navigate(getDoctorBookPath(doctor.id, primaryClinic?.id))}
                            >
                              Book
                            </AppleButton>
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
    </div>
  );
};

export default Home;
