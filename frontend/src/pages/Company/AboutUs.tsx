import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export const AboutUs: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header (Pure Typography, No pill badge) */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1d1d1f]">
            About MediArca
          </h1>
          <p className="text-sm sm:text-base text-[#6e6e73] leading-relaxed">
            A real-time clinic queue management system built to end the frustration of long, unpredictable waits in hospital and clinic waiting rooms.
          </p>
        </div>

        {/* Core Principles */}
        <div className="bg-white rounded-[24px] p-6 sm:p-10 border border-[#e5e5ea] shadow-xs space-y-8">
          <div>
            <h2 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
              What We Do
            </h2>
            <p className="text-sm text-[#48484a] mt-2 leading-relaxed">
              Visiting a doctor should not mean sitting for hours in a crowded waiting area without knowing when you will be called. MediArca connects patients directly with clinic queues in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
            <div className="p-5 rounded-[18px] bg-[#fbfbfd] border border-[#e5e5ea] space-y-2">
              <h3 className="text-sm font-semibold text-[#1d1d1f]">Live Queue Tokens</h3>
              <p className="text-xs text-[#6e6e73] leading-relaxed">
                Receive an official queue number and track your live turn directly from your phone as patients are called.
              </p>
            </div>

            <div className="p-5 rounded-[18px] bg-[#fbfbfd] border border-[#e5e5ea] space-y-2">
              <h3 className="text-sm font-semibold text-[#1d1d1f]">Zero Advance Fees</h3>
              <p className="text-xs text-[#6e6e73] leading-relaxed">
                Booking a token is completely free on MediArca. You pay the doctor's consultation fee directly at the clinic desk.
              </p>
            </div>

            <div className="p-5 rounded-[18px] bg-[#fbfbfd] border border-[#e5e5ea] space-y-2">
              <h3 className="text-sm font-semibold text-[#1d1d1f]">Cabin Presence Status</h3>
              <p className="text-xs text-[#6e6e73] leading-relaxed">
                Know when the doctor is in-cabin or stepped out, so you never wait blindly in an empty lobby.
              </p>
            </div>
          </div>
        </div>

        {/* Who It Helps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white rounded-[24px] p-6 sm:p-8 border border-[#e5e5ea] shadow-xs space-y-2.5">
            <h3 className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">For Patients</h3>
            <p className="text-xs sm:text-sm text-[#6e6e73] leading-relaxed">
              Find verified doctors across specialties, book a token without paying anything upfront, and reach the clinic comfortably when your turn approaches.
            </p>
          </div>

          <div className="bg-white rounded-[24px] p-6 sm:p-8 border border-[#e5e5ea] shadow-xs space-y-2.5">
            <h3 className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">For Clinics & Doctors</h3>
            <p className="text-xs sm:text-sm text-[#6e6e73] leading-relaxed">
              Manage physical walk-ins and digital bookings in a single unified queue. Reduce crowded waiting rooms and keep daily OPD running smoothly.
            </p>
          </div>
        </div>

        {/* Clean Link to Doctors */}
        <div className="text-center pt-2">
          <Link
            to="/doctors"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0066cc] hover:underline"
          >
            Find and consult doctors near you <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};
