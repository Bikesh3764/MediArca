import { AvatarImage } from '../ui/AvatarImage';
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../ui/BrandLogo';
import { getFileUrl } from '../../services/api';
import { useVisibilityPolling } from '../../utils/useVisibilityPolling';
import { useNotifications } from '../../context/NotificationContext';
import { NotificationPanel } from '../notifications/NotificationPanel';
import {
  LogOut,
  Menu,
  X,
  Globe,
  ChevronRight,
  Bell,
} from 'lucide-react';

export interface DashboardNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path?: string;
  onClick?: () => void;
  badge?: string | number;
  active?: boolean;
}

export interface DashboardLayoutProps {
  portalType: 'DOCTOR' | 'CLINIC' | 'RECEPTIONIST' | 'PATIENT' | 'ADMIN';
  portalSubtitle?: string;
  navItems: DashboardNavItem[];
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  portalType,
  navItems,
  title,
  subtitle,
  headerAction,
  children,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Lock body scroll when mobile sidebar drawer is open to prevent background scrolling
  React.useEffect(() => {
    if (mobileDrawerOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [mobileDrawerOpen]);

  // Real-time in-app notifications sync via api.getNotifications() consolidated across portals (FUNC-014)
  const { unreadCount, fetchNotifications } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const closeNotifications = React.useCallback(() => setNotificationsOpen(false), []);
  useVisibilityPolling(fetchNotifications, 30000, Boolean(user));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getDisplayName = () => {
    if (!user) return 'User';
    if (user.fullName && user.fullName.trim()) {
      return user.fullName.trim();
    }
    if (user.email) {
      const prefix = user.email.split('@')[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    return 'User';
  };

  const getRoleSubtitle = () => {
    if (portalType === 'DOCTOR') {
      return user?.doctorProfile?.specialty
        ? `${user.doctorProfile.specialty}`
        : 'Doctor';
    }
    if (portalType === 'CLINIC') {
      return user?.clinicProfile?.clinicName
        ? `${user.clinicProfile.clinicName}`
        : 'Clinic';
    }
    if (portalType === 'RECEPTIONIST') {
      return 'Front desk';
    }
    if (portalType === 'ADMIN') {
      return 'Administrator';
    }
    return 'Patient';
  };

  const getPortalLabel = () => {
    switch (portalType) {
      case 'DOCTOR':
        return 'Doctor';
      case 'CLINIC':
        return 'Clinic';
      case 'RECEPTIONIST':
        return 'Front Desk';
      case 'PATIENT':
        return 'Patient';
      case 'ADMIN':
        return 'Admin';
      default:
        return 'MediArca';
    }
  };

  const handleLogout = () => {
    logout();
    if (portalType === 'CLINIC') {
      navigate('/clinic/login');
    } else if (portalType === 'RECEPTIONIST') {
      navigate('/receptionist/login');
    } else if (portalType === 'ADMIN') {
      navigate('/admin-login');
    } else {
      navigate('/login');
    }
  };

  const rawDisplayName = getDisplayName();
  const cleanDoctorName = rawDisplayName.replace(/^Dr\.\s*/i, '').trim();
  const formattedDisplayName =
    portalType === 'DOCTOR'
      ? cleanDoctorName ? `Dr. ${cleanDoctorName}` : 'Dr. Specialist'
      : rawDisplayName;
  const initialLetter = ((portalType === 'DOCTOR' ? cleanDoctorName : rawDisplayName).charAt(0) || 'U').toUpperCase();

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full justify-between bg-white select-none">
      <div className="p-5 space-y-6">
        {/* Brand & Portal Type */}
        <div>
          <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
            <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto" />
          </Link>
          <div className="mt-1 text-xs font-normal text-[#86868b] tracking-tight">
            {getPortalLabel()}
          </div>
        </div>

        {/* User Capsule Card */}
        {(() => {
          const profilePath =
            portalType === 'CLINIC'
              ? '/clinic/profile'
              : portalType === 'DOCTOR'
              ? '/doctor/profile'
              : portalType === 'PATIENT'
              ? '/patient/profile'
              : undefined;

          const capsuleContent = (
            <div className={`bg-[#f5f5f7] border border-[#e5e5ea] rounded-2xl p-3 flex items-center gap-3 transition-colors ${profilePath ? 'hover:bg-[#ebebed] group cursor-pointer' : ''}`}>
              {user?.avatarUrl ? (
                <AvatarImage src={getFileUrl(user.avatarUrl)} name={formattedDisplayName} className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-[#e5e5ea]" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#0066cc] text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                  {initialLetter}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#1d1d1f] truncate leading-tight group-hover:text-[#0066cc] transition-colors">
                  {formattedDisplayName}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-[#86868b] font-normal leading-none truncate max-w-[135px]" title={getRoleSubtitle()}>
                    {getRoleSubtitle()}
                  </span>
                </div>
              </div>
            </div>
          );

          return profilePath ? (
            <Link
              to={profilePath}
              onClick={() => setMobileDrawerOpen(false)}
              className="block"
              title="Profile"
            >
              {capsuleContent}
            </Link>
          ) : (
            capsuleContent
          );
        })()}

        {/* Navigation Section */}
        <div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isItemActive =
                item.active !== undefined
                  ? item.active
                  : item.path
                  ? location.pathname === item.path
                  : false;

              const content = (
                <div
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] transition-all active:scale-[0.99] ${
                    isItemActive
                      ? 'bg-[#0066cc]/10 text-[#0066cc] font-semibold'
                      : 'text-[#1d1d1f] font-normal hover:bg-[#f5f5f7]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        isItemActive ? 'text-[#0066cc]' : 'text-[#86868b]'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.badge !== undefined && (
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                          isItemActive
                            ? 'bg-[#0066cc] text-white'
                            : 'bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>
              );

              if (item.path) {
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={() => {
                      if (item.onClick) item.onClick();
                      setMobileDrawerOpen(false);
                    }}
                    className="block"
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.onClick) item.onClick();
                    setMobileDrawerOpen(false);
                  }}
                  className="w-full text-left cursor-pointer"
                >
                  {content}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Website Link */}
        <div>
          <div className="space-y-1 pt-2 border-t border-[#e5e5ea]">
            <Link
              to="/"
              onClick={() => setMobileDrawerOpen(false)}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-normal text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-[#86868b]" />
                <span>Website</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[#c7c7cc]" />
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Sign Out */}
      <div className="p-4 border-t border-[#e5e5ea]">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13px] font-normal text-[#86868b] hover:text-danger hover:bg-danger-soft/70 transition-all active:scale-[0.98] cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Kolkata',
  });

  const defaultGreeting = `${getGreeting()}, ${
    portalType === 'DOCTOR' ? `Dr. ${cleanDoctorName || getDisplayName()}` : getDisplayName()
  }`;

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col md:flex-row">
      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 border-r border-[#e5e5ea] bg-white z-30">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Top Navigation Bar */}
      <div className="md:hidden sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-[#e5e5ea] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="p-1.5 rounded-full text-[#1d1d1f] hover:bg-[#f5f5f7] active:scale-95 transition-all"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <BrandLogo variant="full" size="sm" imgClassName="h-6 w-auto" />
          </div>
        </div>
        <span className="text-xs font-normal text-[#86868b] px-2.5 py-1 rounded-full bg-[#f5f5f7] border border-[#e5e5ea]">
          {getPortalLabel()}
        </span>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative w-4/5 max-w-xs bg-white h-full  flex flex-col z-10 animate-fadeIn">
            <div className="absolute top-4 right-4 z-20">
              <button aria-label="Close"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 rounded-full text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 md:pl-64 flex flex-col min-w-0">
        {/* Page Top Header with Greeting & Action Slot */}
        <div className="relative overflow-clip bg-gradient-to-r from-[#eaf3fd] via-[#f6f9fe] to-white border-b border-[#e5e5ea] px-4 py-4 sm:px-8 sm:py-6">
          <div className="pointer-events-none absolute -top-32 left-1/3 w-[420px] h-[260px] rounded-full bg-[radial-gradient(closest-side,rgba(0,102,204,0.10),transparent)]" />
          {/* Phones: title and bell share the first row, header buttons get a row of their own */}
          <div className="relative max-w-7xl mx-auto flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-3 sm:gap-2.5">
            <div className="min-w-0 flex-1 sm:mr-1.5">
              <p className="text-xs font-semibold text-primary mb-1">{todayLabel}</p>
              <h1 className="text-[20px] sm:text-[26px] font-semibold tracking-tight text-[#1d1d1f] leading-snug">
                {title || defaultGreeting}
              </h1>
              {subtitle && (
                <p className="text-[13px] text-[#86868b] mt-0.5 font-normal">
                  {subtitle}
                </p>
              )}
            </div>
              {/* Notifications Popover */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((prev) => !prev)}
                  className="relative w-9 h-9 inline-flex items-center justify-center rounded-full bg-white text-[#1d1d1f] hover:bg-[#f5f5f7] border border-[#e5e5ea] transition-all active:scale-[0.98] cursor-pointer"
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0066cc] text-white text-[11px] font-semibold flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && <NotificationPanel onClose={closeNotifications} />}
              </div>

              {headerAction && (
                <div className="w-full sm:w-auto flex items-center gap-2 sm:gap-2.5 flex-wrap">
                  {headerAction}
                </div>
              )}
          </div>
        </div>

        {/* Inner Page View Content */}
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 pb-24 md:pb-8 pb-safe pb-tabbar">
          {children}
        </div>
      </main>
    </div>
  );
};

