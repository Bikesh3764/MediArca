import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Mail, ArrowRight, MessageCircle } from 'lucide-react';
import { FAQS } from '../../seo/site';
import { PageHero } from '../../components/layout/PageHero';

export const FAQ: React.FC = () => {
  const [openIds, setOpenIds] = useState<string[]>(['1']);

  const toggleAccordion = (id: string) => {
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const faqs = FAQS.map((faq, i) => ({ ...faq, id: String(i + 1) }));

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] pb-24 sm:pb-0 pb-safe">
      <PageHero eyebrow="FAQ" title="Questions?" highlight="Quick answers." subtitle="About booking, tokens and paying the clinic." />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-4 sm:pt-8 pb-16 sm:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-10 items-start">
          {/* Accordion */}
          <ul className="rounded-[28px] bg-white border border-[#e5e5ea] divide-y divide-[#f0f0f2] overflow-hidden">
            {faqs.map((faq) => {
              const isOpen = openIds.includes(faq.id);
              const panelId = `faq-panel-${faq.id}`;
              return (
                <li key={faq.id}>
                  <button
                    type="button"
                    onClick={() => toggleAccordion(faq.id)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="w-full px-5 sm:px-8 py-5 sm:py-6 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-[#fafafc] transition-colors"
                  >
                    <span className="text-base sm:text-[17px] font-semibold text-[#1d1d1f]">{faq.question}</span>
                    <span
                      className={`w-8 h-8 rounded-full inline-flex items-center justify-center shrink-0 transition-all duration-200 ${
                        isOpen ? 'rotate-45 bg-primary text-white' : 'bg-[#f5f5f7] text-[#1d1d1f]'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                    </span>
                  </button>
                  <div
                    id={panelId}
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 sm:px-8 pb-6 -mt-1 text-sm sm:text-base text-[#48484a] leading-relaxed max-w-2xl">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Help card */}
          <aside className="lg:sticky lg:top-24 rounded-[28px] border border-primary-line/60 bg-gradient-to-br from-[#eaf3fd] via-[#f3f8fe] to-white p-7">
            <span className="w-12 h-12 rounded-full bg-primary text-white inline-flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </span>
            <h2 className="mt-5 text-xl font-semibold tracking-tight">Still have a question?</h2>
            <p className="mt-1.5 text-sm text-[#6e6e73] leading-relaxed">We read every message and reply by email.</p>
            <a
              href="mailto:contact@mediarca.in"
              className="mt-6 flex items-center gap-2.5 rounded-2xl bg-white border border-[#e5e5ea] px-4 py-3 text-sm hover:border-primary-line transition-colors"
            >
              <Mail className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">contact@mediarca.in</span>
            </a>
            <Link
              to="/contact"
              className="mt-3 h-11 w-full rounded-full bg-primary hover:bg-primary-hover text-white text-sm inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              Send a message
              <ArrowRight className="w-4 h-4" />
            </Link>
          </aside>
        </div>
      </section>
    </div>
  );
};
