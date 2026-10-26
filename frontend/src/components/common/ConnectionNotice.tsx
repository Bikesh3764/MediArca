import React, { useEffect, useState } from 'react';

/**
 * Small pill shown while any request has been waiting more than a few seconds
 * (usually the free server waking up). Listens for `mediarca:slow` from safeFetch.
 */
export const ConnectionNotice: React.FC = () => {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const onSlow = (e: Event) => {
      const delta = Number((e as CustomEvent).detail) || 0;
      setPending((n) => Math.max(0, n + delta));
    };
    window.addEventListener('mediarca:slow', onSlow);
    return () => window.removeEventListener('mediarca:slow', onSlow);
  }, []);

  if (pending === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-[68px] left-1/2 -translate-x-1/2 z-[60] pointer-events-none animate-fadeIn"
    >
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/95 backdrop-blur-xl border border-[#e5e5ea] shadow-[0_12px_32px_rgba(0,0,0,0.12)] text-[13px] text-[#1d1d1f]">
        <span className="w-3.5 h-3.5 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin" />
        Connecting…
      </div>
    </div>
  );
};
