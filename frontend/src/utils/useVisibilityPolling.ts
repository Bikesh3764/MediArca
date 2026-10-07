import { useEffect, useRef } from 'react';

/**
 * useVisibilityPolling
 * Runs a polling callback at the specified interval only while the browser tab is active/visible.
 * - Tab hidden: pauses polling interval (zero background network requests).
 * - Tab visible: triggers an immediate refresh callback and resumes interval timer.
 * - Cleanup: clears interval and event listeners on component unmount or when disabled.
 *
 * Implements FIX-012 from MASTER_FIX_PLAN.md.
 */
export function useVisibilityPolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled: boolean = true
): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const startTimer = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        savedCallback.current();
      }, intervalMs);
    };

    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.hidden) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      } else {
        // Immediate refresh upon returning to the tab
        savedCallback.current();
        startTimer();
      }
    };

    if (typeof document !== 'undefined') {
      if (!document.hidden) {
        startTimer();
      }
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (timer) clearInterval(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [intervalMs, enabled]);
}

export default useVisibilityPolling;
