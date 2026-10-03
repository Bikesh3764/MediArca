import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ShieldCheck, Ticket, Users, ArrowRight } from 'lucide-react';
import { AppleButton } from '../../components/ui/AppleButton';

export const AboutUs: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full border border-[#0066cc]/20">
            About MediArca
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1d1d1f]">
            Making Clinic Visits Simple and Transparent
          </h1>
          <p className="text-sm sm:text-base text-[#6e6e73] leading-relaxed">
            MediArca is a real-time clinic queue management system built to end the frustration of long, unpredictable waits in hospital and clinic waiting rooms.
          </p>
        </div>

        {/* Core Principles */}
        <div className="bg-white rounded-[24px] p-6 sm:p-10 border border-[#e5e5ea] shadow-xs space-y-8">
          <div>
            <h2 className="text-xl font-bold text-[#1d1d1f] tracking-tight">
              What We Do
            </h2>
            <p className="text-sm text-[#48484a] mt-2 leading-relaxed">
              Visiting a doctor should not mean sitting for hours in a crowded waiting area without knowing when you will be called. MediArca connects patients directly with clinic queues in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
            <div className="p-5 rounded-[18px] bg-[#f5f5f7] border border-[#e5e5ea] space-y-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#0066cc] flex items-center justify-center">
                <Ticket className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">Live Queue Tokens</h3>
              <p className="text-xs text-[#6e6e73] leading-relaxed">
                Receive an official queue number and track your live turn directly from your phone as patients are called.
              </p>
            </div>

            <div className="p-5 rounded-[18px] bg-[#f5f5f7] border border-[#e5e5ea] space-y-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">Zero Advance Fees</h3>
              <p className="text-xs text-[#6e6e73] leading-relaxed">
                Booking a token is completely free on MediArca. You pay the doctor's consultation fee directly at the clinic desk.
              </p>
            </div>

            <div className="p-5 rounded-[18px] bg-[#f5f5f7] border border-[#e5e5ea] space-y-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">Cabin Presence Status</h3>
              <p className="text-xs text-[#6e6e73] leading-relaxed">
                Know when the doctor is in-cabin or stepped out, so you never wait blindly in an empty lobby.
              </p>
            </div>
          </div>
        </div>

        {/* Who It Helps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white rounded-[22px] p-6 sm:p-8 border border-[#e5e5ea] shadow-xs space-y-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0066cc] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[#1d1d1f]">For Patients</h3>
            <p className="text-xs sm:text-sm text-[#6e6e73] leading-relaxed">
              Find verified doctors across specialties, book a token without paying anything upfront, and reach the clinic comfortably when your turn approaches.
            </p>
          </div>

          <div className="bg-white rounded-[22px] p-6 sm:p-8 border border-[#e5e5ea] shadow-xs space-y-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[#1d1d1f]">For Clinics & Doctors</h3>
            <p className="text-xs sm:text-sm text-[#6e6e73] leading-relaxed">
              Manage physical walk-ins and digital bookings in a single unified queue. Reduce crowded waiting rooms and keep daily OPD running smoothly.
            </p>
          </div>
        </div>

        {/* Simple CTA */}
        <div className="bg-white rounded-[22px] p-8 border border-[#e5e5ea] text-center space-y-4">
          <h2 className="text-xl font-bold text-[#1d1d1f]">
            Looking for a doctor?
          </h2>
          <p className="text-xs sm:text-sm text-[#6e6e73] max-w-md mx-auto">
            Browse verified specialists and check their practice schedules.
          </p>
          <div>
            <Link to="/doctors">
              <AppleButton variant="primary" size="md">
                Find Doctors
              </AppleButton>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
