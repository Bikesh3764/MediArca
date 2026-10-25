import React, { useEffect, useState, useMemo, createContext, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, Doctor, ClinicProfile, PublicClinicDoctor, ALL_SPECIALTIES } from '../../services/api';
import { INDIAN_STATES, getCitiesForState } from '../../utils/indiaStates';

/** All data, effects and actions for Home, shared with its parts through context. */
export const useHomeState = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Active section tab: 'clinics' or 'doctors' (derived from searchParams)
  const activeSection: 'clinics' | 'doctors' = searchParams.get('tab') === 'doctors' ? 'doctors' : 'clinics';
  // Data State
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinics, setClinics] = useState<ClinicProfile[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingClinics, setLoadingClinics] = useState(true);
  // Clinic Selection (derived from searchParams URL query param & clinics data)
  const clinicIdParam = searchParams.get('clinicId');
  const selectedClinic = useMemo(() => {
    if (!clinicIdParam || clinics.length === 0) return null;
    return clinics.find((c) => c.id === clinicIdParam) || null;
  }, [clinicIdParam, clinics]);
  // Dedicated Clinic Search & Filter State
  const [clinicSearchQuery, setClinicSearchQuery] = useState('');
  const [clinicSelectedCity, setClinicSelectedCity] = useState('All');
  const [clinicSelectedState, setClinicSelectedState] = useState('All');
  const [clinicMobileFiltersOpen, setClinicMobileFiltersOpen] = useState(false);
  // Dedicated Doctor Search & Filter State
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');
  const [doctorLocationQuery, setDoctorLocationQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [selectedCity, setSelectedCity] = useState('All');
  const [selectedState, setSelectedState] = useState('All');
  const [maxFee, setMaxFee] = useState<number>(3000);
  const [sortBy, setSortBy] = useState<'experience' | 'fee_low' | 'fee_high'>('experience');
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
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', section);
    newParams.delete('clinicId');
    setSearchParams(newParams);
  };
  const handleSelectClinic = (clinic: ClinicProfile) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', 'clinics');
    newParams.set('clinicId', clinic.id);
    setSearchParams(newParams);
  };
  const handleClearClinic = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('clinicId');
    setSearchParams(newParams);
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
        return b.experienceYears - a.experienceYears;
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
    setSortBy('experience');
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
  return {
    navigate,
    searchParams,
    setSearchParams,
    activeSection,
    doctors,
    setDoctors,
    clinics,
    setClinics,
    loadingDoctors,
    setLoadingDoctors,
    loadingClinics,
    setLoadingClinics,
    clinicIdParam,
    selectedClinic,
    clinicSearchQuery,
    setClinicSearchQuery,
    clinicSelectedCity,
    setClinicSelectedCity,
    clinicSelectedState,
    setClinicSelectedState,
    clinicMobileFiltersOpen,
    setClinicMobileFiltersOpen,
    doctorSearchQuery,
    setDoctorSearchQuery,
    doctorLocationQuery,
    setDoctorLocationQuery,
    selectedSpecialty,
    setSelectedSpecialty,
    selectedCity,
    setSelectedCity,
    selectedState,
    setSelectedState,
    maxFee,
    setMaxFee,
    sortBy,
    setSortBy,
    minExperience,
    setMinExperience,
    doctorMobileFiltersOpen,
    setDoctorMobileFiltersOpen,
    heroSearchQuery,
    setHeroSearchQuery,
    heroLocationQuery,
    setHeroLocationQuery,
    handleHeroSearch,
    handleSectionSwitch,
    handleSelectClinic,
    handleClearClinic,
    clinicStateOptions,
    clinicCityOptions,
    doctorStateOptions,
    doctorCityOptions,
    specialtyCounts,
    filteredClinics,
    filteredDoctors,
    clinicPracticingDoctors,
    resetDoctorFilters,
    resetClinicFilters,
    getDoctorDetailPath,
    getDoctorBookPath,
  };
};

export type HomeState = ReturnType<typeof useHomeState>;
export const HomeContext = createContext<HomeState | null>(null);
export const useHome = (): HomeState => {
  const value = useContext(HomeContext);
  if (!value) throw new Error('useHome must be used inside Home');
  return value;
};
