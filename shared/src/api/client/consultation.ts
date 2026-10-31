import { safeFetch } from '../../safeFetch';
import { API_BASE_URL } from '../config';
import { Appointment } from '../types';
import { getHeaders, handleResponse } from '../http';

export const consultationApi = {
  // Doctor Consultation & Queue Console
  async getDoctorQueue(
    date?: string,
    scope?: 'date' | 'all-upcoming',
    clinicId?: string,
    slotId?: string
  ): Promise<{
    doctorId?: string;
    date: string;
    scope?: string;
    totalQueue: number;
    activeInConsultation: Appointment | null;
    waitingQueue: Appointment[];
    completedQueue: Appointment[];
    upcomingSummary?: {
      tomorrowDate: string;
      tomorrowCount: number;
      totalUpcomingCount: number;
      futureCountFromSelectedDate: number;
      nextDateWithBookings: string | null;
    };
  }> {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (scope) params.append('scope', scope);
    if (clinicId && clinicId !== 'all') params.append('clinicId', clinicId);
    if (slotId && slotId !== 'all') params.append('slotId', slotId);
    const qs = params.toString();
    const url = qs ? `${API_BASE_URL}/consultations/queue?${qs}` : `${API_BASE_URL}/consultations/queue`;
    const res = await safeFetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  async callPatient(appointmentId: string): Promise<Appointment> {
    const res = await safeFetch(`${API_BASE_URL}/consultations/call-patient`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ appointmentId }),
    });
    return handleResponse(res);
  },

  async completeConsultation(body: { appointmentId: string }): Promise<{ appointment: Appointment }> {
    const res = await safeFetch(`${API_BASE_URL}/consultations/complete`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async holdConsultation(appointmentId: string): Promise<Appointment> {
    const res = await safeFetch(`${API_BASE_URL}/consultations/hold`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ appointmentId }),
    });
    return handleResponse<Appointment>(res);
  },
};
