import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Clock, Users, Award, HeartPulse, CheckCircle2, ArrowRight } from 'lucide-react';
import { AppleButton } from '../../components/ui/AppleButton';

export const AboutUs: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full border border-[#0066cc]/20">
            About MediArca
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#1d1d1f]">
            Reimagining Outpatient Care with Zero Waiting Guesswork
          </h1>
          <p className="text-sm sm:text-base text-[#86868b] leading-relaxed">
            MediArca was founded with a singular conviction: seeking clinical care should never mean hours of anxious waiting in crowded hospital lobbies. We provide India's first real-time, atomic outpatient queue infrastructure.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Specialists', value: '500+' },
            { label: 'Verified Clinics', value: '120+' },
            { label: 'Average Wait Saved', value: '45 mins' },
            { label: 'Patient Satisfaction', value: '99.4%' },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="bg-white rounded-[20px] p-6 border border-[#e5e5ea] text-center shadow-2xs"
            >
              <div className="text-2xl sm:text-3xl font-bold text-[#0066cc] tracking-tight">
                {stat.value}
              </div>
              <div className="text-xs text-[#86868b] mt-1 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Our Mission Card */}
        <div className="bg-white rounded-[24px] p-6 sm:p-10 border border-[#e5e5ea] shadow-xs space-y-6">
          <div className="flex items-center gap-3 text-[#0066cc]">
            <HeartPulse className="w-6 h-6" />
            <h2 className="text-xl sm:text-2xl font-bold text-[#1d1d1f] tracking-tight">
              Our Clinical Philosophy
            </h2>
          </div>
          <p className="text-sm text-[#48484a] leading-relaxed">
            In standard outpatient departments across India, patients arrive early morning only to wait indefinitely with no visibility into doctor availability, ongoing emergencies, or actual consultation pace. MediArca solves this through real-time doctor cabin presence, guaranteed token generation, and transparent queue tracking.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-[#f0f0f2]">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center font-bold">
                1
              </div>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">Zero Upfront Paywall</h3>
              <p className="text-xs text-[#86868b] leading-relaxed">
                Healthcare access should be barrier-free. Patients reserve official tokens without paying advance online platform markups. Pay directly at the clinic desk.
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center font-bold">
                2
              </div>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">Live Cabin Precision</h3>
              <p className="text-xs text-[#86868b] leading-relaxed">
                Patients know whether the doctor is actively in-cabin, stepped out, or in an emergency procedure, updated live by front desk personnel.
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center font-bold">
                3
              </div>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">Strict Medical Verification</h3>
              <p className="text-xs text-[#86868b] leading-relaxed">
                Every practitioner and polyclinic on MediArca undergoes administrative document verification before entering public search discovery.
              </p>
            </div>
          </div>
        </div>

        {/* Why MediArca Section */}
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-2xl font-bold text-[#1d1d1f] tracking-tight">
              Built for Patients, Doctors, and Clinical Desks
            </h2>
            <p className="text-xs text-[#86868b] mt-1">
              An interconnected platform delivering clarity to every clinical stakeholder.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-[20px] p-6 border border-[#e5e5ea] shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-[#1d1d1f]">For Patients</h3>
              <ul className="text-xs text-[#6e6e73] space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Real-time digital queue pass in mobile browser</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Live estimated consultation start time</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Zero upfront payment or hidden booking charges</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-[20px] p-6 border border-[#e5e5ea] shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-[#1d1d1f]">For Doctors</h3>
              <ul className="text-xs text-[#6e6e73] space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Streamlined queue console with calling action</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Independent practice shift & capacity controls</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Affiliation management across multiple clinics</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-[20px] p-6 border border-[#e5e5ea] shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-[#1d1d1f]">For Clinics & Desks</h3>
              <ul className="text-xs text-[#6e6e73] space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Rapid walk-in token issuance within seconds</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Desk scoping for assigned practitioner rosters</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Physical QR kiosk self-arrival check-in</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* CTA Banner */}
        <div className="bg-[#1d1d1f] text-white rounded-[24px] p-8 sm:p-12 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Ready to experience frictionless clinical outpatient visits?
          </h2>
          <p className="text-xs sm:text-sm text-[#a1a1a6] max-w-xl mx-auto">
            Explore verified specialists in your city, check live checking shifts, and secure your consultation token without delay.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link to="/doctors">
              <AppleButton variant="primary" size="md">
                Find a Specialist
              </AppleButton>
            </Link>
            <Link to="/contact">
              <AppleButton variant="secondary" size="md">
                Contact Support
              </AppleButton>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
