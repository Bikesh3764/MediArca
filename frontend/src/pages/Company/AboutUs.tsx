import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Activity, IndianRupee, DoorOpen, QrCode, User, Building2, Check } from 'lucide-react';
import { PageHero } from '../../components/layout/PageHero';
import { heroPrimaryBtn, heroSecondaryBtn } from '../../components/layout/heroStyles';
import lobbyPhoto from '../../assets/clinic-lobby-bg.webp';

const VALUES = [
  { icon: Activity, title: 'Live tokens', text: 'Follow your turn on your phone.' },
  { icon: IndianRupee, title: '₹0 platform fee', text: 'Pay the receptionist, by UPI or at the desk.' },
  { icon: DoorOpen, title: 'Doctor status', text: 'See if the doctor is in the cabin.' },
  { icon: QrCode, title: 'QR check-in', text: 'Scan the clinic QR when you arrive.' },
];

const AUDIENCES = [
  {
    icon: User,
    title: 'For patients',
    text: 'Find verified doctors, book a token and reach the clinic when your turn is close.',
    points: ['Book for family', 'Free cancellation', 'Live queue'],
    cta: { label: 'Find a doctor', to: '/doctors' },
  },
  {
    icon: Building2,
    title: 'For clinics and doctors',
    text: 'Walk-ins and online bookings in one queue. Fewer crowds, smoother OPD.',
    points: ['Desk console', 'QR standee', 'Shifts and leave'],
    cta: { label: 'List your clinic', to: '/clinic/signup' },
  },
];

export const AboutUs: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] pb-24 sm:pb-0 pb-safe">
      <PageHero
        eyebrow="About MediArca"
        title="Less waiting."
        highlight="More care."
        subtitle="Live clinic queues, so you wait at home, not in a crowded room."
      />

      {/* Story with photo */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-6 sm:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
          <div className="relative order-2 lg:order-1">
            <div className="rounded-[28px] overflow-hidden aspect-[4/3] border border-[#e5e5ea]">
              <img src={lobbyPhoto} alt="Clinic waiting area" loading="lazy" className="w-full h-full object-cover" />
            </div>
            <div className="absolute right-3 sm:-right-5 -bottom-5 rounded-2xl bg-white/95 backdrop-blur-xl border border-black/[0.06] shadow-[0_12px_32px_rgba(0,0,0,0.12)] px-4 py-3 flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-success-soft text-success inline-flex items-center justify-center">
                <Check className="w-5 h-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#1d1d1f]">Your turn is next</p>
                <p className="text-xs text-[#86868b]">Leave home now</p>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <p className="text-sm font-semibold text-primary">What we do</p>
            <h2 className="mt-2 text-3xl sm:text-[40px] font-semibold tracking-tight leading-tight">
              Know when you&rsquo;ll be called.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#48484a] leading-relaxed">
              Seeing a doctor shouldn&rsquo;t mean hours in a waiting room. MediArca shows the clinic&rsquo;s queue live, so
              you arrive just in time.
            </p>
            <div className="mt-7 grid grid-cols-3 gap-3 max-w-md">
              {[
                { k: '₹0', v: 'Platform fee' },
                { k: 'Live', v: 'Token queue' },
                { k: 'QR', v: 'Check-in' },
              ].map((s) => (
                <div key={s.v} className="rounded-2xl bg-white border border-[#e5e5ea] px-3 py-4 text-center">
                  <p className="text-2xl font-semibold tracking-tight text-primary">{s.k}</p>
                  <p className="mt-1 text-xs text-[#86868b]">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-20 sm:pt-28">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-[40px] font-semibold tracking-tight leading-tight">Built for real clinics.</h2>
          <p className="mt-3 text-base sm:text-lg text-[#86868b]">Simple tools that fit how Indian OPDs work.</p>
        </div>
        <ul className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {VALUES.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="rounded-2xl bg-white border border-[#e5e5ea] p-6 transition-all duration-200 hover:border-primary-line hover:-translate-y-0.5"
            >
              <span className="w-12 h-12 rounded-xl bg-primary-soft text-primary inline-flex items-center justify-center">
                <Icon className="w-[22px] h-[22px]" />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
              <p className="mt-1.5 text-sm text-[#86868b] leading-relaxed">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Who it helps */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-20 sm:pt-28 pb-16 sm:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {AUDIENCES.map(({ icon: Icon, title, text, points, cta }, i) => (
            <div
              key={title}
              className={`relative overflow-clip rounded-[28px] border p-7 sm:p-10 ${
                i === 1
                  ? 'border-primary-line/60 bg-gradient-to-br from-[#eaf3fd] via-[#f3f8fe] to-white'
                  : 'border-[#e5e5ea] bg-white'
              }`}
            >
              <span className="w-12 h-12 rounded-full bg-primary text-white inline-flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </span>
              <h3 className="mt-6 text-2xl sm:text-[28px] font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-base text-[#48484a] leading-relaxed max-w-md">{text}</p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {points.map((p) => (
                  <li
                    key={p}
                    className="h-8 px-3.5 rounded-full bg-white border border-[#e5e5ea] text-xs text-[#1d1d1f] inline-flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 text-primary" />
                    {p}
                  </li>
                ))}
              </ul>
              <Link to={cta.to} className={`mt-8 ${i === 1 ? heroPrimaryBtn : heroSecondaryBtn}`}>
                {cta.label}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
