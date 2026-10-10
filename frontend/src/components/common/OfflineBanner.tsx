import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, CheckCircle2 } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showRestored, setShowRestored] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 animate-in fade-in slide-in-from-top-3 max-w-[90vw] sm:max-w-md w-full px-4 pointer-events-none"
    >
      {!isOnline ? (
        <div className="bg-[#1d1d1f]/95 text-white backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.24)] flex items-center justify-center gap-2.5 text-xs sm:text-sm font-medium pointer-events-auto">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
          <WifiOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="truncate">You are currently offline. Check connection.</span>
        </div>
      ) : showRestored ? (
        <div className="bg-emerald-700/95 text-white backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 shadow-[0_12px_32px_rgba(16,185,129,0.24)] flex items-center justify-center gap-2.5 text-xs sm:text-sm font-medium pointer-events-auto animate-out fade-out duration-500">
          <CheckCircle2 className="w-4 h-4 text-emerald-200 flex-shrink-0" />
          <Wifi className="w-4 h-4 text-emerald-200 flex-shrink-0" />
          <span>Connection restored.</span>
        </div>
      ) : null}
    </div>
  );
};

export default OfflineBanner;
