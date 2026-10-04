import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../ui/BrandLogo';
import {
  LogOut,
  ShieldCheck,
  Stethoscope,
  Menu,
  X,
  Calendar,
  Building2,
  Users,
  Bell,
  CheckCheck,
  Clock,
  AlertCircle,
  ChevronDown,
  Info,
  HelpCircle,
  FileQuestion,
  Mail,
} from 'lucide-react';
import { api, getFileUrl, AppNotification } from '../../services/api';

const formatNotificationTimeAgo = (dateStr: string): string => {
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return '';
  }
};

export const GlobalNav: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(null);

  const fetchNotifications = React.useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getNotifications();
      if (res && Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
        setUnreadCount(
          typeof res.unreadCount === 'number'
            ? res.unreadCount
            : res.notifications.filter((n) => !n.isRead).length
        );
      }
    } catch {
      // background polling fails gracefully
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => {
        setNotifications([]);
        setUnreadCount(0);
      });
      return;
    }
    queueMicrotask(() => {
      fetchNotifications();
    });
    const interval = setInterval(fetchNotifications, 25000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await api.markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      setMobileMenuOpen(false);
      setNotificationsOpen(false);
      setMoreMenuOpen(false);
    });
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

  const getNavLinkClass = (active: boolean) =>
    `px-3.5 py-1.5 rounded-full transition-all duration-200 text-xs flex items-center gap-1.5 cursor-pointer ${
      active
        ? 'bg-black/[0.06] text-[#1d1d1f] font-semibold'
        : 'text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.03] font-medium'
    }`;

  const getMobileNavLinkClass = (active: boolean) =>
    `py-2.5 px-3.5 rounded-xl transition-colors flex items-center gap-2 text-xs cursor-pointer ${
      active
        ? 'bg-black/[0.06] text-[#1d1d1f] font-semibold'
        : 'text-[#86868b] hover:bg-black/[0.03] hover:text-[#1d1d1f] font-medium'
    }`;

  const renderNotificationDropdown = (isMobile = false) => (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={() => setNotificationsOpen(false)}
      />
      <div
        className={`${
          isMobile
            ? 'fixed left-3 right-3 sm:left-4 sm:right-4 top-14 max-w-sm sm:max-w-md mx-auto'
            : 'absolute right-0 top-11 w-80 sm:w-96'
        } bg-white/95 backdrop-blur-2xl border border-[#e5e5ea] rounded-2xl shadow-2xl z-50 overflow-hidden animate-fadeIn text-left`}
      >
        <div className="px-4 py-3 border-b border-[#f0f0f0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-[#1d1d1f]">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc]">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-[11px] font-medium text-[#0066cc] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck className="w-3 h-3" />
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-[#f5f5f7]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-[#86868b]">
              <Bell className="w-6 h-6 mx-auto mb-2 text-[#d2d2d7]" />
              <p className="text-xs">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notif) => {
              const isExpanded = expandedNotificationId === notif.id;
              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.isRead) handleMarkAsRead(notif.id);
                    setExpandedNotificationId((prev) => (prev === notif.id ? null : notif.id));
                  }}
                  className={`p-3.5 transition-all cursor-pointer flex items-start gap-3 ${
                    notif.isRead ? 'bg-white hover:bg-[#fafafc]' : 'bg-[#0066cc]/[0.04] hover:bg-[#0066cc]/[0.08]'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-white border border-[#e5e5ea] flex-shrink-0 mt-0.5 shadow-2xs">
                    {notif.type === 'APPOINTMENT' && <Calendar className="w-3.5 h-3.5 text-[#0066cc]" />}
                    {notif.type === 'QUEUE' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                    {notif.type === 'CLINICAL' && <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />}
                    {notif.type === 'SYSTEM' && <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />}
                    {!['APPOINTMENT', 'QUEUE', 'CLINICAL', 'SYSTEM'].includes(notif.type) && (
                      <AlertCircle className="w-3.5 h-3.5 text-[#0066cc]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className="text-xs font-semibold text-[#1d1d1f] truncate">
                        {notif.title}
                      </h4>
                      <span className="text-[10px] text-[#86868b] flex-shrink-0">
                        {formatNotificationTimeAgo(notif.createdAt)}
                      </span>
                    </div>

                    {isExpanded ? (
                      <div className="mt-1 space-y-2 animate-fadeIn">
                        <p className="text-xs text-[#1d1d1f] leading-relaxed break-words font-normal">
                          {notif.message}
                        </p>
                        <div className="flex items-center justify-between pt-1 border-t border-[#f0f0f2]">
                          <span className="text-[10px] text-[#86868b]">
                            {new Date(notif.createdAt).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                          {notif.type === 'APPOINTMENT' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNotificationsOpen(false);
                                if (user?.role === 'PATIENT') navigate('/patient/appointments');
                                else if (user?.role === 'DOCTOR') navigate('/doctor/dashboard');
                                else if (user?.role === 'RECEPTIONIST') navigate('/receptionist/dashboard');
                              }}
                              className="text-[11px] font-semibold text-[#0066cc] hover:underline cursor-pointer"
                            >
                              Go to Passes →
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#86868b] leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>
                    )}
                  </div>
                  {!notif.isRead && (
                    <span className="w-2 h-2 rounded-full bg-[#0066cc] flex-shrink-0 mt-2" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );

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
            className={getNavLinkClass(isActive('/'))}
          >
            Home
          </Link>

          <Link
            to="/doctors"
            className={getNavLinkClass(isActive('/doctors'))}
          >
            Find Doctors
          </Link>

          {user?.role === 'PATIENT' && (
            <>
              <Link
                to="/patient/appointments"
                className={getNavLinkClass(isActive('/patient/appointments'))}
              >
                <Calendar className="w-3.5 h-3.5 text-current opacity-80" />
                Live Queue & Passes
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
                <Stethoscope className="w-3.5 h-3.5 text-current opacity-80" />
                Doctor Console
              </Link>
              <Link
                to="/doctor/dashboard?tab=affiliations"
                className={getNavLinkClass(isActive('/doctor/dashboard') && location.search.includes('tab=affiliations'))}
              >
                Clinics & Schedule
              </Link>
              <Link
                to="/doctor/profile"
                className={getNavLinkClass(isActive('/doctor/profile'))}
              >
                Profile & Settings
              </Link>
            </>
          )}

          {user?.role === 'ADMIN' && (
            <Link
              to="/admin"
              className={getNavLinkClass(isActive('/admin'))}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-current opacity-80" />
              Admin Portal
            </Link>
          )}

          {user?.role === 'CLINIC' && (
            <Link
              to="/clinic/dashboard"
              className={getNavLinkClass(isActive('/clinic/dashboard'))}
            >
              <Building2 className="w-3.5 h-3.5 text-current opacity-80" />
              Clinic Dashboard
            </Link>
          )}

          {user?.role === 'RECEPTIONIST' && (
            <Link
              to="/receptionist/dashboard"
              className={getNavLinkClass(isActive('/receptionist/dashboard'))}
            >
              <Users className="w-3.5 h-3.5 text-current opacity-80" />
              Reception Desk
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
                <div className="bg-white/95 backdrop-blur-2xl border border-[#e5e5ea] rounded-[20px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] p-2 min-w-[210px] space-y-0.5 text-xs text-left">
                  <Link
                    to="/about"
                    onClick={() => setMoreMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[14px] transition-colors ${
                      location.pathname === '/about'
                        ? 'bg-black/[0.05] text-[#1d1d1f] font-semibold'
                        : 'text-[#48484a] hover:bg-black/[0.04] hover:text-[#1d1d1f]'
                    }`}
                  >
                    <Info className="w-4 h-4 text-[#86868b]" />
                    <span>About MediArca</span>
                  </Link>

                  <Link
                    to="/how-it-works"
                    onClick={() => setMoreMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[14px] transition-colors ${
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
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[14px] transition-colors ${
                      location.pathname === '/faq'
                        ? 'bg-black/[0.05] text-[#1d1d1f] font-semibold'
                        : 'text-[#48484a] hover:bg-black/[0.04] hover:text-[#1d1d1f]'
                    }`}
                  >
                    <FileQuestion className="w-4 h-4 text-[#86868b]" />
                    <span>FAQs & Help</span>
                  </Link>

                  <Link
                    to="/contact"
                    onClick={() => setMoreMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[14px] transition-colors ${
                      location.pathname === '/contact'
                        ? 'bg-black/[0.05] text-[#1d1d1f] font-semibold'
                        : 'text-[#48484a] hover:bg-black/[0.04] hover:text-[#1d1d1f]'
                    }`}
                  >
                    <Mail className="w-4 h-4 text-[#86868b]" />
                    <span>Contact Support</span>
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
                  className="relative p-2 rounded-full text-[#1d1d1f] hover:bg-black/[0.04] transition-all active:scale-95"
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#0066cc] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs border-2 border-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && renderNotificationDropdown(false)}
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
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#f5f5f7] hover:bg-[#ebebee] border border-[#e5e5ea] transition-all hover:border-[#d2d2d7]"
                title="Manage Profile & Settings"
              >
                <div className="w-6 h-6 rounded-full bg-[#0066cc] flex items-center justify-center text-[10px] font-bold text-white overflow-hidden flex-shrink-0">
                  {user.avatarUrl ? (
                    <img src={getFileUrl(user.avatarUrl)} alt={user.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{getInitials(user.fullName)}</span>
                  )}
                </div>
                <span className="text-xs text-[#1d1d1f] max-w-[120px] truncate font-medium">
                  {user.fullName}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-[#1d1d1f] font-medium border border-black/[0.06]">
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
                className="text-[#1d1d1f] hover:text-[#0066cc] px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/[0.04] rounded-full"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="bg-[#0066cc] hover:bg-[#0071e3] text-white px-4 py-1.5 rounded-full text-xs font-medium active:scale-95 transition-all"
              >
                Register
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
                className="relative p-1.5 text-[#1d1d1f] rounded-full hover:bg-black/[0.04]"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 bg-[#0066cc] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && renderNotificationDropdown(true)}
            </div>
          )}
          {user && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0088e8]/10 text-[#0088e8] font-semibold border border-[#0088e8]/20 hidden sm:inline-flex">
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
                  <img src={getFileUrl(user.avatarUrl)} alt={user.fullName} className="w-full h-full object-cover" />
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

            <Link
              to="/doctors"
              onClick={closeMenu}
              className={getMobileNavLinkClass(isActive('/doctors'))}
            >
              Find Doctors
            </Link>



            {user?.role === 'PATIENT' && (
              <>
                <Link
                  to="/patient/appointments"
                  onClick={closeMenu}
                  className={getMobileNavLinkClass(isActive('/patient/appointments'))}
                >
                  <Calendar className="w-4 h-4 text-current opacity-80" />
                  Live Queue Passes
                </Link>
                <Link
                  to="/patient/profile"
                  onClick={closeMenu}
                  className={getMobileNavLinkClass(isActive('/patient/profile'))}
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
                  className={getMobileNavLinkClass(isActive('/doctor/dashboard') && !location.search.includes('tab=affiliations'))}
                >
                  <Stethoscope className="w-4 h-4 text-current opacity-80" />
                  Doctor Console
                </Link>
                <Link
                  to="/doctor/dashboard?tab=affiliations"
                  onClick={closeMenu}
                  className={getMobileNavLinkClass(isActive('/doctor/dashboard') && location.search.includes('tab=affiliations'))}
                >
                  Clinics & Schedule
                </Link>
                <Link
                  to="/doctor/profile"
                  onClick={closeMenu}
                  className={getMobileNavLinkClass(isActive('/doctor/profile'))}
                >
                  Doctor Profile
                </Link>
              </>
            )}

            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                onClick={closeMenu}
                className={getMobileNavLinkClass(isActive('/admin'))}
              >
                <ShieldCheck className="w-4 h-4 text-current opacity-80" />
                Admin Portal
              </Link>
            )}

            {user?.role === 'CLINIC' && (
              <Link
                to="/clinic/dashboard"
                onClick={closeMenu}
                className={getMobileNavLinkClass(isActive('/clinic/dashboard'))}
              >
                <Building2 className="w-4 h-4 text-current opacity-80" />
                Clinic Dashboard
              </Link>
            )}

            {user?.role === 'RECEPTIONIST' && (
              <Link
                to="/receptionist/dashboard"
                onClick={closeMenu}
                className={getMobileNavLinkClass(isActive('/receptionist/dashboard'))}
              >
                <Users className="w-4 h-4 text-current opacity-80" />
                Reception Desk
              </Link>
            )}

            {/* More / Company Links */}
            <div className="pt-2 mt-2 border-t border-[#f0f0f2] space-y-1">
              <span className="px-3.5 text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">
                More
              </span>
              <Link
                to="/about"
                onClick={closeMenu}
                className={getMobileNavLinkClass(isActive('/about'))}
              >
                <Info className="w-4 h-4 text-current opacity-80" />
                About MediArca
              </Link>
              <Link
                to="/how-it-works"
                onClick={closeMenu}
                className={getMobileNavLinkClass(isActive('/how-it-works'))}
              >
                <HelpCircle className="w-4 h-4 text-current opacity-80" />
                How It Works
              </Link>
              <Link
                to="/faq"
                onClick={closeMenu}
                className={getMobileNavLinkClass(isActive('/faq'))}
              >
                <FileQuestion className="w-4 h-4 text-current opacity-80" />
                FAQs & Help
              </Link>
              <Link
                to="/contact"
                onClick={closeMenu}
                className={getMobileNavLinkClass(isActive('/contact'))}
              >
                <Mail className="w-4 h-4 text-current opacity-80" />
                Contact Support
              </Link>
            </div>
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
                  className="py-2.5 text-center rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white font-medium text-xs active:scale-95 transition-all"
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
