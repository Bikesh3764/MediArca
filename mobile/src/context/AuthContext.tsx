// Sign-in state for the app. Same behaviour as frontend/src/context/AuthContext.tsx.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, type User } from '@mediarca/shared/api';
import { appStorage } from '@/lib/storage';

export type Role = User['role'];

interface AuthContextType {
  user: User | null;
  /** True only on the first start without a saved session. */
  loading: boolean;
  login: (credentials: { email: string; password: string; role: Role }) => Promise<User>;
  register: (data: Record<string, unknown>) => Promise<{ user?: User; requiresVerification?: boolean; email?: string }>;
  verifyOtp: (email: string, otp: string, role?: Role) => Promise<User>;
  saveSession: (token: string | undefined, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (user: User) => void;
  /** Old sign-ins stop working after a change, so this device keeps the new token. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readSavedUser = (): User | null => {
  try {
    const saved = appStorage.getItem('mediarca_user');
    return saved ? (JSON.parse(saved) as User) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(readSavedUser);
  // A saved session shows the app at once and is re-checked in the background.
  const [loading, setLoading] = useState(() => !(appStorage.getItem('mediarca_token') && readSavedUser()));

  const saveSession = useCallback((token: string | undefined, next: User) => {
    if (token) appStorage.setItem('mediarca_token', token);
    appStorage.setItem('mediarca_user', JSON.stringify(next));
    setUser(next);
  }, []);

  const logout = useCallback(() => {
    appStorage.removeItem('mediarca_token');
    appStorage.removeItem('mediarca_user');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      if (appStorage.getItem('mediarca_token')) {
        const current = await api.getMe();
        setUser((prev) => (prev && JSON.stringify(prev) === JSON.stringify(current) ? prev : current));
        appStorage.setItem('mediarca_user', JSON.stringify(current));
      } else {
        setUser(null);
      }
    } catch (error: any) {
      // Only an explicit 401 signs out; a network error keeps the saved session.
      if (error?.status === 401) logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    // Re-check the saved session once the first screen is up
    queueMicrotask(() => {
      refreshUser();
    });
  }, [refreshUser]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      saveSession,
      logout,
      refreshUser,
      updateUser: (next) => saveSession(undefined, next),
      changePassword: async (currentPassword, newPassword) => {
        const data = await api.changePassword(currentPassword, newPassword);
        saveSession(data.token, data.user);
      },
      login: async (credentials) => {
        const data = await api.login(credentials);
        saveSession(data.token, data.user);
        return data.user;
      },
      register: async (formData) => {
        const data = await api.register(formData);
        if (data.requiresVerification) return { requiresVerification: true, email: data.email };
        if (data.token && data.user) {
          saveSession(data.token, data.user);
          return { user: data.user };
        }
        return {};
      },
      verifyOtp: async (email, otp, role) => {
        const data = await api.verifyEmailOtp({ email, otp, ...(role ? { role } : {}) });
        saveSession(data.token, data.user);
        return data.user;
      },
    }),
    [user, loading, saveSession, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

/** Where each account type lands after sign-in. */
export const homeFor = (user: Pick<User, 'role' | 'mustChangePassword'>) => {
  if (user.role === 'RECEPTIONIST' && user.mustChangePassword) return '/change-password' as const;
  switch (user.role) {
    case 'DOCTOR':
      return '/doctor' as const;
    case 'CLINIC':
      return '/clinic' as const;
    case 'RECEPTIONIST':
      return '/receptionist' as const;
    case 'ADMIN':
      // Admin works on the website only
      return '/welcome' as const;
    default:
      return '/patient' as const;
  }
};
