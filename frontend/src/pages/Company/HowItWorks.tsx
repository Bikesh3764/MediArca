import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Ticket, Smartphone, CheckCircle, Clock, ShieldCheck, Zap, Building2, ArrowRight } from 'lucide-react';
import { AppleButton } from '../../components/ui/AppleButton';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'Find Your Doctor & Facility',
      description:
        'Browse verified specialists across 34+ medical branches in your city. Compare clinic locations, checking shifts, and consultation fees with total transparency.',
      icon: Search,
      badge: 'Step 1: Discovery',
      highlight: 'Filtered by state, city, and verified clinic venues',
    },
    {
      step: '02',
      title: 'Reserve Guaranteed Queue Token',
      description:
        'Select your preferred shift and date. Book for yourself or family members with zero upfront platform charges. Your spot in line is instantly reserved.',
      icon: Ticket,
      badge: 'Step 2: Reservation',
      highlight: 'Zero online paywall • Pay at clinic front desk',
    },
    {
      step: '03',
      title: 'Track Live Queue in Real Time',
      description:
        'Open your digital live queue pass on your smartphone. View the doctor’s live cabin presence, how many patients are ahead, and estimated arrival time down to the minute.',
      icon: Smartphone,
      badge: 'Step 3: Live Queue',
      highlight: 'Dynamic countdown & front desk status updates',
    },
    {
      step: '04',
      title: 'Seamless In-Person Consultation',
      description:
        'Arrive at the clinic when your turn approaches. Check in via front desk or scan the physical QR kiosk, pay the doctor’s fee, and step into the consultation cabin without waiting room chaos.',
      icon: CheckCircle,
      badge: 'Step 4: Care',
      highlight: 'QR self-arrival check-in • Zero lobby anxiety',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-14">
        {/* Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full border border-[#0066cc]/20">
            How MediArca Works
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#1d1d1f]">
            Four Steps to Zero Waiting Room Chaos
          </h1>
          <p className="text-sm sm:text-base text-[#86868b] leading-relaxed">
            From discovering certified specialists to tracking live doctor presence, here is how MediArca organizes outpatient care for India.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-[24px] p-6 sm:p-8 border border-[#e5e5ea] shadow-xs flex flex-col justify-between space-y-5 hover:border-[#0066cc]/30 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-semibold text-[#0066cc] bg-[#0066cc]/10 px-2.5 py-0.5 rounded-full border border-[#0066cc]/20">
                      {item.badge}
                    </span>
                    <span className="font-mono text-2xl font-bold text-[#d2d2d7]">
                      {item.step}
                    </span>
                  </div>

                  <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] text-[#0066cc] flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6" />
                  </div>

                  <h3 className="text-lg font-bold text-[#1d1d1f] tracking-tight mb-2">
                    {item.title}
                  </h3>

                  <p className="text-xs text-[#6e6e73] leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#f0f0f2] flex items-center gap-2 text-xs text-[#0066cc] font-medium">
                  <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{item.highlight}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Key Advantages Grid */}
        <div className="bg-white rounded-[24px] p-6 sm:p-10 border border-[#e5e5ea] shadow-xs space-y-6">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1d1d1f] tracking-tight">
              Why the Atomic Token Model is Better
            </h2>
            <p className="text-xs text-[#86868b] mt-1">
              Traditional time-slot appointments fail when one patient takes longer. Our queue system dynamically recalculates real-time arrival estimates.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
            <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-2">
              <div className="w-8 h-8 rounded-xl bg-blue-100/70 text-[#0066cc] flex items-center justify-center font-bold text-xs">
                <Clock className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-[#1d1d1f]">Dynamic Consultation Pace</h4>
              <p className="text-xs text-[#86868b] leading-relaxed">
                If an appointment takes 15 minutes instead of 5, subsequent patients' live passes immediately update with the adjusted expected start time.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-[#1d1d1f]">Physical Desk Synchronization</h4>
              <p className="text-xs text-[#86868b] leading-relaxed">
                Online bookings and walk-in counter tickets share the exact same authoritative queue index. No line-cutting or phantom reservations.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100/70 text-purple-700 flex items-center justify-center font-bold text-xs">
                <Building2 className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-[#1d1d1f]">Multi-Clinic Practicing</h4>
              <p className="text-xs text-[#86868b] leading-relaxed">
                Doctors practicing across multiple polyclinics have dedicated shift slots and separated queue passes for each physical facility.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-[#1d1d1f] text-white rounded-[24px] p-8 sm:p-12 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Ready to book your consultation pass?
          </h2>
          <p className="text-xs sm:text-sm text-[#a1a1a6] max-w-lg mx-auto">
            Search verified cardiologists, pediatricians, dermatologists, and surgeons practicing near you.
          </p>
          <div className="pt-2">
            <Link to="/doctors">
              <AppleButton variant="primary" size="md">
                Find Doctors Now
              </AppleButton>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
