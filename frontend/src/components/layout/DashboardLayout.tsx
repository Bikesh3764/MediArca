import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Activity,
  LogOut,
  Menu,
  X,
  Globe,
  Stethoscope,
  ChevronRight,
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
  portalType: 'DOCTOR' | 'CLINIC' | 'RECEPTIONIST' | 'PATIENT';
  portalSubtitle?: string;
  navItems: DashboardNavItem[];
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  portalType,
  portalSubtitle,
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

  // Time of day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Format user display name without showing raw email
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
        : 'Medical Specialist';
    }
    if (portalType === 'CLINIC') {
      return user?.clinicProfile?.clinicName
        ? `${user.clinicProfile.clinicName}`
        : 'Clinic Administrator';
    }
    if (portalType === 'RECEPTIONIST') {
      return 'Desk Staff Member';
    }
    return 'Verified Patient';
  };

  const getPortalLabel = () => {
    if (portalSubtitle) return portalSubtitle;
    switch (portalType) {
      case 'DOCTOR':
        return 'DOCTOR PORTAL';
      case 'CLINIC':
        return 'CLINIC PORTAL';
      case 'RECEPTIONIST':
        return 'RECEPTION DESK';
      case 'PATIENT':
        return 'PATIENT PORTAL';
      default:
        return 'HEALTH PORTAL';
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initialLetter = (getDisplayName().charAt(0) || 'U').toUpperCase();

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full justify-between bg-white select-none">
      <div className="p-5 space-y-6">
        {/* Brand & Portal Type */}
        <div>
          <Link to="/" className="flex items-center gap-2 text-[#1d1d1f] hover:opacity-85 transition-opacity">
            <div className="w-7 h-7 rounded-xl bg-[#0066cc] flex items-center justify-center text-white shadow-sm">
              <Activity className="w-4 h-4" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-[#1d1d1f]">MediArca</span>
          </Link>
          <div className="mt-1 text-[10px] font-bold tracking-widest text-[#86868b] uppercase pl-9">
            {getPortalLabel()}
          </div>
        </div>

        {/* User Capsule Card (Matches media_1789160523622.jpg without active dot) */}
        <div className="bg-[#f0f9ff]/70 border border-[#e0f2fe] rounded-2xl p-3 flex items-center gap-3 transition-all hover:bg-[#f0f9ff]">
          <div className="w-9 h-9 rounded-xl bg-[#0066cc] text-white flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0">
            {initialLetter}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#1d1d1f] truncate leading-tight">
              {getDisplayName()}
            </p>
            <p className="text-[11px] text-[#0066cc] truncate font-medium mt-0.5">
              {getRoleSubtitle()}
            </p>
          </div>
        </div>

        {/* NAVIGATION Section */}
        <div>
          <p className="text-[10px] font-bold text-[#86868b] tracking-wider uppercase mb-2 px-3">
            Navigation
          </p>
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
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isItemActive
                      ? 'bg-[#0066cc]/10 text-[#0066cc] font-semibold'
                      : 'text-[#48484a] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]'
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
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          isItemActive
                            ? 'bg-[#0066cc] text-white'
                            : 'bg-[#e5e5ea] text-[#48484a]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {isItemActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#0066cc]" />
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
                  className="w-full text-left"
                >
                  {content}
                </button>
              );
            })}
          </nav>
        </div>

        {/* QUICK LINKS Section */}
        <div>
          <p className="text-[10px] font-bold text-[#86868b] tracking-wider uppercase mb-2 px-3">
            Quick Links
          </p>
          <div className="space-y-1">
            <Link
              to="/"
              onClick={() => setMobileDrawerOpen(false)}
              className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs text-[#48484a] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-all"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-[#86868b]" />
                <span>Main Website</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[#c7c7cc]" />
            </Link>
            <Link
              to="/doctors"
              onClick={() => setMobileDrawerOpen(false)}
              className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs text-[#48484a] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-all"
            >
              <div className="flex items-center gap-3">
                <Stethoscope className="w-4 h-4 text-[#86868b]" />
                <span>Find Doctors</span>
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
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-[#48484a] hover:text-rose-600 hover:bg-rose-50/70 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  const defaultGreeting = `${getGreeting()}, ${
    portalType === 'DOCTOR' ? `Dr. ${getDisplayName()}` : getDisplayName()
  }`;

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col md:flex-row">
      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 border-r border-[#e5e5ea] bg-white z-30 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Top Navigation Bar */}
      <div className="md:hidden sticky top-0 z-40 bg-white border-b border-[#e5e5ea] px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="p-1.5 rounded-lg text-[#1d1d1f] hover:bg-[#f5f5f7]"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#0066cc] text-white flex items-center justify-center">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-sm tracking-tight">MediArca</span>
          </div>
        </div>
        <span className="text-[10px] font-bold text-[#86868b] tracking-wider uppercase px-2 py-0.5 rounded-md bg-[#f5f5f7]">
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
          <div className="relative w-4/5 max-w-xs bg-white h-full shadow-2xl flex flex-col z-10 animate-fadeIn">
            <div className="absolute top-4 right-4 z-20">
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1 rounded-lg text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]"
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
        <div className="bg-white border-b border-[#e5e5ea] px-6 py-5 sm:px-8 sm:py-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
                {title || defaultGreeting}
              </h1>
              {subtitle && (
                <p className="text-xs text-[#86868b] mt-1 font-normal">
                  {subtitle}
                </p>
              )}
            </div>
            {headerAction && (
              <div className="flex items-center gap-2.5 flex-wrap">
                {headerAction}
              </div>
            )}
          </div>
        </div>

        {/* Inner Page View Content */}
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
};
