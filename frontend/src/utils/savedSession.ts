import { safeStorage } from './safeStorage';

/** Forgets the saved sign-in. Blocked browser storage must not crash sign-out. */
export const clearSavedSession = () => {
  try {
    localStorage.removeItem('mediarca_token');
    localStorage.removeItem('mediarca_user');
  } catch {
    /* storage blocked */
  }
  safeStorage.removeItem('mediarca_token');
  safeStorage.removeItem('mediarca_user');
};
