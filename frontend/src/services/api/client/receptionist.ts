import { safeFetch } from '../../safeFetch';
import { API_BASE_URL } from '../config';
import { DoctorSlot } from '../schedule';
import { Appointment, ReceptionistDashboardData, ReceptionistQueueItem } from '../types';
import { getHeaders, handleResponse } from '../http';

export const receptionistApi = {
  // Receptionist Portal
  async getMyReceptionist(): Promise<ReceptionistDashboardData> {
    const res = await safeFetch(`${API_BASE_URL}/receptionists/my-receptionist`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async addDoctorToReceptionist(data: { doctorEmail?: string; doctorId?: string }): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/receptionists/doctors`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async removeDoctorFromReceptionist(doctorId: string): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/receptionists/doctors/${doctorId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getReceptionistDoctorQueue(
    doctorId: string,
    date?: string
  ): Promise<{
    doctor: {
      id: string;
      fullName: string;
      specialty: string;
      slots: DoctorSlot[];
      cabinStatus?: string;
      expectedReturnTime?: string | null;
      cabinStatusUpdatedAt?: string | null;
    };
    appointmentDate: string;
    totalPatients: number;
    waitingCount: number;
    inConsultationCount: number;
    completedCount: number;
    cancelledCount: number;
    appointments: ReceptionistQueueItem[];
  }> {
    const url = date
      ? `${API_BASE_URL}/receptionists/doctors/${doctorId}/queue?date=${date}`
      : `${API_BASE_URL}/receptionists/doctors/${doctorId}/queue`;
    const res = await safeFetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  async bookWalkinAppointment(data: {
    doctorId: string;
    patientName: string;
    patientPhone: string;
    gender?: string;
    patientAge?: string;
    isForOther?: boolean;
    appointmentDate?: string;
    slotId?: string;
    reasonForVisit?: string;
    symptoms?: string;
    clinicId?: string;
  }): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/receptionists/book-walkin`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateAppointmentStatus(appointmentId: string, status: string): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/receptionists/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse(res);
  },

  async rescheduleAppointment(appointmentId: string, data: { newDate: string; newSlotId?: string }): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/receptionists/appointments/${appointmentId}/reschedule`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async doctorRescheduleAppointment(appointmentId: string, data: { newDate: string; newSlotId?: string }): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/appointments/${appointmentId}/reschedule`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async changeReceptionistPassword(data: { currentPassword: string; newPassword: string }): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/receptionists/change-password`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
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
      const error: any = new Error(json?.message || 'API request failed');
      error.status = res.status;
      throw error;
    }
    const token = json.token || json.data?.token;
    if (token) {
      localStorage.setItem('mediarca_token', token);
    }
    const user = json.user || json.data?.user || (json.data && !json.data.token ? json.data : null);
    return {
      token,
      user,
      data: json.data,
      message: json.message,
      success: json.success,
    };
  },

  // Receptionist Pending Appointments & Approval Operations
  async getPendingAppointments(): Promise<Appointment[]> {
    const res = await safeFetch(`${API_BASE_URL}/receptionists/pending-appointments`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async approveAppointment(appointmentId: string): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/receptionists/appointments/${appointmentId}/approve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async rejectAppointment(appointmentId: string, reason?: string): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/receptionists/appointments/${appointmentId}/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    });
    return handleResponse(res);
  },

  async applyReceptionist(data: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    clinicId: string;
  }): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/receptionists/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async respondToReceptionistRequest(
    receptionistId: string,
    action: 'ACCEPT' | 'REJECT',
    doctorIds?: string[]
  ): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/clinic/receptionists/${receptionistId}/respond`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ action, doctorIds }),
    });
    return handleResponse(res);
  },
};
