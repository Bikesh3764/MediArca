import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Shield, Clock, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#f5f5f7] border-t border-[#e0e0e0] text-[#7a7a7a] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-10">
        {/* Core Value Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[#e0e0e0]">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-white border border-[#e0e0e0] text-[#0066cc]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-[14px] font-semibold text-[#1d1d1f]">Live Queue Tokens</h4>
              <p className="text-[12px] leading-relaxed mt-1 text-[#7a7a7a]">
                Never wait aimlessly. Track doctor checking hours and your exact queue position in real-time.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-white border border-[#e0e0e0] text-[#0066cc]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-[14px] font-semibold text-[#1d1d1f]">Verified Practitioners</h4>
              <p className="text-[12px] leading-relaxed mt-1 text-[#7a7a7a]">
                Every healthcare provider is verified by platform administrators before accepting appointments.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-white border border-[#e0e0e0] text-[#0066cc]">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-[14px] font-semibold text-[#1d1d1f]">Digital Prescriptions</h4>
              <p className="text-[12px] leading-relaxed mt-1 text-[#7a7a7a]">
                Instant digital prescriptions, dosage guidelines, and medical reports stored safely in your vault.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-white border border-[#e0e0e0] text-[#0066cc]">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-[14px] font-semibold text-[#1d1d1f]">Zero Booking Friction</h4>
              <p className="text-[12px] leading-relaxed mt-1 text-[#7a7a7a]">
                Direct booking without upfront paywalls or forced multi-field medical forms during signup.
              </p>
            </div>
          </div>
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
              <li><Link to="/doctor/schedule" className="hover:text-[#1d1d1f]">Manage Hours</Link></li>
            </ul>
          </div>

          <div>
            <span className="font-semibold text-[#1d1d1f] block mb-2">Platform</span>
            <ul className="space-y-1.5">
              <li><Link to="/admin" className="hover:text-[#1d1d1f]">Admin Oversight</Link></li>
              <li><a href="http://localhost:5000/api/health" target="_blank" rel="noreferrer" className="hover:text-[#1d1d1f]">API Health Status</a></li>
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
