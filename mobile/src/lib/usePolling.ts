// Quiet background refresh: runs only while this screen is open and the app is in front.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

export function usePolling(run: () => void, intervalMs: number, enabled: boolean) {
  const latest = useRef(run);
  useEffect(() => {
    latest.current = run;
  });

  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
      // Coming back to the app: refresh at once
      if (state === 'active') latest.current();
    });
    return () => sub.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !active) return undefined;
      const timer = setInterval(() => latest.current(), intervalMs);
      return () => clearInterval(timer);
    }, [enabled, active, intervalMs])
  );
}

/** For setState: keep the old value when a refresh brings the same data, so the screen doesn't redraw. */
export const keepIfSame =
  <T,>(next: T) =>
  (prev: T | null): T => {
    if (prev === next) return next;
    try {
      return JSON.stringify(prev) === JSON.stringify(next) ? (prev as T) : next;
    } catch {
      return next;
    }
  };
