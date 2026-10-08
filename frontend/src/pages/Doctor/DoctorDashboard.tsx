import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  api,
  Appointment,
  parseDoctorSlots,
  format12Hour,
  getLocalDateString,
  getTomorrowDateString,
  DoctorAffiliationsData,
  ClinicProfile,
  formatDoctorDegrees,
} from '../../services/api';
import { sanitizeIndianPhone, formatIndianPhone, isValidIndianPhone } from '../../utils/phoneUtils';
import { useVisibilityPolling } from '../../utils/useVisibilityPolling';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { AppleButton } from '../../components/ui/AppleButton';
import { CabinStatusControl } from '../../components/ui/DoctorCabinPresence';
import {
  Stethoscope,
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
  IndianRupee,
  Settings,
  Check,
  Clock3,
  LayoutDashboard,
  Calendar,
  QrCode,
  Zap,
  ClipboardList,
  Printer,
  Copy,
  ChevronRight,
  Phone,
} from 'lucide-react';
import { ClinicQrStandeeModal } from '../../components/common/ClinicQrStandeeModal';

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
  const [clinicSearchQuery, setClinicSearchQuery] = useState('');
  const [clinicStateFilter, setClinicStateFilter] = useState('All');
  const [clinicCityFilter, setClinicCityFilter] = useState('All');
  const [affiliatingClinicId, setAffiliatingClinicId] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [date, setDate] = useState<string>(() => getLocalDateString());
  const [queueScope, setQueueScope] = useState<'date' | 'all-upcoming'>('date');
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

  const fetchQueue = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await api.getDoctorQueue(queueScope === 'date' ? date : undefined, queueScope);
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

  // Modals for Walk-in QR and Add Appointment (media_1789192783321.jpg)
  const [showQrModal, setShowQrModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Walk-in patient creation state
  const [walkinName, setWalkinName] = useState('');
  const [walkinAge, setWalkinAge] = useState('');
  const [walkinGender, setWalkinGender] = useState('Not Specified');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [walkinReason, setWalkinReason] = useState('');
  const [walkinSlotId, setWalkinSlotId] = useState('');
  const [walkinClinicId, setWalkinClinicId] = useState('');
  const [walkinSubmitting, setWalkinSubmitting] = useState(false);
  const [walkinError, setWalkinError] = useState<string | null>(null);
  const [walkinSuccess, setWalkinSuccess] = useState<string | null>(null);

  const bookingUrl = `${window.location.origin}${window.location.pathname}#/book/${user?.doctorProfile?.id || user?.id}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(bookingUrl)}`;

  const scrollToQueue = () => {
    setActiveTab('queue');
    setTimeout(() => {
      const el = document.getElementById('live-queue-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 60);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

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

    const effectiveClinicId =
      walkinClinicId ||
      (affiliations?.clinics?.length === 1 ? affiliations.clinics[0].clinicId : undefined);

    if (affiliations?.clinics && affiliations.clinics.length > 1 && !effectiveClinicId) {
      setWalkinError('Please select which clinic venue to book the walk-in at');
      return;
    }

    setWalkinSubmitting(true);
    setWalkinError(null);
    try {
      await api.bookAppointment({
        doctorId: user?.doctorProfile?.id || user?.id || '',
        appointmentDate: date,
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
      fetchAffiliations();
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
      fetchAffiliations();
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
      fetchAffiliations();
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to unlink receptionist');
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
      if (target.appointmentDate !== getLocalDateString()) {
        alert(`Cannot call patient scheduled for ${target.appointmentDate}. Only patients scheduled for today can be called into the active cabin.`);
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

  const isVerified = user?.doctorProfile?.isVerified ?? true;
  const isDoctorAway = Boolean(user?.doctorProfile?.cabinStatus && user.doctorProfile.cabinStatus !== 'IN_CABIN');
  const totalPendingRequests = affiliations?.incomingRequests?.length || 0;

  const doctorDisplayName = (user?.fullName || 'Doctor').replace(/^Dr\.?\s+/i, '');

  const navItems: DashboardNavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
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
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/doctor/profile',
    },
  ];

  return (
    <DashboardLayout
      portalType="DOCTOR"
      portalSubtitle="DOCTOR PORTAL"
      navItems={navItems}
      title={`Good ${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, Dr. ${doctorDisplayName}`}
      subtitle={user?.doctorProfile?.specialty ? `${user.doctorProfile.specialty} • ${user?.doctorProfile?.clinicAddress || 'Practice Console'}` : 'Practice Queue & Patient Roster'}
      headerAction={
        <div className="flex flex-wrap items-center gap-2">
          {affiliations?.clinics && affiliations.clinics.length > 0 && (
            <AppleButton
              variant="secondary"
              size="sm"
              onClick={() => {
                const firstClinic = affiliations.clinics[0];
                setSelectedStandeeClinic({
                  clinicId: firstClinic.clinicId,
                  clinicName: firstClinic.clinicName,
                  clinicAddress: `${firstClinic.address || ''}${firstClinic.city ? `, ${firstClinic.city}` : ''}`,
                  clinicPhone: firstClinic.phone || '',
                  checkinCode: (firstClinic as any).checkinCode || '',
                });
                setIsStandeeModalOpen(true);
              }}
            >
              <QrCode className="w-3.5 h-3.5 text-[#0066cc]" />
              <span>Clinic QR Standee</span>
            </AppleButton>
          )}
          <AppleButton
            variant="ghost"
            size="sm"
            onClick={() => {
              if (activeTab === 'queue') fetchQueue();
              else fetchAffiliations();
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </AppleButton>
          <AppleButton
            variant="primary"
            size="sm"
            onClick={scrollToQueue}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Manage Appointments</span>
          </AppleButton>
        </div>
      }
    >
      <div className="space-y-6 print:hidden">
        {/* Segmented Tab Switcher */}
        <div className="flex items-center justify-between border-b border-[#e5e5ea] pb-4 overflow-x-auto scrollbar-none">
          <div className="inline-flex p-1 rounded-[14px] bg-[#e8e8ed]/70 border border-[#e5e5ea]">
            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-[10px] text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'queue'
                  ? 'bg-white text-[#1d1d1f] shadow-xs'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Live Patient Queue</span>
              {queueData && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    activeTab === 'queue' ? 'bg-[#0066cc]/10 text-[#0066cc]' : 'bg-black/5 text-[#6e6e73]'
                  }`}
                >
                  {queueData.waitingQueue.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('affiliations');
                fetchAffiliations();
              }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-[10px] text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'affiliations'
                  ? 'bg-white text-[#1d1d1f] shadow-xs'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Affiliated Clinics & Staff</span>
              {affiliations && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    activeTab === 'affiliations' ? 'bg-[#0066cc]/10 text-[#0066cc]' : 'bg-black/5 text-[#6e6e73]'
                  }`}
                >
                  {affiliations.clinics.length + affiliations.receptionists.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {activeTab === 'affiliations' ? (
          <div className="space-y-6 animate-fadeIn">
            {/* Feedback Alerts */}
            {feedbackSuccess && (
              <div className="p-4 rounded-[16px] bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">{feedbackSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedbackSuccess(null)}
                  className="text-emerald-700 hover:text-emerald-900 p-1 rounded-full cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {feedbackError && (
              <div className="p-4 rounded-[16px] bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-medium">{feedbackError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedbackError(null)}
                  className="text-rose-700 hover:text-rose-900 p-1 rounded-full cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Metrics Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="apple-card p-5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] block">
                    Affiliated Clinics
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] mt-1 tracking-tight tabular-nums">
                    {affiliations?.clinics.length || 0}
                  </h3>
                  <p className="text-meta mt-0.5">Active clinical facilities</p>
                </div>
                <div className="w-10 h-10 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>

              <div className="apple-card p-5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] block">
                    Linked Receptionists
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] mt-1 tracking-tight tabular-nums">
                    {affiliations?.receptionists.length || 0}
                  </h3>
                  <p className="text-meta mt-0.5">Authorized desk staff</p>
                </div>
                <div className="w-10 h-10 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="apple-card p-5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] block">
                    Clinic Attributed Revenue
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] mt-1 tracking-tight tabular-nums">
                    ₹{(
                      affiliations?.clinics.reduce(
                        (sum: number, c) => sum + (c.revenue || 0),
                        0
                      ) || 0
                    ).toLocaleString('en-IN')}
                  </h3>
                  <p className="text-meta mt-0.5">Across affiliated clinics</p>
                </div>
                <div className="w-10 h-10 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
                  <IndianRupee className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Incoming Clinic Affiliation Invitations */}
            {affiliations?.incomingRequests && affiliations.incomingRequests.length > 0 && (
              <div className="apple-card p-6 border-[#0066cc]/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-[10px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-card-title">
                      Incoming Clinic Invitations ({affiliations.incomingRequests.length})
                    </h3>
                    <p className="text-meta">
                      Verified clinics that invited you to practice at their facility.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {affiliations.incomingRequests.map((req) => (
                    <div
                      key={req.affiliationId}
                      className="rounded-[16px] border border-[#e5e5ea] p-4 bg-[#f5f5f7]/60 flex flex-col justify-between"
                    >
                      <div>
                        <h4 className="font-semibold text-sm text-[#1d1d1f]">{req.clinicName}</h4>
                        <p className="text-meta flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                          <span>{req.address}{req.city ? `, ${req.city}` : ''}</span>
                        </p>
                        {req.phone && (
                          <p className="text-meta mt-0.5">Phone: {req.phone}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#e5e5ea]">
                        <AppleButton
                          size="sm"
                          variant="primary"
                          onClick={() => handleRespondClinicAffiliation(req.affiliationId, 'ACCEPT')}
                          className="flex-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept</span>
                        </AppleButton>
                        <AppleButton
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRespondClinicAffiliation(req.affiliationId, 'REJECT')}
                          className="flex-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </AppleButton>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Outgoing Clinic Requests */}
            {affiliations?.outgoingRequests && affiliations.outgoingRequests.length > 0 && (
              <div className="apple-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Clock3 className="w-4 h-4 text-amber-600" />
                  <h3 className="text-card-title">
                    Pending Clinic Approvals ({affiliations.outgoingRequests.length})
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {affiliations.outgoingRequests.map((req) => (
                    <div
                      key={req.affiliationId}
                      className="rounded-[16px] border border-amber-200 bg-amber-50/40 p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm text-[#1d1d1f] truncate">{req.clinicName}</h4>
                        <p className="text-meta mt-0.5 truncate">{req.address}{req.city ? `, ${req.city}` : ''}</p>
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                        Awaiting Clinic
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 1: Affiliated Clinics */}
            <div className="apple-card p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-[#e5e5ea]/70">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-section-title">
                      Affiliated Clinics & Hospitals
                    </h3>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f]">
                      {affiliations?.clinics.length || 0}
                    </span>
                  </div>
                  <p className="text-meta mt-0.5">
                    Manage facility schedules, consultation fees, and arrival QR standees.
                  </p>
                </div>

                <AppleButton
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setClinicSearchQuery('');
                    setClinicStateFilter('All');
                    setClinicCityFilter('All');
                    setIsAffiliateModalOpen(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Affiliate New Clinic</span>
                </AppleButton>
              </div>

              {affiliationsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-32 rounded-[16px] bg-[#f5f5f7] animate-pulse" />
                  ))}
                </div>
              ) : affiliations?.clinics.length === 0 ? (
                <div className="p-8 text-center bg-[#f5f5f7]/60 rounded-[16px] border border-dashed border-[#d2d2d7]">
                  <div className="w-11 h-11 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center mx-auto mb-3">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h4 className="text-card-title">No Clinics Affiliated</h4>
                  <p className="text-meta mt-1 max-w-md mx-auto">
                    Search and affiliate your practice with verified clinics to configure shift timings and receive patient queue bookings.
                  </p>
                  <div className="mt-4">
                    <AppleButton
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setClinicSearchQuery('');
                        setClinicStateFilter('All');
                        setClinicCityFilter('All');
                        setIsAffiliateModalOpen(true);
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Find & Affiliate Clinic</span>
                    </AppleButton>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {affiliations?.clinics.map((clinic) => (
                    <div
                      key={clinic.clinicId}
                      className="rounded-[16px] border border-[#e5e5ea] p-5 hover:border-[#d2d2d7] transition-all flex flex-col justify-between bg-white"
                    >
                      <div>
                        {/* Header: Icon, Name, Verified, Location, Detach */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-card-title truncate">
                                  {clinic.clinicName}
                                </h4>
                                <span title="Verified Clinic" className="inline-flex">
                                  <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0" />
                                </span>
                              </div>
                              <p className="text-meta flex items-center gap-1 mt-0.5 truncate">
                                <MapPin className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                                <span className="truncate">{clinic.address}{clinic.city ? `, ${clinic.city}` : ''}</span>
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveClinic(clinic.clinicId, clinic.clinicName)}
                            className="text-[#86868b] hover:text-rose-600 hover:bg-rose-50 p-2 rounded-full transition-colors shrink-0 cursor-pointer"
                            title="Detach from Clinic"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Clean Stats Row */}
                        <div className="grid grid-cols-3 gap-2 mt-4 p-3 rounded-[12px] bg-[#f5f5f7]/70 border border-[#e5e5ea] text-center">
                          <div>
                            <span className="text-[11px] font-medium text-[#6e6e73] block">Fee</span>
                            <span className="text-sm font-bold text-[#1d1d1f] mt-0.5 block tabular-nums">
                              ₹{clinic.consultationFee ?? user?.doctorProfile?.consultationFee ?? 500}
                            </span>
                          </div>
                          <div className="border-x border-[#e5e5ea]">
                            <span className="text-[11px] font-medium text-[#6e6e73] block">Bookings</span>
                            <span className="text-sm font-bold text-[#1d1d1f] mt-0.5 block tabular-nums">
                              {clinic.bookingCount || 0}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] font-medium text-[#6e6e73] block">Revenue</span>
                            <span className="text-sm font-bold text-[#0066cc] mt-0.5 block tabular-nums">
                              ₹{(clinic.revenue ?? 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>

                        {/* Shifts Status */}
                        <div className="mt-3 flex items-center justify-between text-xs px-1 text-[#6e6e73]">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Clock className="w-3.5 h-3.5 text-[#0066cc]" />
                            <span>Practice Shifts:</span>
                          </span>
                          <span className="font-semibold text-[#1d1d1f] truncate max-w-[220px]">
                            {clinic.slots && clinic.slots.length > 0
                              ? `${clinic.slots.length} ${clinic.slots.length === 1 ? 'Shift' : 'Shifts'} (${format12Hour(clinic.slots[0].startTime)} – ${format12Hour(clinic.slots[0].endTime)})`
                              : 'Default schedule'}
                          </span>
                        </div>
                      </div>

                      {/* Actions & Footer */}
                      <div className="mt-4 pt-3 border-t border-[#e5e5ea]/70 space-y-2.5">
                        <div className="flex gap-2">
                          <AppleButton
                            size="sm"
                            variant="secondary"
                            onClick={() => navigate(`/doctor/schedule?clinic=${clinic.clinicId}`)}
                            className="flex-1"
                          >
                            <Clock className="w-3.5 h-3.5 text-[#0066cc]" />
                            <span>Shifts & Fee</span>
                          </AppleButton>
                          <AppleButton
                            size="sm"
                            variant="ghost"
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
                            className="border border-[#e5e5ea]"
                            title="View & Print Clinic QR Standee"
                          >
                            <QrCode className="w-3.5 h-3.5 text-[#0066cc]" />
                            <span>QR Standee</span>
                          </AppleButton>
                        </div>

                        <div className="text-[11px] text-[#6e6e73] flex items-center justify-between px-1">
                          <span>Phone: {clinic.phone || 'N/A'}</span>
                          <span>Affiliated: {clinic.joinedAt ? new Date(clinic.joinedAt).toLocaleDateString() : 'Active'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Authorized Clinic Desk Staff */}
            <div className="apple-card p-6">
              <div className="flex items-center gap-2 mb-5 pb-4 border-b border-[#e5e5ea]/70">
                <h3 className="text-section-title">
                  Authorized Clinic Desk Staff
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f]">
                  {affiliations?.receptionists.length || 0}
                </span>
              </div>

              {affiliationsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-24 rounded-[16px] bg-[#f5f5f7] animate-pulse" />
                  ))}
                </div>
              ) : affiliations?.receptionists.length === 0 ? (
                <div className="p-8 text-center bg-[#f5f5f7]/60 rounded-[16px] border border-dashed border-[#d2d2d7]">
                  <Users className="w-8 h-8 text-[#86868b] mx-auto mb-2 opacity-60" />
                  <h4 className="text-card-title">No Desk Staff Assigned</h4>
                  <p className="text-meta mt-1 max-w-md mx-auto">
                    Your affiliated clinic administrators can assign desk receptionists to manage queues and book walk-in appointments for you.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {affiliations?.receptionists.map((rec) => (
                    <div
                      key={rec.receptionistId}
                      className="rounded-[16px] border border-[#e5e5ea] p-4 sm:p-5 hover:border-[#d2d2d7] transition-all flex items-center justify-between gap-4 bg-white"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-card-title truncate">
                              {rec.fullName}
                            </h4>
                            {rec.clinicName && (
                              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-[#48484a] border border-[#e5e5ea] flex items-center gap-1.5 truncate max-w-[180px]">
                                <Building2 className="w-3 h-3 text-[#0066cc] shrink-0" />
                                <span className="truncate">{rec.clinicName}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-meta truncate mt-0.5">{rec.email}</p>
                          <div className="flex items-center gap-2 text-[11px] text-[#6e6e73] mt-1 flex-wrap">
                            {rec.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-[#86868b]" />
                                <span>{rec.phone}</span>
                              </span>
                            )}
                            {rec.phone && <span className="text-[#d2d2d7]">•</span>}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-[#86868b]" />
                              <span>Linked {new Date(rec.joinedAt).toLocaleDateString()}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <AppleButton
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemoveReceptionist(rec.receptionistId, rec.fullName)}
                        title="Unlink Receptionist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Unlink</span>
                      </AppleButton>
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
              <div className="p-4 rounded-[16px] bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm text-rose-900">Medical Practitioner License Suspended</h4>
                  <p className="mt-0.5 leading-relaxed text-rose-800">
                    Your practitioner license has been suspended by administration. You cannot accept new patient bookings or clinic affiliations until reinstatement.
                  </p>
                </div>
              </div>
            )}
            {user?.doctorProfile?.verificationStatus === 'REJECTED' && (
              <div className="p-4 rounded-[16px] bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm text-rose-900">Doctor Profile Application Rejected</h4>
                  <p className="mt-0.5 leading-relaxed text-rose-800">
                    Your medical credentials verification was not approved. Please review your registration details or contact platform administration.
                  </p>
                </div>
              </div>
            )}
            {(!isVerified && user?.doctorProfile?.verificationStatus !== 'SUSPENDED' && user?.doctorProfile?.verificationStatus !== 'REJECTED') && (
              <div className="p-4 rounded-[16px] bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">Doctor Profile Pending Admin Verification</h4>
                  <p className="mt-0.5 leading-relaxed text-amber-800">
                    Your medical profile is currently under review by the MediArca administrator. Once approved, your profile and checking slots will become visible in the public doctor directory.
                  </p>
                </div>
              </div>
            )}

            {/* Server Connection Issue Banner */}
            {fetchError && (
              <div className="p-4 rounded-[16px] bg-[#0066cc]/5 border border-[#0066cc]/20 text-[#1d1d1f] text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#0066cc] animate-spin" />
                  <span>Connecting to cloud database... (Cloud backend may take 30s to resume from idle)</span>
                </div>
                <AppleButton variant="ghost" size="sm" onClick={() => fetchQueue(true)} className="text-[#0066cc]">
                  Retry
                </AppleButton>
              </div>
            )}

            {/* Doctor Live Cabin Availability & Presence */}
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

            {/* Top Shift & Date Selector Header */}
            <div className="apple-card p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-section-title">{user?.fullName}</h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
                  {user?.doctorProfile?.specialty || 'Doctor'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-meta font-medium mr-1">Date:</span>
                <button
                  type="button"
                  onClick={() => {
                    setQueueScope('date');
                    setDate(getLocalDateString());
                  }}
                  className={`h-9 px-4 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    queueScope === 'date' && date === getLocalDateString()
                      ? 'bg-[#0066cc] text-white shadow-xs'
                      : 'bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea]'
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
                  className={`h-9 px-4 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    queueScope === 'date' && date === (queueData?.upcomingSummary?.tomorrowDate || getTomorrowDateString())
                      ? 'bg-[#0066cc] text-white shadow-xs'
                      : 'bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea]'
                  }`}
                >
                  <span>Tomorrow</span>
                  {queueData?.upcomingSummary && queueData.upcomingSummary.tomorrowCount > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      queueScope === 'date' && date === queueData.upcomingSummary.tomorrowDate
                        ? 'bg-white/20 text-white'
                        : 'bg-[#0066cc] text-white'
                    }`}>
                      {queueData.upcomingSummary.tomorrowCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQueueScope('all-upcoming');
                  }}
                  className={`h-9 px-4 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    queueScope === 'all-upcoming'
                      ? 'bg-[#0066cc] text-white shadow-xs'
                      : 'bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea]'
                  }`}
                >
                  <span>All Upcoming</span>
                  {queueData?.upcomingSummary && queueData.upcomingSummary.totalUpcomingCount > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      queueScope === 'all-upcoming'
                        ? 'bg-white/20 text-white'
                        : 'bg-[#0066cc] text-white'
                    }`}>
                      {queueData.upcomingSummary.totalUpcomingCount}
                    </span>
                  )}
                </button>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setQueueScope('date');
                    setDate(e.target.value);
                  }}
                  className="ui-input !w-auto !h-9 !px-3.5 !rounded-full !text-xs"
                  title="Choose Specific Date"
                />
              </div>
            </div>

            {/* Upcoming Bookings Alert Banner */}
            {queueData?.upcomingSummary && queueData.upcomingSummary.tomorrowCount > 0 && (queueScope !== 'date' || date !== queueData.upcomingSummary.tomorrowDate) && (
              <div className="p-4 rounded-[16px] bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-[#1d1d1f]">
                      {queueData.upcomingSummary.tomorrowCount} Appointment{queueData.upcomingSummary.tomorrowCount > 1 ? 's' : ''} Scheduled for Tomorrow ({queueData.upcomingSummary.tomorrowDate})
                    </h4>
                    <p className="text-meta mt-0.5">
                      You have patients queued for tomorrow. Switch date to review waiting patients and queue tokens.
                    </p>
                  </div>
                </div>
                <AppleButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setQueueScope('date');
                    setDate(queueData.upcomingSummary!.tomorrowDate);
                  }}
                  className="self-start sm:self-auto shrink-0"
                >
                  <span>Switch to Tomorrow</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </AppleButton>
              </div>
            )}

            {/* Alert banner if bookings on future date beyond tomorrow */}
            {queueData?.upcomingSummary && queueData.upcomingSummary.tomorrowCount === 0 && queueData.upcomingSummary.nextDateWithBookings && (queueScope !== 'date' || date !== queueData.upcomingSummary.nextDateWithBookings) && (
              <div className="p-4 rounded-[16px] bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-[#1d1d1f]">
                      {queueData.upcomingSummary.totalUpcomingCount} Upcoming Appointment{queueData.upcomingSummary.totalUpcomingCount > 1 ? 's' : ''} on Future Dates
                    </h4>
                    <p className="text-meta mt-0.5">
                      Next booked consultation date is {queueData.upcomingSummary.nextDateWithBookings}.
                    </p>
                  </div>
                </div>
                <AppleButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setQueueScope('date');
                    setDate(queueData.upcomingSummary!.nextDateWithBookings!);
                  }}
                  className="self-start sm:self-auto shrink-0"
                >
                  <span>View {queueData.upcomingSummary.nextDateWithBookings}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </AppleButton>
              </div>
            )}

            {/* Top 2 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card 1: Total Bookings */}
              <div className="apple-card p-5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] block">
                    Total Bookings
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] mt-1 tracking-tight tabular-nums">
                    {queueData?.totalQueue || 0}
                  </h3>
                  <p className="text-meta mt-0.5">Scheduled for selected scope</p>
                </div>
                <div className="w-10 h-10 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>

              {/* Card 2: Completed Consultations */}
              <div className="apple-card p-5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] block">
                    Completed Consultations
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] mt-1 tracking-tight tabular-nums">
                    {queueData?.completedQueue.length || 0}
                  </h3>
                  <p className="text-meta mt-0.5">Encounters finalized</p>
                </div>
                <div className="w-10 h-10 rounded-[12px] bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Middle 2-Column Section: Quick Actions & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Quick Actions */}
              <div className="apple-card p-6 flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4 text-[#0066cc]" />
                  <h3 className="text-card-title">
                    Quick Actions
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {/* Action 1: View Appointments */}
                  <button
                    type="button"
                    onClick={scrollToQueue}
                    className="w-full rounded-[14px] border border-[#e5e5ea] bg-[#f5f5f7]/60 hover:bg-[#f5f5f7] hover:border-[#0066cc]/30 p-3.5 flex items-center justify-between text-left transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[#1d1d1f] group-hover:text-[#0066cc] transition-colors">
                          View Appointments
                        </h4>
                        <p className="text-meta mt-0.5">
                          {queueData?.totalQueue || 0} total bookings
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#86868b] group-hover:text-[#0066cc] transition-colors" />
                  </button>

                  {/* Action 2: Walk-in QR Code */}
                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    className="w-full rounded-[14px] border border-[#e5e5ea] bg-[#f5f5f7]/60 hover:bg-[#f5f5f7] hover:border-[#0066cc]/30 p-3.5 flex items-center justify-between text-left transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
                        <QrCode className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[#1d1d1f] group-hover:text-[#0066cc] transition-colors">
                          Walk-in QR Code
                        </h4>
                        <p className="text-meta mt-0.5">
                          Print poster & share link
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#86868b] group-hover:text-[#0066cc] transition-colors" />
                  </button>

                  {/* Action 3: Add Appointment */}
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="w-full rounded-[14px] border border-[#e5e5ea] bg-[#f5f5f7]/60 hover:bg-[#f5f5f7] hover:border-[#0066cc]/30 p-3.5 flex items-center justify-between text-left transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
                        <Plus className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[#1d1d1f] group-hover:text-[#0066cc] transition-colors">
                          Add Appointment
                        </h4>
                        <p className="text-meta mt-0.5">
                          Log new walk-in patient
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#86868b] group-hover:text-[#0066cc] transition-colors" />
                  </button>
                </div>
              </div>

              {/* Right: Recent Activity */}
              <div className="apple-card p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-[#6e6e73]" />
                    <h3 className="text-card-title">
                      Recent Activity
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={scrollToQueue}
                    className="text-xs font-semibold text-[#0066cc] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    View All &rarr;
                  </button>
                </div>

                {(!queueData?.allAppointments || queueData.allAppointments.length === 0) ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-11 h-11 rounded-[12px] bg-[#f5f5f7] flex items-center justify-center text-[#86868b] mb-3">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-semibold text-[#1d1d1f]">
                      No appointments for {queueScope === 'all-upcoming' ? 'upcoming dates' : date === getLocalDateString() ? 'Today' : date}
                    </h4>
                    <p className="text-meta mt-1 max-w-xs">
                      {queueData?.upcomingSummary && queueData.upcomingSummary.tomorrowCount > 0 && date !== queueData.upcomingSummary.tomorrowDate
                        ? `You have ${queueData.upcomingSummary.tomorrowCount} appointment(s) booked for Tomorrow.`
                        : 'Patient bookings will appear here.'}
                    </p>
                    {queueData?.upcomingSummary && queueData.upcomingSummary.tomorrowCount > 0 && date !== queueData.upcomingSummary.tomorrowDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setQueueScope('date');
                          setDate(queueData.upcomingSummary!.tomorrowDate);
                        }}
                        className="mt-3 text-xs font-semibold text-[#0066cc] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        Switch to Tomorrow ({queueData.upcomingSummary.tomorrowCount}) &rarr;
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5 flex-1">
                    {queueData.allAppointments.slice(0, 3).map((appt) => (
                      <div
                        key={appt.id}
                        className="p-3 rounded-[14px] border border-[#e5e5ea] hover:border-[#d2d2d7] transition-all flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-[8px] bg-[#0066cc]/10 text-[#0066cc] font-bold text-[11px] flex items-center justify-center shrink-0 tabular-nums">
                            #{appt.queueNumber}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#1d1d1f] truncate">
                              {appt.patientName || appt.patient?.user?.fullName || 'Patient'}
                            </p>
                            <p className="text-[11px] text-[#6e6e73] truncate">
                              {appt.appointmentDate && (
                                <span className="font-medium text-[#1d1d1f] mr-1">
                                  {appt.appointmentDate === getLocalDateString() ? 'Today' : appt.appointmentDate === queueData?.upcomingSummary?.tomorrowDate ? 'Tomorrow' : appt.appointmentDate} •
                                </span>
                              )}
                              {appt.estimatedTime} • {appt.checkingWindow || 'Shift'}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                            appt.status === 'IN_CONSULTATION'
                              ? 'bg-[#0066cc]/10 text-[#0066cc] border-[#0066cc]/20'
                              : appt.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : appt.status === 'EXPIRED'
                              ? 'bg-[#f5f5f7] text-[#6e6e73] border-[#e5e5ea]'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {appt.status === 'EXPIRED' ? 'Expired' : appt.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Practice Summary Card */}
            <div className="apple-card p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">
                    Practice Summary
                  </h3>
                  <p className="text-meta">
                    You have <strong className="text-[#1d1d1f]">{queueData?.completedQueue.length || 0}</strong> completed consultation sessions logged on MediArca.
                  </p>
                </div>
              </div>
            </div>

            {/* Live Queue Station Anchor & Shifts */}
            <div id="live-queue-section" className="scroll-mt-6">
              {/* Main Console Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Active In-Consultation Patient (1 Column) */}
                <div className="lg:col-span-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73] mb-3">
                    Active Patient in Cabin
                  </h3>

                  {queueData?.activeInConsultation ? (
                    <div className="apple-card p-6 border-[#0066cc]/30">
                      <div className="flex justify-between items-start mb-4">
                        <span className="bg-[#0066cc]/10 text-[#0066cc] font-semibold text-[11px] px-2.5 py-1 rounded-full border border-[#0066cc]/20">
                          IN CONSULTATION
                        </span>
                        <span className="text-lg font-bold text-[#1d1d1f] tabular-nums">
                          Queue #{queueData.activeInConsultation.queueNumber}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-lg font-semibold text-[#1d1d1f] tracking-tight">
                          {queueData.activeInConsultation.patientName || queueData.activeInConsultation.patient?.user?.fullName || 'Patient'}
                        </h4>
                        {queueData.activeInConsultation.isForOther && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
                            Booked for family ({queueData.activeInConsultation.patientAge ? `Age ${queueData.activeInConsultation.patientAge}` : 'Other'} • by {queueData.activeInConsultation.patient?.user?.fullName})
                          </span>
                        )}
                      </div>
                      <p className="text-meta mt-0.5">
                        Scheduled for {queueData.activeInConsultation.estimatedTime}
                      </p>

                      <div className="my-4 p-3.5 rounded-[12px] bg-[#f5f5f7] border border-[#e5e5ea] text-xs text-[#1d1d1f] space-y-1.5">
                        <div>
                          <strong className="text-[#6e6e73]">Reason: </strong>
                          {queueData.activeInConsultation.reasonForVisit || 'General Consultation'}
                        </div>
                        {queueData.activeInConsultation.symptoms && (
                          <div>
                            <strong className="text-[#6e6e73]">Symptoms: </strong>
                            {queueData.activeInConsultation.symptoms}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-2">
                        <AppleButton
                          variant="primary"
                          size="md"
                          disabled={completingId === queueData.activeInConsultation.id}
                          onClick={() => handleCompleteConsultation(queueData.activeInConsultation!.id)}
                          className="w-full sm:flex-1"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{completingId === queueData.activeInConsultation.id ? 'Completing...' : 'Complete Consultation'}</span>
                        </AppleButton>
                        <AppleButton
                          variant="secondary"
                          size="md"
                          onClick={() =>
                            navigate(`/doctor/consultation/${queueData.activeInConsultation?.id}`)
                          }
                          className="w-full sm:w-auto"
                        >
                          <FileEdit className="w-3.5 h-3.5 text-[#0066cc]" />
                          <span>Notes</span>
                        </AppleButton>
                      </div>
                    </div>
                  ) : (
                    <div className="apple-card p-8 text-center">
                      <div className="w-11 h-11 rounded-[12px] bg-[#f5f5f7] text-[#86868b] flex items-center justify-center mx-auto mb-3">
                        <Stethoscope className="w-5 h-5" />
                      </div>
                      <h4 className="text-card-title">Cabin is Free</h4>
                      <p className="text-meta mt-1 leading-relaxed">
                        No patient currently in consultation. Click "Call Patient" on the waiting queue to begin.
                      </p>
                    </div>
                  )}
                </div>

                {/* Waiting Queue List (2 Columns) */}
                <div className="lg:col-span-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">
                      Waiting Queue ({queueData?.waitingQueue.length || 0})
                    </h3>
                    {(() => {
                      const filteredWaiting = queueData?.waitingQueue.filter((appt) => {
                        if (!queueSearch.trim()) return true;
                        const q = queueSearch.toLowerCase().trim();
                        const name = (appt.patientName || appt.patient?.user?.fullName || '').toLowerCase();
                        const phone = (appt.patient?.user?.phone || '').toLowerCase();
                        const token = String(appt.queueNumber || '');
                        return name.includes(q) || phone.includes(q) || token.includes(q);
                      }) || [];
                      const isDoctorAway = user?.doctorProfile?.cabinStatus && user.doctorProfile.cabinStatus !== 'IN_CABIN';
                      const nextPresentTarget = filteredWaiting.find(
                        (appt) => appt.isCheckedIn && appt.appointmentDate === getLocalDateString()
                      );

                      return (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                          <input
                            type="text"
                            value={queueSearch}
                            onChange={(e) => setQueueSearch(e.target.value)}
                            placeholder="Search patient, phone, token..."
                            className="ui-input !h-9 !px-3.5 !rounded-full !text-xs w-full sm:w-56"
                          />
                          {isDoctorAway ? (
                            <AppleButton
                              variant="ghost"
                              size="sm"
                              disabled={true}
                              className="opacity-70 cursor-not-allowed bg-[#f5f5f7] text-[#6e6e73] border border-[#e5e5ea]"
                              title="You have stepped out of the cabin. Change cabin presence to 'In Cabin' to resume calling patients."
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-500" />
                              <span>Doctor {user?.doctorProfile?.cabinStatus === 'STEPPED_OUT' ? 'Stepped Out' : 'Away'}</span>
                            </AppleButton>
                          ) : nextPresentTarget ? (
                            <AppleButton
                              variant="primary"
                              size="sm"
                              disabled={callingId !== null}
                              onClick={() => handleCallPatient(nextPresentTarget.id)}
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>
                                {callingId === nextPresentTarget.id
                                  ? 'Calling...'
                                  : `Call Queue #${nextPresentTarget.queueNumber} (Arrived)`}
                              </span>
                            </AppleButton>
                          ) : filteredWaiting.length > 0 ? (
                            <AppleButton
                              variant="ghost"
                              size="sm"
                              disabled={true}
                              className="opacity-60 cursor-not-allowed bg-[#f5f5f7] text-[#6e6e73] border border-[#e5e5ea]"
                              title="Waiting patients have not arrived at the clinic yet. Once marked arrived, they can be called into consultation."
                            >
                              <Clock className="w-3.5 h-3.5 text-[#86868b]" />
                              <span>Awaiting Patient Arrival</span>
                            </AppleButton>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>

                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 rounded-[16px] bg-white border border-[#e5e5ea] animate-pulse" />
                      ))}
                    </div>
                  ) : queueData?.waitingQueue.length === 0 ? (
                    <div className="apple-card p-8 text-center">
                      <div className="w-11 h-11 rounded-[12px] bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <h4 className="text-card-title">
                        Queue is Clear for {queueScope === 'all-upcoming' ? 'All Upcoming Dates' : date === getLocalDateString() ? 'Today' : date === queueData?.upcomingSummary?.tomorrowDate ? 'Tomorrow' : date}
                      </h4>
                      <p className="text-meta mt-1 max-w-md mx-auto">
                        {queueData?.upcomingSummary && queueData.upcomingSummary.tomorrowCount > 0 && date !== queueData.upcomingSummary.tomorrowDate ? (
                          <span>
                            No patients waiting today, but you have <strong className="text-[#1d1d1f]">{queueData.upcomingSummary.tomorrowCount} patient(s) booked for Tomorrow ({queueData.upcomingSummary.tomorrowDate})</strong>.
                          </span>
                        ) : queueData?.upcomingSummary && queueData.upcomingSummary.totalUpcomingCount > 0 && queueScope === 'date' ? (
                          <span>
                            No patients waiting for this date, but you have <strong className="text-[#1d1d1f]">{queueData.upcomingSummary.totalUpcomingCount} upcoming patient(s)</strong> booked on future dates.
                          </span>
                        ) : (
                          'All patients scheduled for this date have either completed consultation or not yet booked.'
                        )}
                      </p>
                      {queueData?.upcomingSummary && queueData.upcomingSummary.tomorrowCount > 0 && date !== queueData.upcomingSummary.tomorrowDate && (
                        <div className="mt-4">
                          <AppleButton
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setQueueScope('date');
                              setDate(queueData.upcomingSummary!.tomorrowDate);
                            }}
                          >
                            <span>Switch to Tomorrow's Queue ({queueData.upcomingSummary.tomorrowCount} Booked)</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </AppleButton>
                        </div>
                      )}
                    </div>
                  ) : (() => {
                    const filteredWaiting = queueData?.waitingQueue.filter((appt) => {
                      if (!queueSearch.trim()) return true;
                      const q = queueSearch.toLowerCase().trim();
                      const name = (appt.patientName || appt.patient?.user?.fullName || '').toLowerCase();
                      const phone = (appt.patient?.user?.phone || '').toLowerCase();
                      const token = String(appt.queueNumber || '');
                      return name.includes(q) || phone.includes(q) || token.includes(q);
                    }) || [];

                    if (filteredWaiting.length === 0) {
                      return (
                        <div className="apple-card p-8 text-center">
                          <p className="text-meta">
                            No waiting patients matching "{queueSearch}".
                          </p>
                          <button
                            type="button"
                            onClick={() => setQueueSearch('')}
                            className="mt-2 text-xs text-[#0066cc] font-semibold hover:underline cursor-pointer"
                          >
                            Clear Search Filter
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {filteredWaiting.map((appt) => (
                          <div
                            key={appt.id}
                            className="apple-card p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-[#d2d2d7] transition-all"
                          >
                            <div className="flex items-center gap-3.5">
                              <div className="w-12 h-12 rounded-[14px] bg-[#0066cc]/10 border border-[#0066cc]/20 text-[#0066cc] flex flex-col items-center justify-center font-bold shrink-0">
                                <span className="text-[9px] uppercase tracking-wider text-[#0066cc]/80">Token</span>
                                <span className="text-base leading-none tabular-nums">#{appt.queueNumber}</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-card-title">
                                    {appt.patientName || appt.patient?.user?.fullName || 'Patient'}
                                  </h4>
                                  {appt.isForOther && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
                                      Family ({appt.patientAge ? `Age ${appt.patientAge}` : 'Other'} • by {appt.patient?.user.fullName})
                                    </span>
                                  )}
                                  {appt.checkingWindow && (
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#48484a]">
                                      {appt.checkingWindow}
                                    </span>
                                  )}
                                  {appt.appointmentDate && (
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                      appt.appointmentDate === getLocalDateString()
                                        ? 'bg-[#0066cc]/10 text-[#0066cc] border-[#0066cc]/20'
                                        : 'bg-[#f5f5f7] text-[#1d1d1f] border-[#e5e5ea]'
                                    }`}>
                                      {appt.appointmentDate === getLocalDateString() ? 'Today' : appt.appointmentDate === queueData?.upcomingSummary?.tomorrowDate ? 'Tomorrow' : appt.appointmentDate}
                                    </span>
                                  )}
                                  {appt.isCheckedIn ? (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                      <span>At Clinic</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#6e6e73] border border-[#e5e5ea] flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#86868b]" />
                                      <span>Awaiting Arrival</span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-meta flex items-center gap-1.5 mt-1">
                                  <span>Est. {appt.estimatedTime}</span>
                                  <span>•</span>
                                  <span className="text-[#1d1d1f] font-medium">
                                    {appt.reasonForVisit || 'General Medical'}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                              {appt.appointmentDate === getLocalDateString() ? (
                                isDoctorAway ? (
                                  <AppleButton
                                    variant="ghost"
                                    size="sm"
                                    disabled={true}
                                    className="opacity-60 cursor-not-allowed bg-[#f5f5f7] text-[#6e6e73] border border-[#e5e5ea]"
                                    title={`Doctor has ${user?.doctorProfile?.cabinStatus === 'STEPPED_OUT' ? 'stepped out' : 'not entered cabin'}. Set presence to 'In Cabin' to call patient.`}
                                  >
                                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Doctor {user?.doctorProfile?.cabinStatus === 'STEPPED_OUT' ? 'Stepped Out' : 'Away'}</span>
                                  </AppleButton>
                                ) : appt.isCheckedIn ? (
                                  <AppleButton
                                    variant="primary"
                                    size="sm"
                                    disabled={callingId !== null}
                                    onClick={() => handleCallPatient(appt.id)}
                                  >
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                    <span>{callingId === appt.id ? 'Calling...' : 'Call Patient'}</span>
                                  </AppleButton>
                                ) : (
                                  <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-end">
                                    <AppleButton
                                      variant="ghost"
                                      size="sm"
                                      disabled={true}
                                      className="opacity-60 cursor-not-allowed bg-[#f5f5f7] text-[#6e6e73] border border-[#e5e5ea]"
                                      title="Patient has not arrived at the clinic yet. Mark patient arrival first."
                                    >
                                      <Clock className="w-3.5 h-3.5 text-[#86868b]" />
                                      <span>Awaiting Arrival</span>
                                    </AppleButton>
                                    <AppleButton
                                      variant="secondary"
                                      size="sm"
                                      disabled={togglingCheckinId === appt.id}
                                      onClick={() => handleToggleCheckIn(appt.id, false)}
                                      title="Mark patient as arrived at clinic"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 text-[#0066cc]" />
                                      <span>{togglingCheckinId === appt.id ? 'Updating...' : 'Mark Arrived'}</span>
                                    </AppleButton>
                                  </div>
                                )
                              ) : (
                                <AppleButton
                                  variant="ghost"
                                  size="sm"
                                  disabled={true}
                                  className="opacity-50 cursor-not-allowed bg-[#f5f5f7] text-[#6e6e73] border border-[#e5e5ea]"
                                  title="Scheduled for a future date. Only today's arrived patients can be called."
                                >
                                  <Clock className="w-3.5 h-3.5 text-[#86868b]" />
                                  <span>Scheduled for {appt.appointmentDate === queueData?.upcomingSummary?.tomorrowDate ? 'Tomorrow' : appt.appointmentDate}</span>
                                </AppleButton>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Completed List Accordion */}
                  {queueData && queueData.completedQueue.length > 0 && (
                    <div className="mt-8">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73] mb-3">
                        Completed Today ({queueData.completedQueue.length})
                      </h4>
                      <div className="space-y-2">
                        {queueData.completedQueue.map((appt) => (
                          <div
                            key={appt.id}
                            className="p-3.5 rounded-[14px] bg-white border border-[#e5e5ea] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs hover:border-[#d2d2d7] transition-all"
                          >
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="font-semibold text-[#6e6e73] tabular-nums">Token #{appt.queueNumber}</span>
                              <span className="font-semibold text-[#1d1d1f]">
                                {appt.patientName || appt.patient?.user?.fullName || 'Patient'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-200 text-[11px]">
                                Completed
                              </span>
                              <AppleButton
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/doctor/consultation/${appt.id}`)}
                                className="text-[#0066cc]"
                              >
                                Review Notes
                              </AppleButton>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Walk-in QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn print:hidden">
          <div className="bg-white rounded-[24px] border border-[#e5e5ea] max-w-md w-full p-6 shadow-apple-float relative text-center">
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] rounded-full hover:bg-[#f5f5f7] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-11 h-11 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-5 h-5" />
            </div>

            <h3 className="text-section-title">
              Walk-in Check-in QR Code
            </h3>
            <p className="text-meta mt-1">
              Patients scan this QR code at your reception or door to join today's queue directly.
            </p>

            <div className="my-5 p-4 rounded-[16px] bg-[#f5f5f7] border border-[#e5e5ea] inline-block">
              <img
                src={qrImageUrl}
                alt="Doctor Walk-in QR Code"
                className="w-52 h-52 object-contain rounded-[12px] bg-white p-2 border border-[#e5e5ea] mx-auto"
              />
              <div className="mt-3 text-center">
                <p className="font-semibold text-xs text-[#1d1d1f]">Dr. {doctorDisplayName}</p>
                <p className="text-[11px] text-[#6e6e73]">{user?.doctorProfile?.specialty || 'Specialist'} • {user?.doctorProfile?.clinicAddress || 'Clinic'}</p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={bookingUrl}
                  className="ui-input !h-9 !text-xs flex-1 bg-[#f5f5f7] select-all"
                />
                <AppleButton
                  size="sm"
                  variant={copiedLink ? 'secondary' : 'primary'}
                  onClick={handleCopyLink}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </AppleButton>
              </div>

              <div className="pt-1">
                <AppleButton
                  size="md"
                  variant="secondary"
                  onClick={() => window.print()}
                  className="w-full"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Clinic Poster</span>
                </AppleButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rapid Add Walk-in Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn print:hidden">
          <div className="bg-white rounded-[24px] border border-[#e5e5ea] max-w-md w-full p-6 shadow-apple-float relative text-left max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setWalkinError(null);
                setWalkinSuccess(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] rounded-full hover:bg-[#f5f5f7] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#e5e5ea]/70">
              <div className="w-10 h-10 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-section-title">
                  Add Walk-in Patient
                </h3>
                <p className="text-meta mt-0.5">
                  Instantly issue a live queue ticket for a walk-in patient.
                </p>
              </div>
            </div>

            {walkinError && (
              <div className="mb-4 p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{walkinError}</span>
              </div>
            )}

            {walkinSuccess && (
              <div className="mb-4 p-3 rounded-[12px] bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{walkinSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateWalkin} className="space-y-4">
              <div>
                <label className="ui-label">
                  Patient Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Smith"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  className="ui-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ui-label">
                    Age
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 34"
                    value={walkinAge}
                    onChange={(e) => setWalkinAge(e.target.value)}
                    className="ui-input"
                  />
                </div>
                <div>
                  <label className="ui-label">
                    Gender
                  </label>
                  <select
                    value={walkinGender}
                    onChange={(e) => setWalkinGender(e.target.value)}
                    className="ui-select"
                  >
                    <option value="Not Specified">Not Specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="ui-label">
                  Mobile Number (Optional)
                </label>
                <div className="flex rounded-[12px] border border-[#d2d2d7] overflow-hidden focus-within:ring-3 focus-within:ring-[#0066cc]/15 focus-within:border-[#0066cc] bg-white transition-all h-11">
                  <span className="inline-flex items-center px-3.5 bg-[#f5f5f7] border-r border-[#e5e5ea] text-[#1d1d1f] font-semibold text-[13px] select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="98765 43210"
                    maxLength={10}
                    value={sanitizeIndianPhone(walkinPhone)}
                    onChange={(e) => setWalkinPhone(sanitizeIndianPhone(e.target.value))}
                    className="flex-1 h-full px-3.5 text-sm bg-transparent text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none"
                  />
                </div>
              </div>

              {/* Clinic Affiliation Venue Selector */}
              {affiliations?.clinics && affiliations.clinics.length > 1 && (
                <div>
                  <label className="ui-label">
                    Clinic Venue <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={walkinClinicId}
                    onChange={(e) => {
                      setWalkinClinicId(e.target.value);
                      setWalkinSlotId('');
                    }}
                    className="ui-select"
                  >
                    <option value="">Select Clinic Venue</option>
                    {affiliations.clinics.map((c) => (
                      <option key={c.clinicId} value={c.clinicId}>
                        {c.clinicName} {c.city ? `(${c.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {affiliations && affiliations.clinics.length === 0 && (
                <div className="p-3 rounded-[12px] bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <span>No active clinic affiliations found. Please affiliate with a verified clinic to issue walk-in queue tokens.</span>
                </div>
              )}

              <div>
                <label className="ui-label">
                  Checking Shift
                </label>
                <select
                  value={walkinSlotId}
                  onChange={(e) => setWalkinSlotId(e.target.value)}
                  className="ui-select"
                >
                  <option value="">Current / Default Shift</option>
                  {(
                    (walkinClinicId && affiliations?.clinics.find((c) => c.clinicId === walkinClinicId)?.slots) ||
                    (affiliations?.clinics?.length === 1 && affiliations.clinics[0].slots) ||
                    parseDoctorSlots(user?.doctorProfile)
                  ).map((slot, i) => (
                    <option key={slot.id || i} value={slot.id}>
                      {slot.name} ({format12Hour(slot.startTime)}–{format12Hour(slot.endTime)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="ui-label">
                  Reason for Visit / Symptoms
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fever, cough, general consultation"
                  value={walkinReason}
                  onChange={(e) => setWalkinReason(e.target.value)}
                  className="ui-input"
                />
              </div>

              <div className="pt-2">
                <AppleButton
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={walkinSubmitting}
                  className="w-full"
                >
                  <Plus className="w-4 h-4" />
                  <span>{walkinSubmitting ? 'Issuing Ticket...' : 'Queue Walk-in Patient'}</span>
                </AppleButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Printable Clinic Poster (Rendered ONLY when doctor prints poster) */}
      <div className="hidden print:block font-sans text-black p-12 bg-white max-w-xl mx-auto text-center border-4 border-black rounded-3xl my-8">
        <div className="mb-6">
          <div className="inline-block px-4 py-1.5 rounded-full border-2 border-black text-xs font-bold uppercase tracking-widest mb-3">
            MediArca Instant Walk-in Check-in
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-black">
            Dr. {doctorDisplayName}
          </h1>
          <p className="text-base font-semibold text-gray-800 mt-1">
            {user?.doctorProfile?.specialty || 'General Specialist'}
          </p>
          {user?.doctorProfile?.qualifications && (
            <p className="text-xs text-gray-600 font-medium mt-0.5">{formatDoctorDegrees(user.doctorProfile.qualifications)}</p>
          )}
          {user?.doctorProfile?.clinicAddress && (
            <p className="text-xs text-gray-600 mt-1">{user.doctorProfile.clinicAddress}</p>
          )}
        </div>

        <div className="my-8 p-6 inline-block border-2 border-dashed border-gray-400 rounded-2xl bg-white shadow-xs">
          <img
            src={qrImageUrl}
            alt="Doctor Walk-in QR Code"
            className="w-72 h-72 object-contain mx-auto"
          />
        </div>

        <div className="space-y-2 max-w-sm mx-auto">
          <h2 className="text-lg font-bold text-black tracking-tight">
            Scan with Your Phone to Join Today's Live Queue
          </h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            No account creation required. Point your smartphone camera at this code to get a live guaranteed queue token.
          </p>
          <div className="pt-4 border-t border-gray-200 mt-4 text-[11px] text-gray-500 font-medium break-all">
            {bookingUrl}
          </div>
        </div>
      </div>

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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
            <div className="relative w-full max-w-2xl bg-white rounded-[24px] border border-[#e5e5ea] shadow-apple-float overflow-hidden flex flex-col max-h-[88vh]">
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-[#e5e5ea] flex items-start justify-between gap-4 bg-[#f5f5f7]/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-section-title">
                      Affiliate Clinic or Hospital
                    </h3>
                    <p className="text-meta mt-0.5">
                      Search verified clinics and associate your practice to receive outpatient bookings.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAffiliateModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/5 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* In-Modal Feedback Alerts */}
              {feedbackSuccess && (
                <div className="mx-5 mt-4 p-3 rounded-[12px] bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{feedbackSuccess}</span>
                  </div>
                  <button onClick={() => setFeedbackSuccess(null)} className="text-emerald-700 hover:text-emerald-900">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {feedbackError && (
                <div className="mx-5 mt-4 p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
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
              <div className="p-4 sm:p-5 border-b border-[#e5e5ea] bg-white space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={clinicSearchQuery}
                    onChange={(e) => setClinicSearchQuery(e.target.value)}
                    placeholder="Search clinic by name, address, or area..."
                    className="ui-input !pl-10 !pr-9"
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
                      <span className="text-meta">State:</span>
                      <select
                        value={clinicStateFilter}
                        onChange={(e) => {
                          setClinicStateFilter(e.target.value);
                          setClinicCityFilter('All');
                        }}
                        className="h-8 px-2.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0066cc]"
                      >
                        <option value="All">All States</option>
                        {availableStates.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(availableCities.length > 0 || clinicStateFilter !== 'All') && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-meta">City:</span>
                      <select
                        value={clinicCityFilter}
                        onChange={(e) => setClinicCityFilter(e.target.value)}
                        className="h-8 px-2.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0066cc]"
                      >
                        <option value="All">All Cities</option>
                        {availableCities.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <span className="text-meta ml-auto">
                    {filteredPublicClinics.length} verified {filteredPublicClinics.length === 1 ? 'clinic' : 'clinics'} found
                  </span>
                </div>
              </div>

              {/* Clinics List */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 bg-[#f5f5f7]/50">
                {filteredPublicClinics.length === 0 ? (
                  <div className="py-12 text-center">
                    <Building2 className="w-10 h-10 text-[#86868b] mx-auto mb-2 opacity-50" />
                    <p className="text-card-title">No Verified Clinics Found</p>
                    <p className="text-meta mt-1 max-w-sm mx-auto">
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
                        className="mt-3 px-3 py-1 rounded-full text-xs font-medium text-[#0066cc] bg-[#0066cc]/10 hover:bg-[#0066cc]/20 transition-all cursor-pointer"
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
                        className="p-4 rounded-[16px] bg-white border border-[#e5e5ea] hover:border-[#d2d2d7] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-card-title">
                              {c.clinicName}
                            </h4>
                            <span
                              title="Verified Healthcare Facility"
                              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20"
                            >
                              <CheckCircle2 className="w-3 h-3 text-[#0066cc]" />
                              Verified
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-meta mt-1 truncate">
                            <MapPin className="w-3.5 h-3.5 shrink-0 text-[#86868b]" />
                            <span className="truncate">
                              {c.address}
                              {c.city ? `, ${c.city}` : ''}
                              {c.state ? `, ${c.state}` : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-[#6e6e73] mt-2">
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

                        <div className="shrink-0 flex items-center justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[#e5e5ea]/70">
                          {isAffiliated ? (
                            <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Affiliated
                            </span>
                          ) : isPending ? (
                            <span className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold flex items-center gap-1.5">
                              <Clock3 className="w-3.5 h-3.5" />
                              Request Pending
                            </span>
                          ) : hasIncoming ? (
                            <span className="px-3 py-1.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20 text-xs font-semibold flex items-center gap-1.5">
                              Clinic Requested You
                            </span>
                          ) : (
                            <AppleButton
                              size="sm"
                              variant="primary"
                              disabled={isAddingThis}
                              onClick={() => handleAddClinic(c.id)}
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
                            </AppleButton>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[#e5e5ea] bg-[#f5f5f7]/50 flex items-center justify-between text-meta px-6">
                <span>Only administrator-verified clinics can be affiliated.</span>
                <AppleButton
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsAffiliateModalOpen(false)}
                >
                  Close
                </AppleButton>
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
    </DashboardLayout>
  );
};
