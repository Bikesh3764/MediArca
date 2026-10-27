import { safeFetch } from '../../safeFetch';
import { API_BASE_URL } from '../config';
import { SlotStatusResult, evaluateSlotStatus, parseDoctorSlots } from '../schedule';
import { Appointment, QueuePreview, WalkinTrackResult } from '../types';
import { getHeaders, handleResponse } from '../http';
import { DEMO_DOCTORS } from '../demoData';

export const appointmentsApi = {
  // Appointments & Queue Preview
  async getQueuePreview(doctorId: string, appointmentDate: string, slotId?: string, clinicId?: string): Promise<QueuePreview> {
    try {
      const slotQuery = slotId ? `&slotId=${encodeURIComponent(slotId)}` : '';
      const clinicQuery = clinicId ? `&clinicId=${encodeURIComponent(clinicId)}` : '';
      const res = await safeFetch(
        `${API_BASE_URL}/appointments/queue-preview?doctorId=${doctorId}&appointmentDate=${appointmentDate}${slotQuery}${clinicQuery}`
      );
      return await handleResponse(res);
    } catch (err) {
      if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_FALLBACK === 'true') {
        console.warn('Dev mode: queue preview API unavailable, using offline preview calculation fallback', err);
        const doctor = DEMO_DOCTORS.find((d) => d.id === doctorId) || DEMO_DOCTORS[0];
        const matchedClinic = clinicId ? doctor.clinics?.find(c => c.clinicId === clinicId) : doctor.clinics?.[0];
        const slots = (matchedClinic?.slots && matchedClinic.slots.length > 0) ? matchedClinic.slots : parseDoctorSlots(doctor);
        const effectiveFee = matchedClinic?.consultationFee ?? doctor.consultationFee;
        const now = new Date();

        const availableSlots: SlotStatusResult[] = slots.map((slot) => {
          return evaluateSlotStatus(slot, appointmentDate, 0, now);
        });

        let chosen = availableSlots.find((s) => s.slot.id === slotId);
        if (chosen && chosen.isPassed) {
          const alt = availableSlots.find((s) => !s.isPassed && !s.isFull);
          if (alt) chosen = alt;
        }
        if (!chosen) {
          chosen = availableSlots.find((s) => !s.isPassed && !s.isFull) || availableSlots[0];
        }

        return {
          doctorId: doctor.id,
          doctorName: doctor?.user?.fullName || 'Doctor',
          appointmentDate,
          selectedSlotId: chosen.slot.id,
          selectedSlot: chosen,
          availableSlots,
          checkingWindow: chosen.slot.name.replace(/\s*\([^)]*\)/g, '').trim() || chosen.slot.name,
          checkingStartTime: chosen.slot.startTime,
          checkingEndTime: chosen.slot.endTime,
          avgConsultationMinutes: chosen.slot.avgConsultationMinutes,
          maxDailyPatients: chosen.slot.maxPatients,
          totalBooked: chosen.totalBooked,
          nextQueueNumber: (chosen.totalBooked || 0) + 1,
          slotQueueNumber: (chosen.totalBooked || 0) + 1,
          patientsAhead: chosen.patientsAhead,
          estimatedTime: chosen.estimatedTime,
          isFull: chosen.isFull,
          isPassed: chosen.isPassed,
          isInProgress: chosen.isInProgress,
          statusLabel: chosen.statusLabel,
          consultationFee: effectiveFee,
          clinicId: matchedClinic?.clinicId,
          clinicName: matchedClinic?.clinic.clinicName,
          selectedClinic: matchedClinic ? {
            clinicId: matchedClinic.clinicId,
            clinicName: matchedClinic.clinic.clinicName,
            address: matchedClinic.clinic.address,
            city: matchedClinic.clinic.city,
            phone: matchedClinic.clinic.phone,
            consultationFee: effectiveFee,
          } : null,
          hasClinics: (doctor.clinics?.length || 0) > 0,
          clinicsCount: doctor.clinics?.length || 0,
          clinics: doctor.clinics?.map(c => ({
            clinicId: c.clinicId,
            clinicName: c.clinic.clinicName,
            address: c.clinic.address,
            city: c.clinic.city,
            phone: c.clinic.phone,
            consultationFee: c.consultationFee ?? doctor.consultationFee,
            slots: c.slots || parseDoctorSlots(doctor),
          })),
        };
      }
      throw err;
    }
  },

  async bookAppointment(body: {
    doctorId: string;
    appointmentDate: string;
    slotId?: string;
    reasonForVisit?: string;
    symptoms?: string;
    clinicId?: string;
    isForOther?: boolean;
    patientName?: string;
    patientAge?: string;
    patientGender?: string;
    patientPhone?: string;
  }): Promise<Appointment> {
    const res = await safeFetch(`${API_BASE_URL}/appointments/book`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async getPatientAppointments(params?: { status?: 'active' | 'past'; page?: number; limit?: number }): Promise<Appointment[]> {
    const query = new URLSearchParams();
    query.append('_t', String(Date.now()));
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    const res = await safeFetch(`${API_BASE_URL}/appointments/patient?${query.toString()}`, {
      headers: {
        ...getHeaders(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    return handleResponse(res);
  },

  async cancelAppointment(id: string): Promise<Appointment> {
    const res = await safeFetch(`${API_BASE_URL}/appointments/${id}/cancel`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getAppointmentById(id: string): Promise<Appointment> {
    const res = await safeFetch(`${API_BASE_URL}/appointments/${id}?_t=${Date.now()}`, {
      headers: {
        ...getHeaders(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    return handleResponse(res);
  },

  async checkInWithQR(data: { clinicId: string; code?: string; appointmentId?: string }): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/appointments/check-in`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    let json: any = null;
    const text = await res.text();
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      if (!res.ok) {
        throw new Error(`Server returned error ${res.status}`);
      }
      return text;
    }
    if (!res.ok || json.success === false) {
      throw new Error(json.message || json.error || 'Couldn’t complete clinic check-in. Try again.');
    }
    const apptData = json.data || {};
    return {
      ...apptData,
      message: json.message,
      alreadyCheckedIn: Boolean(json.alreadyCheckedIn),
      data: json.data,
    };
  },

  async checkInAppointmentDirect(appointmentId: string, isCheckedIn?: boolean): Promise<any> {
    const res = await safeFetch(`${API_BASE_URL}/appointments/${appointmentId}/check-in`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(isCheckedIn !== undefined ? { isCheckedIn } : {}),
    });
    return handleResponse(res);
  },
  /** Public: walk-in patient's live queue from mobile number + 6-character code (FIX-058). */
  async trackWalkin(phone: string, code: string): Promise<WalkinTrackResult> {
    const res = await safeFetch(`${API_BASE_URL}/appointments/walkin-track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    return handleResponse(res);
  },
};
