import { safeFetch } from '../../safeFetch';
import { API_BASE_URL } from '../config';
import { DoctorLeave, DoctorScheduleConfig } from '../schedule';
import { Doctor, DoctorAffiliationsData, PaginatedResult } from '../types';
import { cachedPublicGet, getHeaders, handleResponse } from '../http';
import { DEMO_DOCTORS } from '../demoData';

export const doctorsApi = {
  // Doctors
  async getDoctors(params?: {
    search?: string;
    specialty?: string;
    minExp?: number;
    maxFee?: number;
    sortBy?: string;
    clinicOnly?: boolean;
    clinicId?: string;
    state?: string;
    city?: string;
    page?: number;
    limit?: number;
  }): Promise<Doctor[]> {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.specialty && params.specialty !== 'All') query.append('specialty', params.specialty);
      if (params?.minExp) query.append('minExp', String(params.minExp));
      if (params?.maxFee) query.append('maxFee', String(params.maxFee));
      if (params?.sortBy) query.append('sortBy', params.sortBy);
      if (params?.clinicOnly !== undefined) query.append('clinicOnly', String(params.clinicOnly));
      if (params?.clinicId) query.append('clinicId', params.clinicId);
      if (params?.state && params.state !== 'All') query.append('state', params.state);
      if (params?.city && params.city !== 'All') query.append('city', params.city);
      if (params?.page) query.append('page', String(params.page));
      if (params?.limit) query.append('limit', String(params.limit));

      return await cachedPublicGet(`${API_BASE_URL}/doctors?${query.toString()}`);
    } catch (err) {
      if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_FALLBACK === 'true') {
        console.warn('Dev mode: backend unavailable, using demo doctors fallback', err);
        let list = [...DEMO_DOCTORS];
        if (params?.specialty && params.specialty !== 'All') {
          list = list.filter(d => d.specialty.toLowerCase() === params.specialty?.toLowerCase());
        }
        if (params?.state && params.state !== 'All') {
          const st = params.state.toLowerCase();
          list = list.filter(d =>
            d.clinics?.some(c => c.clinic.state?.toLowerCase() === st) ||
            d.clinicAddress?.toLowerCase().includes(st)
          );
        }
        if (params?.city && params.city !== 'All') {
          const ct = params.city.toLowerCase();
          list = list.filter(d =>
            d.clinics?.some(c => c.clinic.city?.toLowerCase() === ct) ||
            d.clinicAddress?.toLowerCase().includes(ct)
          );
        }
        if (params?.search) {
          const s = params.search.toLowerCase();
          list = list.filter(d => d.user.fullName.toLowerCase().includes(s) || d.specialty.toLowerCase().includes(s));
        }
        return list;
      }
      throw err;
    }
  },

  async getDoctorsPaginated(params?: {
    search?: string;
    specialty?: string;
    minExp?: number;
    maxFee?: number;
    sortBy?: string;
    clinicOnly?: boolean;
    clinicId?: string;
    state?: string;
    city?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<Doctor>> {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.specialty && params.specialty !== 'All') query.append('specialty', params.specialty);
      if (params?.minExp) query.append('minExp', String(params.minExp));
      if (params?.maxFee) query.append('maxFee', String(params.maxFee));
      if (params?.sortBy) query.append('sortBy', params.sortBy);
      if (params?.clinicOnly !== undefined) query.append('clinicOnly', String(params.clinicOnly));
      if (params?.clinicId) query.append('clinicId', params.clinicId);
      if (params?.state && params.state !== 'All') query.append('state', params.state);
      if (params?.city && params.city !== 'All') query.append('city', params.city);
      if (params?.page) query.append('page', String(params.page));
      if (params?.limit) query.append('limit', String(params.limit));

      const res = await safeFetch(`${API_BASE_URL}/doctors?${query.toString()}`);
      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        const error: any = new Error(
          `Server returned error ${res.status}: ${res.statusText || 'Unexpected error'}`
        );
        error.status = res.status;
        throw error;
      }
      if (!res.ok || json?.success === false) {
        const error: any = new Error(json?.message || 'Couldn’t fetch doctors. Try again.');
        error.status = res.status;
        throw error;
      }
      return {
        data: Array.isArray(json.data) ? json.data : [],
        count: json.count || (Array.isArray(json.data) ? json.data.length : 0),
        pagination: json.pagination || {
          page: params?.page || 1,
          limit: params?.limit || 20,
          total: Array.isArray(json.data) ? json.data.length : 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    } catch (err) {
      if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_FALLBACK === 'true') {
        const list = await this.getDoctors(params);
        return {
          data: list,
          count: list.length,
          pagination: {
            page: 1,
            limit: 20,
            total: list.length,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
      }
      throw err;
    }
  },

  async getDoctorById(id: string): Promise<Doctor> {
    try {
      const res = await safeFetch(`${API_BASE_URL}/doctors/${id}`, {
        headers: getHeaders(),
      });
      return await handleResponse(res);
    } catch (err) {
      if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_FALLBACK === 'true') {
        const found = DEMO_DOCTORS.find(d => d.id === id);
        if (found) return found;
        return DEMO_DOCTORS[0];
      }
      throw err;
    }
  },

  async updateDoctorSchedule(body: any): Promise<Doctor> {
    const res = await safeFetch(`${API_BASE_URL}/doctors/schedule`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async getDoctorScheduleConfig(doctorId: string, clinicId?: string): Promise<DoctorScheduleConfig> {
    const query = clinicId ? `?clinicId=${encodeURIComponent(clinicId)}` : '';
    const res = await safeFetch(`${API_BASE_URL}/doctors/${doctorId}/schedule-config${query}`, {
      headers: getHeaders(),
    });
    const parsed: any = await handleResponse(res);
    return parsed?.data !== undefined ? parsed.data : parsed;
  },

  async updateDoctorWorkingDays(doctorId: string, workingDays: string[], clinicId?: string): Promise<{ workingDays: string[] }> {
    const res = await safeFetch(`${API_BASE_URL}/doctors/${doctorId}/working-days`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ workingDays, clinicId }),
    });
    const parsed: any = await handleResponse(res);
    return parsed?.data !== undefined ? parsed.data : parsed;
  },

  async addDoctorLeave(
    doctorId: string,
    data: { type: 'TODAY' | 'DATE_RANGE'; startDate?: string; endDate?: string; reason?: string; clinicId?: string }
  ): Promise<DoctorLeave> {
    const res = await safeFetch(`${API_BASE_URL}/doctors/${doctorId}/leaves`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const parsed: any = await handleResponse(res);
    return parsed?.data !== undefined ? parsed.data : parsed;
  },

  async cancelDoctorLeave(doctorId: string, leaveId: string): Promise<void> {
    const res = await safeFetch(`${API_BASE_URL}/doctors/${doctorId}/leaves/${leaveId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse(res);
  },

  async updateDoctorCabinStatus(data: {
    status: 'IN_CABIN' | 'STEPPED_OUT' | 'NOT_IN_CABIN';
    expectedReturnTime?: string | null;
    returnEstimateMinutes?: number | null;
    doctorId?: string;
  }): Promise<{
    id: string;
    cabinStatus: string;
    expectedReturnTime: string | null;
    cabinStatusUpdatedAt: string | null;
  }> {
    const res = await safeFetch(`${API_BASE_URL}/doctors/cabin-status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // Doctor Affiliations
  async getDoctorAffiliations(): Promise<DoctorAffiliationsData> {
    const res = await safeFetch(`${API_BASE_URL}/doctors/me/affiliations`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async addDoctorClinic(data: { clinicId?: string; clinicEmail?: string }): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/doctors/me/clinics`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async respondToClinicAffiliation(affiliationId: string, action: 'ACCEPT' | 'REJECT'): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/doctors/me/affiliations/${affiliationId}/respond`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ action }),
    });
    return handleResponse(res);
  },

  async removeDoctorClinic(clinicId: string): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/doctors/me/clinics/${clinicId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async addDoctorReceptionist(data: { receptionistEmail: string }): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/doctors/me/receptionists`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async removeDoctorReceptionist(receptionistId: string): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/doctors/me/receptionists/${receptionistId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
};
