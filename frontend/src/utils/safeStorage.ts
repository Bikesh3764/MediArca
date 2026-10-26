/**
 * localStorage that never throws. Some browsers (private mode, blocked site data)
 * throw on any access; the site should still load, just without remembering sign-in.
 */
const memory = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* storage blocked */
    }
    memory.delete(key);
  },
};
