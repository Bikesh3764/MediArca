import { safeFetch } from '../../safeFetch';
import { API_BASE_URL } from '../config';
import { ClinicDashboardData, ClinicProfile, ClinicReceptionistItem, PaginatedResult } from '../types';
import { cachedPublicGet, getHeaders, handleResponse } from '../http';
import { DEMO_DOCTORS } from '../demoData';

export const clinicApi = {
  // Clinic Portal
  async getMyClinic(): Promise<ClinicDashboardData> {
    const res = await safeFetch(`${API_BASE_URL}/clinics/my-clinic`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async updateClinicProfile(data: {
    clinicName?: string;
    fullName?: string;
    address?: string;
    city?: string;
    state?: string;
    phone?: string;
    avatarUrl?: string;
  }): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/clinics/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async addDoctorToClinic(data: { doctorEmail?: string; doctorId?: string }): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/clinics/doctors`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async removeDoctorFromClinic(doctorId: string): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/clinics/doctors/${doctorId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async addClinicReceptionist(data: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    doctorIds?: string[];
    assignedDoctorIds?: string[];
  }): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/clinics/receptionists`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async getClinicReceptionists(): Promise<ClinicReceptionistItem[]> {
    const res = await safeFetch(`${API_BASE_URL}/clinics/receptionists`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async updateClinicReceptionistDoctors(receptionistId: string, doctorIds: string[]): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/clinics/receptionists/${receptionistId}/doctors`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ doctorIds }),
    });
    return handleResponse(res);
  },

  async removeClinicReceptionist(receptionistId: string): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/clinics/receptionists/${receptionistId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getPublicClinics(params?: { search?: string; city?: string; state?: string; page?: number; limit?: number }): Promise<ClinicProfile[]> {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.city && params.city !== 'All') query.append('city', params.city);
      if (params?.state && params.state !== 'All') query.append('state', params.state);
      if (params?.page) query.append('page', String(params.page));
      if (params?.limit) query.append('limit', String(params.limit));
      const qs = query.toString();
      const url = qs ? `${API_BASE_URL}/clinics/public?${qs}` : `${API_BASE_URL}/clinics/public`;
      return await cachedPublicGet(url);
    } catch (err) {
      if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_FALLBACK === 'true') {
        console.warn('Dev mode: backend unavailable, using demo clinics fallback', err);
        const clinicMap = new Map<string, ClinicProfile>();
        DEMO_DOCTORS.forEach((doc) => {
          doc.clinics?.forEach((cd) => {
            const c = cd.clinic;
            if (!clinicMap.has(c.id)) {
              clinicMap.set(c.id, {
                id: c.id,
                clinicName: c.clinicName,
                address: c.address,
                city: c.city,
                state: 'Maharashtra',
                phone: c.phone,
                isVerified: c.isVerified,
                verificationStatus: 'VERIFIED',
                _count: { doctors: 0 },
                doctors: [],
              });
            }
            const existing = clinicMap.get(c.id)!;
            const alreadyHasDoc = existing.doctors?.some((d) => d.doctorId === doc.id);
            if (!alreadyHasDoc) {
              existing.doctors = existing.doctors || [];
              existing.doctors.push({
                id: cd.id,
                clinicId: c.id,
                doctorId: doc.id,
                status: 'ACCEPTED',
                consultationFee: cd.consultationFee ?? doc.consultationFee,
                slots: cd.slots || doc.slots,
                doctor: doc,
              });
              existing._count = { doctors: existing.doctors.length };
            }
          });
        });

        let list = Array.from(clinicMap.values());
        if (params?.city && params.city !== 'All') {
          list = list.filter((c) => c.city?.toLowerCase() === params.city?.toLowerCase());
        }
        if (params?.search) {
          const q = params.search.toLowerCase();
          list = list.filter(
            (c) =>
              c.clinicName.toLowerCase().includes(q) ||
              c.address.toLowerCase().includes(q) ||
              c.city?.toLowerCase().includes(q)
          );
        }
        return list;
      }
      throw err;
    }
  },

  async getPublicClinicsPaginated(params?: {
    search?: string;
    city?: string;
    state?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<ClinicProfile>> {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.city && params.city !== 'All') query.append('city', params.city);
      if (params?.state && params.state !== 'All') query.append('state', params.state);
      if (params?.page) query.append('page', String(params.page));
      if (params?.limit) query.append('limit', String(params.limit));

      const qs = query.toString();
      const url = qs ? `${API_BASE_URL}/clinics/public?${qs}` : `${API_BASE_URL}/clinics/public`;
      const res = await safeFetch(url, { headers: getHeaders() });
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
        const error: any = new Error(json?.message || 'Couldn’t retrieve clinics. Try again.');
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
        const list = await this.getPublicClinics(params);
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

  async getPublicClinicById(id: string): Promise<ClinicProfile> {
    try {
      const res = await safeFetch(`${API_BASE_URL}/clinics/public/${id}`, { headers: getHeaders() });
      return await handleResponse(res);
    } catch (err) {
      if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_FALLBACK === 'true') {
        const clinics = await this.getPublicClinics();
        const found = clinics.find((c) => c.id === id);
        if (found) return found;
      }
      throw err;
    }
  },

  // Clinic Doctor Affiliation Response
  async respondToDoctorAffiliation(affiliationId: string, action: 'ACCEPT' | 'REJECT'): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/clinic/affiliations/${affiliationId}/respond`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ action }),
    });
    return handleResponse(res);
  },
};
