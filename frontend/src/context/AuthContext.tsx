import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, User } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  loginWithGoogle: (credential: string, role?: string) => Promise<User>;
  register: (data: any) => Promise<User>;
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
    } catch (error) {
      console.error('Session restore failed:', error);
      localStorage.removeItem('mediarca_token');
      localStorage.removeItem('mediarca_user');
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
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

  const register = async (formData: any): Promise<User> => {
    const data = await api.register(formData);
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
    <AuthContext.Provider value={{ user, token, loading, login, loginWithGoogle, register, logout, refreshUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
