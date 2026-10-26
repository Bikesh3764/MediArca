import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export const AboutUs: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8 pb-24 sm:pb-16 pb-safe">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header (Pure Typography, No pill badge) */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1d1d1f]">
            About MediArca
          </h1>
          <p className="text-sm sm:text-base text-[#6e6e73] leading-relaxed">
            Live clinic queues, so you don’t wait for hours.
          </p>
        </div>

        {/* Core Principles */}
        <div className="bg-white rounded-2xl p-6 sm:p-10 border border-[#e5e5ea]  space-y-8">
          <div>
            <h2 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
              What we do
            </h2>
            <p className="text-sm text-[#48484a] mt-2 leading-relaxed">
              Seeing a doctor shouldn’t mean sitting in a crowded room without knowing when you’ll be called. MediArca shows you the clinic’s queue live.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
            <div className="p-5 rounded-2xl bg-[#fbfbfd] border border-[#e5e5ea] space-y-2">
              <h3 className="text-sm font-semibold text-[#1d1d1f]">Live tokens</h3>
              <p className="text-xs text-[#6e6e73] leading-relaxed">
                Get a token number and follow your turn on your phone.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#fbfbfd] border border-[#e5e5ea] space-y-2">
              <h3 className="text-sm font-semibold text-[#1d1d1f]">No booking fee</h3>
              <p className="text-xs text-[#6e6e73] leading-relaxed">
                You only pay the doctor’s fee to the clinic.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#fbfbfd] border border-[#e5e5ea] space-y-2">
              <h3 className="text-sm font-semibold text-[#1d1d1f]">Doctor status</h3>
              <p className="text-xs text-[#6e6e73] leading-relaxed">
                See if the doctor is in or has stepped out.
              </p>
            </div>
          </div>
        </div>

        {/* Who It Helps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#e5e5ea]  space-y-2.5">
            <h3 className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">For patients</h3>
            <p className="text-xs sm:text-sm text-[#6e6e73] leading-relaxed">
              Find verified doctors, book a token and reach the clinic when your turn is close.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#e5e5ea]  space-y-2.5">
            <h3 className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">For clinics and doctors</h3>
            <p className="text-xs sm:text-sm text-[#6e6e73] leading-relaxed">
              Walk-ins and online bookings in one queue. Fewer crowds, smoother OPD.
            </p>
          </div>
        </div>

        {/* Clean Link to Doctors */}
        <div className="text-center pt-2">
          <Link
            to="/doctors"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all"
          >
            Find Doctors <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};
