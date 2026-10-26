import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../ui/BrandLogo';
import { useAuth } from '../../context/AuthContext';
import { Mail } from 'lucide-react';

type FooterLink = { label: string; to: string };

const SPECIALTIES = ['General Medicine', 'Cardiology', 'Dermatology', 'Pediatrics', 'Orthopedics', 'Neurology'];

const linkClass = 'hover:text-[#0066cc] transition-colors py-1.5 sm:py-0.5 inline-block';

const FooterColumn: React.FC<{ title: string; links: FooterLink[] }> = ({ title, links }) => (
  <div>
    <h4 className="text-xs font-semibold text-[#1d1d1f] tracking-tight mb-3">{title}</h4>
    <ul className="space-y-1 sm:space-y-2.5 text-sm text-[#48484a]">
      {links.map((l) => (
        <li key={l.label}>
          <Link to={l.to} className={linkClass}>
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

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
  const signInLinks: FooterLink[] = [
    { label: 'Patient', to: '/patient/login' },
    { label: 'Doctor', to: '/doctor/login' },
    { label: 'Clinic', to: '/clinic/login' },
    { label: 'Receptionist', to: '/receptionist/login' },
  ];

  return (
    <footer className="bg-[#f5f5f7] border-t border-[#e5e5ea] text-[#1d1d1f] mt-auto select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-10">
        {/* Brand on the left, three even link columns on the right */}
        <div className="flex flex-col lg:flex-row lg:justify-between gap-10 lg:gap-16">
          <div className="space-y-4 lg:max-w-xs">
            <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
              <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto" />
            </Link>
            <p className="text-sm text-[#48484a] leading-relaxed">
              Book a clinic visit, track your token live, and skip the waiting room. No advance payment.
            </p>
            <a
              href="mailto:contact@mediarca.in"
              className="inline-flex items-center gap-2 text-sm text-[#1d1d1f] hover:text-[#0066cc] transition-colors py-1"
            >
              <Mail className="w-4 h-4 text-[#0066cc] shrink-0" />
              <span>contact@mediarca.in</span>
            </a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-8 sm:gap-x-16">
            <FooterColumn title="Patients" links={patientLinks} />
            <FooterColumn title="Specialties" links={specialtyLinks} />
            <FooterColumn title="Company" links={companyLinks} />
          </div>
        </div>

        {/* Sign-in links for visitors only */}
        {!user && (
          <div className="mt-10 pt-6 border-t border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm">
            <span className="text-xs font-semibold text-[#1d1d1f] tracking-tight">Sign in as</span>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[#48484a]">
              {signInLinks.map((l) => (
                <Link key={l.label} to={l.to} className="hover:text-[#0066cc] transition-colors py-1.5 sm:py-0.5">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Copyright, legal links, emergency note */}
        <div className="mt-8 pt-6 border-t border-[#e5e5ea] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-[#48484a]">
            <p>© {currentYear} MediArca. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-x-5">
              <Link to="/terms" className="hover:text-[#0066cc] transition-colors py-1.5 inline-block">
                Terms
              </Link>
              <Link to="/privacy" className="hover:text-[#0066cc] transition-colors py-1.5 inline-block">
                Privacy
              </Link>
              <Link to="/refund-policy" className="hover:text-[#0066cc] transition-colors py-1.5 inline-block">
                Cancellation Policy
              </Link>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-[#86868b]">
            <strong className="font-semibold">Not for emergencies.</strong> Call 112 / 108 or go to the nearest hospital.
          </p>
        </div>
      </div>
    </footer>
  );
};
