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
  const isExecutingRef = useRef(false);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    let isCancelled = false;

    const executeSafely = async () => {
      if (isExecutingRef.current || isCancelled) return;
      isExecutingRef.current = true;
      try {
        await savedCallback.current();
      } catch (err) {
        console.warn('Visibility poll warning:', err);
      } finally {
        isExecutingRef.current = false;
      }
    };

    const startTimer = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        executeSafely();
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
        // Immediate single-flight refresh upon returning to the tab
        executeSafely();
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
      isCancelled = true;
      if (timer) clearInterval(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [intervalMs, enabled]);
}

export default useVisibilityPolling;
