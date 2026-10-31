// Plugs the browser into the shared code (shared/src/platform.ts): server address,
// localStorage, Cloudflare bot check and the "server is waking up" notice.
import { normalizeApiBaseUrl } from '@mediarca/shared/api/config';
import { configurePlatform } from '@mediarca/shared/platform';
import { safeStorage } from '../utils/safeStorage';
import { getBotCheckToken } from './botCheck';

const rawApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

configurePlatform({
  apiBaseUrl: rawApiUrl
    ? normalizeApiBaseUrl(rawApiUrl)
    : typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:5000/api'
      : 'https://mediarca-api-sg.onrender.com/api',
  r2PublicUrl: import.meta.env.VITE_R2_PUBLIC_URL || 'https://pub-a590817d9f404eb889f6482b025ea9ad.r2.dev',
  storage: safeStorage,
  getBotCheckToken,
  demoFallback: import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_FALLBACK === 'true',
  onSlowRequest: (delta) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mediarca:slow', { detail: delta }));
  },
});
