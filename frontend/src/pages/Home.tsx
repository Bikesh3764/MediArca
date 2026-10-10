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
  X,
  SlidersHorizontal,
  Phone,
  RotateCcw,
  ChevronDown,
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
    newParams.delete('clinicId');
    setSearchParams(newParams);
  };

  const handleSelectClinic = (clinic: ClinicProfile) => {
    setSelectedClinic(clinic);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', 'clinics');
    newParams.set('clinicId', clinic.id);
    setSearchParams(newParams);
  };

  const handleClearClinic = () => {
    setSelectedClinic(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('clinicId');
    setSearchParams(newParams);
  };

  // Synchronize URL search params (e.g., browser back button) with active section & selected clinic
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'doctors' || tab === 'clinics') {
      setActiveSection(tab);
    }
    const clinicId = searchParams.get('clinicId');
    if (clinicId && clinics.length > 0) {
      const found = clinics.find((c) => c.id === clinicId);
      if (found) {
        setSelectedClinic(found);
      }
    } else if (!clinicId) {
      setSelectedClinic(null);
    }
  }, [searchParams, clinics]);

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

  const getDoctorDetailPath = (docId: string) => `/doctor/${docId}`;

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
      {/* 1. Hero Section - Healthcare Themed Canvas with Queue Booking Focus */}
      <section className="relative overflow-hidden border-b border-[#e5e5ea] py-16 sm:py-20 md:py-24 px-4 sm:px-6 flex items-center justify-center min-h-[420px] sm:min-h-[460px]">
        {/* Healthcare Themed Hero Background Photo - Clearly Visible */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          <img
            src={healthcareHeroBg}
            alt="Healthcare clinical facility"
            className="w-full h-full object-cover object-center"
          />
          {/* Subtle light balance so the hospital photo is vibrant and clearly visible */}
          <div className="absolute inset-0 bg-white/55" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center w-full">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-[#1d1d1f] tracking-tight leading-[1.08] max-w-3xl mx-auto">
            Book doctor queue tokens. <span className="text-[#0066cc]">Skip the waiting room.</span>
          </h1>

          {/* Unified Apple Dual Search Bar (Two Searches in One Bar) */}
          <div className="mt-8 sm:mt-10 max-w-2xl mx-auto backdrop-blur-md bg-white/95 p-2 sm:p-2.5 rounded-[24px] sm:rounded-full border border-black/[0.1] shadow-[0_10px_36px_rgba(0,0,0,0.12)] flex flex-col sm:flex-row items-center gap-2">
            <div className="flex items-center gap-2.5 flex-1 w-full px-3.5 py-1">
              <Search className="w-4 h-4 text-[#86868b] shrink-0" />
              <input
                type="text"
                value={heroSearchQuery}
                onChange={(e) => setHeroSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleHeroSearch()}
                placeholder="Search doctor, clinic or specialty..."
                className="w-full bg-transparent text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
              />
              {heroSearchQuery && (
                <button
                  type="button"
                  onClick={() => setHeroSearchQuery('')}
                  className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="hidden sm:block w-px h-6 bg-[#e0e0e0]" />

            <div className="flex items-center gap-2.5 w-full sm:w-52 px-3.5 py-1">
              <MapPin className="w-4 h-4 text-[#86868b] shrink-0" />
              <input
                type="text"
                value={heroLocationQuery}
                onChange={(e) => setHeroLocationQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleHeroSearch()}
                placeholder="City or location..."
                className="w-full bg-transparent text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
              />
              {heroLocationQuery && (
                <button
                  type="button"
                  onClick={() => setHeroLocationQuery('')}
                  className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleHeroSearch}
              className="w-full sm:w-auto h-10 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-sm font-medium transition-all duration-150 active:scale-[0.97] inline-flex items-center justify-center gap-2 cursor-pointer select-none shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,102,204,0.15)]"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Main Discovery Workspace */}
      <section id="catalog-section" className="w-full max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-14 py-8 sm:py-10 flex-1">
        {/* Navigation & Search Bar Header */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 sm:gap-4 pb-6 mb-8 border-b border-[#e5e5ea]">
          <div className="h-11 inline-flex items-center p-1 bg-[#e8e8ed]/70 rounded-full border border-[#e5e5ea] shrink-0">
            <button
              type="button"
              onClick={() => handleSectionSwitch('clinics')}
              className={`h-full flex items-center justify-center px-6 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer active:scale-95 ${
                activeSection === 'clinics'
                  ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              <span>Clinics</span>
            </button>
            <button
              type="button"
              onClick={() => handleSectionSwitch('doctors')}
              className={`h-full flex items-center justify-center px-6 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer active:scale-95 ${
                activeSection === 'doctors'
                  ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              <span>Doctors</span>
            </button>
          </div>

          {/* Search bar beside Clinics & Doctors Switch */}
          {activeSection === 'clinics' && !selectedClinic && (
            <div className="flex-1 w-full h-11 bg-white px-3.5 rounded-full border border-[#e5e5ea] flex items-center gap-2.5 sm:gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-2 flex-1 h-full min-w-0">
                <Search className="w-4 h-4 text-[#86868b] shrink-0" />
                <input
                  type="text"
                  value={clinicSearchQuery}
                  onChange={(e) => setClinicSearchQuery(e.target.value)}
                  placeholder="Search clinics by name or address..."
                  className="w-full h-full bg-transparent text-xs sm:text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
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

              <div className="hidden sm:block w-px h-5 bg-[#e5e5ea] shrink-0" />

              {/* State Filter */}
              <div className="w-36 sm:w-44 h-full flex items-center shrink-0">
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

              <div className="hidden sm:block w-px h-5 bg-[#e5e5ea] shrink-0" />

              {/* City Filter */}
              <div className="w-36 sm:w-44 h-full flex items-center shrink-0">
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
                  disabled={clinicSelectedState === 'All'}
                  variant="bar"
                  searchable={clinicCityOptions.length > 5}
                />
              </div>

              {(clinicSearchQuery || clinicSelectedCity !== 'All' || clinicSelectedState !== 'All') && (
                <button
                  type="button"
                  onClick={resetClinicFilters}
                  className="h-7 px-2.5 rounded-full text-xs font-normal text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.04] cursor-pointer active:scale-95 shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {activeSection === 'doctors' && (
            <div className="flex-1 w-full h-11 bg-white px-3.5 rounded-full border border-[#e5e5ea] flex items-center gap-2.5 sm:gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-2 flex-1 h-full min-w-0">
                <Search className="w-4 h-4 text-[#86868b] shrink-0" />
                <input
                  type="text"
                  value={doctorSearchQuery}
                  onChange={(e) => setDoctorSearchQuery(e.target.value)}
                  placeholder="Search doctors by name or specialty..."
                  className="w-full h-full bg-transparent text-xs sm:text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
                />
                {doctorSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setDoctorSearchQuery('')}
                    className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="hidden sm:block w-px h-5 bg-[#e5e5ea] shrink-0" />

              <div className="flex items-center gap-2 w-36 sm:w-44 h-full shrink-0">
                <MapPin className="w-4 h-4 text-[#86868b] shrink-0" />
                <input
                  type="text"
                  value={doctorLocationQuery}
                  onChange={(e) => setDoctorLocationQuery(e.target.value)}
                  placeholder="City or locality..."
                  className="w-full h-full bg-transparent text-xs sm:text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
                />
                {doctorLocationQuery && (
                  <button
                    type="button"
                    onClick={() => setDoctorLocationQuery('')}
                    className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Mobile Filter Toggle */}
              <button
                type="button"
                onClick={() => setDoctorMobileFiltersOpen(!doctorMobileFiltersOpen)}
                className="lg:hidden h-7 px-3 rounded-full border border-[#e5e5ea] bg-[#f5f5f7] text-xs font-medium text-[#1d1d1f] flex items-center gap-1.5 shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
              </button>

              {(doctorSearchQuery || doctorLocationQuery || selectedSpecialty !== 'All' || selectedCity !== 'All' || selectedState !== 'All' || minExperience > 0 || maxFee < 3000) && (
                <button
                  type="button"
                  onClick={resetDoctorFilters}
                  className="h-7 px-2.5 rounded-full text-xs font-normal text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.04] cursor-pointer active:scale-95 shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          )}
        </div>

        {/* SECTION A: CLINICS DISCOVERY */}
        {activeSection === 'clinics' && (
          <div>
            {/* If a clinic is selected, show its full dedicated view with practicing doctors & time slots */}
            {selectedClinic ? (
              <div className="space-y-8 animate-fadeIn">
                {/* Selected Clinic Header Card */}
                <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug truncate mb-1.5">
                        {selectedClinic.clinicName}
                      </h2>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#86868b]">
                        <span className="inline-flex items-center gap-1.5 font-normal text-[#48484a]">
                          <MapPin className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />
                          <span className="truncate max-w-xs sm:max-w-md font-normal">
                            {getClinicLocationDisplay(selectedClinic)}
                          </span>
                        </span>
                        {selectedClinic.phone && (
                          <a
                            href={`tel:${selectedClinic.phone}`}
                            className="inline-flex items-center gap-1.5 font-normal text-[#48484a] hover:text-[#0066cc] transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />
                            <span className="font-normal">{formatDisplayPhone(selectedClinic.phone)}</span>
                          </a>
                        )}
                        <span className="inline-flex items-center text-[11px] px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f] font-medium border border-[#e5e5ea]">
                          {clinicPracticingDoctors.length} {clinicPracticingDoctors.length === 1 ? 'Specialist' : 'Specialists'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearClinic}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-xs font-semibold text-[#1d1d1f] transition-all cursor-pointer self-start sm:self-center shrink-0 border border-[#e5e5ea]"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>All Clinics</span>
                    </button>
                  </div>
                </div>

                {/* Practicing Doctors Section */}
                <div>
                  <div className="mb-6">
                    <h3 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                      Doctors at this clinic
                    </h3>
                  </div>

                  {clinicPracticingDoctors.length === 0 ? (
                    <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-12 text-center max-w-md mx-auto shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                      <h4 className="text-base font-semibold text-[#1d1d1f] mb-1">
                        No doctors listed
                      </h4>
                      <p className="text-xs text-[#86868b] mb-5">
                        No doctors are currently listed for this clinic.
                      </p>
                      <AppleButton variant="secondary" size="sm" onClick={handleClearClinic}>
                        Back to Clinics
                      </AppleButton>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:[grid-template-columns:repeat(auto-fill,minmax(330px,1fr))] gap-5 sm:gap-6 w-full">
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
                            className="w-full bg-white rounded-[24px] border border-[#e5e5ea] shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden hover:border-[#0066cc]/40 transition-all duration-200 flex flex-col justify-between group"
                          >
                            {/* Doctor Photo Banner - Natural 16:10 proportion displaying the full photo */}
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

                            {/* Card Body with Refined Apple Typography */}
                            <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                              <div>
                                {/* Header: Doctor Name & Experience */}
                                <div className="flex items-start justify-between gap-2.5">
                                  <div className="min-w-0">
                                    <h3
                                      onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                                      className="text-[17px] font-semibold text-[#1d1d1f] hover:text-[#0066cc] cursor-pointer tracking-tight transition-colors duration-150 truncate leading-snug"
                                      title={doctor.user.fullName}
                                    >
                                      {doctor.user.fullName}
                                    </h3>
                                    <div className="mt-1 flex items-center gap-1.5 text-xs text-[#86868b] truncate">
                                      <span className="font-medium text-[#0066cc]">{doctor.specialty}</span>
                                      {cleanDegrees && (
                                        <>
                                          <span className="text-[#c7c7cc] select-none">•</span>
                                          <span className="font-medium text-[#48484a]">{cleanDegrees}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-[11px] font-medium text-[#48484a] bg-[#f5f5f7] px-2.5 py-0.5 rounded-full border border-[#e5e5ea] shrink-0 whitespace-nowrap select-none">
                                    {doctor.experienceYears} yrs exp
                                  </span>
                                </div>

                                {/* Shift Timing: Bold, Clear Apple Row */}
                                <div className="mt-3.5 space-y-2 text-xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Clock className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                                    <span className="truncate text-[#48484a] font-medium tracking-tight">
                                      {slots.length > 0
                                        ? `${format12Hour(slots[0].startTime)} – ${format12Hour(slots[0].endTime)}`
                                        : doctor.checkingStartTime
                                        ? `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`
                                        : 'Consultation hours'}
                                    </span>
                                    {slots.length > 1 && (
                                      <span className="text-[10px] font-medium text-[#0066cc] bg-[#0066cc]/8 px-2 py-0.5 rounded-full border border-[#0066cc]/15 shrink-0 select-none">
                                        +{slots.length - 1} slots
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Card Footer: Fee & Apple Action Blue Pill Button */}
                              <div className="mt-4 pt-3.5 border-t border-[#f0f0f2] flex items-center justify-between gap-3">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-[21px] font-bold text-[#1d1d1f] tracking-tight">
                                    ₹{effectiveFee.toFixed(0)}
                                  </span>
                                  <span className="text-xs text-[#86868b] font-normal">/ visit</span>
                                </div>

                                {docItem.hasReceptionist === false ? (
                                  <span
                                    className="h-8 px-3.5 rounded-full text-[11px] font-medium text-[#86868b] bg-[#f5f5f7] border border-[#e5e5ea] inline-flex items-center justify-center select-none"
                                    title="Online booking is closed because no receptionist is currently assigned for this doctor at this facility."
                                  >
                                    No Desk Staff
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => navigate(getDoctorBookPath(doctor.id, selectedClinic.id, slots[0]?.id))}
                                    className="h-8 min-w-[78px] px-5 rounded-full text-xs font-medium text-white bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.97] transition-all duration-150 ease-out cursor-pointer select-none shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,102,204,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc]/40 inline-flex items-center justify-center"
                                  >
                                    Book
                                  </button>
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
              /* If no clinic is selected, show list of verified clinics */
              <div className="space-y-6">
                {/* Clinics Cards Grid */}
                {loadingClinics ? (
                  <div className="grid grid-cols-1 md:[grid-template-columns:repeat(auto-fill,minmax(330px,1fr))] gap-5 sm:gap-6 w-full">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div
                        key={i}
                        className="h-72 rounded-[24px] bg-white border border-[#e5e5ea] animate-pulse p-4"
                      />
                    ))}
                  </div>
                ) : filteredClinics.length === 0 ? (
                  <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-12 text-center max-w-md mx-auto shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                    <h3 className="text-base font-semibold text-[#1d1d1f] mb-1">
                      No clinics found
                    </h3>
                    <p className="text-xs text-[#86868b] mb-5">
                      Try searching with a different name or location.
                    </p>
                    <AppleButton variant="secondary" size="sm" onClick={resetClinicFilters}>
                      Reset
                    </AppleButton>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:[grid-template-columns:repeat(auto-fill,minmax(330px,1fr))] gap-5 sm:gap-6 w-full">
                    {filteredClinics.map((clinic) => {
                      const docCount = (clinic.doctors && Array.isArray(clinic.doctors))
                        ? clinic.doctors.length
                        : (clinic._count?.doctors ?? 0);
                      const locationDisplay = getClinicLocationDisplay(clinic);

                      return (
                        <div
                          key={clinic.id}
                          onClick={() => handleSelectClinic(clinic)}
                          className="w-full bg-white rounded-[24px] border border-[#e5e5ea] shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden hover:border-[#0066cc]/40 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
                        >
                          {/* Top Facility Photography Banner */}
                          <div className="relative w-full aspect-[16/10] bg-[#f5f5f7] border-b border-[#f0f0f2] overflow-hidden flex items-center justify-center">
                            <img
                              src={clinicLobbyBg}
                              alt={clinic.clinicName}
                              className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                            />
                          </div>

                          {/* Card Body */}
                          <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                            <div>
                              {/* Clinic Name */}
                              <h3
                                className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight leading-snug group-hover:text-[#0066cc] transition-colors truncate"
                                title={clinic.clinicName}
                              >
                                {clinic.clinicName}
                              </h3>

                              {/* Location & Contact Info */}
                              <div className="mt-2.5 space-y-1.5">
                                <p className="flex items-start gap-2 text-xs text-[#48484a] font-normal leading-snug">
                                  <MapPin className="w-3.5 h-3.5 text-[#86868b] shrink-0 mt-0.5" />
                                  <span className="line-clamp-2 font-normal text-[#48484a]">
                                    {locationDisplay}
                                  </span>
                                </p>
                                {clinic.phone && (
                                  <p className="flex items-center gap-2 text-xs text-[#48484a] font-normal leading-snug">
                                    <Phone className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                                    <span className="font-normal text-[#48484a]">{formatDisplayPhone(clinic.phone)}</span>
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Apple HIG Card Footer */}
                            <div className="mt-4 pt-3.5 border-t border-[#f0f0f2] flex items-center justify-between gap-3">
                              <span className="text-xs font-medium text-[#48484a] bg-[#f5f5f7] px-2.5 py-1 rounded-full border border-[#e5e5ea]">
                                {docCount === 1 ? '1 Specialist' : `${docCount} Specialists`}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectClinic(clinic);
                                }}
                                className="h-8 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-medium transition-all duration-150 active:scale-[0.97] inline-flex items-center justify-center cursor-pointer select-none shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,102,204,0.15)]"
                              >
                                View Doctors
                              </button>
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
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start w-full">
            {/* Desktop Left Filter Sidebar */}
            <aside className="hidden lg:block w-64 xl:w-72 bg-white rounded-[24px] border border-[#e5e5ea] p-5 shrink-0 space-y-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div className="flex items-center justify-between pb-3.5 border-b border-[#f0f0f2]">
                <h3 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">Filters</h3>
                {(doctorSearchQuery || doctorLocationQuery || selectedSpecialty !== 'All' || selectedCity !== 'All' || selectedState !== 'All' || minExperience > 0 || maxFee < 3000) && (
                  <button
                    type="button"
                    onClick={resetDoctorFilters}
                    className="h-6 px-2.5 rounded-full text-xs font-medium text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e5e5ea] transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Reset all filters"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {/* State */}
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

                {/* City */}
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

                {/* Specialty */}
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
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

                {/* Max Consultation Fee Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                    <span>Fee Limit</span>
                    <span className="text-[#0066cc] font-semibold">Up to ₹{maxFee}</span>
                  </div>
                  <input
                    type="range"
                    min="300"
                    max="3000"
                    step="100"
                    value={maxFee}
                    onChange={(e) => setMaxFee(Number(e.target.value))}
                    className="w-full h-1 bg-[#e5e5ea] rounded-lg appearance-none cursor-pointer accent-[#0066cc]"
                  />
                  <div className="flex justify-between text-[11px] text-[#86868b] mt-1 font-normal">
                    <span>₹300</span>
                    <span>₹3000</span>
                  </div>
                </div>

                {/* Experience Segmented Control */}
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                    Experience
                  </label>
                  <div className="p-1 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] grid grid-cols-4 gap-1 select-none">
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
                        className={`py-1.5 rounded-lg text-[11px] transition-all duration-150 text-center cursor-pointer ${
                          minExperience === item.value
                            ? 'bg-white text-[#1d1d1f] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-black/5'
                            : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
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
            <div className="flex-1 w-full min-w-0 space-y-6">
              {/* Mobile Collapsible Filters */}
              {doctorMobileFiltersOpen && (
                <div className="lg:hidden bg-white p-5 rounded-[24px] border border-[#e5e5ea] shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
                  <div className="flex items-center justify-between pb-2.5 border-b border-[#f0f0f2]">
                    <span className="text-xs font-semibold text-[#1d1d1f] tracking-tight">Filter Options</span>
                    {(doctorSearchQuery || doctorLocationQuery || selectedSpecialty !== 'All' || selectedCity !== 'All' || selectedState !== 'All' || minExperience > 0 || maxFee < 3000) && (
                      <button
                        type="button"
                        onClick={resetDoctorFilters}
                        className="text-xs text-[#0066cc] font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
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
                  <div className="grid grid-cols-2 gap-3">
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
                        placeholder={selectedState !== 'All' ? `All Cities` : 'All Cities'}
                        disabled={selectedState === 'All'}
                        variant="form"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                      <span>Fee Limit</span>
                      <span className="text-[#0066cc] font-semibold">Up to ₹{maxFee}</span>
                    </div>
                    <input
                      type="range"
                      min="300"
                      max="3000"
                      step="100"
                      value={maxFee}
                      onChange={(e) => setMaxFee(Number(e.target.value))}
                      className="w-full h-1 bg-[#e5e5ea] rounded-lg appearance-none cursor-pointer accent-[#0066cc]"
                    />
                    <div className="flex justify-between text-[11px] text-[#86868b] mt-1 font-normal">
                      <span>₹300</span>
                      <span>₹3000</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                      Experience
                    </label>
                    <div className="p-1 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] grid grid-cols-4 gap-1 select-none">
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
                          className={`py-1.5 rounded-lg text-[11px] transition-all duration-150 text-center cursor-pointer ${
                            minExperience === item.value
                              ? 'bg-white text-[#1d1d1f] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-black/5'
                              : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Open Apple Catalog Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5e5ea]">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                    {selectedSpecialty === 'All' ? 'Specialists' : selectedSpecialty}
                  </h2>
                  <span className="text-sm text-[#86868b] font-normal">
                    ({filteredDoctors.length})
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
                  <div className="relative inline-flex items-center">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'rating' | 'experience' | 'fee_low' | 'fee_high')}
                      className="appearance-none h-9 pl-3.5 pr-8 rounded-full border border-[#d2d2d7] bg-white hover:bg-[#f5f5f7] text-xs font-medium text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all"
                    >
                      <option value="rating">Recommended</option>
                      <option value="experience">Most Experienced</option>
                      <option value="fee_low">Price: Low to High</option>
                      <option value="fee_high">Price: High to Low</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[#86868b] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              {/* Doctor Cards Grid */}
              {loadingDoctors ? (
                <div className="grid grid-cols-1 md:[grid-template-columns:repeat(auto-fill,minmax(330px,1fr))] gap-5 sm:gap-6 w-full">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="h-80 rounded-[24px] bg-white border border-[#e5e5ea] animate-pulse p-4"
                    />
                  ))}
                </div>
              ) : filteredDoctors.length === 0 ? (
                <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-12 text-center max-w-md mx-auto shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                  <h3 className="text-base font-semibold text-[#1d1d1f] mb-1">
                    No doctors found
                  </h3>
                  <p className="text-xs text-[#86868b] mb-5">
                    Try searching with different terms or reset filters.
                  </p>
                  <AppleButton variant="secondary" size="sm" onClick={resetDoctorFilters}>
                    Reset
                  </AppleButton>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:[grid-template-columns:repeat(auto-fill,minmax(330px,1fr))] gap-5 sm:gap-6 w-full">
                  {filteredDoctors.map((doctor) => {
                    const slots = parseDoctorSlots(doctor);
                    // Strictly sanitize doctor degrees to legitimate medical degrees only (NO FACC!)
                    const cleanDegrees = formatDoctorDegrees(doctor.qualifications);
                    const primaryClinic = doctor.clinics?.find((c) => c?.clinic)?.clinic || null;

                    return (
                      <div
                        key={doctor.id}
                        className="w-full bg-white rounded-[24px] border border-[#e5e5ea] shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden hover:border-[#0066cc]/40 transition-all duration-200 flex flex-col justify-between group"
                      >
                        {/* Doctor Photo Banner - Natural 16:10 proportion displaying the full photo */}
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
                            } items-center justify-center font-bold text-3xl text-white bg-[#0066cc] select-none`}
                          >
                            {(doctor.user?.fullName ? doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] : null) || 'D'}
                          </div>
                        </div>

                        {/* Card Body with Refined Apple Typography */}
                        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                          <div>
                            {/* Header: Doctor Name & Experience */}
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="min-w-0">
                                <h3
                                  onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                                  className="text-[17px] font-semibold text-[#1d1d1f] hover:text-[#0066cc] cursor-pointer tracking-tight transition-colors duration-150 truncate leading-snug"
                                  title={doctor.user.fullName}
                                >
                                  {doctor.user.fullName}
                                </h3>
                                <div className="mt-1 flex items-center gap-1.5 text-xs text-[#86868b] truncate">
                                  <span className="font-medium text-[#0066cc]">{doctor.specialty}</span>
                                  {cleanDegrees && (
                                    <>
                                      <span className="text-[#c7c7cc] select-none">•</span>
                                      <span className="font-medium text-[#48484a]">{cleanDegrees}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <span className="text-[11px] font-medium text-[#48484a] bg-[#f5f5f7] px-2.5 py-0.5 rounded-full border border-[#e5e5ea] shrink-0 whitespace-nowrap select-none">
                                {doctor.experienceYears} yrs exp
                              </span>
                            </div>

                            {/* Practice Clinic & Shift Timing */}
                            <div className="mt-3.5 space-y-2 text-xs">
                              {primaryClinic && (
                                <div className="flex items-center gap-2 min-w-0">
                                  <MapPin className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                                  <span className="truncate text-[#1d1d1f] font-medium">
                                    {primaryClinic.clinicName}
                                    {primaryClinic.city ? <span className="text-[#86868b] font-normal"> · {primaryClinic.city}</span> : ''}
                                  </span>
                                  {(doctor.clinics?.length ?? 0) > 1 && (
                                    <span className="text-[10px] font-medium text-[#0066cc] bg-[#0066cc]/8 px-2 py-0.5 rounded-full border border-[#0066cc]/15 shrink-0 select-none">
                                      +{(doctor.clinics?.length ?? 0) - 1} more
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center gap-2 min-w-0">
                                <Clock className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                                <span className="truncate text-[#48484a] font-medium tracking-tight">
                                  {slots.length > 0
                                    ? `${format12Hour(slots[0].startTime)} – ${format12Hour(slots[0].endTime)}`
                                    : doctor.checkingStartTime
                                    ? `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`
                                    : 'Consultation hours'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Card Footer: Fee & Apple Action Blue Pill Button */}
                          <div className="mt-4 pt-3.5 border-t border-[#f0f0f2] flex items-center justify-between gap-3">
                            <div className="flex items-baseline gap-1">
                              <span className="text-[21px] font-bold text-[#1d1d1f] tracking-tight">
                                ₹{doctor.consultationFee.toFixed(0)}
                              </span>
                              <span className="text-xs text-[#86868b] font-normal">/ visit</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => navigate(getDoctorBookPath(doctor.id, primaryClinic?.id))}
                              className="h-8 min-w-[78px] px-5 rounded-full text-xs font-medium text-white bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.97] transition-all duration-150 ease-out cursor-pointer select-none shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,102,204,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc]/40 inline-flex items-center justify-center"
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
    </div>
  );
};

export default Home;
