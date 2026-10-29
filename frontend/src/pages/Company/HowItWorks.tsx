import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, IndianRupee, CalendarX, Users, DoorOpen, Phone } from 'lucide-react';
import { PageHero } from '../../components/layout/PageHero';
import { heroPrimaryBtn, heroSecondaryBtn } from '../../components/layout/heroStyles';
import { ShiftVisual, QueueVisual, ScanVisual } from '../home/HomeMarketing';

const STEPS = [
  {
    title: 'Find a doctor',
    text: 'Search by name, specialty or clinic. Pick a date and a shift. You get a token and an estimated time.',
    visual: ShiftVisual,
  },
  {
    title: 'Pay the receptionist',
    text: 'Call the desk and pay by UPI, or pay at the desk. Your token is confirmed once you pay.',
    visual: PayVisual,
  },
  {
    title: 'Track your turn',
    text: 'See how many people are ahead of you. Leave home when your turn is close.',
    visual: QueueVisual,
  },
  {
    title: 'Scan and walk in',
    text: 'Scan the clinic QR at the front desk when you arrive. Go in on your turn.',
    visual: ScanVisual,
  },
];

const GOOD_TO_KNOW = [
  { icon: IndianRupee, title: '₹0 platform fee', text: 'You only pay the doctor’s fee to the receptionist.' },
  { icon: CalendarX, title: 'Free cancellation', text: 'Cancel any time before your visit.' },
  { icon: Users, title: 'Book for family', text: 'Book for parents or children in their name.' },
  { icon: DoorOpen, title: 'Doctor status', text: 'See if the doctor is in or has stepped out.' },
];

function PayVisual() {
  return (
    <div className="w-full max-w-[250px] rounded-2xl bg-white border border-[#e5e5ea] p-3.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-[#86868b]">Front desk</p>
          <p className="text-sm font-semibold text-[#1d1d1f]">City Care Clinic</p>
        </div>
        <span className="w-9 h-9 rounded-full bg-primary text-white inline-flex items-center justify-center">
          <Phone className="w-4 h-4" />
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-[#f5f5f7] px-3 py-2">
        <span className="text-xs text-[#86868b]">Doctor&rsquo;s fee</span>
        <span className="text-sm font-semibold text-[#1d1d1f]">₹400</span>
      </div>
      <div className="mt-2 flex gap-2">
        <span className="flex-1 h-7 rounded-full bg-primary-soft text-primary text-[11px] font-semibold inline-flex items-center justify-center">
          UPI over call
        </span>
        <span className="flex-1 h-7 rounded-full bg-[#f5f5f7] text-[#1d1d1f] text-[11px] inline-flex items-center justify-center">
          At the desk
        </span>
      </div>
    </div>
  );
}

export const HowItWorks: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] pb-24 sm:pb-0 pb-safe">
      <PageHero
        eyebrow="How it works"
        title="Wait at home,"
        highlight="not in the clinic."
        subtitle="Four simple steps from booking to your turn."
      >
        <Link to="/doctors" className={heroPrimaryBtn}>
          Find a doctor
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link to="/track" className={heroSecondaryBtn}>
          Track walk-in
        </Link>
      </PageHero>

      {/* Steps, alternating picture and text */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-6 sm:pt-10">
        <ol className="relative space-y-4 sm:space-y-6">
          {STEPS.map(({ title, text, visual: Visual }, i) => (
            <li
              key={title}
              className="rounded-[28px] bg-white border border-[#e5e5ea] overflow-hidden grid grid-cols-1 md:grid-cols-2 items-stretch"
            >
              <div
                className={`min-h-[200px] sm:min-h-[240px] bg-gradient-to-br from-[#f5f5f7] to-[#eaf2fb] flex items-center justify-center p-8 ${
                  i % 2 === 1 ? 'md:order-2' : ''
                }`}
              >
                <Visual />
              </div>
              <div className="p-7 sm:p-10 flex flex-col justify-center">
                <span className="w-10 h-10 rounded-full bg-[#1d1d1f] text-white text-sm font-semibold inline-flex items-center justify-center">
                  {i + 1}
                </span>
                <h2 className="mt-5 text-2xl sm:text-[32px] font-semibold tracking-tight leading-tight">{title}</h2>
                <p className="mt-3 text-base sm:text-lg text-[#6e6e73] leading-relaxed max-w-md">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Good to know */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-20 sm:pt-28">
        <h2 className="text-center text-3xl sm:text-[40px] font-semibold tracking-tight">Good to know</h2>
        <ul className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {GOOD_TO_KNOW.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-2xl bg-white border border-[#e5e5ea] p-6">
              <span className="w-11 h-11 rounded-xl bg-primary-soft text-primary inline-flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-[#86868b] leading-relaxed">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Closing call to action */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-16 sm:pt-24 pb-16 sm:pb-24">
        <div className="relative overflow-clip rounded-[28px] bg-gradient-to-br from-[#0066cc] to-[#2997ff] px-7 py-12 sm:px-14 sm:py-16 text-center text-white">
          <div className="pointer-events-none absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.22),transparent)]" />
          <h2 className="relative text-3xl sm:text-[40px] font-semibold tracking-tight leading-tight">Ready to skip the wait?</h2>
          <p className="relative mt-3 text-base sm:text-lg text-white/85">Find a doctor near you and book a token.</p>
          <Link
            to="/doctors"
            className="relative mt-8 h-11 px-6 rounded-full bg-white text-primary hover:bg-[#f5f9ff] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            Find a doctor
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
};
