import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      step: '1',
      title: 'Find a doctor',
      description: 'Search by name, specialty or clinic. Pick a date and shift.',
    },
    {
      step: '2',
      title: 'Book and pay the clinic',
      description: 'Book a token. Pay the receptionist by UPI over a call or at the desk to confirm it.',
    },
    {
      step: '3',
      title: 'Track your turn',
      description: 'See how many people are ahead of you. Reach the clinic when your turn is close.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8 pb-24 sm:pb-16 pb-safe">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header (No pill badge) */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1d1d1f]">
            How MediArca Works
          </h1>
          <p className="text-sm sm:text-base text-[#6e6e73] leading-relaxed">
            See your doctor without waiting for hours.
          </p>
        </div>

        {/* 3 Simple Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl p-6 sm:p-7 border border-[#e5e5ea]  flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <span className="inline-block text-xs font-semibold text-[#0066cc] bg-[#0066cc]/10 px-2.5 py-1 rounded-full border border-[#0066cc]/20">
                  Step {item.step}
                </span>

                <h3 className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                  {item.title}
                </h3>

                <p className="text-xs sm:text-sm text-[#6e6e73] leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* What Makes It Different */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#e5e5ea]  space-y-4">
          <h2 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
            Good to know
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm text-[#48484a] pt-1">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0 mt-0.5" />
              <span><strong className="font-semibold">No booking fee.</strong> You only pay the doctor’s fee to the clinic.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0 mt-0.5" />
              <span><strong className="font-semibold">Free cancellation.</strong> Cancel any time before your visit.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0 mt-0.5" />
              <span><strong className="font-semibold">Book for family.</strong> Book for parents or children in their name.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0 mt-0.5" />
              <span><strong className="font-semibold">Doctor status.</strong> See if the doctor is in or has stepped out.</span>
            </div>
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
