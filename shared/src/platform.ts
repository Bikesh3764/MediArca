/**
 * What the shared code needs from the place it runs in (website or mobile app).
 * Each one calls configurePlatform() once at startup, before any request is made.
 */
import { setApiBaseUrl } from './api/config';

/** Synchronous key/value storage. The app keeps an in-memory copy of its secure storage. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PlatformConfig {
  /** Server address, with or without a trailing /api. */
  apiBaseUrl?: string;
  /** Public address for uploaded files stored as r2:// paths. */
  r2PublicUrl: string;
  storage: KeyValueStorage;
  /** One-time bot-check token for public forms, or undefined if none. */
  getBotCheckToken: () => Promise<string | undefined>;
  /** Use demo doctors/clinics when the server can't be reached (local development only). */
  demoFallback: boolean;
  /** Called with +1 when a request is slow (server waking up) and -1 when it finishes. */
  onSlowRequest: (delta: 1 | -1) => void;
}

const memory = new Map<string, string>();

let current: PlatformConfig = {
  r2PublicUrl: 'https://pub-a590817d9f404eb889f6482b025ea9ad.r2.dev',
  storage: {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
    },
    removeItem: (key) => {
      memory.delete(key);
    },
  },
  getBotCheckToken: async () => undefined,
  demoFallback: false,
  onSlowRequest: () => {},
};

export const configurePlatform = (config: Partial<PlatformConfig>): void => {
  current = { ...current, ...config };
  if (config.apiBaseUrl) setApiBaseUrl(config.apiBaseUrl);
};

export const platform = (): PlatformConfig => current;

/** JSON body with a fresh bot-check token added. */
export const withBotCheck = async <T extends object>(body: T): Promise<T & { turnstileToken?: string }> => {
  const turnstileToken = await current.getBotCheckToken();
  return turnstileToken ? { ...body, turnstileToken } : body;
};
