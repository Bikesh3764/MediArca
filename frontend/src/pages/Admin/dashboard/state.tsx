import React, { useEffect, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { api, Doctor, ContactMessageItem, getLocalDateString } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, Ban, XCircle } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';

/** All data, effects and actions for AdminDashboard, shared with its parts through context. */
export const useAdminDashboardState = () => {
  const { user, loading: loadingAuth, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const handleLogout = () => {
    logout();
    navigate('/admin-login');
  };
  const [stats, setStats] = useState<{
    totalPatients: number;
    totalDoctors: number;
    pendingDoctors: number;
    totalClinics?: number;
    pendingClinics?: number;
    totalAppointments: number;
    todayAppointments: number;
  } | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [clinicActionId, setClinicActionId] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<any | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as 'doctors' | 'clinics' | 'appointments' | 'messages' | null;
  const activeTab: 'doctors' | 'clinics' | 'appointments' | 'messages' =
    urlTab && ['doctors', 'clinics', 'appointments', 'messages'].includes(urlTab) ? urlTab : 'doctors';
  const setActiveTab = (tab: 'doctors' | 'clinics' | 'appointments' | 'messages') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };
  // Doctor Verification Filter & Search State
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');
  const [doctorStatusFilter, setDoctorStatusFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'SUSPENDED' | 'REJECTED'>('ALL');
  // Clinic Verification Filter & Search State
  const [clinicSearchQuery, setClinicSearchQuery] = useState('');
  const [clinicStatusFilter, setClinicStatusFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'SUSPENDED' | 'REJECTED'>('ALL');
  // Platform Bookings Organization State
  const [bookingDateFilter, setBookingDateFilter] = useState<'ALL' | 'TODAY' | 'TOMORROW' | 'PAST' | 'CUSTOM'>('ALL');
  const [bookingCustomDate, setBookingCustomDate] = useState<string>('');
  const [bookingClinicFilter, setBookingClinicFilter] = useState<string>('ALL');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('ALL');
  const [bookingSearchQuery, setBookingSearchQuery] = useState<string>('');
  const [bookingViewMode, setBookingViewMode] = useState<'table' | 'by-date' | 'by-clinic'>('table');
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const isAnyAdminModalOpen = Boolean(selectedDoctor || selectedClinic || selectedAppointment);
  useEffect(() => {
    if (isAnyAdminModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAnyAdminModalOpen]);
  const getTodayDateStr = () => getLocalDateString();
  const getTomorrowDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getLocalDateString(d);
  };
  const todayStr = getTodayDateStr();
  const tomorrowStr = getTomorrowDateStr();
  const resolveClinic = useCallback((appt: any): { id?: string; name: string; city?: string | null; address?: string | null } => {
    if (appt?.clinic?.clinicName) {
      return {
        id: appt.clinic.id,
        name: appt.clinic.clinicName,
        city: appt.clinic.city || null,
        address: appt.clinic.address || null,
      };
    }
    if (appt?.doctor?.clinicAddress) {
      const raw = appt.doctor.clinicAddress;
      const matched = clinics.find((c) =>
        c.clinicName && raw.toLowerCase().includes(c.clinicName.toLowerCase())
      );
      if (matched) {
        return {
          id: matched.id,
          name: matched.clinicName,
          city: matched.city || null,
          address: matched.address || null,
        };
      }
      return {
        id: raw,
        name: raw.split(',')[0].trim(),
        city: null,
        address: raw,
      };
    }
    return {
      id: 'direct',
      name: 'Own practice',
      city: null,
      address: null,
    };
  }, [clinics]);
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'Unscheduled';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      }
    }
    return dateStr;
  };
  const getDateBadge = (dateStr: string) => {
    if (dateStr === todayStr) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
          Today
        </span>
      );
    }
    if (dateStr === tomorrowStr) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]">
          Tomorrow
        </span>
      );
    }
    if (dateStr < todayStr) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-normal bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
          Past
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-normal bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]">
        Upcoming
      </span>
    );
  };
  const renderAppointmentStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'WAITING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0066cc]"></span>
            Waiting
          </span>
        );
      case 'IN_CONSULTATION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0066cc]"></span>
            In cabin
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]">
            <CheckCircle2 className="w-3 h-3 text-[#0066cc]" />
            Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-danger-soft text-danger border border-danger-line">
            <XCircle className="w-3 h-3 text-danger" />
            Cancelled
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
            <Clock className="w-3 h-3 text-[#86868b]" />
            Expired
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]">
            <Clock className="w-3 h-3 text-[#86868b]" />
            Not paid
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-normal bg-[#f5f5f7] text-[#1d1d1f]">
            {status}
          </span>
        );
    }
  };
  const handleResetBookingFilters = () => {
    setBookingDateFilter('ALL');
    setBookingCustomDate('');
    setBookingClinicFilter('ALL');
    setBookingStatusFilter('ALL');
    setBookingSearchQuery('');
  };
  const getPractitionerStatus = useCallback((
    doc: { verificationStatus?: string; isVerified?: boolean } | null | undefined
  ): 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | 'PENDING' => {
    if (!doc) return 'PENDING';
    if (doc.verificationStatus) {
      const s = doc.verificationStatus.toUpperCase();
      if (s === 'VERIFIED' || s === 'SUSPENDED' || s === 'REJECTED' || s === 'PENDING') return s as any;
    }
    return doc.isVerified ? 'VERIFIED' : 'PENDING';
  }, []);
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      const status = getPractitionerStatus(doc);
      if (doctorStatusFilter !== 'ALL' && status !== doctorStatusFilter) {
        return false;
      }
      if (doctorSearchQuery.trim()) {
        const q = doctorSearchQuery.toLowerCase().trim();
        const name = (doc.user?.fullName || '').toLowerCase();
        const email = (doc.user?.email || '').toLowerCase();
        const spec = (doc.specialty || '').toLowerCase();
        const phone = (doc.user?.phone || '').toLowerCase();
        const qualifications = (doc.qualifications || '').toLowerCase();
        return (
          name.includes(q) ||
          email.includes(q) ||
          spec.includes(q) ||
          phone.includes(q) ||
          qualifications.includes(q)
        );
      }
      return true;
    });
  }, [doctors, doctorStatusFilter, doctorSearchQuery, getPractitionerStatus]);
  const filteredClinics = useMemo(() => {
    return clinics.filter((c) => {
      const status = getPractitionerStatus(c);
      if (clinicStatusFilter !== 'ALL' && status !== clinicStatusFilter) {
        return false;
      }
      if (clinicSearchQuery.trim()) {
        const q = clinicSearchQuery.toLowerCase().trim();
        const name = (c.clinicName || '').toLowerCase();
        const city = (c.city || '').toLowerCase();
        const address = (c.address || '').toLowerCase();
        const adminName = (c.user?.fullName || '').toLowerCase();
        const email = (c.user?.email || '').toLowerCase();
        const phone = (c.phone || c.user?.phone || '').toLowerCase();
        return (
          name.includes(q) ||
          city.includes(q) ||
          address.includes(q) ||
          adminName.includes(q) ||
          email.includes(q) ||
          phone.includes(q)
        );
      }
      return true;
    });
  }, [clinics, clinicStatusFilter, clinicSearchQuery, getPractitionerStatus]);
  const isAnyBookingFilterActive =
    bookingDateFilter !== 'ALL' ||
    bookingCustomDate !== '' ||
    bookingClinicFilter !== 'ALL' ||
    bookingStatusFilter !== 'ALL' ||
    bookingSearchQuery.trim() !== '';
  const clinicFilterOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    appointments.forEach((appt) => {
      const c = resolveClinic(appt);
      const key = c.name;
      if (!map.has(key)) {
        map.set(key, { id: key, name: c.name, count: 1 });
      } else {
        map.get(key)!.count += 1;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [appointments, resolveClinic]);
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      // 1. Date Filter
      if (bookingDateFilter === 'TODAY' && appt.appointmentDate !== todayStr) {
        return false;
      }
      if (bookingDateFilter === 'TOMORROW' && appt.appointmentDate !== tomorrowStr) {
        return false;
      }
      if (bookingDateFilter === 'PAST' && (!appt.appointmentDate || appt.appointmentDate >= todayStr)) {
        return false;
      }
      if (bookingDateFilter === 'CUSTOM' && bookingCustomDate && appt.appointmentDate !== bookingCustomDate) {
        return false;
      }

      // 2. Clinic Filter
      if (bookingClinicFilter !== 'ALL') {
        const c = resolveClinic(appt);
        if (
          c.name !== bookingClinicFilter &&
          appt.clinicId !== bookingClinicFilter &&
          appt.clinic?.id !== bookingClinicFilter
        ) {
          return false;
        }
      }

      // 3. Status Filter
      if (bookingStatusFilter !== 'ALL') {
        if (appt.status?.toUpperCase() !== bookingStatusFilter.toUpperCase()) {
          return false;
        }
      }

      // 4. Search Filter
      if (bookingSearchQuery.trim()) {
        const q = bookingSearchQuery.toLowerCase().trim();
        const patientName = (appt.patient?.user?.fullName || appt.patientName || '').toLowerCase();
        const doctorName = (appt.doctor?.user?.fullName || '').toLowerCase();
        const clinicName = resolveClinic(appt).name.toLowerCase();
        const tokenStr = `queue #${appt.queueNumber}`.toLowerCase();
        const tokenNum = String(appt.queueNumber);
        const phone = (appt.patient?.user?.phone || '').toLowerCase();
        const email = (appt.patient?.user?.email || '').toLowerCase();

        if (
          !patientName.includes(q) &&
          !doctorName.includes(q) &&
          !clinicName.includes(q) &&
          !tokenStr.includes(q) &&
          tokenNum !== q &&
          !phone.includes(q) &&
          !email.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    appointments,
    bookingDateFilter,
    bookingCustomDate,
    bookingClinicFilter,
    bookingStatusFilter,
    bookingSearchQuery,
    todayStr,
    tomorrowStr,
    resolveClinic,
  ]);
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    filteredAppointments.forEach((appt) => {
      const d = appt.appointmentDate || 'Unscheduled';
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(appt);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredAppointments]);
  const appointmentsByClinic = useMemo(() => {
    const map = new Map<string, { clinicInfo: { name: string; city?: string | null; address?: string | null }; items: any[] }>();
    filteredAppointments.forEach((appt) => {
      const c = resolveClinic(appt);
      if (!map.has(c.name)) {
        map.set(c.name, { clinicInfo: c, items: [] });
      }
      map.get(c.name)!.items.push(appt);
    });
    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
  }, [filteredAppointments, resolveClinic]);
  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, doctorsData, clinicsData, apptsData, messagesData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminDoctors(),
        api.getAdminClinics(),
        api.getAdminAppointments(),
        api.getAdminContactMessages().catch(() => []),
      ]);
      setStats(statsData);
      setDoctors(doctorsData);
      setClinics(clinicsData);
      setAppointments(apptsData);
      setContactMessages(messagesData || []);
      setSelectedDoctor((prev: any) => (prev ? doctorsData.find((d: any) => d.id === prev.id) || prev : null));
      setSelectedClinic((prev: any) => (prev ? clinicsData.find((c: any) => c.id === prev.id) || prev : null));
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };
  const handleMarkMessageRead = async (id: string) => {
    try {
      await api.markContactMessageRead(id);
      setContactMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: 'READ' } : m))
      );
    } catch (err) {
      console.error('Failed to mark message as read:', err);
    }
  };
  useEffect(() => {
    let mounted = true;
    if (loadingAuth) return;
    if (!user || user.role?.toUpperCase() !== 'ADMIN') {
      navigate('/admin-login');
      return;
    }
    queueMicrotask(() => {
      if (mounted) fetchData();
    });
    return () => {
      mounted = false;
    };
  }, [user, loadingAuth, navigate]);
  const renderStatusBadge = (status: 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | 'PENDING') => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 bg-[#0066cc]/10 text-[#0066cc] px-2.5 py-1 rounded-full text-xs font-semibold border border-[#0066cc]/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Verified
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1 bg-danger-soft text-danger px-2.5 py-1 rounded-full text-xs font-semibold border border-danger-line">
            <Ban className="w-3.5 h-3.5" />
            Suspended
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 bg-[#f5f5f7] text-[#86868b] px-2.5 py-1 rounded-full text-xs font-semibold border border-[#e5e5ea]">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-[#f5f5f7] text-[#1d1d1f] px-2.5 py-1 rounded-full text-xs font-semibold border border-[#e5e5ea]">
            <Clock className="w-3.5 h-3.5 text-[#86868b]" />
            Under review
          </span>
        );
    }
  };
  const handleVerifyClinic = async (
    clinicId: string,
    action: 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | boolean
  ): Promise<boolean> => {
    setClinicActionId(clinicId);
    try {
      await api.verifyClinic(clinicId, action);
      toast.success('Clinic verification updated');
      await fetchData();
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Clinic verification update failed');
      return false;
    } finally {
      setClinicActionId(null);
    }
  };
  const handleVerify = async (
    doctorId: string,
    action: 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | boolean
  ): Promise<boolean> => {
    setActionId(doctorId);
    try {
      await api.verifyDoctor(doctorId, action);
      toast.success('Doctor verification updated');
      await fetchData();
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Verification update failed');
      return false;
    } finally {
      setActionId(null);
    }
  };
  const handleDeleteContactMessage = async (id: string) => {
    const ok = await confirm({
      title: 'Delete message?',
      message: 'Delete this message? This can’t be undone.',
      confirmText: 'Delete',
      isDestructive: true,
    });
    if (!ok) return;

    try {
      await api.deleteContactMessage(id);
      toast.success('Message deleted');
      setContactMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      toast.error(err.message || 'Couldn’t delete message. Try again.');
    }
  };
  return {
    user,
    loadingAuth,
    logout,
    navigate,
    toast,
    confirm,
    handleLogout,
    stats,
    setStats,
    doctors,
    setDoctors,
    clinics,
    setClinics,
    appointments,
    setAppointments,
    contactMessages,
    setContactMessages,
    loading,
    setLoading,
    actionId,
    setActionId,
    clinicActionId,
    setClinicActionId,
    selectedDoctor,
    setSelectedDoctor,
    selectedClinic,
    setSelectedClinic,
    searchParams,
    setSearchParams,
    urlTab,
    activeTab,
    setActiveTab,
    doctorSearchQuery,
    setDoctorSearchQuery,
    doctorStatusFilter,
    setDoctorStatusFilter,
    clinicSearchQuery,
    setClinicSearchQuery,
    clinicStatusFilter,
    setClinicStatusFilter,
    bookingDateFilter,
    setBookingDateFilter,
    bookingCustomDate,
    setBookingCustomDate,
    bookingClinicFilter,
    setBookingClinicFilter,
    bookingStatusFilter,
    setBookingStatusFilter,
    bookingSearchQuery,
    setBookingSearchQuery,
    bookingViewMode,
    setBookingViewMode,
    selectedAppointment,
    setSelectedAppointment,
    isAnyAdminModalOpen,
    getTodayDateStr,
    getTomorrowDateStr,
    todayStr,
    tomorrowStr,
    resolveClinic,
    formatDisplayDate,
    getDateBadge,
    renderAppointmentStatusBadge,
    handleResetBookingFilters,
    getPractitionerStatus,
    filteredDoctors,
    filteredClinics,
    isAnyBookingFilterActive,
    clinicFilterOptions,
    filteredAppointments,
    appointmentsByDate,
    appointmentsByClinic,
    fetchData,
    handleMarkMessageRead,
    renderStatusBadge,
    handleVerifyClinic,
    handleVerify,
    handleDeleteContactMessage,
  };
};

export type AdminDashboardState = ReturnType<typeof useAdminDashboardState>;
export const AdminDashboardContext = createContext<AdminDashboardState | null>(null);
export const useAdminDashboard = (): AdminDashboardState => {
  const value = useContext(AdminDashboardContext);
  if (!value) throw new Error('useAdminDashboard must be used inside AdminDashboard');
  return value;
};
