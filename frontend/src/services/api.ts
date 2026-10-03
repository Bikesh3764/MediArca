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
  if (filePath.startsWith('data:') || filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  if (filePath.startsWith('r2://')) {
    const clean = filePath.replace(/^r2:\/\//, '');
    const r2PublicUrl =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_R2_PUBLIC_URL) ||
      'https://pub-a590817d9f404eb889f6482b025ea9ad.r2.dev';
    return `${r2PublicUrl}/${clean}`;
  }
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

export const formatDoctorDegrees = (qualifications?: string | null): string => {
  if (!qualifications || !qualifications.trim()) return 'Certified Specialist';

  // Recognized primary & postgrad medical/dental/AYUSH degrees & recognized clinical PG diplomas
  const RECOGNIZED_DEGREES_MAP: Record<string, string> = {
    MBBS: 'MBBS',
    MD: 'MD',
    MS: 'MS',
    DM: 'DM',
    MCH: 'MCh',
    BDS: 'BDS',
    MDS: 'MDS',
    DNB: 'DNB',
    BAMS: 'BAMS',
    BHMS: 'BHMS',
    BUMS: 'BUMS',
    BSMS: 'BSMS',
    BNYS: 'BNYS',
    BVSC: 'BVSc',
    BPT: 'BPT',
    MPT: 'MPT',
    BOT: 'BOT',
    MOT: 'MOT',
    DO: 'DO',
    PHD: 'PhD',
    MPH: 'MPH',
    MHA: 'MHA',
    DGO: 'DGO',
    DCH: 'DCH',
    DMRD: 'DMRD',
    DORTHO: 'DOrtho',
    DA: 'DA',
    DTCD: 'DTCD',
    DDVL: 'DDVL',
    DVD: 'DVD',
    DPM: 'DPM',
    DOMS: 'DOMS',
    DLO: 'DLO',
    MBCHB: 'MBChB',
    BMBS: 'BMBS',
    BCHIR: 'BChir',
    BMED: 'BMed',
    MRCGP: 'MRCGP',
  };

  // Strip parenthetical text such as "(Cardiology)", "(Pediatrics)", etc. to extract core degree
  const cleanedInput = qualifications.replace(/\([^)]*\)/g, ' ');

  // Non-degree patterns:
  // 1. Fellowships starting with F followed by 2-5 uppercase letters (FACC, FACS, FAAP, FACP, FRCS, FRCP, FRCOG, FICOG, FAGE, FAOI, FIAP, FNB, FAMS, FICO, FICS, FCCP, FCPS, FACR, FAAD, FESC, FAHA, FICM, etc.)
  // 2. Fluff words: fellow, fellowship, diplomate, member, board certified, board eligible, certified, specialist, consultant, physician, surgeon, general
  // 3. Institution/University/Hospital/Location fluff: university, college, school, hospital, institute, academy, faculty, campus, stanford, harvard, hopkins, oxford, cambridge, aiims, pgi, yale, columbia, boston, london, etc.
  const NON_DEGREE_PATTERN = /\b(f[a-z]{2,5}|fellow|fellowship|diplomate|member|board\s*certified|board\s*eligible|certified|specialist|consultant|physician|surgeon|general|university|college|school|hospital|institute|academy|faculty|campus|stanford|harvard|hopkins|oxford|cambridge|aiims|pgi|yale|columbia|boston|london)\b/i;

  const parts = cleanedInput.split(/[,;\n/]+/);
  const collectedDegrees: string[] = [];

  for (const part of parts) {
    const subSegments = part.split(/\s*[-–—]\s*/);
    for (const sub of subSegments) {
      const trimmed = sub.trim().replace(/\.+/g, '');
      if (!trimmed) continue;
      if (NON_DEGREE_PATTERN.test(trimmed)) continue;

      const upper = trimmed.toUpperCase();
      if (RECOGNIZED_DEGREES_MAP[upper]) {
        const canonical = RECOGNIZED_DEGREES_MAP[upper];
        if (!collectedDegrees.includes(canonical)) {
          collectedDegrees.push(canonical);
        }
      }
    }
  }

  if (collectedDegrees.length > 0) {
    return collectedDegrees.join(', ');
  }

  return 'Certified Specialist';
};

export const getLocalDateString = (d: Date = new Date()): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  } catch {
    const istMs = d.getTime() + 330 * 60 * 1000;
    const istDate = new Date(istMs);
    const year = istDate.getUTCFullYear();
    const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

export const getIndianTimeMinutes = (d: Date = new Date()): number => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(d);
    let hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    if (hour === 24) hour = 0;
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    return hour * 60 + minute;
  } catch {
    const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();
    return (utcMinutes + 330) % (24 * 60);
  }
};

export const getTomorrowDateString = (d: Date = new Date()): string => {
  const tomorrow = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  return getLocalDateString(tomorrow);
};

export const DEFAULT_PHONE_PREFIX = '+91 ';

export const ALL_SPECIALTIES: string[] = [
  'General Medicine',
  'Cardiology',
  'Dermatology',
  'Pediatrics',
  'Orthopedics',
  'Neurology',
  'Gynecology & Obstetrics',
  'Gastroenterology',
  'Oncology',
  'Ophthalmology',
  'ENT / Otorhinolaryngology',
  'Pulmonology',
  'Nephrology',
  'Urology',
  'Psychiatry',
  'Endocrinology',
  'Rheumatology',
  'Dentistry',
  'Physiotherapy',
  'General Surgery',
  'Plastic Surgery',
  'Neurosurgery',
  'Cardiothoracic Surgery',
  'Anesthesiology',
  'Radiology',
  'Pathology',
  'Emergency Medicine',
  'Hematology',
  'Allergy & Immunology',
  'Infectious Disease',
  'Ayurveda',
  'Homeopathy',
  'Dietetics & Nutrition',
  'Other',
];

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
      : getIndianTimeMinutes(now);

  const slotStartMins = timeToMinutes(slot.startTime);
  let slotEndMins = timeToMinutes(slot.endTime);
  if (slotEndMins <= slotStartMins) {
    slotEndMins += 24 * 60;
  }

  const patientsAhead = bookedCountForSlot;
  let isPassed = false;
  let isInProgress = false;
  let isUpcoming = false;
  let statusLabel = 'Available';
  let estimatedTime = '';

  // Check if slot has reached maximum allowed patients
  const isCapacityFull = bookedCountForSlot >= slot.maxPatients;
  const isFull = isCapacityFull;

  if (isPastDate) {
    isPassed = true;
    statusLabel = 'Date Expired';
    estimatedTime = 'Date Expired';
  } else if (isToday) {
    if (currentMinutes >= slotEndMins) {
      // Time has passed for this slot today!
      isPassed = true;
      statusLabel = 'Shift Ended for Today';
      estimatedTime = 'Shift Ended';
    } else if (currentMinutes >= slotStartMins && currentMinutes < slotEndMins) {
      // Active in-progress right now!
      isInProgress = true;
      statusLabel = isFull ? 'Fully Booked' : 'Active Now • In Progress';
      const offsetMins = patientsAhead * slot.avgConsultationMinutes;
      // When active, next consultation cannot happen before current time
      const estTotal = Math.max(slotStartMins + offsetMins, currentMinutes + offsetMins);
      estimatedTime = isFull ? 'Shift Full' : minutesTo12Hour(estTotal);
    } else {
      // Before slot start time today
      isUpcoming = true;
      statusLabel = isFull ? 'Fully Booked' : 'Upcoming Today';
      const offsetMins = patientsAhead * slot.avgConsultationMinutes;
      const estTotal = slotStartMins + offsetMins;
      estimatedTime = isFull ? 'Shift Full' : minutesTo12Hour(estTotal);
    }
  } else {
    // Future date
    isUpcoming = true;
    statusLabel = isFull ? 'Fully Booked' : 'Upcoming';
    const offsetMins = patientsAhead * slot.avgConsultationMinutes;
    const estTotal = slotStartMins + offsetMins;
    estimatedTime = isFull ? 'Shift Full' : minutesTo12Hour(estTotal);
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
    qualifications: 'MD',
    experienceYears: 14,
    consultationFee: 800,
    bio: 'Specialist in preventive cardiology, hypertension, coronary artery disease, and heart failure management with over 14 years of clinical experience.',
    clinicAddress: 'City Heart & Vascular Institute, Suite 402, Bandra West, Mumbai, MH',
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
    clinics: [
      {
        id: 'cd_sarah_1',
        clinicId: 'clinic_demo_1',
        clinic: {
          id: 'clinic_demo_1',
          clinicName: 'City Heart & Vascular Institute',
          address: 'Suite 402, Hill Road, Bandra West',
          city: 'Mumbai',
          phone: '+91 98200 12345',
          isVerified: true,
        },
      },
      {
        id: 'cd_sarah_2',
        clinicId: 'clinic_demo_2',
        clinic: {
          id: 'clinic_demo_2',
          clinicName: 'Mumbai Specialty Outpatient Clinic',
          address: 'Floor 3, Linking Road, Khar West',
          city: 'Mumbai',
          phone: '+91 98200 54321',
          isVerified: true,
        },
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
    qualifications: 'MD',
    experienceYears: 10,
    consultationFee: 650,
    bio: 'Consultant dermatologist focusing on acne, eczema, psoriasis, skin cancer screening, and cosmetic laser treatments.',
    clinicAddress: 'Apex Skin & Aesthetics Clinic, Floor 2, Indiranagar, Bengaluru, KA',
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
    clinics: [
      {
        id: 'cd_arjun_1',
        clinicId: 'clinic_demo_3',
        clinic: {
          id: 'clinic_demo_3',
          clinicName: 'Apex Skin & Aesthetics Clinic',
          address: 'Floor 2, 100 Feet Road, Indiranagar',
          city: 'Bengaluru',
          phone: '+91 98450 11223',
          isVerified: true,
        },
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
    qualifications: 'MD',
    experienceYears: 12,
    consultationFee: 700,
    bio: 'Dedicated pediatrician providing comprehensive child wellness care, developmental tracking, vaccinations, and adolescent healthcare.',
    clinicAddress: 'Little Steps Children Care, Building B, Vasant Vihar, New Delhi, DL',
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
    clinics: [
      {
        id: 'cd_elena_1',
        clinicId: 'clinic_demo_4',
        clinic: {
          id: 'clinic_demo_4',
          clinicName: 'Little Steps Children Care',
          address: 'Building B, Community Centre, Vasant Vihar',
          city: 'New Delhi',
          phone: '+91 98110 33445',
          isVerified: true,
        },
      },
      {
        id: 'cd_elena_2',
        clinicId: 'clinic_demo_5',
        clinic: {
          id: 'clinic_demo_5',
          clinicName: 'Metro Pediatric Center',
          address: 'Suite 104, Palam Marg, Vasant Vihar',
          city: 'New Delhi',
          phone: '+91 98110 55667',
          isVerified: true,
        },
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
  mustChangePassword?: boolean;
  patientProfile?: {
    id: string;
    bloodGroup?: string;
    allergies?: string;
    existingConditions?: string;
    emergencyContact?: string;
    dateOfBirth?: string;
    gender?: string;
    currentMedications?: string;
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
    verificationStatus?: 'PENDING' | 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | string;
    checkingStartTime: string;
    checkingEndTime: string;
    avgConsultationMinutes: number;
    maxDailyPatients: number;
    rating: number;
    totalReviews: number;
    slots?: DoctorSlot[];
    cabinStatus?: 'IN_CABIN' | 'STEPPED_OUT' | 'NOT_IN_CABIN' | string;
    expectedReturnTime?: string | null;
    cabinStatusUpdatedAt?: string | null;
  };
  clinicProfile?: ClinicProfile;
  receptionistProfile?: ReceptionistProfile;
}

export interface PublicClinicDoctor {
  id: string;
  clinicId: string;
  doctorId: string;
  status: string;
  consultationFee?: number | null;
  slots?: DoctorSlot[] | string | null;
  doctor: Doctor;
}

export interface ClinicProfile {
  id: string;
  clinicName: string;
  address: string;
  city?: string;
  state?: string;
  phone?: string;
  isVerified?: boolean;
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | string;
  checkinCode?: string | null;
  createdAt?: string;
  _count?: {
    doctors?: number;
  };
  doctors?: PublicClinicDoctor[];
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
  incomingRequests?: Array<ClinicDoctorStat & { requestedAt?: string }>;
  outgoingRequests?: Array<ClinicDoctorStat & { requestedAt?: string }>;
  receptionists?: ClinicReceptionistItem[];
  incomingReceptionists?: Array<{
    id: string;
    userId: string;
    fullName: string;
    email: string;
    phone?: string;
    status: string;
    createdAt: string;
  }>;
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
  cabinStatus?: 'IN_CABIN' | 'STEPPED_OUT' | 'NOT_IN_CABIN' | string;
  expectedReturnTime?: string | null;
  cabinStatusUpdatedAt?: string | null;
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
  isCheckedIn?: boolean;
  checkedInAt?: string | null;
  reasonForVisit?: string;
  symptoms?: string;
  isForOther?: boolean;
  patientAge?: string;
  createdAt: string;
}

export interface DoctorAffiliationClinic {
  affiliationId: string;
  clinicId: string;
  clinicName: string;
  address: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  bookingCount?: number;
  revenue?: number;
  consultationFee?: number;
  slots?: DoctorSlot[];
  status: string;
  requestedBy?: string;
  joinedAt?: string;
  requestedAt?: string;
}

export interface DoctorAffiliationsData {
  clinics: DoctorAffiliationClinic[];
  incomingRequests?: DoctorAffiliationClinic[];
  outgoingRequests?: DoctorAffiliationClinic[];
  receptionists: Array<{
    affiliationId: string;
    receptionistId: string;
    fullName: string;
    email: string;
    phone?: string;
    clinicId?: string;
    clinicName?: string;
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
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | string;
  checkingStartTime: string;
  checkingEndTime: string;
  avgConsultationMinutes: number;
  maxDailyPatients: number;
  rating: number;
  totalReviews: number;
  slots?: DoctorSlot[];
  cabinStatus?: 'IN_CABIN' | 'STEPPED_OUT' | 'NOT_IN_CABIN' | string;
  expectedReturnTime?: string | null;
  cabinStatusUpdatedAt?: string | null;
  clinics?: Array<{
    id: string;
    clinicId: string;
    clinic: ClinicProfile;
    consultationFee?: number;
    slots?: DoctorSlot[];
    receptionists?: Array<{
      id: string;
      name: string;
      phone?: string;
    }>;
  }>;
  receptionists?: Array<{
    id: string;
    name: string;
    phone?: string;
    clinicId?: string;
    clinicName?: string;
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
  consultationFee?: number;
  clinicId?: string | null;
  clinicName?: string | null;
  selectedClinic?: {
    clinicId: string;
    clinicName: string;
    address: string;
    city?: string;
    phone?: string;
    consultationFee?: number;
  } | null;
  hasClinics?: boolean;
  clinicsCount?: number;
  clinics?: Array<{
    clinicId: string;
    clinicName: string;
    address: string;
    city?: string;
    phone?: string;
    consultationFee?: number;
    slots?: DoctorSlot[];
  }>;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  clinicId?: string;
  clinic?: ClinicProfile;
  appointmentDate: string;
  queueNumber: number;
  estimatedQueueNumber?: number;
  slotId?: string;
  checkingWindow: string;
  estimatedTime: string;
  status: 'PENDING_APPROVAL' | 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';
  paymentStatus?: 'PENDING' | 'PAID' | 'FAILED' | string;
  approvedBy?: string;
  approvedAt?: string;
  isPendingApproval?: boolean;
  clinicPhone?: string;
  receptionistPhone?: string | null;
  receptionistName?: string | null;
  fee?: number;
  reasonForVisit?: string;
  symptoms?: string;
  vitals?: string;
  clinicalNotes?: string;
  isForOther?: boolean;
  patientName?: string;
  patientPhone?: string;
  patientAge?: string;
  patientGender?: string;
  isCheckedIn?: boolean;
  checkedInAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  doctor: Doctor;
  patient?: {
    id: string;
    userId: string;
    gender?: string;
    dateOfBirth?: string;
    bloodGroup?: string;
    allergies?: string;
    existingConditions?: string;
    currentMedications?: string;
    emergencyContact?: string;
    user: { fullName: string; email: string; phone?: string; avatarUrl?: string };
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
    estimatedQueueNumber?: number;
  };
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'APPOINTMENT' | 'QUEUE' | 'CLINICAL' | 'SYSTEM' | string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
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
    const error: any = new Error(data.message || 'API request failed');
    if (data.requiresVerification) {
      error.requiresVerification = true;
      error.email = data.email;
    }
    throw error;
  }
  return data.data !== undefined ? data.data : data;
}

export const api = {
  // Auth
  async register(body: any): Promise<{ user?: User; token?: string; requiresVerification?: boolean; email?: string; message?: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async verifyEmailOtp(body: { email: string; otp: string }): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async resendEmailOtp(email: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
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

  async updateUserProfile(body: any): Promise<User> {
    const res = await fetch(`${API_BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async updateDoctorProfile(body: any): Promise<User> {
    const res = await fetch(`${API_BASE_URL}/doctors/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async uploadAvatar(file: File): Promise<{ avatarUrl: string; user: User }> {
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/avatar`, {
        method: 'POST',
        headers: getHeaders(true),
        body: formData,
      });
      return await handleResponse(res);
    } catch (err) {
      console.warn('Backend multipart avatar upload failed, attempting fallback to base64 profile update', err);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const updated = await this.updateProfile({ avatarUrl: dataUrl });
      return { avatarUrl: dataUrl, user: updated };
    }
  },

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

      const res = await fetch(`${API_BASE_URL}/doctors?${query.toString()}`);
      return await handleResponse(res);
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

  async getDoctorById(id: string): Promise<Doctor> {
    try {
      const res = await fetch(`${API_BASE_URL}/doctors/${id}`, {
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

  async getDoctorReviews(doctorId: string): Promise<{
    rating: number;
    totalReviews: number;
    reviews: Array<{
      id: string;
      rating: number;
      comment?: string;
      createdAt: string;
      patientUser: { fullName: string };
    }>;
  }> {
    const res = await fetch(`${API_BASE_URL}/doctors/${doctorId}/reviews`);
    return await handleResponse(res);
  },

  async updateDoctorSchedule(body: any): Promise<Doctor> {
    const res = await fetch(`${API_BASE_URL}/doctors/schedule`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
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
    const res = await fetch(`${API_BASE_URL}/doctors/cabin-status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // Appointments & Queue Preview
  async getQueuePreview(doctorId: string, appointmentDate: string, slotId?: string, clinicId?: string): Promise<QueuePreview> {
    try {
      const slotQuery = slotId ? `&slotId=${encodeURIComponent(slotId)}` : '';
      const clinicQuery = clinicId ? `&clinicId=${encodeURIComponent(clinicId)}` : '';
      const res = await fetch(
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

  async getAppointmentById(id: string): Promise<Appointment> {
    const res = await fetch(`${API_BASE_URL}/appointments/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async checkInWithQR(data: { clinicId: string; code: string; appointmentId?: string }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/appointments/check-in`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async checkInAppointmentDirect(appointmentId: string, isCheckedIn?: boolean): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/appointments/${appointmentId}/check-in`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(isCheckedIn !== undefined ? { isCheckedIn } : {}),
    });
    return handleResponse(res);
  },

  async submitAppointmentReview(
    appointmentId: string,
    data: { rating: number; comment?: string }
  ): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/appointments/${appointmentId}/review`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // Doctor Consultation & Queue Console
  async getDoctorQueue(
    date?: string,
    scope?: 'date' | 'all-upcoming'
  ): Promise<{
    date: string;
    scope?: string;
    totalQueue: number;
    activeInConsultation: Appointment | null;
    waitingQueue: Appointment[];
    completedQueue: Appointment[];
    allAppointments: Appointment[];
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
    const qs = params.toString();
    const url = qs ? `${API_BASE_URL}/consultations/queue?${qs}` : `${API_BASE_URL}/consultations/queue`;
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

  async updateNotes(body: {
    appointmentId: string;
    vitals?: any;
    clinicalNotes?: string;
    diagnosis?: string;
    medicines?: any[];
    advice?: string;
    followUpDate?: string;
  }): Promise<Appointment> {
    const res = await fetch(`${API_BASE_URL}/consultations/notes`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async saveConsultationNotes(body: {
    appointmentId: string;
    vitals?: any;
    clinicalNotes?: string;
    diagnosis?: string;
    medicines?: any[];
    advice?: string;
    followUpDate?: string;
  }): Promise<Appointment> {
    return this.updateNotes(body);
  },

  async completeConsultation(body: {
    appointmentId: string;
    diagnosis?: string;
    advice?: string;
    followUpDate?: string;
    clinicalNotes?: string;
    vitals?: any;
    medicines?: any[];
  }): Promise<{ appointment: Appointment }> {
    const res = await fetch(`${API_BASE_URL}/consultations/complete`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async completePrescription(body: {
    appointmentId: string;
    diagnosis?: string;
    medicines?: any[];
    advice?: string;
    followUpDate?: string;
    clinicalNotes?: string;
    vitals?: any;
  }): Promise<{ appointment: Appointment; prescription?: any }> {
    return this.completeConsultation(body) as any;
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

  async verifyDoctor(
    doctorId: string,
    action: boolean | 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | 'PENDING'
  ): Promise<Doctor> {
    const payload =
      typeof action === 'boolean'
        ? { doctorId, isVerified: action, status: action ? 'VERIFIED' : 'SUSPENDED' }
        : { doctorId, isVerified: action === 'VERIFIED', status: action };
    const res = await fetch(`${API_BASE_URL}/admin/verify-doctor`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async getAdminClinics(): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/admin/clinics`, { headers: getHeaders() });
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
    const res = await fetch(`${API_BASE_URL}/admin/verify-clinic`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
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

  async getPublicClinics(params?: { search?: string; city?: string; state?: string }): Promise<ClinicProfile[]> {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.city && params.city !== 'All') query.append('city', params.city);
      if (params?.state && params.state !== 'All') query.append('state', params.state);
      const qs = query.toString();
      const url = qs ? `${API_BASE_URL}/clinics/public?${qs}` : `${API_BASE_URL}/clinics/public`;
      const res = await fetch(url, { headers: getHeaders() });
      return await handleResponse(res);
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

  async getPublicClinicById(id: string): Promise<ClinicProfile> {
    try {
      const res = await fetch(`${API_BASE_URL}/clinics/public/${id}`, { headers: getHeaders() });
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
    const res = await fetch(url, { headers: getHeaders() });
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

  async changeReceptionistPassword(data: { currentPassword: string; newPassword: string }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/receptionists/change-password`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'API request failed');
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

  // Clinic Doctor Affiliation Response
  async respondToDoctorAffiliation(affiliationId: string, action: 'ACCEPT' | 'REJECT'): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/clinic/affiliations/${affiliationId}/respond`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ action }),
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

  async respondToClinicAffiliation(affiliationId: string, action: 'ACCEPT' | 'REJECT'): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/doctors/me/affiliations/${affiliationId}/respond`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ action }),
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

  // Receptionist Pending Appointments & Approval Operations
  async getPendingAppointments(): Promise<Appointment[]> {
    const res = await fetch(`${API_BASE_URL}/receptionists/pending-appointments`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async approveAppointment(appointmentId: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/receptionists/appointments/${appointmentId}/approve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async rejectAppointment(appointmentId: string, reason?: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/receptionists/appointments/${appointmentId}/reject`, {
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
    const res = await fetch(`${API_BASE_URL}/receptionists/apply`, {
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
    const res = await fetch(`${API_BASE_URL}/clinic/receptionists/${receptionistId}/respond`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ action, doctorIds }),
    });
    return handleResponse(res);
  },

  // Notifications (BUG-13)
  async getNotifications(): Promise<{ notifications: any[]; unreadCount: number }> {
    const res = await fetch(`${API_BASE_URL}/notifications`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async markNotificationRead(id: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async markAllNotificationsRead(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
};
