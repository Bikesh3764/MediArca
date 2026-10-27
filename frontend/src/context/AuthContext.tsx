import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, User } from '../services/api';
import { safeStorage } from '../utils/safeStorage';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (credentials: { email: string; password: string; role?: string }) => Promise<User>;
  loginWithGoogle: (credential: string, role?: string) => Promise<User>;
  register: (data: any) => Promise<{ user?: User; requiresVerification?: boolean; email?: string }>;
  verifyOtp: (email: string, otp: string, role?: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (updatedUser: User) => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Forgets the saved sign-in. Blocked browser storage must not crash sign-out. */
const clearSavedSession = () => {
  try {
    localStorage.removeItem('mediarca_token');
    localStorage.removeItem('mediarca_user');
  } catch {
    /* storage blocked */
  }
  safeStorage.removeItem('mediarca_token');
  safeStorage.removeItem('mediarca_user');
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = safeStorage.getItem('mediarca_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => safeStorage.getItem('mediarca_token'));
  // A saved session shows the app at once and is re-checked in the background;
  // waiting for the server first put a blank spinner on every page load.
  const [loading, setLoading] = useState<boolean>(
    () => !(safeStorage.getItem('mediarca_token') && safeStorage.getItem('mediarca_user'))
  );

  const refreshUser = async () => {
    try {
      if (safeStorage.getItem('mediarca_token')) {
        const currentUser = await api.getMe();
        // Same data: keep the same object so screens don't reload everything again
        setUser((prev) => (prev && JSON.stringify(prev) === JSON.stringify(currentUser) ? prev : currentUser));
        safeStorage.setItem('mediarca_user', JSON.stringify(currentUser));
      } else {
        setUser(null);
      }
    } catch (error: any) {
      console.warn('Session refresh warning:', error);
      // Only clear credentials if the server explicitly confirmed an invalid/expired token (401)
      if (error?.status === 401 || error?.response?.status === 401) {
        clearSavedSession();
        setUser(null);
        setToken(null);
      } else {
        // Transient network error or 5xx: preserve cached session so user is not logged out
        const cached = safeStorage.getItem('mediarca_user');
        if (cached) {
          try {
            setUser(JSON.parse(cached));
          } catch {
            // retain existing state
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      refreshUser();
    });
  }, []);

  const login = async (credentials: { email: string; password: string; role?: string }): Promise<User> => {
    const data = await api.login(credentials);
    safeStorage.setItem('mediarca_token', data.token);
    safeStorage.setItem('mediarca_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const loginWithGoogle = async (credential: string, role = 'PATIENT'): Promise<User> => {
    const data = await api.googleAuth(credential, role);
    safeStorage.setItem('mediarca_token', data.token);
    safeStorage.setItem('mediarca_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (formData: any): Promise<{ user?: User; requiresVerification?: boolean; email?: string }> => {
    const data = await api.register(formData);
    if (data.requiresVerification) {
      return { requiresVerification: true, email: data.email };
    }
    if (data.token && data.user) {
      safeStorage.setItem('mediarca_token', data.token);
      safeStorage.setItem('mediarca_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return { user: data.user };
    }
    return {};
  };

  const verifyOtp = async (email: string, otp: string, role?: string): Promise<User> => {
    const data = await api.verifyEmailOtp({ email, otp, ...(role ? { role } : {}) });
    safeStorage.setItem('mediarca_token', data.token);
    safeStorage.setItem('mediarca_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    const data = await api.changePassword(currentPassword, newPassword);
    // Old tokens stop working after a password change; keep this device signed in with the new one
    safeStorage.setItem('mediarca_token', data.token);
    safeStorage.setItem('mediarca_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    clearSavedSession();
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    try {
      safeStorage.setItem('mediarca_user', JSON.stringify(updatedUser));
    } catch (e) {
      console.error('Failed to persist updated user:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithGoogle, register, verifyOtp, logout, refreshUser, updateUser, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

// oxlint-disable-next-line react/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
