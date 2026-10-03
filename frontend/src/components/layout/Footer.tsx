import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../ui/BrandLogo';
import { useAuth } from '../../context/AuthContext';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export const Footer: React.FC = () => {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#f5f5f7] border-t border-[#e5e5ea] text-[#1d1d1f] mt-auto select-none">
      {/* Main Multi-Column Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-8">
          {/* Brand & Contact Information (Col 1: spans 4 cols on lg) */}
          <div className="lg:col-span-4 space-y-5">
            <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
              <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto" />
            </Link>

            <p className="text-xs sm:text-sm text-[#6e6e73] leading-relaxed max-w-sm">
              India's real-time outpatient clinical care and smart queue management platform. Eliminating waiting room uncertainty with live clinic token tracking and zero upfront fees.
            </p>

            {/* Direct Contact Info */}
            <div className="space-y-2.5 text-xs text-[#48484a]">
              <a
                href="mailto:support@mediarca.com"
                className="flex items-center gap-2.5 text-[#48484a] hover:text-[#0066cc] transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-white border border-[#e5e5ea] flex items-center justify-center shrink-0">
                  <Mail className="w-3.5 h-3.5 text-[#0066cc]" />
                </div>
                <span>support@mediarca.com</span>
              </a>

              <a
                href="tel:+919876543210"
                className="flex items-center gap-2.5 text-[#48484a] hover:text-[#0066cc] transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-white border border-[#e5e5ea] flex items-center justify-center shrink-0">
                  <Phone className="w-3.5 h-3.5 text-[#0066cc]" />
                </div>
                <span>+91 98765 43210 <span className="text-[#86868b]">(8 AM – 8 PM IST)</span></span>
              </a>

              <div className="flex items-center gap-2.5 text-[#6e6e73]">
                <div className="w-6 h-6 rounded-full bg-white border border-[#e5e5ea] flex items-center justify-center shrink-0">
                  <Clock className="w-3.5 h-3.5 text-[#86868b]" />
                </div>
                <span>Monday – Saturday: 8:00 AM – 8:00 PM</span>
              </div>
            </div>

            {/* Registered Office Box */}
            <div className="p-3.5 rounded-[16px] bg-white border border-[#e5e5ea] space-y-1.5 shadow-2xs max-w-sm">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1d1d1f]">
                <MapPin className="w-3.5 h-3.5 text-[#0066cc]" />
                <span>Registered Office</span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#6e6e73] leading-relaxed">
                Level 4, City Care Complex, Ring Road, Rourkela, Odisha - 769004, India
              </p>
            </div>
          </div>

          {/* Clinical Care (Col 2: spans 2 cols on lg) */}
          <div className="lg:col-span-2 space-y-3.5">
            <h4 className="text-xs font-semibold text-[#1d1d1f] tracking-wide uppercase">
              Clinical Care
            </h4>
            <ul className="space-y-2 text-xs text-[#6e6e73]">
              <li>
                <Link to="/doctors" className="hover:text-[#0066cc] transition-colors">
                  Find Doctors
                </Link>
              </li>
              <li>
                <Link to="/doctors" className="hover:text-[#0066cc] transition-colors">
                  Verified Clinics
                </Link>
              </li>
              <li>
                <Link
                  to={user?.role === 'PATIENT' ? '/patient/appointments' : '/patient/login'}
                  className="hover:text-[#0066cc] transition-colors"
                >
                  Live Queue Passes
                </Link>
              </li>
              <li>
                <Link to="/clinic-checkin" className="hover:text-[#0066cc] transition-colors">
                  Clinic QR Check-in
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="hover:text-[#0066cc] transition-colors">
                  How Queue Works
                </Link>
              </li>
            </ul>
          </div>

          {/* Specialties (Col 3: spans 2 cols on lg) */}
          <div className="lg:col-span-2 space-y-3.5">
            <h4 className="text-xs font-semibold text-[#1d1d1f] tracking-wide uppercase">
              Specialties
            </h4>
            <ul className="space-y-2 text-xs text-[#6e6e73]">
              <li>
                <Link to="/doctors?specialty=General+Medicine" className="hover:text-[#0066cc] transition-colors">
                  General Medicine
                </Link>
              </li>
              <li>
                <Link to="/doctors?specialty=Cardiology" className="hover:text-[#0066cc] transition-colors">
                  Cardiology
                </Link>
              </li>
              <li>
                <Link to="/doctors?specialty=Dermatology" className="hover:text-[#0066cc] transition-colors">
                  Dermatology
                </Link>
              </li>
              <li>
                <Link to="/doctors?specialty=Pediatrics" className="hover:text-[#0066cc] transition-colors">
                  Pediatrics
                </Link>
              </li>
              <li>
                <Link to="/doctors?specialty=Orthopedics" className="hover:text-[#0066cc] transition-colors">
                  Orthopedics
                </Link>
              </li>
              <li>
                <Link to="/doctors?specialty=Neurology" className="hover:text-[#0066cc] transition-colors">
                  Neurology
                </Link>
              </li>
            </ul>
          </div>

          {/* Network Hubs / Cities (Col 4: spans 2 cols on lg) */}
          <div className="lg:col-span-2 space-y-3.5">
            <h4 className="text-xs font-semibold text-[#1d1d1f] tracking-wide uppercase">
              Network Hubs
            </h4>
            <ul className="space-y-2 text-xs text-[#6e6e73]">
              <li>
                <Link to="/doctors?city=Rourkela" className="hover:text-[#0066cc] transition-colors">
                  Rourkela
                </Link>
              </li>
              <li>
                <Link to="/doctors?city=Bhubaneswar" className="hover:text-[#0066cc] transition-colors">
                  Bhubaneswar
                </Link>
              </li>
              <li>
                <Link to="/doctors?city=Cuttack" className="hover:text-[#0066cc] transition-colors">
                  Cuttack
                </Link>
              </li>
              <li>
                <Link to="/doctors?city=Sambalpur" className="hover:text-[#0066cc] transition-colors">
                  Sambalpur
                </Link>
              </li>
              <li>
                <Link to="/doctors?city=Berhampur" className="hover:text-[#0066cc] transition-colors">
                  Berhampur
                </Link>
              </li>
              <li>
                <Link to="/doctors?city=Balasore" className="hover:text-[#0066cc] transition-colors">
                  Balasore
                </Link>
              </li>
            </ul>
          </div>

          {/* Company & Support (Col 5: spans 2 cols on lg) */}
          <div className="lg:col-span-2 space-y-3.5">
            <h4 className="text-xs font-semibold text-[#1d1d1f] tracking-wide uppercase">
              Company
            </h4>
            <ul className="space-y-2 text-xs text-[#6e6e73]">
              <li>
                <Link to="/about" className="hover:text-[#0066cc] transition-colors">
                  About MediArca
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="hover:text-[#0066cc] transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-[#0066cc] transition-colors">
                  FAQs & Help
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-[#0066cc] transition-colors">
                  Contact Support
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-[#0066cc] transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-[#0066cc] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/refund-policy" className="hover:text-[#0066cc] transition-colors">
                  Cancellation Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Operational Portals Strip */}
        <div className="mt-12 pt-6 border-t border-[#e5e5ea] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0066cc]" />
            <span className="text-xs font-semibold text-[#1d1d1f]">
              Institutional & Desk Access:
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <Link
              to={user?.role === 'PATIENT' ? '/patient/appointments' : '/patient/login'}
              className="text-[#6e6e73] hover:text-[#0066cc] transition-colors font-medium"
            >
              Patient Portal
            </Link>
            <span className="text-[#d2d2d7]">•</span>
            <Link
              to={user?.role === 'DOCTOR' ? '/doctor/dashboard' : '/doctor/login'}
              className="text-[#6e6e73] hover:text-[#0066cc] transition-colors font-medium"
            >
              Doctor Console
            </Link>
            <span className="text-[#d2d2d7]">•</span>
            <Link
              to={user?.role === 'CLINIC' ? '/clinic/dashboard' : '/clinic/login'}
              className="text-[#6e6e73] hover:text-[#0066cc] transition-colors font-medium"
            >
              Clinic Management
            </Link>
            <span className="text-[#d2d2d7]">•</span>
            <Link
              to={user?.role === 'RECEPTIONIST' ? '/receptionist/dashboard' : '/receptionist/login'}
              className="text-[#6e6e73] hover:text-[#0066cc] transition-colors font-medium"
            >
              Reception Desk
            </Link>
            <span className="text-[#d2d2d7]">•</span>
            <Link
              to="/admin-login"
              className="text-[#86868b] hover:text-[#1d1d1f] transition-colors"
            >
              Admin
            </Link>
          </div>
        </div>

        {/* Bottom Legal, Disclaimer & Copyright Bar */}
        <div className="mt-8 pt-6 border-t border-[#e5e5ea] space-y-4 text-xs text-[#86868b]">
          <p className="text-[11px] leading-relaxed text-[#86868b]">
            <strong>Important Medical Disclaimer:</strong> MediArca is an outpatient queue management platform designed to optimize appointment flow and reduce clinic waiting times. MediArca is not an emergency medical service and does not provide emergency clinical intervention. In the event of a medical emergency, please call 112 / 108 immediately or proceed to the nearest hospital casualty department.
          </p>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
            <p className="text-xs text-[#6e6e73]">
              © {currentYear} MediArca Health Technologies Private Limited. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#6e6e73]">
              <Link to="/terms" className="hover:text-[#0066cc] transition-colors">
                Terms
              </Link>
              <Link to="/privacy" className="hover:text-[#0066cc] transition-colors">
                Privacy
              </Link>
              <Link to="/refund-policy" className="hover:text-[#0066cc] transition-colors">
                Refund & Cancellation
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
