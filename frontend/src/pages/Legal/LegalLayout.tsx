import React from 'react';
import { NavLink } from 'react-router-dom';
import { FileText, ShieldCheck, RotateCcw, Mail } from 'lucide-react';

const DOCS = [
  { to: '/terms', label: 'Terms', icon: FileText },
  { to: '/privacy', label: 'Privacy', icon: ShieldCheck },
  { to: '/refund-policy', label: 'Cancellation', icon: RotateCcw },
];

interface LegalLayoutProps {
  title: string;
  updated: string;
  children: React.ReactNode;
}

/** Shared frame for the legal pages: soft header, document switcher and a readable article card. */
export const LegalLayout: React.FC<LegalLayoutProps> = ({ title, updated, children }) => (
  <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] pb-24 sm:pb-0 pb-safe">
    <section className="relative overflow-clip bg-gradient-to-b from-[#e9f2fc] via-[#f1f6fc] to-[#f5f5f7]">
      <div className="pointer-events-none absolute -top-40 right-[-8%] w-[520px] h-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(0,102,204,0.12),transparent)]" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-12 pb-8 sm:pt-16 sm:pb-12">
        <p className="text-sm font-semibold text-primary">Legal</p>
        <h1 className="mt-2 font-display text-[32px] leading-[1.1] sm:text-5xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-[#86868b]">Last updated: {updated}</p>
      </div>
    </section>

    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pb-16 sm:pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-10 items-start">
        <nav aria-label="Legal pages" className="lg:sticky lg:top-24 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
          <ul className="flex lg:flex-col gap-2 w-max lg:w-full">
            {DOCS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `h-11 px-4 rounded-full lg:rounded-xl inline-flex lg:flex items-center gap-2.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-white border border-primary-line text-primary font-semibold'
                        : 'border border-transparent text-[#48484a] hover:bg-white hover:text-[#1d1d1f]'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
          <a
            href="mailto:contact@mediarca.in"
            className="hidden lg:flex mt-6 items-center gap-2 px-4 text-xs text-[#86868b] hover:text-primary transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            contact@mediarca.in
          </a>
        </nav>

        <article className="bg-white rounded-[28px] border border-[#e5e5ea] p-6 sm:p-10 lg:p-12 space-y-8 text-sm sm:text-[15px] text-[#48484a] leading-relaxed [&_h2]:text-lg [&_h2]:sm:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-[#1d1d1f] [&_section]:space-y-2.5">
          {children}
        </article>
      </div>
    </div>
  </div>
);
