import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  api,
  Appointment,
  parseDoctorSlots,
  format12Hour,
  getLocalDateString,
  DoctorAffiliationsData,
  ClinicProfile,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
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
  UserPlus,
  Plus,
  AlertCircle,
  X,
  MapPin,
  DollarSign,
  Settings,
  Check,
  UserCheck,
  UserX,
  Clock3,
  LayoutDashboard,
  Calendar,
  QrCode,
  Zap,
  ClipboardList,
  Printer,
  Copy,
  ChevronRight,
  Share2,
} from 'lucide-react';

export const DoctorDashboard: React.FC = () => {
  const { user, loading: loadingAuth } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'queue' | 'affiliations'>('queue');
  const [affiliations, setAffiliations] = useState<DoctorAffiliationsData | null>(null);
  const [publicClinics, setPublicClinics] = useState<ClinicProfile[]>([]);
  const [affiliationsLoading, setAffiliationsLoading] = useState(false);

  // Form states for clinic affiliation
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [date, setDate] = useState<string>(() => getLocalDateString());
  const [queueData, setQueueData] = useState<{
    date: string;
    totalQueue: number;
    activeInConsultation: Appointment | null;
    waitingQueue: Appointment[];
    completedQueue: Appointment[];
    allAppointments: Appointment[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [callingId, setCallingId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDoctorQueue(date);
      setQueueData(data);
      setFetchError(null);
    } catch (err: any) {
      console.error('Failed to load doctor queue:', err);
      setFetchError(err.message || 'Unable to connect to healthcare backend');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    if (loadingAuth) return;
    if (!user || user.role?.toUpperCase() !== 'DOCTOR') {
      navigate('/login');
      return;
    }
    fetchQueue();

    // Auto refresh every 10 seconds for real-time clinic updates
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, [fetchQueue, user, loadingAuth, navigate]);

  const fetchAffiliations = useCallback(async () => {
    setAffiliationsLoading(true);
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
    if (activeTab === 'affiliations') {
      fetchAffiliations();
    }
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
      });
      setWalkinSuccess(`Patient ${walkinName} successfully queued!`);
      setWalkinName('');
      setWalkinAge('');
      setWalkinPhone('');
      setWalkinReason('');
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
    try {
      const res = await api.addDoctorClinic({ clinicId });
      setFeedbackSuccess(res.message || 'Clinic affiliated successfully');
      fetchAffiliations();
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to affiliate clinic');
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

  const isVerified = user?.doctorProfile?.isVerified ?? true;
  const totalPendingRequests = affiliations?.incomingRequests?.length || 0;

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
      id: 'appointments',
      label: 'Appointments',
      icon: Calendar,
      active: false,
      onClick: scrollToQueue,
      badge: queueData?.waitingQueue.length || undefined,
    },
    {
      id: 'walkin-qr',
      label: 'Walk-in QR',
      icon: QrCode,
      onClick: () => setShowQrModal(true),
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
      label: 'Manage Schedule',
      icon: Clock,
      path: '/doctor/schedule',
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
      title={`Good ${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, Dr. ${user?.fullName || 'Doctor'}`}
      subtitle={user?.doctorProfile?.specialty ? `${user.doctorProfile.specialty} • ${user?.doctorProfile?.clinicAddress || 'Practice Console'}` : 'Practice Queue & Patient Roster'}
      headerAction={
        <div className="flex items-center gap-2">
          <AppleButton
            variant="ghost"
            size="sm"
            onClick={() => {
              if (activeTab === 'queue') fetchQueue();
              else fetchAffiliations();
            }}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </AppleButton>
          <AppleButton
            variant="primary"
            size="sm"
            onClick={scrollToQueue}
            className="flex items-center gap-1.5 shadow-sm bg-[#0088e8] hover:bg-[#0077cc]"
          >
            <Calendar className="w-3.5 h-3.5" />
            Manage Appointments
          </AppleButton>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs (Quick pill switch) */}
        <div className="flex items-center gap-2 border-b border-[#e5e5ea] pb-3">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'queue'
                ? 'bg-[#1d1d1f] text-white shadow-sm'
                : 'bg-white text-[#1d1d1f] hover:bg-[#f5f5f7] border border-[#e5e5ea]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Live Patient Queue</span>
            {queueData && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === 'queue' ? 'bg-white/20 text-white' : 'bg-[#f5f5f7] text-[#86868b]'
                }`}
              >
                {queueData.waitingQueue.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('affiliations');
              fetchAffiliations();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'affiliations'
                ? 'bg-[#1d1d1f] text-white shadow-sm'
                : 'bg-white text-[#1d1d1f] hover:bg-[#f5f5f7] border border-[#e5e5ea]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Affiliated Clinics & Staff</span>
            {affiliations && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === 'affiliations' ? 'bg-white/20 text-white' : 'bg-[#f5f5f7] text-[#86868b]'
                }`}
              >
                {affiliations.clinics.length + affiliations.receptionists.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'affiliations' ? (
          <div className="space-y-8 animate-fadeIn">
            {/* Feedback Alerts */}
            {feedbackSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{feedbackSuccess}</span>
                </div>
                <button
                  onClick={() => setFeedbackSuccess(null)}
                  className="text-emerald-700 hover:text-emerald-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {feedbackError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{feedbackError}</span>
                </div>
                <button
                  onClick={() => setFeedbackError(null)}
                  className="text-rose-700 hover:text-rose-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Metrics Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <UtilityCard className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#86868b] uppercase font-semibold">Affiliated Clinics</span>
                  <h3 className="text-3xl font-bold text-[#1d1d1f] mt-1 tracking-tight">
                    {affiliations?.clinics.length || 0}
                  </h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-[#0088e8]/10 text-[#0088e8] flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
              </UtilityCard>

              <UtilityCard className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#86868b] uppercase font-semibold">Linked Receptionists</span>
                  <h3 className="text-3xl font-bold text-purple-600 mt-1 tracking-tight">
                    {affiliations?.receptionists.length || 0}
                  </h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
              </UtilityCard>

              <UtilityCard className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#86868b] uppercase font-semibold">Clinic Attributed Revenue</span>
                  <h3 className="text-3xl font-bold text-emerald-600 mt-1 tracking-tight">
                    ${(
                      affiliations?.clinics.reduce(
                        (sum: number, c) => sum + (c.revenue || 0),
                        0
                      ) || 0
                    ).toLocaleString('en-US')}
                  </h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
              </UtilityCard>
            </div>

            {/* Incoming Clinic Affiliation Invitations */}
            {affiliations?.incomingRequests && affiliations.incomingRequests.length > 0 && (
              <div className="bg-white rounded-[20px] border-2 border-[#0088e8]/30 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#0088e8]/10 text-[#0088e8] flex items-center justify-center">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#1d1d1f]">
                        Incoming Clinic Invitations ({affiliations.incomingRequests.length})
                      </h3>
                      <p className="text-xs text-[#86868b]">
                        These verified facilities have invited you to practice. Accept to enable clinic walk-ins and patient bookings.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {affiliations.incomingRequests.map((req) => (
                    <div
                      key={req.affiliationId}
                      className="rounded-2xl border border-[#e5e5ea] p-4 bg-[#f0f9ff]/40 flex flex-col justify-between"
                    >
                      <div>
                        <h4 className="font-semibold text-sm text-[#1d1d1f]">{req.clinicName}</h4>
                        <p className="text-xs text-[#86868b] flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-[#86868b]" />
                          {req.address}{req.city ? `, ${req.city}` : ''}
                        </p>
                        {req.phone && (
                          <p className="text-[11px] text-[#86868b] mt-0.5">Phone: {req.phone}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#e5e5ea]">
                        <AppleButton
                          size="sm"
                          variant="primary"
                          onClick={() => handleRespondClinicAffiliation(req.affiliationId, 'ACCEPT')}
                          className="flex-1 flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Accept Invitation
                        </AppleButton>
                        <AppleButton
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRespondClinicAffiliation(req.affiliationId, 'REJECT')}
                          className="text-rose-600 hover:bg-rose-50 flex-1 flex items-center justify-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          Decline
                        </AppleButton>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Outgoing Clinic Requests */}
            {affiliations?.outgoingRequests && affiliations.outgoingRequests.length > 0 && (
              <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Clock3 className="w-4 h-4 text-amber-600" />
                  <h3 className="text-base font-semibold text-[#1d1d1f]">
                    Pending Clinic Approvals ({affiliations.outgoingRequests.length})
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {affiliations.outgoingRequests.map((req) => (
                    <div
                      key={req.affiliationId}
                      className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-semibold text-sm text-[#1d1d1f]">{req.clinicName}</h4>
                        <p className="text-xs text-[#86868b] mt-0.5">{req.address}{req.city ? `, ${req.city}` : ''}</p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        Awaiting Clinic
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 1: Affiliated Clinics */}
            <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-[#1d1d1f] tracking-tight">
                      Affiliated Clinics & Hospitals
                    </h3>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f]">
                      {affiliations?.clinics.length || 0}
                    </span>
                  </div>
                  <p className="text-xs text-[#86868b] mt-0.5">
                    Clinics where you practice. You receive direct patient bookings and live queue tokens from these facilities.
                  </p>
                </div>

                {/* Quick Add Clinic Dropdown */}
                {(() => {
                  const unaffiliatedClinics = publicClinics.filter(
                    (pc: ClinicProfile) => pc.isVerified && !affiliations?.clinics.some((ac) => ac.clinicId === pc.id)
                  );
                  return unaffiliatedClinics.length > 0 ? (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <select
                        value={selectedClinicId}
                        onChange={(e) => setSelectedClinicId(e.target.value)}
                        className="h-10 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] w-full sm:w-64"
                      >
                        <option value="">Select Verified Clinic to Affiliate...</option>
                        {unaffiliatedClinics.map((c: ClinicProfile) => (
                          <option key={c.id} value={c.id}>
                            {c.clinicName} {c.city ? `(${c.city})` : ''}
                          </option>
                        ))}
                      </select>
                      <AppleButton
                        size="sm"
                        variant="primary"
                        disabled={!selectedClinicId}
                        onClick={() => {
                          if (selectedClinicId) {
                            handleAddClinic(selectedClinicId);
                            setSelectedClinicId('');
                          }
                        }}
                        className="flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Affiliate
                      </AppleButton>
                    </div>
                  ) : (
                    <span className="text-xs text-[#86868b] italic">
                      {publicClinics.length === 0
                        ? 'No verified clinics currently available'
                        : 'Affiliated with all verified clinics'}
                    </span>
                  );
                })()}
              </div>

              {affiliationsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-32 rounded-[20px] bg-[#f5f5f7] animate-pulse" />
                  ))}
                </div>
              ) : affiliations?.clinics.length === 0 ? (
                <div className="p-8 text-center bg-[#f5f5f7]/50 rounded-2xl border border-dashed border-[#e5e5ea]">
                  <Building2 className="w-10 h-10 text-[#86868b] mx-auto mb-2 opacity-60" />
                  <h4 className="text-sm font-semibold text-[#1d1d1f]">No Clinics Affiliated</h4>
                  <p className="text-xs text-[#86868b] mt-1 max-w-md mx-auto">
                    Select a clinic from the dropdown above to affiliate your practice, enable clinic walk-ins, and track isolated facility revenue.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {affiliations?.clinics.map((clinic) => (
                    <div
                      key={clinic.clinicId}
                      className="rounded-2xl border border-[#e5e5ea] p-5 hover:border-[#0088e8]/40 transition-all flex flex-col justify-between bg-white shadow-sm"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#0088e8]/10 text-[#0088e8] flex items-center justify-center font-bold flex-shrink-0">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-base text-[#1d1d1f] tracking-tight">
                                {clinic.clinicName}
                              </h4>
                              <p className="text-xs text-[#86868b] flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-[#86868b]" />
                                {clinic.address}{clinic.city ? `, ${clinic.city}` : ''}
                              </p>
                            </div>
                          </div>
                          <AppleButton
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveClinic(clinic.clinicId, clinic.clinicName)}
                            className="text-rose-600 hover:bg-rose-50 p-2 h-8 w-8 rounded-full flex items-center justify-center"
                            title="Detach from Clinic"
                          >
                            <Trash2 className="w-4 h-4" />
                          </AppleButton>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#f5f5f7]">
                          <div className="bg-[#f5f5f7] rounded-xl p-2.5 text-center">
                            <span className="text-[10px] uppercase font-semibold text-[#86868b]">
                              Clinic Bookings
                            </span>
                            <p className="text-base font-bold text-[#1d1d1f] mt-0.5">
                              {clinic.bookingCount}
                            </p>
                          </div>
                          <div className="bg-emerald-50 rounded-xl p-2.5 text-center border border-emerald-100">
                            <span className="text-[10px] uppercase font-semibold text-emerald-700">
                              Attributed Revenue
                            </span>
                            <p className="text-base font-bold text-emerald-700 mt-0.5">
                              ${(clinic.revenue ?? 0).toLocaleString('en-US')}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 text-[11px] text-[#86868b] flex items-center justify-between pt-2 border-t border-[#f5f5f7]">
                        <span>Phone: {clinic.phone || 'N/A'}</span>
                        <span>Affiliated: {clinic.joinedAt ? new Date(clinic.joinedAt).toLocaleDateString() : 'Active'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Authorized Clinic Receptionists */}
            <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 shadow-sm">
              <div className="mb-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-[#1d1d1f] tracking-tight">
                    Authorized Clinic Desk Staff
                  </h3>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f]">
                    {affiliations?.receptionists.length || 0}
                  </span>
                </div>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Receptionists provisioned and assigned to your desk by affiliated clinic administrators. They issue walk-in passes and manage patient queues on your behalf.
                </p>
              </div>

              {affiliationsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-24 rounded-[20px] bg-[#f5f5f7] animate-pulse" />
                  ))}
                </div>
              ) : affiliations?.receptionists.length === 0 ? (
                <div className="p-8 text-center bg-[#f5f5f7]/50 rounded-2xl border border-dashed border-[#e5e5ea]">
                  <Users className="w-10 h-10 text-[#86868b] mx-auto mb-2 opacity-60" />
                  <h4 className="text-sm font-semibold text-[#1d1d1f]">No Desk Staff Assigned</h4>
                  <p className="text-xs text-[#86868b] mt-1 max-w-md mx-auto">
                    Your affiliated clinic administrators can assign desk receptionists to manage queues and book walk-in appointments for you.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {affiliations?.receptionists.map((rec) => (
                    <div
                      key={rec.receptionistId}
                      className="rounded-2xl border border-[#e5e5ea] p-5 hover:border-[#0088e8]/40 transition-all flex items-center justify-between gap-4 bg-white shadow-sm"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold flex-shrink-0">
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm text-[#1d1d1f] truncate">
                              {rec.fullName}
                            </h4>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Active Desk
                            </span>
                            {rec.clinicName && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 truncate max-w-[140px]">
                                {rec.clinicName}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#86868b] truncate mt-0.5">{rec.email}</p>
                          {rec.phone && (
                            <p className="text-[11px] text-[#86868b] mt-0.5">Phone: {rec.phone}</p>
                          )}
                          <p className="text-[10px] text-[#86868b] mt-1">
                            Linked: {new Date(rec.joinedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <AppleButton
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveReceptionist(rec.receptionistId, rec.fullName)}
                        className="text-rose-600 hover:bg-rose-50 p-2 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                        title="Unlink Receptionist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </AppleButton>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            {/* Verification Warning if Doctor is unverified */}
            {!isVerified && (
              <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-3 shadow-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
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
              <div className="mb-6 p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#0088e8] animate-spin" />
                  <span>Connecting to cloud database... (Cloud backend may take 30s to resume from idle)</span>
                </div>
                <AppleButton variant="ghost" size="sm" onClick={fetchQueue} className="text-[#0088e8]">
                  Retry
                </AppleButton>
              </div>
            )}

            {/* Top Shift & Date Selector Header */}
            <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-[#1d1d1f] tracking-tight">{user?.fullName}</h2>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#0088e8]/10 text-[#0088e8]">
                    {user?.doctorProfile?.specialty || 'Doctor'}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#86868b]">
                  <Clock className="w-3.5 h-3.5 text-[#0088e8]" />
                  <span>Practice Shifts:</span>
                  {parseDoctorSlots(user?.doctorProfile).map((slot, i) => (
                    <span
                      key={slot.id || i}
                      className="font-semibold px-2.5 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f]"
                    >
                      {slot.name} ({format12Hour(slot.startTime)}–{format12Hour(slot.endTime)} • {slot.maxPatients} cap)
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-[#86868b]">Queue Date:</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-10 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8]"
                />
              </div>
            </div>

            {/* Top 2 Metric Cards (Matches media_1789192783321.jpg) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
              {/* Card 1: Total Bookings */}
              <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 shadow-sm transition-all hover:shadow-md">
                <div className="w-10 h-10 rounded-xl bg-[#0088e8]/10 text-[#0088e8] flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-4xl font-bold text-[#1d1d1f] mt-4 tracking-tight">
                  {queueData?.totalQueue || 0}
                </h3>
                <p className="text-xs text-[#86868b] font-medium mt-1">
                  Total Bookings
                </p>
              </div>

              {/* Card 2: Completed Consultations */}
              <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 shadow-sm transition-all hover:shadow-md">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="text-4xl font-bold text-[#1d1d1f] mt-4 tracking-tight">
                  {queueData?.completedQueue.length || 0}
                </h3>
                <p className="text-xs text-[#86868b] font-medium mt-1">
                  Completed Consultations
                </p>
              </div>
            </div>

            {/* Middle 2-Column Section: Quick Actions & Recent Activity (Matches media_1789192783321.jpg) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Left: Quick Actions */}
              <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4 text-[#0088e8] fill-[#0088e8]" />
                  <h3 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">
                    Quick Actions
                  </h3>
                </div>

                <div className="space-y-3">
                  {/* Action 1: View Appointments */}
                  <button
                    type="button"
                    onClick={scrollToQueue}
                    className="w-full rounded-2xl border border-[#e0f2fe] bg-[#f0f9ff]/60 hover:bg-[#f0f9ff] p-3.5 flex items-center justify-between text-left transition-all group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-[#0088e8] text-white flex items-center justify-center shadow-xs flex-shrink-0">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[#1d1d1f] group-hover:text-[#0088e8] transition-colors">
                          View Appointments
                        </h4>
                        <p className="text-xs text-[#86868b] mt-0.5">
                          {queueData?.totalQueue || 0} total bookings
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#86868b] group-hover:text-[#0088e8] transition-colors" />
                  </button>

                  {/* Action 2: Walk-in QR Code */}
                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    className="w-full rounded-2xl border border-[#d1fae5] bg-[#f0fdf4]/70 hover:bg-[#f0fdf4] p-3.5 flex items-center justify-between text-left transition-all group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-[#10b981] text-white flex items-center justify-center shadow-xs flex-shrink-0">
                        <QrCode className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[#1d1d1f] group-hover:text-[#10b981] transition-colors">
                          Walk-in QR Code
                        </h4>
                        <p className="text-xs text-[#86868b] mt-0.5">
                          Print poster & share link
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#86868b] group-hover:text-[#10b981] transition-colors" />
                  </button>

                  {/* Action 3: Add Appointment */}
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="w-full rounded-2xl border border-[#ede9fe] bg-[#f5f3ff]/70 hover:bg-[#f5f3ff] p-3.5 flex items-center justify-between text-left transition-all group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-[#8b5cf6] text-white flex items-center justify-center shadow-xs flex-shrink-0">
                        <Plus className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[#1d1d1f] group-hover:text-[#8b5cf6] transition-colors">
                          Add Appointment
                        </h4>
                        <p className="text-xs text-[#86868b] mt-0.5">
                          Log new walk-in patient
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#86868b] group-hover:text-[#8b5cf6] transition-colors" />
                  </button>
                </div>
              </div>

              {/* Right: Recent Activity */}
              <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-[#86868b]" />
                    <h3 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">
                      Recent Activity
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={scrollToQueue}
                    className="text-xs font-semibold text-[#0088e8] hover:underline flex items-center gap-1"
                  >
                    View All &rarr;
                  </button>
                </div>

                {(!queueData?.allAppointments || queueData.allAppointments.length === 0) ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] flex items-center justify-center text-[#86868b] mb-3">
                      <ClipboardList className="w-6 h-6 stroke-1" />
                    </div>
                    <h4 className="text-sm font-semibold text-[#1d1d1f]">
                      No appointments yet
                    </h4>
                    <p className="text-xs text-[#86868b] mt-1">
                      Patient bookings will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 flex-1">
                    {queueData.allAppointments.slice(0, 3).map((appt) => (
                      <div
                        key={appt.id}
                        className="p-3 rounded-xl border border-[#e5e5ea] hover:border-[#0088e8]/30 transition-all flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-[#1d1d1f] text-white font-bold text-[11px] flex items-center justify-center flex-shrink-0">
                            #{appt.queueNumber}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#1d1d1f] truncate">
                              {appt.isForOther && appt.patientName ? appt.patientName : appt.patient?.user.fullName}
                            </p>
                            <p className="text-[11px] text-[#86868b] truncate">
                              {appt.estimatedTime} • {appt.checkingWindow || 'Shift'}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            appt.status === 'IN_CONSULTATION'
                              ? 'bg-emerald-100 text-emerald-800'
                              : appt.status === 'COMPLETED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {appt.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Practice Summary Card (Matches media_1789192783321.jpg) */}
            <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 shadow-sm mb-8">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-[#0088e8]" />
                <h3 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">
                  Practice Summary
                </h3>
              </div>
              <p className="text-xs text-[#86868b]">
                You have <strong className="text-[#1d1d1f]">{queueData?.completedQueue.length || 0}</strong> completed consultation sessions logged on MediArca.
              </p>
            </div>

            {/* Live Queue Station Anchor & Shifts */}
            <div id="live-queue-section" className="scroll-mt-6">

            {/* Main Console Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Active In-Consultation Patient (1 Column) */}
              <div className="lg:col-span-1">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#86868b] mb-3">
                  Active Patient in Cabin
                </h3>

                {queueData?.activeInConsultation ? (
                  <div className="bg-white rounded-[20px] border-2 border-emerald-500/40 p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <span className="bg-emerald-50 text-emerald-700 font-semibold text-xs px-2.5 py-1 rounded-full border border-emerald-200 animate-pulse">
                        IN CONSULTATION
                      </span>
                      <span className="text-xl font-bold text-[#1d1d1f]">
                        Queue #{queueData.activeInConsultation.queueNumber}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xl font-semibold text-[#1d1d1f] tracking-tight">
                        {queueData.activeInConsultation.isForOther && queueData.activeInConsultation.patientName
                          ? queueData.activeInConsultation.patientName
                          : queueData.activeInConsultation.patient?.user.fullName}
                      </h4>
                      {queueData.activeInConsultation.isForOther && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0088e8]/10 text-[#0088e8] border border-[#0088e8]/20">
                          Booked for family ({queueData.activeInConsultation.patientAge ? `Age ${queueData.activeInConsultation.patientAge}` : 'Other'} • by {queueData.activeInConsultation.patient?.user.fullName})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#86868b] mt-0.5">
                      Scheduled for {queueData.activeInConsultation.estimatedTime}
                    </p>

                    <div className="my-4 p-3 rounded-xl bg-[#f5f5f7] text-xs text-[#1d1d1f] space-y-1">
                      <div>
                        <strong className="text-[#86868b]">Reason: </strong>
                        {queueData.activeInConsultation.reasonForVisit || 'General Consultation'}
                      </div>
                      {queueData.activeInConsultation.symptoms && (
                        <div>
                          <strong className="text-[#86868b]">Symptoms: </strong>
                          {queueData.activeInConsultation.symptoms}
                        </div>
                      )}
                    </div>

                    <AppleButton
                      variant="primary"
                      size="md"
                      onClick={() =>
                        navigate(`/doctor/consultation/${queueData.activeInConsultation?.id}`)
                      }
                      className="w-full flex items-center gap-1.5"
                    >
                      <FileEdit className="w-4 h-4" />
                      Continue Consultation & Notes
                    </AppleButton>
                  </div>
                ) : (
                  <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-8 text-center">
                    <Stethoscope className="w-10 h-10 text-[#86868b] mx-auto mb-2" />
                    <h4 className="text-sm font-semibold text-[#1d1d1f]">Cabin is Free</h4>
                    <p className="text-xs text-[#86868b] mt-1 leading-relaxed">
                      No patient currently in consultation. Click "Call Patient" on the waiting queue below.
                    </p>
                  </div>
                )}
              </div>

              {/* Waiting Queue List (2 Columns) */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[#86868b]">
                    Waiting Queue ({queueData?.waitingQueue.length || 0})
                  </h3>
                  {queueData && queueData.waitingQueue.length > 0 && (
                    <AppleButton
                      variant="primary"
                      size="sm"
                      disabled={callingId !== null}
                      onClick={() => handleCallPatient(queueData.waitingQueue[0].id)}
                      className="flex items-center gap-1.5 shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {callingId === queueData.waitingQueue[0].id
                        ? 'Calling Next Patient...'
                        : `Next Patient: Call Queue #${queueData.waitingQueue[0].queueNumber}`}
                    </AppleButton>
                  )}
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-24 rounded-[20px] bg-white border border-[#e5e5ea] animate-pulse"></div>
                    ))}
                  </div>
                ) : queueData?.waitingQueue.length === 0 ? (
                  <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-8 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <h4 className="text-base font-semibold text-[#1d1d1f]">Queue is Clear</h4>
                    <p className="text-xs text-[#86868b] mt-1">
                      All patients scheduled for this date have either completed consultation or not yet booked.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {queueData?.waitingQueue.map((appt) => (
                      <div
                        key={appt.id}
                        className="bg-white rounded-[20px] border border-[#e5e5ea] p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-[#0088e8]/40 transition-all duration-200"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-[#1d1d1f] text-white flex flex-col items-center justify-center font-bold">
                            <span className="text-[9px] uppercase tracking-wider text-[#0088e8]">Queue</span>
                            <span className="text-lg leading-none">#{appt.queueNumber}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-[16px] font-semibold text-[#1d1d1f]">
                                {appt.isForOther && appt.patientName ? appt.patientName : appt.patient?.user.fullName}
                              </h4>
                              {appt.isForOther && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0088e8]/10 text-[#0088e8] border border-[#0088e8]/20">
                                  Family ({appt.patientAge ? `Age ${appt.patientAge}` : 'Other'} • by {appt.patient?.user.fullName})
                                </span>
                              )}
                              {appt.checkingWindow && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#0088e8]">
                                  {appt.checkingWindow}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#86868b] flex items-center gap-1.5 mt-0.5">
                              <span>Est. {appt.estimatedTime}</span>
                              <span>•</span>
                              <span className="text-[#0088e8]">
                                {appt.reasonForVisit || 'General Medical'}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <AppleButton
                            variant="primary"
                            size="sm"
                            disabled={callingId === appt.id}
                            onClick={() => handleCallPatient(appt.id)}
                            className="flex items-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            {callingId === appt.id ? 'Calling...' : 'Call Patient'}
                          </AppleButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Completed List Accordion */}
                {queueData && queueData.completedQueue.length > 0 && (
                  <div className="mt-8">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#86868b] mb-3">
                      Completed Today ({queueData.completedQueue.length})
                    </h4>
                    <div className="space-y-2">
                      {queueData.completedQueue.map((appt) => (
                        <div
                          key={appt.id}
                          className="p-3.5 rounded-2xl bg-white border border-[#e5e5ea] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs hover:border-[#0088e8]/30 transition-all"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[#86868b]">Queue #{appt.queueNumber}</span>
                            <span className="font-medium text-[#1d1d1f]">
                              {appt.isForOther && appt.patientName ? `${appt.patientName} (Family)` : appt.patient?.user.fullName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-medium border border-emerald-200">
                              Prescription Issued
                            </span>
                            <AppleButton
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/doctor/consultation/${appt.id}`)}
                              className="text-[#0088e8] text-[11px] py-1 px-2.5"
                            >
                              Review / Print
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

      {/* Walk-in QR Code Modal (media_1789192783321.jpg) */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-[24px] border border-[#e5e5ea] max-w-md w-full p-6 shadow-2xl relative text-center">
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 text-[#86868b] hover:text-[#1d1d1f] rounded-full hover:bg-[#f5f5f7] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-[#10b981]/10 text-[#10b981] flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-[#1d1d1f] tracking-tight">
              Walk-in Check-in QR Code
            </h3>
            <p className="text-xs text-[#86868b] mt-1">
              Patients scan this QR code at your reception or door to join today's queue directly without signing up.
            </p>

            <div className="my-5 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] inline-block">
              <img
                src={qrImageUrl}
                alt="Doctor Walk-in QR Code"
                className="w-52 h-52 object-contain rounded-xl bg-white p-2 shadow-xs mx-auto"
              />
              <div className="mt-3 text-center">
                <p className="font-semibold text-xs text-[#1d1d1f]">Dr. {user?.fullName}</p>
                <p className="text-[11px] text-[#86868b]">{user?.doctorProfile?.specialty || 'Specialist'} • {user?.doctorProfile?.clinicAddress || 'Clinic'}</p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={bookingUrl}
                  className="flex-1 text-xs bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl px-3 py-2 text-[#1d1d1f] select-all focus:outline-none"
                />
                <AppleButton
                  size="sm"
                  variant={copiedLink ? 'secondary' : 'primary'}
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 whitespace-nowrap"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? 'Copied' : 'Copy'}
                </AppleButton>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <AppleButton
                  size="md"
                  variant="secondary"
                  onClick={() => window.print()}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print Clinic Poster
                </AppleButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rapid Add Walk-in Patient Modal (media_1789192783321.jpg) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-[24px] border border-[#e5e5ea] max-w-md w-full p-6 shadow-2xl relative text-left">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setWalkinError(null);
                setWalkinSuccess(null);
              }}
              className="absolute top-4 right-4 p-2 text-[#86868b] hover:text-[#1d1d1f] rounded-full hover:bg-[#f5f5f7] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#8b5cf6]/10 text-[#8b5cf6] flex items-center justify-center flex-shrink-0">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1d1d1f] tracking-tight">
                  Add Walk-in Patient
                </h3>
                <p className="text-xs text-[#86868b]">
                  Instantly issue a live queue ticket for a walk-in patient.
                </p>
              </div>
            </div>

            {walkinError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{walkinError}</span>
              </div>
            )}

            {walkinSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{walkinSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateWalkin} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#86868b] uppercase mb-1">
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Smith"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] focus:outline-none focus:border-[#0088e8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#86868b] uppercase mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 34"
                    value={walkinAge}
                    onChange={(e) => setWalkinAge(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] focus:outline-none focus:border-[#0088e8]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#86868b] uppercase mb-1">
                    Gender
                  </label>
                  <select
                    value={walkinGender}
                    onChange={(e) => setWalkinGender(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] focus:outline-none focus:border-[#0088e8]"
                  >
                    <option value="Not Specified">Not Specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#86868b] uppercase mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +1 (555) 019-2834"
                  value={walkinPhone}
                  onChange={(e) => setWalkinPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] focus:outline-none focus:border-[#0088e8]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#86868b] uppercase mb-1">
                  Checking Shift
                </label>
                <select
                  value={walkinSlotId}
                  onChange={(e) => setWalkinSlotId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] focus:outline-none focus:border-[#0088e8]"
                >
                  <option value="">Current / Default Shift</option>
                  {parseDoctorSlots(user?.doctorProfile).map((slot, i) => (
                    <option key={slot.id || i} value={slot.id}>
                      {slot.name} ({format12Hour(slot.startTime)}–{format12Hour(slot.endTime)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#86868b] uppercase mb-1">
                  Reason for Visit / Symptoms
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fever, cough, general consultation"
                  value={walkinReason}
                  onChange={(e) => setWalkinReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] focus:outline-none focus:border-[#0088e8]"
                />
              </div>

              <div className="pt-2">
                <AppleButton
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={walkinSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-[#8b5cf6] hover:bg-[#7c3aed]"
                >
                  <Plus className="w-4 h-4" />
                  {walkinSubmitting ? 'Issuing Ticket...' : 'Queue Walk-in Patient'}
                </AppleButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
