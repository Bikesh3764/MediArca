/**
 * Sign-in storage for the app. The shared code reads storage synchronously, so we keep an
 * in-memory copy and write through to the phone's secure storage (encrypted, per app).
 * loadStorage() fills the copy once at startup, before any screen shows.
 */
import * as SecureStore from 'expo-secure-store';
import type { KeyValueStorage } from '@mediarca/shared/platform';

const KEYS = ['mediarca_token', 'mediarca_user'] as const;
// Secure storage is meant for small values; a large profile is just re-fetched at startup.
const MAX_SECURE_VALUE = 2000;

const memory = new Map<string, string>();

// Secure storage keys allow only letters, numbers, ".", "-" and "_".
const toSecureKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export const loadStorage = async (): Promise<void> => {
  await Promise.all(
    KEYS.map(async (key) => {
      try {
        const value = await SecureStore.getItemAsync(toSecureKey(key));
        if (value !== null) memory.set(key, value);
      } catch {
        /* unreadable after reinstall: start signed out */
      }
    })
  );
};

export const appStorage: KeyValueStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
    const secureKey = toSecureKey(key);
    const write =
      value.length <= MAX_SECURE_VALUE
        ? SecureStore.setItemAsync(secureKey, value)
        : SecureStore.deleteItemAsync(secureKey);
    write.catch(() => {});
  },
  removeItem: (key) => {
    memory.delete(key);
    SecureStore.deleteItemAsync(toSecureKey(key)).catch(() => {});
  },
};
