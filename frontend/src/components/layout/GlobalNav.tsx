import { AvatarImage } from '../ui/AvatarImage';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../ui/BrandLogo';
import {
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  Info,
  HelpCircle,
  FileQuestion,
  Mail,
} from 'lucide-react';
import { getFileUrl } from '../../services/api';
import { useVisibilityPolling } from '../../utils/useVisibilityPolling';
import { useNotifications } from '../../context/NotificationContext';
import { NotificationPanel } from '../notifications/NotificationPanel';

export const GlobalNav: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const { unreadCount, fetchNotifications } = useNotifications();

  // Periodic notifications check every 25 seconds only while tab is active/visible (FIX-012)
  useVisibilityPolling(
    fetchNotifications,
    25000,
    Boolean(user)
  );

  useEffect(() => {
    queueMicrotask(() => {
      setMobileMenuOpen(false);
      setNotificationsOpen(false);
      setMoreMenuOpen(false);
    });
  }, [location.pathname]);

  // Lock body scroll when mobile hamburger menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [mobileMenuOpen]);

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
          !location.pathname.startsWith('/doctor/schedule')) ||
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

  const getNavLinkClass = (active: boolean) =>
    `h-9 px-4 rounded-full transition-colors duration-200 text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap ${
      active
        ? 'bg-black/[0.06] text-[#1d1d1f] font-semibold'
        : 'text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.03] font-normal'
    }`;

  const getMobileNavLinkClass = (active: boolean) =>
    `py-2.5 px-3.5 rounded-xl transition-colors flex items-center gap-2 text-xs cursor-pointer ${
      active
        ? 'bg-black/[0.06] text-[#1d1d1f] font-semibold'
        : 'text-[#86868b] hover:bg-black/[0.03] hover:text-[#1d1d1f] font-normal'
    }`;

  const closeNotifications = React.useCallback(() => setNotificationsOpen(false), []);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl backdrop-saturate-150 border-b border-black/[0.06] text-[#1d1d1f] select-none shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 h-14 flex items-center justify-between text-[13px] font-normal tracking-tight">
        {/* Brand */}
        <Link to="/" onClick={closeMenu} className="flex items-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all">
          <BrandLogo variant="full" size="md" theme="light" imgClassName="h-7 w-auto" />
        </Link>

        {/* Center Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-0.5 text-[#86868b]">
          <Link
            to="/"
            className={getNavLinkClass(isActive('/'))}
          >
            Home
          </Link>

          {user?.role !== 'DOCTOR' && (
            <>
              <Link
                to="/doctors"
                className={getNavLinkClass(isActive('/doctors') && !location.search.includes('tab=clinics'))}
              >
                Doctors
              </Link>
              <Link
                to="/doctors?tab=clinics"
                className={getNavLinkClass(isActive('/doctors') && location.search.includes('tab=clinics'))}
              >
                Clinics
              </Link>
            </>
          )}

          {user?.role === 'PATIENT' && (
            <>
              <Link
                to="/patient/appointments"
                className={getNavLinkClass(isActive('/patient/appointments'))}
              >
                Appointments
              </Link>
              <Link
                to="/patient/profile"
                className={getNavLinkClass(isActive('/patient/profile'))}
              >
                Profile
              </Link>
            </>
          )}

          {user?.role === 'DOCTOR' && (
            <>
              <Link
                to="/doctor/dashboard"
                className={getNavLinkClass(isActive('/doctor/dashboard') && !location.search.includes('tab=affiliations'))}
              >
                Queue
              </Link>
              <Link
                to="/doctor/dashboard?tab=affiliations"
                className={getNavLinkClass(isActive('/doctor/dashboard') && location.search.includes('tab=affiliations'))}
              >
                Clinics
              </Link>
              <Link
                to="/doctor/profile"
                className={getNavLinkClass(isActive('/doctor/profile'))}
              >
                Profile
              </Link>
            </>
          )}

          {user?.role === 'ADMIN' && (
            <Link
              to="/admin"
              className={getNavLinkClass(isActive('/admin'))}
            >
              Admin
            </Link>
          )}

          {user?.role === 'CLINIC' && (
            <Link
              to="/clinic/dashboard"
              className={getNavLinkClass(isActive('/clinic/dashboard'))}
            >
              Dashboard
            </Link>
          )}

          {user?.role === 'RECEPTIONIST' && (
            <Link
              to="/receptionist/dashboard"
              className={getNavLinkClass(isActive('/receptionist/dashboard'))}
            >
              Front Desk
            </Link>
          )}

          {/* More Menu Dropdown placed at the side */}
          <div
            className="relative"
            onMouseEnter={() => setMoreMenuOpen(true)}
            onMouseLeave={() => setMoreMenuOpen(false)}
          >
            <button
              type="button"
              onClick={() => setMoreMenuOpen((prev) => !prev)}
              className={getNavLinkClass(
                location.pathname === '/about' ||
                location.pathname === '/how-it-works' ||
                location.pathname === '/faq' ||
                location.pathname === '/contact' ||
                moreMenuOpen
              )}
              aria-expanded={moreMenuOpen}
            >
              <span>More</span>
              <ChevronDown
                className={`w-3.5 h-3.5 opacity-70 transition-transform duration-200 ${
                  moreMenuOpen ? 'rotate-180 opacity-100' : ''
                }`}
              />
            </button>

            {moreMenuOpen && (
              <div className="absolute right-0 top-full pt-1.5 z-50 animate-fadeIn">
                <div className="bg-white/95 backdrop-blur-2xl border border-[#e5e5ea] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] p-2 min-w-[210px] space-y-0.5 text-xs text-left">
                  <Link
                    to="/about"
                    onClick={() => setMoreMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors ${
                      location.pathname === '/about'
                        ? 'bg-black/[0.05] text-[#1d1d1f] font-semibold'
                        : 'text-[#48484a] hover:bg-black/[0.04] hover:text-[#1d1d1f]'
                    }`}
                  >
                    <Info className="w-4 h-4 text-[#86868b]" />
                    <span>About</span>
                  </Link>

                  <Link
                    to="/how-it-works"
                    onClick={() => setMoreMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors ${
                      location.pathname === '/how-it-works'
                        ? 'bg-black/[0.05] text-[#1d1d1f] font-semibold'
                        : 'text-[#48484a] hover:bg-black/[0.04] hover:text-[#1d1d1f]'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4 text-[#86868b]" />
                    <span>How It Works</span>
                  </Link>

                  <Link
                    to="/faq"
                    onClick={() => setMoreMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors ${
                      location.pathname === '/faq'
                        ? 'bg-black/[0.05] text-[#1d1d1f] font-semibold'
                        : 'text-[#48484a] hover:bg-black/[0.04] hover:text-[#1d1d1f]'
                    }`}
                  >
                    <FileQuestion className="w-4 h-4 text-[#86868b]" />
                    <span>FAQ</span>
                  </Link>

                  <Link
                    to="/contact"
                    onClick={() => setMoreMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors ${
                      location.pathname === '/contact'
                        ? 'bg-black/[0.05] text-[#1d1d1f] font-semibold'
                        : 'text-[#48484a] hover:bg-black/[0.04] hover:text-[#1d1d1f]'
                    }`}
                  >
                    <Mail className="w-4 h-4 text-[#86868b]" />
                    <span>Contact</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Desktop User Account / Auth Actions */}
        <div className="hidden md:flex items-center gap-2.5">
          {user ? (
            <div className="flex items-center gap-2">
              {/* Notification Bell Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative w-9 h-9 flex items-center justify-center rounded-full text-[#1d1d1f] hover:bg-black/[0.04] transition-all active:scale-95"
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#0066cc] text-white text-[11px] font-semibold rounded-full flex items-center justify-center shadow-xs border-2 border-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <NotificationPanel onClose={closeNotifications} className="absolute right-0 top-11 w-96" />
                )}
              </div>

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
                className="flex items-center gap-2 h-9 pl-1.5 pr-3.5 rounded-full bg-[#f5f5f7] hover:bg-[#ebebee] border border-[#e5e5ea] transition-all hover:border-[#d2d2d7]"
                title="Profile"
              >
                <div className="w-6 h-6 rounded-full bg-[#0066cc] flex items-center justify-center text-[11px] font-semibold text-white overflow-hidden flex-shrink-0">
                  {user.avatarUrl ? (
                    <AvatarImage src={getFileUrl(user.avatarUrl)} name={user.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{getInitials(user.fullName)}</span>
                  )}
                </div>
                <span className="text-xs text-[#1d1d1f] max-w-[140px] truncate font-normal">
                  {user.fullName}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="text-[#86868b] hover:text-danger transition-colors w-9 h-9 flex items-center justify-center rounded-full hover:bg-danger-soft/80 active:scale-95"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-[#1d1d1f] hover:text-[#0066cc] px-3.5 py-1.5 text-xs font-normal transition-colors hover:bg-black/[0.04] rounded-full"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="bg-[#0066cc] hover:bg-[#0071e3] text-white px-4 py-1.5 rounded-full text-xs font-normal active:scale-95 transition-all"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Toggle & Mobile Bell */}
        <div className="flex items-center md:hidden gap-1.5">
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2.5 text-[#1d1d1f] rounded-full hover:bg-black/[0.04]"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 bg-[#0066cc] text-white text-[11px] font-semibold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <NotificationPanel onClose={closeNotifications} className="fixed left-3 right-3 top-16 max-w-md mx-auto" />
              )}
            </div>
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
        <>
          <div
            className="fixed inset-0 top-14 bg-black/25 backdrop-blur-xs z-40 md:hidden animate-fadeIn"
            onClick={closeMenu}
          />
          <div className="relative z-50 md:hidden bg-white/95 backdrop-blur-2xl border-b border-black/[0.06] rounded-b-2xl px-5 py-5 animate-fadeIn space-y-3.5 text-sm shadow-2xl">
          {user && (
            <div className="flex items-center gap-3 pb-3.5 border-b border-black/[0.06]">
              <div className="w-9 h-9 rounded-full bg-[#0066cc] flex items-center justify-center text-xs font-semibold text-white  overflow-hidden flex-shrink-0">
                {user.avatarUrl ? (
                  <AvatarImage src={getFileUrl(user.avatarUrl)} name={user.fullName} className="w-full h-full object-cover" />
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
              className={getMobileNavLinkClass(isActive('/'))}
            >
              Home
            </Link>

            {user?.role !== 'DOCTOR' && (
              <>
                <Link
                  to="/doctors"
                  onClick={closeMenu}
                  className={getMobileNavLinkClass(isActive('/doctors') && !location.search.includes('tab=clinics'))}
                >
                  Doctors
                </Link>
                <Link
                  to="/doctors?tab=clinics"
                  onClick={closeMenu}
                  className={getMobileNavLinkClass(isActive('/doctors') && location.search.includes('tab=clinics'))}
                >
                  Clinics
                </Link>
              </>
            )}



            {user?.role === 'PATIENT' && (
              <>
                <Link
                  to="/patient/appointments"
                  onClick={closeMenu}
                  className={getMobileNavLinkClass(isActive('/patient/appointments'))}
                >
                  Appointments
                </Link>
                <Link
                  to="/patient/profile"
                  onClick={closeMenu}
                  className={getMobileNavLinkClass(isActive('/patient/profile'))}
                >
                  Profile
                </Link>
              </>
            )}

            {user?.role === 'DOCTOR' && (
              <>
                <Link
                  to="/doctor/dashboard"
                  onClick={closeMenu}
                  className={getMobileNavLinkClass(isActive('/doctor/dashboard') && !location.search.includes('tab=affiliations'))}
                >
                  Queue
                </Link>
                <Link
                  to="/doctor/dashboard?tab=affiliations"
                  onClick={closeMenu}
                  className={getMobileNavLinkClass(isActive('/doctor/dashboard') && location.search.includes('tab=affiliations'))}
                >
                  Clinics
                </Link>
                <Link
                  to="/doctor/profile"
                  onClick={closeMenu}
                  className={getMobileNavLinkClass(isActive('/doctor/profile'))}
                >
                  Profile
                </Link>
              </>
            )}

            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                onClick={closeMenu}
                className={getMobileNavLinkClass(isActive('/admin'))}
              >
                Admin
              </Link>
            )}

            {user?.role === 'CLINIC' && (
              <Link
                to="/clinic/dashboard"
                onClick={closeMenu}
                className={getMobileNavLinkClass(isActive('/clinic/dashboard'))}
              >
                Dashboard
              </Link>
            )}

            {user?.role === 'RECEPTIONIST' && (
              <Link
                to="/receptionist/dashboard"
                onClick={closeMenu}
                className={getMobileNavLinkClass(isActive('/receptionist/dashboard'))}
              >
                Front Desk
              </Link>
            )}

            {/* More / Company Links */}
            <div className="pt-2 mt-2 border-t border-[#f0f0f2] space-y-1">
              <span className="px-3.5 text-xs font-semibold tracking-tight text-[#86868b]">
                More
              </span>
              <Link
                to="/about"
                onClick={closeMenu}
                className={getMobileNavLinkClass(isActive('/about'))}
              >
                About
              </Link>
              <Link
                to="/how-it-works"
                onClick={closeMenu}
                className={getMobileNavLinkClass(isActive('/how-it-works'))}
              >
                How It Works
              </Link>
              <Link
                to="/faq"
                onClick={closeMenu}
                className={getMobileNavLinkClass(isActive('/faq'))}
              >
                FAQ
              </Link>
              <Link
                to="/contact"
                onClick={closeMenu}
                className={getMobileNavLinkClass(isActive('/contact'))}
              >
                Contact
              </Link>
            </div>
          </div>

          <div className="pt-3.5 border-t border-black/[0.06] flex items-center justify-between">
            {user ? (
              <button
                onClick={handleLogout}
                className="w-full py-2.5 rounded-full bg-[#f5f5f7] hover:bg-danger-soft text-danger font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out ({user.fullName.split(' ')[0]})
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2 w-full">
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="py-2.5 text-center rounded-full bg-[#f5f5f7] text-[#1d1d1f] font-semibold text-xs hover:bg-[#ebebee] transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={closeMenu}
                  className="py-2.5 text-center rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white font-normal text-xs active:scale-95 transition-all"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
        </>
      )}
    </header>
  );
};
