import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  api,
  Appointment,
  parseDoctorSlots,
  format12Hour,
  formatShiftOption,
  getLocalDateString,
  getTomorrowDateString,
  DoctorAffiliationsData,
  ClinicProfile,
} from '../../services/api';
import { WeekdayDisplay } from '../../components/common/WeekdayDisplay';
import { sanitizeIndianPhone, formatIndianPhone, isValidIndianPhone } from '../../utils/phoneUtils';
import { useVisibilityPolling } from '../../utils/useVisibilityPolling';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { CabinStatusControl } from '../../components/ui/DoctorCabinPresence';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileEdit,
  RefreshCw,
  Building2,
  Trash2,
  Plus,
  AlertCircle,
  X,
  Search,
  MapPin,
  Settings,
  Check,
  Clock3,
  LayoutDashboard,
  Calendar,
  CalendarX,
  QrCode,
  ChevronDown,
  Phone,
  PauseCircle,
  SlidersHorizontal,
  FileText,
} from 'lucide-react';
import { ClinicQrStandeeModal } from '../../components/common/ClinicQrStandeeModal';
import { ClinicalReportModal } from '../../components/common/ClinicalReportModal';
import { DoctorScheduleLeaveModal } from '../../components/common/DoctorScheduleLeaveModal';
import { AppleFilterSelect, AppleFilterOption } from '../../components/ui/AppleFilterSelect';

const getYesterdayDateString = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
};

const getCleanReason = (reason?: string | null, patientName?: string | null): string | null => {
  if (!reason) return null;
  const r = reason.trim();
  if (!r) return null;

  const normReason = r.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normName = (patientName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // If redundant with patient's name
  if (normName && (normName.includes(normReason) || normReason.includes(normName))) {
    return null;
  }

  const lower = r.toLowerCase();
  // If matches test noise, placeholders, or generic boilerplate
  if (
    lower.includes('concurrent') ||
    lower.includes('walkin') ||
    lower.includes('walk-in') ||
    lower.includes('verification') ||
    lower.includes('approval test') ||
    lower === 'general consultation' ||
    lower === 'general medical consultation' ||
    lower === 'routine checkup' ||
    lower === 'consultation' ||
    lower === 'checkup' ||
    lower === 'general visit' ||
    lower === 'clinic walk-in consultation' ||
    lower === 'rapid walk-in consultation'
  ) {
    return null;
  }
  return r;
};

const matchesSlot = (appt: Appointment, slotId: string, slotObj?: any): boolean => {
  if (slotId === 'all') return true;
  if (appt.slotId && appt.slotId === slotId) return true;
  if (slotObj) {
    if (slotObj.id && appt.slotId && appt.slotId === slotObj.id) return true;
    if (slotObj.startTime && appt.checkingWindow?.includes(slotObj.startTime)) return true;
    if (slotObj.name && appt.checkingWindow?.toLowerCase().includes(slotObj.name.toLowerCase())) return true;
    if (slotObj.shiftName && appt.checkingWindow?.toLowerCase().includes(slotObj.shiftName.toLowerCase())) return true;
    if (slotObj.name) {
      const match = slotObj.name.match(/(Shift\s*\d+)/i);
      if (match && appt.checkingWindow?.toLowerCase().includes(match[1].toLowerCase())) return true;
    }
  }
  return false;
};

const getSlotShortLabel = (appt: Appointment, slots: any[]): string => {
  if (appt.slotId) {
    const matched = slots.find((s) => s.id === appt.slotId);
    if (matched) {
      return `Shift ${slots.indexOf(matched) + 1}`;
    }
  }
  if (appt.checkingWindow) {
    const shiftMatch = appt.checkingWindow.match(/(Shift\s*\d+)/i);
    if (shiftMatch) return shiftMatch[1];
    const matched = slots.find((s) => s.startTime && appt.checkingWindow?.includes(s.startTime));
    if (matched) {
      return `Shift ${slots.indexOf(matched) + 1}`;
    }
  }
  return 'Shift 1';
};

export const DoctorDashboard: React.FC = () => {
  const { user, loading: loadingAuth, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isStandeeModalOpen, setIsStandeeModalOpen] = useState(false);
  const [selectedStandeeClinic, setSelectedStandeeClinic] = useState<{
    clinicId: string;
    clinicName: string;
    clinicAddress?: string;
    clinicPhone?: string;
    checkinCode?: string;
  } | null>(null);

  const activeTab = searchParams.get('tab') === 'affiliations' ? 'affiliations' : 'queue';
  const setActiveTab = useCallback((tab: 'queue' | 'affiliations') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'affiliations') {
        next.set('tab', 'affiliations');
      } else {
        next.delete('tab');
      }
      return next;
    });
  }, [setSearchParams]);

  const [affiliations, setAffiliations] = useState<DoctorAffiliationsData | null>(null);
  const [publicClinics, setPublicClinics] = useState<ClinicProfile[]>([]);
  const [affiliationsLoading, setAffiliationsLoading] = useState(false);

  // Form and modal states for clinic affiliation
  const [isAffiliateModalOpen, setIsAffiliateModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [scheduleLeaveModalClinic, setScheduleLeaveModalClinic] = useState<{ clinicId?: string; clinicName?: string } | null>(null);
  const [clinicSearchQuery, setClinicSearchQuery] = useState('');
  const [clinicStateFilter, setClinicStateFilter] = useState('All');
  const [clinicCityFilter, setClinicCityFilter] = useState('All');
  const [affiliatingClinicId, setAffiliatingClinicId] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [date, setDate] = useState<string>(() => getLocalDateString());
  const [queueScope, setQueueScope] = useState<'date' | 'all-upcoming'>('date');
  const [selectedClinicId, setSelectedClinicId] = useState<string>('all');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('all');
  const [queueFiltersDrawerOpen, setQueueFiltersDrawerOpen] = useState(false);
  const [queueSearch, setQueueSearch] = useState('');
  const [queueData, setQueueData] = useState<{
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
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [callingId, setCallingId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleClinicChange = (clinicId: string) => {
    setSelectedClinicId(clinicId);
    setSelectedSlotId('all');
  };

  const fetchQueue = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await api.getDoctorQueue(
        queueScope === 'date' ? date : undefined,
        queueScope
      );
      setQueueData(data);
      setFetchError(null);
    } catch (err: any) {
      console.error('Failed to load doctor queue:', err);
      setFetchError(err.message || 'Unable to connect to healthcare backend');
    } finally {
      setLoading(false);
    }
  }, [date, queueScope]);

  const fetchAffiliations = useCallback(async (showLoading = true) => {
    if (showLoading) setAffiliationsLoading(true);
    try {
      const [affRes, pubClinics] = await Promise.all([
        api.getDoctorAffiliations(),
        api.getPublicClinics(),
      ]);
      setAffiliations(affRes);
      setPublicClinics(pubClinics);
    } catch (err: any) {
      console.error('Failed to load affiliations:', err);
    } finally {
      setAffiliationsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    if (loadingAuth) return;
    if (!user || user.role?.toUpperCase() !== 'DOCTOR') {
      navigate('/login');
      return;
    }
    queueMicrotask(() => {
      if (mounted) {
        fetchQueue(false);
        fetchAffiliations(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [fetchQueue, fetchAffiliations, user, loadingAuth, navigate]);

  // Auto-refresh queue every 10 seconds only while tab is active/visible (FIX-012)
  useVisibilityPolling(
    () => fetchQueue(false),
    10000,
    Boolean(user) && user?.role?.toUpperCase() === 'DOCTOR' && !loadingAuth
  );

  useEffect(() => {
    let mounted = true;
    if (activeTab === 'affiliations') {
      queueMicrotask(() => {
        if (mounted) fetchAffiliations(false);
      });
    }
    return () => {
      mounted = false;
    };
  }, [activeTab, fetchAffiliations]);

  const [showAddModal, setShowAddModal] = useState(false);

  // Walk-in patient creation state
  const [walkinName, setWalkinName] = useState('');
  const [walkinAge, setWalkinAge] = useState('');
  const [walkinGender, setWalkinGender] = useState('Not Specified');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [walkinDate, setWalkinDate] = useState(() => getLocalDateString());
  const [walkinReason, setWalkinReason] = useState('');
  const [walkinSlotId, setWalkinSlotId] = useState('');
  const [walkinClinicId, setWalkinClinicId] = useState('');
  const [walkinSubmitting, setWalkinSubmitting] = useState(false);
  const [walkinError, setWalkinError] = useState<string | null>(null);
  const [walkinSuccess, setWalkinSuccess] = useState<string | null>(null);

  const handleCreateWalkin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkinName.trim()) {
      setWalkinError('Please enter the patient full name');
      return;
    }
    if (walkinPhone.trim() && !isValidIndianPhone(walkinPhone)) {
      setWalkinError('Please enter a valid 10-digit mobile number');
      return;
    }

    if (walkinAge.trim()) {
      const parsedAge = parseInt(walkinAge.trim(), 10);
      if (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 125) {
        setWalkinError('Please enter a valid age between 0 and 125');
        return;
      }
    }

    if (!affiliations?.clinics || affiliations.clinics.length === 0) {
      setWalkinError('Please affiliate with an active clinic facility before adding walk-in appointments.');
      return;
    }

    const effectiveClinicId =
      walkinClinicId ||
      (selectedClinicId !== 'all' ? selectedClinicId : undefined) ||
      (affiliations.clinics.length === 1 ? affiliations.clinics[0].clinicId : undefined);

    if (affiliations.clinics.length > 1 && !effectiveClinicId) {
      setWalkinError('Please select which clinic venue to book the walk-in at');
      return;
    }

    setWalkinSubmitting(true);
    setWalkinError(null);
    try {
      const targetDoctorId = user?.doctorProfile?.id || user?.id || '';
      await api.bookAppointment({
        doctorId: targetDoctorId,
        appointmentDate: walkinDate || getLocalDateString(),
        slotId: walkinSlotId || undefined,
        reasonForVisit: walkinReason || 'Clinic Walk-in Consultation',
        isForOther: true,
        patientName: walkinName.trim(),
        patientAge: walkinAge.trim() || undefined,
        patientGender: walkinGender || 'Not Specified',
        patientPhone: walkinPhone.trim() ? formatIndianPhone(walkinPhone) : undefined,
        clinicId: effectiveClinicId,
      });
      setWalkinSuccess(`Patient ${walkinName} successfully queued!`);
      setWalkinName('');
      setWalkinAge('');
      setWalkinPhone('');
      setWalkinDate(getLocalDateString());
      setWalkinReason('');
      setWalkinClinicId('');
      await fetchQueue();
      setTimeout(() => {
        setShowAddModal(false);
        setWalkinSuccess(null);
      }, 1200);
    } catch (err: any) {
      setWalkinError(err.message || 'Failed to queue walk-in patient');
    } finally {
      setWalkinSubmitting(false);
    }
  };

  const handleAddClinic = async (clinicId: string) => {
    setFeedbackError(null);
    setFeedbackSuccess(null);
    setAffiliatingClinicId(clinicId);
    try {
      const res = await api.addDoctorClinic({ clinicId });
      setFeedbackSuccess(res.message || 'Clinic affiliated successfully');
      await fetchAffiliations();
      await fetchQueue(false);
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to affiliate clinic');
    } finally {
      setAffiliatingClinicId(null);
    }
  };

  const handleRemoveClinic = async (clinicId: string, clinicName: string) => {
    if (!window.confirm(`Detach your profile from ${clinicName}?`)) return;
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      await api.removeDoctorClinic(clinicId);
      setFeedbackSuccess(`Detached from ${clinicName}`);
      if (selectedClinicId === clinicId) {
        setSelectedClinicId('all');
      }
      await fetchAffiliations();
      await fetchQueue(false);
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to detach clinic');
    }
  };

  const handleRespondClinicAffiliation = async (affiliationId: string, action: 'ACCEPT' | 'REJECT') => {
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      const res = await api.respondToClinicAffiliation(affiliationId, action);
      setFeedbackSuccess(res.message || `Clinic request ${action.toLowerCase()}ed successfully`);
      await fetchAffiliations();
      await fetchQueue(false);
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to respond to affiliation request');
    }
  };

  const handleRemoveReceptionist = async (receptionistId: string, name: string) => {
    if (!window.confirm(`Unlink ${name} from your receptionist staff?`)) return;
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      await api.removeDoctorReceptionist(receptionistId);
      setFeedbackSuccess(`Unlinked ${name}`);
      await fetchAffiliations();
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to unlink receptionist');
    }
  };

  const [holdingId, setHoldingId] = useState<string | null>(null);
  const handleHoldConsultation = async (appointmentId: string) => {
    setHoldingId(appointmentId);
    try {
      await api.holdConsultation(appointmentId);
      await fetchQueue(false);
    } catch (err: any) {
      alert(err.message || 'Failed to put consultation on hold');
    } finally {
      setHoldingId(null);
    }
  };

  const handleCallPatient = async (appointmentId: string) => {
    if (user?.doctorProfile?.cabinStatus && user.doctorProfile.cabinStatus !== 'IN_CABIN') {
      const awayMsg = user.doctorProfile.cabinStatus === 'STEPPED_OUT'
        ? `You are currently marked as 'Stepped Out'${user.doctorProfile.expectedReturnTime ? ` (expected return ~${user.doctorProfile.expectedReturnTime})` : ''}. Please set your presence to 'In Cabin' before calling a patient.`
        : "You are currently marked as 'Not in Cabin'. Please set your presence to 'In Cabin' before calling a patient.";
      alert(awayMsg);
      return;
    }

    const target = queueData?.waitingQueue?.find((a) => a.id === appointmentId);
    if (target) {
      const todayStr = getLocalDateString();
      const yesterdayStr = getYesterdayDateString();
      const isValidDate = target.appointmentDate === todayStr || (target.appointmentDate === yesterdayStr && target.isCheckedIn);
      if (!isValidDate) {
        alert(`Cannot call patient scheduled for ${target.appointmentDate}. Only patients scheduled for today or active overnight shifts can be called into the active cabin.`);
        return;
      }
      if (!target.isCheckedIn) {
        alert('Patient has not arrived at the clinic yet. Patient must check in / mark arrival before being called into consultation.');
        return;
      }
    }
    setCallingId(appointmentId);
    try {
      await api.callPatient(appointmentId);
      await fetchQueue();
      navigate(`/doctor/consultation/${appointmentId}`);
    } catch (err: any) {
      alert(err.message || 'Failed to call patient');
    } finally {
      setCallingId(null);
    }
  };

  const [completingId, setCompletingId] = useState<string | null>(null);
  const handleCompleteConsultation = async (appointmentId: string) => {
    setCompletingId(appointmentId);
    try {
      await api.completeConsultation({ appointmentId });
      await fetchQueue();
    } catch (err: any) {
      alert(err.message || 'Failed to complete consultation');
    } finally {
      setCompletingId(null);
    }
  };

  const [togglingCheckinId, setTogglingCheckinId] = useState<string | null>(null);
  const handleToggleCheckIn = async (appointmentId: string, currentStatus?: boolean) => {
    setTogglingCheckinId(appointmentId);
    try {
      const nextStatus = !currentStatus;
      await api.checkInAppointmentDirect(appointmentId, nextStatus);
      await fetchQueue();
    } catch (err: any) {
      alert(err.message || 'Failed to update patient arrival status');
    } finally {
      setTogglingCheckinId(null);
    }
  };

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const handleCancelAppointment = async (appointmentId: string, patientName: string) => {
    if (!window.confirm(`Are you sure you want to cancel the queue appointment for ${patientName}? This action cannot be undone.`)) {
      return;
    }
    setCancellingId(appointmentId);
    try {
      await api.cancelAppointment(appointmentId);
      await fetchQueue(false);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel appointment');
    } finally {
      setCancellingId(null);
    }
  };

  const [rescheduleTarget, setRescheduleTarget] = useState<{
    appointmentId: string;
    patientName: string;
    doctorName: string;
    currentDate: string;
    currentQueueNumber?: number;
    doctorId: string;
    slotId?: string;
  } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlotId, setRescheduleSlotId] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduleSuccess, setRescheduleSuccess] = useState<string | null>(null);

  const handleConfirmReschedule = async () => {
    if (!rescheduleTarget) return;
    if (!rescheduleDate) {
      setRescheduleError('Please choose a new appointment date.');
      return;
    }
    setRescheduling(true);
    setRescheduleError(null);
    try {
      const res = await api.doctorRescheduleAppointment(rescheduleTarget.appointmentId, {
        newDate: rescheduleDate,
        newSlotId: rescheduleSlotId || undefined,
      });
      const newQueueNum = res?.queueNumber ?? res?.data?.queueNumber ?? res?.data?.appointment?.queueNumber;
      setRescheduleSuccess(
        `Appointment for ${rescheduleTarget.patientName} shifted to ${rescheduleDate}${newQueueNum ? ` (Token #${newQueueNum})` : ''}.`
      );
      setTimeout(() => setRescheduleSuccess(null), 5000);
      setRescheduleTarget(null);
      await fetchQueue(false);
    } catch (err: any) {
      setRescheduleError(err.message || 'Failed to reschedule appointment');
    } finally {
      setRescheduling(false);
    }
  };

  const isVerified = user?.doctorProfile?.isVerified ?? true;
  const isDoctorAway = Boolean(user?.doctorProfile?.cabinStatus && user.doctorProfile.cabinStatus !== 'IN_CABIN');
  const totalPendingRequests = affiliations?.incomingRequests?.length || 0;

  const doctorDisplayName = (user?.fullName || 'Doctor').replace(/^Dr\.?\s+/i, '');

  const navItems: DashboardNavItem[] = [
    {
      id: 'dashboard',
      label: 'Live Queue',
      icon: LayoutDashboard,
      active: activeTab === 'queue',
      onClick: () => {
        setActiveTab('queue');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    },
    {
      id: 'affiliations',
      label: 'Clinics & Staff',
      icon: Building2,
      active: activeTab === 'affiliations',
      onClick: () => {
        setActiveTab('affiliations');
        fetchAffiliations();
      },
      badge: totalPendingRequests > 0 ? `${totalPendingRequests} new` : undefined,
    },
    {
      id: 'schedule',
      label: 'Shifts & Fees',
      icon: Calendar,
      path: '/doctor/schedule',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/doctor/profile',
    },
  ];

  const currentClinic = affiliations?.clinics?.find((c) => c.clinicId === selectedClinicId);
  const availableShifts = useMemo(() => {
    if (selectedClinicId !== 'all' && currentClinic?.slots && currentClinic.slots.length > 0) {
      return currentClinic.slots;
    }
    if (affiliations?.clinics && affiliations.clinics.length > 0) {
      const allClinicSlots: any[] = [];
      const seenTimes = new Set<string>();
      affiliations.clinics.forEach((c) => {
        (c.slots || []).forEach((s: any) => {
          const key = `${s.startTime}-${s.endTime}`;
          if (!seenTimes.has(key)) {
            seenTimes.add(key);
            allClinicSlots.push(s);
          }
        });
      });
      if (allClinicSlots.length > 0) return allClinicSlots;
    }
    return parseDoctorSlots(user?.doctorProfile);
  }, [selectedClinicId, currentClinic, affiliations, user?.doctorProfile]);

  const targetSlotObj = useMemo(() => {
    return availableShifts.find((s: any) => s.id === selectedSlotId);
  }, [availableShifts, selectedSlotId]);

  const displayedWaitingQueue = useMemo(() => {
    if (!queueData?.waitingQueue) return [];
    return queueData.waitingQueue.filter((appt) => {
      if (selectedClinicId !== 'all' && appt.clinicId !== selectedClinicId) {
        return false;
      }
      if (selectedSlotId !== 'all' && !matchesSlot(appt, selectedSlotId, targetSlotObj)) {
        return false;
      }
      return true;
    });
  }, [queueData, selectedClinicId, selectedSlotId, targetSlotObj]);

  const displayedCompletedQueue = useMemo(() => {
    if (!queueData?.completedQueue) return [];
    return queueData.completedQueue.filter((appt) => {
      if (selectedClinicId !== 'all' && appt.clinicId !== selectedClinicId) {
        return false;
      }
      if (selectedSlotId !== 'all' && !matchesSlot(appt, selectedSlotId, targetSlotObj)) {
        return false;
      }
      return true;
    });
  }, [queueData, selectedClinicId, selectedSlotId, targetSlotObj]);

  const displayedActiveInConsultation = useMemo(() => {
    if (!queueData?.activeInConsultation) return null;
    const active = queueData.activeInConsultation;
    if (selectedClinicId !== 'all' && active.clinicId !== selectedClinicId) {
      return null;
    }
    if (selectedSlotId !== 'all' && !matchesSlot(active, selectedSlotId, targetSlotObj)) {
      return null;
    }
    return active;
  }, [queueData, selectedClinicId, selectedSlotId, targetSlotObj]);

  const clinicWaitingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!queueData?.waitingQueue) return counts;
    queueData.waitingQueue.forEach((a) => {
      if (a.clinicId) {
        counts[a.clinicId] = (counts[a.clinicId] || 0) + 1;
      }
    });
    return counts;
  }, [queueData]);

  const slotWaitingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!queueData?.waitingQueue) return counts;
    const clinicWaiting = selectedClinicId === 'all'
      ? queueData.waitingQueue
      : queueData.waitingQueue.filter((a) => a.clinicId === selectedClinicId);

    availableShifts.forEach((slot: any) => {
      counts[slot.id] = clinicWaiting.filter((a) => matchesSlot(a, slot.id, slot)).length;
    });
    return counts;
  }, [queueData, selectedClinicId, availableShifts]);

  const totalShiftQueueCount = useMemo(() => {
    if (!queueData?.waitingQueue) return 0;
    return selectedClinicId === 'all'
      ? queueData.waitingQueue.length
      : queueData.waitingQueue.filter((a) => a.clinicId === selectedClinicId).length;
  }, [queueData, selectedClinicId]);

  const clinicFilterOptions = useMemo<AppleFilterOption[]>(() => {
    if (!affiliations?.clinics) return [];
    return affiliations.clinics.map((clinic) => ({
      label: clinic.clinicName,
      value: clinic.clinicId,
      count: clinicWaitingCounts[clinic.clinicId] || 0,
    }));
  }, [affiliations, clinicWaitingCounts]);

  const shiftFilterOptions = useMemo<AppleFilterOption[]>(() => {
    return availableShifts.map((slot: any, idx: number) => {
      const timeRange = slot.startTime && slot.endTime
        ? ` (${format12Hour(slot.startTime)} – ${format12Hour(slot.endTime)})`
        : '';
      return {
        label: `Shift ${idx + 1}${timeRange}`,
        value: slot.id,
        count: slotWaitingCounts[slot.id] || 0,
      };
    });
  }, [availableShifts, slotWaitingCounts]);

  return (
    <DashboardLayout
      portalType="DOCTOR"
      navItems={navItems}
      title={
        activeTab === 'affiliations'
          ? 'Clinics & Staff'
          : `Dr. ${doctorDisplayName}`
      }
      subtitle={
        activeTab === 'affiliations'
          ? undefined
          : user?.doctorProfile?.specialty || undefined
      }
      headerAction={
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 'queue' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (selectedClinicId && selectedClinicId !== 'all') {
                    setWalkinClinicId(selectedClinicId);
                  } else if (affiliations?.clinics && affiliations.clinics.length === 1) {
                    setWalkinClinicId(affiliations.clinics[0].clinicId);
                  }
                  setWalkinDate(getLocalDateString());
                  setWalkinError(null);
                  setShowAddModal(true);
                }}
                className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-[0_2px_8px_rgba(0,102,204,0.2)] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Walk-in</span>
              </button>
              <button
                type="button"
                onClick={() => fetchQueue()}
                className="h-9 px-3.5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#86868b]" />
                <span>Refresh</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setClinicSearchQuery('');
                  setClinicStateFilter('All');
                  setClinicCityFilter('All');
                  setIsAffiliateModalOpen(true);
                }}
                className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-[0_2px_8px_rgba(0,102,204,0.2)] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Affiliate Clinic</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/doctor/schedule')}
                className="h-9 px-3.5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-[#0066cc]" />
                <span>Shifts & Fees</span>
              </button>
              <button
                type="button"
                onClick={() => fetchAffiliations()}
                className="h-9 px-3.5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#86868b]" />
                <span>Refresh</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="h-9 px-3.5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <FileText className="w-3.5 h-3.5 text-[#0066cc]" />
            <span>Reports & PDF</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {activeTab === 'affiliations' ? (
          <div className="space-y-6 animate-fadeIn">
            {/* Feedback Alerts */}
            {feedbackSuccess && (
              <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
                  <span className="font-medium">{feedbackSuccess}</span>
                </div>
                <button
                  onClick={() => setFeedbackSuccess(null)}
                  className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {feedbackError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span className="font-medium">{feedbackError}</span>
                </div>
                <button
                  onClick={() => setFeedbackError(null)}
                  className="text-rose-700 hover:text-rose-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Clean 3-Column Metrics Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <span className="text-xs text-[#86868b] font-medium block">Affiliated Clinics</span>
                <h3 className="text-[28px] font-semibold text-[#1d1d1f] mt-1 tracking-tight leading-none">
                  {affiliations?.clinics.length || 0}
                </h3>
              </div>

              <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <span className="text-xs text-[#86868b] font-medium block">Assigned Desk Staff</span>
                <h3 className="text-[28px] font-semibold text-[#1d1d1f] mt-1 tracking-tight leading-none">
                  {affiliations?.receptionists.length || 0}
                </h3>
              </div>

              <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <span className="text-xs text-[#86868b] font-medium block">Total Clinic Earnings</span>
                <h3 className="text-[28px] font-semibold text-[#0066cc] mt-1 tracking-tight leading-none">
                  ₹{(
                    affiliations?.clinics.reduce(
                      (sum: number, c) => sum + (c.revenue || 0),
                      0
                    ) || 0
                  ).toLocaleString('en-IN')}
                </h3>
              </div>
            </div>

            {/* Incoming Clinic Affiliation Invitations */}
            {affiliations?.incomingRequests && affiliations.incomingRequests.length > 0 && (
              <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <div className="mb-4">
                  <h3 className="text-[16px] font-semibold text-[#1d1d1f] tracking-tight">
                    Incoming Clinic Invitations ({affiliations.incomingRequests.length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {affiliations.incomingRequests.map((req) => (
                    <div
                      key={req.affiliationId}
                      className="rounded-2xl border border-[#e5e5ea] p-4 bg-[#f5f5f7] flex flex-col justify-between"
                    >
                      <div>
                        <h4 className="font-semibold text-[15px] text-[#1d1d1f]">{req.clinicName}</h4>
                        <p className="text-xs text-[#86868b] flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-[#86868b]" />
                          {req.address}{req.city ? `, ${req.city}` : ''}
                        </p>
                        {req.phone && (
                          <p className="text-xs text-[#86868b] mt-0.5">Phone: {req.phone}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#e5e5ea]">
                        <button
                          type="button"
                          onClick={() => handleRespondClinicAffiliation(req.affiliationId, 'ACCEPT')}
                          className="flex-1 h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondClinicAffiliation(req.affiliationId, 'REJECT')}
                          className="flex-1 h-9 px-4 rounded-full bg-white hover:bg-rose-50 text-rose-600 border border-[#e5e5ea] text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Outgoing Clinic Requests */}
            {affiliations?.outgoingRequests && affiliations.outgoingRequests.length > 0 && (
              <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-[16px] font-semibold text-[#1d1d1f] tracking-tight">
                    Pending Clinic Approvals ({affiliations.outgoingRequests.length})
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {affiliations.outgoingRequests.map((req) => (
                    <div
                      key={req.affiliationId}
                      className="rounded-2xl border border-[#e5e5ea] bg-[#f5f5f7] p-4 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-semibold text-[14px] text-[#1d1d1f]">{req.clinicName}</h4>
                        <p className="text-xs text-[#86868b] mt-0.5">{req.address}{req.city ? `, ${req.city}` : ''}</p>
                      </div>
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white text-[#86868b] border border-[#e5e5ea]">
                        Pending
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 1: Affiliated Clinics */}
            <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
                <div className="flex items-center gap-2">
                  <h3 className="text-[16px] font-semibold text-[#1d1d1f] tracking-tight">
                    Affiliated Clinics
                  </h3>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f]">
                    {affiliations?.clinics.length || 0}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setClinicSearchQuery('');
                    setClinicStateFilter('All');
                    setClinicCityFilter('All');
                    setIsAffiliateModalOpen(true);
                  }}
                  className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Affiliate New Clinic</span>
                </button>
              </div>

              {affiliationsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-32 rounded-2xl bg-[#f5f5f7] animate-pulse" />
                  ))}
                </div>
              ) : affiliations?.clinics.length === 0 ? (
                <div className="p-8 text-center bg-[#f5f5f7] rounded-2xl border border-[#e5e5ea]">
                  <h4 className="text-[15px] font-semibold text-[#1d1d1f]">No Clinics Affiliated</h4>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setClinicSearchQuery('');
                        setClinicStateFilter('All');
                        setClinicCityFilter('All');
                        setIsAffiliateModalOpen(true);
                      }}
                      className="h-9 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Find & Affiliate Clinic</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {affiliations?.clinics.map((clinic) => (
                    <div
                      key={clinic.clinicId}
                      className="rounded-2xl border border-[#e5e5ea] p-5 hover:border-[#d2d2d7] transition-all duration-150 flex flex-col justify-between bg-white"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-semibold text-[15px] text-[#1d1d1f] tracking-tight truncate">
                                {clinic.clinicName}
                              </h4>
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />
                            </div>
                            <p className="text-xs text-[#86868b] flex items-center gap-1 mt-0.5 truncate">
                              <MapPin className="w-3.5 h-3.5 text-[#86868b] flex-shrink-0" />
                              <span className="truncate">{clinic.address}{clinic.city ? `, ${clinic.city}` : ''}</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveClinic(clinic.clinicId, clinic.clinicName)}
                            className="text-[#86868b] hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-full transition-all flex-shrink-0 cursor-pointer"
                            title="Detach from Clinic"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Clean Stats Row */}
                        <div className="grid grid-cols-3 gap-2 mt-4 p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-center">
                          <div>
                            <span className="text-[11px] font-medium text-[#86868b] block">Fee</span>
                            <span className="text-sm font-semibold text-[#1d1d1f] mt-0.5 block">
                              ₹{clinic.consultationFee ?? user?.doctorProfile?.consultationFee ?? 500}
                            </span>
                          </div>
                          <div className="border-x border-[#e5e5ea]">
                            <span className="text-[11px] font-medium text-[#86868b] block">Bookings</span>
                            <span className="text-sm font-semibold text-[#1d1d1f] mt-0.5 block">
                              {clinic.bookingCount || 0}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] font-medium text-[#86868b] block">Revenue</span>
                            <span className="text-sm font-semibold text-[#0066cc] mt-0.5 block">
                              ₹{(clinic.revenue ?? 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>

                        {/* Shifts Status */}
                        <div className="mt-3 flex items-center justify-between text-xs px-1 text-[#86868b]">
                          <span className="font-medium">Practice Shifts</span>
                          <span className="font-medium text-[#1d1d1f] truncate max-w-[220px]">
                            {clinic.slots && clinic.slots.length > 0
                              ? `${clinic.slots.length} ${clinic.slots.length === 1 ? 'Shift' : 'Shifts'}`
                              : 'Default schedule'}
                          </span>
                        </div>

                        {/* Schedule & Weekday Display */}
                        <div className="mt-3 pt-3 border-t border-[#e5e5ea]">
                          <WeekdayDisplay
                            days={clinic.workingDays || ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']}
                            isOnLeaveToday={clinic.isOnLeaveToday}
                          />
                        </div>
                      </div>

                      {/* Actions & Footer */}
                      <div className="mt-4 pt-3 border-t border-[#e5e5ea] flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/doctor/schedule?clinic=${clinic.clinicId}`)}
                          className="flex-1 min-w-[80px] h-9 px-3 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Shifts</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setScheduleLeaveModalClinic({ clinicId: clinic.clinicId, clinicName: clinic.clinicName })}
                          className="h-9 px-3.5 rounded-full bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                          title="Doctor Schedule & Leave"
                        >
                          <Calendar className="w-3.5 h-3.5 text-[#0066cc]" />
                          <span>Schedule</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStandeeClinic({
                              clinicId: clinic.clinicId,
                              clinicName: clinic.clinicName,
                              clinicAddress: `${clinic.address || ''}${clinic.city ? `, ${clinic.city}` : ''}`,
                              clinicPhone: clinic.phone || '',
                              checkinCode: (clinic as any).checkinCode || '',
                            });
                            setIsStandeeModalOpen(true);
                          }}
                          className="h-9 px-3 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                          title="Clinic QR Standee"
                        >
                          <QrCode className="w-3.5 h-3.5 text-[#0066cc]" />
                          <span>Standee</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Authorized Clinic Desk Staff */}
            <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div className="flex items-center gap-2 mb-5">
                <h3 className="text-[16px] font-semibold text-[#1d1d1f] tracking-tight">
                  Authorized Desk Staff
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f]">
                  {affiliations?.receptionists.length || 0}
                </span>
              </div>

              {affiliationsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-20 rounded-2xl bg-[#f5f5f7] animate-pulse" />
                  ))}
                </div>
              ) : affiliations?.receptionists.length === 0 ? (
                <div className="p-8 text-center bg-[#f5f5f7] rounded-2xl border border-[#e5e5ea]">
                  <h4 className="text-[15px] font-semibold text-[#1d1d1f]">No Desk Staff Assigned</h4>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {affiliations?.receptionists.map((rec) => (
                    <div
                      key={rec.receptionistId}
                      className="rounded-2xl border border-[#e5e5ea] p-4 sm:p-5 hover:border-[#d2d2d7] transition-all duration-150 flex items-center justify-between gap-4 bg-white"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-[14px] text-[#1d1d1f] tracking-tight truncate">
                            {rec.fullName}
                          </h4>
                          {rec.clinicName && (
                            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] truncate max-w-[160px]">
                              {rec.clinicName}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#86868b] truncate mt-0.5">{rec.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveReceptionist(rec.receptionistId, rec.fullName)}
                        className="h-8 px-3 rounded-full text-xs font-medium text-[#86868b] hover:text-rose-600 hover:bg-rose-50 border border-[#e5e5ea] hover:border-rose-200 transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                        title="Unlink Receptionist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Unlink</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Verification Warning if Doctor is unverified or suspended/rejected */}
            {user?.doctorProfile?.verificationStatus === 'SUSPENDED' && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-[14px] text-rose-900">Medical Practitioner License Suspended</h4>
                  <p className="mt-0.5 leading-relaxed text-rose-700">
                    Your practitioner license has been suspended by administration. You cannot accept new patient bookings or clinic affiliations until reinstatement.
                  </p>
                </div>
              </div>
            )}
            {user?.doctorProfile?.verificationStatus === 'REJECTED' && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-[14px] text-rose-900">Doctor Profile Application Rejected</h4>
                  <p className="mt-0.5 leading-relaxed text-rose-700">
                    Your medical credentials verification was not approved. Please review your registration details or contact platform administration.
                  </p>
                </div>
              </div>
            )}
            {(!isVerified && user?.doctorProfile?.verificationStatus !== 'SUSPENDED' && user?.doctorProfile?.verificationStatus !== 'REJECTED') && (
              <div className="p-4 rounded-2xl bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-start gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <AlertTriangle className="w-5 h-5 text-[#0066cc] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-[14px] text-[#1d1d1f]">Profile Pending Admin Verification</h4>
                  <p className="mt-0.5 leading-relaxed text-[#86868b]">
                    Your medical profile is currently under review by the MediArca administrator. Once approved, your profile and checking slots will become visible in the public doctor directory.
                  </p>
                </div>
              </div>
            )}

            {/* Server Connection Issue Banner */}
            {fetchError && (
              <div className="p-4 rounded-2xl bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#0066cc] animate-spin" />
                  <span>Connecting to cloud database...</span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchQueue(true)}
                  className="text-xs font-medium text-[#0066cc] hover:underline cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Doctor On Leave Banner */}
            {(() => {
              const activeClinic = selectedClinicId !== 'all'
                ? affiliations?.clinics.find((c) => c.clinicId === selectedClinicId)
                : affiliations?.clinics.find((c) => c.isOnLeaveToday);
              const isOnLeave = activeClinic ? activeClinic.isOnLeaveToday : user?.doctorProfile?.isOnLeaveToday;
              const leaveInfo = activeClinic ? activeClinic.todayLeave : user?.doctorProfile?.todayLeave;
              if (!isOnLeave) return null;
              return (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CalendarX className="w-5 h-5 text-rose-600 shrink-0" />
                    <div>
                      <h4 className="font-semibold text-[13px] text-rose-900">
                        You are Marked on Leave Today
                      </h4>
                      <p className="text-rose-700 mt-0.5 leading-relaxed">
                        {leaveInfo?.reason ? `Reason: ${leaveInfo.reason}` : 'New patient bookings and walk-in queue tokens are paused for today.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {leaveInfo?.id && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if (user?.doctorProfile?.id) {
                              await api.cancelDoctorLeave(user.doctorProfile.id, leaveInfo.id);
                              await fetchAffiliations();
                              await fetchQueue(false);
                            }
                          } catch (err: any) {
                            alert(err?.message || 'Failed to resume consultations');
                          }
                        }}
                        className="h-8 px-3.5 rounded-full bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 font-semibold text-xs transition-all cursor-pointer shadow-xs"
                      >
                        Resume Today
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setScheduleLeaveModalClinic({ clinicId: activeClinic?.clinicId, clinicName: activeClinic?.clinicName })}
                      className="h-8 px-3.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-all cursor-pointer shadow-xs"
                    >
                      Manage Leaves
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Reschedule Success Feedback Banner */}
            {rescheduleSuccess && (
              <div className="p-4 rounded-2xl bg-[#0066cc]/10 border border-[#0066cc]/20 text-[#0066cc] text-xs flex items-center justify-between shadow-xs animate-fadeIn">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0" />
                  <span>{rescheduleSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRescheduleSuccess(null)}
                  className="text-xs font-semibold hover:underline ml-3 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Unified Top Control Bar: Date Scope Selector + Cabin Presence + Clinic & Shift Controls */}
            <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-4 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-3.5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                {/* Date Filter Segmented Bar + Date Input */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-full flex items-center gap-0.5 overflow-x-auto max-w-full no-scrollbar">
                    <button
                      type="button"
                      onClick={() => {
                        setQueueScope('date');
                        setDate(getLocalDateString());
                      }}
                      className={`h-8 px-3.5 rounded-full text-xs transition-all cursor-pointer whitespace-nowrap ${
                        queueScope === 'date' && date === getLocalDateString()
                          ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs border border-black/5'
                          : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQueueScope('date');
                        const tomorrowStr = queueData?.upcomingSummary?.tomorrowDate || getTomorrowDateString();
                        setDate(tomorrowStr);
                      }}
                      className={`h-8 px-3.5 rounded-full text-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        queueScope === 'date' && date === (queueData?.upcomingSummary?.tomorrowDate || getTomorrowDateString())
                          ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs border border-black/5'
                          : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
                      }`}
                    >
                      <span>Tomorrow</span>
                      {queueData?.upcomingSummary && queueData.upcomingSummary.tomorrowCount > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-[#0066cc] text-white">
                          {queueData.upcomingSummary.tomorrowCount}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQueueScope('all-upcoming');
                      }}
                      className={`h-8 px-3.5 rounded-full text-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        queueScope === 'all-upcoming'
                          ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs border border-black/5'
                          : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
                      }`}
                    >
                      <span>All Upcoming</span>
                      {queueData?.upcomingSummary && queueData.upcomingSummary.totalUpcomingCount > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-[#0066cc] text-white">
                          {queueData.upcomingSummary.totalUpcomingCount}
                        </span>
                      )}
                    </button>
                  </div>

                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setQueueScope('date');
                      setDate(e.target.value);
                    }}
                    className="h-9 sm:h-10 px-3.5 rounded-full border border-[#e5e5ea] text-xs font-medium bg-[#f5f5f7] hover:bg-[#e8e8ed]/70 focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:border-[#0066cc] cursor-pointer w-full sm:w-auto text-center"
                    title="Choose Specific Date"
                  />
                </div>

                {/* Live Cabin Presence */}
                <div className="w-full lg:w-auto">
                  <CabinStatusControl
                    currentStatus={user?.doctorProfile?.cabinStatus}
                    expectedReturnTime={user?.doctorProfile?.expectedReturnTime}
                    onStatusChange={(newStatus, newReturnTime) => {
                      if (user?.doctorProfile) {
                        updateUser({
                          ...user,
                          doctorProfile: {
                            ...user.doctorProfile,
                            cabinStatus: newStatus,
                            expectedReturnTime: newReturnTime,
                          },
                        });
                      }
                    }}
                  />
                </div>
              </div>

              {/* Clinic & Shift Differentiation Controls */}
              {((affiliations?.clinics && affiliations.clinics.length > 0) || availableShifts.length > 0) && (
                <div className="pt-3.5 border-t border-[#f0f0f2] flex flex-col gap-3">
                  {/* Desktop View: Sleek Apple Dropdown Selectors */}
                  <div className="hidden sm:flex items-center gap-3.5 flex-wrap">
                    {affiliations?.clinics && affiliations.clinics.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#1d1d1f] tracking-tight shrink-0">
                          Clinic:
                        </span>
                        <div className="h-9 min-w-[200px] max-w-[280px] bg-[#f5f5f7] hover:bg-[#e8e8ed]/60 border border-[#e5e5ea] rounded-full px-2 flex items-center transition-all">
                          <AppleFilterSelect
                            value={selectedClinicId === 'all' ? 'All' : selectedClinicId}
                            onChange={(val) => handleClinicChange(val === 'All' ? 'all' : val)}
                            options={clinicFilterOptions}
                            placeholder="All Clinics"
                            allLabel="All Clinics"
                            allCount={queueData?.waitingQueue?.length || 0}
                            variant="bar"
                            icon={<Building2 className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />}
                          />
                        </div>
                      </div>
                    )}

                    {availableShifts.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#1d1d1f] tracking-tight shrink-0">
                          Shift:
                        </span>
                        <div className="h-9 min-w-[190px] max-w-[260px] bg-[#f5f5f7] hover:bg-[#e8e8ed]/60 border border-[#e5e5ea] rounded-full px-2 flex items-center transition-all">
                          <AppleFilterSelect
                            value={selectedSlotId === 'all' ? 'All' : selectedSlotId}
                            onChange={(val) => setSelectedSlotId(val === 'All' ? 'all' : val)}
                            options={shiftFilterOptions}
                            placeholder="All Shifts"
                            allLabel="All Shifts"
                            allCount={totalShiftQueueCount}
                            variant="bar"
                            icon={<Clock className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />}
                          />
                        </div>
                      </div>
                    )}

                    {(selectedClinicId !== 'all' || selectedSlotId !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          handleClinicChange('all');
                          setSelectedSlotId('all');
                        }}
                        className="h-8 px-3 rounded-full text-xs font-medium text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.04] cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reset Filters</span>
                      </button>
                    )}
                  </div>

                  {/* Mobile View: Clean Expandable Drawer matching States & Cities */}
                  <div className="sm:hidden flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setQueueFiltersDrawerOpen(!queueFiltersDrawerOpen)}
                      className="h-8 px-3.5 rounded-full border border-[#e5e5ea] bg-[#f5f5f7] hover:bg-[#e8e8ed] text-xs font-medium text-[#1d1d1f] flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-all"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[#0066cc]" />
                      <span>Clinic & Shift Filters{(selectedClinicId !== 'all' || selectedSlotId !== 'all') ? ' • Active' : ''}</span>
                    </button>
                    {(selectedClinicId !== 'all' || selectedSlotId !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          handleClinicChange('all');
                          setSelectedSlotId('all');
                        }}
                        className="text-xs text-[#86868b] hover:text-[#1d1d1f] underline cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {queueFiltersDrawerOpen && (
                    <div className="sm:hidden w-full bg-white rounded-2xl border border-[#e5e5ea] p-3.5 shadow-sm space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between pb-2 border-b border-[#e5e5ea]">
                        <span className="text-xs font-semibold text-[#1d1d1f]">Queue Filters</span>
                        <button
                          type="button"
                          onClick={() => setQueueFiltersDrawerOpen(false)}
                          className="text-xs font-medium text-[#0066cc] cursor-pointer"
                        >
                          Done
                        </button>
                      </div>

                      {affiliations?.clinics && affiliations.clinics.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-[#86868b]">Select Clinic</label>
                          <div className="w-full h-10 bg-[#f5f5f7] border border-[#e5e5ea] rounded-full px-2 flex items-center">
                            <AppleFilterSelect
                              value={selectedClinicId === 'all' ? 'All' : selectedClinicId}
                              onChange={(val) => handleClinicChange(val === 'All' ? 'all' : val)}
                              options={clinicFilterOptions}
                              placeholder="All Clinics"
                              allLabel="All Clinics"
                              allCount={queueData?.waitingQueue?.length || 0}
                              variant="bar"
                              icon={<Building2 className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />}
                            />
                          </div>
                        </div>
                      )}

                      {availableShifts.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-[#86868b]">Select Shift</label>
                          <div className="w-full h-10 bg-[#f5f5f7] border border-[#e5e5ea] rounded-full px-2 flex items-center">
                            <AppleFilterSelect
                              value={selectedSlotId === 'all' ? 'All' : selectedSlotId}
                              onChange={(val) => setSelectedSlotId(val === 'All' ? 'all' : val)}
                              options={shiftFilterOptions}
                              placeholder="All Shifts"
                              allLabel="All Shifts"
                              allCount={totalShiftQueueCount}
                              variant="bar"
                              icon={<Clock className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />}
                            />
                          </div>
                        </div>
                      )}

                      {(selectedClinicId !== 'all' || selectedSlotId !== 'all') && (
                        <div className="pt-2 border-t border-[#f0f0f2] flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              handleClinicChange('all');
                              setSelectedSlotId('all');
                            }}
                            className="text-xs font-medium text-[#86868b] hover:text-[#1d1d1f] cursor-pointer"
                          >
                            Reset All Filters
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clean 3-Column Metrics Strip */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#e5e5ea] p-3 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <p className="text-[11px] sm:text-xs text-[#86868b] font-medium leading-tight truncate">Waiting in Queue</p>
                <h3 className="text-[20px] sm:text-[30px] font-semibold text-[#1d1d1f] mt-1 tracking-tight leading-none">
                  {displayedWaitingQueue.length}
                </h3>
              </div>

              <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#e5e5ea] p-3 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <p className="text-[11px] sm:text-xs text-[#86868b] font-medium leading-tight truncate">Completed</p>
                <h3 className="text-[20px] sm:text-[30px] font-semibold text-[#0066cc] mt-1 tracking-tight leading-none">
                  {displayedCompletedQueue.length}
                </h3>
              </div>

              <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#e5e5ea] p-3 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <p className="text-[11px] sm:text-xs text-[#86868b] font-medium leading-tight truncate">Total Bookings</p>
                <h3 className="text-[20px] sm:text-[30px] font-semibold text-[#1d1d1f] mt-1 tracking-tight leading-none">
                  {(displayedActiveInConsultation ? 1 : 0) + displayedWaitingQueue.length + displayedCompletedQueue.length}
                </h3>
              </div>
            </div>

            {/* Main Live Queue Workspace (2-Column Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (5 cols): Active Cabin */}
              <div className="lg:col-span-5">
                <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#e5e5ea]">
                    <h3 className="text-[16px] font-semibold text-[#1d1d1f] tracking-tight">
                      Active Cabin
                    </h3>
                    {displayedActiveInConsultation ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20 font-semibold text-xs px-2.5 py-0.5 rounded-full">
                          Token #{displayedActiveInConsultation.queueNumber}
                        </span>
                        <span className="bg-[#f5f5f7] text-[#0066cc] border border-[#0066cc]/20 font-semibold text-xs px-2.5 py-0.5 rounded-full">
                          {getSlotShortLabel(displayedActiveInConsultation, availableShifts)}
                        </span>
                        {selectedClinicId === 'all' && (displayedActiveInConsultation.clinic?.clinicName || (user?.doctorProfile as any)?.primaryClinicAddress) && (
                          <span className="bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] font-medium text-xs px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-[#0066cc]" />
                            <span className="truncate max-w-[140px]">{displayedActiveInConsultation.clinic?.clinicName || (user?.doctorProfile as any)?.primaryClinicAddress}</span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea] font-medium text-xs px-2.5 py-0.5 rounded-full">
                        Available
                      </span>
                    )}
                  </div>

                  {displayedActiveInConsultation ? (
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight">
                          {displayedActiveInConsultation.patientName || displayedActiveInConsultation.patient?.user?.fullName || 'Patient'}
                        </h4>
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
                          {getSlotShortLabel(displayedActiveInConsultation, availableShifts)}
                        </span>
                        {selectedClinicId === 'all' && (displayedActiveInConsultation.clinic?.clinicName || (user?.doctorProfile as any)?.primaryClinicAddress) && (
                          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-[#0066cc]" />
                            <span>{displayedActiveInConsultation.clinic?.clinicName || (user?.doctorProfile as any)?.primaryClinicAddress}</span>
                          </span>
                        )}
                        {displayedActiveInConsultation.isForOther && (
                          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]">
                            {displayedActiveInConsultation.reasonForVisit?.toLowerCase().includes('walk-in')
                              ? `Walk-in${displayedActiveInConsultation.patientAge ? ` (Age ${displayedActiveInConsultation.patientAge})` : ''}`
                              : `Family (${displayedActiveInConsultation.patientAge ? `Age ${displayedActiveInConsultation.patientAge}` : 'Other'})`}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-[#1d1d1f] mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-[#0066cc]">{getSlotShortLabel(displayedActiveInConsultation, availableShifts)}</span>
                        {selectedClinicId === 'all' && (displayedActiveInConsultation.clinic?.clinicName || (user?.doctorProfile as any)?.primaryClinicAddress) && (
                          <>
                            <span className="text-[#86868b]">•</span>
                            <span className="text-[#86868b] flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-[#0066cc]" />
                              {displayedActiveInConsultation.clinic?.clinicName || (user?.doctorProfile as any)?.primaryClinicAddress}
                            </span>
                          </>
                        )}
                      </p>

                      {(() => {
                        const cleanReason = getCleanReason(
                          displayedActiveInConsultation.reasonForVisit,
                          displayedActiveInConsultation.patientName || displayedActiveInConsultation.patient?.user?.fullName
                        );
                        if (!cleanReason && !displayedActiveInConsultation.symptoms) return null;
                        return (
                          <div className="my-4 p-3.5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-[13px] text-[#1d1d1f] space-y-1.5">
                            {cleanReason && (
                              <div className="whitespace-pre-wrap break-words">
                                <span className="text-[#86868b] font-medium">Reason: </span>
                                {cleanReason}
                              </div>
                            )}
                            {displayedActiveInConsultation.symptoms && (
                              <div className="whitespace-pre-wrap break-words">
                                <span className="text-[#86868b] font-medium">Symptoms: </span>
                                {displayedActiveInConsultation.symptoms}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="flex flex-col sm:flex-row items-center gap-2.5">
                        <button
                          type="button"
                          disabled={completingId === displayedActiveInConsultation.id}
                          onClick={() => handleCompleteConsultation(displayedActiveInConsultation.id)}
                          className="w-full sm:flex-1 h-10 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4 text-white" />
                          <span>{completingId === displayedActiveInConsultation.id ? 'Completing...' : 'Complete Consultation'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={holdingId === displayedActiveInConsultation.id}
                          onClick={() => handleHoldConsultation(displayedActiveInConsultation.id)}
                          className="w-full sm:w-auto h-10 px-4 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                          title="Place patient on hold and return them to the waiting queue"
                        >
                          <PauseCircle className="w-3.5 h-3.5" />
                          <span>{holdingId === displayedActiveInConsultation.id ? 'Holding...' : 'Hold'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/doctor/consultation/${displayedActiveInConsultation.id}`)
                          }
                          className="w-full sm:w-auto h-10 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <FileEdit className="w-3.5 h-3.5" />
                          <span>Notes</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center">
                      <h4 className="text-[14px] font-semibold text-[#1d1d1f] tracking-tight">No Patient in Cabin</h4>
                      <p className="text-xs text-[#86868b] mt-1 max-w-xs mx-auto leading-relaxed">
                        Call the next arrived patient from the waiting queue to begin consultation.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column (7 cols): Waiting Queue & Completed */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3.5 border-b border-[#e5e5ea]">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[16px] font-semibold text-[#1d1d1f] tracking-tight">
                        Waiting Queue
                      </h3>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f]">
                        {displayedWaitingQueue.length}
                      </span>
                    </div>

                    {(() => {
                      const filteredWaiting = displayedWaitingQueue.filter((appt) => {
                        if (!queueSearch.trim()) return true;
                        const q = queueSearch.toLowerCase().trim();
                        const name = (appt.patientName || appt.patient?.user?.fullName || '').toLowerCase();
                        const phone = (appt.patient?.user?.phone || '').toLowerCase();
                        const token = String(appt.queueNumber || '');
                        return name.includes(q) || phone.includes(q) || token.includes(q);
                      });
                      const nextPresentTarget = filteredWaiting.find(
                        (appt) =>
                          appt.isCheckedIn &&
                          (appt.appointmentDate === getLocalDateString() ||
                            appt.appointmentDate === getYesterdayDateString())
                      );

                      return (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                          <input
                            type="text"
                            value={queueSearch}
                            onChange={(e) => setQueueSearch(e.target.value)}
                            placeholder="Search name, phone, token..."
                            className="h-9 px-3.5 rounded-full border border-[#d2d2d7] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#a1a1a6] transition-all focus:outline-none focus:border-[#0066cc] w-full sm:w-48"
                          />
                          {!isDoctorAway && nextPresentTarget && (
                            <button
                              type="button"
                              disabled={callingId !== null}
                              onClick={() => handleCallPatient(nextPresentTarget.id)}
                              className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap w-full sm:w-auto cursor-pointer transition-all"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              {callingId === nextPresentTarget.id
                                ? 'Calling...'
                                : `Call #${nextPresentTarget.queueNumber} (${getSlotShortLabel(nextPresentTarget, availableShifts)})`}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-20 rounded-2xl bg-[#f5f5f7] animate-pulse"></div>
                      ))}
                    </div>
                  ) : displayedWaitingQueue.length === 0 ? (
                    <div className="py-8 text-center">
                      <h4 className="text-[14px] font-semibold text-[#1d1d1f] tracking-tight">
                        Queue is Clear for {queueScope === 'all-upcoming' ? 'All Upcoming Dates' : date === getLocalDateString() ? 'Today' : date === queueData?.upcomingSummary?.tomorrowDate ? 'Tomorrow' : date}
                      </h4>
                      <p className="text-xs text-[#86868b] mt-1 max-w-md mx-auto leading-relaxed">
                        All scheduled patients for this view have completed consultation or no patients are waiting.
                      </p>
                    </div>
                  ) : (() => {
                    const filteredWaiting = displayedWaitingQueue.filter((appt) => {
                      if (!queueSearch.trim()) return true;
                      const q = queueSearch.toLowerCase().trim();
                      const name = (appt.patientName || appt.patient?.user?.fullName || '').toLowerCase();
                      const phone = (appt.patient?.user?.phone || '').toLowerCase();
                      const token = String(appt.queueNumber || '');
                      return name.includes(q) || phone.includes(q) || token.includes(q);
                    });

                    if (filteredWaiting.length === 0) {
                      return (
                        <div className="py-8 text-center">
                          <p className="text-xs text-[#86868b]">
                            No waiting patients matching "{queueSearch}".
                          </p>
                          <button
                            type="button"
                            onClick={() => setQueueSearch('')}
                            className="mt-2 text-xs text-[#0066cc] font-semibold hover:underline cursor-pointer"
                          >
                            Clear Search
                          </button>
                        </div>
                      );
                    }

                    const renderApptCard = (appt: Appointment) => {
                      const shiftLabel = getSlotShortLabel(appt, availableShifts);
                      const clinicDisplay = appt.clinic?.clinicName || (user?.doctorProfile as any)?.primaryClinicAddress || '';
                      return (
                        <div
                          key={appt.id}
                          className="rounded-2xl border border-[#e5e5ea] p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-[#d2d2d7] transition-all duration-150 bg-[#f5f5f7]/40"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-white border border-[#e5e5ea] flex items-center justify-center font-bold text-[15px] text-[#1d1d1f] shrink-0 shadow-xs">
                              #{appt.queueNumber}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-[14px] font-semibold text-[#1d1d1f] tracking-tight">
                                  {appt.patientName || appt.patient?.user?.fullName || 'Patient'}
                                </h4>
                                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white text-[#1d1d1f] border border-[#e5e5ea]">
                                  {shiftLabel}
                                </span>
                                {selectedClinicId === 'all' && clinicDisplay && (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white text-[#1d1d1f] border border-[#e5e5ea] inline-flex items-center gap-1">
                                    <Building2 className="w-3 h-3 text-[#0066cc]" />
                                    <span className="truncate max-w-[150px]">{clinicDisplay}</span>
                                  </span>
                                )}
                                {appt.isForOther && (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white text-[#1d1d1f] border border-[#e5e5ea]">
                                    {appt.reasonForVisit?.toLowerCase().includes('walk-in')
                                      ? `Walk-in${appt.patientAge ? ` (${appt.patientAge}y)` : ''}`
                                      : `Family (${appt.patientAge ? `${appt.patientAge}y` : 'Other'})`}
                                  </span>
                                )}
                                {appt.isCheckedIn ? (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#0066cc]"></span>
                                    <span>At Clinic</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white text-[#86868b] border border-[#e5e5ea]">
                                    Not Arrived
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#86868b] flex items-center gap-1.5 mt-1 flex-wrap">
                                {appt.appointmentDate && appt.appointmentDate !== getLocalDateString() && queueScope !== 'all-upcoming' && (
                                  <span className="font-medium text-[#1d1d1f]">
                                    {appt.appointmentDate === queueData?.upcomingSummary?.tomorrowDate ? 'Tomorrow' : appt.appointmentDate} •
                                  </span>
                                )}
                                <span className="font-semibold text-[#1d1d1f]">
                                  {shiftLabel}
                                </span>
                                {selectedClinicId === 'all' && clinicDisplay && (
                                  <>
                                    <span>•</span>
                                    <span className="text-[#86868b] truncate max-w-[150px]">
                                      {clinicDisplay}
                                    </span>
                                  </>
                                )}
                                {(() => {
                                  const cleanReason = getCleanReason(
                                    appt.reasonForVisit,
                                    appt.patientName || appt.patient?.user?.fullName
                                  );
                                  if (!cleanReason) return null;
                                  return (
                                    <>
                                      <span>•</span>
                                      <span className="text-[#1d1d1f] truncate max-w-[180px]">
                                        {cleanReason}
                                      </span>
                                    </>
                                  );
                                })()}
                              </p>
                            </div>
                          </div>

                        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-end shrink-0 flex-wrap pt-2 sm:pt-0 border-t sm:border-t-0 border-[#e5e5ea]/60">
                          {/* Arrival toggle */}
                          <button
                            type="button"
                            disabled={togglingCheckinId === appt.id}
                            onClick={() => handleToggleCheckIn(appt.id, appt.isCheckedIn)}
                            className={`h-8 px-3 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 cursor-pointer ${
                              appt.isCheckedIn
                                ? 'bg-[#0066cc]/10 border-[#0066cc]/30 text-[#0066cc]'
                                : 'bg-white border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#f5f5f7]'
                            }`}
                            title={appt.isCheckedIn ? 'Click to unmark arrival' : 'Click to mark patient arrived at clinic'}
                          >
                            <CheckCircle2
                              className={`w-3.5 h-3.5 ${appt.isCheckedIn ? 'text-[#0066cc]' : 'text-[#86868b]'}`}
                            />
                            <span>{togglingCheckinId === appt.id ? 'Updating...' : appt.isCheckedIn ? 'At Clinic' : 'Mark Arrived'}</span>
                          </button>

                          {/* Call Patient (if arrived and today) */}
                          {(appt.appointmentDate === getLocalDateString() || (appt.appointmentDate === getYesterdayDateString() && appt.isCheckedIn)) && appt.isCheckedIn && (
                            isDoctorAway ? (
                              <span className="h-8 px-3 rounded-full text-xs font-medium text-[#86868b] bg-white border border-[#e5e5ea] flex items-center">
                                Doctor Away
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={callingId !== null}
                                onClick={() => handleCallPatient(appt.id)}
                                className="h-8 px-3.5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all active:scale-[0.98]"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                {callingId === appt.id ? 'Calling...' : 'Call'}
                              </button>
                            )
                          )}

                          {/* Shift appointment to another shift or date */}
                          <button
                            type="button"
                            onClick={() => {
                              setRescheduleTarget({
                                appointmentId: appt.id,
                                patientName: appt.patientName || appt.patient?.user?.fullName || 'Patient',
                                doctorName: user?.fullName || 'Practitioner',
                                currentDate: appt.appointmentDate || date,
                                currentQueueNumber: appt.queueNumber,
                                doctorId: user?.doctorProfile?.id || '',
                                slotId: appt.slotId,
                              });
                              const [y, m, day] = (appt.appointmentDate || date || getLocalDateString()).split('-').map(Number);
                              const d = new Date(y, m - 1, day + 1);
                              setRescheduleDate(getLocalDateString(d));
                              setRescheduleSlotId(appt.slotId || '');
                              setRescheduleError(null);
                            }}
                            className="h-8 px-3 rounded-full text-[#1d1d1f] hover:bg-[#f5f5f7] text-xs font-medium border border-[#e5e5ea] transition-all cursor-pointer"
                            title="Shift to another shift or date"
                          >
                            Shift
                          </button>

                          {/* Cancel appointment */}
                          <button
                            type="button"
                            disabled={cancellingId === appt.id}
                            onClick={() => handleCancelAppointment(appt.id, appt.patientName || appt.patient?.user?.fullName || 'Patient')}
                            className="h-8 px-3 rounded-full text-[#86868b] hover:text-rose-600 hover:bg-rose-50 text-xs font-medium border border-[#e5e5ea] transition-all cursor-pointer disabled:opacity-50"
                            title="Cancel appointment"
                          >
                            {cancellingId === appt.id ? 'Cancelling...' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    );
                  };

                    if (queueScope === 'all-upcoming') {
                      const groups: Record<string, Appointment[]> = {};
                      filteredWaiting.forEach((appt) => {
                        const d = appt.appointmentDate || 'Upcoming';
                        if (!groups[d]) groups[d] = [];
                        groups[d].push(appt);
                      });

                      return (
                        <div className="space-y-5">
                          {Object.entries(groups).map(([groupDate, dateAppts]) => (
                            <div key={groupDate} className="space-y-2.5">
                              <div className="flex items-center justify-between px-1">
                                <span className="text-xs font-semibold text-[#1d1d1f] tracking-tight">
                                  {groupDate === queueData?.upcomingSummary?.tomorrowDate ? 'Tomorrow' : groupDate}
                                </span>
                                <span className="text-[11px] font-medium text-[#86868b]">
                                  {dateAppts.length} patient{dateAppts.length > 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="space-y-2.5">
                                {dateAppts.map((appt) => renderApptCard(appt))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {filteredWaiting.map((appt) => renderApptCard(appt))}
                      </div>
                    );
                  })()}
                </div>

                {/* Completed Consultations Card */}
                {displayedCompletedQueue.length > 0 && (
                  <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[15px] font-semibold text-[#1d1d1f] tracking-tight">
                        Completed Consultations ({displayedCompletedQueue.length})
                      </h4>
                    </div>
                    <div className="space-y-2.5">
                      {displayedCompletedQueue.map((appt) => (
                        <div
                          key={appt.id}
                          className="p-3.5 rounded-2xl bg-[#f5f5f7]/60 border border-[#e5e5ea] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-semibold text-[#86868b]">#{appt.queueNumber}</span>
                            <span className="font-semibold text-[14px] text-[#1d1d1f]">
                              {appt.patientName || appt.patient?.user?.fullName || 'Patient'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[#0066cc] bg-[#0066cc]/10 px-2.5 py-0.5 rounded-full font-medium">
                              Completed
                            </span>
                            <button
                              type="button"
                              onClick={() => navigate(`/doctor/consultation/${appt.id}`)}
                              className="h-8 px-3 rounded-full bg-white hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium transition-all cursor-pointer"
                            >
                              Notes
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rapid Add Walk-in Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-[28px] border border-[#e5e5ea] max-w-md w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.16)] relative text-left">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setWalkinError(null);
                setWalkinSuccess(null);
              }}
              className="absolute top-5 right-5 p-2 text-[#86868b] hover:text-[#1d1d1f] rounded-full hover:bg-[#f5f5f7] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <h3 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                Add Walk-in Patient
              </h3>
            </div>

            {walkinError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{walkinError}</span>
              </div>
            )}

            {walkinSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
                <span>{walkinSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateWalkin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Patient Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter patient's full name"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                    Age
                  </label>
                  <input
                    type="number"
                    placeholder="Years"
                    value={walkinAge}
                    onChange={(e) => setWalkinAge(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                    Gender
                  </label>
                  <div className="relative">
                    <select
                      value={walkinGender}
                      onChange={(e) => setWalkinGender(e.target.value)}
                      className="w-full h-11 pl-3.5 pr-9 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 appearance-none cursor-pointer"
                    >
                      <option value="Not Specified">Not Specified</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Mobile Number <span className="text-[#86868b] font-normal">(Optional)</span>
                </label>
                <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all duration-150 overflow-hidden">
                  <div className="h-full px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] flex items-center justify-center select-none">
                    <span className="text-[13px] font-semibold text-[#1d1d1f]">+91</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    value={sanitizeIndianPhone(walkinPhone)}
                    onChange={(e) => setWalkinPhone(sanitizeIndianPhone(e.target.value))}
                    className="w-full h-full px-3.5 bg-transparent text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none tracking-wide"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Consultation Date
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWalkinDate(getLocalDateString())}
                    className={`h-9 px-3.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      walkinDate === getLocalDateString()
                        ? 'bg-[#0066cc] text-white border-[#0066cc]'
                        : 'bg-white text-[#1d1d1f] border-[#d2d2d7] hover:bg-[#f5f5f7]'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalkinDate(getTomorrowDateString())}
                    className={`h-9 px-3.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      walkinDate === getTomorrowDateString()
                        ? 'bg-[#0066cc] text-white border-[#0066cc]'
                        : 'bg-white text-[#1d1d1f] border-[#d2d2d7] hover:bg-[#f5f5f7]'
                    }`}
                  >
                    Tomorrow
                  </button>
                  <input
                    type="date"
                    min={getLocalDateString()}
                    value={walkinDate}
                    onChange={(e) => setWalkinDate(e.target.value)}
                    className="flex-1 h-9 px-3 rounded-xl border border-[#d2d2d7] bg-white text-[13px] text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 cursor-pointer"
                  />
                </div>
              </div>

              {/* Clinic Affiliation Venue Selector */}
              {affiliations?.clinics && affiliations.clinics.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                    Clinic Venue
                  </label>
                  <div className="relative">
                    <select
                      required
                      value={walkinClinicId}
                      onChange={(e) => {
                        setWalkinClinicId(e.target.value);
                        setWalkinSlotId('');
                      }}
                      className="w-full h-11 pl-3.5 pr-9 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 appearance-none cursor-pointer"
                    >
                      <option value="">Select Clinic Venue</option>
                      {affiliations.clinics.map((c) => (
                        <option key={c.clinicId} value={c.clinicId}>
                          {c.clinicName} {c.city ? `(${c.city})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              )}

              {affiliations && affiliations.clinics.length === 0 && (
                <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs">
                  <span>No active clinic affiliations found. Please affiliate with a verified clinic to issue walk-in queue tokens.</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Checking Shift
                </label>
                <div className="relative">
                  <select
                    value={walkinSlotId}
                    onChange={(e) => setWalkinSlotId(e.target.value)}
                    className="w-full h-11 pl-3.5 pr-9 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 appearance-none cursor-pointer"
                  >
                    <option value="">Current / Default Shift</option>
                    {(
                      (walkinClinicId && affiliations?.clinics.find((c) => c.clinicId === walkinClinicId)?.slots) ||
                      (affiliations?.clinics?.length === 1 && affiliations.clinics[0].slots) ||
                      parseDoctorSlots(user?.doctorProfile)
                    ).map((slot, i) => (
                      <option key={slot.id || i} value={slot.id}>
                        {formatShiftOption(slot)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Reason for Visit
                </label>
                <input
                  type="text"
                  placeholder="Fever, cough, general consultation"
                  value={walkinReason}
                  onChange={(e) => setWalkinReason(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={walkinSubmitting}
                  className="w-full h-11 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.99] text-white text-[14px] font-semibold tracking-tight shadow-[0_2px_8px_rgba(0,102,204,0.22)] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  {walkinSubmitting ? 'Issuing Ticket...' : 'Queue Walk-in Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Affiliate Clinic Modal */}
      {isAffiliateModalOpen && (() => {
        const availableStates = Array.from(
          new Set(publicClinics.map((c) => c.state).filter(Boolean) as string[])
        ).sort();

        const availableCities = Array.from(
          new Set(
            publicClinics
              .filter((c) => clinicStateFilter === 'All' || c.state === clinicStateFilter)
              .map((c) => c.city)
              .filter(Boolean) as string[]
          )
        ).sort();

        const filteredPublicClinics = publicClinics
          .filter((c) => c.isVerified)
          .filter((c) => {
            if (clinicStateFilter !== 'All' && c.state !== clinicStateFilter) return false;
            if (clinicCityFilter !== 'All' && c.city !== clinicCityFilter) return false;
            if (clinicSearchQuery.trim()) {
              const q = clinicSearchQuery.toLowerCase().trim();
              const name = (c.clinicName || '').toLowerCase();
              const addr = (c.address || '').toLowerCase();
              const city = (c.city || '').toLowerCase();
              const state = (c.state || '').toLowerCase();
              return name.includes(q) || addr.includes(q) || city.includes(q) || state.includes(q);
            }
            return true;
          });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-2xl bg-white rounded-[28px] border border-[#e5e5ea] shadow-[0_24px_60px_rgba(0,0,0,0.16)] overflow-hidden flex flex-col max-h-[88vh]">
              {/* Modal Header */}
              <div className="p-6 border-b border-[#e5e5ea] flex items-start justify-between gap-4 bg-white">
                <div>
                  <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">
                    Affiliate Clinic or Hospital
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAffiliateModalOpen(false)}
                  className="p-2 rounded-full text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* In-Modal Feedback Alerts */}
              {feedbackSuccess && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0" />
                    <span>{feedbackSuccess}</span>
                  </div>
                  <button onClick={() => setFeedbackSuccess(null)} className="text-[#86868b] hover:text-[#1d1d1f]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {feedbackError && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 text-rose-700 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{feedbackError}</span>
                  </div>
                  <button onClick={() => setFeedbackError(null)} className="text-rose-700 hover:text-rose-900">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Search & Location Filter Bar */}
              <div className="p-5 sm:px-6 border-b border-[#e5e5ea] bg-white space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={clinicSearchQuery}
                    onChange={(e) => setClinicSearchQuery(e.target.value)}
                    placeholder="Search clinic by name, address, or area..."
                    className="w-full h-11 pl-10 pr-9 rounded-xl bg-white border border-[#d2d2d7] text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                    autoFocus
                  />
                  {clinicSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setClinicSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f] p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* State & City Cascading Dropdowns */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  {availableStates.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-[#86868b]">State:</span>
                      <div className="relative">
                        <select
                          value={clinicStateFilter}
                          onChange={(e) => {
                            setClinicStateFilter(e.target.value);
                            setClinicCityFilter('All');
                          }}
                          className="h-9 pl-3 pr-8 rounded-xl bg-white border border-[#d2d2d7] text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] appearance-none cursor-pointer"
                        >
                          <option value="All">All States</option>
                          {availableStates.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-[#86868b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  {(availableCities.length > 0 || clinicStateFilter !== 'All') && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-[#86868b]">City:</span>
                      <div className="relative">
                        <select
                          value={clinicCityFilter}
                          onChange={(e) => setClinicCityFilter(e.target.value)}
                          className="h-9 pl-3 pr-8 rounded-xl bg-white border border-[#d2d2d7] text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] appearance-none cursor-pointer"
                        >
                          <option value="All">All Cities</option>
                          {availableCities.map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-[#86868b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  <span className="text-xs text-[#86868b] ml-auto">
                    {filteredPublicClinics.length} verified {filteredPublicClinics.length === 1 ? 'clinic' : 'clinics'} found
                  </span>
                </div>
              </div>

              {/* Clinics List */}
              <div className="p-5 sm:px-6 overflow-y-auto space-y-3 flex-1 bg-[#f5f5f7]">
                {filteredPublicClinics.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">No Verified Clinics Found</p>
                    <p className="text-xs text-[#86868b] mt-1 max-w-sm mx-auto leading-relaxed">
                      {clinicSearchQuery || clinicStateFilter !== 'All' || clinicCityFilter !== 'All'
                        ? 'No clinics match your current search or location filters. Try clearing your search.'
                        : 'No verified clinics are currently registered in the network.'}
                    </p>
                    {(clinicSearchQuery || clinicStateFilter !== 'All' || clinicCityFilter !== 'All') && (
                      <button
                        type="button"
                        onClick={() => {
                          setClinicSearchQuery('');
                          setClinicStateFilter('All');
                          setClinicCityFilter('All');
                        }}
                        className="mt-3 h-8 px-4 rounded-full text-xs font-medium text-[#0066cc] bg-[#0066cc]/10 hover:bg-[#0066cc]/20 transition-all cursor-pointer"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                ) : (
                  filteredPublicClinics.map((c) => {
                    const isAffiliated = affiliations?.clinics.some((ac) => ac.clinicId === c.id);
                    const isPending = affiliations?.outgoingRequests?.some(
                      (req) => req.clinicId === c.id || req.clinicName === c.clinicName
                    );
                    const hasIncoming = affiliations?.incomingRequests?.some((req) => req.clinicId === c.id);
                    const isAddingThis = affiliatingClinicId === c.id;

                    return (
                      <div
                        key={c.id}
                        className="p-4 rounded-[20px] bg-white border border-[#e5e5ea] hover:border-[#d2d2d7] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-[15px] text-[#1d1d1f] tracking-tight">
                              {c.clinicName}
                            </h4>
                            <span
                              title="Verified Healthcare Facility"
                              className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc]"
                            >
                              <CheckCircle2 className="w-3 h-3 text-[#0066cc]" />
                              Verified
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-[#86868b] mt-1 truncate">
                            <MapPin className="w-3.5 h-3.5 shrink-0 text-[#86868b]" />
                            <span className="truncate">
                              {c.address}
                              {c.city ? `, ${c.city}` : ''}
                              {c.state ? `, ${c.state}` : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-[#86868b] mt-2">
                            {c.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {c.phone}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {c._count?.doctors ?? c.doctors?.length ?? 0} Specialist{c._count?.doctors === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[#f0f0f2]">
                          {isAffiliated ? (
                            <span className="px-3.5 py-1.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] text-xs font-semibold flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Affiliated
                            </span>
                          ) : isPending ? (
                            <span className="px-3.5 py-1.5 rounded-full bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea] text-xs font-medium flex items-center gap-1.5">
                              <Clock3 className="w-3.5 h-3.5" />
                              Request Pending
                            </span>
                          ) : hasIncoming ? (
                            <span className="px-3.5 py-1.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] text-xs font-semibold flex items-center gap-1.5">
                              Clinic Requested You
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isAddingThis}
                              onClick={() => handleAddClinic(c.id)}
                              className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                            >
                              {isAddingThis ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Affiliating...</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Affiliate</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[#e5e5ea] bg-white flex items-center justify-between text-xs text-[#86868b] px-6">
                <span>Only administrator-verified clinics can be affiliated.</span>
                <button
                  type="button"
                  onClick={() => setIsAffiliateModalOpen(false)}
                  className="h-9 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Clinic QR Check-In Standee Modal */}
      {selectedStandeeClinic && (
        <ClinicQrStandeeModal
          isOpen={isStandeeModalOpen}
          onClose={() => setIsStandeeModalOpen(false)}
          clinicId={selectedStandeeClinic.clinicId}
          clinicName={selectedStandeeClinic.clinicName}
          clinicAddress={selectedStandeeClinic.clinicAddress}
          clinicPhone={selectedStandeeClinic.clinicPhone}
          checkinCode={selectedStandeeClinic.checkinCode}
        />
      )}

      {/* Reschedule / Shift Modal for Doctor */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn print:hidden">
          <div className="bg-white rounded-t-[28px] sm:rounded-[28px] border border-[#e5e5ea] max-w-md w-full p-6 sm:p-7 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-7 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex items-start justify-between pb-3 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                  Shift Appointment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="text-[#86868b] hover:text-[#1d1d1f] p-1.5 rounded-full hover:bg-[#f5f5f7] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#86868b]">Patient</span>
                <span className="font-semibold text-[#1d1d1f]">{rescheduleTarget.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868b]">Current Date</span>
                <span className="font-medium text-[#1d1d1f]">
                  {rescheduleTarget.currentDate}
                  {rescheduleTarget.currentQueueNumber ? ` (Token #${rescheduleTarget.currentQueueNumber})` : ''}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                New Appointment Date
              </label>
              <input
                type="date"
                min={getLocalDateString()}
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] text-[14px] bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc]"
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    setRescheduleDate(getLocalDateString(d));
                  }}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] transition-all cursor-pointer"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 2);
                    setRescheduleDate(getLocalDateString(d));
                  }}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] transition-all cursor-pointer"
                >
                  In 2 Days
                </button>
              </div>
            </div>

            {availableShifts.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Consultation Shift
                </label>
                <div className="relative">
                  <select
                    value={rescheduleSlotId}
                    onChange={(e) => setRescheduleSlotId(e.target.value)}
                    className="w-full h-11 pl-3.5 pr-9 rounded-xl border border-[#d2d2d7] text-[13px] bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] appearance-none cursor-pointer"
                  >
                    <option value="">Standard Shift / Any</option>
                    {availableShifts.map((s: any, idx: number) => (
                      <option key={s.id || idx} value={s.id}>
                        {s.name || `Shift ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {rescheduleError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{rescheduleError}</span>
              </div>
            )}

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                disabled={rescheduling}
                className="flex-1 h-11 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReschedule}
                disabled={rescheduling}
                className="flex-1 h-11 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-medium transition-all cursor-pointer disabled:opacity-60"
              >
                {rescheduling ? 'Shifting...' : 'Confirm Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categorized Practice Report & PDF Export Modal */}
      <ClinicalReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        role="DOCTOR"
        doctorName={`Dr. ${doctorDisplayName}`}
        initialClinicId={selectedClinicId !== 'all' ? selectedClinicId : undefined}
        availableClinics={affiliations?.clinics?.map((c) => ({
          clinicId: c.clinicId,
          clinicName: c.clinicName,
          city: c.city,
        }))}
      />

      {/* Practitioner Schedule & Leave Management Modal */}
      {scheduleLeaveModalClinic && (
        <DoctorScheduleLeaveModal
          isOpen={true}
          onClose={() => setScheduleLeaveModalClinic(null)}
          doctorId={user?.doctorProfile?.id || ''}
          doctorName={user?.fullName || 'Practitioner'}
          clinicId={scheduleLeaveModalClinic.clinicId}
          clinicName={scheduleLeaveModalClinic.clinicName}
          onSuccess={() => {
            fetchAffiliations();
            fetchQueue(false);
          }}
        />
      )}
    </DashboardLayout>
  );
};
