import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Search, ArrowLeft, HelpCircle } from 'lucide-react';
import { AppleButton } from '../components/ui/AppleButton';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[82vh] bg-[#f5f5f7] flex items-center justify-center p-4 sm:p-6 lg:p-8 select-none">
      <div className="max-w-[520px] w-full bg-white rounded-[28px] border border-[#e5e5ea] shadow-[0_20px_50px_rgba(0,0,0,0.06),0_2px_10px_rgba(0,0,0,0.02)] p-7 sm:p-10 text-center space-y-6">
        
        {/* Subtle Apple 404 Badge */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0066cc]/10 text-[#0066cc] mx-auto shadow-inner">
          <span className="text-xl font-bold tracking-tight">404</span>
        </div>

        {/* Headline & Description */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight leading-snug">
            Page Not Found
          </h1>
          <p className="text-[14px] text-[#86868b] leading-relaxed max-w-md mx-auto">
            The clinical view, queue pass, or record you requested does not exist or may have been relocated.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <AppleButton
            variant="primary"
            size="md"
            onClick={() => navigate('/')}
            className="w-full sm:w-auto px-6 h-11 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Return Home
          </AppleButton>

          <AppleButton
            variant="secondary"
            size="md"
            onClick={() => navigate('/doctors')}
            className="w-full sm:w-auto px-6 h-11 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            Find Doctors
          </AppleButton>
        </div>

        {/* Helpful Shortcut Links */}
        <div className="pt-6 border-t border-[#f0f0f2] space-y-3">
          <p className="text-xs font-medium text-[#86868b] uppercase tracking-wider">
            Helpful Portals & Assistance
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[#0066cc]">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1 hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Go Back
            </button>
            <span className="text-[#d2d2d7]">•</span>
            <Link to="/patient/appointments" className="hover:underline">
              Live Queue Passes
            </Link>
            <span className="text-[#d2d2d7]">•</span>
            <Link to="/how-it-works" className="hover:underline">
              How Queue Works
            </Link>
            <span className="text-[#d2d2d7]">•</span>
            <Link to="/contact" className="hover:underline inline-flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              Support
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};

export default NotFound;
