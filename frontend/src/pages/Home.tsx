import React from 'react';
import { Search, MapPin, X, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useHomeState, HomeContext } from './home/state';
import { ClinicsGridSection } from './home/ClinicsGridSection';
import { DoctorsIntroSection } from './home/DoctorsIntroSection';
import { ClinicsSection } from './home/ClinicsSection';
import { DoctorsSection } from './home/DoctorsSection';
import { HeroQueuePreview } from './home/HeroQueuePreview';
import { HowItWorksSection, ForClinicsSection } from './home/HomeMarketing';
import { BenefitsStrip, SpecialtySection } from './home/HomeHighlights';
import heroPhoto from '../assets/healthcare-hero-bg.webp';
export const Home: React.FC = () => {
  const state = useHomeState();
  const {
    activeSection,
    selectedClinic,
    heroSearchQuery,
    setHeroSearchQuery,
    heroLocationQuery,
    setHeroLocationQuery,
    handleHeroSearch,
    handleSectionSwitch,
    clinics,
    doctors,
    loadingClinics,
    loadingDoctors,
  } = state;
  return (
    <HomeContext.Provider value={state}>
<div className="flex flex-col min-h-screen bg-[#f5f5f7]">
      {/* 1. Hero: headline + search on the left, sample live token on the right */}
      <section className="relative overflow-hidden bg-[#eaf2fb]">
        {/* Full-width clinic photo; white wash keeps the text readable */}
        <img
          src={heroPhoto}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover object-[70%_center] lg:object-center"
        />
        <div className="absolute inset-0 lg:hidden bg-gradient-to-b from-white/95 via-white/75 to-white/10" />
        <div className="absolute inset-0 hidden lg:block bg-[linear-gradient(90deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.9)_34%,rgba(255,255,255,0.4)_56%,rgba(255,255,255,0)_74%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#f5f5f7] via-[#f5f5f7]/60 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-12 pb-24 sm:pt-16 sm:pb-28 lg:pt-24 lg:pb-36 grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-6 lg:gap-12 items-center">
          <div className="text-center lg:text-left">
            <h1 className="ma-fade-up ma-delay-1 font-display text-[40px] leading-[1.05] sm:text-6xl lg:text-[54px] xl:text-[58px] font-semibold text-[#1d1d1f] tracking-tight">
              Book your token.
              <br />
              <span className="bg-gradient-to-r from-[#0066cc] to-[#2997ff] bg-clip-text text-transparent">
                Skip the waiting room.
              </span>
            </h1>

            {/* Search: doctor/clinic + location */}
            <div className="ma-fade-up ma-delay-3 mt-8 max-w-2xl mx-auto lg:mx-0 bg-white p-2 rounded-2xl sm:rounded-full border border-[#d2d2d7] flex flex-col sm:flex-row items-center gap-2 focus-within:border-primary transition-colors">
              <div className="flex items-center gap-2.5 flex-1 w-full px-3.5 py-1">
                <Search className="w-4 h-4 text-[#86868b] shrink-0" />
                <input
                  type="text"
                  value={heroSearchQuery}
                  onChange={(e) => setHeroSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleHeroSearch()}
                  placeholder="Doctor, clinic or specialty"
                  aria-label="Search doctor, clinic or specialty"
                  className="w-full bg-transparent text-base sm:text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
                />
                {heroSearchQuery && (
                  <button
                    aria-label="Clear search"
                    type="button"
                    onClick={() => setHeroSearchQuery('')}
                    className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="hidden sm:block w-px h-6 bg-[#e0e0e0]" />
              <div className="block sm:hidden w-full h-px bg-[#f0f0f2]" />

              <div className="flex items-center gap-2.5 w-full sm:w-40 px-3.5 py-1">
                <MapPin className="w-4 h-4 text-[#86868b] shrink-0" />
                <input
                  type="text"
                  value={heroLocationQuery}
                  onChange={(e) => setHeroLocationQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleHeroSearch()}
                  placeholder="City"
                  aria-label="City or location"
                  className="w-full bg-transparent text-base sm:text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
                />
                {heroLocationQuery && (
                  <button
                    aria-label="Clear city"
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
                className="w-full sm:w-auto h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-sm font-normal transition-all duration-150 active:scale-[0.98] inline-flex items-center justify-center gap-2 cursor-pointer select-none shrink-0"
              >
                <Search className="w-4 h-4" />
                <span>Search</span>
              </button>
            </div>

            <div className="ma-fade-up ma-delay-4 mt-5 flex flex-wrap items-center justify-center lg:justify-start gap-3">
              {/* Walk-in patients track their queue with mobile number + code (FIX-058) */}
              <Link
                to="/track"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white/90 backdrop-blur-md hover:bg-white border border-[#d2d2d7] text-sm text-[#1d1d1f] transition-all active:scale-[0.98]"
              >
                <Ticket className="w-4 h-4 text-[#0066cc]" />
                <span>Track walk-in</span>
              </Link>
            </div>
          </div>

          <div className="ma-fade-up ma-delay-2 lg:pl-10">
            <HeroQueuePreview />
          </div>
        </div>
      </section>

      <BenefitsStrip />
      <SpecialtySection />

      {/* 2. Main Discovery Workspace */}
      <section id="catalog-section" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-14 pb-16 sm:pt-20 sm:pb-24 flex-1 scroll-mt-16">
        <div className="mb-6 text-center sm:text-left">
          <h2 className="text-2xl sm:text-[32px] font-semibold tracking-tight text-[#1d1d1f]">Find care near you</h2>
          {!loadingClinics && !loadingDoctors && (clinics.length > 0 || doctors.length > 0) && (
            <p className="mt-2 text-sm text-[#86868b]">
              {clinics.length} {clinics.length === 1 ? 'clinic' : 'clinics'} · {doctors.length}{' '}
              {doctors.length === 1 ? 'doctor' : 'doctors'}
            </p>
          )}
        </div>
        {/* Navigation & Search Bar Header */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 sm:gap-4 pb-6 mb-8 border-b border-[#e5e5ea]">
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

          {/* Search bar beside Clinics & Doctors Switch */}
          {activeSection === 'clinics' && !selectedClinic && (
            <ClinicsGridSection />
          )}

          {activeSection === 'doctors' && (
            <DoctorsIntroSection />
          )}
        </div>

        {/* SECTION A: CLINICS DISCOVERY */}
        {activeSection === 'clinics' && (
          <ClinicsSection />
        )}

        {/* SECTION B: DOCTORS DISCOVERY */}
        {activeSection === 'doctors' && (
          <DoctorsSection />
        )}
      </section>

      <HowItWorksSection />
      <ForClinicsSection />
    </div>
    </HomeContext.Provider>
  );
};
export default Home;
