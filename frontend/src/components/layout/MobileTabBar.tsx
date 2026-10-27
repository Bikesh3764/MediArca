import React from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Compass,
  Ticket,
  User,
  LogIn,
  Users,
  Building2,
  Clock,
  UserCheck,
  CalendarCheck,
  UserPlus,
  ShieldCheck,
  Stethoscope,
  Mail,
} from 'lucide-react';

export const MobileTabBar: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const currentPath = location.pathname;
  const tabParam = searchParams.get('tab');

  // Hide on kiosk check-in and isolated staff login screens
  const isKioskRoute = currentPath.startsWith('/checkin');
  const isIsolatedLogin =
    currentPath === '/clinic/login' ||
    currentPath === '/receptionist/login' ||
    currentPath === '/admin-login';

  if (isKioskRoute || isIsolatedLogin) return null;

  const handleTabClick = (targetPath: string) => {
    const [targetBase, targetQuery] = targetPath.split('?');
    const isTargetSame =
      currentPath === targetBase &&
      (targetQuery ? location.search === `?${targetQuery}` : !location.search);

    if (isTargetSame) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderTab = (
    to: string,
    label: string,
    Icon: React.ElementType,
    isActive: boolean
  ) => (
    <Link
      key={to + label}
      to={to}
      onClick={() => handleTabClick(to)}
      className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-150 active:scale-[0.93] select-none cursor-pointer ${
        isActive ? 'text-[#0066cc]' : 'text-[#86868b] hover:text-[#1d1d1f]'
      }`}
    >
      <div className="relative flex items-center justify-center">
        <Icon
          className={`w-5 h-5 transition-transform duration-150 ${
            isActive ? 'scale-110 stroke-[2.3]' : 'stroke-[1.8]'
          }`}
        />
      </div>
      <span
        className={`text-[11px] mt-0.5 tracking-tight truncate max-w-full font-normal ${
          isActive ? 'font-semibold text-[#0066cc]' : ''
        }`}
      >
        {label}
      </span>
    </Link>
  );

  const role = user?.role?.toUpperCase();

  // 1. DOCTOR PORTAL BOTTOM BAR
  if (role === 'DOCTOR') {
    const isQueueActive =
      currentPath === '/doctor/dashboard' && (!tabParam || tabParam === 'queue');
    const isClinicsActive =
      currentPath === '/doctor/dashboard' && tabParam === 'affiliations';
    const isScheduleActive = currentPath.startsWith('/doctor/schedule');
    const isProfileActive = currentPath.startsWith('/doctor/profile');

    return (
      <nav
        aria-label="Doctor navigation bar"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/92 backdrop-blur-xl border-t border-[#e5e5ea] pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 px-2 shadow-[0_-2px_12px_rgba(0,0,0,0.03)] select-none transition-all duration-200"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {renderTab('/doctor/dashboard', 'Queue', Users, isQueueActive)}
          {renderTab('/doctor/dashboard?tab=affiliations', 'Clinics', Building2, isClinicsActive)}
          {renderTab('/doctor/schedule', 'Shifts', Clock, isScheduleActive)}
          {renderTab('/doctor/profile', 'Profile', User, isProfileActive)}
        </div>
      </nav>
    );
  }

  // 2. CLINIC PORTAL BOTTOM BAR
  if (role === 'CLINIC') {
    const isDoctorsActive =
      currentPath.startsWith('/clinic') && (!tabParam || tabParam === 'doctors');
    const isStaffActive =
      currentPath.startsWith('/clinic') && tabParam === 'receptionists';
    const isBookingsActive =
      currentPath.startsWith('/clinic') && tabParam === 'appointments';

    return (
      <nav
        aria-label="Clinic navigation bar"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/92 backdrop-blur-xl border-t border-[#e5e5ea] pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 px-2 shadow-[0_-2px_12px_rgba(0,0,0,0.03)] select-none transition-all duration-200"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {renderTab('/clinic/dashboard?tab=doctors', 'Doctors', Users, isDoctorsActive)}
          {renderTab('/clinic/dashboard?tab=receptionists', 'Staff', UserCheck, isStaffActive)}
          {renderTab('/clinic/dashboard?tab=appointments', 'Bookings', CalendarCheck, isBookingsActive)}
        </div>
      </nav>
    );
  }

  // 3. RECEPTIONIST PORTAL BOTTOM BAR
  if (role === 'RECEPTIONIST') {
    const isQueueActive =
      currentPath.startsWith('/receptionist') && (!tabParam || tabParam === 'queue');
    const isWalkinActive =
      currentPath.startsWith('/receptionist') && tabParam === 'walkin';
    const isPendingActive =
      currentPath.startsWith('/receptionist') && tabParam === 'pending';
    const isDoctorsActive =
      currentPath.startsWith('/receptionist') && tabParam === 'doctors';

    return (
      <nav
        aria-label="Receptionist navigation bar"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/92 backdrop-blur-xl border-t border-[#e5e5ea] pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 px-2 shadow-[0_-2px_12px_rgba(0,0,0,0.03)] select-none transition-all duration-200"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {renderTab('/receptionist/dashboard?tab=queue', 'Queue', Clock, isQueueActive)}
          {renderTab('/receptionist/dashboard?tab=walkin', 'Walk-in', UserPlus, isWalkinActive)}
          {renderTab('/receptionist/dashboard?tab=pending', 'Pending', ShieldCheck, isPendingActive)}
          {renderTab('/receptionist/dashboard?tab=doctors', 'Doctors', Stethoscope, isDoctorsActive)}
        </div>
      </nav>
    );
  }

  // 4. ADMIN PORTAL BOTTOM BAR
  if (role === 'ADMIN') {
    const isDoctorsActive =
      currentPath.startsWith('/admin') && (!tabParam || tabParam === 'doctors');
    const isClinicsActive =
      currentPath.startsWith('/admin') && tabParam === 'clinics';
    const isAppointmentsActive =
      currentPath.startsWith('/admin') && tabParam === 'appointments';
    const isMessagesActive =
      currentPath.startsWith('/admin') && tabParam === 'messages';

    return (
      <nav
        aria-label="Admin navigation bar"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/92 backdrop-blur-xl border-t border-[#e5e5ea] pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 px-2 shadow-[0_-2px_12px_rgba(0,0,0,0.03)] select-none transition-all duration-200"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {renderTab('/admin?tab=doctors', 'Doctors', Stethoscope, isDoctorsActive)}
          {renderTab('/admin?tab=clinics', 'Clinics', Building2, isClinicsActive)}
          {renderTab('/admin?tab=appointments', 'Bookings', CalendarCheck, isAppointmentsActive)}
          {renderTab('/admin?tab=messages', 'Messages', Mail, isMessagesActive)}
        </div>
      </nav>
    );
  }

  // 5. PATIENT & PUBLIC VISITOR BOTTOM BAR (default)
  const isExploreActive =
    currentPath === '/' || currentPath === '/doctors' || currentPath.startsWith('/book/');
  const isPassesActive = currentPath === '/patient/appointments';
  const isProfileActive =
    currentPath === '/patient/profile' || currentPath === '/login' || currentPath === '/signup';

  return (
    <nav
      aria-label="Mobile navigation bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/92 backdrop-blur-xl border-t border-[#e5e5ea] pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 px-3 shadow-[0_-2px_12px_rgba(0,0,0,0.03)] select-none transition-all duration-200"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Explore / Home */}
        {renderTab('/', 'Explore', Compass, isExploreActive)}

        {/* Live Passes / Appointments */}
        {renderTab(
          user ? '/patient/appointments' : '/login?redirect=/patient/appointments',
          'Appointments',
          Ticket,
          isPassesActive
        )}

        {/* Profile / Sign In */}
        {user ? (
          renderTab('/patient/profile', 'Profile', User, isProfileActive)
        ) : (
          renderTab('/login', 'Sign In', LogIn, isProfileActive)
        )}
      </div>
    </nav>
  );
};
