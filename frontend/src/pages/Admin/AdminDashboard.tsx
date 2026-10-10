import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { api, Doctor, format12Hour, getFileUrl, formatDoctorDegrees, ContactMessageItem, getLocalDateString } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  Users,
  Shield,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Clock,
  X,
  Building2,
  Ban,
  XCircle,
  Globe,
  LogOut,
  Filter,
  Search,
  Eye,
  RotateCcw,
  ChevronDown,
  Trash2,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user, loading: loadingAuth, logout } = useAuth();
  const navigate = useNavigate();

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
  const [activeTab, setActiveTab] = useState<'doctors' | 'clinics' | 'appointments' | 'messages'>('doctors');

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
      name: 'Direct / Independent Practice',
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
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      }
    }
    return dateStr;
  };

  const getDateBadge = (dateStr: string) => {
    if (dateStr === todayStr) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
          Today
        </span>
      );
    }
    if (dateStr === tomorrowStr) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]">
          Tomorrow
        </span>
      );
    }
    if (dateStr < todayStr) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
          Past
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]">
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
            In Consultation
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-500" />
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
            Pending Approval
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f5f5f7] text-[#1d1d1f]">
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
      console.error('Failed to mark contact message as read:', err);
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
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full text-xs font-semibold border border-rose-200">
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
            Pending Review
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
      await fetchData();
      return true;
    } catch (err: any) {
      alert(err.message || 'Clinic verification update failed');
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
      await fetchData();
      return true;
    } catch (err: any) {
      alert(err.message || 'Verification update failed');
      return false;
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteContactMessage = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this contact inquiry? This cannot be undone.')) {
      return;
    }
    try {
      await api.deleteContactMessage(id);
      setContactMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete contact inquiry');
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      {/* Sticky Apple-styled Admin Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-[#e5e5ea] select-none shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity" title="Return to Main Website">
              <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto" />
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea] text-[11px] font-medium">
              <Shield className="w-3 h-3 text-[#86868b]" />
              Root Admin Console
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium text-[#48484a] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-all border border-[#e5e5ea]"
              title="Return to Main Website"
            >
              <Globe className="w-3.5 h-3.5 text-[#86868b]" />
              <span className="hidden sm:inline">Main Website</span>
              <span className="sm:hidden">Home</span>
            </Link>

            <AppleButton
              variant="ghost"
              size="sm"
              onClick={fetchData}
              className="flex items-center gap-1.5 text-xs text-[#48484a]"
              title="Refresh platform statistics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0066cc]' : ''}`} />
              <span className="hidden md:inline">Refresh</span>
            </AppleButton>

            <div className="h-4 w-px bg-[#e5e5ea] hidden sm:block" />

            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[11px] text-[#48484a]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0066cc]" />
              <span className="font-medium truncate max-w-[140px]">{user?.email || 'admin@mediarca.com'}</span>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all border border-rose-200 cursor-pointer active:scale-[0.98]"
              title="Sign Out of Admin Console"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Page Title & Subtitle banner */}
      <div className="bg-white border-b border-[#e5e5ea] px-4 sm:px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-[#1d1d1f] leading-snug">
              Admin Dashboard
            </h1>
            <p className="text-[13px] text-[#86868b] mt-1 leading-relaxed">
              Manage doctor and clinic verifications, view platform statistics
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#86868b]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] font-medium text-[#1d1d1f]">
              <Users className="w-3.5 h-3.5 text-[#0066cc]" />
              {(stats?.totalDoctors || 0) + (stats?.totalClinics || clinics.length)} Registered Providers
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-5 sm:pt-8 space-y-6 sm:space-y-8">
        {loading && !stats ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin mb-3"></div>
            <p className="text-xs text-[#86868b]">Loading records...</p>
          </div>
        ) : (
          <>
            {/* KPI Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <UtilityCard>
                <div>
                  <span className="text-xs font-medium text-[#86868b] block mb-1.5">Patients</span>
                  <h3 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">{stats?.totalPatients || 0}</h3>
                </div>
              </UtilityCard>

              <UtilityCard>
                <div>
                  <span className="text-xs font-medium text-[#86868b] block mb-1.5">Doctors</span>
                  <h3 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">{stats?.totalDoctors || 0}</h3>
                  <p className="text-[11px] text-[#86868b] font-medium mt-1">{stats?.pendingDoctors || 0} pending review</p>
                </div>
              </UtilityCard>

              <UtilityCard>
                <div>
                  <span className="text-xs font-medium text-[#86868b] block mb-1.5">Clinics</span>
                  <h3 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">{stats?.totalClinics || clinics.length}</h3>
                  <p className="text-[11px] text-[#86868b] font-medium mt-1">
                    {clinics.filter((c) => getPractitionerStatus(c) === 'PENDING').length} pending review
                  </p>
                </div>
              </UtilityCard>

              <UtilityCard>
                <div>
                  <span className="text-xs font-medium text-[#86868b] block mb-1.5">Pending Review</span>
                  <h3 className="text-3xl font-semibold text-[#0066cc] tracking-tight">
                    {doctors.filter((d) => getPractitionerStatus(d) === 'PENDING').length +
                      clinics.filter((c) => getPractitionerStatus(c) === 'PENDING').length}
                  </h3>
                  <p className="text-[11px] text-[#86868b] font-medium mt-1">Docs & Clinics</p>
                </div>
              </UtilityCard>

              <UtilityCard>
                <div>
                  <span className="text-xs font-medium text-[#86868b] block mb-1.5">Total Bookings</span>
                  <h3 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">{stats?.totalAppointments || 0}</h3>
                  <p className="text-[11px] text-[#0066cc] font-medium mt-1">{stats?.todayAppointments || 0} today</p>
                </div>
              </UtilityCard>
            </div>

            {/* Verification Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-[#e5e5ea] pb-4 overflow-x-auto scrollbar-none">
              <div className="inline-flex p-1 bg-[#e8e8ed]/70 rounded-full border border-[#e5e5ea] whitespace-nowrap">
                <button
                  onClick={() => setActiveTab('doctors')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                    activeTab === 'doctors'
                      ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  <span>Doctor Verification</span>
                  {doctors.filter((d) => getPractitionerStatus(d) === 'PENDING').length > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#0066cc] text-white text-[10px] font-semibold">
                      {doctors.filter((d) => getPractitionerStatus(d) === 'PENDING').length} pending
                    </span>
                  ) : (
                    <span className="text-[10px] opacity-70">({doctors.length})</span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('clinics')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                    activeTab === 'clinics'
                      ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  <span>Clinic Verification</span>
                  {clinics.filter((c) => getPractitionerStatus(c) === 'PENDING').length > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#0066cc] text-white text-[10px] font-semibold">
                      {clinics.filter((c) => getPractitionerStatus(c) === 'PENDING').length} pending
                    </span>
                  ) : (
                    <span className="text-[10px] opacity-70">({clinics.length})</span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('appointments')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                    activeTab === 'appointments'
                      ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  <span>Platform Bookings ({appointments.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('messages')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                    activeTab === 'messages'
                      ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  <span>Contact Inquiries</span>
                  {contactMessages.filter((m) => m.status === 'NEW').length > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#0066cc] text-white text-[10px] font-semibold">
                      {contactMessages.filter((m) => m.status === 'NEW').length} new
                    </span>
                  ) : (
                    <span className="text-[10px] opacity-70">({contactMessages.length})</span>
                  )}
                </button>
              </div>
            </div>

            {/* Tab 1: Doctor Verification Portal */}
            {activeTab === 'doctors' && (
              <UtilityCard>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">Practitioner Verification Queue</h3>
                    <p className="text-[13px] text-[#86868b] mt-1 leading-relaxed">
                      Doctors must be verified by admin before appearing in patient searches.
                    </p>
                  </div>
                  <span className="text-xs text-[#86868b]">
                    {filteredDoctors.length} of {doctors.length} Registered Doctor(s)
                  </span>
                </div>

                {/* Search & Status Filters */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={doctorSearchQuery}
                      onChange={(e) => setDoctorSearchQuery(e.target.value)}
                      placeholder="Search doctor by name, specialty, email..."
                      className="w-full h-10 pl-10 pr-8 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none focus:bg-white focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                    />
                    {doctorSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setDoctorSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="inline-flex items-center p-1 bg-[#e8e8ed]/70 rounded-full border border-[#e5e5ea] overflow-x-auto scrollbar-none self-start sm:self-auto">
                    {(['ALL', 'PENDING', 'VERIFIED', 'SUSPENDED', 'REJECTED'] as const).map((st) => {
                      const count = st === 'ALL'
                        ? doctors.length
                        : doctors.filter((d) => getPractitionerStatus(d) === st).length;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setDoctorStatusFilter(st)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                            doctorStatusFilter === st
                              ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-semibold'
                              : 'text-[#86868b] hover:text-[#1d1d1f]'
                          }`}
                        >
                          <span>{st === 'ALL' ? 'All' : st === 'PENDING' ? 'Pending' : st === 'VERIFIED' ? 'Verified' : st === 'SUSPENDED' ? 'Suspended' : 'Rejected'}</span>
                          <span className="ml-1 opacity-70">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#e5e5ea] text-[#86868b] font-semibold">
                      <tr>
                        <th className="py-3 px-3">Practitioner</th>
                        <th className="py-3 px-3">Specialty</th>
                        <th className="py-3 px-3">Checking Shift</th>
                        <th className="py-3 px-3">Fee</th>
                        <th className="py-3 px-3">Verification Status</th>
                        <th className="py-3 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f0]">
                      {filteredDoctors.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-[#86868b]">
                            No practitioners match the current search or status filter.
                          </td>
                        </tr>
                      ) : (
                        filteredDoctors.map((doc) => (
                        <tr key={doc.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex-shrink-0 cursor-pointer"
                                onClick={() => setSelectedDoctor(doc)}
                              >
                                {doc.user.avatarUrl ? (
                                  <img
                                    src={getFileUrl(doc.user.avatarUrl)}
                                    alt={doc.user.fullName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center font-bold text-[#0066cc]">
                                    {doc.user.fullName[0]}
                                  </div>
                                )}
                              </div>
                              <div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedDoctor(doc)}
                                  className="text-[13px] text-[#1d1d1f] font-semibold block text-left hover:text-[#0066cc] transition-colors"
                                >
                                  {doc.user.fullName}
                                </button>
                                <span className="text-[#86868b]">{doc.user.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 font-medium text-[#1d1d1f]">{doc.specialty}</td>
                          <td className="py-3.5 px-3 text-[#86868b]">
                            {doc.checkingStartTime
                              ? `${format12Hour(doc.checkingStartTime)} – ${format12Hour(doc.checkingEndTime)}`
                              : 'Flexible'}
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-[#1d1d1f]">₹{doc.consultationFee}</td>
                          <td className="py-3.5 px-3">
                            {renderStatusBadge(getPractitionerStatus(doc))}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <AppleButton
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedDoctor(doc)}
                                className="text-xs"
                              >
                                Details
                              </AppleButton>

                              {getPractitionerStatus(doc) === 'PENDING' && (
                                <>
                                  <AppleButton
                                    variant="ghost"
                                    size="sm"
                                    disabled={actionId === doc.id}
                                    onClick={() => handleVerify(doc.id, 'REJECTED')}
                                    className="text-rose-600 hover:text-rose-700 hover:border-rose-300 text-xs"
                                  >
                                    {actionId === doc.id ? 'Updating...' : 'Reject'}
                                  </AppleButton>
                                  <AppleButton
                                    variant="primary"
                                    size="sm"
                                    disabled={actionId === doc.id}
                                    onClick={() => handleVerify(doc.id, 'VERIFIED')}
                                    className="text-xs"
                                  >
                                    {actionId === doc.id ? 'Verifying...' : 'Approve & Verify'}
                                  </AppleButton>
                                </>
                              )}

                              {getPractitionerStatus(doc) === 'VERIFIED' && (
                                <AppleButton
                                  variant="ghost"
                                  size="sm"
                                  disabled={actionId === doc.id}
                                  onClick={() => handleVerify(doc.id, 'SUSPENDED')}
                                  className="text-rose-600 hover:text-rose-700 hover:border-rose-300 text-xs"
                                >
                                  {actionId === doc.id ? 'Suspending...' : 'Suspend'}
                                </AppleButton>
                              )}

                              {getPractitionerStatus(doc) === 'SUSPENDED' && (
                                <AppleButton
                                  variant="primary"
                                  size="sm"
                                  disabled={actionId === doc.id}
                                  onClick={() => handleVerify(doc.id, 'VERIFIED')}
                                  className="text-xs font-medium"
                                >
                                  {actionId === doc.id ? 'Activating...' : 'Re-activate'}
                                </AppleButton>
                              )}

                              {getPractitionerStatus(doc) === 'REJECTED' && (
                                <AppleButton
                                  variant="ghost"
                                  size="sm"
                                  disabled={actionId === doc.id}
                                  onClick={() => handleVerify(doc.id, 'VERIFIED')}
                                  className="text-[#0066cc] hover:text-[#0071e3] text-xs"
                                >
                                  {actionId === doc.id ? 'Updating...' : 'Approve & Verify'}
                                </AppleButton>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                    </tbody>
                  </table>
                </div>
              </UtilityCard>
            )}

            {/* Tab 2: Clinic Verification Portal */}
            {activeTab === 'clinics' && (
              <UtilityCard>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">Clinic Facility Verification Queue</h3>
                    <p className="text-[13px] text-[#86868b] mt-1 leading-relaxed">
                      Clinics must be verified by MediArca administration before appearing in patient searches or doctor affiliation lists.
                    </p>
                  </div>
                  <span className="text-xs text-[#86868b]">
                    {filteredClinics.length} of {clinics.length} Registered Clinic(s)
                  </span>
                </div>

                {/* Search & Status Filters */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={clinicSearchQuery}
                      onChange={(e) => setClinicSearchQuery(e.target.value)}
                      placeholder="Search clinic by name, address, city, contact..."
                      className="w-full h-10 pl-10 pr-8 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none focus:bg-white focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                    />
                    {clinicSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setClinicSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="inline-flex items-center p-1 bg-[#e8e8ed]/70 rounded-full border border-[#e5e5ea] overflow-x-auto scrollbar-none self-start sm:self-auto">
                    {(['ALL', 'PENDING', 'VERIFIED', 'SUSPENDED', 'REJECTED'] as const).map((st) => {
                      const count = st === 'ALL'
                        ? clinics.length
                        : clinics.filter((c) => getPractitionerStatus(c) === st).length;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setClinicStatusFilter(st)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                            clinicStatusFilter === st
                              ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-semibold'
                              : 'text-[#86868b] hover:text-[#1d1d1f]'
                          }`}
                        >
                          <span>{st === 'ALL' ? 'All' : st === 'PENDING' ? 'Pending' : st === 'VERIFIED' ? 'Verified' : st === 'SUSPENDED' ? 'Suspended' : 'Rejected'}</span>
                          <span className="ml-1 opacity-70">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#e5e5ea] text-[#86868b] font-semibold">
                      <tr>
                        <th className="py-3 px-3">Facility</th>
                        <th className="py-3 px-3">Location</th>
                        <th className="py-3 px-3">Capacity & Team</th>
                        <th className="py-3 px-3">Verification Status</th>
                        <th className="py-3 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f0]">
                      {filteredClinics.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-xs text-[#86868b]">
                            {clinicSearchQuery || clinicStatusFilter !== 'ALL'
                              ? 'No clinical facilities match your search query or status filter.'
                              : 'No clinical facilities registered on the platform yet.'}
                          </td>
                        </tr>
                      ) : (
                        filteredClinics.map((c) => (
                          <tr key={c.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                            <td className="py-3.5 px-3">
                              <div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedClinic(c)}
                                  className="text-[13px] text-[#1d1d1f] font-semibold block text-left hover:text-[#0066cc] transition-colors cursor-pointer"
                                >
                                  {c.clinicName}
                                </button>
                                <div className="text-[#86868b]">
                                  {c.user?.fullName} • {c.user?.email}
                                </div>
                                {c.phone && <div className="text-[10px] text-[#86868b]">{c.phone}</div>}
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-[#1d1d1f]">
                              <div>{c.address}</div>
                              <div className="text-[#86868b] text-[10px]">{c.city}</div>
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[#1d1d1f] font-medium">
                                  {c._count?.doctors ?? c.doctorsCount ?? 0} Affiliated Doctor(s)
                                </span>
                                <span className="text-[10px] text-[#86868b]">
                                  {c._count?.receptionists ?? c.receptionistsCount ?? 0} Receptionist(s) • {c._count?.appointments ?? c.appointmentsCount ?? 0} Bookings
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              {renderStatusBadge(getPractitionerStatus(c))}
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <AppleButton
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedClinic(c)}
                                  className="text-xs"
                                >
                                  Details
                                </AppleButton>

                                {getPractitionerStatus(c) === 'PENDING' && (
                                  <>
                                    <AppleButton
                                      variant="ghost"
                                      size="sm"
                                      disabled={clinicActionId === c.id}
                                      onClick={() => handleVerifyClinic(c.id, 'REJECTED')}
                                      className="text-rose-600 hover:text-rose-700 hover:border-rose-300 text-xs"
                                    >
                                      {clinicActionId === c.id ? 'Updating...' : 'Reject'}
                                    </AppleButton>
                                    <AppleButton
                                      variant="primary"
                                      size="sm"
                                      disabled={clinicActionId === c.id}
                                      onClick={() => handleVerifyClinic(c.id, 'VERIFIED')}
                                      className="text-xs"
                                    >
                                      {clinicActionId === c.id ? 'Verifying...' : 'Approve & Verify'}
                                    </AppleButton>
                                  </>
                                )}

                                {getPractitionerStatus(c) === 'VERIFIED' && (
                                  <AppleButton
                                    variant="ghost"
                                    size="sm"
                                    disabled={clinicActionId === c.id}
                                    onClick={() => handleVerifyClinic(c.id, 'SUSPENDED')}
                                    className="text-rose-600 hover:text-rose-700 hover:border-rose-300 text-xs"
                                  >
                                    {clinicActionId === c.id ? 'Suspending...' : 'Suspend'}
                                  </AppleButton>
                                )}

                                {getPractitionerStatus(c) === 'SUSPENDED' && (
                                  <AppleButton
                                    variant="primary"
                                    size="sm"
                                    disabled={clinicActionId === c.id}
                                    onClick={() => handleVerifyClinic(c.id, 'VERIFIED')}
                                    className="text-xs font-medium"
                                  >
                                    {clinicActionId === c.id ? 'Activating...' : 'Re-activate'}
                                  </AppleButton>
                                )}

                                {getPractitionerStatus(c) === 'REJECTED' && (
                                  <AppleButton
                                    variant="ghost"
                                    size="sm"
                                    disabled={clinicActionId === c.id}
                                    onClick={() => handleVerifyClinic(c.id, 'VERIFIED')}
                                    className="text-[#0066cc] hover:text-[#0071e3] text-xs"
                                  >
                                    {clinicActionId === c.id ? 'Updating...' : 'Approve & Verify'}
                                  </AppleButton>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </UtilityCard>
            )}

            {/* Tab 3: Platform Appointments Oversight - Organized by Dates & Clinics */}
            {activeTab === 'appointments' && (
              <div className="space-y-5">
                <UtilityCard>
                  {/* Header & View Mode Switcher */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#e5e5ea]">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">Platform Bookings & Queue Oversight</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f]">
                          {filteredAppointments.length} of {appointments.length} Total
                        </span>
                        {appointments.length >= 250 && (
                          <span className="text-[11px] text-[#86868b] hidden sm:inline">
                            (Loaded 250 most recent records)
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-[#86868b] mt-1 leading-relaxed">
                        Audit trail of queue tokens, consultation flows, and schedules organized by dates and clinical facilities.
                      </p>
                    </div>

                    {/* View Mode Segmented Controls */}
                    <div className="inline-flex items-center p-1 bg-[#e8e8ed]/70 rounded-full border border-[#e5e5ea] self-start lg:self-auto">
                      <button
                        type="button"
                        onClick={() => setBookingViewMode('table')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          bookingViewMode === 'table'
                            ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-semibold'
                            : 'text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                        title="View flat table of all matching bookings"
                      >
                        <span>All Records</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBookingViewMode('by-date')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          bookingViewMode === 'by-date'
                            ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-semibold'
                            : 'text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                        title="Group bookings chronologically by date"
                      >
                        <span>By Date</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBookingViewMode('by-clinic')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          bookingViewMode === 'by-clinic'
                            ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-semibold'
                            : 'text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                        title="Group bookings by clinic facility"
                      >
                        <span>By Clinic</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Counters Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 my-5">
                    <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-center">
                      <span className="text-xs font-medium text-[#86868b] block">Total Shown</span>
                      <strong className="text-lg font-semibold text-[#1d1d1f] mt-0.5 block">{filteredAppointments.length}</strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-center">
                      <span className="text-xs font-medium text-[#86868b] block">Today's Visits</span>
                      <strong className="text-lg font-semibold text-[#0066cc] mt-0.5 block">
                        {filteredAppointments.filter((a) => a.appointmentDate === todayStr).length}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-center">
                      <span className="text-xs font-medium text-[#86868b] block">Waiting</span>
                      <strong className="text-lg font-semibold text-[#1d1d1f] mt-0.5 block">
                        {filteredAppointments.filter((a) => (a.status || '').toUpperCase() === 'WAITING').length}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-center">
                      <span className="text-xs font-medium text-[#86868b] block">In Cabin</span>
                      <strong className="text-lg font-semibold text-[#0066cc] mt-0.5 block">
                        {filteredAppointments.filter((a) => (a.status || '').toUpperCase() === 'IN_CONSULTATION').length}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-center">
                      <span className="text-xs font-medium text-[#86868b] block">Completed</span>
                      <strong className="text-lg font-semibold text-[#1d1d1f] mt-0.5 block">
                        {filteredAppointments.filter((a) => (a.status || '').toUpperCase() === 'COMPLETED').length}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-center">
                      <span className="text-xs font-medium text-[#86868b] block">Cancelled/Off</span>
                      <strong className="text-lg font-semibold text-rose-600 mt-0.5 block">
                        {filteredAppointments.filter((a) => ['CANCELLED', 'EXPIRED'].includes((a.status || '').toUpperCase())).length}
                      </strong>
                    </div>
                  </div>

                  {/* Interactive Filter Control Panel (Date, Clinic, Status, Search) */}
                  <div className="p-4 rounded-2xl bg-[#f5f5f7]/60 border border-[#e5e5ea] space-y-3.5">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                      {/* Search Bar */}
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={bookingSearchQuery}
                          onChange={(e) => setBookingSearchQuery(e.target.value)}
                          placeholder="Search patient, practitioner, clinic, token #..."
                          className="w-full h-11 pl-10 pr-8 rounded-xl bg-white border border-[#d2d2d7] text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                        />
                        {bookingSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setBookingSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f]"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Clinic Filter Selector */}
                      <div className="flex items-center gap-2">
                        <div className="relative min-w-[200px]">
                          <select
                            value={bookingClinicFilter}
                            onChange={(e) => setBookingClinicFilter(e.target.value)}
                            aria-label="Filter bookings by clinic facility"
                            className="w-full h-11 appearance-none pl-9 pr-8 rounded-xl bg-white border border-[#d2d2d7] text-[13px] text-[#1d1d1f] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 cursor-pointer transition-all duration-150"
                          >
                            <option value="ALL">All Clinics ({appointments.length})</option>
                            {clinicFilterOptions.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name} ({c.count})
                              </option>
                            ))}
                          </select>
                          <Building2 className="w-4 h-4 text-[#86868b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {/* Status Filter Selector */}
                        <div className="relative min-w-[150px]">
                          <select
                            value={bookingStatusFilter}
                            onChange={(e) => setBookingStatusFilter(e.target.value)}
                            aria-label="Filter bookings by consultation status"
                            className="w-full h-11 appearance-none pl-9 pr-8 rounded-xl bg-white border border-[#d2d2d7] text-[13px] text-[#1d1d1f] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 cursor-pointer transition-all duration-150"
                          >
                            <option value="ALL">All Statuses</option>
                            <option value="WAITING">Waiting</option>
                            <option value="IN_CONSULTATION">In Consultation</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CANCELLED">Cancelled</option>
                            <option value="EXPIRED">Expired</option>
                            <option value="PENDING_APPROVAL">Pending Approval</option>
                          </select>
                          <Filter className="w-4 h-4 text-[#86868b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Date Quick Filter Segmented Control + Custom Date Picker */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[#e5e5ea]">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center p-1 bg-white rounded-full border border-[#e5e5ea]">
                          <button
                            type="button"
                            onClick={() => {
                              setBookingDateFilter('ALL');
                              setBookingCustomDate('');
                            }}
                            className={`h-8 px-3 rounded-full text-xs transition-all cursor-pointer ${
                              bookingDateFilter === 'ALL'
                                ? 'bg-[#f5f5f7] text-[#1d1d1f] font-semibold shadow-2xs border border-black/5'
                                : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
                            }`}
                          >
                            All Dates
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setBookingDateFilter('TODAY');
                              setBookingCustomDate('');
                            }}
                            className={`h-8 px-3 rounded-full text-xs transition-all cursor-pointer ${
                              bookingDateFilter === 'TODAY'
                                ? 'bg-[#f5f5f7] text-[#1d1d1f] font-semibold shadow-2xs border border-black/5'
                                : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
                            }`}
                          >
                            Today ({appointments.filter((a) => a.appointmentDate === todayStr).length})
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setBookingDateFilter('TOMORROW');
                              setBookingCustomDate('');
                            }}
                            className={`h-8 px-3 rounded-full text-xs transition-all cursor-pointer ${
                              bookingDateFilter === 'TOMORROW'
                                ? 'bg-[#f5f5f7] text-[#1d1d1f] font-semibold shadow-2xs border border-black/5'
                                : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
                            }`}
                          >
                            Tomorrow ({appointments.filter((a) => a.appointmentDate === tomorrowStr).length})
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setBookingDateFilter('PAST');
                              setBookingCustomDate('');
                            }}
                            className={`h-8 px-3 rounded-full text-xs transition-all cursor-pointer ${
                              bookingDateFilter === 'PAST'
                                ? 'bg-[#f5f5f7] text-[#1d1d1f] font-semibold shadow-2xs border border-black/5'
                                : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
                            }`}
                          >
                            Past History
                          </button>
                        </div>

                        {/* Custom Date Input */}
                        <div className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full bg-white border border-[#e5e5ea]">
                          <Calendar className="w-3.5 h-3.5 text-[#86868b]" />
                          <input
                            type="date"
                            value={bookingCustomDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBookingCustomDate(val);
                              setBookingDateFilter(val ? 'CUSTOM' : 'ALL');
                            }}
                            className={`text-xs bg-transparent focus:outline-none cursor-pointer ${
                              bookingDateFilter === 'CUSTOM'
                                ? 'text-[#0066cc] font-semibold'
                                : 'text-[#1d1d1f] font-medium'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Reset Filters CTA */}
                      {isAnyBookingFilterActive && (
                        <button
                          type="button"
                          onClick={handleResetBookingFilters}
                          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer active:scale-95"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset Filters</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Empty State */}
                  {filteredAppointments.length === 0 && (
                    <div className="py-12 text-center">
                      <h4 className="text-sm font-semibold text-[#1d1d1f]">No Bookings Found</h4>
                      <p className="text-xs text-[#86868b] mt-1 max-w-sm mx-auto">
                        No appointments match your active date ({bookingDateFilter !== 'ALL' ? bookingDateFilter : 'selected'}), clinic, or search filter.
                      </p>
                      <button
                        type="button"
                        onClick={handleResetBookingFilters}
                        className="mt-4 h-9 px-5 rounded-full text-xs font-semibold bg-[#0066cc] hover:bg-[#0071e3] text-white transition-all cursor-pointer active:scale-[0.98]"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  )}

                  {/* MODE 1: ALL RECORDS FLAT TABLE */}
                  {bookingViewMode === 'table' && filteredAppointments.length > 0 && (
                    <div className="overflow-x-auto mt-5">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-[#e5e5ea] text-[#86868b] font-semibold">
                          <tr>
                            <th className="py-3 px-3">Date</th>
                            <th className="py-3 px-3">Queue Token</th>
                            <th className="py-3 px-3">Patient</th>
                            <th className="py-3 px-3">Practitioner</th>
                            <th className="py-3 px-3">Clinic / Facility</th>
                            <th className="py-3 px-3">Status</th>
                            <th className="py-3 px-3">Est. Time</th>
                            <th className="py-3 px-3 text-right">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0f0f0]">
                          {filteredAppointments.map((appt) => {
                            const clinicInfo = resolveClinic(appt);
                            return (
                              <tr key={appt.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-[#1d1d1f]">{appt.appointmentDate}</span>
                                    {getDateBadge(appt.appointmentDate)}
                                  </div>
                                </td>
                                <td className="py-3 px-3 font-bold text-[#0066cc]">Queue #{appt.queueNumber}</td>
                                <td className="py-3 px-3">
                                  <div>
                                    <span className="font-medium text-[#1d1d1f]">
                                      {appt.patient?.user?.fullName || appt.patientName || 'Unknown Patient'}
                                    </span>
                                    {appt.isForOther && appt.patientName && (
                                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
                                        Family
                                      </span>
                                    )}
                                    <span className="text-[11px] text-[#86868b] block mt-0.5">
                                      {appt.patientPhone || appt.patient?.user?.phone || appt.patient?.user?.email || 'Walk-in'}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  <div>
                                    <span className="font-medium text-[#1d1d1f]">{appt.doctor?.user?.fullName || 'Practitioner'}</span>
                                    <span className="text-[11px] text-[#0066cc] block mt-0.5">
                                      {appt.doctor?.specialty || 'Specialist'}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-start gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-[#0066cc] shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-medium text-[#1d1d1f]">{clinicInfo.name}</span>
                                      {clinicInfo.city && (
                                        <span className="text-[10px] text-[#86868b] block mt-0.5">
                                          {clinicInfo.city}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-3">{renderAppointmentStatusBadge(appt.status)}</td>
                                <td className="py-3 px-3 text-[#86868b] font-medium">{appt.estimatedTime || 'N/A'}</td>
                                <td className="py-3 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedAppointment(appt)}
                                    className="p-1.5 rounded-full hover:bg-white text-[#0066cc] hover:text-[#0055b3] border border-transparent hover:border-[#e5e5ea] transition-all cursor-pointer"
                                    title="Inspect Booking Details"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* MODE 2: GROUPED BY DATE */}
                  {bookingViewMode === 'by-date' && filteredAppointments.length > 0 && (
                    <div className="space-y-6 mt-6">
                      {appointmentsByDate.map(([dateStr, items]) => {
                        const waitingCount = items.filter((i) => (i.status || '').toUpperCase() === 'WAITING').length;
                        const completedCount = items.filter((i) => (i.status || '').toUpperCase() === 'COMPLETED').length;

                        return (
                          <div
                            key={dateStr}
                            className="bg-white rounded-2xl border border-[#e5e5ea] overflow-hidden shadow-2xs"
                          >
                            {/* Date Group Header */}
                            <div className="px-4 py-3.5 bg-[#f5f5f7]/60 border-b border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-[#1d1d1f]">{formatDisplayDate(dateStr)}</h4>
                                  {getDateBadge(dateStr)}
                                  <span className="text-xs text-[#86868b]">({dateStr})</span>
                                </div>
                                <p className="text-[11px] text-[#86868b] mt-0.5">
                                  {items.length} booking{items.length !== 1 ? 's' : ''} scheduled • {waitingCount} waiting • {completedCount} completed
                                </p>
                              </div>

                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white border border-[#e5e5ea] text-[#1d1d1f] self-start sm:self-center">
                                {items.length} Token{items.length !== 1 ? 's' : ''}
                              </span>
                            </div>

                            {/* Date Appointments Table */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="border-b border-[#f0f0f2] text-[#86868b] font-semibold bg-[#fafafa]">
                                  <tr>
                                    <th className="py-2.5 px-3">Token #</th>
                                    <th className="py-2.5 px-3">Patient</th>
                                    <th className="py-2.5 px-3">Practitioner</th>
                                    <th className="py-2.5 px-3">Clinic Facility</th>
                                    <th className="py-2.5 px-3">Status</th>
                                    <th className="py-2.5 px-3">Est. Time</th>
                                    <th className="py-2.5 px-3 text-right">Details</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#f0f0f0]">
                                  {items.map((appt) => {
                                    const clinicInfo = resolveClinic(appt);
                                    return (
                                      <tr key={appt.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                                        <td className="py-3 px-3 font-bold text-[#0066cc]">Queue #{appt.queueNumber}</td>
                                        <td className="py-3 px-3">
                                          <div>
                                            <span className="font-medium text-[#1d1d1f]">
                                              {appt.patient?.user?.fullName || appt.patientName || 'Unknown Patient'}
                                            </span>
                                            {appt.isForOther && appt.patientName && (
                                              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
                                                Family
                                              </span>
                                            )}
                                            <span className="text-[11px] text-[#86868b] block mt-0.5">
                                              {appt.patientPhone || appt.patient?.user?.phone || appt.patient?.user?.email || 'Walk-in'}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="py-3 px-3">
                                          <div>
                                            <span className="font-medium text-[#1d1d1f]">{appt.doctor?.user?.fullName || 'Practitioner'}</span>
                                            <span className="text-[11px] text-[#0066cc] block mt-0.5">
                                              {appt.doctor?.specialty || 'Specialist'}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="py-3 px-3">
                                          <div className="flex items-start gap-1.5">
                                            <Building2 className="w-3.5 h-3.5 text-[#0066cc] shrink-0 mt-0.5" />
                                            <div>
                                              <span className="font-medium text-[#1d1d1f]">{clinicInfo.name}</span>
                                              {clinicInfo.city && (
                                                <span className="text-[10px] text-[#86868b] block mt-0.5">
                                                  {clinicInfo.city}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-3 px-3">{renderAppointmentStatusBadge(appt.status)}</td>
                                        <td className="py-3 px-3 text-[#86868b] font-medium">{appt.estimatedTime || 'N/A'}</td>
                                        <td className="py-3 px-3 text-right">
                                          <button
                                            type="button"
                                            onClick={() => setSelectedAppointment(appt)}
                                            className="p-1.5 rounded-full hover:bg-white text-[#0066cc] hover:text-[#0055b3] border border-transparent hover:border-[#e5e5ea] transition-all cursor-pointer"
                                            title="Inspect Booking Details"
                                          >
                                            <Eye className="w-4 h-4" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* MODE 3: GROUPED BY CLINIC */}
                  {bookingViewMode === 'by-clinic' && filteredAppointments.length > 0 && (
                    <div className="space-y-6 mt-6">
                      {appointmentsByClinic.map(({ clinicInfo, items }) => {
                        const doctorsInClinic = Array.from(new Set(items.map((i) => i.doctor?.user?.fullName).filter(Boolean)));
                        const waitingCount = items.filter((i) => (i.status || '').toUpperCase() === 'WAITING').length;
                        const completedCount = items.filter((i) => (i.status || '').toUpperCase() === 'COMPLETED').length;

                        return (
                          <div
                            key={clinicInfo.name}
                            className="bg-white rounded-2xl border border-[#e5e5ea] overflow-hidden shadow-2xs"
                          >
                            {/* Clinic Group Header */}
                            <div className="px-4 py-3.5 bg-[#f5f5f7]/60 border-b border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-[#1d1d1f]">{clinicInfo.name}</h4>
                                  {clinicInfo.city && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white border border-[#e5e5ea] text-[#86868b]">
                                      {clinicInfo.city}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[#86868b] mt-0.5">
                                  {items.length} total booking{items.length !== 1 ? 's' : ''} • {doctorsInClinic.length} doctor{doctorsInClinic.length !== 1 ? 's' : ''} ({doctorsInClinic.slice(0, 3).join(', ')}{doctorsInClinic.length > 3 ? '...' : ''})
                                </p>
                              </div>

                              <div className="flex items-center gap-2 self-start sm:self-center">
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white text-[#1d1d1f] border border-[#e5e5ea]">
                                  {waitingCount} Waiting
                                </span>
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
                                  {completedCount} Completed
                                </span>
                              </div>
                            </div>

                            {/* Clinic Appointments Table */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="border-b border-[#f0f0f2] text-[#86868b] font-semibold bg-[#fafafa]">
                                  <tr>
                                    <th className="py-2.5 px-3">Date</th>
                                    <th className="py-2.5 px-3">Token #</th>
                                    <th className="py-2.5 px-3">Patient</th>
                                    <th className="py-2.5 px-3">Practitioner</th>
                                    <th className="py-2.5 px-3">Status</th>
                                    <th className="py-2.5 px-3">Est. Time</th>
                                    <th className="py-2.5 px-3 text-right">Details</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#f0f0f0]">
                                  {items.map((appt) => (
                                    <tr key={appt.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                                      <td className="py-3 px-3">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold text-[#1d1d1f]">{appt.appointmentDate}</span>
                                          {getDateBadge(appt.appointmentDate)}
                                        </div>
                                      </td>
                                      <td className="py-3 px-3 font-bold text-[#0066cc]">Queue #{appt.queueNumber}</td>
                                      <td className="py-3 px-3">
                                        <div>
                                          <span className="font-medium text-[#1d1d1f]">
                                            {appt.patient?.user?.fullName || appt.patientName || 'Unknown Patient'}
                                          </span>
                                          {appt.isForOther && appt.patientName && (
                                            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
                                              Family
                                            </span>
                                          )}
                                          <span className="text-[11px] text-[#86868b] block mt-0.5">
                                            {appt.patientPhone || appt.patient?.user?.phone || appt.patient?.user?.email || 'Walk-in'}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="py-3 px-3">
                                        <div>
                                          <span className="font-medium text-[#1d1d1f]">{appt.doctor?.user?.fullName || 'Practitioner'}</span>
                                          <span className="text-[11px] text-[#0066cc] block mt-0.5">
                                            {appt.doctor?.specialty || 'Specialist'}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="py-3 px-3">{renderAppointmentStatusBadge(appt.status)}</td>
                                      <td className="py-3 px-3 text-[#86868b] font-medium">{appt.estimatedTime || 'N/A'}</td>
                                      <td className="py-3 px-3 text-right">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedAppointment(appt)}
                                          className="p-1.5 rounded-full hover:bg-white text-[#0066cc] hover:text-[#0055b3] border border-transparent hover:border-[#e5e5ea] transition-all cursor-pointer"
                                          title="Inspect Booking Details"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </UtilityCard>
              </div>
            )}

            {/* Tab 4: Contact Form Messages & Inquiries */}
            {activeTab === 'messages' && (
              <UtilityCard>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">User Contact Inquiries</h3>
                    <p className="text-[13px] text-[#86868b] mt-1 leading-relaxed">
                      Messages submitted by visitors, patients, doctors, or clinics via the Contact Us form.
                    </p>
                  </div>
                  <span className="text-xs text-[#86868b]">{contactMessages.length} Total</span>
                </div>

                {contactMessages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#86868b]">
                    No messages received yet. All new inquiries submitted through the website will appear here with instant email reply options.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {contactMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          msg.status === 'NEW'
                            ? 'bg-[#0066cc]/[0.02] border-[#0066cc]/30 shadow-2xs'
                            : 'bg-white border-[#e5e5ea]'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#f0f0f2]">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center font-bold text-xs text-[#1d1d1f]">
                              {msg.fullName ? msg.fullName[0]?.toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-[#1d1d1f]">{msg.fullName}</span>
                                {msg.status === 'NEW' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
                                    New
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f5f5f7] text-[#86868b]">
                                    Read
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-[#86868b] mt-0.5">
                                <a href={`mailto:${msg.email}`} className="text-[#0066cc] hover:underline">
                                  {msg.email}
                                </a>
                                {msg.phone && <span>• {msg.phone}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <span className="text-[11px] text-[#86868b]">
                              {new Date(msg.createdAt).toLocaleDateString()} {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {msg.status === 'NEW' && (
                              <button
                                onClick={() => handleMarkMessageRead(msg.id)}
                                className="px-3 py-1 rounded-full text-xs font-medium border border-[#e5e5ea] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] cursor-pointer transition-all"
                              >
                                Mark Read
                              </button>
                            )}
                            <a
                              href={`mailto:${msg.email}?subject=Re: ${encodeURIComponent(msg.subject)}`}
                              className="px-3.5 py-1 rounded-full text-xs font-semibold bg-[#0066cc] hover:bg-[#0071e3] text-white cursor-pointer transition-all"
                            >
                              Reply Email
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteContactMessage(msg.id)}
                              className="p-1.5 rounded-full text-[#86868b] hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                              title="Delete Message"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3">
                          <p className="text-xs font-semibold text-[#1d1d1f]">Subject: {msg.subject}</p>
                          <p className="text-xs text-[#48484a] mt-1 whitespace-pre-wrap leading-relaxed">
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </UtilityCard>
            )}
        </>
        )}
      </div>

      {/* Doctor Verification Credentials Inspection Modal */}
      {selectedDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[28px] border border-[#e5e5ea] max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex items-center justify-center font-bold text-lg text-[#0066cc]">
                  {selectedDoctor.user.avatarUrl ? (
                    <img src={getFileUrl(selectedDoctor.user.avatarUrl)} alt={selectedDoctor.user.fullName} className="w-full h-full object-cover" />
                  ) : (
                    selectedDoctor.user.fullName[0]
                  )}
                </div>
                <div>
                  <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">{selectedDoctor.user.fullName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-[#0066cc] font-medium">{selectedDoctor.specialty}</p>
                    {renderStatusBadge(getPractitionerStatus(selectedDoctor))}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedDoctor(null)}
                className="p-1.5 rounded-full hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] active:scale-95 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]">
                <div>
                  <span className="text-[#86868b] block">Qualifications</span>
                  <strong className="text-[#1d1d1f] mt-0.5 block">{formatDoctorDegrees(selectedDoctor.qualifications)}</strong>
                </div>
                <div>
                  <span className="text-[#86868b] block">Experience</span>
                  <strong className="text-[#1d1d1f] mt-0.5 block">{selectedDoctor.experienceYears} Years</strong>
                </div>
                <div>
                  <span className="text-[#86868b] block">Consultation Fee</span>
                  <strong className="text-[#1d1d1f] mt-0.5 block">₹{selectedDoctor.consultationFee}</strong>
                </div>
                <div>
                  <span className="text-[#86868b] block">Checking Window</span>
                  <strong className="text-[#0066cc] mt-0.5 block">
                    {selectedDoctor.checkingStartTime ? `${format12Hour(selectedDoctor.checkingStartTime)} – ${format12Hour(selectedDoctor.checkingEndTime)}` : 'Flexible'}
                  </strong>
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">Clinic Address / Base</span>
                <p className="text-[#1d1d1f] p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]">
                  {selectedDoctor.clinicAddress || 'MediArca Direct Outpatient Practice'}
                </p>
              </div>

              <div>
                <span className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Affiliated Clinical Facilities ({selectedDoctor.clinics?.length || 0})
                </span>
                {selectedDoctor.clinics && selectedDoctor.clinics.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedDoctor.clinics.map((cAff) => (
                      <div
                        key={cAff.id || cAff.clinicId}
                        className="p-2.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-between"
                      >
                        <div>
                          <strong className="text-[#1d1d1f] block font-medium">
                            {cAff.clinic?.clinicName || 'Clinical Facility'}
                          </strong>
                          <span className="text-[11px] text-[#86868b] block">
                            {cAff.clinic?.address || ''}{cAff.clinic?.city ? `, ${cAff.clinic.city}` : ''}
                          </span>
                        </div>
                        {cAff.clinic?.phone && (
                          <span className="text-[11px] text-[#86868b] font-medium">{cAff.clinic.phone}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#86868b] p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs">
                    {selectedDoctor.clinicAddress ? `Primary: ${selectedDoctor.clinicAddress}` : 'No multi-clinic affiliations recorded yet.'}
                  </p>
                )}
              </div>

              <div>
                <span className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">Professional Bio & Practice Philosophy</span>
                <p className="text-[#1d1d1f] p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] leading-relaxed">
                  {selectedDoctor.bio || 'Dedicated medical practitioner accepting outpatient consultations.'}
                </p>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[#86868b]">Email: {selectedDoctor.user.email}</span>
                <span className="text-[#86868b]">Phone: {selectedDoctor.user.phone || 'N/A'}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#f0f0f2] flex items-center justify-between">
              <AppleButton variant="ghost" size="sm" onClick={() => setSelectedDoctor(null)}>
                Close
              </AppleButton>
              <div className="flex items-center gap-2">
                {getPractitionerStatus(selectedDoctor) === 'VERIFIED' && (
                  <AppleButton
                    variant="ghost"
                    size="sm"
                    disabled={actionId === selectedDoctor.id}
                    onClick={async () => {
                      const ok = await handleVerify(selectedDoctor.id, 'SUSPENDED');
                      if (ok) setSelectedDoctor(null);
                    }}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200"
                  >
                    <Ban className="w-3.5 h-3.5 mr-1" />
                    Suspend Credentials
                  </AppleButton>
                )}
                {getPractitionerStatus(selectedDoctor) === 'SUSPENDED' && (
                  <AppleButton
                    variant="primary"
                    size="sm"
                    disabled={actionId === selectedDoctor.id}
                    onClick={async () => {
                      const ok = await handleVerify(selectedDoctor.id, 'VERIFIED');
                      if (ok) setSelectedDoctor(null);
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Re-activate Practitioner
                  </AppleButton>
                )}
                {getPractitionerStatus(selectedDoctor) === 'REJECTED' && (
                  <AppleButton
                    variant="primary"
                    size="sm"
                    disabled={actionId === selectedDoctor.id}
                    onClick={async () => {
                      const ok = await handleVerify(selectedDoctor.id, 'VERIFIED');
                      if (ok) setSelectedDoctor(null);
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Re-evaluate & Approve
                  </AppleButton>
                )}
                {getPractitionerStatus(selectedDoctor) === 'PENDING' && (
                  <>
                    <AppleButton
                      variant="ghost"
                      size="sm"
                      disabled={actionId === selectedDoctor.id}
                      onClick={async () => {
                        const ok = await handleVerify(selectedDoctor.id, 'REJECTED');
                        if (ok) setSelectedDoctor(null);
                      }}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Reject Application
                    </AppleButton>
                    <AppleButton
                      variant="primary"
                      size="sm"
                      disabled={actionId === selectedDoctor.id}
                      onClick={async () => {
                        const ok = await handleVerify(selectedDoctor.id, 'VERIFIED');
                        if (ok) setSelectedDoctor(null);
                      }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      {actionId === selectedDoctor.id ? 'Approving...' : 'Approve & Verify License'}
                    </AppleButton>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clinic Facility Inspection & Verification Modal */}
      {selectedClinic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[28px] border border-[#e5e5ea] max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">{selectedClinic.clinicName}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[13px] text-[#86868b]">Clinical Healthcare Facility Verification</p>
                  {renderStatusBadge(getPractitionerStatus(selectedClinic))}
                </div>
              </div>
              <button
                onClick={() => setSelectedClinic(null)}
                className="p-1.5 rounded-full hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] active:scale-95 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-[#1d1d1f]">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea]">
                <div>
                  <span className="text-xs font-medium text-[#86868b] block">Facility Address</span>
                  <p className="font-medium mt-0.5">{selectedClinic.address}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-[#86868b] block">City & State</span>
                  <p className="font-medium mt-0.5">{selectedClinic.city || 'Not Specified'}{selectedClinic.state ? `, ${selectedClinic.state}` : ''}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 p-3.5 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] text-center">
                <div>
                  <span className="text-xs font-medium text-[#86868b] block">Doctors</span>
                  <p className="text-base font-semibold text-[#1d1d1f] mt-0.5">
                    {selectedClinic._count?.doctors ?? selectedClinic.doctorsCount ?? 0}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-[#86868b] block">Receptionists</span>
                  <p className="text-base font-semibold text-[#0066cc] mt-0.5">
                    {selectedClinic._count?.receptionists ?? selectedClinic.receptionistsCount ?? 0}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-[#86868b] block">Bookings</span>
                  <p className="text-base font-semibold text-[#1d1d1f] mt-0.5">
                    {selectedClinic._count?.appointments ?? selectedClinic.appointmentsCount ?? 0}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-white border border-[#e5e5ea] rounded-xl space-y-2">
                <span className="text-xs font-semibold text-[#1d1d1f] block">
                  Affiliated Practitioners ({selectedClinic.doctors?.length || 0})
                </span>
                {selectedClinic.doctors && selectedClinic.doctors.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedClinic.doctors.map((dAff: any) => (
                      <div
                        key={dAff.id || dAff.doctor?.id}
                        className="p-2 rounded-lg bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-[#1d1d1f] block">
                            {dAff.doctor?.user?.fullName || 'Practitioner'}
                          </span>
                          <span className="text-[11px] text-[#0066cc]">
                            {dAff.doctor?.specialty || 'General Practitioner'}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#86868b]">{dAff.doctor?.user?.email}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#86868b]">No practitioner affiliations recorded yet.</p>
                )}
              </div>

              <div className="p-3.5 bg-white border border-[#e5e5ea] rounded-xl space-y-2">
                <span className="text-xs font-semibold text-[#1d1d1f] block">Primary Administrative Contact</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Admin Full Name</span>
                    <span className="font-medium mt-0.5 block">{selectedClinic.user?.fullName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Direct Email</span>
                    <span className="font-medium text-[#1d1d1f] mt-0.5 block">{selectedClinic.user?.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Facility Phone</span>
                    <span className="mt-0.5 block">{selectedClinic.phone || selectedClinic.user?.phone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Registration Date</span>
                    <span className="mt-0.5 block">{selectedClinic.createdAt ? new Date(selectedClinic.createdAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7]">
                <span className="text-[#86868b] font-medium">Platform Verification State</span>
                {renderStatusBadge(getPractitionerStatus(selectedClinic))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#f0f0f2] flex items-center justify-between">
              <AppleButton variant="ghost" size="sm" onClick={() => setSelectedClinic(null)}>
                Close
              </AppleButton>
              <div className="flex items-center gap-2">
                {getPractitionerStatus(selectedClinic) === 'VERIFIED' && (
                  <AppleButton
                    variant="ghost"
                    size="sm"
                    disabled={clinicActionId === selectedClinic.id}
                    onClick={async () => {
                      const ok = await handleVerifyClinic(selectedClinic.id, 'SUSPENDED');
                      if (ok) setSelectedClinic(null);
                    }}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200"
                  >
                    <Ban className="w-3.5 h-3.5 mr-1" />
                    Suspend Verification
                  </AppleButton>
                )}
                {getPractitionerStatus(selectedClinic) === 'SUSPENDED' && (
                  <AppleButton
                    variant="primary"
                    size="sm"
                    disabled={clinicActionId === selectedClinic.id}
                    onClick={async () => {
                      const ok = await handleVerifyClinic(selectedClinic.id, 'VERIFIED');
                      if (ok) setSelectedClinic(null);
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Re-activate Facility
                  </AppleButton>
                )}
                {getPractitionerStatus(selectedClinic) === 'REJECTED' && (
                  <AppleButton
                    variant="primary"
                    size="sm"
                    disabled={clinicActionId === selectedClinic.id}
                    onClick={async () => {
                      const ok = await handleVerifyClinic(selectedClinic.id, 'VERIFIED');
                      if (ok) setSelectedClinic(null);
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Re-evaluate & Approve
                  </AppleButton>
                )}
                {getPractitionerStatus(selectedClinic) === 'PENDING' && (
                  <>
                    <AppleButton
                      variant="ghost"
                      size="sm"
                      disabled={clinicActionId === selectedClinic.id}
                      onClick={async () => {
                        const ok = await handleVerifyClinic(selectedClinic.id, 'REJECTED');
                        if (ok) setSelectedClinic(null);
                      }}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Reject Application
                    </AppleButton>
                    <AppleButton
                      variant="primary"
                      size="sm"
                      disabled={clinicActionId === selectedClinic.id}
                      onClick={async () => {
                        const ok = await handleVerifyClinic(selectedClinic.id, 'VERIFIED');
                        if (ok) setSelectedClinic(null);
                      }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      {clinicActionId === selectedClinic.id ? 'Approving...' : 'Approve Facility'}
                    </AppleButton>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Platform Booking Inspection Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[28px] border border-[#e5e5ea] max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">Queue Token #{selectedAppointment.queueNumber}</h3>
                  {renderAppointmentStatusBadge(selectedAppointment.status)}
                </div>
                <p className="text-[13px] text-[#86868b] mt-1">
                  {formatDisplayDate(selectedAppointment.appointmentDate)} • {selectedAppointment.estimatedTime || 'Estimated Time N/A'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="p-1.5 rounded-full hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] active:scale-95 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#1d1d1f]">
              {/* Patient Block */}
              <div className="p-3.5 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] space-y-2">
                <span className="text-xs font-semibold text-[#1d1d1f] block">Patient Information</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Patient Name</span>
                    <strong className="text-[#1d1d1f] mt-0.5 block">
                      {selectedAppointment.patient?.user?.fullName || selectedAppointment.patientName || 'Walk-in Patient'}
                    </strong>
                    {selectedAppointment.isForOther && (
                      <span className="text-[11px] text-[#86868b] font-medium">(Family Member)</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Contact Phone</span>
                    <span className="font-medium text-[#1d1d1f] mt-0.5 block">
                      {selectedAppointment.patientPhone || selectedAppointment.patient?.user?.phone || 'Not Provided'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Email Address</span>
                    <span className="font-medium text-[#1d1d1f] truncate block mt-0.5">
                      {selectedAppointment.patient?.user?.email || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Arrival Status</span>
                    <span className="font-medium text-[#1d1d1f] mt-0.5 block">
                      {selectedAppointment.isCheckedIn ? 'Checked-in at Desk' : 'Not Checked-in'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Doctor & Clinic Block */}
              <div className="p-3.5 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] space-y-2">
                <span className="text-xs font-semibold text-[#1d1d1f] block">Clinical Facility & Practitioner</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Attending Practitioner</span>
                    <strong className="text-[#1d1d1f] mt-0.5 block">{selectedAppointment.doctor?.user?.fullName || 'Practitioner'}</strong>
                    <span className="text-[11px] text-[#0066cc] block">{selectedAppointment.doctor?.specialty}</span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[11px]">Facility Name</span>
                    <strong className="text-[#1d1d1f] mt-0.5 block">{resolveClinic(selectedAppointment).name}</strong>
                    {resolveClinic(selectedAppointment).city && (
                      <span className="text-[11px] text-[#86868b] block">{resolveClinic(selectedAppointment).city}</span>
                    )}
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#86868b] block text-[11px]">Shift / Window</span>
                    <span className="text-[#1d1d1f] font-medium mt-0.5 block">{selectedAppointment.checkingWindow || 'Default Clinical Shift'}</span>
                  </div>
                </div>
              </div>

              {/* Clinical Notes / Reason */}
              {(selectedAppointment.reasonForVisit || selectedAppointment.symptoms) && (
                <div className="p-3.5 bg-white border border-[#e5e5ea] rounded-xl space-y-1">
                  <span className="text-xs font-semibold text-[#1d1d1f] block">Reason for Visit / Symptoms</span>
                  <p className="text-xs text-[#48484a] leading-relaxed">
                    {selectedAppointment.reasonForVisit || selectedAppointment.symptoms}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#f0f0f2] flex justify-end">
              <AppleButton variant="ghost" size="sm" onClick={() => setSelectedAppointment(null)}>
                Close
              </AppleButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
