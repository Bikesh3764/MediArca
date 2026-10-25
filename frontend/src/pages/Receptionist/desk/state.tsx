import React, { useEffect, useState, useCallback, useMemo, useRef, createContext, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api, ReceptionistDashboardData, ReceptionistQueueItem, getLocalDateString, getIndianTimeMinutes, timeToMinutes, Appointment, QueuePreview } from '../../../services/api';
import { formatIndianPhone, isValidIndianPhone } from '../../../utils/phoneUtils';
import { useVisibilityPolling } from '../../../utils/useVisibilityPolling';
import { useLiveEvent } from '../../../utils/liveEvents';
import { useAuth } from '../../../context/AuthContext';
import { useNotifications } from '../../../context/NotificationContext';
import { DashboardNavItem } from '../../../components/layout/DashboardLayout';
import { Clock, UserPlus, Stethoscope, ShieldCheck, Bell } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import { TokenPassData, cleanDoctorName, cleanShiftDisplayName } from './helpers';

/** All data, effects and actions for ReceptionistDashboard, shared with its parts through context. */
export const useReceptionistDashboardState = () => {
  const { user, refreshUser, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  // Mandatory password change state for provisioned receptionists
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [data, setData] = useState<ReceptionistDashboardData | null>(null);
  const [, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as 'queue' | 'walkin' | 'pending' | 'doctors' | 'notifications' | null;
  const activeTab: 'queue' | 'walkin' | 'pending' | 'doctors' | 'notifications' =
    urlTab && ['queue', 'walkin', 'pending', 'doctors', 'notifications'].includes(urlTab) ? urlTab : 'queue';
  const setActiveTab = (tab: 'queue' | 'walkin' | 'pending' | 'doctors' | 'notifications') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // Notifications state from consolidated NotificationContext
  const {
    notifications,
    unreadCount: unreadNotifCount,
    markAsRead: handleMarkOneNotifRead,
    markAllRead: handleMarkAllNotifsRead,
    fetchNotifications,
  } = useNotifications();
  const [expandedNotifId, setExpandedNotifId] = useState<string | null>(null);
  const [notifFilter, setNotifFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  // Clinic QR Standee Modal state
  const [isStandeeModalOpen, setIsStandeeModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [scheduleModalDoctor, setScheduleModalDoctor] = useState<{ doctorId: string; doctorName: string } | null>(null);
  // Reschedule Appointment state
  const [rescheduleTarget, setRescheduleTarget] = useState<{
    appointmentId: string;
    patientName: string;
    doctorName: string;
    currentDate: string;
    currentQueueNumber?: number;
    doctorId: string;
    slotId?: string;
  } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleSlotId, setRescheduleSlotId] = useState<string>('');
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  // Pending Approvals state
  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [pendingSearch, setPendingSearch] = useState('');
  // Walk-in form state
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [walkinClinicId, setWalkinClinicId] = useState<string>('');
  const [appointmentDate, setAppointmentDate] = useState<string>(getLocalDateString());
  const [slotId, setSlotId] = useState<string>('');
  const [bookingFor, setBookingFor] = useState<'self' | 'other'>('self');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [gender, setGender] = useState('Not Specified');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  // Live Token & Queue calculation preview for walk-in entry
  const [walkinPreview, setWalkinPreview] = useState<QueuePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // Success Token Pass Modal
  const [bookedPass, setBookedPass] = useState<TokenPassData | null>(null);
  // Queue tab state
  const [queueDoctorId, setQueueDoctorId] = useState<string>('');
  const [queueDate, setQueueDate] = useState<string>(getLocalDateString());
  const [queueAppointments, setQueueAppointments] = useState<ReceptionistQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueSearch, setQueueSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED'>('WAITING');
  const [queueShiftFilter, setQueueShiftFilter] = useState<string>('ALL');
  // Track latest selections via refs to avoid stale closures in desk callbacks (ARCH-011)
  const selectedDoctorIdRef = useRef(selectedDoctorId);
  const queueDoctorIdRef = useRef(queueDoctorId);
  const slotIdRef = useRef(slotId);
  const [hasLoadedInitialQueue, setHasLoadedInitialQueue] = useState(false);
  useEffect(() => {
    selectedDoctorIdRef.current = selectedDoctorId;
    queueDoctorIdRef.current = queueDoctorId;
    slotIdRef.current = slotId;
  }, [selectedDoctorId, queueDoctorId, slotId]);
  const isAnyModalOpen =
    Boolean(bookedPass) ||
    Boolean(rescheduleTarget) ||
    isStandeeModalOpen ||
    isReportModalOpen ||
    Boolean(scheduleModalDoctor) ||
    Boolean(user?.mustChangePassword);
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
  const fetchPendingAppointments = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent && pendingAppointments.length === 0) {
        setPendingLoading(true);
      }
      const res = await api.getPendingAppointments();
      setPendingAppointments(res);
    } catch (err: any) {
      console.error('Failed to load pending appointments:', err);
    } finally {
      setPendingLoading(false);
    }
  }, [pendingAppointments.length]);
  const fetchDeskData = useCallback(async () => {
    try {
      setError(null);
      const res = await api.getMyReceptionist();
      setData(res);
      if (res.clinic?.id) {
        setWalkinClinicId(res.clinic.id);
      }
      if (res.doctors.length > 0) {
        const currentSelected = selectedDoctorIdRef.current;
        setSelectedDoctorId((prev) => (res.doctors.some((d: any) => d.doctorId === prev) ? prev : res.doctors[0].doctorId));
        setQueueDoctorId((prev) => (res.doctors.some((d: any) => d.doctorId === prev) ? prev : res.doctors[0].doctorId));

        const activeDoctorId = res.doctors.some((d: any) => d.doctorId === currentSelected)
          ? currentSelected
          : res.doctors[0].doctorId;
        const activeDoc = res.doctors.find((d: any) => d.doctorId === activeDoctorId) || res.doctors[0];
        if (activeDoc?.slots && activeDoc.slots.length > 0) {
          setSlotId((prev) => (activeDoc.slots.some((s: any) => s.id === (slotIdRef.current || prev)) ? (slotIdRef.current || prev) : activeDoc.slots[0].id));
        } else {
          setSlotId('');
        }
      } else {
        setSelectedDoctorId('');
        setQueueDoctorId('');
        setSlotId('');
      }
      try {
        const pendingRes = await api.getPendingAppointments();
        setPendingAppointments(pendingRes);
      } catch {
        // non-blocking
      }
    } catch (err: any) {
      console.error('Failed to load desk data:', err);
      if (err?.status === 401 || err?.response?.status === 401) {
        logout();
        navigate('/receptionist/login');
        return;
      }
      setError(err.message || 'Failed to load desk details');
    } finally {
      setLoading(false);
    }
  }, [logout, navigate]);
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) fetchDeskData();
    });
    return () => {
      mounted = false;
    };
  }, [fetchDeskData]);
  // Fetch queue when queueDoctorId or queueDate changes
  const fetchQueue = useCallback(async (docId?: string, dateStr?: string, isSilent = false) => {
    const targetDoc = docId || queueDoctorId;
    if (!targetDoc) return;
    const targetDate = dateStr || queueDate;

    // Never show disruptive loading screen if silent (polling)
    if (!isSilent) {
      setQueueLoading(true);
    }
    try {
      const res = await api.getReceptionistDoctorQueue(targetDoc, targetDate);
      setQueueAppointments(res.appointments);
      setHasLoadedInitialQueue(true);
      if (res.doctor && res.doctor.cabinStatus) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            doctors: prev.doctors.map((d) =>
              d.doctorId === targetDoc
                ? {
                    ...d,
                    cabinStatus: res.doctor.cabinStatus,
                    expectedReturnTime: res.doctor.expectedReturnTime,
                    cabinStatusUpdatedAt: res.doctor.cabinStatusUpdatedAt,
                  }
                : d
            ),
          };
        });
      }
    } catch (err: any) {
      console.error('Failed to load queue:', err);
      if (err?.status === 401 || err?.response?.status === 401) {
        logout();
        navigate('/receptionist/login');
        return;
      }
    } finally {
      setQueueLoading(false);
    }
  }, [queueDoctorId, queueDate, logout, navigate]);
  // Periodic real-time sync while tab is visible (silent background updates without loading screen)
  useVisibilityPolling(
    () => {
      if (user?.mustChangePassword) return;
      fetchPendingAppointments(true);
      if (activeTab === 'queue' && queueDoctorId) {
        fetchQueue(undefined, undefined, true);
      }
    },
    15000,
    Boolean(user) && user?.role?.toUpperCase() === 'RECEPTIONIST' && !user?.mustChangePassword
  );
  // Instant refresh when a queue changes (new online booking, doctor calls a patient, etc.)
  useLiveEvent(
    'queue',
    (evt) => {
      fetchPendingAppointments(true);
      if (activeTab === 'queue' && queueDoctorId && (!evt.doctorId || evt.doctorId === queueDoctorId)) {
        fetchQueue(undefined, undefined, true);
      }
    },
    Boolean(user) && user?.role?.toUpperCase() === 'RECEPTIONIST' && !user?.mustChangePassword
  );
  useEffect(() => {
    let mounted = true;
    if (user?.mustChangePassword) return;
    queueMicrotask(() => {
      if (!mounted) return;
      if (activeTab === 'queue' && queueDoctorId) {
        fetchQueue();
      }
      if (activeTab === 'pending') {
        fetchPendingAppointments();
      }
      if (activeTab === 'notifications') {
        fetchNotifications();
      }
    });
    return () => {
      mounted = false;
    };
  }, [activeTab, queueDoctorId, queueDate, user?.mustChangePassword, fetchQueue, fetchPendingAppointments, fetchNotifications]);
  const handleConfirmReschedule = async () => {
    if (!rescheduleTarget) return;
    if (!rescheduleDate) {
      setRescheduleError('Please choose a new appointment date.');
      return;
    }
    setRescheduling(true);
    setRescheduleError(null);
    try {
      const res = await api.rescheduleAppointment(rescheduleTarget.appointmentId, {
        newDate: rescheduleDate,
        newSlotId: rescheduleSlotId || undefined,
      });
      const newQueueNum = res?.data?.queueNumber ?? res?.data?.appointment?.queueNumber ?? res?.queueNumber;
      const tokenDisplay =
        newQueueNum !== undefined && newQueueNum !== null && newQueueNum > 0
          ? ` (Token #${newQueueNum})`
          : newQueueNum !== undefined && newQueueNum !== null && newQueueNum < 0
          ? ' (Pending Doctor Approval)'
          : '';
      setSuccessMsg(
        `Appointment for ${rescheduleTarget.patientName} shifted to ${rescheduleDate}${tokenDisplay}.`
      );
      setRescheduleTarget(null);
      if (queueDoctorId) fetchQueue();
      fetchPendingAppointments();
      fetchDeskData();
    } catch (err: any) {
      setRescheduleError(err.message || 'Failed to reschedule appointment');
    } finally {
      setRescheduling(false);
    }
  };
  const handleApprovePendingAppointment = async (apptId: string) => {
    try {
      setApprovingId(apptId);
      setError(null);
      const res = await api.approveAppointment(apptId);
      setSuccessMsg(res.message || 'Booking confirmed and queue token assigned.');
      await fetchPendingAppointments();
      fetchDeskData();
      if (queueDoctorId) {
        fetchQueue();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to approve appointment');
    } finally {
      setApprovingId(null);
    }
  };
  const handleRejectPendingAppointment = async (apptId: string) => {
    const ok = await confirm({
      title: 'Decline Booking Request?',
      message: 'Are you sure you want to decline this booking request? The patient will be notified.',
      confirmText: 'Decline Request',
      isDestructive: true,
    });
    if (!ok) return;

    try {
      setRejectingId(apptId);
      setError(null);
      const res = await api.rejectAppointment(apptId, 'Booking request declined by reception desk.');
      toast.success(res.message || 'Booking request declined');
      setSuccessMsg(res.message || 'Booking request declined.');
      await fetchPendingAppointments();
      fetchDeskData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline appointment');
      setError(err.message || 'Failed to decline appointment');
    } finally {
      setRejectingId(null);
    }
  };
  const linkedDoctors = useMemo(() => data?.doctors || [], [data?.doctors]);
  const activeSelectedDoctor = linkedDoctors.find((d) => d.doctorId === selectedDoctorId);
  const effectiveClinicId = data?.clinic?.id || walkinClinicId || activeSelectedDoctor?.clinics?.[0]?.clinicId;
  // Distinct clean shifts available for the currently inspected queue doctor
  const availableQueueShifts = useMemo(() => {
    const shiftSet = new Set<string>();
    const targetDoc = linkedDoctors.find((d) => d.doctorId === queueDoctorId);
    if (targetDoc?.slots && Array.isArray(targetDoc.slots)) {
      targetDoc.slots.forEach((s: any, idx: number) => {
        const cleaned = cleanShiftDisplayName(s.name || `Shift ${idx + 1}`);
        if (cleaned) shiftSet.add(cleaned);
      });
    }
    queueAppointments.forEach((a) => {
      const cleaned = cleanShiftDisplayName(a.checkingWindow);
      if (cleaned) shiftSet.add(cleaned);
    });
    if (shiftSet.size === 0) {
      shiftSet.add('Shift 1');
    }
    return Array.from(shiftSet).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });
  }, [linkedDoctors, queueDoctorId, queueAppointments]);
  // Dynamic queue preview for walk-in token allocation
  const fetchWalkinPreview = useCallback(async () => {
    if (!selectedDoctorId || !appointmentDate) {
      setWalkinPreview(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const preview = await api.getQueuePreview(
        selectedDoctorId,
        appointmentDate,
        slotId || undefined,
        effectiveClinicId || undefined
      );
      setWalkinPreview(preview);
      if (preview.selectedSlotId && !slotId) {
        setSlotId(preview.selectedSlotId);
      }
    } catch (err) {
      console.error('Failed to load walk-in queue preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedDoctorId, appointmentDate, slotId, effectiveClinicId]);
  useEffect(() => {
    if (activeTab === 'walkin' && selectedDoctorId && appointmentDate) {
      queueMicrotask(() => {
        fetchWalkinPreview();
      });
    }
  }, [activeTab, selectedDoctorId, appointmentDate, slotId, effectiveClinicId, fetchWalkinPreview]);
  // Evaluate current chosen slot's status
  const currentSlotStatus = useMemo(() => {
    if (!walkinPreview) return null;
    if (walkinPreview.availableSlots && walkinPreview.availableSlots.length > 0) {
      const matched = walkinPreview.availableSlots.find((s) => s.slot.id === slotId);
      if (matched) return matched;
    }
    return walkinPreview.selectedSlot || null;
  }, [walkinPreview, slotId]);
  const isSelectedShiftEnded = useMemo(() => {
    if (currentSlotStatus?.isPassed) return true;
    if (walkinPreview?.isPassed && (!slotId || slotId === walkinPreview.selectedSlotId)) return true;

    const todayStr = getLocalDateString();
    if (appointmentDate === todayStr && slotId && activeSelectedDoctor?.slots) {
      const slotObj = activeSelectedDoctor.slots.find((s) => s.id === slotId);
      if (slotObj?.endTime) {
        const currentMinutes = getIndianTimeMinutes(new Date());
        const startMins = timeToMinutes(slotObj.startTime || '00:00');
        let endMins = timeToMinutes(slotObj.endTime);
        if (endMins <= startMins) endMins += 24 * 60;
        if (currentMinutes >= endMins) {
          return true;
        }
      }
    }
    return false;
  }, [currentSlotStatus, walkinPreview, slotId, appointmentDate, activeSelectedDoctor]);
  const isSelectedShiftFull = useMemo(() => {
    if (currentSlotStatus?.isFull) return true;
    if (walkinPreview?.isFull && (!slotId || slotId === walkinPreview.selectedSlotId)) return true;
    return false;
  }, [currentSlotStatus, walkinPreview, slotId]);
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!currentPassword) {
      setPasswordError('Please enter your current temporary password');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await api.changeReceptionistPassword({
        currentPassword,
        newPassword,
      });
      if (res?.token) {
        localStorage.setItem('mediarca_token', res.token);
      }
      const updatedUser = res?.user || res?.data;
      if (updatedUser && updateUser) {
        updateUser({ ...updatedUser, mustChangePassword: false });
      }
      await refreshUser();
      setSuccessMsg('Temporary password updated. Reception desk unlocked.');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password');
    } finally {
      setChangingPassword(false);
    }
  };
  // Handle rapid walk-in booking
  const handleWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !patientName.trim() || !patientPhone.trim()) {
      setError('Please provide doctor, patient name, and mobile number');
      return;
    }

    if (!isValidIndianPhone(patientPhone)) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    if (bookingFor === 'other') {
      if (!patientName.trim()) {
        setError('Patient full name is required when booking for a dependent or family member.');
        return;
      }
      if (!patientAge.trim()) {
        setError('Patient age is required when booking for a dependent or family member.');
        return;
      }
    }

    if (patientAge.trim()) {
      const parsedAge = parseInt(patientAge.trim(), 10);
      if (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 125) {
        setError('Please enter a valid patient age between 0 and 125.');
        return;
      }
    }

    if (isSelectedShiftEnded) {
      setError('Selected checking shift has already ended for today. Please pick an upcoming shift or future date.');
      return;
    }

    if (isSelectedShiftFull) {
      setError('Selected checking shift has reached its maximum patient capacity. Please choose another shift or date.');
      return;
    }

    setBookingLoading(true);
    setError(null);
    try {
      const formattedPhone = formatIndianPhone(patientPhone);
      const res = await api.bookWalkinAppointment({
        doctorId: selectedDoctorId,
        patientName: patientName.trim(),
        patientPhone: formattedPhone,
        gender,
        patientAge: patientAge.trim() || undefined,
        isForOther: bookingFor === 'other',
        appointmentDate,
        slotId: slotId || undefined,
        clinicId: effectiveClinicId || undefined,
        reasonForVisit: reasonForVisit.trim() || 'Walk-in Consultation',
      });

      const queuedDoctor = linkedDoctors.find((d) => d.doctorId === selectedDoctorId);
      const savedPatientName = patientName.trim();
      const savedPatientPhone = formattedPhone;
      const queueNum = res?.queueNumber ?? res?.data?.queueNumber;
      const estTime = res?.estimatedTime ?? res?.data?.estimatedTime ?? 'Active';
      const chkWindow = res?.checkingWindow ?? res?.data?.checkingWindow ?? 'General Hours';

      setBookedPass({
        queueNumber: queueNum,
        estimatedTime: estTime,
        checkingWindow: chkWindow,
        appointmentDate,
        patientName: savedPatientName,
        patientPhone: savedPatientPhone,
        doctorName: queuedDoctor?.fullName || 'Practitioner',
        doctorSpecialty: queuedDoctor?.specialty,
        clinicName: data?.clinic?.clinicName,
        clinicAddress: data?.clinic?.address,
      });
      setSuccessMsg(`Token #${queueNum} issued for ${savedPatientName}`);

      // Reset form
      setPatientName('');
      setPatientAge('');
      setPatientPhone('');
      setReasonForVisit('');

      // Refresh data
      fetchDeskData();
      fetchWalkinPreview();
    } catch (err: any) {
      setError(err.message || 'Failed to book walk-in appointment');
    } finally {
      setBookingLoading(false);
    }
  };
  // Handle status updates
  const handleStatusChange = async (appointmentId: string, status: string) => {
    const targetAppt = queueAppointments.find((a) => a.id === appointmentId);
    const apptDoctorId = targetAppt?.doctorId || (queueDoctorId !== 'all' ? queueDoctorId : undefined);
    const targetDoctor = linkedDoctors.find((d) => d.doctorId === apptDoctorId);

    if (status === 'CANCELLED') {
      const patientName = targetAppt?.patientName || 'this patient';
      const promptMsg = `Are you sure you want to cancel the queue appointment for ${patientName}?`;
      const ok = confirm
        ? await confirm({
            title: 'Cancel Queue Appointment?',
            message: `${promptMsg} This action cannot be undone.`,
            confirmText: 'Yes, Cancel',
            isDestructive: true,
          })
        : window.confirm(promptMsg);
      if (!ok) return;
    }

    if (status === 'IN_CONSULTATION') {
      if (targetDoctor?.cabinStatus && targetDoctor.cabinStatus !== 'IN_CABIN') {
        const awayMsg = targetDoctor.cabinStatus === 'STEPPED_OUT'
          ? `${cleanDoctorName(targetDoctor.fullName)} has stepped out${targetDoctor.expectedReturnTime ? ` (expected return ~${targetDoctor.expectedReturnTime})` : ''}. Doctor must be In Cabin before calling patients.`
          : `${cleanDoctorName(targetDoctor.fullName)} is currently Not in Cabin. Doctor must be In Cabin before calling patients.`;
        toast.warning(awayMsg);
        return;
      }
    }

    if (status === 'IN_CONSULTATION' || status === 'COMPLETED') {
      if (targetAppt) {
        const targetDate = targetAppt.appointmentDate || queueDate;
        if (targetDate !== getLocalDateString()) {
          toast.warning(`Cannot update an appointment scheduled for ${targetDate} to '${status}'. Only today's appointments can be updated.`);
          return;
        }
        if (!targetAppt.isCheckedIn) {
          toast.warning('Patient has not checked in at the clinic yet. Please mark arrival first.');
          return;
        }
      }
    }

    try {
      await api.updateAppointmentStatus(appointmentId, status);
      toast.success(`Status updated to ${status.replace('_', ' ')}`);
      fetchQueue();
      fetchDeskData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };
  const [togglingCheckinId, setTogglingCheckinId] = useState<string | null>(null);
  const handleToggleCheckIn = async (appointmentId: string, currentStatus?: boolean) => {
    setTogglingCheckinId(appointmentId);
    try {
      const nextStatus = !currentStatus;
      const res = await api.checkInAppointmentDirect(appointmentId, nextStatus);
      if (res && (res.id || res.success)) {
        toast.success(nextStatus ? 'Patient marked arrived at clinic' : 'Arrival mark removed');
        setQueueAppointments((prev) =>
          prev.map((item) =>
            item.id === appointmentId
              ? {
                  ...item,
                  isCheckedIn: nextStatus,
                  checkedInAt: nextStatus ? new Date().toISOString() : null,
                }
              : item
          )
        );
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update clinic arrival status');
    } finally {
      setTogglingCheckinId(null);
    }
  };
  // Organized Sidebar Navigation: Live Queue first as primary workspace
  const navItems: DashboardNavItem[] = [
    {
      id: 'queue',
      label: 'Live Queue',
      icon: Clock,
      active: activeTab === 'queue',
      onClick: () => setActiveTab('queue'),
      badge: queueAppointments.length > 0 ? queueAppointments.length : undefined,
    },
    {
      id: 'walkin',
      label: 'Walk-in Booking',
      icon: UserPlus,
      active: activeTab === 'walkin',
      onClick: () => setActiveTab('walkin'),
    },
    {
      id: 'pending',
      label: 'Approvals',
      icon: ShieldCheck,
      active: activeTab === 'pending',
      onClick: () => setActiveTab('pending'),
      badge: pendingAppointments.length > 0 ? pendingAppointments.length : undefined,
    },
    {
      id: 'doctors',
      label: 'Doctors',
      icon: Stethoscope,
      active: activeTab === 'doctors',
      onClick: () => setActiveTab('doctors'),
      badge: linkedDoctors.length > 0 ? linkedDoctors.length : undefined,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      active: activeTab === 'notifications',
      onClick: () => setActiveTab('notifications'),
      badge: unreadNotifCount > 0 ? unreadNotifCount : undefined,
    },
  ];
  const clinicCity = data?.clinic?.city?.trim();
  const clinicAddr = data?.clinic?.address?.trim();
  const displayLocation = [clinicAddr, clinicCity]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');
  const titleText = data?.clinic?.clinicName ? `${data.clinic.clinicName}` : 'Reception Desk';
  const subtitleText = displayLocation ? `${displayLocation}` : undefined;
  return {
    user,
    refreshUser,
    updateUser,
    logout,
    navigate,
    toast,
    confirm,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    changingPassword,
    setChangingPassword,
    passwordError,
    setPasswordError,
    data,
    setData,
    setLoading,
    searchParams,
    setSearchParams,
    urlTab,
    activeTab,
    setActiveTab,
    error,
    setError,
    successMsg,
    setSuccessMsg,
    notifications,
    unreadNotifCount,
    handleMarkOneNotifRead,
    handleMarkAllNotifsRead,
    fetchNotifications,
    expandedNotifId,
    setExpandedNotifId,
    notifFilter,
    setNotifFilter,
    isStandeeModalOpen,
    setIsStandeeModalOpen,
    isReportModalOpen,
    setIsReportModalOpen,
    scheduleModalDoctor,
    setScheduleModalDoctor,
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
    pendingAppointments,
    setPendingAppointments,
    pendingLoading,
    setPendingLoading,
    approvingId,
    setApprovingId,
    rejectingId,
    setRejectingId,
    pendingSearch,
    setPendingSearch,
    selectedDoctorId,
    setSelectedDoctorId,
    walkinClinicId,
    setWalkinClinicId,
    appointmentDate,
    setAppointmentDate,
    slotId,
    setSlotId,
    bookingFor,
    setBookingFor,
    patientName,
    setPatientName,
    patientAge,
    setPatientAge,
    patientPhone,
    setPatientPhone,
    gender,
    setGender,
    reasonForVisit,
    setReasonForVisit,
    bookingLoading,
    setBookingLoading,
    walkinPreview,
    setWalkinPreview,
    previewLoading,
    setPreviewLoading,
    bookedPass,
    setBookedPass,
    queueDoctorId,
    setQueueDoctorId,
    queueDate,
    setQueueDate,
    queueAppointments,
    setQueueAppointments,
    queueLoading,
    setQueueLoading,
    queueSearch,
    setQueueSearch,
    statusFilter,
    setStatusFilter,
    queueShiftFilter,
    setQueueShiftFilter,
    selectedDoctorIdRef,
    queueDoctorIdRef,
    slotIdRef,
    hasLoadedInitialQueue,
    setHasLoadedInitialQueue,
    isAnyModalOpen,
    fetchPendingAppointments,
    fetchDeskData,
    fetchQueue,
    handleConfirmReschedule,
    handleApprovePendingAppointment,
    handleRejectPendingAppointment,
    linkedDoctors,
    activeSelectedDoctor,
    effectiveClinicId,
    availableQueueShifts,
    fetchWalkinPreview,
    currentSlotStatus,
    isSelectedShiftEnded,
    isSelectedShiftFull,
    handleChangePassword,
    handleWalkinSubmit,
    handleStatusChange,
    togglingCheckinId,
    setTogglingCheckinId,
    handleToggleCheckIn,
    navItems,
    clinicCity,
    clinicAddr,
    displayLocation,
    titleText,
    subtitleText,
  };
};

export type ReceptionistDashboardState = ReturnType<typeof useReceptionistDashboardState>;
export const ReceptionistDashboardContext = createContext<ReceptionistDashboardState | null>(null);
export const useReceptionistDashboard = (): ReceptionistDashboardState => {
  const value = useContext(ReceptionistDashboardContext);
  if (!value) throw new Error('useReceptionistDashboard must be used inside ReceptionistDashboard');
  return value;
};
