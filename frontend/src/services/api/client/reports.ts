import { safeFetch } from '../../safeFetch';
import { API_BASE_URL } from '../config';
import { ClinicalReportData } from '../types';
import { getHeaders, handleResponse } from '../http';

export const reportsApi = {
  // Clinical Audit & Revenue Reports (1 Month / Custom Range)
  async getClinicReport(params?: { startDate?: string; endDate?: string; doctorId?: string }): Promise<ClinicalReportData> {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.doctorId && params.doctorId !== 'all') query.append('doctorId', params.doctorId);
    const qs = query.toString();
    const res = await safeFetch(`${API_BASE_URL}/clinics/report${qs ? `?${qs}` : ''}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getDoctorReport(params?: { startDate?: string; endDate?: string; clinicId?: string }): Promise<ClinicalReportData> {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.clinicId && params.clinicId !== 'all') query.append('clinicId', params.clinicId);
    const qs = query.toString();
    const res = await safeFetch(`${API_BASE_URL}/doctors/me/report${qs ? `?${qs}` : ''}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getReceptionistReport(params?: { startDate?: string; endDate?: string; doctorId?: string }): Promise<ClinicalReportData> {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.doctorId && params.doctorId !== 'all') query.append('doctorId', params.doctorId);
    const qs = query.toString();
    const res = await safeFetch(`${API_BASE_URL}/receptionist/report${qs ? `?${qs}` : ''}`, { headers: getHeaders() });
    return handleResponse(res);
  },
};
