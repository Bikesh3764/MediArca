export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : 'https://mediarca-mdwk.onrender.com/api');

export const getBackendBaseUrl = (): string => {
  return API_BASE_URL.replace(/\/api\/?$/, '');
};

export const getFileUrl = (filePath?: string): string => {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  const backendBase = getBackendBaseUrl();
  return `${backendBase}${filePath.startsWith('/') ? '' : '/'}${filePath}`;
};

export const DEMO_DOCTORS: Doctor[] = [
  {
    id: 'doc_sarah_01',
    userId: 'usr_sarah_02',
    specialty: 'Cardiology',
    qualifications: 'MD - Harvard Medical School, FACC',
    experienceYears: 14,
    consultationFee: 80.0,
    bio: 'Specialist in preventive cardiology, hypertension, coronary artery disease, and heart failure management with over 14 years of clinical experience.',
    clinicAddress: 'City Heart & Vascular Institute, Suite 402, New York, NY',
    isVerified: true,
    checkingStartTime: '09:00',
    checkingEndTime: '13:00',
    avgConsultationMinutes: 20,
    maxDailyPatients: 25,
    rating: 4.9,
    totalReviews: 128,
    user: {
      id: 'usr_sarah_02',
      fullName: 'Dr. Sarah Jenkins',
      email: 'dr.sarah@mediarca.com',
      avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=256&q=80',
    },
  },
  {
    id: 'doc_arjun_02',
    userId: 'usr_arjun_03',
    specialty: 'Dermatology',
    qualifications: 'MD - Stanford Medicine, Board Certified',
    experienceYears: 10,
    consultationFee: 65.0,
    bio: 'Consultant dermatologist focusing on acne, eczema, psoriasis, skin cancer screening, and cosmetic laser treatments.',
    clinicAddress: 'Apex Skin & Aesthetics Clinic, Floor 2, San Francisco, CA',
    isVerified: true,
    checkingStartTime: '10:00',
    checkingEndTime: '14:00',
    avgConsultationMinutes: 15,
    maxDailyPatients: 30,
    rating: 4.8,
    totalReviews: 94,
    user: {
      id: 'usr_arjun_03',
      fullName: 'Dr. Arjun Patel',
      email: 'dr.arjun@mediarca.com',
      avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=256&q=80',
    },
  },
  {
    id: 'doc_elena_03',
    userId: 'usr_elena_04',
    specialty: 'Pediatrics',
    qualifications: 'MD, FAAP - Johns Hopkins University',
    experienceYears: 12,
    consultationFee: 70.0,
    bio: 'Dedicated pediatrician providing comprehensive child wellness care, developmental tracking, vaccinations, and adolescent healthcare.',
    clinicAddress: 'Little Steps Children Care, Building B, Chicago, IL',
    isVerified: true,
    checkingStartTime: '08:30',
    checkingEndTime: '12:30',
    avgConsultationMinutes: 15,
    maxDailyPatients: 28,
    rating: 5.0,
    totalReviews: 150,
    user: {
      id: 'usr_elena_04',
      fullName: 'Dr. Elena Rostova',
      email: 'dr.elena@mediarca.com',
      avatarUrl: 'https://images.unsplash.com/photo-1594824813576-0f723652f146?auto=format&fit=crop&w=256&q=80',
    },
  },
];

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  avatarUrl?: string;
  patientProfile?: {
    id: string;
    bloodGroup?: string;
    allergies?: string;
    existingConditions?: string;
    emergencyContact?: string;
  };
  doctorProfile?: {
    id: string;
    specialty: string;
    qualifications: string;
    experienceYears: number;
    consultationFee: number;
    bio?: string;
    clinicAddress?: string;
    isVerified: boolean;
    checkingStartTime: string;
    checkingEndTime: string;
    avgConsultationMinutes: number;
    maxDailyPatients: number;
    rating: number;
    totalReviews: number;
  };
}

export interface Doctor {
  id: string;
  userId: string;
  specialty: string;
  qualifications: string;
  experienceYears: number;
  consultationFee: number;
  bio?: string;
  clinicAddress?: string;
  isVerified: boolean;
  checkingStartTime: string;
  checkingEndTime: string;
  avgConsultationMinutes: number;
  maxDailyPatients: number;
  rating: number;
  totalReviews: number;
  user: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
    phone?: string;
  };
  reviews?: Array<{
    id: string;
    rating: number;
    comment?: string;
    patientUser: { fullName: string; avatarUrl?: string };
    createdAt: string;
  }>;
}

export interface QueuePreview {
  doctorId: string;
  doctorName: string;
  appointmentDate: string;
  checkingWindow: string;
  checkingStartTime: string;
  checkingEndTime: string;
  avgConsultationMinutes: number;
  maxDailyPatients: number;
  totalBooked: number;
  nextQueueNumber: number;
  patientsAhead: number;
  estimatedTime: string;
  isFull: boolean;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  queueNumber: number;
  checkingWindow: string;
  estimatedTime: string;
  status: 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED';
  reasonForVisit?: string;
  symptoms?: string;
  vitals?: string;
  clinicalNotes?: string;
  doctor: Doctor;
  patient?: {
    id: string;
    userId: string;
    bloodGroup?: string;
    allergies?: string;
    existingConditions?: string;
    user: { fullName: string; email: string; phone?: string; avatarUrl?: string };
    medicalRecords?: MedicalRecord[];
  };
  prescription?: {
    id: string;
    diagnosis: string;
    medicines: string;
    advice?: string;
    followUpDate?: string;
  };
  review?: {
    id: string;
    rating: number;
    comment?: string;
  };
  liveQueue?: {
    currentServingQueueNumber: number;
    patientsAway: number;
    estimatedWaitMinutes: number;
    isYourTurn: boolean;
  };
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  title: string;
  category: string;
  fileUrl: string;
  fileType?: string;
  uploadedAt: string;
}

const getHeaders = (isMultipart = false) => {
  const token = localStorage.getItem('mediarca_token');
  const headers: Record<string, string> = {};
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'API request failed');
  }
  return data.data;
}

export const api = {
  // Auth
  async register(body: any): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async login(body: any): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async googleAuth(credential: string, role = 'PATIENT'): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, role }),
    });
    return handleResponse(res);
  },

  async getMe(): Promise<User> {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async updateProfile(body: any): Promise<User> {
    const res = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  // Doctors
  async getDoctors(params?: {
    search?: string;
    specialty?: string;
    minExp?: number;
    maxFee?: number;
    sortBy?: string;
  }): Promise<Doctor[]> {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.specialty && params.specialty !== 'All') query.append('specialty', params.specialty);
      if (params?.minExp) query.append('minExp', String(params.minExp));
      if (params?.maxFee) query.append('maxFee', String(params.maxFee));
      if (params?.sortBy) query.append('sortBy', params.sortBy);

      const res = await fetch(`${API_BASE_URL}/doctors?${query.toString()}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('Backend currently waking up, loading instant demo verified specialists', err);
      let list = [...DEMO_DOCTORS];
      if (params?.specialty && params.specialty !== 'All') {
        list = list.filter(d => d.specialty.toLowerCase() === params.specialty?.toLowerCase());
      }
      if (params?.search) {
        const s = params.search.toLowerCase();
        list = list.filter(d => d.user.fullName.toLowerCase().includes(s) || d.specialty.toLowerCase().includes(s));
      }
      return list;
    }
  },

  async getDoctorById(id: string): Promise<Doctor> {
    try {
      const res = await fetch(`${API_BASE_URL}/doctors/${id}`);
      return await handleResponse(res);
    } catch (err) {
      const found = DEMO_DOCTORS.find(d => d.id === id);
      if (found) return found;
      return DEMO_DOCTORS[0];
    }
  },

  async updateDoctorSchedule(body: any): Promise<Doctor> {
    const res = await fetch(`${API_BASE_URL}/doctors/schedule`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  // Appointments & Queue Preview
  async getQueuePreview(doctorId: string, appointmentDate: string): Promise<QueuePreview> {
    try {
      const res = await fetch(
        `${API_BASE_URL}/appointments/queue-preview?doctorId=${doctorId}&appointmentDate=${appointmentDate}`
      );
      return await handleResponse(res);
    } catch (err) {
      console.warn('Queue preview API unavailable, using offline preview calculation fallback', err);
      const doctor = DEMO_DOCTORS.find((d) => d.id === doctorId) || DEMO_DOCTORS[0];
      const checkingWindow = `${doctor.checkingStartTime} – ${doctor.checkingEndTime}`;
      return {
        doctorId: doctor.id,
        doctorName: doctor.user.fullName,
        appointmentDate,
        checkingWindow,
        checkingStartTime: doctor.checkingStartTime,
        checkingEndTime: doctor.checkingEndTime,
        avgConsultationMinutes: doctor.avgConsultationMinutes,
        maxDailyPatients: doctor.maxDailyPatients,
        totalBooked: 1,
        nextQueueNumber: 2,
        patientsAhead: 1,
        estimatedTime: '09:20 AM',
        isFull: false,
      };
    }
  },

  async bookAppointment(body: {
    doctorId: string;
    appointmentDate: string;
    reasonForVisit?: string;
    symptoms?: string;
  }): Promise<Appointment> {
    const res = await fetch(`${API_BASE_URL}/appointments/book`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async getPatientAppointments(): Promise<Appointment[]> {
    const res = await fetch(`${API_BASE_URL}/appointments/patient`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async cancelAppointment(id: string): Promise<Appointment> {
    const res = await fetch(`${API_BASE_URL}/appointments/${id}/cancel`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Doctor Consultation & Queue Console
  async getDoctorQueue(date?: string): Promise<{
    date: string;
    totalQueue: number;
    activeInConsultation: Appointment | null;
    waitingQueue: Appointment[];
    completedQueue: Appointment[];
    allAppointments: Appointment[];
  }> {
    const url = date ? `${API_BASE_URL}/consultations/queue?date=${date}` : `${API_BASE_URL}/consultations/queue`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  async callPatient(appointmentId: string): Promise<Appointment> {
    const res = await fetch(`${API_BASE_URL}/consultations/call-patient`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ appointmentId }),
    });
    return handleResponse(res);
  },

  async updateNotes(body: { appointmentId: string; vitals?: any; clinicalNotes?: string }): Promise<Appointment> {
    const res = await fetch(`${API_BASE_URL}/consultations/notes`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async completePrescription(body: {
    appointmentId: string;
    diagnosis: string;
    medicines: any[];
    advice?: string;
    followUpDate?: string;
    clinicalNotes?: string;
    vitals?: any;
  }): Promise<{ appointment: Appointment; prescription: any }> {
    const res = await fetch(`${API_BASE_URL}/consultations/complete-prescription`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  // Medical Records
  async getRecords(patientId?: string): Promise<MedicalRecord[]> {
    const url = patientId ? `${API_BASE_URL}/records?patientId=${patientId}` : `${API_BASE_URL}/records`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  async uploadRecord(formData: FormData): Promise<MedicalRecord> {
    const res = await fetch(`${API_BASE_URL}/records/upload`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    return handleResponse(res);
  },

  async deleteRecord(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/records/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse(res);
  },

  // Admin
  async getAdminStats(): Promise<{
    totalPatients: number;
    totalDoctors: number;
    pendingDoctors: number;
    totalAppointments: number;
    todayAppointments: number;
  }> {
    const res = await fetch(`${API_BASE_URL}/admin/stats`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getAdminDoctors(): Promise<Doctor[]> {
    const res = await fetch(`${API_BASE_URL}/admin/doctors`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async verifyDoctor(doctorId: string, isVerified: boolean): Promise<Doctor> {
    const res = await fetch(`${API_BASE_URL}/admin/verify-doctor`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ doctorId, isVerified }),
    });
    return handleResponse(res);
  },

  async getAdminAppointments(): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/admin/appointments`, { headers: getHeaders() });
    return handleResponse(res);
  },
};
