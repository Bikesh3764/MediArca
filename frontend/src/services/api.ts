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

export interface DoctorSlot {
  id: string;
  name: string;
  startTime: string; // "09:00"
  endTime: string; // "11:00"
  maxPatients: number; // e.g. 50
  avgConsultationMinutes: number; // calculated: durationInMinutes / maxPatients (e.g. 120/50 = 2.4)
}

export interface SlotStatusResult {
  slot: DoctorSlot;
  isToday: boolean;
  isPassed: boolean;
  isInProgress: boolean;
  isUpcoming: boolean;
  isFull: boolean;
  totalBooked: number;
  patientsAhead: number;
  estimatedTime: string;
  statusLabel: string;
}

// Time calculation helpers
export const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const clean = timeStr.replace(/\s*(AM|PM)/i, '').trim();
  const [hStr, mStr] = clean.split(':');
  let h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  if (timeStr.toUpperCase().includes('PM') && h < 12) h += 12;
  if (timeStr.toUpperCase().includes('AM') && h === 12) h = 0;
  return h * 60 + m;
};

export const minutesTo12Hour = (totalMinutes: number): string => {
  const normalized = ((Math.floor(totalMinutes) % (24 * 60)) + (24 * 60)) % (24 * 60);
  let hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

export const format12Hour = (time24: string): string => {
  if (!time24) return '09:00 AM';
  if (time24.includes('AM') || time24.includes('PM')) return time24;
  return minutesTo12Hour(timeToMinutes(time24));
};

export const calculateSlotMetrics = (
  startTime: string,
  endTime: string,
  maxPatients: number
): { durationMinutes: number; avgConsultationMinutes: number } => {
  const startMins = timeToMinutes(startTime);
  let endMins = timeToMinutes(endTime);
  if (endMins <= startMins) {
    endMins += 24 * 60;
  }
  const durationMinutes = Math.max(1, endMins - startMins);
  const safeMax = Math.max(1, maxPatients || 1);
  const rawAvg = durationMinutes / safeMax;
  const avgConsultationMinutes = Math.round(rawAvg * 10) / 10;
  return { durationMinutes, avgConsultationMinutes };
};

export const parseDoctorSlots = (doctor: any): DoctorSlot[] => {
  if (doctor?.slots) {
    try {
      const parsed = typeof doctor.slots === 'string' ? JSON.parse(doctor.slots) : doctor.slots;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((s: any, idx: number) => {
          const startTime = s.startTime || '09:00';
          const endTime = s.endTime || '11:00';
          const maxPatients = Number(s.maxPatients) || 50;
          const { avgConsultationMinutes } = calculateSlotMetrics(startTime, endTime, maxPatients);
          return {
            id: s.id || `slot_${idx + 1}`,
            name: s.name || `Slot ${idx + 1} (${format12Hour(startTime)} – ${format12Hour(endTime)})`,
            startTime,
            endTime,
            maxPatients,
            avgConsultationMinutes: s.avgConsultationMinutes || avgConsultationMinutes,
          };
        });
      }
    } catch (e) {
      console.warn('Failed to parse doctor slots:', e);
    }
  }

  const startTime = doctor?.checkingStartTime || '09:00';
  const endTime = doctor?.checkingEndTime || '13:00';
  const maxPatients = Number(doctor?.maxDailyPatients) || 25;
  const { avgConsultationMinutes } = calculateSlotMetrics(startTime, endTime, maxPatients);

  return [
    {
      id: 'slot_1',
      name: `Shift 1 (${format12Hour(startTime)} – ${format12Hour(endTime)})`,
      startTime,
      endTime,
      maxPatients,
      avgConsultationMinutes: doctor?.avgConsultationMinutes || avgConsultationMinutes,
    },
  ];
};

export const getLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTomorrowDateString = (d: Date = new Date()): string => {
  const tomorrow = new Date(d);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getLocalDateString(tomorrow);
};

export const evaluateSlotStatus = (
  slot: DoctorSlot,
  appointmentDate: string,
  bookedCountForSlot: number,
  now = new Date(),
  overrideCurrentMinutes?: number
): SlotStatusResult => {
  const todayStr = getLocalDateString(now);

  const isToday = appointmentDate === todayStr;
  const isPastDate = appointmentDate < todayStr;
  const currentMinutes =
    typeof overrideCurrentMinutes === 'number' && !isNaN(overrideCurrentMinutes)
      ? overrideCurrentMinutes
      : now.getHours() * 60 + now.getMinutes();

  const slotStartMins = timeToMinutes(slot.startTime);
  let slotEndMins = timeToMinutes(slot.endTime);
  if (slotEndMins <= slotStartMins) {
    slotEndMins += 24 * 60;
  }

  const patientsAhead = bookedCountForSlot;
  let isPassed = false;
  let isInProgress = false;
  let isUpcoming = false;
  let isFull = false;
  let statusLabel = 'Available';
  let estimatedTime = '';

  if (isPastDate) {
    isPassed = true;
    statusLabel = 'Date Expired';
    estimatedTime = 'Date Expired';
  } else if (isToday) {
    if (currentMinutes >= slotEndMins) {
      isPassed = true;
      statusLabel = 'Shift Ended for Today';
      estimatedTime = 'Shift Ended';
    } else if (currentMinutes >= slotStartMins && currentMinutes < slotEndMins) {
      isInProgress = true;
      statusLabel = 'Active Now • In Progress';
      const offsetMins = patientsAhead * slot.avgConsultationMinutes;
      const estTotal = Math.max(slotStartMins + offsetMins, currentMinutes + offsetMins);
      if (estTotal >= slotEndMins) {
        isFull = true;
        statusLabel = 'Shift Over Capacity for Today';
        estimatedTime = 'Shift Full';
      } else {
        estimatedTime = minutesTo12Hour(estTotal);
      }
    } else {
      isUpcoming = true;
      statusLabel = 'Upcoming Today';
      const offsetMins = patientsAhead * slot.avgConsultationMinutes;
      const estTotal = slotStartMins + offsetMins;
      if (estTotal >= slotEndMins) {
        isFull = true;
        statusLabel = 'Fully Booked for Today';
        estimatedTime = 'Shift Full';
      } else {
        estimatedTime = minutesTo12Hour(estTotal);
      }
    }
  } else {
    isUpcoming = true;
    statusLabel = 'Upcoming';
    const offsetMins = patientsAhead * slot.avgConsultationMinutes;
    const estTotal = slotStartMins + offsetMins;
    estimatedTime = minutesTo12Hour(estTotal);
  }

  const isCapacityFull = bookedCountForSlot >= slot.maxPatients;
  if (isCapacityFull) {
    isFull = true;
    statusLabel = 'Fully Booked';
  }

  if (isFull && !isPassed) {
    if (!statusLabel || statusLabel === 'Available' || statusLabel === 'Active Now • In Progress' || statusLabel === 'Upcoming Today' || statusLabel === 'Upcoming') {
      statusLabel = 'Fully Booked';
    }
    if (!estimatedTime || estimatedTime === 'Shift Ended') {
      estimatedTime = 'Shift Full';
    }
  }

  return {
    slot,
    isToday,
    isPassed,
    isInProgress,
    isUpcoming,
    isFull,
    totalBooked: bookedCountForSlot,
    patientsAhead,
    estimatedTime,
    statusLabel,
  };
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
    checkingEndTime: '20:00',
    avgConsultationMinutes: 2.7,
    maxDailyPatients: 110,
    rating: 4.9,
    totalReviews: 128,
    slots: [
      {
        id: 'slot_sarah_1',
        name: 'Morning Shift (09:00 AM – 11:00 AM)',
        startTime: '09:00',
        endTime: '11:00',
        maxPatients: 50,
        avgConsultationMinutes: 2.4, // 120 mins / 50 = 2.4 mins
      },
      {
        id: 'slot_sarah_2',
        name: 'Evening Shift (05:00 PM – 08:00 PM)',
        startTime: '17:00',
        endTime: '20:00',
        maxPatients: 60,
        avgConsultationMinutes: 3.0, // 180 mins / 60 = 3.0 mins
      },
    ],
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
    checkingEndTime: '18:30',
    avgConsultationMinutes: 4.4,
    maxDailyPatients: 75,
    rating: 4.8,
    totalReviews: 94,
    slots: [
      {
        id: 'slot_arjun_1',
        name: 'Morning Clinic (10:00 AM – 01:00 PM)',
        startTime: '10:00',
        endTime: '13:00',
        maxPatients: 45,
        avgConsultationMinutes: 4.0, // 180 mins / 45 = 4.0 mins
      },
      {
        id: 'slot_arjun_2',
        name: 'Afternoon Clinic (04:00 PM – 06:30 PM)',
        startTime: '16:00',
        endTime: '18:30',
        maxPatients: 30,
        avgConsultationMinutes: 5.0, // 150 mins / 30 = 5.0 mins
      },
    ],
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
    checkingEndTime: '18:00',
    avgConsultationMinutes: 4.5,
    maxDailyPatients: 80,
    rating: 5.0,
    totalReviews: 150,
    slots: [
      {
        id: 'slot_elena_1',
        name: 'Morning Wellness (08:30 AM – 11:30 AM)',
        startTime: '08:30',
        endTime: '11:30',
        maxPatients: 40,
        avgConsultationMinutes: 4.5, // 180 mins / 40 = 4.5 mins
      },
      {
        id: 'slot_elena_2',
        name: 'Afternoon Consults (03:00 PM – 06:00 PM)',
        startTime: '15:00',
        endTime: '18:00',
        maxPatients: 40,
        avgConsultationMinutes: 4.5, // 180 mins / 40 = 4.5 mins
      },
    ],
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
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN' | 'CLINIC' | 'RECEPTIONIST';
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
    slots?: DoctorSlot[];
  };
  clinicProfile?: ClinicProfile;
  receptionistProfile?: ReceptionistProfile;
}

export interface ClinicProfile {
  id: string;
  clinicName: string;
  address: string;
  city?: string;
  phone?: string;
  isVerified?: boolean;
  createdAt?: string;
}

export interface ReceptionistProfile {
  id: string;
  phone?: string;
}

export interface ClinicReceptionistItem {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  doctorIds: string[];
  doctors: Array<{
    id: string;
    fullName: string;
    specialty: string;
  }>;
  createdAt: string;
}

export interface ClinicDoctorStat {
  affiliationId: string;
  doctorId: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  specialty: string;
  qualifications: string;
  experienceYears: number;
  consultationFee: number;
  bookingCount: number;
  completedCount: number;
  revenue: number;
  status: string;
  joinedAt: string;
}

export interface ClinicAppointment {
  id: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  doctorId: string;
  date: string;
  queueNumber: number;
  checkingWindow: string;
  estimatedTime: string;
  status: string;
  fee: number;
}

export interface ClinicDashboardData {
  clinic: ClinicProfile;
  doctors: ClinicDoctorStat[];
  receptionists?: ClinicReceptionistItem[];
  totalDoctors: number;
  totalBookings: number;
  totalRevenue: number;
  recentAppointments: ClinicAppointment[];
}

export interface ReceptionistLinkedDoctor {
  affiliationId: string;
  doctorId: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  specialty: string;
  clinicAddress?: string;
  consultationFee: number;
  slots: DoctorSlot[];
  clinics?: Array<{
    id: string;
    clinicId: string;
    clinic: ClinicProfile;
  }>;
  todayTotalBookings: number;
  todayWaitingPatients: number;
  joinedAt: string;
}

export interface ReceptionistDashboardData {
  receptionist: {
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    clinicId?: string;
  };
  clinic?: ClinicProfile | null;
  doctors: ReceptionistLinkedDoctor[];
}

export interface ReceptionistQueueItem {
  id: string;
  queueNumber: number;
  patientName: string;
  patientPhone: string;
  gender?: string;
  bloodGroup?: string;
  checkingWindow: string;
  estimatedTime: string;
  slotId?: string;
  status: string;
  reasonForVisit?: string;
  symptoms?: string;
  hasPrescription: boolean;
  createdAt: string;
}

export interface DoctorAffiliationsData {
  clinics: Array<{
    affiliationId: string;
    clinicId: string;
    clinicName: string;
    address: string;
    city?: string;
    phone?: string;
    email?: string;
    bookingCount: number;
    revenue: number;
    status: string;
    joinedAt: string;
  }>;
  receptionists: Array<{
    affiliationId: string;
    receptionistId: string;
    fullName: string;
    email: string;
    phone?: string;
    status: string;
    joinedAt: string;
  }>;
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
  slots?: DoctorSlot[];
  clinics?: Array<{
    id: string;
    clinicId: string;
    clinic: ClinicProfile;
  }>;
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
  selectedSlotId?: string;
  selectedSlot?: SlotStatusResult;
  availableSlots?: SlotStatusResult[];
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
  isPassed?: boolean;
  isInProgress?: boolean;
  statusLabel?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  clinicId?: string;
  clinic?: ClinicProfile;
  appointmentDate: string;
  queueNumber: number;
  slotId?: string;
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
    isShiftActive?: boolean;
    isShiftPassed?: boolean;
    liveEstimatedTime?: string;
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
  async getQueuePreview(doctorId: string, appointmentDate: string, slotId?: string): Promise<QueuePreview> {
    const clientMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    try {
      const slotQuery = slotId ? `&slotId=${encodeURIComponent(slotId)}` : '';
      const res = await fetch(
        `${API_BASE_URL}/appointments/queue-preview?doctorId=${doctorId}&appointmentDate=${appointmentDate}&clientMinutes=${clientMinutes}${slotQuery}`
      );
      return await handleResponse(res);
    } catch (err) {
      console.warn('Queue preview API unavailable, using offline preview calculation fallback', err);
      const doctor = DEMO_DOCTORS.find((d) => d.id === doctorId) || DEMO_DOCTORS[0];
      const slots = parseDoctorSlots(doctor);
      const now = new Date();

      const availableSlots: SlotStatusResult[] = slots.map((slot) => {
        return evaluateSlotStatus(slot, appointmentDate, 0, now, clientMinutes);
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
        doctorName: doctor.user.fullName,
        appointmentDate,
        selectedSlotId: chosen.slot.id,
        selectedSlot: chosen,
        availableSlots,
        checkingWindow: chosen.slot.name,
        checkingStartTime: chosen.slot.startTime,
        checkingEndTime: chosen.slot.endTime,
        avgConsultationMinutes: chosen.slot.avgConsultationMinutes,
        maxDailyPatients: chosen.slot.maxPatients,
        totalBooked: chosen.totalBooked,
        nextQueueNumber: 1,
        patientsAhead: chosen.patientsAhead,
        estimatedTime: chosen.estimatedTime,
        isFull: chosen.isFull,
        isPassed: chosen.isPassed,
        isInProgress: chosen.isInProgress,
        statusLabel: chosen.statusLabel,
      };
    }
  },

  async bookAppointment(body: {
    doctorId: string;
    appointmentDate: string;
    slotId?: string;
    reasonForVisit?: string;
    symptoms?: string;
    clinicId?: string;
  }): Promise<Appointment> {
    const clientMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const res = await fetch(`${API_BASE_URL}/appointments/book`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ...body, clientMinutes }),
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

  async getAppointmentById(id: string): Promise<Appointment> {
    const res = await fetch(`${API_BASE_URL}/appointments/${id}`, {
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
    totalClinics: number;
    pendingClinics: number;
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

  async getAdminClinics(): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/admin/clinics`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async verifyClinic(clinicId: string, isVerified: boolean): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/admin/verify-clinic`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ clinicId, isVerified }),
    });
    return handleResponse(res);
  },

  async getAdminAppointments(): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/admin/appointments`, { headers: getHeaders() });
    return handleResponse(res);
  },

  // Clinic Portal
  async getMyClinic(): Promise<ClinicDashboardData> {
    const res = await fetch(`${API_BASE_URL}/clinics/my-clinic`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async addDoctorToClinic(data: { doctorEmail?: string; doctorId?: string }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/clinics/doctors`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async removeDoctorFromClinic(doctorId: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/clinics/doctors/${doctorId}`, {
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
    const res = await fetch(`${API_BASE_URL}/clinics/receptionists`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async getClinicReceptionists(): Promise<ClinicReceptionistItem[]> {
    const res = await fetch(`${API_BASE_URL}/clinics/receptionists`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async updateClinicReceptionistDoctors(receptionistId: string, doctorIds: string[]): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/clinics/receptionists/${receptionistId}/doctors`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ doctorIds }),
    });
    return handleResponse(res);
  },

  async removeClinicReceptionist(receptionistId: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/clinics/receptionists/${receptionistId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getPublicClinics(): Promise<ClinicProfile[]> {
    const res = await fetch(`${API_BASE_URL}/clinics/public`, { headers: getHeaders() });
    return handleResponse(res);
  },

  // Receptionist Portal
  async getMyReceptionist(): Promise<ReceptionistDashboardData> {
    const res = await fetch(`${API_BASE_URL}/receptionists/my-receptionist`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async addDoctorToReceptionist(data: { doctorEmail?: string; doctorId?: string }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/receptionists/doctors`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async removeDoctorFromReceptionist(doctorId: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/receptionists/doctors/${doctorId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getReceptionistDoctorQueue(
    doctorId: string,
    date?: string
  ): Promise<{
    doctor: { id: string; fullName: string; specialty: string; slots: DoctorSlot[] };
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
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  async bookWalkinAppointment(data: {
    doctorId: string;
    patientName: string;
    patientPhone: string;
    gender?: string;
    appointmentDate?: string;
    slotId?: string;
    reasonForVisit?: string;
    symptoms?: string;
    clinicId?: string;
  }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/receptionists/book-walkin`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateAppointmentStatus(appointmentId: string, status: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/receptionists/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse(res);
  },

  // Doctor Affiliations
  async getDoctorAffiliations(): Promise<DoctorAffiliationsData> {
    const res = await fetch(`${API_BASE_URL}/doctors/me/affiliations`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async addDoctorClinic(data: { clinicId?: string; clinicEmail?: string }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/doctors/me/clinics`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async removeDoctorClinic(clinicId: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/doctors/me/clinics/${clinicId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async addDoctorReceptionist(data: { receptionistEmail: string }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/doctors/me/receptionists`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async removeDoctorReceptionist(receptionistId: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/doctors/me/receptionists/${receptionistId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
};
