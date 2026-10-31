// Plugs the phone into the shared code (shared/src/platform.ts). Call setupPlatform() once at startup.
import { configurePlatform } from '@mediarca/shared/platform';
import { appStorage, loadStorage } from './storage';
import { getBotCheckToken } from './botCheck';

// Override with EXPO_PUBLIC_API_URL (e.g. a computer on the same Wi-Fi: http://192.168.1.5:5000)
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://mediarca-api-sg.onrender.com/api';

type SlowListener = (slowCount: number) => void;
let slowCount = 0;
const slowListeners = new Set<SlowListener>();

/** "Server is waking up" signal for the UI. */
export const onSlowChange = (listener: SlowListener): (() => void) => {
  slowListeners.add(listener);
  return () => slowListeners.delete(listener);
};

let ready: Promise<void> | null = null;

export const setupPlatform = (): Promise<void> => {
  if (!ready) {
    ready = (async () => {
      await loadStorage();
      configurePlatform({
        apiBaseUrl: API_URL,
        r2PublicUrl: process.env.EXPO_PUBLIC_R2_PUBLIC_URL || 'https://pub-a590817d9f404eb889f6482b025ea9ad.r2.dev',
        storage: appStorage,
        getBotCheckToken,
        // Sample doctors when the server can't be reached; only in development, and only when asked
        demoFallback: __DEV__ && process.env.EXPO_PUBLIC_DEMO_FALLBACK === 'true',
        onSlowRequest: (delta) => {
          slowCount = Math.max(0, slowCount + delta);
          slowListeners.forEach((l) => l(slowCount));
        },
      });
    })();
  }
  return ready;
};
