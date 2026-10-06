import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { api, Doctor, format12Hour, getFileUrl, formatDoctorDegrees, ContactMessageItem } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  Users,
  ShieldCheck,
  Shield,
  Calendar,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Clock,
  X,
  Building2,
  Ban,
  XCircle,
  Globe,
  LogOut,
  Mail,
  Filter,
  Search,
  CalendarDays,
  Layers,
  Eye,
  RotateCcw,
  ChevronDown,
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

  // Platform Bookings Organization State
  const [bookingDateFilter, setBookingDateFilter] = useState<'ALL' | 'TODAY' | 'TOMORROW' | 'PAST' | 'CUSTOM'>('ALL');
  const [bookingCustomDate, setBookingCustomDate] = useState<string>('');
  const [bookingClinicFilter, setBookingClinicFilter] = useState<string>('ALL');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('ALL');
  const [bookingSearchQuery, setBookingSearchQuery] = useState<string>('');
  const [bookingViewMode, setBookingViewMode] = useState<'table' | 'by-date' | 'by-clinic'>('table');
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);

  const getTodayDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTomorrowDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#0066cc] border border-blue-200">
          Today
        </span>
      );
    }
    if (dateStr === tomorrowStr) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          Tomorrow
        </span>
      );
    }
    if (dateStr < todayStr) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
          Past
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        Upcoming
      </span>
    );
  };

  const renderAppointmentStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'WAITING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Waiting
          </span>
        );
      case 'IN_CONSULTATION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-[#0066cc] border border-blue-200 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0066cc]"></span>
            In Consultation
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
            <Clock className="w-3 h-3 text-gray-500" />
            Expired
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending Approval
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700">
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

  const getPractitionerStatus = (
    doc: { verificationStatus?: string; isVerified?: boolean } | null | undefined
  ): 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | 'PENDING' => {
    if (!doc) return 'PENDING';
    if (doc.verificationStatus) {
      const s = doc.verificationStatus.toUpperCase();
      if (s === 'VERIFIED' || s === 'SUSPENDED' || s === 'REJECTED' || s === 'PENDING') return s as any;
    }
    return doc.isVerified ? 'VERIFIED' : 'PENDING';
  };

  const renderStatusBadge = (status: 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | 'PENDING') => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-200">
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
          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full text-xs font-semibold border border-gray-300">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-xs font-semibold border border-amber-200 animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            Pending Review
          </span>
        );
    }
  };

  const handleVerifyClinic = async (
    clinicId: string,
    action: 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | boolean
  ) => {
    setClinicActionId(clinicId);
    try {
      await api.verifyClinic(clinicId, action);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Clinic verification update failed');
    } finally {
      setClinicActionId(null);
    }
  };

  const handleVerify = async (
    doctorId: string,
    action: 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | boolean
  ) => {
    setActionId(doctorId);
    try {
      await api.verifyDoctor(doctorId, action);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Verification update failed');
    } finally {
      setActionId(null);
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
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20 text-[11px] font-mono font-semibold">
              <Shield className="w-3 h-3 text-amber-600" />
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

            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#f5f5f7] text-[11px] text-[#48484a]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
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
            <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
              Admin Dashboard
            </h1>
            <p className="text-xs text-[#86868b] mt-0.5 font-normal">
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
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-[#86868b] uppercase font-semibold">Patients</span>
                    <h3 className="text-3xl font-semibold text-[#1d1d1f] mt-1">{stats?.totalPatients || 0}</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
              </UtilityCard>

              <UtilityCard>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-[#86868b] uppercase font-semibold">Doctors</span>
                    <h3 className="text-3xl font-semibold text-[#1d1d1f] mt-1">{stats?.totalDoctors || 0}</h3>
                    <p className="text-[10px] text-amber-600 font-medium mt-0.5">{stats?.pendingDoctors || 0} pending review</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                </div>
              </UtilityCard>

              <UtilityCard>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-[#86868b] uppercase font-semibold">Clinics</span>
                    <h3 className="text-3xl font-semibold text-[#1d1d1f] mt-1">{stats?.totalClinics || clinics.length}</h3>
                    <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                      {clinics.filter((c) => getPractitionerStatus(c) === 'PENDING').length} pending review
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                </div>
              </UtilityCard>

              <UtilityCard>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-[#86868b] uppercase font-semibold">Pending Review</span>
                    <h3 className="text-3xl font-semibold text-amber-600 mt-1">
                      {doctors.filter((d) => getPractitionerStatus(d) === 'PENDING').length +
                        clinics.filter((c) => getPractitionerStatus(c) === 'PENDING').length}
                    </h3>
                    <p className="text-[10px] text-[#86868b] mt-0.5">Docs & Clinics</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                </div>
              </UtilityCard>

              <UtilityCard>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-[#86868b] uppercase font-semibold">Total Bookings</span>
                    <h3 className="text-3xl font-semibold text-[#1d1d1f] mt-1">{stats?.totalAppointments || 0}</h3>
                    <p className="text-[10px] text-purple-600 font-medium mt-0.5">{stats?.todayAppointments || 0} today</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>
              </UtilityCard>
            </div>

            {/* Verification Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-[#e5e5ea] pb-4 overflow-x-auto scrollbar-none">
              <div className="inline-flex p-1 bg-[#f5f5f7] rounded-full border border-[#e5e5ea] shadow-xs whitespace-nowrap">
                <button
                  onClick={() => setActiveTab('doctors')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                    activeTab === 'doctors'
                      ? 'bg-white text-[#1d1d1f] shadow-xs'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-[#0066cc]" />
                  <span>Doctor Verification</span>
                  {doctors.filter((d) => getPractitionerStatus(d) === 'PENDING').length > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
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
                      ? 'bg-white text-[#1d1d1f] shadow-xs'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span>Clinic Verification</span>
                  {clinics.filter((c) => getPractitionerStatus(c) === 'PENDING').length > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse">
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
                      ? 'bg-white text-[#1d1d1f] shadow-xs'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <span>Platform Bookings ({appointments.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('messages')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                    activeTab === 'messages'
                      ? 'bg-white text-[#1d1d1f] shadow-xs'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  <Mail className="w-4 h-4 text-emerald-600" />
                  <span>Contact Inquiries</span>
                  {contactMessages.filter((m) => m.status === 'NEW').length > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
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
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1d1d1f]">Practitioner Verification Queue</h3>
                    <p className="text-xs text-[#86868b] mt-0.5">
                      Doctors must be verified by admin before appearing in patient searches.
                    </p>
                  </div>
                  <span className="text-xs text-[#86868b]">{doctors.length} Registered Doctor(s)</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#e5e5ea] text-[#86868b] uppercase tracking-wider font-semibold">
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
                      {doctors.map((doc) => (
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
                                  className="text-xs bg-[#10b981] hover:bg-[#059669] text-white shadow-2xs font-medium"
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
                                  className="text-[#0066cc] hover:text-[#0284c7] text-xs"
                                >
                                  {actionId === doc.id ? 'Updating...' : 'Approve & Verify'}
                                </AppleButton>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </UtilityCard>
            )}

            {/* Tab 2: Clinic Verification Portal */}
            {activeTab === 'clinics' && (
              <UtilityCard>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1d1d1f]">Clinic Facility Verification Queue</h3>
                    <p className="text-xs text-[#86868b] mt-0.5">
                      Clinics must be verified by MediArca administration before appearing in patient searches or doctor affiliation lists.
                    </p>
                  </div>
                  <span className="text-xs text-[#86868b]">{clinics.length} Registered Clinic(s)</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#e5e5ea] text-[#86868b] uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-3 px-3">Facility</th>
                        <th className="py-3 px-3">Location</th>
                        <th className="py-3 px-3">Capacity & Team</th>
                        <th className="py-3 px-3">Verification Status</th>
                        <th className="py-3 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f0]">
                      {clinics.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-xs text-[#86868b]">
                            No clinical facilities registered on the platform yet.
                          </td>
                        </tr>
                      ) : (
                        clinics.map((c) => (
                          <tr key={c.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 font-semibold">
                                  <Building2 className="w-4 h-4" />
                                </div>
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
                                    className="text-xs bg-[#10b981] hover:bg-[#059669] text-white shadow-2xs font-medium"
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
                                    className="text-[#0066cc] hover:text-[#0284c7] text-xs"
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
                        <h3 className="text-lg font-bold text-[#1d1d1f] tracking-tight">Platform Bookings & Queue Oversight</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f]">
                          {filteredAppointments.length} of {appointments.length} Total
                        </span>
                      </div>
                      <p className="text-xs text-[#86868b] mt-1">
                        Audit trail of queue tokens, consultation flows, and schedules organized by dates and clinical facilities.
                      </p>
                    </div>

                    {/* View Mode Segmented Controls */}
                    <div className="inline-flex items-center p-1 bg-[#f5f5f7] rounded-full border border-[#e5e5ea] self-start lg:self-auto shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setBookingViewMode('table')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          bookingViewMode === 'table'
                            ? 'bg-white text-[#1d1d1f] shadow-xs font-semibold'
                            : 'text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                        title="View flat table of all matching bookings"
                      >
                        <Layers className="w-3.5 h-3.5 text-[#0066cc]" />
                        <span>All Records</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBookingViewMode('by-date')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          bookingViewMode === 'by-date'
                            ? 'bg-white text-[#1d1d1f] shadow-xs font-semibold'
                            : 'text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                        title="Group bookings chronologically by date"
                      >
                        <CalendarDays className="w-3.5 h-3.5 text-purple-600" />
                        <span>Organize by Date</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBookingViewMode('by-clinic')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          bookingViewMode === 'by-clinic'
                            ? 'bg-white text-[#1d1d1f] shadow-xs font-semibold'
                            : 'text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                        title="Group bookings by clinic facility"
                      >
                        <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Organize by Clinic</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Counters Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 my-5">
                    <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-center">
                      <span className="text-[10px] text-[#86868b] uppercase font-semibold block">Total Shown</span>
                      <strong className="text-lg font-bold text-[#1d1d1f] mt-0.5 block">{filteredAppointments.length}</strong>
                    </div>

                    <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/60 text-center">
                      <span className="text-[10px] text-blue-700 uppercase font-semibold block">Today's Visits</span>
                      <strong className="text-lg font-bold text-[#0066cc] mt-0.5 block">
                        {filteredAppointments.filter((a) => a.appointmentDate === todayStr).length}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-center">
                      <span className="text-[10px] text-amber-800 uppercase font-semibold block">Waiting</span>
                      <strong className="text-lg font-bold text-amber-700 mt-0.5 block">
                        {filteredAppointments.filter((a) => (a.status || '').toUpperCase() === 'WAITING').length}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-center">
                      <span className="text-[10px] text-indigo-800 uppercase font-semibold block">In Cabin</span>
                      <strong className="text-lg font-bold text-indigo-600 mt-0.5 block">
                        {filteredAppointments.filter((a) => (a.status || '').toUpperCase() === 'IN_CONSULTATION').length}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-center">
                      <span className="text-[10px] text-emerald-800 uppercase font-semibold block">Completed</span>
                      <strong className="text-lg font-bold text-emerald-700 mt-0.5 block">
                        {filteredAppointments.filter((a) => (a.status || '').toUpperCase() === 'COMPLETED').length}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 text-center">
                      <span className="text-[10px] text-rose-800 uppercase font-semibold block">Cancelled/Off</span>
                      <strong className="text-lg font-bold text-rose-600 mt-0.5 block">
                        {filteredAppointments.filter((a) => ['CANCELLED', 'EXPIRED'].includes((a.status || '').toUpperCase())).length}
                      </strong>
                    </div>
                  </div>

                  {/* Interactive Filter Control Panel (Date, Clinic, Status, Search) */}
                  <div className="p-4 rounded-2xl bg-[#fafafc] border border-[#e5e5ea] space-y-3.5">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                      {/* Search Bar */}
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={bookingSearchQuery}
                          onChange={(e) => setBookingSearchQuery(e.target.value)}
                          placeholder="Search patient, practitioner, clinic, token #..."
                          className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-white border border-[#e5e5ea] text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] transition-all"
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
                            className="w-full appearance-none pl-8 pr-7 py-2 text-xs rounded-xl bg-white border border-[#e5e5ea] text-[#1d1d1f] font-medium focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] cursor-pointer transition-all"
                          >
                            <option value="ALL">🏥 All Clinics ({appointments.length})</option>
                            {clinicFilterOptions.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name} ({c.count})
                              </option>
                            ))}
                          </select>
                          <Building2 className="w-3.5 h-3.5 text-[#86868b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <ChevronDown className="w-3.5 h-3.5 text-[#86868b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {/* Status Filter Selector */}
                        <div className="relative min-w-[140px]">
                          <select
                            value={bookingStatusFilter}
                            onChange={(e) => setBookingStatusFilter(e.target.value)}
                            aria-label="Filter bookings by consultation status"
                            className="w-full appearance-none pl-8 pr-7 py-2 text-xs rounded-xl bg-white border border-[#e5e5ea] text-[#1d1d1f] font-medium focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] cursor-pointer transition-all"
                          >
                            <option value="ALL">All Statuses</option>
                            <option value="WAITING">Waiting</option>
                            <option value="IN_CONSULTATION">In Consultation</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CANCELLED">Cancelled</option>
                            <option value="EXPIRED">Expired</option>
                            <option value="PENDING_APPROVAL">Pending Approval</option>
                          </select>
                          <Filter className="w-3.5 h-3.5 text-[#86868b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <ChevronDown className="w-3.5 h-3.5 text-[#86868b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Date Quick Filter Pills + Custom Date Picker */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[#f0f0f2]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-[#86868b] mr-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#0066cc]" />
                          Date:
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setBookingDateFilter('ALL');
                            setBookingCustomDate('');
                          }}
                          className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                            bookingDateFilter === 'ALL'
                              ? 'bg-[#1d1d1f] text-white font-semibold shadow-xs'
                              : 'bg-white border border-[#e5e5ea] text-[#48484a] hover:bg-[#f5f5f7]'
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
                          className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                            bookingDateFilter === 'TODAY'
                              ? 'bg-[#0066cc] text-white font-semibold shadow-xs'
                              : 'bg-white border border-[#e5e5ea] text-[#48484a] hover:bg-[#f5f5f7]'
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
                          className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                            bookingDateFilter === 'TOMORROW'
                              ? 'bg-purple-600 text-white font-semibold shadow-xs'
                              : 'bg-white border border-[#e5e5ea] text-[#48484a] hover:bg-[#f5f5f7]'
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
                          className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                            bookingDateFilter === 'PAST'
                              ? 'bg-gray-700 text-white font-semibold shadow-xs'
                              : 'bg-white border border-[#e5e5ea] text-[#48484a] hover:bg-[#f5f5f7]'
                          }`}
                        >
                          Past History
                        </button>

                        {/* Custom Date Input */}
                        <div className="inline-flex items-center gap-1.5 ml-1 pl-2 border-l border-[#e5e5ea]">
                          <span className="text-[10px] text-[#86868b] font-medium">Specific:</span>
                          <input
                            type="date"
                            value={bookingCustomDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBookingCustomDate(val);
                              setBookingDateFilter(val ? 'CUSTOM' : 'ALL');
                            }}
                            className={`px-2.5 py-1 text-xs rounded-lg border transition-all cursor-pointer ${
                              bookingDateFilter === 'CUSTOM'
                                ? 'bg-blue-50 border-[#0066cc] text-[#0066cc] font-semibold'
                                : 'bg-white border-[#e5e5ea] text-[#1d1d1f]'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Reset Filters CTA */}
                      {isAnyBookingFilterActive && (
                        <button
                          type="button"
                          onClick={handleResetBookingFilters}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer active:scale-95"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset Filters</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Empty State */}
                  {filteredAppointments.length === 0 && (
                    <div className="p-12 text-center my-6 rounded-2xl border border-dashed border-[#e5e5ea] bg-white">
                      <div className="w-12 h-12 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center mx-auto mb-3 text-[#86868b]">
                        <Calendar className="w-6 h-6 text-[#86868b]" />
                      </div>
                      <h4 className="text-sm font-semibold text-[#1d1d1f]">No Bookings Found</h4>
                      <p className="text-xs text-[#86868b] mt-1 max-w-sm mx-auto">
                        No appointments match your active date ({bookingDateFilter !== 'ALL' ? bookingDateFilter : 'selected'}), clinic, or search filter.
                      </p>
                      <button
                        type="button"
                        onClick={handleResetBookingFilters}
                        className="mt-4 px-4 py-1.5 rounded-full text-xs font-semibold bg-[#1d1d1f] hover:bg-black text-white transition-all cursor-pointer"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  )}

                  {/* MODE 1: ALL RECORDS FLAT TABLE */}
                  {bookingViewMode === 'table' && filteredAppointments.length > 0 && (
                    <div className="overflow-x-auto mt-5">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-[#e5e5ea] text-[#86868b] uppercase tracking-wider font-semibold">
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
                                      <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                        Family
                                      </span>
                                    )}
                                    <span className="text-[11px] text-[#86868b] block mt-0.5">
                                      {appt.patient?.user?.phone || appt.patient?.user?.email || 'Walk-in'}
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
                                    <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
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
                            <div className="px-4 py-3.5 bg-[#fbfbfd] border-b border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                                  <CalendarDays className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-[#1d1d1f]">{formatDisplayDate(dateStr)}</h4>
                                    {getDateBadge(dateStr)}
                                    <span className="text-xs font-mono text-[#86868b]">({dateStr})</span>
                                  </div>
                                  <p className="text-[11px] text-[#86868b] mt-0.5">
                                    {items.length} booking{items.length !== 1 ? 's' : ''} scheduled • {waitingCount} waiting • {completedCount} completed
                                  </p>
                                </div>
                              </div>

                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white border border-[#e5e5ea] text-[#1d1d1f] self-start sm:self-center">
                                {items.length} Token{items.length !== 1 ? 's' : ''}
                              </span>
                            </div>

                            {/* Date Appointments Table */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="border-b border-[#f0f0f2] text-[#86868b] uppercase tracking-wider font-semibold bg-[#fafafa]">
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
                                              <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                                Family
                                              </span>
                                            )}
                                            <span className="text-[11px] text-[#86868b] block mt-0.5">
                                              {appt.patient?.user?.phone || appt.patient?.user?.email || 'Walk-in'}
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
                                            <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
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
                            <div className="px-4 py-3.5 bg-[#fbfbfd] border-b border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                  <Building2 className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-[#1d1d1f]">{clinicInfo.name}</h4>
                                    {clinicInfo.city && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700">
                                        {clinicInfo.city}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-[#86868b] mt-0.5">
                                    {items.length} total booking{items.length !== 1 ? 's' : ''} • {doctorsInClinic.length} doctor{doctorsInClinic.length !== 1 ? 's' : ''} ({doctorsInClinic.slice(0, 3).join(', ')}{doctorsInClinic.length > 3 ? '...' : ''})
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-start sm:self-center">
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                  {waitingCount} Waiting
                                </span>
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  {completedCount} Completed
                                </span>
                              </div>
                            </div>

                            {/* Clinic Appointments Table */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="border-b border-[#f0f0f2] text-[#86868b] uppercase tracking-wider font-semibold bg-[#fafafa]">
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
                                            <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                              Family
                                            </span>
                                          )}
                                          <span className="text-[11px] text-[#86868b] block mt-0.5">
                                            {appt.patient?.user?.phone || appt.patient?.user?.email || 'Walk-in'}
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
                    <h3 className="text-lg font-semibold text-[#1d1d1f]">User Contact Inquiries</h3>
                    <p className="text-xs text-[#86868b] mt-0.5">
                      Messages submitted by visitors, patients, doctors, or clinics via the Contact Us form.
                    </p>
                  </div>
                  <span className="text-xs text-[#86868b]">{contactMessages.length} Total</span>
                </div>

                {contactMessages.length === 0 ? (
                  <div className="p-12 text-center text-xs text-[#86868b] bg-[#fbfbfd] rounded-2xl border border-dashed border-[#e5e5ea]">
                    No messages received yet. All new inquiries submitted through the website will appear here with instant email reply options.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {contactMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          msg.status === 'NEW'
                            ? 'bg-emerald-50/30 border-emerald-200 shadow-2xs'
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
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    NEW
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
                                className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-[#e5e5ea] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7] cursor-pointer"
                              >
                                Mark Read
                              </button>
                            )}
                            <a
                              href={`mailto:${msg.email}?subject=Re: ${encodeURIComponent(msg.subject)}`}
                              className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#1d1d1f] hover:bg-black text-white cursor-pointer"
                            >
                              Reply Email
                            </a>
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
          <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#e5e5ea] max-w-lg w-full p-5 sm:p-8 shadow-2xl space-y-5">
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f0]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex items-center justify-center font-bold text-lg text-[#0066cc]">
                  {selectedDoctor.user.avatarUrl ? (
                    <img src={getFileUrl(selectedDoctor.user.avatarUrl)} alt={selectedDoctor.user.fullName} className="w-full h-full object-cover" />
                  ) : (
                    selectedDoctor.user.fullName[0]
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#1d1d1f]">{selectedDoctor.user.fullName}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
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
                  <span className="text-[#86868b] block">Qualifications:</span>
                  <strong className="text-[#1d1d1f]">{formatDoctorDegrees(selectedDoctor.qualifications)}</strong>
                </div>
                <div>
                  <span className="text-[#86868b] block">Experience:</span>
                  <strong className="text-[#1d1d1f]">{selectedDoctor.experienceYears} Years</strong>
                </div>
                <div>
                  <span className="text-[#86868b] block">Consultation Fee:</span>
                  <strong className="text-[#1d1d1f]">₹{selectedDoctor.consultationFee}</strong>
                </div>
                <div>
                  <span className="text-[#86868b] block">Checking Window:</span>
                  <strong className="text-[#0066cc]">
                    {selectedDoctor.checkingStartTime ? `${format12Hour(selectedDoctor.checkingStartTime)} – ${format12Hour(selectedDoctor.checkingEndTime)}` : 'Flexible'}
                  </strong>
                </div>
              </div>

              <div>
                <span className="text-[#86868b] font-semibold block mb-1">Clinic Address:</span>
                <p className="text-[#1d1d1f] p-2.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]">
                  {selectedDoctor.clinicAddress || 'MediArca Clinic Facility'}
                </p>
              </div>

              <div>
                <span className="text-[#86868b] font-semibold block mb-1">Professional Bio & Practice Philosophy:</span>
                <p className="text-[#1d1d1f] p-2.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] leading-relaxed">
                  {selectedDoctor.bio || 'Dedicated medical practitioner accepting outpatient consultations.'}
                </p>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[#86868b]">Email: {selectedDoctor.user.email}</span>
                <span className="text-[#86868b]">Phone: {selectedDoctor.user.phone || 'N/A'}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#f0f0f0] flex items-center justify-between">
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
                      await handleVerify(selectedDoctor.id, 'SUSPENDED');
                      setSelectedDoctor(null);
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
                      await handleVerify(selectedDoctor.id, 'VERIFIED');
                      setSelectedDoctor(null);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700"
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
                      await handleVerify(selectedDoctor.id, 'VERIFIED');
                      setSelectedDoctor(null);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700"
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
                        await handleVerify(selectedDoctor.id, 'REJECTED');
                        setSelectedDoctor(null);
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
                        await handleVerify(selectedDoctor.id, 'VERIFIED');
                        setSelectedDoctor(null);
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
          <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#e5e5ea] max-w-lg w-full p-5 sm:p-8 shadow-2xl space-y-5">
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f0]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#1d1d1f] tracking-tight">{selectedClinic.clinicName}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-[#86868b]">Clinical Healthcare Facility Verification</p>
                    {renderStatusBadge(getPractitionerStatus(selectedClinic))}
                  </div>
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
              <div className="grid grid-cols-2 gap-3 p-3 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea]">
                <div>
                  <span className="text-[10px] text-[#86868b] uppercase font-semibold block">Facility Address</span>
                  <p className="font-medium mt-0.5">{selectedClinic.address}</p>
                </div>
                <div>
                  <span className="text-[10px] text-[#86868b] uppercase font-semibold block">City & State</span>
                  <p className="font-medium mt-0.5">{selectedClinic.city || 'Not Specified'}{selectedClinic.state ? `, ${selectedClinic.state}` : ''}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] text-center">
                <div>
                  <span className="text-[10px] text-[#86868b] uppercase font-semibold block">Doctors</span>
                  <p className="text-base font-bold text-[#1d1d1f] mt-0.5">
                    {selectedClinic._count?.doctors ?? selectedClinic.doctorsCount ?? 0}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-[#86868b] uppercase font-semibold block">Receptionists</span>
                  <p className="text-base font-bold text-[#0066cc] mt-0.5">
                    {selectedClinic._count?.receptionists ?? selectedClinic.receptionistsCount ?? 0}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-[#86868b] uppercase font-semibold block">Bookings</span>
                  <p className="text-base font-bold text-emerald-600 mt-0.5">
                    {selectedClinic._count?.appointments ?? selectedClinic.appointmentsCount ?? 0}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-white border border-[#e5e5ea] rounded-xl space-y-2">
                <span className="text-[10px] text-[#86868b] uppercase font-semibold block">Primary Administrative Contact</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#86868b] block text-[10px]">Admin Full Name:</span>
                    <span className="font-medium">{selectedClinic.user?.fullName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[10px]">Direct Email:</span>
                    <span className="font-mono">{selectedClinic.user?.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[10px]">Facility Phone:</span>
                    <span>{selectedClinic.phone || selectedClinic.user?.phone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[10px]">Registration Date:</span>
                    <span>{selectedClinic.createdAt ? new Date(selectedClinic.createdAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-[#e5e5ea] bg-[#fafafc]">
                <span className="text-[#86868b] font-medium">Platform Verification State:</span>
                {renderStatusBadge(getPractitionerStatus(selectedClinic))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#f0f0f0] flex items-center justify-between">
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
                      await handleVerifyClinic(selectedClinic.id, 'SUSPENDED');
                      setSelectedClinic(null);
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
                      await handleVerifyClinic(selectedClinic.id, 'VERIFIED');
                      setSelectedClinic(null);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700"
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
                      await handleVerifyClinic(selectedClinic.id, 'VERIFIED');
                      setSelectedClinic(null);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700"
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
                        await handleVerifyClinic(selectedClinic.id, 'REJECTED');
                        setSelectedClinic(null);
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
                        await handleVerifyClinic(selectedClinic.id, 'VERIFIED');
                        setSelectedClinic(null);
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
          <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#e5e5ea] max-w-lg w-full p-5 sm:p-7 shadow-2xl space-y-4">
            <div className="flex justify-between items-start pb-3 border-b border-[#f0f0f0]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#0066cc] flex items-center justify-center font-bold text-base">
                  #{selectedAppointment.queueNumber}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#1d1d1f]">Queue Token #{selectedAppointment.queueNumber}</h3>
                    {renderAppointmentStatusBadge(selectedAppointment.status)}
                  </div>
                  <p className="text-xs text-[#86868b] mt-0.5">
                    {formatDisplayDate(selectedAppointment.appointmentDate)} • {selectedAppointment.estimatedTime || 'Estimated Time N/A'}
                  </p>
                </div>
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
              <div className="p-3 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] space-y-1.5">
                <span className="text-[10px] text-[#86868b] uppercase font-semibold block">Patient Information</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[#86868b] block text-[10px]">Patient Name:</span>
                    <strong className="text-[#1d1d1f]">
                      {selectedAppointment.patient?.user?.fullName || selectedAppointment.patientName || 'Walk-in Patient'}
                    </strong>
                    {selectedAppointment.isForOther && (
                      <span className="ml-1 text-[10px] text-purple-700 font-semibold">(Family Member)</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[10px]">Contact Phone:</span>
                    <span className="font-mono text-[#1d1d1f]">
                      {selectedAppointment.patient?.user?.phone || 'Not Provided'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[10px]">Email Address:</span>
                    <span className="font-mono text-[#1d1d1f] truncate block">
                      {selectedAppointment.patient?.user?.email || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[10px]">Arrival Status:</span>
                    <span className="font-medium text-[#1d1d1f]">
                      {selectedAppointment.isCheckedIn ? 'Checked-in at Desk' : 'Not Checked-in'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Doctor & Clinic Block */}
              <div className="p-3 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] space-y-1.5">
                <span className="text-[10px] text-[#86868b] uppercase font-semibold block">Clinical Facility & Practitioner</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[#86868b] block text-[10px]">Attending Practitioner:</span>
                    <strong className="text-[#1d1d1f]">{selectedAppointment.doctor?.user?.fullName || 'Practitioner'}</strong>
                    <span className="text-[10px] text-[#0066cc] block">{selectedAppointment.doctor?.specialty}</span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[10px]">Facility Name:</span>
                    <strong className="text-[#1d1d1f]">{resolveClinic(selectedAppointment).name}</strong>
                    {resolveClinic(selectedAppointment).city && (
                      <span className="text-[10px] text-[#86868b] block">{resolveClinic(selectedAppointment).city}</span>
                    )}
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#86868b] block text-[10px]">Shift / Window:</span>
                    <span className="text-[#1d1d1f] font-medium">{selectedAppointment.checkingWindow || 'Default Clinical Shift'}</span>
                  </div>
                </div>
              </div>

              {/* Clinical Notes / Reason */}
              {(selectedAppointment.reasonForVisit || selectedAppointment.symptoms) && (
                <div className="p-3 bg-white border border-[#e5e5ea] rounded-xl space-y-1">
                  <span className="text-[10px] text-[#86868b] uppercase font-semibold block">Reason for Visit / Symptoms</span>
                  <p className="text-xs text-[#48484a] leading-relaxed">
                    {selectedAppointment.reasonForVisit || selectedAppointment.symptoms}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#f0f0f0] flex justify-end">
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
