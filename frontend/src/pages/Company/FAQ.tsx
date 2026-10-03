import React, { useState } from 'react';
import { Search, ChevronDown, HelpCircle, MessageCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppleButton } from '../../components/ui/AppleButton';

interface FAQItem {
  id: string;
  category: 'patients' | 'tokens' | 'clinics' | 'payments';
  question: string;
  answer: string;
}

export const FAQ: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [openIds, setOpenIds] = useState<string[]>(['f1', 'f3']);

  const toggleAccordion = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const faqs: FAQItem[] = [
    {
      id: 'f1',
      category: 'tokens',
      question: 'How does the MediArca token number system work?',
      answer:
        'When you book an appointment, you receive a guaranteed atomic queue token number (e.g. #1, #2, #3). As the doctor calls patients into the consultation cabin in real time, your digital live queue pass updates automatically, showing you how many patients are ahead and when to arrive at the clinic.',
    },
    {
      id: 'f2',
      category: 'payments',
      question: 'Do I need to pay any upfront fee while booking online?',
      answer:
        'No. MediArca operates on a strict zero upfront fee policy for patients. You reserve your guaranteed consultation token online completely free. You only pay the doctor’s direct consultation fee at the clinic reception desk when you arrive.',
    },
    {
      id: 'f3',
      category: 'tokens',
      question: 'What is the difference between estimated token and confirmed token?',
      answer:
        'When booking online, your request is submitted with an estimated token. Upon arriving at the clinic or when the front desk confirms your payment/presence, the official positive token number is locked in. If someone confirms ahead of you, your position adjusts accurately to prevent empty slots.',
    },
    {
      id: 'f4',
      category: 'patients',
      question: 'Can I book an appointment for my family member or dependent?',
      answer:
        'Yes! On the booking screen, simply toggle "Booking for: Dependent / Family". You can provide the patient’s full name, age, and gender, and the token pass will be generated under their name while staying linked to your account.',
    },
    {
      id: 'f5',
      category: 'clinics',
      question: 'How do clinics and receptionists manage walk-in patients?',
      answer:
        'Reception staff have access to the Receptionist Console where they can issue guaranteed walk-in tokens in seconds. These walk-in tokens are unified with online reservations in the same database queue, ensuring absolute fairness and zero queue collision.',
    },
    {
      id: 'f6',
      category: 'clinics',
      question: 'How do doctors get verified on MediArca?',
      answer:
        'Every practitioner must provide valid medical registration credentials, medical council certifications, and clinic affiliations. Our administrative compliance team manually verifies credentials against official registry databases before enabling public search discovery.',
    },
    {
      id: 'f7',
      category: 'tokens',
      question: 'What happens if a doctor is running late or steps out of the cabin?',
      answer:
        'Doctors and receptionists update real-time cabin presence status: In Cabin, Stepped Out (with an expected return time, e.g. 15 mins), or in Emergency. This status is reflected instantly on your live queue pass so you do not wait fruitlessly in the lobby.',
    },
    {
      id: 'f8',
      category: 'patients',
      question: 'How does the QR check-in kiosk work at the clinic?',
      answer:
        'Clinics display an official MediArca QR standee at the front desk. When you arrive, scan the QR code with your smartphone camera to immediately mark your arrival in the receptionist and doctor queue system.',
    },
    {
      id: 'f9',
      category: 'payments',
      question: 'Can I cancel my appointment if my plans change?',
      answer:
        'Yes, you can cancel your appointment pass at any time before your consultation from the "Live Queue & Passes" section of your patient dashboard. Since no upfront fee was charged, there are zero cancellation fees or penalty deductions.',
    },
  ];

  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesSearch =
      !search.trim() ||
      faq.question.toLowerCase().includes(search.toLowerCase()) ||
      faq.answer.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full border border-[#0066cc]/20">
            Frequently Asked Questions
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#1d1d1f]">
            Got Questions? We Have Answers.
          </h1>
          <p className="text-sm text-[#86868b]">
            Everything you need to know about outpatient queue passes, tokens, clinical desks, and doctor bookings on MediArca.
          </p>
        </div>

        {/* Search & Categories */}
        <div className="space-y-4">
          <div className="relative max-w-xl mx-auto">
            <Search className="w-4 h-4 text-[#86868b] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search answers (e.g. token, fee, qr code, walk-in)..."
              className="w-full h-12 pl-11 pr-4 rounded-full border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] placeholder:text-[#86868b] shadow-2xs focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/15 transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All Topics' },
              { id: 'tokens', label: 'Tokens & Queue' },
              { id: 'payments', label: 'Pricing & Fees' },
              { id: 'patients', label: 'Patient Passes' },
              { id: 'clinics', label: 'Clinics & Desks' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap active:scale-[0.98] ${
                  selectedCategory === cat.id
                    ? 'bg-[#1d1d1f] text-white shadow-2xs'
                    : 'bg-white text-[#86868b] border border-[#e5e5ea] hover:text-[#1d1d1f]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="bg-white rounded-[20px] p-10 border border-[#e5e5ea] text-center space-y-3">
              <HelpCircle className="w-8 h-8 text-[#86868b] mx-auto" />
              <h3 className="text-sm font-semibold text-[#1d1d1f]">No matching answers found</h3>
              <p className="text-xs text-[#86868b]">
                Try searching with different terms or select "All Topics".
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('all');
                }}
                className="text-xs text-[#0066cc] font-semibold hover:underline"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isOpen = openIds.includes(faq.id);
              return (
                <div
                  key={faq.id}
                  className="bg-white rounded-[20px] border border-[#e5e5ea] overflow-hidden transition-all shadow-2xs hover:border-[#0066cc]/30"
                >
                  <button
                    type="button"
                    onClick={() => toggleAccordion(faq.id)}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                  >
                    <span className="text-sm sm:text-base font-semibold text-[#1d1d1f] tracking-tight">
                      {faq.question}
                    </span>
                    <div
                      className={`w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#86868b] shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 bg-[#0066cc]/10 text-[#0066cc]' : ''
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-xs sm:text-sm text-[#48484a] leading-relaxed border-t border-[#f0f0f2] pt-4">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Support Callout */}
        <div className="bg-white rounded-[24px] p-6 sm:p-8 border border-[#e5e5ea] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">Still have questions?</h3>
              <p className="text-xs text-[#86868b] mt-0.5">
                Our clinical support team is available from 8:00 AM to 8:00 PM IST to assist you.
              </p>
            </div>
          </div>
          <Link to="/contact">
            <AppleButton variant="secondary" size="sm">
              Contact Desk
            </AppleButton>
          </Link>
        </div>
      </div>
    </div>
  );
};
