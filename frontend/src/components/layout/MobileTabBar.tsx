import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Compass, Ticket, User, LogIn, LayoutDashboard } from 'lucide-react';

export const MobileTabBar: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  // Hide on staff portals and auth terminal pages
  const isPortalRoute =
    location.pathname.startsWith('/doctor') ||
    location.pathname.startsWith('/clinic') ||
    location.pathname.startsWith('/receptionist') ||
    location.pathname.startsWith('/admin');

  if (isPortalRoute) return null;

  const currentPath = location.pathname;

  const isExploreActive = currentPath === '/' || currentPath === '/doctors' || currentPath.startsWith('/book/');
  const isPassesActive = currentPath === '/patient/appointments';
  const isProfileActive = currentPath === '/patient/profile' || currentPath === '/login' || currentPath === '/signup';

  const handleTabClick = (targetPath: string) => {
    if (currentPath === targetPath) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <nav
      aria-label="Mobile navigation bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/85 backdrop-blur-xl backdrop-saturate-150 border-t border-[#e5e5ea] pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 px-4 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] select-none transition-all duration-150"
    >
      <div className="flex items-center justify-around max-w-md mx-auto gap-1">
        {/* Explore / Home */}
        <Link
          to="/"
          onClick={() => handleTabClick('/')}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-150 active:scale-[0.97] ${
            isExploreActive ? 'text-[#0066cc]' : 'text-[#86868b] hover:text-[#1d1d1f]'
          }`}
        >
          <div className={`px-3 py-0.5 rounded-full transition-colors duration-150 ${isExploreActive ? 'bg-[#0066cc]/10' : ''}`}>
            <Compass className={`w-5 h-5 transition-transform duration-150 ${isExploreActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
          </div>
          <span className={`text-[11px] mt-0.5 tracking-[-0.01em] ${isExploreActive ? 'font-semibold text-[#0066cc]' : 'font-medium'}`}>
            Explore
          </span>
        </Link>

        {/* Live Passes / Appointments */}
        <Link
          to={user ? '/patient/appointments' : '/login?redirect=/patient/appointments'}
          onClick={() => handleTabClick('/patient/appointments')}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-150 active:scale-[0.97] ${
            isPassesActive ? 'text-[#0066cc]' : 'text-[#86868b] hover:text-[#1d1d1f]'
          }`}
        >
          <div className={`px-3 py-0.5 rounded-full transition-colors duration-150 ${isPassesActive ? 'bg-[#0066cc]/10' : ''}`}>
            <Ticket className={`w-5 h-5 transition-transform duration-150 ${isPassesActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
          </div>
          <span className={`text-[11px] mt-0.5 tracking-[-0.01em] ${isPassesActive ? 'font-semibold text-[#0066cc]' : 'font-medium'}`}>
            My Passes
          </span>
        </Link>

        {/* Account / Profile / Portal */}
        {user ? (
          user.role === 'PATIENT' ? (
            <Link
              to="/patient/profile"
              onClick={() => handleTabClick('/patient/profile')}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-150 active:scale-[0.97] ${
                isProfileActive ? 'text-[#0066cc]' : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              <div className={`px-3 py-0.5 rounded-full transition-colors duration-150 ${isProfileActive ? 'bg-[#0066cc]/10' : ''}`}>
                <User className={`w-5 h-5 transition-transform duration-150 ${isProfileActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
              </div>
              <span className={`text-[11px] mt-0.5 tracking-[-0.01em] ${isProfileActive ? 'font-semibold text-[#0066cc]' : 'font-medium'}`}>
                Profile
              </span>
            </Link>
          ) : (
            <Link
              to={
                user.role === 'DOCTOR'
                  ? '/doctor/dashboard'
                  : user.role === 'CLINIC'
                  ? '/clinic/dashboard'
                  : user.role === 'RECEPTIONIST'
                  ? '/receptionist/dashboard'
                  : '/admin'
              }
              className="flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[#0066cc] transition-all duration-150 active:scale-[0.97]"
            >
              <div className="px-3 py-0.5 rounded-full bg-[#0066cc]/10">
                <LayoutDashboard className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] mt-0.5 tracking-[-0.01em] font-semibold text-[#0066cc]">
                Console
              </span>
            </Link>
          )
        ) : (
          <Link
            to="/login"
            onClick={() => handleTabClick('/login')}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-150 active:scale-[0.97] ${
              isProfileActive ? 'text-[#0066cc]' : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <div className={`px-3 py-0.5 rounded-full transition-colors duration-150 ${isProfileActive ? 'bg-[#0066cc]/10' : ''}`}>
              <LogIn className={`w-5 h-5 transition-transform duration-150 ${isProfileActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
            </div>
            <span className={`text-[11px] mt-0.5 tracking-[-0.01em] ${isProfileActive ? 'font-semibold text-[#0066cc]' : 'font-medium'}`}>
              Sign In
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
};
