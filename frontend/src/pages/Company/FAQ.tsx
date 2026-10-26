import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ: React.FC = () => {
  const [openIds, setOpenIds] = useState<string[]>([]);

  const toggleAccordion = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const faqs: FAQItem[] = [
    {
      id: '1',
      question: 'How does the live queue work?',
      answer:
        'When you book, you get a token number. Your appointment page shows how many people are ahead of you and when to reach the clinic.',
    },
    {
      id: '2',
      question: 'Do I pay anything online?',
      answer:
        'No. There is no booking fee. You pay the doctor’s fee to the receptionist, by UPI over a call or at the desk. Your token is confirmed once you pay.',
    },
    {
      id: '3',
      question: 'Can I book for my family?',
      answer:
        'Yes. On the booking page, choose "Someone else" and enter their name and age. The token is made in their name.',
    },
    {
      id: '4',
      question: 'Can I cancel?',
      answer:
        'Yes, any time before your visit, from Appointments. There is no cancellation fee.',
    },
    {
      id: '5',
      question: 'What if the doctor is late?',
      answer:
        'The clinic updates the doctor’s status (In Cabin, Stepped Out or Not in Cabin). You see it on your appointment right away.',
    },
    {
      id: '6',
      question: 'How do I check in at the clinic?',
      answer:
        'Scan the QR code at the front desk with your phone. You can also tell the receptionist your token number.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8 pb-24 sm:pb-16 pb-safe">
      <div className="max-w-3xl mx-auto space-y-10">
        {/* Header (No pill badge) */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1d1d1f]">
            FAQ
          </h1>
          <p className="text-sm text-[#6e6e73]">
            Quick answers about booking and tokens.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {faqs.map((faq) => {
            const isOpen = openIds.includes(faq.id);
            return (
              <div
                key={faq.id}
                className="bg-white rounded-2xl border border-[#e5e5ea] overflow-hidden  transition-all"
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
                  <div className="px-5 sm:px-6 pb-6 pt-1 text-xs sm:text-sm text-[#48484a] leading-relaxed border-t border-[#f0f0f2]">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Contact Help Link */}
        <div className="p-6 rounded-2xl bg-white border border-[#e5e5ea] text-center space-y-2">
          <p className="text-sm font-semibold text-[#1d1d1f]">Still have a question?</p>
          <p className="text-xs text-[#6e6e73]">
            Write to us at{' '}
            <a href="mailto:contact@mediarca.in" className="text-[#0066cc] font-normal hover:underline">
              contact@mediarca.in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
