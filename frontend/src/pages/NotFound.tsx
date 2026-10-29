import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Search, ArrowLeft, CalendarDays, Ticket, HelpCircle, ChevronRight } from 'lucide-react';

const SHORTCUTS = [
  { to: '/patient/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/track', label: 'Track walk-in', icon: Ticket },
  { to: '/contact', label: 'Support', icon: HelpCircle },
];

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-clip min-h-[82vh] bg-gradient-to-b from-[#e9f2fc] via-[#f1f6fc] to-[#f5f5f7] flex items-center justify-center px-4 py-16 sm:py-24 pb-24 sm:pb-24 pb-safe">
      <div className="pointer-events-none absolute -top-40 right-[-8%] w-[560px] h-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(0,102,204,0.12),transparent)]" />

      <div className="relative w-full max-w-xl text-center">
        <p
          aria-hidden="true"
          className="font-display font-semibold tracking-tighter leading-none text-[120px] sm:text-[180px] bg-gradient-to-b from-[#0066cc] to-[#2997ff]/40 bg-clip-text text-transparent select-none"
        >
          404
        </p>
        <h1 className="mt-2 text-3xl sm:text-[40px] font-semibold tracking-tight text-[#1d1d1f]">Page Not Found</h1>
        <p className="mt-3 text-base sm:text-lg text-[#6e6e73]">This page doesn&rsquo;t exist or has moved.</p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full sm:w-auto h-11 px-6 rounded-full bg-primary hover:bg-primary-hover text-white text-sm inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Home className="w-4 h-4" />
            Return Home
          </button>
          <button
            type="button"
            onClick={() => navigate('/doctors')}
            className="w-full sm:w-auto h-11 px-6 rounded-full bg-white border border-[#d2d2d7] hover:bg-[#fafafc] text-[#1d1d1f] text-sm inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Search className="w-4 h-4 text-primary" />
            Find Doctors
          </button>
        </div>

        <ul className="mt-10 rounded-2xl bg-white/90 backdrop-blur-xl border border-[#e5e5ea] divide-y divide-[#f0f0f2] text-left overflow-hidden">
          {SHORTCUTS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link to={to} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-[#fafafc] transition-colors">
                <span className="w-9 h-9 rounded-full bg-primary-soft text-primary inline-flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <span className="flex-1 text-sm text-[#1d1d1f]">{label}</span>
                <ChevronRight className="w-4 h-4 text-[#c7c7cc] group-hover:text-primary transition-colors" />
              </Link>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-6 inline-flex items-center gap-1.5 py-2 text-sm text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Go back
        </button>
      </div>
    </div>
  );
};

export default NotFound;
