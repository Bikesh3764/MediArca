import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../ui/BrandLogo';
import { useAuth } from '../../context/AuthContext';
import { Mail, Search, Ticket, User, Stethoscope, Building2, Headset, ChevronRight, Phone } from 'lucide-react';

type FooterLink = { label: string; to: string };

const SPECIALTIES = ['General Medicine', 'Cardiology', 'Dermatology', 'Pediatrics', 'Orthopedics', 'Neurology'];

const FooterColumn: React.FC<{ title: string; links: FooterLink[] }> = ({ title, links }) => (
  <div>
    <h4 className="text-xs font-semibold text-[#86868b] mb-4">{title}</h4>
    <ul className="space-y-1 sm:space-y-3 text-sm text-[#1d1d1f]">
      {links.map((l) => (
        <li key={l.label}>
          <Link to={l.to} className="text-[#48484a] hover:text-primary transition-colors py-1.5 sm:py-0 inline-block">
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

const PORTALS = [
  { label: 'Patient', to: '/patient/login', icon: User },
  { label: 'Doctor', to: '/doctor/login', icon: Stethoscope },
  { label: 'Clinic', to: '/clinic/login', icon: Building2 },
  { label: 'Receptionist', to: '/receptionist/login', icon: Headset },
];

export const Footer: React.FC = () => {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();

  const patientLinks: FooterLink[] = [
    { label: 'Doctors', to: '/doctors' },
    { label: 'Clinics', to: '/doctors?tab=clinics' },
    { label: 'Appointments', to: user?.role === 'PATIENT' ? '/patient/appointments' : '/patient/login' },
    { label: 'Check In', to: '/clinic-checkin' },
    { label: 'How It Works', to: '/how-it-works' },
  ];
  const specialtyLinks: FooterLink[] = SPECIALTIES.map((s) => ({
    label: s,
    to: `/doctors?specialty=${s.replace(/ /g, '+')}`,
  }));
  const companyLinks: FooterLink[] = [
    { label: 'About', to: '/about' },
    { label: 'FAQ', to: '/faq' },
    { label: 'Contact', to: '/contact' },
  ];

  return (
    <footer className="relative overflow-clip bg-[#f5f5f7] border-t border-[#e5e5ea] text-[#1d1d1f] mt-auto select-none pb-tabbar">
      {/* Soft blue glow, matching the home page */}
      <div className="pointer-events-none absolute -top-48 right-[-10%] w-[620px] h-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(0,102,204,0.07),transparent)]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-14 sm:pt-20">
        {/* Brand + quick actions on the left, link columns on the right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10">
          <div className="lg:col-span-5 space-y-5">
            <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
              <BrandLogo variant="full" size="md" imgClassName="h-8 w-auto" />
            </Link>
            <div className="flex flex-wrap gap-2.5">
              <Link
                to="/doctors"
                className="h-10 px-5 rounded-full bg-primary hover:bg-primary-hover text-white text-sm inline-flex items-center gap-2 transition-all active:scale-[0.98]"
              >
                <Search className="w-4 h-4" />
                Find a doctor
              </Link>
              <Link
                to="/track"
                className="h-10 px-5 rounded-full bg-white border border-[#d2d2d7] hover:bg-[#fafafc] text-[#1d1d1f] text-sm inline-flex items-center gap-2 transition-all active:scale-[0.98]"
              >
                <Ticket className="w-4 h-4 text-primary" />
                Track walk-in
              </Link>
            </div>
            <a
              href="mailto:contact@mediarca.in"
              className="inline-flex items-center gap-2.5 text-sm text-[#1d1d1f] hover:text-primary transition-colors py-1"
            >
              <span className="w-8 h-8 rounded-full bg-white border border-[#e5e5ea] inline-flex items-center justify-center">
                <Mail className="w-4 h-4 text-primary" />
              </span>
              contact@mediarca.in
            </a>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-10 lg:pl-10">
            <FooterColumn title="Patients" links={patientLinks} />
            <FooterColumn title="Specialties" links={specialtyLinks} />
            <FooterColumn title="Company" links={companyLinks} />
          </div>
        </div>

        {/* Sign-in portals for visitors only */}
        {!user && (
          <div className="mt-14 rounded-2xl bg-white border border-[#e5e5ea] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
            <div className="lg:w-44 shrink-0 px-1">
              <p className="text-sm font-semibold text-[#1d1d1f]">Sign in as</p>
            </div>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PORTALS.map(({ label, to, icon: Icon }) => (
                <Link
                  key={label}
                  to={to}
                  className="group h-14 rounded-xl bg-[#f5f5f7] hover:bg-primary-soft border border-transparent hover:border-primary-line px-3 flex items-center gap-2.5 sm:gap-3 transition-colors"
                >
                  <span className="w-8 h-8 rounded-full bg-white text-primary inline-flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="text-sm text-[#1d1d1f] truncate flex-1">{label}</span>
                  <ChevronRight className="hidden sm:block w-4 h-4 text-[#c7c7cc] group-hover:text-primary transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Copyright, legal links, emergency note */}
        <div className="mt-10 pt-6 border-t border-[#e5e5ea] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
            <p className="text-sm text-[#48484a]">© {currentYear} MediArca. All rights reserved.</p>
            <p className="inline-flex items-center gap-2 self-start h-8 px-3 rounded-full bg-danger-soft text-xs text-danger">
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span>
                <strong className="font-semibold">Not for emergencies.</strong> Call{' '}
                <a href="tel:112" className="underline-offset-2 hover:underline">112</a> /{' '}
                <a href="tel:108" className="underline-offset-2 hover:underline">108</a>
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 text-sm text-[#48484a]">
            <Link to="/terms" className="hover:text-primary transition-colors py-1.5 inline-block">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-primary transition-colors py-1.5 inline-block">
              Privacy
            </Link>
            <Link to="/refund-policy" className="hover:text-primary transition-colors py-1.5 inline-block">
              Cancellation Policy
            </Link>
          </div>
        </div>

        {/* Large faded wordmark */}
        <div
          aria-hidden="true"
          className="mt-8 -mb-[0.22em] text-center font-display font-semibold tracking-tighter leading-none text-[22vw] lg:text-[200px] bg-gradient-to-b from-[#e3e3e8] to-[#f5f5f7] bg-clip-text text-transparent"
        >
          MediArca
        </div>
      </div>
    </footer>
  );
};
