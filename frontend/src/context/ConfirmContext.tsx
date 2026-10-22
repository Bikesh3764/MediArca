import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = (result: boolean) => {
    if (resolveRef.current) {
      resolveRef.current(result);
      resolveRef.current = null;
    }
    setOptions(null);
  };

  // Lock body scroll when confirm dialog is open
  useEffect(() => {
    if (options) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [options]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && options) {
        handleClose(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {options && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose(false);
          }}
        >
          <div className="w-full max-w-sm sm:max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] border border-[#e5e5ea] p-6 sm:p-7 pb-[max(1.5rem,env(safe-area-inset-bottom,1.5rem))] shadow-[0_24px_60px_rgba(0,0,0,0.18)] text-center animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-200 select-none">
            {/* Apple Drag Handle Pill for Mobile */}
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-4" />

            {/* Icon Disc */}
            <div
              className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-4 ${
                options.isDestructive
                  ? 'bg-rose-50 text-rose-600 border border-rose-200/60'
                  : 'bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20'
              }`}
            >
              {options.isDestructive ? (
                <AlertTriangle className="w-6 h-6 stroke-[2]" />
              ) : (
                <HelpCircle className="w-6 h-6 stroke-[2]" />
              )}
            </div>

            <h3 className="text-[19px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
              {options.title}
            </h3>
            <p className="text-[13px] text-[#86868b] mt-2 leading-relaxed max-w-xs mx-auto">
              {options.message}
            </p>

            {/* Dual Action Buttons */}
            <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="w-full sm:flex-1 h-11 px-5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] active:scale-[0.98] text-[#1d1d1f] text-sm font-medium transition-all duration-150 border border-[#e5e5ea] cursor-pointer"
              >
                {options.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => handleClose(true)}
                className={`w-full sm:flex-1 h-11 px-5 rounded-full text-white text-sm font-semibold active:scale-[0.98] transition-all duration-150 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.12)] ${
                  options.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : 'bg-[#0066cc] hover:bg-[#0071e3] shadow-[#0066cc]/25'
                }`}
              >
                {options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

// oxlint-disable-next-line react/only-export-components
export const useConfirm = (): ConfirmContextType => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx;
};
