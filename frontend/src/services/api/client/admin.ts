import { safeFetch } from '../../safeFetch';
import { API_BASE_URL } from '../config';
import { ContactMessageItem, Doctor } from '../types';
import { getHeaders, handleResponse } from '../http';

export const adminApi = {
  // Admin
  async getAdminStats(): Promise<{
    totalPatients: number;
    totalDoctors: number;
    pendingDoctors: number;
    totalClinics: number;
    pendingClinics: number;
    totalAppointments: number;
    todayAppointments: number;
  }> {
    const res = await safeFetch(`${API_BASE_URL}/admin/stats`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getAdminDoctors(params?: { page?: number; limit?: number }): Promise<Doctor[]> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await safeFetch(`${API_BASE_URL}/admin/doctors${qs}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async verifyDoctor(
    doctorId: string,
    action: boolean | 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | 'PENDING'
  ): Promise<Doctor> {
    const payload =
      typeof action === 'boolean'
        ? { doctorId, isVerified: action, status: action ? 'VERIFIED' : 'SUSPENDED' }
        : { doctorId, isVerified: action === 'VERIFIED', status: action };
    const res = await safeFetch(`${API_BASE_URL}/admin/verify-doctor`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async getAdminClinics(params?: { page?: number; limit?: number }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await safeFetch(`${API_BASE_URL}/admin/clinics${qs}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async verifyClinic(
    clinicId: string,
    action: boolean | 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | 'PENDING'
  ): Promise<any> {
    const payload =
      typeof action === 'boolean'
        ? { clinicId, isVerified: action, status: action ? 'VERIFIED' : 'SUSPENDED' }
        : { clinicId, isVerified: action === 'VERIFIED', status: action };
    const res = await safeFetch(`${API_BASE_URL}/admin/verify-clinic`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async getAdminAppointments(): Promise<any[]> {
    // The server sends 250 per page; keep going until a short page (capped at 20 pages)
    const pageSize = 250;
    const all: any[] = [];
    for (let page = 1; page <= 20; page++) {
      const res = await safeFetch(`${API_BASE_URL}/admin/appointments?page=${page}&limit=${pageSize}`, { headers: getHeaders() });
      const rows = await handleResponse<any[]>(res);
      const list = Array.isArray(rows) ? rows : [];
      all.push(...list);
      if (list.length < pageSize) break;
    }
    return all;
  },

  async submitContactMessage(data: {
    fullName: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await safeFetch(`${API_BASE_URL}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async getAdminContactMessages(): Promise<ContactMessageItem[]> {
    const res = await safeFetch(`${API_BASE_URL}/admin/contact-messages`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async markContactMessageRead(id: string): Promise<ContactMessageItem> {
    const res = await safeFetch(`${API_BASE_URL}/admin/contact-messages/${id}/read`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async deleteContactMessage(id: string): Promise<{ success: boolean; message: string }> {
    const res = await safeFetch(`${API_BASE_URL}/admin/contact-messages/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
};
