import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  api,
  ReceptionistDashboardData,
  ReceptionistQueueItem,
  getLocalDateString,
  Appointment,
  getFileUrl,
  QueuePreview,
} from '../../services/api';
import { sanitizeIndianPhone, formatIndianPhone, isValidIndianPhone } from '../../utils/phoneUtils';
import { useVisibilityPolling } from '../../utils/useVisibilityPolling';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { CabinStatusControl } from '../../components/ui/DoctorCabinPresence';
import {
  Clock,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  X,
  Printer,
  Stethoscope,
  ShieldCheck,
  Phone,
  Check,
  Search,
  Bell,
  QrCode,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ClinicQrStandeeModal } from '../../components/common/ClinicQrStandeeModal';

export interface TokenPassData {
  queueNumber: number;
  estimatedTime?: string;
  checkingWindow?: string;
  appointmentDate: string;
  patientName: string;
  patientPhone?: string;
  doctorName: string;
  doctorSpecialty?: string;
  clinicName?: string;
  clinicAddress?: string;
}

const cleanDoctorName = (name?: string | null): string => {
  if (!name) return 'Doctor';
  const trimmed = name.trim();
  return /^dr\.?\s+/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
};

export const ReceptionistDashboard: React.FC = () => {
  const { user, refreshUser, updateUser } = useAuth();

  // Mandatory password change state for provisioned receptionists
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [data, setData] = useState<ReceptionistDashboardData | null>(null);
  const [, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'queue' | 'walkin' | 'pending' | 'doctors' | 'notifications'>('queue');

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [expandedNotifId, setExpandedNotifId] = useState<string | null>(null);
  const [notifFilter, setNotifFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  // Clinic QR Standee Modal state
  const [isStandeeModalOpen, setIsStandeeModalOpen] = useState(false);

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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED'>('ALL');

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.getNotifications();
      const list = res?.notifications || [];
      setNotifications(list);
      setUnreadNotifCount(res?.unreadCount ?? list.filter((n: any) => !n.isRead).length);
    } catch (err) {
      console.error('Failed to load receptionist notifications:', err);
    }
  }, []);

  const handleMarkAllNotifsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotifCount(0);
    } catch (err: any) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const handleMarkOneNotifRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadNotifCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const fetchPendingAppointments = useCallback(async () => {
    try {
      setPendingLoading(true);
      const res = await api.getPendingAppointments();
      setPendingAppointments(res);
    } catch (err: any) {
      console.error('Failed to load pending appointments:', err);
    } finally {
      setPendingLoading(false);
    }
  }, []);

  const fetchDeskData = useCallback(async () => {
    try {
      setError(null);
      const res = await api.getMyReceptionist();
      setData(res);
      if (res.clinic?.id) {
        setWalkinClinicId(res.clinic.id);
      }
      if (res.doctors.length > 0) {
        setSelectedDoctorId((prev) => prev || res.doctors[0].doctorId);
        setQueueDoctorId((prev) => prev || res.doctors[0].doctorId);
        if (res.doctors[0].slots && res.doctors[0].slots.length > 0) {
          setSlotId((prev) => prev || res.doctors[0].slots[0].id);
        }
      }
      try {
        const pendingRes = await api.getPendingAppointments();
        setPendingAppointments(pendingRes);
      } catch {
        // non-blocking
      }
      try {
        const notifRes = await api.getNotifications();
        const list = notifRes?.notifications || [];
        setNotifications(list);
        setUnreadNotifCount(notifRes?.unreadCount ?? list.filter((n: any) => !n.isRead).length);
      } catch {
        // non-blocking
      }
    } catch (err: any) {
      console.error('Failed to load desk data:', err);
      setError(err.message || 'Failed to load desk details');
    } finally {
      setLoading(false);
    }
  }, []);

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
  const fetchQueue = useCallback(async (docId?: string, dateStr?: string) => {
    const targetDoc = docId || queueDoctorId;
    if (!targetDoc) return;
    const targetDate = dateStr || queueDate;

    setQueueLoading(true);
    try {
      const res = await api.getReceptionistDoctorQueue(targetDoc, targetDate);
      setQueueAppointments(res.appointments);
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
    } finally {
      setQueueLoading(false);
    }
  }, [queueDoctorId, queueDate]);

  // Periodic real-time sync while tab is visible
  useVisibilityPolling(
    () => {
      fetchNotifications();
      fetchPendingAppointments();
      if (activeTab === 'queue' && queueDoctorId) {
        fetchQueue();
      }
    },
    15000,
    Boolean(user) && user?.role?.toUpperCase() === 'RECEPTIONIST'
  );

  useEffect(() => {
    let mounted = true;
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
  }, [activeTab, queueDoctorId, queueDate, fetchQueue, fetchPendingAppointments, fetchNotifications]);

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
      const newQueueNum = res?.data?.queueNumber || res?.data?.appointment?.queueNumber;
      setSuccessMsg(
        `Appointment for ${rescheduleTarget.patientName} shifted to ${rescheduleDate}${newQueueNum ? ` (Token #${newQueueNum})` : ''}.`
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
    if (!window.confirm('Are you sure you want to decline this booking request?')) {
      return;
    }
    try {
      setRejectingId(apptId);
      setError(null);
      const res = await api.rejectAppointment(apptId, 'Booking request declined by reception desk.');
      setSuccessMsg(res.message || 'Booking request declined.');
      await fetchPendingAppointments();
      fetchDeskData();
    } catch (err: any) {
      setError(err.message || 'Failed to decline appointment');
    } finally {
      setRejectingId(null);
    }
  };

  const linkedDoctors = data?.doctors || [];
  const activeSelectedDoctor = linkedDoctors.find((d) => d.doctorId === selectedDoctorId);
  const effectiveClinicId = data?.clinic?.id || walkinClinicId || activeSelectedDoctor?.clinics?.[0]?.clinicId;

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
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const [endH, endM] = slotObj.endTime.split(':').map((v) => parseInt(v, 10));
        if (Number.isFinite(endH) && Number.isFinite(endM)) {
          if (currentHours > endH || (currentHours === endH && currentMinutes >= endM)) {
            return true;
          }
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
    if (status === 'IN_CONSULTATION') {
      const targetDoctor = linkedDoctors.find((d) => d.doctorId === queueDoctorId);
      if (targetDoctor?.cabinStatus && targetDoctor.cabinStatus !== 'IN_CABIN') {
        const awayMsg = targetDoctor.cabinStatus === 'STEPPED_OUT'
          ? `${cleanDoctorName(targetDoctor.fullName)} has stepped out${targetDoctor.expectedReturnTime ? ` (expected return ~${targetDoctor.expectedReturnTime})` : ''}. Doctor must be In Cabin before calling patients.`
          : `${cleanDoctorName(targetDoctor.fullName)} is currently Not in Cabin. Doctor must be In Cabin before calling patients.`;
        alert(awayMsg);
        return;
      }

      const targetAppt = queueAppointments.find((a) => a.id === appointmentId);
      if (targetAppt) {
        const targetDate = targetAppt.appointmentDate || queueDate;
        if (targetDate !== getLocalDateString()) {
          alert(`Cannot call in an appointment scheduled for ${targetDate}. Only today's appointments can be called in.`);
          return;
        }
        if (!targetAppt.isCheckedIn) {
          alert('Patient has not checked in at the clinic yet. Please mark arrival first.');
          return;
        }
      }
    }

    try {
      await api.updateAppointmentStatus(appointmentId, status);
      fetchQueue();
      fetchDeskData();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const [togglingCheckinId, setTogglingCheckinId] = useState<string | null>(null);
  const handleToggleCheckIn = async (appointmentId: string, currentStatus?: boolean) => {
    setTogglingCheckinId(appointmentId);
    try {
      const nextStatus = !currentStatus;
      const res = await api.checkInAppointmentDirect(appointmentId, nextStatus);
      if (res && (res.id || res.success)) {
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
      alert(err.message || 'Failed to update clinic arrival status');
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
  const subtitleText = displayLocation ? `${displayLocation}` : 'Front Desk Operations';

  const totalTodayBookings = linkedDoctors.reduce((sum, d) => sum + d.todayTotalBookings, 0);
  const totalWaitingPatients = linkedDoctors.reduce((sum, d) => sum + d.todayWaitingPatients, 0);

  return (
    <DashboardLayout
      portalType="RECEPTIONIST"
      portalSubtitle="Reception Desk"
      navItems={navItems}
      title={titleText}
      subtitle={subtitleText}
      headerAction={
        <div className="flex items-center gap-2">
          {activeTab !== 'walkin' && (
            <button
              type="button"
              onClick={() => setActiveTab('walkin')}
              className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-[0_2px_8px_rgba(0,102,204,0.2)] transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Walk-in Token</span>
            </button>
          )}
          {data?.clinic?.id && (
            <button
              type="button"
              onClick={() => setIsStandeeModalOpen(true)}
              className="h-9 px-3.5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium inline-flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-[#0066cc]" />
              <span>QR Standee</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              fetchDeskData();
              fetchNotifications();
              if (activeTab === 'queue' && queueDoctorId) fetchQueue();
              if (activeTab === 'pending') fetchPendingAppointments();
            }}
            className="h-9 px-3.5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium inline-flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#86868b]" />
            <span>Refresh</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6 print:hidden">
        {/* Feedback Banners */}
        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
              <span className="font-medium">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-[#86868b] hover:text-[#1d1d1f] p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-700 hover:text-rose-900 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. Compact 4-Column Metric Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div
            onClick={() => setActiveTab('queue')}
            className={`bg-white rounded-[20px] border p-4 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] cursor-pointer transition-all active:scale-[0.99] ${
              activeTab === 'queue' ? 'border-[#0066cc] ring-2 ring-[#0066cc]/10' : 'border-[#e5e5ea] hover:border-[#d2d2d7]'
            }`}
          >
            <span className="text-xs font-medium text-[#86868b] block">Waiting in Queue</span>
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#0066cc] mt-1">
              {totalWaitingPatients}
            </div>
          </div>

          <div
            onClick={() => setActiveTab('queue')}
            className="bg-white rounded-[20px] border border-[#e5e5ea] hover:border-[#d2d2d7] p-4 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] cursor-pointer transition-all active:scale-[0.99]"
          >
            <span className="text-xs font-medium text-[#86868b] block">Today's Bookings</span>
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1d1d1f] mt-1">
              {totalTodayBookings}
            </div>
          </div>

          <div
            onClick={() => setActiveTab('pending')}
            className={`bg-white rounded-[20px] border p-4 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] cursor-pointer transition-all active:scale-[0.99] ${
              activeTab === 'pending' ? 'border-[#0066cc] ring-2 ring-[#0066cc]/10' : 'border-[#e5e5ea] hover:border-[#d2d2d7]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#86868b]">Pending Approvals</span>
              {pendingAppointments.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#0066cc]" />
              )}
            </div>
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1d1d1f] mt-1">
              {pendingAppointments.length}
            </div>
          </div>

          <div
            onClick={() => setActiveTab('doctors')}
            className={`bg-white rounded-[20px] border p-4 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] cursor-pointer transition-all active:scale-[0.99] ${
              activeTab === 'doctors' ? 'border-[#0066cc] ring-2 ring-[#0066cc]/10' : 'border-[#e5e5ea] hover:border-[#d2d2d7]'
            }`}
          >
            <span className="text-xs font-medium text-[#86868b] block">Assigned Doctors</span>
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1d1d1f] mt-1">
              {linkedDoctors.length}
            </div>
          </div>
        </div>

        {/* 2. Primary Workspace Container */}
        <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-5 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          {/* TAB 1: LIVE QUEUE (Primary Front Desk View) */}
          {activeTab === 'queue' && (
            <div className="space-y-5">
              {/* Top Controls Row: Title + Doctor & Date Selectors */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#f0f0f2]">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base sm:text-lg font-semibold text-[#1d1d1f] tracking-tight">
                    Live Patient Queue
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
                    {queueAppointments.length}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  {linkedDoctors.length > 0 && (
                    <div className="relative">
                      <select
                        value={queueDoctorId}
                        onChange={(e) => setQueueDoctorId(e.target.value)}
                        className="h-10 pl-3.5 pr-8 rounded-xl border border-[#d2d2d7] text-xs font-medium bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all focus:outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] appearance-none cursor-pointer w-full sm:w-auto"
                      >
                        {linkedDoctors.map((doc) => (
                          <option key={doc.doctorId} value={doc.doctorId}>
                            {cleanDoctorName(doc.fullName)} — {doc.specialty}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-[#86868b] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={queueDate}
                      onChange={(e) => setQueueDate(e.target.value)}
                      className="h-10 px-3.5 rounded-xl border border-[#d2d2d7] text-xs font-medium bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all focus:outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] flex-1 sm:flex-initial"
                    />
                    {queueDate !== getLocalDateString() && (
                      <button
                        type="button"
                        onClick={() => setQueueDate(getLocalDateString())}
                        className="h-10 px-3.5 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] text-xs font-medium text-[#0066cc] border border-[#e5e5ea] transition-all cursor-pointer shrink-0"
                      >
                        Today
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Selected Doctor Cabin Presence Bar */}
              {(() => {
                const targetDoctor = linkedDoctors.find((d) => d.doctorId === queueDoctorId);
                if (!targetDoctor) return null;
                return (
                  <div className="pb-4 border-b border-[#f0f0f2]">
                    <CabinStatusControl
                      currentStatus={targetDoctor.cabinStatus}
                      expectedReturnTime={targetDoctor.expectedReturnTime}
                      doctorId={targetDoctor.doctorId}
                      doctorName={cleanDoctorName(targetDoctor.fullName)}
                      onStatusChange={(newStatus, newReturnTime) => {
                        setData((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            doctors: prev.doctors.map((d) =>
                              d.doctorId === targetDoctor.doctorId
                                ? { ...d, cabinStatus: newStatus, expectedReturnTime: newReturnTime }
                                : d
                            ),
                          };
                        });
                      }}
                    />
                  </div>
                );
              })()}

              {/* Filter Segmented Bar & Search Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-full inline-flex items-center gap-0.5 overflow-x-auto max-w-full">
                  {(
                    [
                      { id: 'ALL', label: 'All' },
                      { id: 'WAITING', label: 'Waiting' },
                      { id: 'IN_CONSULTATION', label: 'In Consultation' },
                      { id: 'COMPLETED', label: 'Completed' },
                      { id: 'CANCELLED', label: 'Cancelled' },
                    ] as const
                  ).map((tab) => {
                    const count =
                      tab.id === 'ALL'
                        ? queueAppointments.length
                        : queueAppointments.filter((a) => a.status === tab.id).length;
                    const isActive = statusFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStatusFilter(tab.id)}
                        className={`h-8 px-3.5 rounded-full text-xs transition-all whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs border border-black/5'
                            : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span className={`text-[11px] ${isActive ? 'text-[#0066cc] font-semibold' : 'text-[#86868b]'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="relative w-full lg:w-64">
                  <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    placeholder="Search patient, phone, token..."
                    className="w-full h-10 pl-9 pr-8 rounded-full border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
                  />
                  {queueSearch && (
                    <button
                      type="button"
                      onClick={() => setQueueSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f] p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Queue Content */}
              {linkedDoctors.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="text-sm font-semibold text-[#1d1d1f]">No Doctors Assigned</p>
                  <p className="text-xs text-[#86868b] mt-1 max-w-sm mx-auto">
                    Ask your clinic administrator to assign practitioners to your reception desk.
                  </p>
                </div>
              ) : queueLoading ? (
                <div className="py-14 text-center text-xs text-[#86868b]">Loading live queue...</div>
              ) : queueAppointments.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="text-sm font-semibold text-[#1d1d1f]">No Patients in Queue</p>
                  <p className="text-xs text-[#86868b] mt-1 mb-4">
                    No appointments scheduled for {queueDate}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('walkin')}
                    className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-medium transition-all active:scale-[0.98] cursor-pointer"
                  >
                    Issue Walk-in Token
                  </button>
                </div>
              ) : (() => {
                const filteredAppointments = queueAppointments.filter((appt) => {
                  if (statusFilter !== 'ALL' && appt.status !== statusFilter) return false;
                  if (!queueSearch.trim()) return true;
                  const q = queueSearch.toLowerCase().trim();
                  const name = (appt.patientName || '').toLowerCase();
                  const phone = (appt.patientPhone || '').toLowerCase();
                  const token = String(appt.queueNumber || '');
                  return name.includes(q) || phone.includes(q) || token.includes(q);
                });

                const queueDoctor = linkedDoctors.find((d) => d.doctorId === queueDoctorId);
                const isDoctorAway = Boolean(queueDoctor?.cabinStatus && queueDoctor.cabinStatus !== 'IN_CABIN');
                const isTodayQueue = queueDate === getLocalDateString();

                if (filteredAppointments.length === 0) {
                  return (
                    <div className="py-12 text-center">
                      <p className="text-sm font-semibold text-[#1d1d1f]">No Matching Patients</p>
                      <p className="text-xs text-[#86868b] mt-1 mb-3">
                        No patients match your active filter or search criteria.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setQueueSearch('');
                          setStatusFilter('ALL');
                        }}
                        className="h-8 px-4 rounded-full text-xs font-medium bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#e8e8ed] transition-all cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-[#f0f0f2] border border-[#e5e5ea] rounded-2xl overflow-hidden bg-white">
                    {filteredAppointments.map((appt) => {
                      const canMarkArrival = !['EXPIRED', 'CANCELLED', 'REJECTED', 'COMPLETED'].includes(appt.status);
                      const canCallIn =
                        appt.status === 'WAITING' &&
                        appt.isCheckedIn &&
                        !isDoctorAway &&
                        (appt.appointmentDate || queueDate) === getLocalDateString();

                      return (
                        <div
                          key={appt.id}
                          className="p-4 sm:px-5 sm:py-4 hover:bg-[#fafafc] transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-3.5"
                        >
                          {/* Left: Token + Patient Details */}
                          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center font-semibold text-sm text-[#0066cc] shrink-0">
                              #{appt.queueNumber}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-[#1d1d1f] truncate">
                                  {appt.patientName}
                                </span>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                                    appt.status === 'IN_CONSULTATION'
                                      ? 'bg-[#0066cc]/10 text-[#0066cc] border-[#0066cc]/20'
                                      : appt.status === 'WAITING'
                                      ? 'bg-[#f5f5f7] text-[#1d1d1f] border-[#e5e5ea]'
                                      : 'bg-[#f5f5f7] text-[#86868b] border-[#e5e5ea]'
                                  }`}
                                >
                                  {appt.status === 'IN_CONSULTATION'
                                    ? 'In Cabin'
                                    : appt.status === 'WAITING'
                                    ? 'Waiting'
                                    : appt.status === 'COMPLETED'
                                    ? 'Completed'
                                    : appt.status === 'CANCELLED'
                                    ? 'Cancelled'
                                    : 'Expired'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2.5 text-xs text-[#86868b] mt-1 flex-wrap">
                                {appt.patientPhone && <span>{appt.patientPhone}</span>}
                                {appt.estimatedTime && (
                                  <>
                                    <span>•</span>
                                    <span className="text-[#1d1d1f] font-medium">{appt.estimatedTime}</span>
                                  </>
                                )}
                                {appt.reasonForVisit &&
                                  appt.reasonForVisit !== 'General Medical Consultation' &&
                                  appt.reasonForVisit !== 'Walk-in Consultation' &&
                                  appt.reasonForVisit !== 'Rapid Walk-in Consultation' && (
                                    <>
                                      <span>•</span>
                                      <span className="truncate max-w-[220px]">{appt.reasonForVisit}</span>
                                    </>
                                  )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Arrival Toggle + Queue Actions */}
                          <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap pt-2 lg:pt-0 border-t lg:border-t-0 border-[#f0f0f2]">
                            {/* Arrival Check-In Pill */}
                            {canMarkArrival && (
                              <button
                                type="button"
                                disabled={togglingCheckinId === appt.id}
                                onClick={() => handleToggleCheckIn(appt.id, appt.isCheckedIn)}
                                className={`h-8 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                                  appt.isCheckedIn
                                    ? 'bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/25'
                                    : 'bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea]'
                                }`}
                                title={appt.isCheckedIn ? 'Click to undo arrival' : 'Mark patient arrived at clinic'}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    appt.isCheckedIn ? 'bg-[#0066cc]' : 'bg-[#86868b]'
                                  }`}
                                />
                                <span>{appt.isCheckedIn ? 'At Clinic' : 'Mark Arrived'}</span>
                              </button>
                            )}

                            <div className="flex items-center gap-1.5">
                              {/* Primary Action: Call In or Complete */}
                              {canCallIn && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(appt.id, 'IN_CONSULTATION')}
                                  className="h-8 px-3.5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-medium transition-all active:scale-[0.98] cursor-pointer"
                                >
                                  Call In
                                </button>
                              )}

                              {appt.status === 'WAITING' && appt.isCheckedIn && isDoctorAway && isTodayQueue && (
                                <span className="h-8 px-3 rounded-full bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea] text-xs font-medium inline-flex items-center">
                                  Doctor Away
                                </span>
                              )}

                              {appt.status === 'IN_CONSULTATION' && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(appt.id, 'COMPLETED')}
                                  className="h-8 px-3.5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-medium transition-all active:scale-[0.98] cursor-pointer"
                                >
                                  Complete
                                </button>
                              )}

                              {/* Shift Date */}
                              {(appt.status === 'WAITING' || appt.status === 'PENDING_APPROVAL') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRescheduleTarget({
                                      appointmentId: appt.id,
                                      patientName: appt.patientName,
                                      doctorName: queueDoctor?.fullName || 'Practitioner',
                                      currentDate: queueDate,
                                      currentQueueNumber: appt.queueNumber,
                                      doctorId: queueDoctorId,
                                      slotId: appt.slotId,
                                    });
                                    const d = new Date(queueDate);
                                    d.setDate(d.getDate() + 1);
                                    setRescheduleDate(getLocalDateString(d));
                                    setRescheduleSlotId(appt.slotId || '');
                                    setRescheduleError(null);
                                  }}
                                  className="h-8 px-3 rounded-full text-[#1d1d1f] hover:bg-[#f5f5f7] text-xs font-medium border border-[#e5e5ea] transition-all cursor-pointer"
                                  title="Reschedule to another date"
                                >
                                  Shift
                                </button>
                              )}

                              {/* Cancel */}
                              {appt.status === 'WAITING' && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(appt.id, 'CANCELLED')}
                                  className="h-8 px-3 rounded-full text-[#86868b] hover:text-rose-600 hover:bg-rose-50 text-xs font-medium border border-[#e5e5ea] transition-all cursor-pointer"
                                >
                                  Cancel
                                </button>
                              )}

                              {/* Reprint Pass */}
                              <button
                                type="button"
                                onClick={() => {
                                  setBookedPass({
                                    queueNumber: appt.queueNumber,
                                    estimatedTime: appt.estimatedTime,
                                    checkingWindow: appt.checkingWindow,
                                    appointmentDate: queueDate,
                                    patientName: appt.patientName,
                                    patientPhone: appt.patientPhone,
                                    doctorName: queueDoctor?.fullName || 'Practitioner',
                                    doctorSpecialty: queueDoctor?.specialty,
                                    clinicName: data?.clinic?.clinicName,
                                    clinicAddress: data?.clinic?.address,
                                  });
                                }}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] border border-[#e5e5ea] transition-colors cursor-pointer"
                                title="Print Token Slip"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 2: WALK-IN BOOKING (Balanced 2-Column Layout) */}
          {activeTab === 'walkin' && (
            <div>
              <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[#f0f0f2]">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-[#1d1d1f] tracking-tight">
                    Walk-in Patient Booking
                  </h3>
                  <p className="text-xs text-[#86868b] mt-0.5">
                    Issue an immediate queue token for patients arriving at the desk.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('queue')}
                  className="h-8 px-3.5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-xs font-medium text-[#1d1d1f] border border-[#e5e5ea] transition-all cursor-pointer shrink-0"
                >
                  View Queue
                </button>
              </div>

              {linkedDoctors.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="text-sm font-semibold text-[#1d1d1f]">No Doctors Assigned</p>
                  <p className="text-xs text-[#86868b] mt-1 max-w-xs mx-auto">
                    Ask your clinic administrator to assign doctors to your reception desk before issuing walk-in tokens.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column (7 cols): Walk-in Registration Form */}
                  <form onSubmit={handleWalkinSubmit} className="lg:col-span-7 space-y-5">
                    {/* 1. Practitioner Selection */}
                    <div>
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-2 tracking-tight">
                        Select Practitioner
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {linkedDoctors.map((doc) => {
                          const isSelected = selectedDoctorId === doc.doctorId;
                          return (
                            <div
                              key={doc.doctorId}
                              onClick={() => {
                                setSelectedDoctorId(doc.doctorId);
                                setSlotId(doc.slots[0]?.id || '');
                              }}
                              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                                isSelected
                                  ? 'bg-[#0066cc]/[0.04] border-[#0066cc] ring-2 ring-[#0066cc]/10'
                                  : 'bg-white border-[#e5e5ea] hover:border-[#d2d2d7]'
                              }`}
                            >
                              <div className="w-10 h-10 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden shrink-0">
                                {doc.avatarUrl ? (
                                  <img
                                    src={getFileUrl(doc.avatarUrl)}
                                    alt={doc.fullName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center font-semibold text-xs text-[#0066cc]">
                                    {doc.fullName[0]}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-xs text-[#1d1d1f] truncate">
                                  {cleanDoctorName(doc.fullName)}
                                </div>
                                <div className="text-[11px] text-[#0066cc] font-medium truncate">
                                  {doc.specialty}
                                </div>
                                <div className="text-[11px] text-[#86868b] mt-0.5">
                                  ₹{doc.consultationFee.toFixed(0)} • {doc.todayWaitingPatients} waiting
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Date & Checking Shift */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                          Consultation Date
                        </label>
                        <input
                          type="date"
                          required
                          value={appointmentDate}
                          onChange={(e) => setAppointmentDate(e.target.value)}
                          className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                          Checking Shift
                        </label>
                        <div className="relative">
                          <select
                            value={slotId}
                            onChange={(e) => setSlotId(e.target.value)}
                            className="w-full h-11 pl-3.5 pr-8 rounded-xl border border-[#d2d2d7] bg-white text-[13px] text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all appearance-none cursor-pointer"
                          >
                            {activeSelectedDoctor?.slots.map((s) => {
                              const sStatus = walkinPreview?.availableSlots?.find((as) => as.slot.id === s.id);
                              const isEnded = sStatus?.isPassed;
                              return (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({s.startTime} – {s.endTime}) {isEnded ? '• Ended' : ''}
                                </option>
                              );
                            })}
                          </select>
                          <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Multi-clinic selector only if doctor practices at multiple clinics */}
                    {activeSelectedDoctor?.clinics && activeSelectedDoctor.clinics.length > 1 && (
                      <div>
                        <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                          Clinic Facility
                        </label>
                        <div className="relative">
                          <select
                            value={walkinClinicId}
                            onChange={(e) => setWalkinClinicId(e.target.value)}
                            className="w-full h-11 pl-3.5 pr-9 rounded-xl border border-[#d2d2d7] bg-white text-[13px] text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all appearance-none cursor-pointer"
                          >
                            {activeSelectedDoctor.clinics.map((c) => (
                              <option key={c.clinicId} value={c.clinicId}>
                                {c.clinic.clinicName} — {c.clinic.address}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    )}

                    {/* Shift Status Warnings */}
                    {isSelectedShiftEnded && (
                      <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs text-[#1d1d1f]">
                        <span className="font-semibold">Shift Ended for Today:</span> Please choose an upcoming shift or select tomorrow's date.
                      </div>
                    )}

                    {!isSelectedShiftEnded && isSelectedShiftFull && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                        <span className="font-semibold">Shift Capacity Reached:</span> This shift is full. Please select another shift or date.
                      </div>
                    )}

                    {/* 3. Patient Information */}
                    <div className="pt-2 border-t border-[#f0f0f2] space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-xs font-medium text-[#1d1d1f] tracking-tight">
                          Patient Details
                        </label>
                        <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-full flex gap-0.5 w-full sm:w-64 select-none">
                          <button
                            type="button"
                            onClick={() => setBookingFor('self')}
                            className={`flex-1 h-8 text-xs rounded-full transition-all cursor-pointer ${
                              bookingFor === 'self'
                                ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs border border-black/5'
                                : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
                            }`}
                          >
                            Self
                          </button>
                          <button
                            type="button"
                            onClick={() => setBookingFor('other')}
                            className={`flex-1 h-8 text-xs rounded-full transition-all cursor-pointer ${
                              bookingFor === 'other'
                                ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs border border-black/5'
                                : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
                            }`}
                          >
                            Family / Other
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                            Patient Full Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={patientName}
                            onChange={(e) => setPatientName(e.target.value)}
                            placeholder="e.g. Rahul Ray"
                            className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                            Mobile Number *
                          </label>
                          <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all overflow-hidden">
                            <div className="h-full px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] flex items-center justify-center select-none text-[13px] font-semibold text-[#1d1d1f]">
                              +91
                            </div>
                            <input
                              type="tel"
                              inputMode="numeric"
                              required
                              value={sanitizeIndianPhone(patientPhone)}
                              onChange={(e) => setPatientPhone(sanitizeIndianPhone(e.target.value))}
                              placeholder="98765 43210"
                              maxLength={10}
                              className="flex-1 h-full px-3.5 text-[14px] bg-transparent focus:outline-none text-[#1d1d1f] placeholder:text-[#a1a1a6]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                        <div>
                          <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                            Age {bookingFor === 'other' ? '*' : ''}
                          </label>
                          <input
                            type="text"
                            value={patientAge}
                            onChange={(e) => setPatientAge(e.target.value)}
                            placeholder="e.g. 28"
                            className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                            Gender
                          </label>
                          <div className="relative">
                            <select
                              value={gender}
                              onChange={(e) => setGender(e.target.value)}
                              className="w-full h-11 pl-3 pr-8 rounded-xl border border-[#d2d2d7] bg-white text-[13px] text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all appearance-none cursor-pointer"
                            >
                              <option value="Not Specified">Select</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                            <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                            Chief Complaint (Optional)
                          </label>
                          <input
                            type="text"
                            value={reasonForVisit}
                            onChange={(e) => setReasonForVisit(e.target.value)}
                            placeholder="e.g. Fever, general checkup"
                            className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={bookingLoading || isSelectedShiftEnded || isSelectedShiftFull}
                        className={`w-full h-11 px-6 rounded-full text-sm font-medium transition-all flex items-center justify-center ${
                          isSelectedShiftEnded || isSelectedShiftFull
                            ? 'bg-[#e5e5ea] text-[#86868b] cursor-not-allowed'
                            : 'bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white shadow-[0_2px_8px_rgba(0,102,204,0.2)] cursor-pointer'
                        }`}
                      >
                        {bookingLoading
                          ? 'Issuing Token...'
                          : isSelectedShiftEnded
                          ? 'Shift Ended — Select Another Slot'
                          : isSelectedShiftFull
                          ? 'Shift Full — Maximum Capacity Reached'
                          : `Issue Walk-in Token (#${walkinPreview?.nextQueueNumber || 1})`}
                      </button>
                    </div>
                  </form>

                  {/* Right Column (5 cols): Live Token Allocation Summary Card */}
                  <div className="lg:col-span-5 bg-[#f5f5f7] rounded-[20px] border border-[#e5e5ea] p-5 sm:p-6 space-y-5">
                    <div className="flex items-center justify-between border-b border-[#e5e5ea] pb-4">
                      <div>
                        <span className="text-xs font-medium text-[#86868b] block">
                          Next Queue Token
                        </span>
                        <span className="text-xs text-[#1d1d1f] font-medium mt-0.5 block">
                          {appointmentDate}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                          isSelectedShiftEnded || isSelectedShiftFull
                            ? 'bg-white text-[#86868b] border-[#e5e5ea]'
                            : 'bg-[#0066cc]/10 text-[#0066cc] border-[#0066cc]/20'
                        }`}
                      >
                        {isSelectedShiftEnded
                          ? 'Shift Ended'
                          : isSelectedShiftFull
                          ? 'Shift Full'
                          : 'Available'}
                      </span>
                    </div>

                    <div className="py-3 text-center bg-white rounded-2xl border border-[#e5e5ea]">
                      <span className="text-[11px] font-medium text-[#86868b] uppercase tracking-wider block">
                        Token Number
                      </span>
                      <div className="text-4xl font-bold text-[#0066cc] tracking-tight my-1">
                        #{walkinPreview?.nextQueueNumber || 1}
                      </div>
                      <span className="text-xs text-[#86868b]">
                        {previewLoading ? 'Calculating...' : `Est. Time: ${walkinPreview?.estimatedTime || 'Immediate'}`}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between py-1.5 border-b border-[#e5e5ea]">
                        <span className="text-[#86868b]">Practitioner</span>
                        <span className="font-semibold text-[#1d1d1f]">
                          {cleanDoctorName(activeSelectedDoctor?.fullName)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-b border-[#e5e5ea]">
                        <span className="text-[#86868b]">Patients Ahead</span>
                        <span className="font-semibold text-[#1d1d1f]">
                          {previewLoading ? '...' : `${walkinPreview?.patientsAhead ?? 0} waiting`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-[#86868b]">Consultation Fee</span>
                        <span className="text-sm font-semibold text-[#1d1d1f]">
                          ₹{activeSelectedDoctor?.consultationFee?.toFixed(0) || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PENDING APPROVALS (Clean Horizontal Cards) */}
          {activeTab === 'pending' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#f0f0f2]">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base sm:text-lg font-semibold text-[#1d1d1f] tracking-tight">
                    Pending Approvals
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
                    {pendingAppointments.length}
                  </span>
                </div>

                {pendingAppointments.length > 0 && (
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={pendingSearch}
                      onChange={(e) => setPendingSearch(e.target.value)}
                      placeholder="Search patient, phone, doctor..."
                      className="w-full h-9 pl-9 pr-8 rounded-full border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
                    />
                    {pendingSearch && (
                      <button
                        type="button"
                        onClick={() => setPendingSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f] p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {pendingLoading ? (
                <div className="py-14 text-center text-xs text-[#86868b]">
                  Loading pending online bookings...
                </div>
              ) : pendingAppointments.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="font-semibold text-sm text-[#1d1d1f]">All Bookings Processed</p>
                  <p className="mt-1 text-xs text-[#86868b]">
                    No online bookings are awaiting reception confirmation.
                  </p>
                </div>
              ) : (() => {
                const filteredPending = pendingAppointments.filter((appt) => {
                  if (!pendingSearch.trim()) return true;
                  const q = pendingSearch.toLowerCase().trim();
                  const patient = (appt.patientName || appt.patient?.user?.fullName || '').toLowerCase();
                  const phone = (appt.patientPhone || appt.patient?.user?.phone || '').toLowerCase();
                  const doctor = (appt.doctor?.user?.fullName || '').toLowerCase();
                  const specialty = (appt.doctor?.specialty || '').toLowerCase();
                  return patient.includes(q) || phone.includes(q) || doctor.includes(q) || specialty.includes(q);
                });

                if (filteredPending.length === 0) {
                  return (
                    <div className="py-12 text-center">
                      <p className="font-semibold text-sm text-[#1d1d1f]">No Matching Requests</p>
                      <p className="mt-1 text-xs text-[#86868b] mb-3">
                        No pending bookings match "{pendingSearch}".
                      </p>
                      <button
                        type="button"
                        onClick={() => setPendingSearch('')}
                        className="h-8 px-4 rounded-full text-xs font-medium bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#e8e8ed] transition-all cursor-pointer"
                      >
                        Clear Search
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-[#f0f0f2] border border-[#e5e5ea] rounded-2xl overflow-hidden bg-white">
                    {filteredPending.map((appt) => {
                      const fee = appt.fee || appt.doctor?.consultationFee || 0;
                      const isApproving = approvingId === appt.id;
                      const isRejecting = rejectingId === appt.id;
                      const patientDisplay = appt.patientName || appt.patient?.user?.fullName || 'Patient';
                      const phoneDisplay = appt.patientPhone || appt.patient?.user?.phone || '';

                      return (
                        <div
                          key={appt.id}
                          className="p-4 sm:px-5 sm:py-4 hover:bg-[#fafafc] transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                        >
                          {/* Patient & Visit Summary */}
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-[#1d1d1f]">
                                {patientDisplay}
                              </span>
                              {appt.isForOther && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
                                  Family{appt.patientAge ? ` • ${appt.patientAge}y` : ''}
                                </span>
                              )}
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0066cc]/10 text-[#0066cc]">
                                ₹{fee}
                              </span>
                            </div>

                            <div className="flex items-center gap-2.5 text-xs text-[#86868b] flex-wrap">
                              <span className="font-medium text-[#1d1d1f]">
                                {cleanDoctorName(appt.doctor?.user?.fullName)} ({appt.doctor?.specialty})
                              </span>
                              <span>•</span>
                              <span>
                                {appt.appointmentDate} • {appt.checkingWindow || 'General Shift'}
                              </span>
                              {phoneDisplay && (
                                <>
                                  <span>•</span>
                                  <a
                                    href={`tel:${phoneDisplay}`}
                                    className="inline-flex items-center gap-1 text-[#0066cc] hover:underline font-medium"
                                  >
                                    <Phone className="w-3 h-3" />
                                    <span>{phoneDisplay}</span>
                                  </a>
                                </>
                              )}
                            </div>

                            {appt.reasonForVisit && appt.reasonForVisit !== 'General Medical Consultation' && (
                              <p className="text-xs text-[#86868b] pt-0.5 truncate max-w-xl">
                                Reason: {appt.reasonForVisit}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap pt-2 lg:pt-0 border-t lg:border-t-0 border-[#f0f0f2]">
                            <button
                              type="button"
                              disabled={isRejecting || isApproving}
                              onClick={() => {
                                setRescheduleTarget({
                                  appointmentId: appt.id,
                                  patientName: patientDisplay,
                                  doctorName: cleanDoctorName(appt.doctor?.user?.fullName),
                                  currentDate: appt.appointmentDate,
                                  currentQueueNumber: appt.queueNumber,
                                  doctorId: appt.doctorId,
                                  slotId: appt.slotId,
                                });
                                const d = new Date(appt.appointmentDate);
                                d.setDate(d.getDate() + 1);
                                setRescheduleDate(getLocalDateString(d));
                                setRescheduleSlotId(appt.slotId || '');
                                setRescheduleError(null);
                              }}
                              className="h-8 px-3 rounded-full text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] border border-[#e5e5ea] transition-all cursor-pointer disabled:opacity-50"
                            >
                              Shift Date
                            </button>

                            <button
                              type="button"
                              disabled={isRejecting || isApproving}
                              onClick={() => handleRejectPendingAppointment(appt.id)}
                              className="h-8 px-3.5 rounded-full text-xs font-medium text-[#86868b] hover:text-rose-600 hover:bg-rose-50 border border-[#e5e5ea] transition-all cursor-pointer disabled:opacity-50"
                            >
                              {isRejecting ? 'Declining...' : 'Decline'}
                            </button>

                            <button
                              type="button"
                              disabled={isApproving || isRejecting}
                              onClick={() => handleApprovePendingAppointment(appt.id)}
                              className="h-8 px-4 rounded-full text-xs font-medium text-white bg-[#0066cc] hover:bg-[#0071e3] transition-all active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{isApproving ? 'Confirming...' : 'Confirm & Issue Token'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 4: ASSIGNED DOCTORS ROSTER */}
          {activeTab === 'doctors' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#f0f0f2]">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-[#1d1d1f] tracking-tight">
                    Assigned Practitioners
                  </h3>
                  <p className="text-xs text-[#86868b] mt-0.5">
                    Manage cabin presence and view live queues for your assigned doctors.
                  </p>
                </div>
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]">
                  {linkedDoctors.length} {linkedDoctors.length === 1 ? 'Doctor' : 'Doctors'}
                </span>
              </div>

              {linkedDoctors.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="font-semibold text-sm text-[#1d1d1f]">No Doctors Assigned Yet</p>
                  <p className="mt-1 text-xs text-[#86868b]">
                    Please ask your Clinic Administrator to assign practitioners to your desk.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {linkedDoctors.map((doc) => (
                    <div
                      key={doc.doctorId}
                      className="p-5 rounded-2xl bg-white border border-[#e5e5ea] space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden shrink-0">
                            {doc.avatarUrl ? (
                              <img src={getFileUrl(doc.avatarUrl)} alt={doc.fullName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-semibold text-sm text-[#0066cc]">
                                {doc.fullName[0]}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-[#1d1d1f] tracking-tight truncate">
                              {cleanDoctorName(doc.fullName)}
                            </div>
                            <div className="text-xs text-[#0066cc] font-medium">{doc.specialty}</div>
                            <div className="text-xs text-[#86868b] mt-0.5">
                              ₹{doc.consultationFee} • {doc.todayTotalBookings} booked today ({doc.todayWaitingPatients} waiting)
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setQueueDoctorId(doc.doctorId);
                            setActiveTab('queue');
                          }}
                          className="h-8 px-3.5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-xs font-medium text-[#1d1d1f] border border-[#e5e5ea] transition-all cursor-pointer shrink-0"
                        >
                          Open Queue
                        </button>
                      </div>

                      <div className="pt-3 border-t border-[#f0f0f2]">
                        <CabinStatusControl
                          currentStatus={doc.cabinStatus}
                          expectedReturnTime={doc.expectedReturnTime}
                          doctorId={doc.doctorId}
                          doctorName={cleanDoctorName(doc.fullName)}
                          onStatusChange={(newStatus, newReturnTime) => {
                            setData((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                doctors: prev.doctors.map((d) =>
                                  d.doctorId === doc.doctorId
                                    ? { ...d, cabinStatus: newStatus, expectedReturnTime: newReturnTime }
                                    : d
                                ),
                              };
                            });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DESK NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#f0f0f2]">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-[#1d1d1f] tracking-tight">
                    Desk Notifications
                  </h3>
                  <p className="text-xs text-[#86868b] mt-0.5">
                    Alerts for incoming online bookings and patient arrival check-ins.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {unreadNotifCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllNotifsRead}
                      className="h-8 px-3.5 rounded-full text-xs font-medium text-[#0066cc] hover:bg-[#0066cc]/5 transition-all cursor-pointer inline-flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark all read</span>
                    </button>
                  )}
                  <div className="bg-[#f5f5f7] p-1 rounded-full border border-[#e5e5ea] flex">
                    <button
                      type="button"
                      onClick={() => setNotifFilter('ALL')}
                      className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                        notifFilter === 'ALL'
                          ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs'
                          : 'text-[#86868b] hover:text-[#1d1d1f]'
                      }`}
                    >
                      All ({notifications.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifFilter('UNREAD')}
                      className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                        notifFilter === 'UNREAD'
                          ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs'
                          : 'text-[#86868b] hover:text-[#1d1d1f]'
                      }`}
                    >
                      Unread ({unreadNotifCount})
                    </button>
                  </div>
                </div>
              </div>

              {(() => {
                const filtered = notifications.filter((n) =>
                  notifFilter === 'UNREAD' ? !n.isRead : true
                );

                if (filtered.length === 0) {
                  return (
                    <div className="py-14 text-center">
                      <h4 className="text-sm font-semibold text-[#1d1d1f]">
                        {notifFilter === 'UNREAD' ? 'No Unread Notifications' : 'No Notifications Yet'}
                      </h4>
                      <p className="text-xs text-[#86868b] mt-1 max-w-sm mx-auto">
                        Booking requests and patient arrival alerts will appear here automatically.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-[#f0f0f2] border border-[#e5e5ea] rounded-2xl overflow-hidden bg-white">
                    {filtered.map((item) => {
                      const isExpanded = expandedNotifId === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (!item.isRead) handleMarkOneNotifRead(item.id);
                            setExpandedNotifId(isExpanded ? null : item.id);
                          }}
                          className={`p-4 sm:px-5 transition-colors cursor-pointer ${
                            !item.isRead ? 'bg-[#0066cc]/[0.02] hover:bg-[#0066cc]/[0.04]' : 'hover:bg-[#fafafc]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {!item.isRead && (
                                  <span className="w-2 h-2 rounded-full bg-[#0066cc] shrink-0" />
                                )}
                                <h4 className="text-xs font-semibold text-[#1d1d1f] tracking-tight">
                                  {item.title}
                                </h4>
                                <span className="text-[11px] text-[#86868b]">
                                  • {new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              </div>
                              <p
                                className={`text-xs text-[#48484a] mt-1 leading-relaxed ${
                                  isExpanded ? '' : 'line-clamp-2'
                                }`}
                              >
                                {item.message}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="p-1 text-[#86868b] hover:text-[#1d1d1f] shrink-0"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* 3. Guaranteed Queue Token Pass Modal */}
      {bookedPass && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn print:hidden">
          <div className="bg-white rounded-t-[28px] sm:rounded-[28px] border border-[#e5e5ea] max-w-md w-full p-6 sm:p-7 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-7 shadow-[0_12px_40px_rgba(0,0,0,0.08)] max-h-[92vh] overflow-y-auto">
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex items-start justify-between pb-4 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                  Walk-in Token Issued
                </h3>
                <p className="text-xs text-[#86868b] mt-0.5">Live consultation queue pass</p>
              </div>
              <button
                type="button"
                onClick={() => setBookedPass(null)}
                className="p-1.5 rounded-full text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-5 p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-center space-y-2.5">
              <span className="text-xs font-medium text-[#86868b] block">Queue Token Number</span>
              <div className="text-5xl font-bold text-[#0066cc] tracking-tight">
                #{bookedPass.queueNumber}
              </div>
              <div className="pt-2.5 border-t border-[#e5e5ea] grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[11px] text-[#86868b] block">Est. Consultation</span>
                  <span className="font-semibold text-[#1d1d1f]">{bookedPass.estimatedTime || 'Active'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-[#86868b] block">Checking Shift</span>
                  <span className="font-semibold text-[#1d1d1f]">{bookedPass.checkingWindow || 'General'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs mb-6 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]">
              <div className="flex justify-between">
                <span className="text-[#86868b]">Patient</span>
                <span className="font-semibold text-[#1d1d1f]">{bookedPass.patientName}</span>
              </div>
              {bookedPass.patientPhone && (
                <div className="flex justify-between">
                  <span className="text-[#86868b]">Phone</span>
                  <span className="font-semibold text-[#1d1d1f]">{bookedPass.patientPhone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#86868b]">Doctor</span>
                <span className="font-semibold text-[#1d1d1f]">{cleanDoctorName(bookedPass.doctorName)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868b]">Date</span>
                <span className="font-semibold text-[#1d1d1f]">{bookedPass.appointmentDate}</span>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 h-11 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Slip</span>
              </button>
              <button
                type="button"
                onClick={() => setBookedPass(null)}
                className="flex-1 h-11 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-medium transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Thermal Token Slip */}
      {bookedPass && (
        <div className="hidden print:block font-sans text-black p-6 bg-white max-w-xs mx-auto border-2 border-black rounded-xl">
          <div className="text-center pb-3 border-b-2 border-dashed border-gray-400">
            <h2 className="text-base font-bold uppercase tracking-wide">
              {bookedPass.clinicName || 'MediArca Clinic'}
            </h2>
            {bookedPass.clinicAddress && (
              <p className="text-[11px] text-gray-700 mt-0.5">{bookedPass.clinicAddress}</p>
            )}
            <p className="text-[10px] text-gray-600 mt-1 uppercase tracking-wider">
              Consultation Queue Token
            </p>
          </div>

          <div className="py-4 text-center">
            <div className="text-xs uppercase text-gray-500 tracking-wider">Token Number</div>
            <div className="text-5xl font-bold tracking-tight my-1">
              #{bookedPass.queueNumber}
            </div>
            <div className="text-xs font-semibold text-gray-800">
              Shift: {bookedPass.checkingWindow || 'General'}
            </div>
          </div>

          <div className="space-y-1.5 py-3 border-t-2 border-b-2 border-dashed border-gray-400 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Patient:</span>
              <span className="font-bold">{bookedPass.patientName}</span>
            </div>
            {bookedPass.patientPhone && (
              <div className="flex justify-between">
                <span className="text-gray-600">Phone:</span>
                <span>{bookedPass.patientPhone}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Doctor:</span>
              <span className="font-bold">{cleanDoctorName(bookedPass.doctorName)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Date:</span>
              <span>{bookedPass.appointmentDate}</span>
            </div>
            {bookedPass.estimatedTime && (
              <div className="flex justify-between">
                <span className="text-gray-600">Est. Time:</span>
                <span className="font-bold">{bookedPass.estimatedTime}</span>
              </div>
            )}
          </div>

          <div className="pt-3 text-center text-[10px] text-gray-600 leading-tight">
            Please retain this slip and wait for your token call.
          </div>
        </div>
      )}

      {/* Mandatory Password Change Modal for Provisioned Accounts */}
      {user?.mustChangePassword && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn print:hidden">
          <div className="bg-white rounded-t-[28px] sm:rounded-[28px] border border-[#e5e5ea] max-w-md w-full p-6 sm:p-7 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-7 shadow-2xl relative text-left max-h-[92vh] overflow-y-auto">
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="mb-5">
              <h2 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                Update Temporary Password
              </h2>
              <p className="text-xs text-[#86868b] mt-1 leading-relaxed">
                Please set a permanent password to unlock your reception desk.
              </p>
            </div>

            {passwordError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Current Temporary Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter temporary password"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  New Permanent Password (min. 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={changingPassword}
                className="w-full h-11 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-sm font-medium transition-all cursor-pointer disabled:opacity-60 mt-2"
              >
                {changingPassword ? 'Updating...' : 'Save & Unlock Desk'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Clinic QR Check-In Standee Modal */}
      {data?.clinic && (
        <ClinicQrStandeeModal
          isOpen={isStandeeModalOpen}
          onClose={() => setIsStandeeModalOpen(false)}
          clinicId={data.clinic.id}
          clinicName={data.clinic.clinicName || 'Clinic Front Desk'}
          clinicAddress={data.clinic.address || ''}
          clinicPhone={data.clinic.phone || ''}
          checkinCode={data.clinic.checkinCode || ''}
        />
      )}

      {/* Reschedule Appointment Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn print:hidden">
          <div className="bg-white rounded-t-[28px] sm:rounded-[28px] border border-[#e5e5ea] max-w-md w-full p-6 sm:p-7 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-7 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex items-start justify-between pb-3 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                  Reschedule Appointment
                </h3>
                <p className="text-xs text-[#86868b] mt-0.5">Shift patient visit to another date or shift</p>
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
                <span className="text-[#86868b]">Doctor</span>
                <span className="font-semibold text-[#1d1d1f]">{cleanDoctorName(rescheduleTarget.doctorName)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868b]">Current Date</span>
                <span className="font-medium text-[#1d1d1f]">
                  {rescheduleTarget.currentDate}
                  {rescheduleTarget.currentQueueNumber ? ` (#${rescheduleTarget.currentQueueNumber})` : ''}
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

            {(() => {
              const doc = linkedDoctors.find((d) => d.doctorId === rescheduleTarget.doctorId);
              if (!doc || !doc.slots || doc.slots.length <= 1) return null;
              return (
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
                      <option value="">Standard Hours / Any Shift</option>
                      {doc.slots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.startTime} - {s.endTime})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              );
            })()}

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
    </DashboardLayout>
  );
};
