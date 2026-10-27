import React, { useEffect, useState, useCallback, useMemo, useRef, createContext, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, Appointment, parseDoctorSlots, format12Hour, getLocalDateString, DoctorAffiliationsData, ClinicProfile, cleanSlotName, formatDisplayDate } from '../../../services/api';
import { formatIndianPhone, isValidIndianPhone } from '../../../utils/phoneUtils';
import { useVisibilityPolling } from '../../../utils/useVisibilityPolling';
import { useLiveEvent } from '../../../utils/liveEvents';
import { isEventForDoctors } from '../../../utils/liveRefresh';
import { useAuth } from '../../../context/AuthContext';
import { DashboardNavItem } from '../../../components/layout/DashboardLayout';
import { Building2, Settings, LayoutDashboard, Calendar } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import { AppleFilterOption } from '../../../components/ui/AppleFilterSelect';
import { getYesterdayDateString, matchesSlot } from './helpers';

type DoctorQueueData = {
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
};

// Last data shown, kept while the doctor visits other pages (Shifts, Settings, a consultation),
// so coming back shows it at once and refreshes quietly instead of starting from a spinner.
const lastSeen: {
  userId?: string;
  queueKey?: string;
  queue?: DoctorQueueData;
  affiliations?: DoctorAffiliationsData;
  publicClinics?: ClinicProfile[];
} = {};

/** All data, effects and actions for DoctorDashboard, shared with its parts through context. */
export const useDoctorDashboardState = () => {
  const { user, loading: loadingAuth, updateUser } = useAuth();
  const userId = user?.id;
  const remembered = userId && lastSeen.userId === userId ? lastSeen : undefined;
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
  const [affiliations, setAffiliations] = useState<DoctorAffiliationsData | null>(() => remembered?.affiliations ?? null);
  const [publicClinics, setPublicClinics] = useState<ClinicProfile[]>(() => remembered?.publicClinics ?? []);
  const hasAffiliationsRef = useRef(Boolean(remembered?.affiliations));
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
  const [queueData, setQueueData] = useState<DoctorQueueData | null>(() =>
    remembered?.queueKey === `${getLocalDateString()}|date` ? remembered.queue ?? null : null
  );
  const [loading, setLoading] = useState(() => !queueData);
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
      if (userId) {
        if (lastSeen.userId !== userId) {
          lastSeen.affiliations = undefined;
          lastSeen.publicClinics = undefined;
        }
        lastSeen.userId = userId;
        lastSeen.queueKey = `${date}|${queueScope}`;
        lastSeen.queue = data;
      }
    } catch (err: any) {
      console.error('Failed to load doctor queue:', err);
      setFetchError(err.message || 'Unable to connect to healthcare backend');
    } finally {
      setLoading(false);
    }
  }, [date, queueScope, userId]);
  // Shows the result of a button at once; the quiet refresh that follows brings the full truth.
  const patchQueue = useCallback((change: (q: DoctorQueueData) => DoctorQueueData) => {
    setQueueData((prev) => {
      if (!prev) return prev;
      const next = change(prev);
      if (lastSeen.queue === prev) lastSeen.queue = next;
      return next;
    });
  }, []);
  const refreshQueueQuietly = useCallback(() => {
    fetchQueue(false).catch(() => {});
  }, [fetchQueue]);
  const fetchAffiliations = useCallback(async (showLoading = true) => {
    // Spinner only before the first load; later refreshes keep the list on screen
    if (showLoading && !hasAffiliationsRef.current) setAffiliationsLoading(true);
    try {
      const [affRes, pubClinics] = await Promise.all([
        api.getDoctorAffiliations(),
        api.getPublicClinics(),
      ]);
      setAffiliations(affRes);
      setPublicClinics(pubClinics);
      hasAffiliationsRef.current = true;
      if (userId) {
        if (lastSeen.userId !== userId) {
          lastSeen.queue = undefined;
          lastSeen.queueKey = undefined;
        }
        lastSeen.userId = userId;
        lastSeen.affiliations = affRes;
        lastSeen.publicClinics = pubClinics;
      }
    } catch (err: any) {
      console.error('Failed to load affiliations:', err);
    } finally {
      setAffiliationsLoading(false);
    }
  }, [userId]);
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
  // Instant refresh when this doctor's queue changes (e.g. receptionist approves or checks in a patient).
  // Events about other doctors are ignored; the 10s poll above stays as backup.
  useLiveEvent(
    'queue',
    (evt) => {
      if (isEventForDoctors(evt.doctorId, [queueData?.doctorId])) fetchQueue(false);
    },
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
  // Tracking code shown after adding a walk-in with a phone number (FIX-058)
  const [walkinCode, setWalkinCode] = useState<string | null>(null);
  const handleCreateWalkin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkinName.trim()) {
      setWalkinError('Please enter the patient full name');
      return;
    }
    if (walkinPhone.trim() && !isValidIndianPhone(walkinPhone)) {
      setWalkinError('Enter a valid 10-digit mobile number');
      return;
    }

    if (walkinAge.trim()) {
      const parsedAge = parseInt(walkinAge.trim(), 10);
      if (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 125) {
        setWalkinError('Enter an age between 0 and 125');
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
      setWalkinError('Choose a clinic');
      return;
    }

    setWalkinSubmitting(true);
    setWalkinError(null);
    try {
      const targetDoctorId = user?.doctorProfile?.id || user?.id || '';
      const hadPhone = Boolean(walkinPhone.trim());
      const booked: any = await api.bookAppointment({
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
      setWalkinSuccess(`${walkinName} added to the queue`);
      const code: string | null = hadPhone ? booked?.walkInCode ?? booked?.data?.walkInCode ?? null : null;
      setWalkinName('');
      setWalkinAge('');
      setWalkinPhone('');
      setWalkinDate(getLocalDateString());
      setWalkinReason('');
      setWalkinClinicId('');
      refreshQueueQuietly();
      if (code) {
        // Keep the modal open so the code can be read out to the patient
        setWalkinCode(code);
      } else {
        setTimeout(() => {
          setShowAddModal(false);
          setWalkinSuccess(null);
        }, 1200);
      }
    } catch (err: any) {
      setWalkinError(err.message || 'Couldn’t add walk-in. Try again.');
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
      setFeedbackSuccess(res.message || 'Request sent to the clinic.');
      await fetchAffiliations();
      await fetchQueue(false);
    } catch (err: any) {
      setFeedbackError(err.message || 'Couldn’t join clinic. Try again.');
    } finally {
      setAffiliatingClinicId(null);
    }
  };
  const handleRemoveClinic = async (clinicId: string, clinicName: string) => {
    const ok = await confirm({
      title: 'Detach Clinic?',
      message: `Leave ${clinicName}?`,
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
      setFeedbackError(err.message || 'Couldn’t leave clinic. Try again.');
      toast.error(err.message || 'Couldn’t leave clinic. Try again.');
    }
  };
  const handleRespondClinicAffiliation = async (affiliationId: string, action: 'ACCEPT' | 'REJECT') => {
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      const res = await api.respondToClinicAffiliation(affiliationId, action);
      setFeedbackSuccess(res.message || `Request ${action === 'ACCEPT' ? 'accepted' : 'declined'}`);
      toast.success(res.message || `Clinic request ${action.toLowerCase()}ed`);
      await fetchAffiliations();
      await fetchQueue(false);
    } catch (err: any) {
      setFeedbackError(err.message || 'Couldn’t respond. Try again.');
      toast.error(err.message || 'Couldn’t respond. Try again.');
    }
  };
  const handleRemoveReceptionist = async (receptionistId: string, name: string) => {
    const ok = await confirm({
      title: 'Unlink Receptionist?',
      message: `Remove ${name} from your staff?`,
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
      setFeedbackError(err.message || 'Couldn’t unlink receptionist. Try again.');
      toast.error(err.message || 'Couldn’t unlink receptionist. Try again.');
    }
  };
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const handleHoldConsultation = async (appointmentId: string) => {
    setHoldingId(appointmentId);
    try {
      await api.holdConsultation(appointmentId);
      toast.info('Consultation placed on hold');
      refreshQueueQuietly();
    } catch (err: any) {
      toast.error(err.message || 'Couldn’t put on hold. Try again.');
    } finally {
      setHoldingId(null);
    }
  };
  const handleCallPatient = async (appointmentId: string) => {
    if (user?.doctorProfile?.cabinStatus && user.doctorProfile.cabinStatus !== 'IN_CABIN') {
      const awayMsg = user.doctorProfile.cabinStatus === 'STEPPED_OUT'
        ? `You’re marked as Stepped Out. Set your status to In Cabin first.`
        : "You’re marked as Not in Cabin. Set your status to In Cabin first.";
      toast.warning(awayMsg);
      return;
    }

    const target = queueData?.waitingQueue?.find((a) => a.id === appointmentId);
    if (target) {
      const todayStr = getLocalDateString();
      const yesterdayStr = getYesterdayDateString();
      const isValidDate = target.appointmentDate === todayStr || (target.appointmentDate === yesterdayStr && target.isCheckedIn);
      if (!isValidDate) {
        toast.warning(`This patient is booked for ${formatDisplayDate(target.appointmentDate)}. You can only call today’s patients.`);
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
      // Move the patient into the cabin card right away; the queue refreshes behind it
      const called = target ? ({ ...target, status: 'IN_CONSULTATION' } as Appointment) : undefined;
      if (called) {
        patchQueue((q) => ({
          ...q,
          activeInConsultation: called,
          waitingQueue: q.waitingQueue.filter((a) => a.id !== appointmentId),
        }));
      }
      refreshQueueQuietly();
    } catch (err: any) {
      toast.error(err.message || 'Couldn’t call patient. Try again.');
    } finally {
      setCallingId(null);
    }
  };
  const [completingId, setCompletingId] = useState<string | null>(null);
  const handleCompleteConsultation = async (appointmentId: string) => {
    setCompletingId(appointmentId);
    try {
      await api.completeConsultation({ appointmentId });
      toast.success('Consultation done');
      patchQueue((q) =>
        q.activeInConsultation?.id === appointmentId
          ? {
              ...q,
              activeInConsultation: null,
              completedQueue: [...q.completedQueue, { ...q.activeInConsultation, status: 'COMPLETED' } as Appointment],
            }
          : q
      );
      refreshQueueQuietly();
    } catch (err: any) {
      toast.error(err.message || 'Couldn’t complete consultation. Try again.');
    } finally {
      setCompletingId(null);
    }
  };
  const [togglingCheckinId, setTogglingCheckinId] = useState<string | null>(null);
  const handleToggleCheckIn = async (appointmentId: string, currentStatus?: boolean) => {
    setTogglingCheckinId(appointmentId);
    const nextStatus = !currentStatus;
    // Flip it on screen now; put it back if the server says no
    const setArrived = (value: boolean) =>
      patchQueue((q) => ({
        ...q,
        waitingQueue: q.waitingQueue.map((a) => (a.id === appointmentId ? { ...a, isCheckedIn: value } : a)),
      }));
    setArrived(nextStatus);
    try {
      await api.checkInAppointmentDirect(appointmentId, nextStatus);
      toast.success(nextStatus ? 'Patient marked arrived' : 'Arrival status removed');
      refreshQueueQuietly();
    } catch (err: any) {
      setArrived(Boolean(currentStatus));
      toast.error(err.message || 'Couldn’t update arrival. Try again.');
    } finally {
      setTogglingCheckinId(null);
    }
  };
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const handleCancelAppointment = async (appointmentId: string, patientName: string) => {
    const ok = await confirm({
      title: 'Cancel Queue Appointment?',
      message: `Cancel ${patientName}’s appointment? This can’t be undone.`,
      confirmText: 'Yes, Cancel',
      isDestructive: true,
    });
    if (!ok) return;

    setCancellingId(appointmentId);
    try {
      await api.cancelAppointment(appointmentId);
      toast.success(`Appointment for ${patientName} cancelled`);
      patchQueue((q) => ({ ...q, waitingQueue: q.waitingQueue.filter((a) => a.id !== appointmentId) }));
      refreshQueueQuietly();
    } catch (err: any) {
      toast.error(err.message || 'Couldn’t cancel appointment. Try again.');
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
        `${rescheduleTarget.patientName} moved to ${formatDisplayDate(rescheduleDate)}${newQueueNum ? ` (Token #${newQueueNum})` : ''}.`
      );
      setTimeout(() => setRescheduleSuccess(null), 5000);
      setRescheduleTarget(null);
      refreshQueueQuietly();
    } catch (err: any) {
      setRescheduleError(err.message || 'Couldn’t reschedule appointment. Try again.');
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
        label: `${cleanSlotName(slot.name, `Shift ${idx + 1}`)}${timeRange}`,
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
    walkinCode,
    setWalkinCode,
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
