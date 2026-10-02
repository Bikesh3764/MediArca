import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Phone,
  Users,
  Activity,
  QrCode,
  RefreshCw,
  Building2,
  Check,
  Zap,
} from 'lucide-react';

export const AppleShowcase: React.FC = () => {
  const navigate = useNavigate();

  // Interactive Showcase State
  const [activeTab, setActiveTab] = useState<'overview' | 'queue' | 'specialists' | 'wallet'>('overview');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [isFlipped, setIsFlipped] = useState(false);
  const [activeSimNumber, setActiveSimNumber] = useState(3);
  const [servingNumber, setServingNumber] = useState(1);
  const [deskConfirmed, setDeskConfirmed] = useState(true);
  const [selectedClinicIndex, setSelectedClinicIndex] = useState(0);

  // Live timer simulation for ultra-realistic Apple experience
  const [secondsRemaining, setSecondsRemaining] = useState(380);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 10 ? prev - 1 : 420));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const specialties = [
    'All',
    'Cardiology',
    'Neurology',
    'Pediatrics',
    'Orthopedics',
    'Dermatology',
    'General Medicine',
  ];

  const showcaseClinics = [
    {
      name: 'Apex Health Institute & Diagnostic',
      address: 'Suite 402, Ring Road, Civil Lines',
      city: 'Ranchi, Jharkhand',
      fee: 400,
      receptionists: [
        { name: 'Pooja Verma', phone: '+91 98765 43210' },
        { name: 'Rohan Sharma', phone: '+91 98765 43211' },
      ],
    },
    {
      name: 'City Care Specialist Polyclinic',
      address: '12th Cross, Medical Square, MG Road',
      city: 'Rourkela, Odisha',
      fee: 350,
      receptionists: [
        { name: 'Sanjay Behera', phone: '+91 91234 56789' },
      ],
    },
  ];

  const showcaseDoctors = [
    {
      id: 'doc-1',
      name: 'Dr. Sarah Jenkins',
      qualifications: 'MD, DM (Cardiology), FACC',
      specialty: 'Cardiology',
      experience: '16 Years Experience',
      rating: 4.96,
      reviews: 312,
      fee: 400,
      image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80',
      shifts: [
        { time: '09:00 AM - 12:00 PM', capacity: '24 Patients', status: 'In Progress' },
        { time: '05:00 PM - 08:00 PM', capacity: '30 Patients', status: 'Available' },
      ],
    },
    {
      id: 'doc-2',
      name: 'Dr. Vikramaditya Roy',
      qualifications: 'MS, M.Ch (Neuro), AIIMS New Delhi',
      specialty: 'Neurology',
      experience: '19 Years Experience',
      rating: 4.98,
      reviews: 480,
      fee: 500,
      image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80',
      shifts: [
        { time: '10:00 AM - 01:30 PM', capacity: '20 Patients', status: 'Available' },
        { time: '04:30 PM - 07:30 PM', capacity: '25 Patients', status: 'Available' },
      ],
    },
    {
      id: 'doc-3',
      name: 'Dr. Ananya Deshmukh',
      qualifications: 'MD (Pediatrics), DCH, London',
      specialty: 'Pediatrics',
      experience: '12 Years Experience',
      rating: 4.92,
      reviews: 219,
      fee: 350,
      image: 'https://images.unsplash.com/photo-1594824813629-a1b72e9a59d9?auto=format&fit=crop&w=600&q=80',
      shifts: [
        { time: '08:30 AM - 11:30 AM', capacity: '25 Patients', status: 'Available' },
        { time: '06:00 PM - 09:00 PM', capacity: '25 Patients', status: 'Available' },
      ],
    },
  ];

  const filteredDoctors = selectedSpecialty === 'All'
    ? showcaseDoctors
    : showcaseDoctors.filter((d) => d.specialty === selectedSpecialty);

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f] font-sans antialiased selection:bg-[#0066cc]/15 selection:text-[#0066cc]">
      
      {/* =========================================================================
          1. GLOBAL NAV: Surface Black (#000000), 44px height, SF Pro 12px
          ========================================================================= */}
      <header className="sticky top-0 z-50 bg-[#000000] text-[#ffffff] h-[44px] flex items-center px-4 sm:px-8 border-b border-white/10 select-none">
        <div className="max-w-[1024px] mx-auto w-full flex items-center justify-between text-[12px] font-normal tracking-[-0.01em]">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-white tracking-tight flex items-center gap-1.5 cursor-pointer" onClick={() => navigate('/')}>
              <span className="text-base leading-none"></span>
              <span className="text-[13px] font-medium tracking-tight">MediArca</span>
            </span>
            <nav className="hidden md:flex items-center gap-6 text-[#d2d2d7]">
              <a href="#hero" className="hover:text-white transition-colors">Overview</a>
              <a href="#queue-engine" className="hover:text-white transition-colors">Atomic Queue</a>
              <a href="#specialists" className="hover:text-white transition-colors">Specialists</a>
              <a href="#wallet-pass" className="hover:text-white transition-colors">Live Pass</a>
              <a href="#reception-desk" className="hover:text-white transition-colors">Desk Network</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-[#d2d2d7] hover:text-white transition-colors text-[11px] font-medium"
            >
              Exit Demo
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-3 py-1 rounded-[8px] bg-[#1d1d1f] text-white hover:bg-[#2d2d2f] text-[12px] font-medium transition-all active:scale-95 border border-white/15"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. SUB-NAV FROSTED: 52px height, #f5f5f7 at 80% with backdrop-filter blur
          ========================================================================= */}
      <div className="sticky top-[44px] z-40 bg-[#f5f5f7]/85 backdrop-blur-xl border-b border-[#e5e5ea] h-[52px] flex items-center px-4 sm:px-8 transition-all">
        <div className="max-w-[1024px] mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[21px] font-semibold text-[#1d1d1f] tracking-tight">
              MediArca Pro
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] uppercase tracking-wider">
              Apple HIG Edition
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-4 text-[14px] text-[#86868b]">
              <button
                onClick={() => setActiveTab('overview')}
                className={`transition-colors cursor-pointer ${activeTab === 'overview' ? 'text-[#1d1d1f] font-semibold' : 'hover:text-[#1d1d1f]'}`}
              >
                Experience
              </button>
              <button
                onClick={() => setActiveTab('queue')}
                className={`transition-colors cursor-pointer ${activeTab === 'queue' ? 'text-[#1d1d1f] font-semibold' : 'hover:text-[#1d1d1f]'}`}
              >
                Queue Engine
              </button>
              <button
                onClick={() => setActiveTab('specialists')}
                className={`transition-colors cursor-pointer ${activeTab === 'specialists' ? 'text-[#1d1d1f] font-semibold' : 'hover:text-[#1d1d1f]'}`}
              >
                Doctors
              </button>
            </div>
            <a
              href="#wallet-pass"
              className="px-4 py-1.5 rounded-full bg-[#0066cc] text-white hover:bg-[#0071e3] text-[14px] font-normal transition-all active:scale-95 shadow-sm inline-flex items-center gap-1.5"
            >
              <span>Get Queue Pass</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. HERO PRODUCT TILE (Light Canvas #ffffff)
          ========================================================================= */}
      <section id="hero" className="w-full bg-[#ffffff] pt-16 pb-20 px-4 sm:px-8 border-b border-[#f0f0f0]">
        <div className="max-w-[980px] mx-auto text-center">
          <span className="text-[17px] font-semibold text-[#0066cc] tracking-tight block mb-2">
            Clinical Care Reimagined
          </span>
          <h2 className="text-[44px] sm:text-[56px] font-semibold text-[#1d1d1f] tracking-[-0.03em] leading-[1.07] max-w-[820px] mx-auto mb-4">
            The Wait Is Over. Literally.
          </h2>
          <p className="text-[21px] sm:text-[24px] font-light text-[#86868b] tracking-normal leading-[1.4] max-w-[680px] mx-auto mb-8">
            Real-time atomic queue allocation with zero waiting room guesswork. Book from your phone, arrive when called.
          </p>

          {/* Dual Apple Pill CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 mb-16">
            <a
              href="#specialists"
              className="px-6 py-2.5 rounded-full bg-[#0066cc] text-white hover:bg-[#0071e3] text-[17px] font-normal transition-all active:scale-95 shadow-sm"
            >
              Find a Specialist
            </a>
            <a
              href="#wallet-pass"
              className="px-6 py-2.5 rounded-full bg-white text-[#0066cc] border border-[#0066cc] hover:bg-[#0066cc]/5 text-[17px] font-normal transition-all active:scale-95"
            >
              Simulate Live Pass
            </a>
          </div>

          {/* Product Centerpiece resting on surface with Apple drop shadow */}
          <div className="relative max-w-[820px] mx-auto">
            <div
              className="p-6 sm:p-8 rounded-[28px] bg-white border border-[#e5e5ea] text-left transition-all"
              style={{
                boxShadow: 'rgba(0, 0, 0, 0.16) 0px 20px 48px -12px, rgba(0, 0, 0, 0.08) 0px 4px 16px 0px',
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#f0f0f0] gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img
                      src={showcaseDoctors[0].image}
                      alt={showcaseDoctors[0].name}
                      className="w-16 h-16 rounded-[18px] object-cover border border-[#e5e5ea]"
                    />
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                      <Check className="w-3 h-3 text-white stroke-[3]" />
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">
                        {showcaseDoctors[0].name}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                        IN CABIN
                      </span>
                    </div>
                    <p className="text-[14px] text-[#86868b] mt-0.5">
                      {showcaseDoctors[0].qualifications} • {showcaseDoctors[0].specialty}
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b] block">
                    Consultation Shift
                  </span>
                  <span className="text-[17px] font-semibold text-[#1d1d1f] block">
                    09:00 AM – 12:00 PM
                  </span>
                  <span className="text-[13px] text-emerald-600 font-medium">
                    Shift Active • Normal Pace
                  </span>
                </div>
              </div>

              {/* Dynamic Queue Metrics Band */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-b border-[#f0f0f0]">
                <div className="p-3.5 rounded-[16px] bg-[#f5f5f7]">
                  <span className="text-[11px] text-[#86868b] font-medium uppercase tracking-wider block">
                    Currently Serving
                  </span>
                  <strong className="text-[28px] font-semibold text-[#1d1d1f] block mt-1 tracking-tight">
                    #{servingNumber}
                  </strong>
                  <span className="text-[11px] text-emerald-600 font-medium">Consulting Now</span>
                </div>

                <div className="p-3.5 rounded-[16px] bg-[#0066cc]/5 border border-[#0066cc]/15">
                  <span className="text-[11px] text-[#0066cc] font-medium uppercase tracking-wider block">
                    Your Queue Token
                  </span>
                  <strong className="text-[28px] font-semibold text-[#0066cc] block mt-1 tracking-tight">
                    #{activeSimNumber}
                  </strong>
                  <span className="text-[11px] text-[#0066cc] font-medium">
                    {activeSimNumber - servingNumber === 0 ? 'Your Turn Next' : `${activeSimNumber - servingNumber} patients ahead`}
                  </span>
                </div>

                <div className="p-3.5 rounded-[16px] bg-[#f5f5f7]">
                  <span className="text-[11px] text-[#86868b] font-medium uppercase tracking-wider block">
                    Est. Call Time
                  </span>
                  <strong className="text-[28px] font-semibold text-[#1d1d1f] block mt-1 tracking-tight">
                    09:34 AM
                  </strong>
                  <span className="text-[11px] text-[#86868b] font-medium">In ~{formatTime(secondsRemaining)}</span>
                </div>

                <div className="p-3.5 rounded-[16px] bg-[#f5f5f7]">
                  <span className="text-[11px] text-[#86868b] font-medium uppercase tracking-wider block">
                    Desk Clearance
                  </span>
                  <strong className="text-[28px] font-semibold text-emerald-600 block mt-1 tracking-tight">
                    Confirmed
                  </strong>
                  <span className="text-[11px] text-[#86868b] font-medium">Paid at Reception</span>
                </div>
              </div>

              {/* Interactive Simulation Controls */}
              <div className="pt-5 flex flex-wrap items-center justify-between gap-3 text-[13px]">
                <div className="flex items-center gap-2 text-[#86868b]">
                  <Activity className="w-4 h-4 text-[#0066cc] animate-pulse" />
                  <span>Real-time WebSocket telemetry syncing at 60 FPS</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setServingNumber((prev) => (prev < activeSimNumber ? prev + 1 : 1));
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f] font-medium text-[12px] transition-all active:scale-95 border border-[#e5e5ea] flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#0066cc]" />
                    <span>Advance Queue</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveSimNumber((prev) => prev + 1);
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-[#0066cc] text-white hover:bg-[#0071e3] font-medium text-[12px] transition-all active:scale-95"
                  >
                    Add My Token
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. ALTERNATING DARK PRODUCT TILE (#272729)
          ========================================================================= */}
      <section id="queue-engine" className="w-full bg-[#272729] text-white py-24 px-4 sm:px-8 border-b border-black">
        <div className="max-w-[1024px] mx-auto text-center">
          <span className="text-[17px] font-semibold text-[#2997ff] tracking-tight block mb-2">
            The Atomic Queue Engine
          </span>
          <h2 className="text-[40px] sm:text-[48px] font-semibold text-white tracking-[-0.03em] leading-[1.1] max-w-[780px] mx-auto mb-4">
            Engineered Down to the Exact Second.
          </h2>
          <p className="text-[21px] font-light text-[#cccccc] leading-[1.4] max-w-[640px] mx-auto mb-16">
            A deterministic algorithm that calculates dynamic drift, walk-in arrivals, and clinical consultation velocity in real time.
          </p>

          {/* 3 Dark Architectural Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-8 rounded-[24px] bg-[#2a2a2c] border border-white/10 hover:border-white/20 transition-all">
              <div className="w-12 h-12 rounded-[14px] bg-[#0066cc]/20 text-[#2997ff] flex items-center justify-center mb-6">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-[21px] font-semibold text-white mb-2 tracking-tight">
                Micro-Window Timing
              </h3>
              <p className="text-[15px] font-light text-[#cccccc] leading-relaxed">
                Duration divided by doctor capacity creates an adaptive consultation cadence. If a case takes longer, all subsequent estimated arrival times auto-recalculate instantly.
              </p>
            </div>

            <div className="p-8 rounded-[24px] bg-[#2a2a2c] border border-white/10 hover:border-white/20 transition-all">
              <div className="w-12 h-12 rounded-[14px] bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-[21px] font-semibold text-white mb-2 tracking-tight">
                Desk Confirmation Lock
              </h3>
              <p className="text-[15px] font-light text-[#cccccc] leading-relaxed">
                Queue tokens stay in verified holding until confirmed by the physical clinic receptionist upon consultation fee receipt. Zero ghost bookings or phantom patients.
              </p>
            </div>

            <div className="p-8 rounded-[24px] bg-[#2a2a2c] border border-white/10 hover:border-white/20 transition-all">
              <div className="w-12 h-12 rounded-[14px] bg-purple-500/20 text-purple-400 flex items-center justify-center mb-6">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-[21px] font-semibold text-white mb-2 tracking-tight">
                Multi-Clinic Isolation
              </h3>
              <p className="text-[15px] font-light text-[#cccccc] leading-relaxed">
                Doctors practicing across multiple facilities retain strictly separated shifts, fees, and assigned desk staff per location. Each clinic maintains autonomous operations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. SPECIALIST CATALOG & CONFIGURATOR (Parchment Canvas #f5f5f7)
          ========================================================================= */}
      <section id="specialists" className="w-full bg-[#f5f5f7] py-20 px-4 sm:px-8 border-b border-[#e5e5ea]">
        <div className="max-w-[1024px] mx-auto">
          <div className="text-center max-w-[720px] mx-auto mb-10">
            <span className="text-[17px] font-semibold text-[#0066cc] tracking-tight block mb-1">
              Practitioner Directory
            </span>
            <h2 className="text-[36px] sm:text-[44px] font-semibold text-[#1d1d1f] tracking-[-0.03em] leading-tight mb-3">
              Explore Board-Certified Specialists.
            </h2>
            <p className="text-[17px] text-[#86868b] leading-relaxed">
              Transparent consultation fees, verified qualifications, and instant live queue booking.
            </p>
          </div>

          {/* Configurator Option Chips (Apple Pill Selector) */}
          <div className="flex items-center justify-center flex-wrap gap-2 mb-10">
            {specialties.map((spec) => (
              <button
                key={spec}
                onClick={() => setSelectedSpecialty(spec)}
                className={`px-4 py-2 rounded-full text-[14px] transition-all cursor-pointer ${
                  selectedSpecialty === spec
                    ? 'bg-[#0066cc] text-white shadow-xs'
                    : 'bg-white text-[#1d1d1f] border border-[#e0e0e0] hover:border-[#1d1d1f]'
                }`}
              >
                {spec}
              </button>
            ))}
          </div>

          {/* Store Utility Card Grid (18px radius, hairline border, 24px padding) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredDoctors.map((doc) => (
              <div
                key={doc.id}
                className="rounded-[18px] bg-white border border-[#e0e0e0] p-6 flex flex-col justify-between transition-all hover:border-[#b0b0b8]"
              >
                <div>
                  <div className="relative mb-5">
                    <img
                      src={doc.image}
                      alt={doc.name}
                      className="w-full h-48 rounded-[12px] object-cover"
                    />
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md border border-black/5 text-[12px] font-semibold text-[#1d1d1f] shadow-xs flex items-center gap-1">
                      <span>★</span>
                      <span>{doc.rating}</span>
                      <span className="text-[#86868b]">({doc.reviews})</span>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0066cc] block">
                    {doc.specialty}
                  </span>
                  <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight mt-1">
                    {doc.name}
                  </h3>
                  <p className="text-[13px] text-[#86868b] mt-0.5 line-clamp-1">
                    {doc.qualifications}
                  </p>

                  <div className="mt-4 pt-4 border-t border-[#f0f0f0] space-y-2">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#86868b]">Practice Experience</span>
                      <span className="font-medium text-[#1d1d1f]">{doc.experience}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#86868b]">Consultation Fee</span>
                      <span className="font-semibold text-emerald-700">₹{doc.fee}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#f0f0f0] flex items-center justify-between gap-3">
                  <div className="text-[11px] text-[#86868b]">
                    <span className="block font-medium text-[#1d1d1f]">Next Shift Available</span>
                    <span>09:00 AM Today</span>
                  </div>
                  <a
                    href="#wallet-pass"
                    className="px-4 py-2 rounded-full bg-[#0066cc] text-white hover:bg-[#0071e3] text-[13px] font-medium transition-all active:scale-95"
                  >
                    Select Shift
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. APPLE WALLET PASS INTERACTIVE SIMULATOR (Dark Tile 2 #2a2a2c)
          ========================================================================= */}
      <section id="wallet-pass" className="w-full bg-[#2a2a2c] text-white py-24 px-4 sm:px-8 border-b border-black">
        <div className="max-w-[980px] mx-auto text-center">
          <span className="text-[17px] font-semibold text-[#2997ff] tracking-tight block mb-2">
            Apple Wallet Live Pass
          </span>
          <h2 className="text-[40px] sm:text-[48px] font-semibold text-white tracking-[-0.03em] leading-[1.1] max-w-[780px] mx-auto mb-4">
            Your Medical Queue Ticket. On Glass.
          </h2>
          <p className="text-[20px] font-light text-[#cccccc] leading-[1.4] max-w-[620px] mx-auto mb-12">
            Dynamic updates right on your lock screen. Shows live counter, estimated start window, and receptionist verification seal.
          </p>

          {/* Interactive Flip Card Pass Container */}
          <div className="max-w-[420px] mx-auto text-left">
            <div
              className="rounded-[28px] p-6 text-white transition-all cursor-pointer select-none relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #0284c7 60%, #0369a1 100%)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.15) inset',
              }}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/20">
                <div className="flex items-center gap-2">
                  <span className="text-xl"></span>
                  <span className="text-sm font-semibold tracking-tight">MediArca Health Pass</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold tracking-wider uppercase backdrop-blur-md">
                  LIVE PASS
                </span>
              </div>

              {/* Pass Body */}
              {!isFlipped ? (
                <div className="pt-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-white/70 uppercase tracking-wider block">
                        Assigned Specialist
                      </span>
                      <strong className="text-[20px] font-semibold block tracking-tight text-white mt-0.5">
                        Dr. Sarah Jenkins
                      </strong>
                      <span className="text-[13px] text-white/80">Cardiology • Apex Diagnostics</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-white/70 uppercase tracking-wider block">
                        Queue Token
                      </span>
                      <strong className="text-[38px] font-bold block tracking-tight text-white leading-none mt-0.5">
                        #03
                      </strong>
                    </div>
                  </div>

                  <div className="p-4 rounded-[18px] bg-black/25 backdrop-blur-md border border-white/10 grid grid-cols-2 gap-3 text-center">
                    <div>
                      <span className="text-[10px] text-white/70 uppercase tracking-wider block">
                        Currently Serving
                      </span>
                      <span className="text-[22px] font-bold text-white block mt-0.5">
                        #{servingNumber}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-white/70 uppercase tracking-wider block">
                        Est. Consultation
                      </span>
                      <span className="text-[22px] font-bold text-emerald-300 block mt-0.5">
                        09:34 AM
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 text-[12px] text-white/90">
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>{deskConfirmed ? 'Fee Paid at Reception (₹400)' : 'Pending Desk Payment'}</span>
                    </div>
                    <span className="text-[11px] text-white/60">Tap to flip ↺</span>
                  </div>
                </div>
              ) : (
                <div className="pt-6 space-y-6 text-center">
                  <div className="p-4 bg-white rounded-[20px] inline-block shadow-sm">
                    <QrCode className="w-32 h-32 text-black mx-auto" />
                  </div>
                  <div>
                    <span className="text-[11px] text-white/70 uppercase tracking-wider block">
                      Digital Security Code
                    </span>
                    <strong className="text-[18px] font-mono tracking-widest text-white mt-1 block">
                      MED-9021-SEC
                    </strong>
                    <p className="text-[12px] text-white/75 mt-2">
                      Scan at clinic front desk kiosk to mark arrival and unlock priority cabin calling.
                    </p>
                  </div>
                  <span className="text-[11px] text-white/60 block">Tap to view front ↺</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col items-center gap-2 text-center">
              <span className="text-[13px] text-[#cccccc]">
                Click pass to toggle between live queue telemetry and QR check-in barcode.
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeskConfirmed(!deskConfirmed);
                }}
                className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-[12px] font-medium transition-all active:scale-95 border border-white/20 cursor-pointer"
              >
                {deskConfirmed ? 'Simulate Unpaid Desk Status' : 'Simulate Paid Desk Confirmation'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. RECEPTIONIST DESK & CONFIRMATION CARD (Pure White #ffffff Canvas)
          ========================================================================= */}
      <section id="reception-desk" className="w-full bg-[#ffffff] py-20 px-4 sm:px-8 border-b border-[#f0f0f0]">
        <div className="max-w-[820px] mx-auto">
          <div className="text-center mb-10">
            <span className="text-[17px] font-semibold text-[#0066cc] tracking-tight block mb-1">
              Physical Coordination
            </span>
            <h2 className="text-[36px] sm:text-[42px] font-semibold text-[#1d1d1f] tracking-[-0.03em] leading-tight mb-2">
              Pay Receptionist to Confirm Queue Spot
            </h2>
            <p className="text-[17px] text-[#86868b]">
              Transparent consultation fee policy. Your token is locked upon paying directly at the clinic desk.
            </p>
          </div>

          {/* Interactive Clinic Venue Switcher */}
          <div className="p-6 rounded-[24px] bg-[#f5f5f7] border border-[#e5e5ea] space-y-6">
            <div>
              <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider block mb-3">
                Select Consultation Facility
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {showcaseClinics.map((clinic, idx) => (
                  <button
                    key={clinic.name}
                    onClick={() => setSelectedClinicIndex(idx)}
                    className={`p-4 rounded-[18px] text-left transition-all cursor-pointer ${
                      selectedClinicIndex === idx
                        ? 'bg-white border-2 border-[#0066cc] shadow-xs'
                        : 'bg-white/60 border border-[#e5e5ea] hover:bg-white'
                    }`}
                  >
                    <span className="text-[14px] font-semibold text-[#1d1d1f] block">
                      {clinic.name}
                    </span>
                    <span className="text-[12px] text-[#86868b] block mt-0.5">
                      {clinic.city}
                    </span>
                    <span className="inline-block mt-3 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                      ₹{clinic.fee} Consultation Fee
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Attached Receptionist Roster */}
            <div className="pt-4 border-t border-[#e5e5ea]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#0066cc]" />
                  Attached Front Desk Staff ({showcaseClinics[selectedClinicIndex].receptionists.length})
                </span>
                <span className="text-[12px] text-emerald-600 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  Active on Duty
                </span>
              </div>

              <div className="space-y-2.5">
                {showcaseClinics[selectedClinicIndex].receptionists.map((rec) => (
                  <div
                    key={rec.phone}
                    className="p-3.5 rounded-[16px] bg-white border border-[#e5e5ea] flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#0066cc]/10 text-[#0066cc] font-semibold flex items-center justify-center text-sm">
                        {rec.name[0]}
                      </div>
                      <div>
                        <strong className="text-[14px] font-semibold text-[#1d1d1f] block">
                          {rec.name}
                        </strong>
                        <span className="text-[12px] text-[#86868b]">
                          {showcaseClinics[selectedClinicIndex].name} • Desk Coordinator
                        </span>
                      </div>
                    </div>

                    <a
                      href={`tel:${rec.phone}`}
                      className="px-4 py-2 rounded-full bg-[#f5f5f7] hover:bg-[#0066cc] hover:text-white text-[#0066cc] text-[13px] font-medium transition-all active:scale-95 border border-[#e5e5ea] flex items-center gap-1.5 shadow-2xs"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call {rec.phone}</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. APPLE MUSEUM-GRADE FOOTER (Parchment Canvas #f5f5f7)
          ========================================================================= */}
      <footer className="w-full bg-[#f5f5f7] text-[#333333] pt-16 pb-12 px-4 sm:px-8 border-t border-[#e5e5ea]">
        <div className="max-w-[1024px] mx-auto">
          {/* Dense Link Columns with relaxed 2.41 line-height */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 pb-12 border-b border-[#e5e5ea] text-[14px]">
            <div>
              <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[#1d1d1f] mb-3">
                Clinical Portals
              </h4>
              <ul className="space-y-2 text-[#7a7a7a]">
                <li><button onClick={() => navigate('/patient/login')} className="hover:text-[#1d1d1f] transition-colors">Patient Live Queue</button></li>
                <li><button onClick={() => navigate('/doctor/login')} className="hover:text-[#1d1d1f] transition-colors">Doctor Consultation Console</button></li>
                <li><button onClick={() => navigate('/clinic/login')} className="hover:text-[#1d1d1f] transition-colors">Clinic Administration</button></li>
                <li><button onClick={() => navigate('/receptionist/login')} className="hover:text-[#1d1d1f] transition-colors">Front Desk Desk Roster</button></li>
              </ul>
            </div>

            <div>
              <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[#1d1d1f] mb-3">
                Architecture
              </h4>
              <ul className="space-y-2 text-[#7a7a7a]">
                <li><span className="hover:text-[#1d1d1f] transition-colors">Atomic Queue Engine</span></li>
                <li><span className="hover:text-[#1d1d1f] transition-colors">Real-time Telemetry</span></li>
                <li><span className="hover:text-[#1d1d1f] transition-colors">Supabase Cloud PostgreSQL</span></li>
                <li><span className="hover:text-[#1d1d1f] transition-colors">Render Edge Service</span></li>
              </ul>
            </div>

            <div>
              <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[#1d1d1f] mb-3">
                Design Standard
              </h4>
              <ul className="space-y-2 text-[#7a7a7a]">
                <li><span className="hover:text-[#1d1d1f] transition-colors">Apple Human Interface</span></li>
                <li><span className="hover:text-[#1d1d1f] transition-colors">SF Pro Typography</span></li>
                <li><span className="hover:text-[#1d1d1f] transition-colors">Zero Upfront Paywall</span></li>
                <li><span className="hover:text-[#1d1d1f] transition-colors">Full-Pill Action Grammar</span></li>
              </ul>
            </div>

            <div>
              <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[#1d1d1f] mb-3">
                About MediArca
              </h4>
              <ul className="space-y-2 text-[#7a7a7a]">
                <li><button onClick={() => navigate('/')} className="hover:text-[#1d1d1f] transition-colors">Main Application</button></li>
                <li><span className="hover:text-[#1d1d1f] transition-colors">Privacy & Data Security</span></li>
                <li><span className="hover:text-[#1d1d1f] transition-colors">Terms of Clinical Service</span></li>
                <li><span className="hover:text-[#1d1d1f] transition-colors">Help & Desk Inquiries</span></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#7a7a7a] gap-3">
            <p>© 2026 MediArca Health Technologies Inc. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <span>Privacy Policy</span>
              <span>Terms of Use</span>
              <span>Sales Policy</span>
              <span>Legal</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
