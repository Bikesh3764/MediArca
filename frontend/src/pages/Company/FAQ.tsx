import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { AppleButton } from '../../components/ui/AppleButton';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ: React.FC = () => {
  const navigate = useNavigate();
  const [openIds, setOpenIds] = useState<string[]>(['1']);

  const toggleAccordion = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const faqs: FAQItem[] = [
    {
      id: '1',
      question: 'How does the live queue token system work?',
      answer:
        'When you book an appointment, you get a queue token number. As the doctor sees patients, your live pass updates to show how many patients are ahead and when to reach the clinic.',
    },
    {
      id: '2',
      question: 'Do I need to pay any advance fee online?',
      answer:
        'No. Booking on MediArca is 100% free with zero upfront charges. You pay the doctor’s consultation fee directly at the clinic counter upon arrival.',
    },
    {
      id: '3',
      question: 'Can I book an appointment for my family members?',
      answer:
        'Yes. On the booking page, select "Booking for: Dependent / Family" and enter their name and age. The token pass will be issued under their name.',
    },
    {
      id: '4',
      question: 'Can I cancel my booking if my plans change?',
      answer:
        'Yes, you can cancel your token pass at any time before your consultation from your appointments tab. There are no cancellation fees or penalties.',
    },
    {
      id: '5',
      question: 'What happens if the doctor steps out or is delayed?',
      answer:
        'The clinic staff updates the doctor’s live status (In Cabin, Stepped Out, or Break) which is shown immediately on your live ticket so you know the exact situation.',
    },
    {
      id: '6',
      question: 'How do I check in when I arrive at the clinic?',
      answer:
        'When you reach the clinic, simply tell your token number to the receptionist or scan the clinic QR standee at the front desk to confirm your arrival.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto w-full space-y-8 sm:space-y-10">
        {/* Page Header */}
        <div className="text-center space-y-2.5 max-w-2xl mx-auto">
          <h1 className="text-page-title sm:text-[32px]">
            Help & FAQs
          </h1>
          <p className="text-body text-[#6e6e73]">
            Simple answers to common questions about booking and live queue tokens.
          </p>
        </div>

        {/* Clean Unified Accordion Card */}
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] shadow-apple-card divide-y divide-[#f0f0f2] overflow-hidden">
            {faqs.map((faq) => {
              const isOpen = openIds.includes(faq.id);
              return (
                <div key={faq.id} className="transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleAccordion(faq.id)}
                    aria-expanded={isOpen}
                    className="w-full px-5 sm:px-6 py-4 sm:py-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-[#fafafc] transition-colors focus-visible:outline-none focus-visible:bg-[#fafafc]"
                  >
                    <span className="text-card-title">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#0066cc]' : 'text-[#86868b]'
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-5 pt-0 text-secondary text-[14px] text-[#48484a] leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Contact Help Footer Card */}
          <div className="apple-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-card-title">Still have a question?</h2>
              <p className="text-secondary mt-0.5">
                Reach out to our team anytime at{' '}
                <a href="mailto:contact@mediarca.in" className="text-[#0066cc] font-medium hover:underline">
                  contact@mediarca.in
                </a>
              </p>
            </div>
            <AppleButton
              variant="secondary"
              size="sm"
              onClick={() => navigate('/contact')}
              className="self-start sm:self-center shrink-0"
            >
              Contact Support
            </AppleButton>
          </div>
        </div>
      </div>
    </div>
  );
};
