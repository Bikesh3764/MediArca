import React, { useEffect, useState } from 'react';
import { Phone, Stethoscope } from 'lucide-react';

// Sample queue shown on the home page. It counts up to the patient's token, then starts again.
const YOUR_TOKEN = 17;
const SERVING_STEPS = [12, 13, 14, 15, 16, 17];
const MINUTES_PER_PATIENT = 6;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const FLOAT = 'shadow-[0_12px_32px_rgba(0,0,0,0.12)]';

/** Sample live token card shown over the hero photo. */
export const HeroQueuePreview: React.FC = () => {
  const [step, setStep] = useState(prefersReducedMotion() ? 2 : 0);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % SERVING_STEPS.length);
    }, 2400);
    return () => window.clearInterval(id);
  }, []);

  const serving = SERVING_STEPS[step];
  const ahead = Math.max(0, YOUR_TOKEN - serving);
  const yourTurn = ahead === 0;
  const progress = Math.round(((step + 1) / SERVING_STEPS.length) * 100);

  return (
    <div className="relative w-full max-w-[340px] mx-auto py-4 sm:py-6" aria-hidden="true">
      {/* Live token card */}
      <div className={`relative rounded-[22px] bg-white/95 backdrop-blur-xl border border-black/[0.06] ${FLOAT} p-5`}>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#1d1d1f]">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-success-dot opacity-60 animate-ping motion-reduce:animate-none" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-success-dot" />
            </span>
            Live queue
          </span>
          <span className="text-xs text-[#86868b]">Today</span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-primary-soft text-primary inline-flex items-center justify-center shrink-0">
            <Stethoscope className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#1d1d1f] truncate">General Physician</p>
            <p className="text-xs text-[#86868b] truncate">City Care Clinic</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#f5f5f7] px-3.5 py-3">
            <p className="text-xs text-[#86868b]">Your token</p>
            <p className="text-[32px] font-semibold tracking-tight text-[#1d1d1f] leading-none mt-1.5">{YOUR_TOKEN}</p>
          </div>
          <div className="rounded-xl bg-primary-soft px-3.5 py-3 overflow-hidden">
            <p className="text-xs text-primary">Now serving</p>
            <p key={serving} className="ma-tick text-[32px] font-semibold tracking-tight text-primary leading-none mt-1.5">
              {serving}
            </p>
          </div>
        </div>

        <div className="mt-4 h-1.5 rounded-full bg-[#f0f0f2] overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ease-out ${yourTurn ? 'bg-success-dot' : 'bg-primary'}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          {yourTurn ? (
            <span className="font-semibold text-success">Your turn</span>
          ) : (
            <span className="text-[#1d1d1f]">
              <span className="font-semibold">{ahead}</span> ahead of you
            </span>
          )}
          <span className="text-[#86868b]">{yourTurn ? 'Go in' : `~${ahead * MINUTES_PER_PATIENT} min`}</span>
        </div>

        <div className="mt-4 pt-4 border-t border-[#f0f0f2] flex items-center justify-between">
          <div>
            <p className="text-xs text-[#86868b]">Fee ₹400</p>
            <p className="text-sm font-semibold text-[#1d1d1f]">Pay receptionist</p>
          </div>
          <span className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-primary text-white text-xs">
            <Phone className="w-3.5 h-3.5" />
            Call desk
          </span>
        </div>
      </div>

    </div>
  );
};
