import { withBotCheck } from '../../botCheck';
import { safeFetch } from '../../safeFetch';
import { API_BASE_URL } from '../config';
import { User } from '../types';
import { getHeaders, handleResponse } from '../http';

export const authApi = {
  // Auth
  async register(body: any): Promise<{ user?: User; token?: string; requiresVerification?: boolean; email?: string; message?: string }> {
    const res = await safeFetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await withBotCheck(body)),
    });
    return handleResponse(res);
  },

  async verifyEmailOtp(body: { email: string; otp: string; role?: string }): Promise<{ user: User; token: string }> {
    const res = await safeFetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async resendEmailOtp(email: string, role?: string): Promise<{ success: boolean; message: string }> {
    const res = await safeFetch(`${API_BASE_URL}/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ...(role ? { role } : {}) }),
    });
    return handleResponse(res);
  },

  async requestPasswordReset(email: string, role: string): Promise<{ cooldownSeconds?: number; devOtp?: string }> {
    const res = await safeFetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await withBotCheck({ email, role })),
    });
    return handleResponse(res);
  },

  async resetPassword(body: { email: string; role: string; otp: string; newPassword: string }): Promise<unknown> {
    const res = await safeFetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ user: User; token: string }> {
    const res = await safeFetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return handleResponse(res);
  },

  async login(body: any): Promise<{ user: User; token: string }> {
    const res = await safeFetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async googleAuth(credential: string, role = 'PATIENT'): Promise<{ user: User; token: string }> {
    const res = await safeFetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, role }),
    });
    return handleResponse(res);
  },

  async getMe(): Promise<User> {
    const res = await safeFetch(`${API_BASE_URL}/auth/me`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async updateProfile(body: any): Promise<User> {
    const res = await safeFetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async updateUserProfile(body: any): Promise<User> {
    const res = await safeFetch(`${API_BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async updateDoctorProfile(body: any): Promise<User> {
    const res = await safeFetch(`${API_BASE_URL}/doctors/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async uploadAvatar(file: File): Promise<{ avatarUrl: string; user: User }> {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await safeFetch(`${API_BASE_URL}/auth/avatar`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
      timeoutMs: 30000,
    });
    return await handleResponse(res);
  },
};
