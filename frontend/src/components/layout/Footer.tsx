import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../ui/BrandLogo';
import { useAuth } from '../../context/AuthContext';
import { Mail, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#f5f5f7] border-t border-[#e5e5ea] text-[#1d1d1f] mt-auto select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-12">
        {/* Main 4-Column Balanced Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 sm:gap-10 lg:gap-12">
          {/* Column 1: Brand & Contact (Spans 4 columns) */}
          <div className="sm:col-span-2 lg:col-span-4 space-y-5">
            <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
              <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto" />
            </Link>

            {/* Simple, clear tagline */}
            <p className="text-sm text-[#48484a] leading-relaxed max-w-sm">
              Book doctor appointments, track your live clinic queue token, and skip waiting room delays. No advance payment required.
            </p>

            {/* Direct Contact Channels */}
            <div className="space-y-3 pt-1 text-sm text-[#48484a]">
              <a
                href="mailto:contact@mediarca.in"
                className="flex items-center gap-3 text-[#48484a] hover:text-[#0066cc] transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-white border border-[#e5e5ea] flex items-center justify-center shrink-0 shadow-2xs group-hover:border-[#0066cc]/30 transition-colors">
                  <Mail className="w-4 h-4 text-[#0066cc]" />
                </div>
                <div>
                  <p className="text-[11px] text-[#86868b] font-normal">Support & Inquiries</p>
                  <p className="font-medium text-[#1d1d1f] group-hover:text-[#0066cc] transition-colors">contact@mediarca.in</p>
                </div>
              </a>
            </div>
          </div>

          {/* Column 2: Clinical Care (Spans 3 columns) */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-sm font-semibold text-[#1d1d1f] tracking-wide uppercase">
              Clinical Care
            </h4>
            <ul className="space-y-2.5 text-sm text-[#555558]">
              <li>
                <Link to="/doctors" className="hover:text-[#0066cc] transition-colors py-0.5 inline-block">
                  Find Doctors
                </Link>
              </li>
              <li>
                <Link to="/doctors" className="hover:text-[#0066cc] transition-colors py-0.5 inline-block">
                  Verified Clinics
                </Link>
              </li>
              <li>
                <Link
                  to={user?.role === 'PATIENT' ? '/patient/appointments' : '/patient/login'}
                  className="hover:text-[#0066cc] transition-colors py-0.5 inline-block"
                >
                  Live Queue Passes
                </Link>
              </li>
              <li>
                <Link to="/clinic-checkin" className="hover:text-[#0066cc] transition-colors py-0.5 inline-block">
                  Clinic Arrival Guide
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="hover:text-[#0066cc] transition-colors py-0.5 inline-block">
                  How Queue Works
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Specialties (Spans 2 columns) */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-sm font-semibold text-[#1d1d1f] tracking-wide uppercase">
              Specialties
            </h4>
            <ul className="space-y-2.5 text-sm text-[#555558]">
              <li>
                <Link to="/doctors?specialty=General+Medicine" className="hover:text-[#0066cc] transition-colors py-0.5 inline-block">
                  General Medicine
                </Link>
              </li>
              <li>
                <Link to="/doctors?specialty=Cardiology" className="hover:text-[#0066cc] transition-colors py-0.5 inline-block">
                  Cardiology
                </Link>
              </li>
              <li>
                <Link to="/doctors?specialty=Dermatology" className="hover:text-[#0066cc] transition-colors py-0.5 inline-block">
                  Dermatology
                </Link>
              </li>
              <li>
                <Link to="/doctors?specialty=Pediatrics" className="hover:text-[#0066cc] transition-colors py-0.5 inline-block">
                  Pediatrics
                </Link>
              </li>
              <li>
                <Link to="/doctors?specialty=Orthopedics" className="hover:text-[#0066cc] transition-colors py-0.5 inline-block">
                  Orthopedics
                </Link>
              </li>
              <li>
                <Link to="/doctors?specialty=Neurology" className="hover:text-[#0066cc] transition-colors py-0.5 inline-block">
                  Neurology
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Company & Support (Spans 3 columns) */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-sm font-semibold text-[#1d1d1f] tracking-wide uppercase">
              Company & Help
            </h4>
            <ul className="space-y-2.5 text-sm text-[#555558]">
              <li>
                <Link to="/about" className="hover:text-[#0066cc] transition-colors py-0.5 inline-block">
                  About MediArca
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="hover:text-[#0066cc] transition-colors py-0.5 inline-block">
                  How It Works
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-[#0066cc] transition-colors py-0.5 inline-block">
                  FAQs & Help
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-[#0066cc] transition-colors py-0.5 inline-block">
                  Contact Support
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Operational Portals Strip (Shown only to guests/unauthenticated visitors; hidden once signed in) */}
        {!user && (
          <div className="mt-12 pt-6 border-t border-[#e5e5ea] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0066cc]" />
              <span className="text-sm font-semibold text-[#1d1d1f]">
                Desk & Partner Portals:
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <Link
                to="/patient/login"
                className="text-[#48484a] hover:text-[#0066cc] transition-colors font-medium"
              >
                Patient Portal
              </Link>
              <span className="text-[#d2d2d7]">•</span>
              <Link
                to="/doctor/login"
                className="text-[#48484a] hover:text-[#0066cc] transition-colors font-medium"
              >
                Doctor Console
              </Link>
              <span className="text-[#d2d2d7]">•</span>
              <Link
                to="/clinic/login"
                className="text-[#48484a] hover:text-[#0066cc] transition-colors font-medium"
              >
                Clinic Management
              </Link>
              <span className="text-[#d2d2d7]">•</span>
              <Link
                to="/receptionist/login"
                className="text-[#48484a] hover:text-[#0066cc] transition-colors font-medium"
              >
                Reception Desk
              </Link>
            </div>
          </div>
        )}

        {/* Bottom Disclaimer & Copyright Bar */}
        <div className="mt-8 pt-6 border-t border-[#e5e5ea] space-y-4 text-xs text-[#86868b]">
          <p className="text-xs leading-relaxed text-[#71717a]">
            <strong>Medical Disclaimer:</strong> MediArca is an outpatient queue management platform designed to optimize appointment flow and reduce waiting room delays. MediArca is not an emergency medical service. In the event of a medical emergency, please call 112 / 108 immediately or visit the nearest hospital casualty department.
          </p>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
            <p className="text-xs sm:text-sm text-[#48484a]">
              © {currentYear} MediArca. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-5 text-xs sm:text-sm text-[#48484a]">
              <Link to="/terms" className="hover:text-[#0066cc] transition-colors">
                Terms
              </Link>
              <Link to="/privacy" className="hover:text-[#0066cc] transition-colors">
                Privacy
              </Link>
              <Link to="/refund-policy" className="hover:text-[#0066cc] transition-colors">
                Cancellation Policy
              </Link>
              <Link to="/faq" className="hover:text-[#0066cc] transition-colors">
                Help
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
