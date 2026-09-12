import React from 'react';
import { Link } from 'react-router-dom';
import { getBackendBaseUrl } from '../../services/api';
import { BrandLogo } from '../ui/BrandLogo';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#f5f5f7] border-t border-[#e0e0e0] text-[#7a7a7a] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-10">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Link to="/" className="inline-block hover:opacity-85 transition-opacity">
            <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto" />
          </Link>
          <span className="text-xs text-[#86868b] font-medium">
            Next-Generation Clinical Operations & Queue Platform
          </span>
        </div>

        {/* Directory Links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-8 text-[12px] leading-relaxed border-b border-[#e0e0e0]">
          <div>
            <span className="font-semibold text-[#1d1d1f] block mb-2">Patients</span>
            <ul className="space-y-1.5">
              <li><Link to="/doctors" className="hover:text-[#1d1d1f]">Find Doctors</Link></li>
              <li><Link to="/patient/appointments" className="hover:text-[#1d1d1f]">Live Queue Pass</Link></li>
              <li><Link to="/patient/records" className="hover:text-[#1d1d1f]">Medical Vault</Link></li>
            </ul>
          </div>

          <div>
            <span className="font-semibold text-[#1d1d1f] block mb-2">Specialties</span>
            <ul className="space-y-1.5">
              <li><Link to="/doctors?specialty=Cardiology" className="hover:text-[#1d1d1f]">Cardiology</Link></li>
              <li><Link to="/doctors?specialty=Dermatology" className="hover:text-[#1d1d1f]">Dermatology</Link></li>
              <li><Link to="/doctors?specialty=Pediatrics" className="hover:text-[#1d1d1f]">Pediatrics</Link></li>
              <li><Link to="/doctors?specialty=Orthopedics" className="hover:text-[#1d1d1f]">Orthopedics</Link></li>
            </ul>
          </div>

          <div>
            <span className="font-semibold text-[#1d1d1f] block mb-2">Healthcare Providers</span>
            <ul className="space-y-1.5">
              <li><Link to="/signup" className="hover:text-[#1d1d1f]">Join as Doctor</Link></li>
              <li><Link to="/doctor/dashboard" className="hover:text-[#1d1d1f]">Doctor Console</Link></li>
              <li><Link to="/clinic/login" className="hover:text-[#0088e8] font-medium text-[#0088e8]">Clinic Partner Portal</Link></li>
              <li><Link to="/receptionist/login" className="hover:text-[#0088e8] font-medium text-[#0088e8]">Receptionist Portal</Link></li>
              <li><Link to="/doctor/dashboard?tab=affiliations" className="hover:text-[#1d1d1f]">Clinics & Schedules</Link></li>
            </ul>
          </div>

          <div>
            <span className="font-semibold text-[#1d1d1f] block mb-2">Platform</span>
            <ul className="space-y-1.5">
              <li><span className="text-[#86868b]">HIPAA & SOC2 Ready</span></li>
              <li><a href={`${getBackendBaseUrl()}/healthz`} target="_blank" rel="noreferrer" className="hover:text-[#1d1d1f]">API Health Status</a></li>
              <li><Link to="/admin-login" className="hover:text-[#1d1d1f]">Admin Console</Link></li>
              <li><span className="text-[#86868b]">Apple Design System v1.0</span></li>
            </ul>
          </div>
        </div>

        {/* Legal Fine-Print */}
        <div className="pt-6 text-[11px] text-[#86868b] leading-relaxed flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <p>
            Copyright © {new Date().getFullYear()} MediArca Technologies Inc. All rights reserved. Built for modern clinical operations.
          </p>
          <div className="flex items-center gap-4">
            <span>Privacy Policy</span>
            <span>Terms of Use</span>
            <span>Clinical Guidelines</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
