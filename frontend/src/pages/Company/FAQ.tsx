import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ: React.FC = () => {
  const [openIds, setOpenIds] = useState<string[]>(['1', '2']);

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
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-10">
        {/* Header (No pill badge) */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1d1d1f]">
            Help & FAQs
          </h1>
          <p className="text-sm text-[#6e6e73]">
            Simple answers to common questions about booking and queue tokens.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {faqs.map((faq) => {
            const isOpen = openIds.includes(faq.id);
            return (
              <div
                key={faq.id}
                className="bg-white rounded-[20px] border border-[#e5e5ea] overflow-hidden shadow-2xs transition-all"
              >
                <button
                  type="button"
                  onClick={() => toggleAccordion(faq.id)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-black/[0.01] transition-colors"
                >
                  <span className="text-sm sm:text-base font-semibold text-[#1d1d1f]">
                    {faq.question}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#1d1d1f]' : 'text-[#86868b]'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 sm:px-6 pb-6 pt-1 text-xs sm:text-sm text-[#555558] leading-relaxed border-t border-[#f0f0f2]">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Contact Help Link */}
        <div className="p-6 rounded-[20px] bg-white border border-[#e5e5ea] text-center space-y-2">
          <p className="text-sm font-semibold text-[#1d1d1f]">Still have a question?</p>
          <p className="text-xs text-[#6e6e73]">
            Feel free to write to us anytime at{' '}
            <a href="mailto:contact@mediarca.in" className="text-[#0066cc] font-medium hover:underline">
              contact@mediarca.in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
