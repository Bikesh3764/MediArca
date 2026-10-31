import { DoctorLeave, DoctorSlot, SlotStatusResult } from './schedule';

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
    slots?: DoctorSlot[];
    cabinStatus?: 'IN_CABIN' | 'STEPPED_OUT' | 'NOT_IN_CABIN' | string;
    expectedReturnTime?: string | null;
    cabinStatusUpdatedAt?: string | null;
    workingDays?: string | null;
    leaves?: string | null;
    isOnLeaveToday?: boolean;
    todayLeave?: DoctorLeave | null;
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
  hasReceptionist?: boolean;
  doctor: Doctor;
}

export interface ClinicProfile {
  id: string;
  clinicName: string;
  fullName?: string;
  address: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string | null;
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

export interface ClinicalReportAppointment {
  id: string;
  queueNumber: number;
  appointmentDate: string;
  checkingWindow: string;
  status: string;
  paymentStatus: string;
  patientName: string;
  patientPhone: string;
  doctorId?: string;
  doctorName?: string;
  specialty?: string;
  clinicId?: string;
  clinicName?: string;
  fee: number;
  earnedRevenue: number;
}

export interface ClinicalReportDoctorBreakdown {
  doctorId: string;
  doctorName: string;
  specialty: string;
  bookings: number;
  completed: number;
  cancelled: number;
  revenue: number;
}

export interface ClinicalReportClinicBreakdown {
  clinicId: string;
  clinicName: string;
  city: string;
  bookings: number;
  completed: number;
  cancelled: number;
  revenue: number;
}

export interface ClinicalReportShiftBreakdown {
  shiftName: string;
  bookings: number;
  completed: number;
  revenue: number;
}

export interface ClinicalReportData {
  success: boolean;
  reportType: 'CLINIC' | 'DOCTOR' | 'RECEPTIONIST';
  facility?: {
    id: string;
    name: string;
    city: string;
    address: string;
    phone?: string;
  };
  doctor?: {
    id: string;
    name: string;
    specialty: string;
    phone?: string;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
  selectedDoctorId?: string;
  selectedClinicId?: string;
  summary: {
    totalBookings: number;
    completedCount: number;
    inConsultationCount: number;
    waitingCount: number;
    cancelledCount: number;
    totalRevenue: number;
  };
  byDoctor?: ClinicalReportDoctorBreakdown[];
  byClinic?: ClinicalReportClinicBreakdown[];
  byShift?: ClinicalReportShiftBreakdown[];
  appointments: ClinicalReportAppointment[];
  /** More visits than maxRows in this period; only the newest maxRows were sent (FIX-051) */
  truncated?: boolean;
  maxRows?: number;
}

export interface ClinicDashboardData {
  clinic: ClinicProfile;
  doctors: ClinicDoctorStat[];
  incomingRequests?: Array<ClinicDoctorStat & { requestedAt?: string }>;
  outgoingRequests?: Array<ClinicDoctorStat & { requestedAt?: string }>;
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
  cabinStatus?: 'IN_CABIN' | 'STEPPED_OUT' | 'NOT_IN_CABIN' | string;
  expectedReturnTime?: string | null;
  cabinStatusUpdatedAt?: string | null;
  workingDays?: string[];
  leaves?: DoctorLeave[];
  isOnLeaveToday?: boolean;
  todayLeave?: DoctorLeave | null;
  isWorkingToday?: boolean;
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
  doctorId?: string;
  queueNumber: number;
  patientName: string;
  patientPhone: string;
  walkInCode?: string | null;
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
  appointmentDate?: string;
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
  workingDays?: string[];
  leaves?: DoctorLeave[];
  isOnLeaveToday?: boolean;
  todayLeave?: DoctorLeave | null;
  isWorkingToday?: boolean;
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
export interface ContactMessageItem {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  status: 'NEW' | 'READ' | 'RESOLVED' | string;
  createdAt: string;
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
    hasReceptionist?: boolean;
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
  slotQueueNumber?: number;
  dailyQueueNumber?: number;
  patientsAhead: number;
  estimatedTime: string;
  isFull: boolean;
  isPassed?: boolean;
  isInProgress?: boolean;
  statusLabel?: string;
  isOnLeave?: boolean;
  leaveReason?: string | null;
  isDayOff?: boolean;
  dayName?: string;
  workingDays?: string[];
  leaves?: any[];
  consultationFee?: number;
  clinicId?: string | null;
  clinicName?: string | null;
  hasReceptionist?: boolean;
  selectedClinic?: {
    clinicId: string;
    clinicName: string;
    address: string;
    city?: string;
    phone?: string;
    consultationFee?: number;
    hasReceptionist?: boolean;
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
    hasReceptionist?: boolean;
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
  isForOther?: boolean;
  patientName?: string;
  patientPhone?: string;
  patientAge?: string;
  patientGender?: string;
  /** 6-character code staff give a walk-in to track the queue on the home page (FIX-058). */
  walkInCode?: string | null;
  isCheckedIn?: boolean;
  checkedInAt?: string | null;
  completedAt?: string | null;
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
  liveQueue?: {
    currentServingQueueNumber: number;
    patientsAway: number;
    estimatedWaitMinutes: number;
    isYourTurn: boolean;
    isShiftActive?: boolean;
    isShiftPassed?: boolean;
    liveEstimatedTime?: string;
    /** Why the queue isn't moving yet (server: utils/queueEta.ts). */
    delayReason?: 'BEFORE_SHIFT' | 'STEPPED_OUT' | 'DOCTOR_NOT_IN' | null;
    estimatedQueueNumber?: number;
  };
}

/** Public walk-in tracker answer (POST /appointments/walkin-track, FIX-058). */
export interface WalkinTrackResult {
  walkInCode: string;
  patientName: string | null;
  queueNumber: number;
  status: string;
  appointmentDate: string;
  checkingWindow: string;
  estimatedTime: string;
  doctor: {
    fullName: string | null;
    avatarUrl: string | null;
    specialty: string | null;
    cabinStatus: string | null;
    expectedReturnTime: string | null;
  };
  clinic: { clinicName: string; address: string; city: string | null; avatarUrl: string | null } | null;
  receptionistName: string | null;
  receptionistPhone: string | null;
  liveQueue: {
    currentServingQueueNumber: number;
    patientsAway: number;
    estimatedWaitMinutes: number;
    isYourTurn: boolean;
    isShiftActive: boolean;
    isShiftPassed: boolean;
    liveEstimatedTime: string;
    delayReason: 'BEFORE_SHIFT' | 'STEPPED_OUT' | 'DOCTOR_NOT_IN' | null;
  } | null;
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


export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
  pagination: PaginationMeta;
}
