import React, { useEffect, useState, useCallback, useMemo, createContext, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, Appointment, parseDoctorSlots, format12Hour, getLocalDateString, DoctorAffiliationsData, ClinicProfile } from '../../../services/api';
import { formatIndianPhone, isValidIndianPhone } from '../../../utils/phoneUtils';
import { useVisibilityPolling } from '../../../utils/useVisibilityPolling';
import { useLiveEvent } from '../../../utils/liveEvents';
import { useAuth } from '../../../context/AuthContext';
import { DashboardNavItem } from '../../../components/layout/DashboardLayout';
import { Building2, Settings, LayoutDashboard, Calendar } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import { AppleFilterOption } from '../../../components/ui/AppleFilterSelect';
import { getYesterdayDateString, matchesSlot } from './helpers';

/** All data, effects and actions for DoctorDashboard, shared with its parts through context. */
export const useDoctorDashboardState = () => {
  const { user, loading: loadingAuth, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { confirm } = useConfirm();
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
  // Instant refresh when any queue changes (e.g. receptionist approves or checks in a patient)
  useLiveEvent('queue', () => fetchQueue(false), Boolean(user) && user?.role?.toUpperCase() === 'DOCTOR' && !loadingAuth);
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
      setWalkinError('Add a clinic first.');
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
    const ok = await confirm({
      title: 'Detach Clinic?',
      message: `Are you sure you want to detach your profile from ${clinicName}?`,
      confirmText: 'Detach Clinic',
      isDestructive: true,
    });
    if (!ok) return;
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      await api.removeDoctorClinic(clinicId);
      setFeedbackSuccess(`Detached from ${clinicName}`);
      toast.success(`Detached from ${clinicName}`);
      if (selectedClinicId === clinicId) {
        setSelectedClinicId('all');
      }
      await fetchAffiliations();
      await fetchQueue(false);
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to detach clinic');
      toast.error(err.message || 'Failed to detach clinic');
    }
  };
  const handleRespondClinicAffiliation = async (affiliationId: string, action: 'ACCEPT' | 'REJECT') => {
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      const res = await api.respondToClinicAffiliation(affiliationId, action);
      setFeedbackSuccess(res.message || `Clinic request ${action.toLowerCase()}ed successfully`);
      toast.success(res.message || `Clinic request ${action.toLowerCase()}ed`);
      await fetchAffiliations();
      await fetchQueue(false);
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to respond to affiliation request');
      toast.error(err.message || 'Failed to respond to affiliation request');
    }
  };
  const handleRemoveReceptionist = async (receptionistId: string, name: string) => {
    const ok = await confirm({
      title: 'Unlink Receptionist?',
      message: `Are you sure you want to unlink ${name} from your receptionist staff?`,
      confirmText: 'Unlink Staff',
      isDestructive: true,
    });
    if (!ok) return;
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      await api.removeDoctorReceptionist(receptionistId);
      setFeedbackSuccess(`Unlinked ${name}`);
      toast.success(`Unlinked ${name}`);
      await fetchAffiliations();
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to unlink receptionist');
      toast.error(err.message || 'Failed to unlink receptionist');
    }
  };
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const handleHoldConsultation = async (appointmentId: string) => {
    setHoldingId(appointmentId);
    try {
      await api.holdConsultation(appointmentId);
      toast.info('Consultation placed on hold');
      await fetchQueue(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to put consultation on hold');
    } finally {
      setHoldingId(null);
    }
  };
  const handleCallPatient = async (appointmentId: string) => {
    if (user?.doctorProfile?.cabinStatus && user.doctorProfile.cabinStatus !== 'IN_CABIN') {
      const awayMsg = user.doctorProfile.cabinStatus === 'STEPPED_OUT'
        ? `You are currently marked as 'Stepped Out'${user.doctorProfile.expectedReturnTime ? ` (expected return ~${user.doctorProfile.expectedReturnTime})` : ''}. Please set your presence to 'In Cabin' before calling a patient.`
        : "You are currently marked as 'Not in Cabin'. Please set your presence to 'In Cabin' before calling a patient.";
      toast.warning(awayMsg);
      return;
    }

    const target = queueData?.waitingQueue?.find((a) => a.id === appointmentId);
    if (target) {
      const todayStr = getLocalDateString();
      const yesterdayStr = getYesterdayDateString();
      const isValidDate = target.appointmentDate === todayStr || (target.appointmentDate === yesterdayStr && target.isCheckedIn);
      if (!isValidDate) {
        toast.warning(`Cannot call patient scheduled for ${target.appointmentDate}. Only patients scheduled for today or active overnight shifts can be called into the active cabin.`);
        return;
      }
      if (!target.isCheckedIn) {
        toast.warning('Mark the patient as arrived first.');
        return;
      }
    }
    setCallingId(appointmentId);
    try {
      await api.callPatient(appointmentId);
      await fetchQueue();
      navigate(`/doctor/consultation/${appointmentId}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to call patient');
    } finally {
      setCallingId(null);
    }
  };
  const [completingId, setCompletingId] = useState<string | null>(null);
  const handleCompleteConsultation = async (appointmentId: string) => {
    setCompletingId(appointmentId);
    try {
      await api.completeConsultation({ appointmentId });
      toast.success('Consultation completed successfully');
      await fetchQueue();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete consultation');
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
      toast.success(nextStatus ? 'Patient marked arrived' : 'Arrival status removed');
      await fetchQueue();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update patient arrival status');
    } finally {
      setTogglingCheckinId(null);
    }
  };
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const handleCancelAppointment = async (appointmentId: string, patientName: string) => {
    const ok = await confirm({
      title: 'Cancel Queue Appointment?',
      message: `Are you sure you want to cancel the queue appointment for ${patientName}? This action cannot be undone.`,
      confirmText: 'Yes, Cancel',
      isDestructive: true,
    });
    if (!ok) return;

    setCancellingId(appointmentId);
    try {
      await api.cancelAppointment(appointmentId);
      toast.success(`Appointment for ${patientName} cancelled`);
      await fetchQueue(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel appointment');
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
  const isAnyModalOpen =
    showAddModal ||
    isAffiliateModalOpen ||
    Boolean(rescheduleTarget) ||
    isStandeeModalOpen ||
    isReportModalOpen ||
    Boolean(scheduleLeaveModalClinic);
  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAnyModalOpen]);
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
      label: 'Queue',
      icon: LayoutDashboard,
      active: activeTab === 'queue',
      onClick: () => {
        setActiveTab('queue');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    },
    {
      id: 'affiliations',
      label: 'Clinics',
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
      label: 'Shifts',
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
  return {
    user,
    loadingAuth,
    updateUser,
    navigate,
    searchParams,
    setSearchParams,
    toast,
    confirm,
    isStandeeModalOpen,
    setIsStandeeModalOpen,
    selectedStandeeClinic,
    setSelectedStandeeClinic,
    activeTab,
    setActiveTab,
    affiliations,
    setAffiliations,
    publicClinics,
    setPublicClinics,
    affiliationsLoading,
    setAffiliationsLoading,
    isAffiliateModalOpen,
    setIsAffiliateModalOpen,
    isReportModalOpen,
    setIsReportModalOpen,
    scheduleLeaveModalClinic,
    setScheduleLeaveModalClinic,
    clinicSearchQuery,
    setClinicSearchQuery,
    clinicStateFilter,
    setClinicStateFilter,
    clinicCityFilter,
    setClinicCityFilter,
    affiliatingClinicId,
    setAffiliatingClinicId,
    feedbackSuccess,
    setFeedbackSuccess,
    feedbackError,
    setFeedbackError,
    date,
    setDate,
    queueScope,
    setQueueScope,
    selectedClinicId,
    setSelectedClinicId,
    selectedSlotId,
    setSelectedSlotId,
    queueFiltersDrawerOpen,
    setQueueFiltersDrawerOpen,
    queueSearch,
    setQueueSearch,
    queueData,
    setQueueData,
    loading,
    setLoading,
    callingId,
    setCallingId,
    fetchError,
    setFetchError,
    handleClinicChange,
    fetchQueue,
    fetchAffiliations,
    showAddModal,
    setShowAddModal,
    walkinName,
    setWalkinName,
    walkinAge,
    setWalkinAge,
    walkinGender,
    setWalkinGender,
    walkinPhone,
    setWalkinPhone,
    walkinDate,
    setWalkinDate,
    walkinReason,
    setWalkinReason,
    walkinSlotId,
    setWalkinSlotId,
    walkinClinicId,
    setWalkinClinicId,
    walkinSubmitting,
    setWalkinSubmitting,
    walkinError,
    setWalkinError,
    walkinSuccess,
    setWalkinSuccess,
    handleCreateWalkin,
    handleAddClinic,
    handleRemoveClinic,
    handleRespondClinicAffiliation,
    handleRemoveReceptionist,
    holdingId,
    setHoldingId,
    handleHoldConsultation,
    handleCallPatient,
    completingId,
    setCompletingId,
    handleCompleteConsultation,
    togglingCheckinId,
    setTogglingCheckinId,
    handleToggleCheckIn,
    cancellingId,
    setCancellingId,
    handleCancelAppointment,
    rescheduleTarget,
    setRescheduleTarget,
    rescheduleDate,
    setRescheduleDate,
    rescheduleSlotId,
    setRescheduleSlotId,
    rescheduling,
    setRescheduling,
    rescheduleError,
    setRescheduleError,
    rescheduleSuccess,
    setRescheduleSuccess,
    isAnyModalOpen,
    handleConfirmReschedule,
    isVerified,
    isDoctorAway,
    totalPendingRequests,
    doctorDisplayName,
    navItems,
    currentClinic,
    availableShifts,
    targetSlotObj,
    displayedWaitingQueue,
    displayedCompletedQueue,
    displayedActiveInConsultation,
    clinicWaitingCounts,
    slotWaitingCounts,
    totalShiftQueueCount,
    clinicFilterOptions,
    shiftFilterOptions,
  };
};

export type DoctorDashboardState = ReturnType<typeof useDoctorDashboardState>;
export const DoctorDashboardContext = createContext<DoctorDashboardState | null>(null);
export const useDoctorDashboard = (): DoctorDashboardState => {
  const value = useContext(DoctorDashboardContext);
  if (!value) throw new Error('useDoctorDashboard must be used inside DoctorDashboard');
  return value;
};
