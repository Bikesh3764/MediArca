import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Ticket, Smartphone, CheckCircle2, ArrowRight } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      step: '1',
      title: 'Find Doctor & Select Shift',
      description:
        'Search verified doctors by specialty or clinic. Choose the date and practice shift that suits you best.',
      icon: Search,
    },
    {
      step: '2',
      title: 'Get Free Queue Token',
      description:
        'Book your consultation token instantly with zero advance charges. No platform markup or payment required.',
      icon: Ticket,
    },
    {
      step: '3',
      title: 'Track Live Turn & Arrive on Time',
      description:
        'Open your live queue pass to see how many patients are ahead. Arrive at the clinic when your turn is close, pay the consultation fee at the front desk, and see the doctor without hours of waiting.',
      icon: Smartphone,
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header (No pill badge) */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1d1d1f]">
            How MediArca Works
          </h1>
          <p className="text-sm sm:text-base text-[#6e6e73] leading-relaxed">
            3 simple steps to see your doctor without sitting for hours in crowded clinic waiting rooms.
          </p>
        </div>

        {/* 3 Simple Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-[24px] p-6 sm:p-7 border border-[#e5e5ea] shadow-xs flex flex-col justify-between space-y-5"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#1d1d1f]" />
                    </div>
                    <span className="text-xs font-bold text-[#86868b] bg-[#f5f5f7] px-2.5 py-1 rounded-full border border-[#e5e5ea]">
                      Step {item.step}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#1d1d1f] tracking-tight">
                    {item.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#6e6e73] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* What Makes It Different */}
        <div className="bg-white rounded-[24px] p-6 sm:p-8 border border-[#e5e5ea] shadow-xs space-y-4">
          <h2 className="text-lg font-bold text-[#1d1d1f]">
            Important Things to Know
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm text-[#48484a] pt-1">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#1d1d1f] shrink-0 mt-0.5" />
              <span><strong>Zero Upfront Charges:</strong> Booking is 100% free on MediArca. You only pay the consultation fee in-person at the clinic desk.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#1d1d1f] shrink-0 mt-0.5" />
              <span><strong>Easy Free Cancellation:</strong> Plans changed? Cancel your pass anytime before consultation with zero penalty.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#1d1d1f] shrink-0 mt-0.5" />
              <span><strong>Book for Family:</strong> Easily book tokens for parents, children, or dependents under their name.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#1d1d1f] shrink-0 mt-0.5" />
              <span><strong>Live Cabin Status:</strong> Check if the doctor is currently in the cabin or temporarily stepped out.</span>
            </div>
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
