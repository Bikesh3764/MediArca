// Shows a walk-in's 6-character tracking code (from the queue's ⋯ menu). The patient types it with the mobile number on Track walk-in.
import React from 'react';
import { X } from 'lucide-react';

export interface WalkinCodeTarget {
  token: number;
  name: string;
  code: string;
}

export const WalkinCodeModal: React.FC<{ target: WalkinCodeTarget | null; onClose: () => void }> = ({ target, onClose }) => {
  if (!target) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-label="Walk-in code" className="bg-white rounded-t-2xl sm:rounded-2xl border border-[#e5e5ea] w-full max-w-sm p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-[#86868b] truncate">
            #{target.token} · {target.name}
          </p>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1.5 -m-1.5 rounded-full text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-[#86868b] text-center mt-4">Walk-in code</p>
        <div className="mt-2 py-4 rounded-2xl bg-[#0066cc]/5 border border-[#0066cc]/20 text-center text-3xl font-semibold tracking-[0.3em] text-[#1d1d1f] select-all">
          {target.code}
        </div>
        <p className="text-xs text-[#86868b] text-center mt-3">Track walk-in · with the mobile number</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full h-11 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-semibold transition-all cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
};
