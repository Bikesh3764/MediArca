import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../ui/BrandLogo';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#f5f5f7] border-t border-[#e5e5ea] text-[#86868b] mt-auto select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-[#e5e5ea]">
          <Link to="/" className="inline-block hover:opacity-85 transition-opacity">
            <BrandLogo variant="full" size="md" imgClassName="h-6 w-auto" />
          </Link>

          {/* Quick Portal Navigation Links */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <Link to="/doctors" className="hover:text-[#1d1d1f] transition-colors">
              Find Doctors
            </Link>
            <Link to="/patient/appointments" className="hover:text-[#1d1d1f] transition-colors">
              Patient Portal
            </Link>
            <Link to="/doctor/dashboard" className="hover:text-[#1d1d1f] transition-colors">
              Doctor Console
            </Link>
            <Link to="/clinic/login" className="hover:text-[#1d1d1f] transition-colors">
              Clinic Portal
            </Link>
            <Link to="/receptionist/login" className="hover:text-[#1d1d1f] transition-colors">
              Reception Desk
            </Link>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 text-xs text-[#86868b] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <p>© {new Date().getFullYear()} MediArca. All rights reserved.</p>
          <p className="text-[11px] text-[#a1a1a6]">Healthcare organized with clinical clarity.</p>
        </div>
      </div>
    </footer>
  );
};
