import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  api,
  Doctor,
  ClinicProfile,
  PublicClinicDoctor,
  PaginationMeta,
  parseDoctorSlots,
  format12Hour,
  formatDoctorDegrees,
  getFileUrl,
  ALL_SPECIALTIES,
} from '../../services/api';
import { AppleButton } from '../../components/ui/AppleButton';
import { AppleFilterSelect } from '../../components/ui/AppleFilterSelect';
import { SubNav } from '../../components/layout/SubNav';
import clinicLobbyBg from '../../assets/clinic-lobby-bg.jpg';
import {
  Clock,
  SlidersHorizontal,
  RotateCcw,
  ChevronDown,
  X,
  Search,
  MapPin,
  Phone,
  ArrowLeft,
  Building2,
  Stethoscope,
} from 'lucide-react';
import { EmptyState } from '../../components/common/EmptyState';

import { SearchableSpecialtySelect } from '../../components/ui/SearchableSpecialtySelect';
import { INDIAN_STATES, getCitiesForState } from '../../utils/indiaStates';
import { formatDisplayPhone } from '../../utils/phoneUtils';
import { formatClinicAddress } from '../../utils/address';

const getClinicLocationDisplay = (clinic?: { address?: string; city?: string | null; state?: string | null } | null): string => {
  return formatClinicAddress(clinic) || 'Clinic';
};

interface DoctorDiscoveryProps {
  isPortalView?: boolean;
}

export const DoctorDiscovery: React.FC<DoctorDiscoveryProps> = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSpecialty = searchParams.get('specialty') || 'All';

  const activeSection: 'clinics' | 'doctors' = searchParams.get('tab') === 'clinics' ? 'clinics' : 'doctors';
  const [clinics, setClinics] = useState<ClinicProfile[]>([]);
  const [loadingClinics, setLoadingClinics] = useState(true);
  const selectedClinicId = searchParams.get('clinicId');
  const selectedClinic = useMemo(() => {
    if (!selectedClinicId || clinics.length === 0) return null;
    return clinics.find((c) => c.id === selectedClinicId) || null;
  }, [selectedClinicId, clinics]);
  const [clinicSearchQuery, setClinicSearchQuery] = useState('');
  const [clinicSelectedState, setClinicSelectedState] = useState('All');
  const [clinicSelectedCity, setClinicSelectedCity] = useState('All');
  const [clinicMobileFiltersOpen, setClinicMobileFiltersOpen] = useState(false);
  const [clinicPage, setClinicPage] = useState(1);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [allCatalogDoctors, setAllCatalogDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState(initialSpecialty);
  const [selectedState, setSelectedState] = useState('All');
  const [selectedCity, setSelectedCity] = useState('All');
  const [maxFee, setMaxFee] = useState<number>(3000);
  const [sortBy, setSortBy] = useState('experience');
  const [minExp, setMinExp] = useState<number>(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [doctorPage, setDoctorPage] = useState(1);
  const [doctorPagination, setDoctorPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Clinic State Options with facility counts
  const clinicStateOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    clinics.forEach((c) => {
      const state = c.state?.trim();
      if (state) {
        counts[state] = (counts[state] || 0) + 1;
      } else if (c.address) {
        for (const st of INDIAN_STATES) {
          if (c.address.toLowerCase().includes(st.toLowerCase())) {
            counts[st] = (counts[st] || 0) + 1;
            break;
          }
        }
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

  // Clinic City Options with facility counts
  const clinicCityOptions = useMemo(() => {
    if (clinicSelectedState === 'All') return [];
    const counts: Record<string, number> = {};
    const cities = getCitiesForState(clinicSelectedState);

    clinics.forEach((c) => {
      const isMatchState =
        !c.state ||
        c.state.toLowerCase() === clinicSelectedState.toLowerCase() ||
        (c.address && c.address.toLowerCase().includes(clinicSelectedState.toLowerCase()));

      if (isMatchState) {
        if (c.city) {
          const ct = c.city.trim();
          counts[ct] = (counts[ct] || 0) + 1;
        } else if (c.address) {
          for (const ct of cities) {
            if (c.address.toLowerCase().includes(ct.toLowerCase())) {
              counts[ct] = (counts[ct] || 0) + 1;
              break;
            }
          }
        }
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
    const source = allCatalogDoctors.length > 0 ? allCatalogDoctors : doctors;
    source.forEach((doc) => {
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
  }, [allCatalogDoctors, doctors]);

  // Doctor City Options with specialist counts
  const doctorCityOptions = useMemo(() => {
    if (selectedState === 'All') return [];
    const counts: Record<string, number> = {};
    const cities = getCitiesForState(selectedState);
    const source = allCatalogDoctors.length > 0 ? allCatalogDoctors : doctors;

    source.forEach((doc) => {
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
  }, [allCatalogDoctors, doctors, selectedState]);

  const handleStateChange = (newState: string) => {
    setSelectedState(newState);
    setSelectedCity('All');
  };

  // Load public clinics
  useEffect(() => {
    api.getPublicClinics()
      .then((data) => setClinics(data))
      .catch((err) => console.error('Failed to load clinics:', err))
      .finally(() => setLoadingClinics(false));
  }, []);

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

  const clinicLimit = 12;
  const clinicTotal = filteredClinics.length;
  const clinicTotalPages = Math.max(1, Math.ceil(clinicTotal / clinicLimit));
  const paginatedClinics = useMemo(() => {
    const start = (clinicPage - 1) * clinicLimit;
    return filteredClinics.slice(start, start + clinicLimit);
  }, [filteredClinics, clinicPage]);

  // Doctors practicing at the selected clinic
  const clinicPracticingDoctors = useMemo(() => {
    if (!selectedClinic) return [];
    if (selectedClinic.doctors && selectedClinic.doctors.length > 0) {
      return selectedClinic.doctors;
    }
    const matched = (allCatalogDoctors.length > 0 ? allCatalogDoctors : doctors).filter((d) =>
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
  }, [selectedClinic, allCatalogDoctors, doctors]);

  const resetClinicFilters = () => {
    setClinicSearchQuery('');
    setClinicSelectedState('All');
    setClinicSelectedCity('All');
    setClinicPage(1);
  };

  useEffect(() => {
    queueMicrotask(() => {
      setDoctorPage(1);
    });
  }, [search, locationQuery, selectedSpecialty, sortBy, minExp, maxFee, selectedState, selectedCity]);

  useEffect(() => {
    queueMicrotask(() => {
      setClinicPage(1);
    });
  }, [clinicSearchQuery, clinicSelectedState, clinicSelectedCity]);

  const loadDoctors = async (
    queryText: string,
    locationText: string,
    specialtyFilter: string,
    sortOrder: string,
    expFilter = minExp,
    feeCap = maxFee,
    stateFilter = selectedState,
    cityFilter = selectedCity,
    targetPage = doctorPage
  ) => {
    setLoading(true);
    try {
      const combinedSearch = [queryText.trim(), locationText.trim()].filter(Boolean).join(' ');
      const res = await api.getDoctorsPaginated({
        search: combinedSearch || undefined,
        specialty: specialtyFilter !== 'All' ? specialtyFilter : undefined,
        minExp: expFilter > 0 ? expFilter : undefined,
        maxFee: feeCap < 3000 ? feeCap : undefined,
        sortBy: sortOrder,
        state: stateFilter !== 'All' ? stateFilter : undefined,
        city: cityFilter !== 'All' ? cityFilter : undefined,
        page: targetPage,
        limit: 20,
      });
      setDoctors(res.data);
      setDoctorPagination(res.pagination);
      if (specialtyFilter === 'All' && !combinedSearch && expFilter === 0 && feeCap >= 3000 && stateFilter === 'All' && cityFilter === 'All' && targetPage === 1) {
        setAllCatalogDoctors(res.data);
      }
    } catch (err) {
      console.error('Failed to load doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load catalog for persistent global specialty counts
  useEffect(() => {
    api.getDoctors({ limit: 50 }).then((data) => {
      setAllCatalogDoctors(data);
    }).catch(() => {});
  }, []);

  // Instant debounced search & filter sync
  useEffect(() => {
    const timer = setTimeout(() => {
      loadDoctors(search, locationQuery, selectedSpecialty, sortBy, minExp, maxFee, selectedState, selectedCity, doctorPage);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, locationQuery, selectedSpecialty, sortBy, minExp, maxFee, selectedState, selectedCity, doctorPage]);

  // Specialty counts computed against unfiltered doctors catalog
  const specialtyCounts = useMemo(() => {
    const source = allCatalogDoctors.length > 0 ? allCatalogDoctors : doctors;
    const counts: Record<string, number> = { All: source.length };
    ALL_SPECIALTIES.forEach((s) => {
      counts[s] = source.filter((d) => d.specialty.toLowerCase() === s.toLowerCase()).length;
    });
    return counts;
  }, [allCatalogDoctors, doctors]);

  // Client-side location filtering, state filtering, and fee guard
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      if (locationQuery.trim()) {
        const lq = locationQuery.toLowerCase();
        const matchesClinic = doc.clinicAddress?.toLowerCase().includes(lq);
        const matchesAffiliated = doc.clinics?.some((c) =>
          (c.clinic?.address && c.clinic.address.toLowerCase().includes(lq)) ||
          (c.clinic?.city && c.clinic.city.toLowerCase().includes(lq)) ||
          (c.clinic?.state && c.clinic.state.toLowerCase().includes(lq)) ||
          (c.clinic?.clinicName && c.clinic.clinicName.toLowerCase().includes(lq))
        );
        if (!matchesClinic && !matchesAffiliated) return false;
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
      if (maxFee < 3000 && doc.consultationFee > maxFee) return false;
      return true;
    });
  }, [doctors, locationQuery, maxFee, selectedState, selectedCity]);

  const resetFilters = () => {
    setSearch('');
    setLocationQuery('');
    setSelectedSpecialty('All');
    setSelectedState('All');
    setSelectedCity('All');
    setMaxFee(3000);
    setMinExp(0);
    setSortBy('experience');
    setDoctorPage(1);
    setSearchParams({});
  };

  const hasActiveFilters = Boolean(
    selectedSpecialty !== 'All' ||
    selectedState !== 'All' ||
    selectedCity !== 'All' ||
    search.trim() ||
    locationQuery.trim() ||
    maxFee < 3000 ||
    minExp > 0 ||
    sortBy !== 'experience'
  );

  const activeFilterCount =
    (selectedSpecialty !== 'All' ? 1 : 0) +
    (selectedState !== 'All' ? 1 : 0) +
    (selectedCity !== 'All' ? 1 : 0) +
    (search.trim() ? 1 : 0) +
    (locationQuery.trim() ? 1 : 0) +
    (maxFee < 3000 ? 1 : 0) +
    (minExp > 0 ? 1 : 0) +
    (sortBy !== 'experience' ? 1 : 0);

  // Synchronize specialty filter when query param changes
  useEffect(() => {
    queueMicrotask(() => {
      const paramSpec = searchParams.get('specialty') || 'All';
      if (paramSpec !== selectedSpecialty) {
        setSelectedSpecialty(paramSpec);
      }
    });
  }, [searchParams, selectedSpecialty]);

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

  const getDoctorDetailPath = (doctorId: string) => `/doctor/${doctorId}`;

  const getBookPath = (doctorId: string) => `/book/${doctorId}`;

  const discoveryContent = (
    <div className="w-full space-y-6">
      {/* Apple Segmented Switcher Header: Clinics & Doctors */}
      <div className="flex flex-col sm:flex-row items-center gap-3.5 sm:gap-4 pb-6 border-b border-[#e5e5ea]">
        <div className="h-11 inline-flex items-center p-1 bg-[#e8e8ed]/70 rounded-full border border-[#e5e5ea] shrink-0 no-scrollbar">
          <button
            type="button"
            onClick={() => handleSectionSwitch('clinics')}
            className={`h-full flex items-center justify-center px-6 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer active:scale-95 ${
              activeSection === 'clinics'
                ? 'bg-white text-[#1d1d1f] '
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
                ? 'bg-white text-[#1d1d1f] '
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <span>Doctors</span>
          </button>
        </div>

        {/* Search bar beside Clinics Switch */}
        {activeSection === 'clinics' && !selectedClinic && (
          <div className="flex-1 w-full flex flex-col gap-2">
            <div className="w-full h-11 bg-white px-3.5 rounded-full border border-[#e5e5ea] flex items-center gap-2 sm:gap-3 ">
              <div className="flex items-center gap-2 flex-1 h-full min-w-0">
                <Search className="w-4 h-4 text-[#86868b] shrink-0" />
                <input
                  type="text"
                  value={clinicSearchQuery}
                  onChange={(e) => setClinicSearchQuery(e.target.value)}
                  placeholder="Search clinics"
                  className="w-full h-full bg-transparent text-xs sm:text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none truncate"
                />
                {clinicSearchQuery && (
                  <button aria-label="Close"
                    type="button"
                    onClick={() => setClinicSearchQuery('')}
                    className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* State Filter - Desktop */}
              <div className="hidden sm:block w-px h-5 bg-[#e5e5ea] shrink-0" />
              <div className="hidden sm:flex w-36 sm:w-40 h-full items-center shrink-0">
                <AppleFilterSelect
                  value={clinicSelectedState}
                  onChange={(st) => {
                    setClinicSelectedState(st);
                    setClinicSelectedCity('All');
                  }}
                  options={clinicStateOptions}
                  placeholder="All States"
                  variant="searchbar"
                  align="right"
                />
              </div>

              {/* City Filter - Desktop */}
              <div className="hidden sm:block w-px h-5 bg-[#e5e5ea] shrink-0" />
              <div className="hidden sm:flex w-36 sm:w-40 h-full items-center shrink-0">
                <AppleFilterSelect
                  value={clinicSelectedCity}
                  onChange={setClinicSelectedCity}
                  options={clinicCityOptions}
                  placeholder={clinicSelectedState !== 'All' ? `All Cities in ${clinicSelectedState}` : 'All Cities'}
                  disabled={clinicSelectedState === 'All'}
                  variant="searchbar"
                  align="right"
                />
              </div>

              {/* Mobile Filter Toggle */}
              <button
                type="button"
                onClick={() => setClinicMobileFiltersOpen(!clinicMobileFiltersOpen)}
                className="sm:hidden h-9 px-3.5 rounded-full border border-[#e5e5ea] bg-[#f5f5f7] text-xs font-normal text-[#1d1d1f] flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
              >
                <SlidersHorizontal className="w-3 h-3 text-[#86868b]" />
                <span>Filters{(clinicSelectedState !== 'All' || clinicSelectedCity !== 'All') ? ' •' : ''}</span>
              </button>

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

            {/* Mobile Filter Expandable Drawer for Clinics */}
            {clinicMobileFiltersOpen && (
              <div className="sm:hidden w-full bg-white rounded-2xl border border-[#e5e5ea] p-3.5  space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-[#e5e5ea]">
                  <span className="text-xs font-semibold text-[#1d1d1f]">Location</span>
                  <button
                    type="button"
                    onClick={() => setClinicMobileFiltersOpen(false)}
                    className="text-xs font-normal text-[#0066cc]"
                  >
                    Done
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-normal text-[#86868b]">State</label>
                  <div className="w-full h-10">
                    <AppleFilterSelect
                      value={clinicSelectedState}
                      onChange={(st) => {
                        setClinicSelectedState(st);
                        setClinicSelectedCity('All');
                      }}
                      options={clinicStateOptions}
                      placeholder="All States"
                      variant="searchbar"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-normal text-[#86868b]">City</label>
                  <div className="w-full h-10">
                    <AppleFilterSelect
                      value={clinicSelectedCity}
                      onChange={setClinicSelectedCity}
                      options={clinicCityOptions}
                      placeholder={clinicSelectedState !== 'All' ? `All Cities in ${clinicSelectedState}` : 'All Cities'}
                      disabled={clinicSelectedState === 'All'}
                      variant="searchbar"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION A: CLINICS DISCOVERY */}
      {activeSection === 'clinics' && (
        <div>
          {selectedClinic ? (
            <div className="space-y-6 animate-fadeIn">
              {/* Selected Clinic Header Card */}
              <div className="bg-white rounded-2xl border border-[#e5e5ea] p-6 ">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#f5f5f7] border border-[#e5e5ea] shrink-0  flex items-center justify-center">
                      <img
                        src={selectedClinic.avatarUrl ? getFileUrl(selectedClinic.avatarUrl) : clinicLobbyBg}
                        alt={selectedClinic.clinicName}
                        className="w-full h-full object-cover object-center"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = clinicLobbyBg;
                        }}
                      />
                    </div>
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
                        <span className="inline-flex items-center text-[11px] px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f] font-normal border border-[#e5e5ea]">
                          {clinicPracticingDoctors.length} {clinicPracticingDoctors.length === 1 ? 'Specialist' : 'Specialists'}
                        </span>
                      </div>
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
                  <div className="bg-white rounded-2xl border border-[#e5e5ea] p-12 text-center max-w-md mx-auto ">
                    <h4 className="text-base font-semibold text-[#1d1d1f] mb-1">
                      No doctors listed
                    </h4>
                    <p className="text-xs text-[#86868b] mb-5">
                      This clinic has no doctors yet.
                    </p>
                    <AppleButton variant="secondary" size="sm" onClick={handleClearClinic}>
                      Back to Clinics
                    </AppleButton>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fill,minmax(320px,1fr))] gap-4 sm:gap-6 w-full">
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
                          className="w-full bg-white rounded-2xl border border-[#e5e5ea]  overflow-hidden hover:border-[#0066cc]/40 transition-all duration-200 flex flex-col justify-between group"
                        >
                          {/* Doctor Photo Banner */}
                          <div
                            onClick={() => navigate(getDoctorDetailPath(doctor.id) + `?clinicId=${selectedClinic.id}`)}
                            className="relative w-full aspect-[16/10] bg-[#f5f5f7] border-b border-[#f0f0f2] overflow-hidden cursor-pointer flex items-center justify-center"
                          >
                            {doctor.user?.avatarUrl ? (
                              <img
                                src={getFileUrl(doctor.user.avatarUrl)}
                                alt={doctor.user?.fullName}
                                className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const fallback = e.currentTarget.parentElement?.querySelector('.doc-disc-clinic-fallback');
                                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div
                              className={`doc-disc-clinic-fallback w-full h-full ${
                                doctor.user?.avatarUrl ? 'hidden' : 'flex'
                              } items-center justify-center font-semibold text-[44px] text-[#c7c7cc] bg-[#f5f5f7] select-none`}
                            >
                              {(doctor.user?.fullName ? doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] : null) || 'D'}
                            </div>
                          </div>

                          {/* Card Body */}
                          <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between gap-2.5">
                                <div className="min-w-0">
                                  <h4
                                    onClick={() => navigate(getDoctorDetailPath(doctor.id) + `?clinicId=${selectedClinic.id}`)}
                                    className="text-[17px] font-semibold text-[#1d1d1f] hover:text-[#0066cc] cursor-pointer tracking-tight transition-colors duration-150 truncate leading-snug"
                                    title={doctor.user?.fullName}
                                  >
                                    {doctor.user?.fullName}
                                  </h4>
                                  <div className="mt-1 flex items-center gap-1.5 text-xs text-[#86868b] truncate">
                                    <span className="font-normal text-[#0066cc]">{doctor.specialty}</span>
                                    {cleanDegrees && (
                                      <>
                                        <span className="text-[#c7c7cc] select-none">•</span>
                                        <span className="font-normal text-[#48484a]">{cleanDegrees}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <span className="text-[11px] font-normal text-[#48484a] bg-[#f5f5f7] px-2.5 py-0.5 rounded-full border border-[#e5e5ea] shrink-0 whitespace-nowrap select-none">
                                  {doctor.experienceYears} yrs exp
                                </span>
                              </div>

                              <div className="mt-3.5 space-y-2 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Clock className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                                  <span className="truncate text-[#48484a] font-normal tracking-tight">
                                    {slots.length > 0
                                      ? `${format12Hour(slots[0].startTime)} – ${format12Hour(slots[0].endTime)}`
                                      : 'Clinical Shift'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 pt-3.5 border-t border-[#f0f0f2] flex items-center justify-between gap-3">
                              <div className="flex items-baseline gap-1">
                                <span className="text-[21px] font-semibold text-[#1d1d1f] tracking-tight">
                                  ₹{effectiveFee.toFixed(0)}
                                </span>
                                <span className="text-xs text-[#86868b] font-normal">/ visit</span>
                              </div>

                              {docItem.hasReceptionist === false ? (
                                <span
                                  className="h-8 px-3.5 rounded-full text-[11px] font-normal text-[#86868b] bg-[#f5f5f7] border border-[#e5e5ea] inline-flex items-center justify-center select-none"
                                  title="Online booking is closed at this clinic for now."
                                >
                                  Closed
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => navigate(getBookPath(doctor.id) + `?clinicId=${selectedClinic.id}`)}
                                  className="h-8 min-w-[78px] px-5 rounded-full text-xs font-normal text-white bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.97] transition-all duration-150 ease-out cursor-pointer select-none  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc]/40 inline-flex items-center justify-center"
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
            <div>
              {loadingClinics ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fill,minmax(320px,1fr))] gap-4 sm:gap-6 w-full">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="h-72 rounded-2xl bg-white border border-[#e5e5ea] animate-pulse p-4"
                    />
                  ))}
                </div>
              ) : filteredClinics.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="No clinics found"
                  description="No clinics match your search."
                  actionText="Reset Filters"
                  onAction={resetClinicFilters}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fill,minmax(320px,1fr))] gap-4 sm:gap-6 w-full">
                  {paginatedClinics.map((clinic) => {
                    const docCount = (clinic.doctors && Array.isArray(clinic.doctors))
                      ? clinic.doctors.length
                      : (clinic._count?.doctors ?? 0);
                    const locationDisplay = getClinicLocationDisplay(clinic);

                    return (
                      <div
                        key={clinic.id}
                        onClick={() => handleSelectClinic(clinic)}
                        className="w-full bg-white rounded-2xl border border-[#e5e5ea]  overflow-hidden hover:border-[#0066cc]/40 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
                      >
                        {/* Top Facility Photography Banner */}
                        <div className="relative w-full aspect-[16/10] bg-[#f5f5f7] border-b border-[#f0f0f2] overflow-hidden flex items-center justify-center">
                          <img
                            src={clinic.avatarUrl ? getFileUrl(clinic.avatarUrl) : clinicLobbyBg}
                            alt={clinic.clinicName}
                            className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = clinicLobbyBg;
                            }}
                          />
                        </div>

                        {/* Card Body */}
                        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                          <div>
                            <h3
                              className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight leading-snug group-hover:text-[#0066cc] transition-colors truncate"
                              title={clinic.clinicName}
                            >
                              {clinic.clinicName}
                            </h3>

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

                          <div className="mt-4 pt-3.5 border-t border-[#f0f0f2] flex items-center justify-between gap-3">
                            <span className="text-xs font-normal text-[#48484a] bg-[#f5f5f7] px-2.5 py-1 rounded-full border border-[#e5e5ea]">
                              {docCount === 1 ? '1 Specialist' : `${docCount} Specialists`}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectClinic(clinic);
                              }}
                              className="h-8 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-normal transition-all duration-150 active:scale-[0.97] inline-flex items-center justify-center cursor-pointer select-none "
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

              {clinicTotalPages > 1 && (
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-[#e5e5ea]">
                  <p className="text-xs text-[#86868b]">
                    Showing <span className="font-semibold text-[#1d1d1f]">{(clinicPage - 1) * clinicLimit + 1}</span>–<span className="font-semibold text-[#1d1d1f]">{Math.min(clinicPage * clinicLimit, clinicTotal)}</span> of <span className="font-semibold text-[#1d1d1f]">{clinicTotal}</span> clinics
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={clinicPage <= 1}
                      onClick={() => {
                        setClinicPage((p) => Math.max(1, p - 1));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="h-8 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] text-xs font-semibold text-[#1d1d1f] border border-[#e5e5ea] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Previous
                    </button>
                    <span className="px-3 text-xs font-normal text-[#48484a]">
                      Page {clinicPage} of {clinicTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={clinicPage >= clinicTotalPages}
                      onClick={() => {
                        setClinicPage((p) => p + 1);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="h-8 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] text-xs font-semibold text-[#1d1d1f] border border-[#e5e5ea] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION B: DOCTORS DISCOVERY */}
      {activeSection === 'doctors' && (
        <>
          {/* Mobile Filter Toggle Drawer */}
          <div className="lg:hidden">
            <div className="bg-white rounded-2xl border border-[#e5e5ea] p-3.5 ">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 h-11 px-3.5 rounded-xl bg-white border border-[#d2d2d7]  focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all duration-150">
              <Search className="w-4 h-4 text-[#86868b] shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search doctor or clinic..."
                className="w-full bg-transparent text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none"
              />
              {search && (
                <button aria-label="Close" type="button" onClick={() => setSearch('')} className="text-[#86868b] hover:text-[#1d1d1f]">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              className={`h-11 px-4 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                hasActiveFilters || mobileFiltersOpen
                  ? 'bg-[#0066cc] text-white border-[#0066cc] '
                  : 'bg-[#f5f5f7] text-[#1d1d1f] border-[#e5e5ea] hover:bg-[#e8e8ed]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-white text-[#0066cc] text-[11px] font-semibold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Mobile Expandable Filter Options */}
          {mobileFiltersOpen && (
            <div className="pt-4 mt-3 border-t border-[#f0f0f2] space-y-4">

              {/* State Filter */}
              <div>
                <AppleFilterSelect
                  label="State"
                  value={selectedState}
                  onChange={handleStateChange}
                  options={doctorStateOptions}
                  placeholder="All States"
                  variant="form"
                />
              </div>

              {/* City Filter */}
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

              {/* Specialty Select */}
              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Specialty
                </label>
                <SearchableSpecialtySelect
                  value={selectedSpecialty}
                  onChange={(spec) => {
                    setSelectedSpecialty(spec);
                    setSearchParams(spec === 'All' ? {} : { specialty: spec });
                  }}
                  variant="form"
                  includeAll={true}
                  counts={specialtyCounts}
                />
              </div>

              {/* Max Consultation Fee Slider */}
              <div>
                <div className="flex items-center justify-between text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  <span>Max fee</span>
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
              </div>

              {/* Experience & Sort Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                    Experience
                  </label>
                  <select
                    value={minExp}
                    onChange={(e) => setMinExp(Number(e.target.value))}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 cursor-pointer"
                  >
                    <option value={0}>Any</option>
                    <option value={5}>5+ Years</option>
                    <option value={10}>10+ Years</option>
                    <option value={15}>15+ Years</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 cursor-pointer"
                  >
                    <option value="experience">Most Experienced</option>
                    <option value="fee_low">Fee: Low to High</option>
                    <option value="fee_high">Fee: High to Low</option>
                  </select>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="w-full h-11 rounded-full text-xs font-normal text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e5e5ea] transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Desktop Layout: Left Sidebar + Right Results Grid */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start w-full">
        {/* LEFT SIDEBAR: Sticky Filters on Desktop */}
        <aside className="hidden lg:block w-64 xl:w-72 shrink-0 lg:sticky lg:top-24 space-y-4">
          <div className="bg-white rounded-2xl border border-[#e5e5ea] p-5  space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#f0f0f2]">
              <h3 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">Filters</h3>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="h-6 px-2.5 rounded-full text-xs font-normal text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e5e5ea] transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Search Doctor or Clinic */}
            <div>
              <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                Search
              </label>
              <div className="flex items-center gap-2 h-11 px-3.5 rounded-xl bg-white border border-[#d2d2d7]  focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all duration-150">
                <Search className="w-4 h-4 text-[#86868b] shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Doctor or clinic"
                  className="w-full bg-transparent text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none"
                />
                {search && (
                  <button aria-label="Close" type="button" onClick={() => setSearch('')} className="text-[#86868b] hover:text-[#1d1d1f]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* State Filter */}
            <div>
              <AppleFilterSelect
                label="State"
                value={selectedState}
                onChange={handleStateChange}
                options={doctorStateOptions}
                placeholder="All States"
                variant="form"
              />
            </div>

            {/* City Filter */}
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

            {/* Specialty Select */}
            <div>
              <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                Specialty
              </label>
              <SearchableSpecialtySelect
                value={selectedSpecialty}
                onChange={(spec) => {
                  setSelectedSpecialty(spec);
                  setSearchParams(spec === 'All' ? {} : { specialty: spec });
                }}
                variant="form"
                includeAll={true}
                counts={specialtyCounts}
                placeholder="Any specialty"
              />
            </div>

            {/* Max Consultation Fee Slider */}
            <div>
              <div className="flex items-center justify-between text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                <span>Max fee</span>
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
              <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
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
                    onClick={() => setMinExp(item.value)}
                    className={`py-1.5 rounded-lg text-[11px] transition-all duration-150 text-center cursor-pointer ${
                      minExp === item.value
                        ? 'bg-white text-[#1d1d1f] font-semibold  border border-black/5'
                        : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT MAIN AREA: Results Header + Doctor Cards Grid */}
        <div className="flex-1 w-full min-w-0">
          {/* Open Apple Catalog Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-6 border-b border-[#e5e5ea]">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                {selectedSpecialty === 'All' ? 'Specialists' : selectedSpecialty}
              </h2>
              <span className="text-sm text-[#86868b] font-normal">
                ({filteredDoctors.length})
              </span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Active Filter Chips */}
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {selectedSpecialty !== 'All' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-[#1d1d1f] text-xs font-normal border border-[#e5e5ea] ">
                      {selectedSpecialty}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSpecialty('All');
                          setSearchParams({});
                        }}
                        className="hover:opacity-75 cursor-pointer"
                      >
                        <X className="w-3 h-3 text-[#86868b]" />
                      </button>
                    </span>
                  )}
                  {selectedState !== 'All' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-[#1d1d1f] text-xs font-normal border border-[#e5e5ea] ">
                      {selectedState}
                      <button aria-label="Close"
                        type="button"
                        onClick={() => handleStateChange('All')}
                        className="hover:opacity-75 cursor-pointer"
                      >
                        <X className="w-3 h-3 text-[#86868b]" />
                      </button>
                    </span>
                  )}
                  {selectedCity !== 'All' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-[#1d1d1f] text-xs font-normal border border-[#e5e5ea] ">
                      {selectedCity}
                      <button aria-label="Close"
                        type="button"
                        onClick={() => setSelectedCity('All')}
                        className="hover:opacity-75 cursor-pointer"
                      >
                        <X className="w-3 h-3 text-[#86868b]" />
                      </button>
                    </span>
                  )}
                  {maxFee < 3000 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-[#1d1d1f] text-xs font-normal border border-[#e5e5ea] ">
                      ≤ ₹{maxFee}
                      <button aria-label="Close" type="button" onClick={() => setMaxFee(3000)} className="hover:opacity-75 cursor-pointer">
                        <X className="w-3 h-3 text-[#86868b]" />
                      </button>
                    </span>
                  )}
                  {minExp > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-[#1d1d1f] text-xs font-normal border border-[#e5e5ea] ">
                      {minExp}+ Yrs
                      <button aria-label="Close" type="button" onClick={() => setMinExp(0)} className="hover:opacity-75 cursor-pointer">
                        <X className="w-3 h-3 text-[#86868b]" />
                      </button>
                    </span>
                  )}
                </div>
              )}

              {/* Apple Sort Selector */}
              <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
                <div className="relative inline-flex items-center">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none h-9 pl-3.5 pr-8 rounded-full border border-[#d2d2d7] bg-white hover:bg-[#f5f5f7] text-xs font-normal text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] cursor-pointer  transition-all"
                  >
                    <option value="experience">Most Experienced</option>
                    <option value="fee_low">Fee: Low to High</option>
                    <option value="fee_high">Fee: High to Low</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#86868b] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </div>

          {/* Doctor Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fill,minmax(320px,1fr))] gap-4 sm:gap-6 w-full">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-72 rounded-2xl bg-white border border-[#e5e5ea] animate-pulse p-4"></div>
              ))}
            </div>
          ) : filteredDoctors.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title="No doctors found"
              description="No doctors match your filters."
              actionText="Reset All Filters"
              onAction={resetFilters}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fill,minmax(320px,1fr))] gap-4 sm:gap-6 w-full">
              {filteredDoctors.map((doctor) => {
                const slots = parseDoctorSlots(doctor);
                const cleanDegrees = formatDoctorDegrees(doctor.qualifications);
                const primaryClinicAffiliation = doctor.clinics?.find((c) => c?.clinic) || null;
                const primaryClinic = primaryClinicAffiliation?.clinic || null;
                const hasClinics = Boolean(primaryClinic);
                const effectiveFee = primaryClinicAffiliation?.consultationFee ?? doctor.consultationFee ?? 0;

                // Extract all unique clinic cities for this doctor
                const affiliatedClinics = doctor.clinics?.map((c) => c?.clinic).filter(Boolean) || [];
                const uniqueCities = Array.from(
                  new Set(
                    affiliatedClinics
                      .map((c) => c?.city?.trim())
                      .filter((city): city is string => Boolean(city && city.length > 0))
                  )
                );
                if (uniqueCities.length === 0 && doctor.clinicAddress) {
                  const fallbackCity = doctor.clinicAddress.split(',').pop()?.trim();
                  if (fallbackCity) uniqueCities.push(fallbackCity);
                }
                const displayCity = uniqueCities[0] || '';

                const locationStrings = affiliatedClinics
                  .map((c) => [c?.city?.trim(), c?.state?.trim()].filter(Boolean).join(', '))
                  .filter((s) => s.length > 0);
                const allCitiesTooltip = locationStrings.length > 0
                  ? `Practicing in: ${Array.from(new Set(locationStrings)).join(' • ')}`
                  : uniqueCities.length > 0
                  ? `Practicing in: ${uniqueCities.join(', ')}`
                  : 'Clinic practice';

                return (
                  <div
                    key={doctor.id}
                    className="w-full bg-white rounded-2xl border border-[#e5e5ea]  overflow-hidden hover:border-[#0066cc]/40 transition-all duration-200 flex flex-col justify-between group"
                  >
                    {/* Doctor Photo Banner - Natural 16:10 proportion displaying the full photo */}
                    <div
                      onClick={() => navigate(getDoctorDetailPath(doctor.id))}
                      className="relative w-full aspect-[16/10] bg-[#f5f5f7] border-b border-[#f0f0f2] overflow-hidden cursor-pointer flex items-center justify-center"
                    >
                      {doctor.user?.avatarUrl ? (
                        <img
                          src={getFileUrl(doctor.user.avatarUrl)}
                          alt={doctor.user?.fullName || 'Doctor'}
                          className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                          loading="eager"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement?.querySelector('.doc-disc-fallback-banner');
                            if (fallback) (fallback as HTMLElement).style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className={`doc-disc-fallback-banner w-full h-full ${
                          doctor.user?.avatarUrl ? 'hidden' : 'flex'
                        } items-center justify-center font-semibold text-[44px] text-[#c7c7cc] bg-[#f5f5f7] select-none`}
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
                              title={doctor.user?.fullName || 'Doctor'}
                            >
                              {doctor.user?.fullName || 'Doctor'}
                            </h3>
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-[#86868b] truncate">
                              <span className="font-normal text-[#0066cc]">{doctor.specialty}</span>
                              {cleanDegrees && (
                                <>
                                  <span className="text-[#c7c7cc] select-none">•</span>
                                  <span className="font-normal text-[#48484a]">{cleanDegrees}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] font-normal text-[#48484a] bg-[#f5f5f7] px-2.5 py-0.5 rounded-full border border-[#e5e5ea] shrink-0 whitespace-nowrap select-none">
                            {doctor.experienceYears} yrs exp
                          </span>
                        </div>

                        {/* Clinical Venue & Shifts */}
                        <div className="mt-3.5 space-y-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <MapPin className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                            <span className="truncate text-[#1d1d1f] font-normal" title={allCitiesTooltip || primaryClinic?.clinicName}>
                              {hasClinics && primaryClinic ? (
                                <>
                                  <span>{primaryClinic.clinicName}</span>
                                  {primaryClinic.city ? (
                                    <span className="text-[#86868b] font-normal"> · {primaryClinic.city}</span>
                                  ) : displayCity ? (
                                    <span className="text-[#86868b] font-normal"> · {displayCity}</span>
                                  ) : null}
                                </>
                              ) : (
                                <span className="text-[#86868b] font-normal">Direct Practice{displayCity ? ` · ${displayCity}` : ''}</span>
                              )}
                            </span>
                            {(doctor.clinics?.length ?? 0) > 1 && (
                              <span className="text-[11px] font-normal text-[#0066cc] bg-[#0066cc]/8 px-2 py-0.5 rounded-full border border-[#0066cc]/15 shrink-0 select-none">
                                +{(doctor.clinics?.length ?? 0) - 1} more
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 min-w-0">
                            <Clock className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                            <span className="truncate text-[#48484a] font-normal tracking-tight">
                              {slots.length > 0
                                ? `${format12Hour(slots[0].startTime)} – ${format12Hour(slots[0].endTime)}`
                                : doctor.checkingStartTime
                                ? `${format12Hour(doctor.checkingStartTime)} – ${format12Hour(doctor.checkingEndTime)}`
                                : 'Outpatient Shift'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Apple Card Footer: Fee & Booking CTA */}
                      <div className="mt-4 pt-3.5 border-t border-[#f0f0f2] flex items-center justify-between gap-3">
                        <div className="flex items-baseline gap-1">
                          <span className="text-[21px] font-semibold text-[#1d1d1f] tracking-tight">
                            ₹{effectiveFee.toFixed(0)}
                          </span>
                          <span className="text-xs text-[#86868b] font-normal">/ visit</span>
                        </div>

                        <div>
                          {hasClinics ? (
                            <button
                              type="button"
                              onClick={() => navigate(getBookPath(doctor.id))}
                              className="h-8 min-w-[78px] px-5 rounded-full text-xs font-normal text-white bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.97] transition-all duration-150 ease-out cursor-pointer select-none  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc]/40 inline-flex items-center justify-center"
                            >
                              Book
                            </button>
                          ) : (
                            <span className="text-xs text-[#86868b] bg-[#f5f5f7] px-3 py-1.5 rounded-full border border-[#e5e5ea] select-none">
                              Unavailable
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {doctorPagination.totalPages > 1 && (
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-[#e5e5ea]">
              <p className="text-xs text-[#86868b]">
                Showing <span className="font-semibold text-[#1d1d1f]">{(doctorPagination.page - 1) * doctorPagination.limit + 1}</span>–<span className="font-semibold text-[#1d1d1f]">{Math.min(doctorPagination.page * doctorPagination.limit, doctorPagination.total)}</span> of <span className="font-semibold text-[#1d1d1f]">{doctorPagination.total}</span> verified specialists
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!doctorPagination.hasPrevPage}
                  onClick={() => {
                    setDoctorPage((p) => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="h-8 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] text-xs font-semibold text-[#1d1d1f] border border-[#e5e5ea] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Previous
                </button>
                <span className="px-3 text-xs font-normal text-[#48484a]">
                  Page {doctorPagination.page} of {doctorPagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={!doctorPagination.hasNextPage}
                  onClick={() => {
                    setDoctorPage((p) => p + 1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="h-8 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] text-xs font-semibold text-[#1d1d1f] border border-[#e5e5ea] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav title="Find care" width="wide">
        <span className="text-xs text-[#86868b] font-normal">
          {activeSection === 'clinics'
            ? `${filteredClinics.length} Verified Clinic${filteredClinics.length === 1 ? '' : 's'}`
            : `${doctorPagination.total || doctors.length} Verified Specialist${(doctorPagination.total || doctors.length) === 1 ? '' : 's'}`}
        </span>
      </SubNav>

      <div className="w-full max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-14 py-5 sm:py-8">
        {discoveryContent}
      </div>
    </div>
  );
};
