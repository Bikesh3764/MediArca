import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Activity, LogOut, ShieldCheck, Stethoscope, Menu, X, Calendar, FileText, Building2, Users } from 'lucide-react';

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
    <header className="sticky top-0 z-50 bg-[#000000] text-white border-b border-white/10 select-none">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 h-11 flex items-center justify-between text-[12px] font-normal tracking-tight">
        {/* Brand */}
        <Link to="/" onClick={closeMenu} className="flex items-center gap-2 text-white hover:text-white/80 transition-colors">
          <Activity className="w-4 h-4 text-[#2997ff]" />
          <span className="font-semibold text-[13px] tracking-normal">MediArca</span>
        </Link>

        {/* Center Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-2 text-[#a1a1a6]">
          <Link
            to="/"
            className={`px-3 py-1 rounded-full transition-all text-xs ${
              isActive('/')
                ? 'bg-white/10 text-white font-medium shadow-sm'
                : 'hover:text-white'
            }`}
          >
            Home
          </Link>
          <Link
            to="/doctors"
            className={`px-3 py-1 rounded-full transition-all text-xs ${
              isActive('/doctors')
                ? 'bg-white/10 text-white font-medium shadow-sm'
                : 'hover:text-white'
            }`}
          >
            Find Doctors
          </Link>

          {user?.role === 'PATIENT' && (
            <>
              <Link
                to="/patient/appointments"
                className={`px-3 py-1 rounded-full transition-all text-xs flex items-center gap-1.5 ${
                  isActive('/patient/appointments')
                    ? 'bg-[#2997ff]/20 text-[#2997ff] font-medium border border-[#2997ff]/30 shadow-sm'
                    : 'hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Live Queue & Passes
              </Link>
              <Link
                to="/patient/records"
                className={`px-3 py-1 rounded-full transition-all text-xs flex items-center gap-1.5 ${
                  isActive('/patient/records')
                    ? 'bg-white/10 text-white font-medium shadow-sm'
                    : 'hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Medical Vault
              </Link>
            </>
          )}

          {user?.role === 'DOCTOR' && (
            <>
              <Link
                to="/doctor/dashboard"
                className={`px-3 py-1 rounded-full transition-all text-xs flex items-center gap-1.5 ${
                  isActive('/doctor/dashboard') || location.pathname.startsWith('/doctor/consultation')
                    ? 'bg-[#2997ff]/20 text-[#2997ff] font-medium border border-[#2997ff]/30 shadow-sm'
                    : 'text-[#2997ff] hover:text-white'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                Doctor Console
              </Link>
              <Link
                to="/doctor/schedule"
                className={`px-3 py-1 rounded-full transition-all text-xs ${
                  isActive('/doctor/schedule')
                    ? 'bg-white/10 text-white font-medium shadow-sm'
                    : 'hover:text-white'
                }`}
              >
                Manage Schedule
              </Link>
            </>
          )}

          {user?.role === 'ADMIN' && (
            <Link
              to="/admin"
              className={`px-3 py-1 rounded-full transition-all text-xs flex items-center gap-1.5 ${
                isActive('/admin')
                  ? 'bg-amber-400/20 text-amber-300 font-medium border border-amber-400/30 shadow-sm'
                  : 'text-amber-300 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin Portal
            </Link>
          )}

          {user?.role === 'CLINIC' && (
            <Link
              to="/clinic/dashboard"
              className={`px-3 py-1 rounded-full transition-all text-xs flex items-center gap-1.5 ${
                isActive('/clinic/dashboard')
                  ? 'bg-[#2997ff]/20 text-[#2997ff] font-medium border border-[#2997ff]/30 shadow-sm'
                  : 'text-[#2997ff] hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Clinic Dashboard
            </Link>
          )}

          {user?.role === 'RECEPTIONIST' && (
            <Link
              to="/receptionist/dashboard"
              className={`px-3 py-1 rounded-full transition-all text-xs flex items-center gap-1.5 ${
                isActive('/receptionist/dashboard')
                  ? 'bg-purple-400/20 text-purple-300 font-medium border border-purple-400/30 shadow-sm'
                  : 'text-purple-300 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Reception Desk
            </Link>
          )}
        </nav>

        {/* Desktop User Account / Auth Actions */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#0066cc] to-[#2997ff] flex items-center justify-center text-[11px] font-bold text-white border border-white/20 overflow-hidden shadow-sm">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{getInitials(user.fullName)}</span>
                  )}
                </div>
                <span className="text-xs text-white/95 max-w-[130px] truncate font-medium">
                  {user.fullName}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-[#2997ff] font-semibold border border-white/10">
                  {user.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-[#a1a1a6] hover:text-rose-400 transition-colors p-1 rounded-full hover:bg-white/10"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-[#cccccc] hover:text-white px-2.5 py-1 text-xs transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="bg-[#0066cc] text-white px-3 py-1 rounded-full text-xs hover:bg-[#0071e3] transition-colors"
              >
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex items-center md:hidden gap-2">
          {user && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#2997ff] font-semibold">
              {user.role}
            </span>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-[#cccccc] hover:text-white focus:outline-none rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-down Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#161617]/95 backdrop-blur-2xl border-b border-white/15 px-4 py-4 animate-fadeIn space-y-3 text-sm shadow-2xl">
          {user && (
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0066cc] to-[#2997ff] flex items-center justify-center text-xs font-bold text-white border border-white/20 overflow-hidden shadow-sm">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                ) : (
                  <span>{getInitials(user.fullName)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-white truncate text-sm">{user.fullName}</p>
                <p className="text-[11px] text-[#86868b] truncate">{user.email}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col space-y-1 text-[#cccccc]">
            <Link
              to="/"
              onClick={closeMenu}
              className={`py-2 px-3 rounded-xl transition-colors ${
                isActive('/') ? 'bg-white/15 text-white font-medium' : 'hover:bg-white/5 hover:text-white'
              }`}
            >
              Home
            </Link>
            <Link
              to="/doctors"
              onClick={closeMenu}
              className={`py-2 px-3 rounded-xl transition-colors ${
                isActive('/doctors') ? 'bg-white/15 text-white font-medium' : 'hover:bg-white/5 hover:text-white'
              }`}
            >
              Find Doctors
            </Link>

            {user?.role === 'PATIENT' && (
              <>
                <Link
                  to="/patient/appointments"
                  onClick={closeMenu}
                  className={`py-2 px-3 rounded-xl transition-colors flex items-center gap-2 ${
                    isActive('/patient/appointments')
                      ? 'bg-[#2997ff]/20 text-[#2997ff] font-medium'
                      : 'text-[#2997ff] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Live Queue Passes
                </Link>
                <Link
                  to="/patient/records"
                  onClick={closeMenu}
                  className={`py-2 px-3 rounded-xl transition-colors flex items-center gap-2 ${
                    isActive('/patient/records')
                      ? 'bg-white/15 text-white font-medium'
                      : 'hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Medical Records Vault
                </Link>
              </>
            )}

            {user?.role === 'DOCTOR' && (
              <>
                <Link
                  to="/doctor/dashboard"
                  onClick={closeMenu}
                  className={`py-2 px-3 rounded-xl transition-colors flex items-center gap-2 ${
                    isActive('/doctor/dashboard') || location.pathname.startsWith('/doctor/consultation')
                      ? 'bg-[#2997ff]/20 text-[#2997ff] font-medium'
                      : 'text-[#2997ff] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Stethoscope className="w-4 h-4" />
                  Doctor Console
                </Link>
                <Link
                  to="/doctor/schedule"
                  onClick={closeMenu}
                  className={`py-2 px-3 rounded-xl transition-colors ${
                    isActive('/doctor/schedule')
                      ? 'bg-white/15 text-white font-medium'
                      : 'hover:bg-white/5 hover:text-white'
                  }`}
                >
                  Manage Hours & Slots
                </Link>
              </>
            )}

            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                onClick={closeMenu}
                className={`py-2 px-3 rounded-xl transition-colors flex items-center gap-2 ${
                  isActive('/admin')
                    ? 'bg-amber-400/20 text-amber-300 font-medium'
                    : 'text-amber-300 hover:bg-white/5 hover:text-white'
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
                className={`py-2 px-3 rounded-xl transition-colors flex items-center gap-2 ${
                  isActive('/clinic/dashboard')
                    ? 'bg-[#2997ff]/20 text-[#2997ff] font-medium'
                    : 'text-[#2997ff] hover:bg-white/5 hover:text-white'
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
                className={`py-2 px-3 rounded-xl transition-colors flex items-center gap-2 ${
                  isActive('/receptionist/dashboard')
                    ? 'bg-purple-400/20 text-purple-300 font-medium'
                    : 'text-purple-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                Reception Desk
              </Link>
            )}
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between">
            {user ? (
              <button
                onClick={handleLogout}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-rose-400 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out ({user.fullName.split(' ')[0]})
              </button>
            ) : (
              <div className="flex items-center gap-2 w-full">
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="flex-1 py-2 text-center rounded-xl bg-white/10 text-white font-medium text-xs hover:bg-white/15 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={closeMenu}
                  className="flex-1 py-2 text-center rounded-xl bg-[#0066cc] text-white font-medium text-xs hover:bg-[#0071e3] transition-colors"
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
