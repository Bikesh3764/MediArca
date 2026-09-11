import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Activity, User as UserIcon, LogOut, ShieldCheck, Stethoscope, Menu, X } from 'lucide-react';

export const GlobalNav: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/login');
  };

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 bg-[#000000] text-white border-b border-white/10 select-none">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 h-11 flex items-center justify-between text-[12px] font-normal tracking-tight">
        {/* Brand */}
        <Link to="/" onClick={closeMenu} className="flex items-center gap-2 text-white hover:text-white/80 transition-colors">
          <Activity className="w-4 h-4 text-[#2997ff]" />
          <span className="font-semibold text-[13px] tracking-normal">MediArca</span>
        </Link>

        {/* Center Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-[#cccccc]">
          <Link to="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <Link to="/doctors" className="hover:text-white transition-colors">
            Find Doctors
          </Link>

          {user?.role === 'PATIENT' && (
            <>
              <Link to="/patient/appointments" className="hover:text-white transition-colors flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2997ff]"></span>
                Live Queue & Passes
              </Link>
              <Link to="/patient/records" className="hover:text-white transition-colors">
                Medical Records
              </Link>
            </>
          )}

          {user?.role === 'DOCTOR' && (
            <>
              <Link to="/doctor/dashboard" className="hover:text-white transition-colors flex items-center gap-1.5 text-[#2997ff]">
                <Stethoscope className="w-3.5 h-3.5" />
                Doctor Console
              </Link>
              <Link to="/doctor/schedule" className="hover:text-white transition-colors">
                Manage Hours & Slots
              </Link>
            </>
          )}

          {user?.role === 'ADMIN' && (
            <Link to="/admin" className="hover:text-white transition-colors flex items-center gap-1.5 text-amber-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin Portal
            </Link>
          )}
        </nav>

        {/* Desktop User Account / Auth Actions */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#272729] flex items-center justify-center text-xs text-[#2997ff] border border-white/15 overflow-hidden">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className="text-xs text-white/90 max-w-[120px] truncate">
                  {user.fullName}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                  {user.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-[#cccccc] hover:text-white transition-colors p-1"
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
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-[#2997ff]">
              {user.role}
            </span>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 text-[#cccccc] hover:text-white focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-down Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#161617]/95 backdrop-blur-2xl border-b border-white/15 px-4 py-4 animate-fadeIn space-y-3 text-sm">
          {user && (
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <div className="w-8 h-8 rounded-full bg-[#272729] flex items-center justify-center text-xs text-[#2997ff] border border-white/15 overflow-hidden">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-white truncate">{user.fullName}</p>
                <p className="text-[11px] text-[#86868b]">{user.email}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col space-y-2 text-[#cccccc]">
            <Link
              to="/"
              onClick={closeMenu}
              className="py-1.5 hover:text-white transition-colors"
            >
              Home
            </Link>
            <Link
              to="/doctors"
              onClick={closeMenu}
              className="py-1.5 hover:text-white transition-colors"
            >
              Find Doctors
            </Link>

            {user?.role === 'PATIENT' && (
              <>
                <Link
                  to="/patient/appointments"
                  onClick={closeMenu}
                  className="py-1.5 text-[#2997ff] font-medium hover:text-white transition-colors flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-[#2997ff]"></span>
                  Live Queue & Passes
                </Link>
                <Link
                  to="/patient/records"
                  onClick={closeMenu}
                  className="py-1.5 hover:text-white transition-colors"
                >
                  Medical Records Vault
                </Link>
              </>
            )}

            {user?.role === 'DOCTOR' && (
              <>
                <Link
                  to="/doctor/dashboard"
                  onClick={closeMenu}
                  className="py-1.5 text-[#2997ff] font-medium hover:text-white transition-colors flex items-center gap-2"
                >
                  <Stethoscope className="w-4 h-4" />
                  Doctor Console
                </Link>
                <Link
                  to="/doctor/schedule"
                  onClick={closeMenu}
                  className="py-1.5 hover:text-white transition-colors"
                >
                  Manage Hours & Slots
                </Link>
              </>
            )}

            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                onClick={closeMenu}
                className="py-1.5 text-amber-300 font-medium hover:text-white transition-colors flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                Admin Portal
              </Link>
            )}
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between">
            {user ? (
              <button
                onClick={handleLogout}
                className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-rose-400 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
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
