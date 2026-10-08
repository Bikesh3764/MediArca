import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Ticket, Smartphone, CheckCircle2, ArrowRight } from 'lucide-react';
import { AppleButton } from '../../components/ui/AppleButton';

export const HowItWorks: React.FC = () => {
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto w-full space-y-8 sm:space-y-10">
        {/* Page Header */}
        <div className="text-center space-y-2.5 max-w-2xl mx-auto">
          <h1 className="text-page-title sm:text-[32px]">
            How MediArca Works
          </h1>
          <p className="text-body text-[#6e6e73]">
            3 simple steps to see your doctor without sitting for hours in crowded clinic waiting rooms.
          </p>
        </div>

        {/* 3 Simple Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="apple-card p-6 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-semibold text-[#0066cc] bg-[#0066cc]/10 px-2.5 py-0.5 rounded-full">
                      Step {item.step}
                    </span>
                  </div>

                  <h3 className="text-card-title">
                    {item.title}
                  </h3>

                  <p className="text-secondary">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Important Things to Know */}
        <div className="apple-card p-6 sm:p-8 space-y-4">
          <h2 className="text-section-title">
            Important Things to Know
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px] sm:text-[14px] text-[#48484a] pt-1">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0 mt-0.5" />
              <span><strong className="text-[#1d1d1f] font-semibold">Zero Upfront Charges:</strong> Booking is 100% free on MediArca. You only pay the consultation fee in-person at the clinic desk.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0 mt-0.5" />
              <span><strong className="text-[#1d1d1f] font-semibold">Easy Free Cancellation:</strong> Plans changed? Cancel your pass anytime before consultation with zero penalty.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0 mt-0.5" />
              <span><strong className="text-[#1d1d1f] font-semibold">Book for Family:</strong> Easily book tokens for parents, children, or dependents under their name.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0 mt-0.5" />
              <span><strong className="text-[#1d1d1f] font-semibold">Live Cabin Status:</strong> Check if the doctor is currently in the cabin or temporarily stepped out.</span>
            </div>
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
