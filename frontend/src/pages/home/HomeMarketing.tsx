import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, QrCode } from 'lucide-react';
import lobbyPhoto from '../../assets/clinic-lobby-bg.webp';

/* Small pictures for each step (decorative). */
// Doctors work in shifts (no fixed time slots); the patient gets a token and an estimated time.
export const ShiftVisual: React.FC = () => (
  <div className="w-full max-w-[260px]">
    <div className="grid grid-cols-2 gap-2">
      {[
        { name: 'Morning', time: '9 AM – 1 PM', on: true },
        { name: 'Evening', time: '5 PM – 9 PM', on: false },
      ].map((s) => (
        <div
          key={s.name}
          className={`rounded-xl px-3 py-2.5 bg-white border ${s.on ? 'border-primary ring-4 ring-primary/10' : 'border-[#e5e5ea]'}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1d1d1f]">{s.name}</span>
            {s.on && (
              <span className="w-4 h-4 rounded-full bg-primary text-white inline-flex items-center justify-center">
                <Check className="w-2.5 h-2.5" />
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-primary">{s.time}</p>
        </div>
      ))}
    </div>
    <div className="mt-3 flex items-center justify-between rounded-xl bg-white border border-[#e5e5ea] px-3 py-2">
      <span className="text-xs text-[#86868b]">Your token</span>
      <span className="text-xs text-[#1d1d1f]">
        <span className="font-semibold">#17</span> · ~11:40 AM
      </span>
    </div>
  </div>
);

export const QueueVisual: React.FC = () => (
  <div className="w-full max-w-[240px]">
    <div className="flex items-center justify-between">
      {[14, 15, 16, 17].map((n) => (
        <span
          key={n}
          className={`w-11 h-11 rounded-full inline-flex items-center justify-center text-sm font-semibold ${
            n === 15
              ? 'bg-primary text-white'
              : n === 17
                ? 'bg-white text-primary border-2 border-primary'
                : n < 15
                  ? 'bg-[#e5e5ea] text-[#86868b]'
                  : 'bg-white text-[#1d1d1f] border border-[#e5e5ea]'
          }`}
        >
          {n}
        </span>
      ))}
    </div>
    <div className="mt-4 h-1.5 rounded-full bg-white overflow-hidden">
      <div className="h-full w-[45%] rounded-full bg-primary" />
    </div>
    <div className="mt-2 flex justify-between text-xs">
      <span className="text-primary">Now 15</span>
      <span className="text-[#86868b]">You 17</span>
    </div>
  </div>
);

export const ScanVisual: React.FC = () => (
  <div className="flex items-center gap-4">
    <span className="relative w-[72px] h-[72px] rounded-2xl bg-white border border-[#e5e5ea] inline-flex items-center justify-center overflow-hidden">
      <QrCode className="w-9 h-9 text-[#1d1d1f]" />
      <span className="ma-scan absolute left-2 right-2 h-0.5 rounded-full bg-primary" />
    </span>
    <span className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-success-soft text-success text-xs font-semibold">
      <Check className="w-3.5 h-3.5" />
      Checked in
    </span>
  </div>
);

const STEPS = [
  { title: 'Book a token', text: 'Pick a doctor and shift. Pay the receptionist by UPI or at the desk.', visual: ShiftVisual },
  { title: 'Track it live', text: 'See how many are ahead and leave home on time.', visual: QueueVisual },
  { title: 'Scan and walk in', text: 'Scan the clinic QR when you arrive. Go in on your turn.', visual: ScanVisual },
];

/** Three-step explainer. */
export const HowItWorksSection: React.FC = () => (
  <section className="bg-white border-t border-[#e5e5ea]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-24">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-sm font-semibold text-primary">How it works</p>
        <h2 className="mt-2 text-3xl sm:text-[44px] font-semibold tracking-tight leading-tight text-[#1d1d1f]">
          Wait at home, not in the clinic.
        </h2>
      </div>

      <ol className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {STEPS.map(({ title, text, visual: Visual }, i) => (
          <li key={title} className="rounded-2xl border border-[#e5e5ea] overflow-hidden flex flex-col">
            <div className="h-44 bg-gradient-to-b from-[#f5f5f7] to-[#eef3fa] flex items-center justify-center px-6">
              <Visual />
            </div>
            <div className="p-6 sm:p-7 flex items-start gap-4">
              <span className="w-8 h-8 rounded-full bg-[#1d1d1f] text-white text-sm font-semibold inline-flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div>
                <h3 className="text-lg font-semibold text-[#1d1d1f] leading-tight">{title}</h3>
                <p className="mt-1.5 text-sm text-[#86868b] leading-relaxed">{text}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 text-center">
        <Link
          to="/how-it-works"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover"
        >
          Learn more
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  </section>
);

const CLINIC_FEATURES = ['Live queue for every doctor', 'Walk-ins at the desk', 'QR check-in on arrival', 'Fees paid to reception'];

const DESK_ROWS = [
  { token: 14, label: 'In cabin', tone: 'bg-primary-soft text-primary' },
  { token: 15, label: 'Arrived', tone: 'bg-success-soft text-success' },
  { token: 16, label: 'Walk-in', tone: 'bg-warning-soft text-warning' },
];

/** Call to action for clinics and doctors. */
export const ForClinicsSection: React.FC = () => (
  <section className="bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-16 sm:pb-24">
      <div className="relative overflow-clip rounded-[28px] border border-primary-line/60 bg-gradient-to-br from-[#eaf3fd] via-[#f3f8fe] to-white">
        <div className="pointer-events-none absolute -bottom-40 -left-24 w-[480px] h-[480px] rounded-full bg-[radial-gradient(closest-side,rgba(0,102,204,0.10),transparent)]" />
        <div className="relative grid grid-cols-1 lg:grid-cols-2 items-center">
          <div className="px-6 pt-10 pb-8 sm:px-12 sm:pt-14 lg:py-16">
            <p className="text-sm font-semibold text-primary">For clinics</p>
            <h2 className="mt-2 text-3xl sm:text-[40px] font-semibold tracking-tight leading-tight text-[#1d1d1f]">
              A calmer waiting room starts here.
            </h2>
            <ul className="mt-6grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {CLINIC_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-[#1d1d1f]">
                  <span className="w-5 h-5 rounded-full bg-primary text-white inline-flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/clinic/signup"
                className="h-11 px-6 rounded-full bg-primary hover:bg-primary-hover text-white text-sm inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                List your clinic
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/doctor/signup"
                className="h-11 px-6 rounded-full bg-white border border-[#d2d2d7] hover:bg-[#f5f5f7] text-[#1d1d1f] text-sm inline-flex items-center justify-center transition-all active:scale-[0.98]"
              >
                Join as a doctor
              </Link>
            </div>
          </div>

          {/* Lobby photo with a sample desk queue */}
          <div className="relative px-6 pb-10 sm:px-12 sm:pb-14 lg:p-10 lg:pl-0" aria-hidden="true">
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
              <img src={lobbyPhoto} alt="" loading="lazy" className="w-full h-full object-cover" />
            </div>
            <div className="absolute left-2 sm:left-6 lg:-left-10 bottom-4 sm:bottom-8 lg:bottom-14 w-[230px] sm:w-[250px] rounded-2xl bg-white/95 backdrop-blur-xl border border-black/[0.06] shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1d1d1f]">Today&rsquo;s queue</span>
                <span className="text-xs text-[#86868b]">Desk</span>
              </div>
              <ul className="mt-3 space-y-2">
                {DESK_ROWS.map((r) => (
                  <li key={r.token} className="flex items-center justify-between rounded-xl bg-[#f5f5f7] px-3 py-2">
                    <span className="text-sm font-semibold text-[#1d1d1f]">#{r.token}</span>
                    <span className={`h-6 px-2.5 rounded-full text-[11px] font-semibold inline-flex items-center ${r.tone}`}>
                      {r.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);
