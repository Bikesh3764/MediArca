import React from 'react';
import { Check, Activity, Stethoscope, Users, ShieldCheck, Headset } from 'lucide-react';
import heroPhoto from '../../assets/healthcare-hero-bg.webp';
import lobbyPhoto from '../../assets/clinic-lobby-bg.webp';

export type AuthVariant = 'patient' | 'doctor' | 'clinic' | 'receptionist' | 'admin';

const PANELS: Record<
  AuthVariant,
  {
    photo: string;
    eyebrow: string;
    title: string;
    points: string[];
    card: { icon: React.ElementType; label: string; value: string; note: string };
  }
> = {
  patient: {
    photo: heroPhoto,
    eyebrow: 'For patients',
    title: 'Your token, live.',
    points: ['Book in seconds', 'Track your turn live', '₹0 platform fee'],
    card: { icon: Activity, label: 'Now serving', value: '15', note: 'Your token 17 · 2 ahead' },
  },
  doctor: {
    photo: lobbyPhoto,
    eyebrow: 'For doctors',
    title: 'Run a calmer OPD.',
    points: ['Live queue console', 'Call the next patient in one tap', 'Shifts across clinics'],
    card: { icon: Stethoscope, label: 'Next patient', value: '#16', note: 'Arrived · Fee paid' },
  },
  clinic: {
    photo: lobbyPhoto,
    eyebrow: 'For clinics',
    title: 'Your clinic, one queue.',
    points: ['Add doctors and staff', 'Walk-ins at the desk', 'QR check-in on arrival'],
    card: { icon: Users, label: "Today's queue", value: '24', note: '6 walk-ins · 3 doctors' },
  },
  receptionist: {
    photo: lobbyPhoto,
    eyebrow: 'For the front desk',
    title: 'The desk, simplified.',
    points: ['Walk-ins in seconds', 'Confirm fees and tokens', 'Check-ins by QR'],
    card: { icon: Headset, label: 'Waiting to confirm', value: '3', note: 'UPI over call' },
  },
  admin: {
    photo: lobbyPhoto,
    eyebrow: 'Admin',
    title: 'Keep MediArca trusted.',
    points: ['Verify doctors and clinics', 'Platform health', 'Support messages'],
    card: { icon: ShieldCheck, label: 'Verification', value: 'Queue', note: 'Doctors and clinics' },
  },
};

interface AuthShellProps {
  variant: AuthVariant;
  children: React.ReactNode;
}

/** Frame for sign-in and sign-up screens: photo panel with benefits on desktop, form on the right. */
export const AuthShell: React.FC<AuthShellProps> = ({ variant, children }) => {
  const panel = PANELS[variant];
  const CardIcon = panel.card.icon;

  return (
    <div className="relative overflow-clip sm:min-h-[calc(100vh-56px)] bg-gradient-to-b from-[#e9f2fc] via-[#f1f6fc] to-[#f5f5f7]">
      <div className="pointer-events-none absolute -top-40 right-[-8%] w-[560px] h-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(0,102,204,0.12),transparent)]" />
      <div className="pointer-events-none absolute -top-64 left-[-12%] w-[520px] h-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(41,151,255,0.10),transparent)]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-6 sm:pt-12 lg:pt-14 pb-24 sm:pb-14 pb-safe grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,480px)] xl:grid-cols-[1fr_minmax(0,500px)] gap-10 xl:gap-16 items-center">
        {/* Photo panel (desktop only) */}
        <aside className="hidden lg:block relative h-full min-h-[600px] rounded-[32px] overflow-hidden" aria-hidden="true">
          <img src={panel.photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#06325f]/90 via-[#0066cc]/35 to-transparent" />

          <div className="ma-float absolute top-8 right-8 w-[220px] rounded-2xl bg-white/95 backdrop-blur-xl border border-black/[0.06] shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-primary-soft text-primary inline-flex items-center justify-center">
                <CardIcon className="w-4 h-4" />
              </span>
              <span className="text-xs text-[#86868b]">{panel.card.label}</span>
              <span className="ml-auto relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-success-dot opacity-60 animate-ping motion-reduce:animate-none" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-success-dot" />
              </span>
            </div>
            <p className="mt-3 text-[32px] font-semibold tracking-tight text-[#1d1d1f] leading-none">{panel.card.value}</p>
            <p className="mt-1.5 text-xs text-[#6e6e73]">{panel.card.note}</p>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-10 xl:p-12 text-white">
            <p className="text-sm font-semibold text-white/80">{panel.eyebrow}</p>
            <h2 className="mt-2 font-display text-[40px] xl:text-[46px] leading-[1.05] font-semibold tracking-tight">{panel.title}</h2>
            <ul className="mt-6 space-y-2.5">
              {panel.points.map((p) => (
                <li key={p} className="flex items-center gap-3 text-[15px] text-white/95">
                  <span className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-md inline-flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Form column */}
        <div className="w-full flex flex-col items-center">{children}</div>
      </div>
    </div>
  );
};
