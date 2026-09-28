import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../ui/BrandLogo';
import { LogOut, ShieldCheck, Stethoscope, Menu, X, Calendar, FileText, Building2, Users } from 'lucide-react';

export const GlobalNav: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/login');
  };

  const closeMenu = () => setMobileMenuOpen(false);

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    if (path === '/doctors') {
      return (
        location.pathname === '/doctors' ||
        location.pathname.startsWith('/doctors/') ||
        location.pathname === '/patient/doctors' ||
        location.pathname.startsWith('/patient/doctor/') ||
        location.pathname.startsWith('/patient/book/') ||
        (location.pathname.startsWith('/doctor/') &&
          !location.pathname.startsWith('/doctor/dashboard') &&
          !location.pathname.startsWith('/doctor/schedule') &&
          !location.pathname.startsWith('/doctor/consultation')) ||
        location.pathname.startsWith('/book/')
      );
    }
    return location.pathname.startsWith(path);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl backdrop-saturate-150 border-b border-black/[0.06] text-[#1d1d1f] select-none shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 h-14 flex items-center justify-between text-[13px] font-normal tracking-tight">
        {/* Brand */}
        <Link to="/" onClick={closeMenu} className="flex items-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all">
          <BrandLogo variant="full" size="md" theme="light" imgClassName="h-7 w-auto" />
        </Link>

        {/* Center Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-1 text-[#86868b]">
          <Link
            to="/"
            className={`px-3.5 py-1.5 rounded-full transition-all duration-200 text-xs ${
              isActive('/')
                ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20 shadow-2xs'
                : 'hover:text-[#1d1d1f] hover:bg-black/[0.04] font-medium'
            }`}
          >
            Home
          </Link>
          <Link
            to={user?.role === 'PATIENT' ? '/patient/doctors' : '/doctors'}
            className={`px-3.5 py-1.5 rounded-full transition-all duration-200 text-xs ${
              isActive('/doctors')
                ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20 shadow-2xs'
                : 'hover:text-[#1d1d1f] hover:bg-black/[0.04] font-medium'
            }`}
          >
            Find Doctors
          </Link>

          {user?.role === 'PATIENT' && (
            <>
              <Link
                to="/patient/appointments"
                className={`px-3.5 py-1.5 rounded-full transition-all duration-200 text-xs flex items-center gap-1.5 ${
                  isActive('/patient/appointments')
                    ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20 shadow-2xs'
                    : 'text-[#0088e8] hover:bg-[#0088e8]/10 font-medium'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Live Queue & Passes
              </Link>
              <Link
                to="/patient/profile"
                className={`px-3.5 py-1.5 rounded-full transition-all duration-200 text-xs ${
                  isActive('/patient/profile')
                    ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20 shadow-2xs'
                    : 'hover:text-[#1d1d1f] hover:bg-black/[0.04] font-medium'
                }`}
              >
                Profile
              </Link>
            </>
          )}

          {user?.role === 'DOCTOR' && (
            <>
              <Link
                to="/doctor/dashboard"
                className={`px-3.5 py-1.5 rounded-full transition-all duration-200 text-xs flex items-center gap-1.5 ${
                  isActive('/doctor/dashboard')
                    ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20 shadow-2xs'
                    : 'text-[#0088e8] hover:bg-[#0088e8]/10 font-medium'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                Doctor Console
              </Link>
              <Link
                to="/doctor/dashboard?tab=affiliations"
                className={`px-3.5 py-1.5 rounded-full transition-all duration-200 text-xs ${
                  isActive('/doctor/dashboard') && location.search.includes('tab=affiliations')
                    ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20 shadow-2xs'
                    : 'hover:text-[#1d1d1f] hover:bg-black/[0.04] font-medium'
                }`}
              >
                Clinics & Schedule
              </Link>
              <Link
                to="/doctor/profile"
                className={`px-3.5 py-1.5 rounded-full transition-all duration-200 text-xs ${
                  isActive('/doctor/profile')
                    ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20 shadow-2xs'
                    : 'hover:text-[#1d1d1f] hover:bg-black/[0.04] font-medium'
                }`}
              >
                Profile & Settings
              </Link>
            </>
          )}

          {user?.role === 'ADMIN' && (
            <Link
              to="/admin"
              className={`px-3.5 py-1.5 rounded-full transition-all duration-200 text-xs flex items-center gap-1.5 ${
                isActive('/admin')
                  ? 'bg-amber-100/90 text-amber-900 font-semibold border border-amber-300 shadow-2xs'
                  : 'text-amber-800 hover:bg-amber-50 font-medium'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin Portal
            </Link>
          )}

          {user?.role === 'CLINIC' && (
            <Link
              to="/clinic/dashboard"
              className={`px-3.5 py-1.5 rounded-full transition-all duration-200 text-xs flex items-center gap-1.5 ${
                isActive('/clinic/dashboard')
                  ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20 shadow-2xs'
                  : 'text-[#0088e8] hover:bg-[#0088e8]/10 font-medium'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Clinic Dashboard
            </Link>
          )}

          {user?.role === 'RECEPTIONIST' && (
            <Link
              to="/receptionist/dashboard"
              className={`px-3.5 py-1.5 rounded-full transition-all duration-200 text-xs flex items-center gap-1.5 ${
                isActive('/receptionist/dashboard')
                  ? 'bg-teal-100/90 text-teal-900 font-semibold border border-teal-300 shadow-2xs'
                  : 'text-teal-800 hover:bg-teal-50 font-medium'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Reception Desk
            </Link>
          )}
        </nav>

        {/* Desktop User Account / Auth Actions */}
        <div className="hidden md:flex items-center gap-2.5">
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to={
                  user.role === 'PATIENT'
                    ? '/patient/profile'
                    : user.role === 'DOCTOR'
                    ? '/doctor/profile'
                    : user.role === 'CLINIC'
                    ? '/clinic/dashboard'
                    : user.role === 'RECEPTIONIST'
                    ? '/receptionist/dashboard'
                    : '/admin'
                }
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#f5f5f7] hover:bg-[#ebebee] border border-[#e5e5ea] transition-all hover:border-[#d2d2d7]"
                title="Manage Profile & Settings"
              >
                <div className="w-6 h-6 rounded-full bg-[#0088e8] flex items-center justify-center text-[10px] font-bold text-white shadow-2xs overflow-hidden flex-shrink-0">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{getInitials(user.fullName)}</span>
                  )}
                </div>
                <span className="text-xs text-[#1d1d1f] max-w-[120px] truncate font-medium">
                  {user.fullName}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-[#0088e8] font-semibold border border-[#0088e8]/20 shadow-2xs">
                  {user.role}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="text-[#86868b] hover:text-rose-600 transition-colors p-1.5 rounded-full hover:bg-rose-50/80 active:scale-95"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-[#1d1d1f] hover:text-[#0088e8] px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/[0.04] rounded-full"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="bg-gradient-to-r from-[#0088e8] to-[#10b981] hover:from-[#0284c7] hover:to-[#059669] text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-xs hover:shadow active:scale-[0.98] transition-all"
              >
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex items-center md:hidden gap-2">
          {user && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20">
              {user.role}
            </span>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#1d1d1f] hover:text-black focus:outline-none rounded-full hover:bg-black/[0.04] transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-down Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-2xl border-b border-black/[0.06] rounded-b-[24px] px-5 py-5 animate-fadeIn space-y-3.5 text-sm shadow-2xl">
          {user && (
            <div className="flex items-center gap-3 pb-3.5 border-b border-black/[0.06]">
              <div className="w-9 h-9 rounded-full bg-[#0088e8] flex items-center justify-center text-xs font-bold text-white shadow-2xs overflow-hidden flex-shrink-0">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                ) : (
                  <span>{getInitials(user.fullName)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[#1d1d1f] truncate text-sm">{user.fullName}</p>
                <p className="text-[11px] text-[#86868b] truncate">{user.email}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col space-y-1 text-[#48484a]">
            <Link
              to="/"
              onClick={closeMenu}
              className={`py-2 px-3.5 rounded-full transition-colors ${
                isActive('/') ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20' : 'hover:bg-black/[0.04] hover:text-[#1d1d1f] font-medium'
              }`}
            >
              Home
            </Link>
            <Link
              to={user?.role === 'PATIENT' ? '/patient/doctors' : '/doctors'}
              onClick={closeMenu}
              className={`py-2 px-3.5 rounded-full transition-colors ${
                isActive('/doctors') ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20' : 'hover:bg-black/[0.04] hover:text-[#1d1d1f] font-medium'
              }`}
            >
              Find Doctors
            </Link>

            {user?.role === 'PATIENT' && (
              <>
                <Link
                  to="/patient/appointments"
                  onClick={closeMenu}
                  className={`py-2 px-3.5 rounded-full transition-colors flex items-center gap-2 ${
                    isActive('/patient/appointments')
                      ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20'
                      : 'text-[#0088e8] hover:bg-[#0088e8]/5 font-medium'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Live Queue Passes
                </Link>
                <Link
                  to="/patient/profile"
                  onClick={closeMenu}
                  className={`py-2 px-3.5 rounded-full transition-colors flex items-center gap-2 ${
                    isActive('/patient/profile')
                      ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20'
                      : 'hover:bg-black/[0.04] hover:text-[#1d1d1f] font-medium'
                  }`}
                >
                  Profile & Settings
                </Link>
              </>
            )}

            {user?.role === 'DOCTOR' && (
              <>
                <Link
                  to="/doctor/dashboard"
                  onClick={closeMenu}
                  className={`py-2 px-3.5 rounded-full transition-colors flex items-center gap-2 ${
                    isActive('/doctor/dashboard')
                      ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20'
                      : 'text-[#0088e8] hover:bg-[#0088e8]/5 font-medium'
                  }`}
                >
                  <Stethoscope className="w-4 h-4" />
                  Doctor Console
                </Link>
                <Link
                  to="/doctor/dashboard?tab=affiliations"
                  onClick={closeMenu}
                  className={`py-2 px-3.5 rounded-full transition-colors ${
                    isActive('/doctor/dashboard') && location.search.includes('tab=affiliations')
                      ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20'
                      : 'hover:bg-black/[0.04] hover:text-[#1d1d1f] font-medium'
                  }`}
                >
                  Clinics & Schedule
                </Link>
                <Link
                  to="/doctor/profile"
                  onClick={closeMenu}
                  className={`py-2 px-3.5 rounded-full transition-colors ${
                    isActive('/doctor/profile')
                      ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20'
                      : 'hover:bg-black/[0.04] hover:text-[#1d1d1f] font-medium'
                  }`}
                >
                  Doctor Profile
                </Link>
              </>
            )}

            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                onClick={closeMenu}
                className={`py-2 px-3.5 rounded-full transition-colors flex items-center gap-2 ${
                  isActive('/admin')
                    ? 'bg-amber-100/90 text-amber-900 font-semibold border border-amber-300'
                    : 'text-amber-800 hover:bg-amber-50 font-medium'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Admin Portal
              </Link>
            )}

            {user?.role === 'CLINIC' && (
              <Link
                to="/clinic/dashboard"
                onClick={closeMenu}
                className={`py-2 px-3.5 rounded-full transition-colors flex items-center gap-2 ${
                  isActive('/clinic/dashboard')
                    ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20'
                    : 'text-[#0088e8] hover:bg-[#0088e8]/5 font-medium'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Clinic Dashboard
              </Link>
            )}

            {user?.role === 'RECEPTIONIST' && (
              <Link
                to="/receptionist/dashboard"
                onClick={closeMenu}
                className={`py-2 px-3.5 rounded-full transition-colors flex items-center gap-2 ${
                  isActive('/receptionist/dashboard')
                    ? 'bg-teal-100/90 text-teal-900 font-semibold border border-teal-300'
                    : 'text-teal-800 hover:bg-teal-50 font-medium'
                }`}
              >
                <Users className="w-4 h-4" />
                Reception Desk
              </Link>
            )}
          </div>

          <div className="pt-3.5 border-t border-black/[0.06] flex items-center justify-between">
            {user ? (
              <button
                onClick={handleLogout}
                className="w-full py-2.5 rounded-full bg-[#f5f5f7] hover:bg-rose-50 text-rose-600 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out ({user.fullName.split(' ')[0]})
              </button>
            ) : (
              <div className="flex items-center gap-2.5 w-full">
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="flex-1 py-2.5 text-center rounded-full bg-[#f5f5f7] text-[#1d1d1f] font-semibold text-xs hover:bg-[#ebebee] transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={closeMenu}
                  className="flex-1 py-2.5 text-center rounded-full bg-gradient-to-r from-[#0088e8] to-[#10b981] hover:from-[#0284c7] hover:to-[#059669] text-white font-semibold text-xs active:scale-[0.98] transition-all shadow-xs hover:shadow"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
