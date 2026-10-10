import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, User } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  loginWithGoogle: (credential: string, role?: string) => Promise<User>;
  register: (data: any) => Promise<{ user?: User; requiresVerification?: boolean; email?: string }>;
  verifyOtp: (email: string, otp: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (updatedUser: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('mediarca_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('mediarca_token'));
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      if (localStorage.getItem('mediarca_token')) {
        const currentUser = await api.getMe();
        setUser(currentUser);
        localStorage.setItem('mediarca_user', JSON.stringify(currentUser));
      } else {
        setUser(null);
      }
    } catch (error: any) {
      console.warn('Session refresh warning:', error);
      // Only clear credentials if the server explicitly confirmed an invalid/expired token (401)
      if (error?.response?.status === 401) {
        localStorage.removeItem('mediarca_token');
        localStorage.removeItem('mediarca_user');
        setUser(null);
        setToken(null);
      } else {
        // Transient network error or 5xx: preserve cached session so user is not logged out
        const cached = localStorage.getItem('mediarca_user');
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

  const login = async (credentials: { email: string; password: string }): Promise<User> => {
    const data = await api.login(credentials);
    localStorage.setItem('mediarca_token', data.token);
    localStorage.setItem('mediarca_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const loginWithGoogle = async (credential: string, role = 'PATIENT'): Promise<User> => {
    const data = await api.googleAuth(credential, role);
    localStorage.setItem('mediarca_token', data.token);
    localStorage.setItem('mediarca_user', JSON.stringify(data.user));
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
      localStorage.setItem('mediarca_token', data.token);
      localStorage.setItem('mediarca_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return { user: data.user };
    }
    return {};
  };

  const verifyOtp = async (email: string, otp: string): Promise<User> => {
    const data = await api.verifyEmailOtp({ email, otp });
    localStorage.setItem('mediarca_token', data.token);
    localStorage.setItem('mediarca_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('mediarca_token');
    localStorage.removeItem('mediarca_user');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    try {
      localStorage.setItem('mediarca_user', JSON.stringify(updatedUser));
    } catch (e) {
      console.error('Failed to persist updated user:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithGoogle, register, verifyOtp, logout, refreshUser, updateUser }}>
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
