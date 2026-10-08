import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ShieldCheck, Ticket, Users, ArrowRight } from 'lucide-react';
import { AppleButton } from '../../components/ui/AppleButton';

export const AboutUs: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto w-full space-y-8 sm:space-y-10">
        {/* Page Header */}
        <div className="text-center space-y-2.5 max-w-2xl mx-auto">
          <h1 className="text-page-title sm:text-[32px]">
            About MediArca
          </h1>
          <p className="text-body text-[#6e6e73]">
            A real-time clinic queue management system built to end the frustration of long, unpredictable waits in hospital and clinic waiting rooms.
          </p>
        </div>

        {/* Core Principles */}
        <div className="apple-card p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-section-title">
              What We Do
            </h2>
            <p className="text-body text-[#48484a]">
              Visiting a doctor should not mean sitting for hours in a crowded waiting area without knowing when you will be called. MediArca connects patients directly with clinic queues in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 pt-1">
            <div className="p-5 rounded-[20px] bg-[#fafafc] border border-[#e5e5ea] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center">
                <Ticket className="w-5 h-5" />
              </div>
              <h3 className="text-card-title">Live Queue Tokens</h3>
              <p className="text-secondary">
                Receive an official queue number and track your live turn directly from your phone as patients are called.
              </p>
            </div>

            <div className="p-5 rounded-[20px] bg-[#fafafc] border border-[#e5e5ea] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-card-title">Zero Advance Fees</h3>
              <p className="text-secondary">
                Booking a token is completely free on MediArca. You pay the doctor's consultation fee directly at the clinic desk.
              </p>
            </div>

            <div className="p-5 rounded-[20px] bg-[#fafafc] border border-[#e5e5ea] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-card-title">Cabin Presence Status</h3>
              <p className="text-secondary">
                Know when the doctor is in-cabin or stepped out, so you never wait blindly in an empty lobby.
              </p>
            </div>
          </div>
        </div>

        {/* Who It Helps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="apple-card p-6 sm:p-7 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-section-title">For Patients</h3>
            <p className="text-secondary">
              Find verified doctors across specialties, book a token without paying anything upfront, and reach the clinic comfortably when your turn approaches.
            </p>
          </div>

          <div className="apple-card p-6 sm:p-7 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-section-title">For Clinics & Doctors</h3>
            <p className="text-secondary">
              Manage physical walk-ins and digital bookings in a single unified queue. Reduce crowded waiting rooms and keep daily OPD running smoothly.
            </p>
          </div>
        </div>

        {/* Primary Action */}
        <div className="text-center pt-1">
          <AppleButton
            variant="primary"
            size="md"
            onClick={() => navigate('/doctors')}
          >
            <span>Find Doctors Near You</span>
            <ArrowRight className="w-4 h-4" />
          </AppleButton>
        </div>
      </div>
    </div>
  );
};
