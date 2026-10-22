import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (message: string, title?: string, duration?: number) => void;
    error: (message: string, title?: string, duration?: number) => void;
    info: (message: string, title?: string, duration?: number) => void;
    warning: (message: string, title?: string, duration?: number) => void;
  };
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, title?: string, duration = 3500) => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastItem = { id, type, message, title, duration };

      setToasts((prev) => {
        // Limit to max 3 simultaneous toasts to prevent screen crowding
        const updated = [...prev, newToast];
        return updated.length > 3 ? updated.slice(updated.length - 3) : updated;
      });

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toastMethods = useMemo(
    () => ({
      success: (msg: string, title?: string, duration?: number) =>
        addToast('success', msg, title, duration),
      error: (msg: string, title?: string, duration?: number) =>
        addToast('error', msg, title, duration),
      info: (msg: string, title?: string, duration?: number) =>
        addToast('info', msg, title, duration),
      warning: (msg: string, title?: string, duration?: number) =>
        addToast('warning', msg, title, duration),
    }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toast: toastMethods, removeToast }}>
      {children}
      {/* Toast Floating Viewport */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed top-[max(env(safe-area-inset-top),1rem)] left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 max-w-[92vw] sm:max-w-md w-full pointer-events-none select-none transition-all duration-200"
        >
          {toasts.map((t) => {
            const isSuccess = t.type === 'success';
            const isError = t.type === 'error';
            const isWarning = t.type === 'warning';

            return (
              <div
                key={t.id}
                role="status"
                className="pointer-events-auto w-full bg-[#1d1d1f]/95 text-white backdrop-blur-xl border border-white/15 px-4 py-2.5 rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.28)] flex items-center justify-between gap-3 text-xs sm:text-[13px] font-medium animate-in fade-in slide-in-from-top-3 duration-200"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {isSuccess && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  {isError && (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  {isWarning && (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  {!isSuccess && !isError && !isWarning && (
                    <Info className="w-4 h-4 text-[#0071e3] shrink-0" />
                  )}
                  <div className="min-w-0 flex-1 truncate">
                    {t.title && (
                      <span className="font-semibold block truncate leading-tight">
                        {t.title}
                      </span>
                    )}
                    <span className="text-white/90 truncate leading-snug">
                      {t.message}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeToast(t.id)}
                  className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                  aria-label="Dismiss toast"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
};

// oxlint-disable-next-line react/only-export-components
export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};
