import React from 'react';
import healthcareHeroBg from '../assets/healthcare-hero-bg.webp';
import { Search, MapPin, X } from 'lucide-react';
import { useHomeState, HomeContext } from './home/state';
import { ClinicsGridSection } from './home/ClinicsGridSection';
import { DoctorsIntroSection } from './home/DoctorsIntroSection';
import { ClinicsSection } from './home/ClinicsSection';
import { DoctorsSection } from './home/DoctorsSection';
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
  } = state;
  return (
    <HomeContext.Provider value={state}>
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
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold text-[#1d1d1f] tracking-tight leading-[1.08] max-w-3xl mx-auto">
            Book doctor queue tokens. <span className="text-[#0066cc]">Skip the waiting room.</span>
          </h1>

          {/* Unified Apple Dual Search Bar (Two Searches in One Bar) */}
          <div className="mt-8 sm:mt-10 max-w-2xl mx-auto backdrop-blur-md bg-white/95 p-2 sm:p-2.5 rounded-2xl sm:rounded-full border border-black/[0.1]  flex flex-col sm:flex-row items-center gap-2">
            <div className="flex items-center gap-2.5 flex-1 w-full px-3.5 py-1">
              <Search className="w-4 h-4 text-[#86868b] shrink-0" />
              <input
                type="text"
                value={heroSearchQuery}
                onChange={(e) => setHeroSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleHeroSearch()}
                placeholder="Search doctor, clinic or specialty..."
                className="w-full bg-transparent text-base sm:text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
              />
              {heroSearchQuery && (
                <button aria-label="Close"
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

            <div className="flex items-center gap-2.5 w-full sm:w-52 px-3.5 py-1">
              <MapPin className="w-4 h-4 text-[#86868b] shrink-0" />
              <input
                type="text"
                value={heroLocationQuery}
                onChange={(e) => setHeroLocationQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleHeroSearch()}
                placeholder="City or location..."
                className="w-full bg-transparent text-base sm:text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none"
              />
              {heroLocationQuery && (
                <button aria-label="Close"
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
              className="w-full sm:w-auto h-11 sm:h-10 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-sm font-normal transition-all duration-150 active:scale-[0.97] inline-flex items-center justify-center gap-2 cursor-pointer select-none shrink-0 "
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
    </div>
    </HomeContext.Provider>
  );
};
export default Home;
