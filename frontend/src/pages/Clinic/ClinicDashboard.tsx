import React, { useEffect, useState, useCallback } from 'react';
import { api, ClinicDashboardData, ClinicReceptionistItem, Doctor, getFileUrl, formatDoctorDegrees } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { sanitizeIndianPhone } from '../../utils/phoneUtils';
import {
  Users,
  CalendarCheck,
  IndianRupee,
  UserPlus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  UserCheck,
  Check,
  ShieldAlert,
  LayoutDashboard,
  Clock3,
  Stethoscope,
  Sparkles,
  QrCode,
  Printer,
  Copy,
} from 'lucide-react';

const cleanDoctorName = (name?: string | null): string => {
  if (!name) return 'Doctor';
  const trimmed = name.trim();
  return /^dr\.?\s+/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
};

export const ClinicDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<ClinicDashboardData | null>(null);
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Doctor Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [doctorEmail, setDoctorEmail] = useState('');
  const [adding, setAdding] = useState(false);

  // Receptionist Provisioning Modal
  const [showRecModal, setShowRecModal] = useState(false);
  const [recFullName, setRecFullName] = useState('');
  const [recEmail, setRecEmail] = useState('');
  const [recPassword, setRecPassword] = useState('');
  const [recPhone, setRecPhone] = useState('');
  const [recDoctorIds, setRecDoctorIds] = useState<string[]>([]);
  const [provisioning, setProvisioning] = useState(false);

  // Edit doctor assignments modal
  const [editingRec, setEditingRec] = useState<ClinicReceptionistItem | null>(null);
  const [editDoctorIds, setEditDoctorIds] = useState<string[]>([]);
  const [savingAssignments, setSavingAssignments] = useState(false);

  // Receptionist Credentials Handover Modal & Catalog Search
  const [createdCredentials, setCreatedCredentials] = useState<{ fullName: string; email: string; password: string } | null>(null);
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Clinic Check-in QR Poster Modal
  const [showPosterModal, setShowPosterModal] = useState(false);
  const [copiedPosterUrl, setCopiedPosterUrl] = useState(false);

  const fetchClinicData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const res = await api.getMyClinic();
      setData(res);
    } catch (err: any) {
      console.error('Failed to load clinic details:', err);
      setError(err.message || 'Failed to load clinic statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAvailableDoctors = useCallback(async () => {
    try {
      const docs = await api.getDoctors();
      setAllDoctors(docs.filter((d: any) => d.isVerified));
    } catch (err) {
      console.error('Failed to load doctor catalog:', err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (!mounted) return;
      fetchClinicData(false);
      fetchAvailableDoctors();
    });
    return () => {
      mounted = false;
    };
  }, [fetchClinicData, fetchAvailableDoctors]);

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorEmail.trim()) return;

    setAdding(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.addDoctorToClinic({ doctorEmail: doctorEmail.trim() });
      setSuccessMsg(res.message || 'Doctor onboarded successfully');
      setDoctorEmail('');
      setShowAddModal(false);
      fetchClinicData();
    } catch (err: any) {
      setError(err.message || 'Failed to onboard doctor');
    } finally {
      setAdding(false);
    }
  };

  const handleQuickAdd = async (email?: string, docId?: string) => {
    setAdding(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.addDoctorToClinic({
        doctorEmail: email?.trim() || undefined,
        doctorId: docId || undefined,
      });
      setSuccessMsg(res.message || 'Doctor onboarded successfully');
      setShowAddModal(false);
      setDoctorEmail('');
      setDoctorSearchQuery('');
      fetchClinicData();
    } catch (err: any) {
      setError(err.message || 'Failed to onboard doctor');
    } finally {
      setAdding(false);
    }
  };

  const handleDetachDoctor = async (doctorId: string, docName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to detach Dr. ${docName} from your clinic? Their existing records will remain preserved.`
      )
    ) {
      return;
    }

    try {
      await api.removeDoctorFromClinic(doctorId);
      setSuccessMsg(`Dr. ${docName} has been detached from your clinic.`);
      fetchClinicData();
    } catch (err: any) {
      alert(err.message || 'Failed to detach doctor');
    }
  };

  const handleCancelInvitation = async (doctorId: string, docName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to cancel the pending affiliation invitation to Dr. ${docName}?`
      )
    ) {
      return;
    }

    try {
      await api.removeDoctorFromClinic(doctorId);
      setSuccessMsg(`Invitation to Dr. ${docName} has been cancelled.`);
      fetchClinicData();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel invitation');
    }
  };

  const handleGenerateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRecPassword(pwd);
  };

  const handleRespondDoctorAffiliation = async (affiliationId: string, action: 'ACCEPT' | 'REJECT') => {
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.respondToDoctorAffiliation(affiliationId, action);
      setSuccessMsg(res.message || `Doctor affiliation request ${action.toLowerCase()}ed successfully`);
      fetchClinicData();
    } catch (err: any) {
      setError(err.message || 'Failed to respond to doctor affiliation request');
    }
  };

  const handleProvisionReceptionist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recFullName.trim() || !recEmail.trim() || !recPassword.trim()) {
      setError('Please provide full name, email and password for the receptionist.');
      return;
    }
    if (recPassword.trim().length < 8) {
      setError('Receptionist password must be at least 8 characters long.');
      return;
    }

    setProvisioning(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.addClinicReceptionist({
        fullName: recFullName.trim(),
        email: recEmail.trim(),
        password: recPassword.trim(),
        phone: recPhone.trim() || undefined,
        doctorIds: recDoctorIds,
      });
      const savedName = recFullName.trim();
      const savedEmail = recEmail.trim();
      const savedPass = recPassword.trim();

      setCreatedCredentials({
        fullName: savedName,
        email: savedEmail,
        password: savedPass,
      });
      setSuccessMsg(res.message || 'Receptionist staff provisioned successfully. Share credentials with staff.');
      setShowRecModal(false);
      setRecFullName('');
      setRecEmail('');
      setRecPassword('');
      setRecPhone('');
      setRecDoctorIds([]);
      fetchClinicData();
    } catch (err: any) {
      setError(err.message || 'Failed to provision receptionist staff');
    } finally {
      setProvisioning(false);
    }
  };

  const handleOpenEditAssignments = (rec: ClinicReceptionistItem) => {
    setEditingRec(rec);
    setEditDoctorIds(rec.doctorIds || (rec.doctors ? rec.doctors.map((d) => d.id) : []));
  };

  const handleUpdateAssignedDoctors = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRec) return;

    setSavingAssignments(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.updateClinicReceptionistDoctors(editingRec.id, editDoctorIds);
      setSuccessMsg(res?.message || 'Assigned doctor permissions updated successfully.');
      setEditingRec(null);
      setEditDoctorIds([]);
      fetchClinicData();
    } catch (err: any) {
      setError(err.message || 'Failed to update receptionist assignments');
    } finally {
      setSavingAssignments(false);
    }
  };

  const handleRemoveReceptionist = async (recId: string, recName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to remove receptionist "${recName}"? Their portal credentials will be revoked immediately.`
      )
    ) {
      return;
    }

    try {
      await api.removeClinicReceptionist(recId);
      setSuccessMsg(`Receptionist "${recName}" removed successfully.`);
      fetchClinicData();
    } catch (err: any) {
      setError(err.message || 'Failed to remove receptionist');
    }
  };

  // Receptionist Application Approval State
  const [approvingRec, setApprovingRec] = useState<{ id: string; fullName: string; email: string } | null>(null);
  const [approvalDoctorIds, setApprovalDoctorIds] = useState<string[]>([]);
  const [processingRecId, setProcessingRecId] = useState<string | null>(null);

  const handleRespondReceptionist = async (
    receptionistId: string,
    action: 'ACCEPT' | 'REJECT',
    doctorIds?: string[]
  ) => {
    setProcessingRecId(receptionistId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.respondToReceptionistRequest(receptionistId, action, doctorIds);
      setSuccessMsg(res.message || `Receptionist application ${action.toLowerCase()}ed.`);
      setApprovingRec(null);
      setApprovalDoctorIds([]);
      fetchClinicData();
    } catch (err: any) {
      setError(err.message || 'Failed to process receptionist application');
    } finally {
      setProcessingRecId(null);
    }
  };

  const clinic = data?.clinic;
  const doctors = data?.doctors || [];
  const totalPendingRequests = data?.incomingRequests?.length || 0;
  const incomingRecCount = data?.incomingReceptionists?.length || 0;

  const navItems: DashboardNavItem[] = [
    {
      id: 'overview',
      label: 'Clinic Operations',
      icon: LayoutDashboard,
      active: true,
      onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    },
    {
      id: 'doctors',
      label: 'Affiliated Doctors',
      icon: Users,
      badge: totalPendingRequests > 0 ? `${totalPendingRequests} new` : undefined,
      onClick: () => {
        const el = document.getElementById('practitioners-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      },
    },
    {
      id: 'receptionists',
      label: 'Desk Staff & Reception',
      icon: UserCheck,
      badge: incomingRecCount > 0 ? `${incomingRecCount} new` : (data?.receptionists?.length || undefined),
      onClick: () => {
        const el = document.getElementById('receptionists-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      },
    },
    {
      id: 'appointments',
      label: 'Facility Bookings',
      icon: CalendarCheck,
      badge: data?.totalBookings || undefined,
      onClick: () => {
        const el = document.getElementById('appointments-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      },
    },
  ];

  return (
    <DashboardLayout
      portalType="CLINIC"
      portalSubtitle="CLINIC PORTAL"
      navItems={navItems}
      title={clinic?.clinicName || user?.fullName || 'Clinic Partner Portal'}
      subtitle={`${clinic?.address || 'Clinical Operations Dashboard'}${
        clinic?.city ? ` • ${clinic.city}` : ''
      }${clinic?.state ? `, ${clinic.state}` : ''}`}
      headerAction={
        <div className="flex flex-wrap items-center gap-2">
          <AppleButton
            variant="secondary"
            size="sm"
            onClick={() => setShowPosterModal(true)}
          >
            <QrCode className="w-3.5 h-3.5 text-[#0066cc]" />
            <span><span className="hidden xs:inline">Check-In </span>Poster</span>
          </AppleButton>
          <AppleButton
            variant="secondary"
            size="sm"
            onClick={() => setShowRecModal(true)}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span><span className="hidden xs:inline">Provision </span>Receptionist</span>
          </AppleButton>
          <AppleButton
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Invite Doctor</span>
          </AppleButton>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Verification Warning if clinic not yet verified or suspended */}
        {clinic?.verificationStatus === 'SUSPENDED' && (
          <div className="p-4 rounded-[16px] bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm text-rose-900">Clinic Facility License Suspended</div>
              <p className="text-rose-800 text-xs mt-0.5 leading-relaxed">
                Your facility license has been suspended by administration. Doctors cannot accept new affiliations or clinic bookings until license reinstatement.
              </p>
            </div>
          </div>
        )}
        {clinic?.verificationStatus === 'REJECTED' && (
          <div className="p-4 rounded-[16px] bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm text-rose-900">Clinic Registration Application Rejected</div>
              <p className="text-rose-800 text-xs mt-0.5 leading-relaxed">
                Your clinic registration credentials were not approved. Please contact platform administration to review your facility details.
              </p>
            </div>
          </div>
        )}
        {((clinic?.verificationStatus === 'PENDING' || clinic?.isVerified === false) && clinic?.verificationStatus !== 'SUSPENDED' && clinic?.verificationStatus !== 'REJECTED') && (
          <div className="p-4 rounded-[16px] bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm text-amber-900">Clinic Pending Administrative Verification</div>
              <p className="text-amber-800 text-xs mt-0.5 leading-relaxed">
                Your clinic profile is currently pending review by MediArca administration. While unverified, your clinic will not appear in public clinic searches or doctor affiliation directories. You can still onboard doctors, manage front desk staff, and configure operations.
              </p>
            </div>
          </div>
        )}

        {/* Banner feedback */}
        {successMsg && (
          <div className="p-4 rounded-[16px] bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-[16px] bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-700 hover:text-rose-900 p-1 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. Clinic Metrics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="apple-card p-5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider block">
                Affiliated Doctors
              </span>
              <div className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] mt-1 tracking-tight tabular-nums">
                {data?.totalDoctors ?? doctors.length}
              </div>
              <p className="text-meta mt-0.5">Practitioners linked to this facility</p>
            </div>
            <div className="w-10 h-10 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="apple-card p-5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider block">
                Clinic Appointments
              </span>
              <div className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] mt-1 tracking-tight tabular-nums">
                {data?.totalBookings ?? 0}
              </div>
              <p className="text-meta mt-0.5">Booked across all doctors here</p>
            </div>
            <div className="w-10 h-10 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="apple-card p-5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider block">
                Clinic Revenue
              </span>
              <div className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] mt-1 tracking-tight tabular-nums">
                ₹{data?.totalRevenue ? data.totalRevenue.toLocaleString() : '0'}
              </div>
              <p className="text-meta mt-0.5">
                Generated specifically at this facility
              </p>
            </div>
            <div className="w-10 h-10 rounded-[12px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center shrink-0">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 2. Affiliated Doctors Section */}
        <div id="practitioners-section" className="scroll-mt-6 apple-card p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e5e5ea]/70 mb-6">
            <div>
              <h2 className="text-section-title">
                Affiliated Doctors
              </h2>
              <p className="text-meta mt-0.5">
                Doctors and revenue generated at {clinic?.clinicName || 'this clinic'}.
              </p>
            </div>
            <AppleButton
              variant="secondary"
              size="sm"
              onClick={() => setShowAddModal(true)}
              className="self-start sm:self-auto"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite Doctor</span>
            </AppleButton>
          </div>

          {/* Incoming Doctor Affiliation Requests */}
          {data?.incomingRequests && data.incomingRequests.length > 0 && (
            <div className="mb-6 p-4 rounded-[16px] bg-[#0066cc]/5 border border-[#0066cc]/20 animate-fadeIn">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-[#0066cc]" />
                  <h3 className="text-card-title">
                    Incoming Doctor Affiliation Requests ({data.incomingRequests.length})
                  </h3>
                </div>
                <span className="text-[11px] text-[#0066cc] font-semibold">Requires Clinic Approval</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.incomingRequests.map((doc) => (
                  <div
                    key={doc.affiliationId || doc.doctorId}
                    className="p-4 rounded-[14px] bg-white border border-[#e5e5ea] flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm text-[#1d1d1f]">{cleanDoctorName(doc.fullName)}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] font-semibold border border-[#0066cc]/20">
                          {doc.specialty}
                        </span>
                      </div>
                      <p className="text-meta mt-0.5">{doc.email}</p>
                    </div>
                    <div className="flex items-center gap-2 pt-2.5 border-t border-[#e5e5ea]/70">
                      <AppleButton
                        size="sm"
                        variant="primary"
                        onClick={() => handleRespondDoctorAffiliation(doc.affiliationId!, 'ACCEPT')}
                        className="flex-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </AppleButton>
                      <AppleButton
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRespondDoctorAffiliation(doc.affiliationId!, 'REJECT')}
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

          {/* Pending Outgoing Doctor Requests */}
          {data?.outgoingRequests && data.outgoingRequests.length > 0 && (
            <div className="mb-6 p-4 rounded-[16px] bg-amber-50/50 border border-amber-200">
              <div className="flex items-center gap-2 mb-3">
                <Clock3 className="w-4 h-4 text-amber-600" />
                <h3 className="text-card-title">
                  Pending Doctor Invitations ({data.outgoingRequests.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.outgoingRequests.map((doc) => (
                  <div
                    key={doc.affiliationId || doc.doctorId}
                    className="p-3.5 rounded-[14px] bg-white border border-amber-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#1d1d1f]">{cleanDoctorName(doc.fullName)}</span>
                      <span className="text-[11px] text-[#6e6e73] block">{doc.specialty}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        Awaiting Doctor
                      </span>
                      <AppleButton
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCancelInvitation(doc.doctorId, doc.fullName)}
                      >
                        Cancel
                      </AppleButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-meta">Loading roster...</div>
          ) : doctors.length === 0 ? (
            <div className="py-12 text-center bg-[#f5f5f7]/60 rounded-[16px] border border-dashed border-[#d2d2d7]">
              <div className="w-11 h-11 rounded-[12px] bg-[#0066cc]/10 flex items-center justify-center mx-auto mb-3 text-[#0066cc]">
                <Stethoscope className="w-5 h-5" />
              </div>
              <h3 className="text-card-title">No Doctors Affiliated Yet</h3>
              <p className="text-meta max-w-sm mx-auto mt-1 mb-4">
                Onboard doctors to your clinic to begin receiving facility appointments and tracking isolated clinic revenue.
              </p>
              <AppleButton
                variant="primary"
                size="sm"
                onClick={() => setShowAddModal(true)}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Onboard First Doctor</span>
              </AppleButton>
            </div>
          ) : (
            <>
              {/* Mobile Doctor Cards (< 640px) */}
              <div className="block sm:hidden space-y-3">
                {doctors.map((doc) => (
                  <div key={doc.doctorId} className="p-4 rounded-[16px] bg-[#f5f5f7]/60 border border-[#e5e5ea] space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white border border-[#e5e5ea] overflow-hidden shrink-0">
                          {doc.avatarUrl ? (
                            <img src={getFileUrl(doc.avatarUrl)} alt={doc.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-semibold text-xs text-[#0066cc]">
                              {doc.fullName[0]}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-[#1d1d1f] text-sm">{doc.fullName}</div>
                          <div className="text-[11px] text-[#6e6e73]">
                            {formatDoctorDegrees(doc.qualifications)} • {doc.experienceYears} yrs exp.
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20 shrink-0">
                        {doc.specialty}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-[#e5e5ea] text-center">
                      <div>
                        <div className="text-[10px] text-[#6e6e73] font-medium">Fee</div>
                        <div className="font-semibold text-xs text-[#1d1d1f] mt-0.5 tabular-nums">₹{doc.consultationFee.toFixed(0)}</div>
                      </div>
                      <div className="border-x border-[#e5e5ea]">
                        <div className="text-[10px] text-[#6e6e73] font-medium">Bookings</div>
                        <div className="font-semibold text-xs text-[#1d1d1f] mt-0.5 tabular-nums">{doc.bookingCount}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#6e6e73] font-medium">Revenue</div>
                        <div className="font-semibold text-xs text-[#0066cc] mt-0.5 tabular-nums">₹{doc.revenue.toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <AppleButton
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDetachDoctor(doc.doctorId, doc.fullName)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Detach Practitioner</span>
                      </AppleButton>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e5e5ea] text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73]">
                      <th className="pb-3 pl-2">Practitioner</th>
                      <th className="pb-3">Specialty</th>
                      <th className="pb-3">Fee</th>
                      <th className="pb-3 text-center">Bookings Here</th>
                      <th className="pb-3 text-right">Revenue Here</th>
                      <th className="pb-3 text-right pr-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e5ea]/60">
                    {doctors.map((doc) => (
                      <tr key={doc.doctorId} className="hover:bg-[#f5f5f7]/50 transition-colors">
                        <td className="py-4 pl-2">
                          <div className="flex items-center gap-3">
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
                            <div>
                              <div className="font-semibold text-[#1d1d1f] text-sm">
                                {doc.fullName}
                              </div>
                              <div className="text-[11px] text-[#6e6e73]">
                                {formatDoctorDegrees(doc.qualifications)} • {doc.experienceYears} yrs exp.
                              </div>
                              <div className="text-[11px] text-[#86868b]">{doc.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
                            {doc.specialty}
                          </span>
                        </td>

                        <td className="py-4 font-semibold text-[#1d1d1f] tabular-nums">
                          ₹{doc.consultationFee.toFixed(0)}
                        </td>

                        <td className="py-4 text-center">
                          <span className="font-semibold text-[#1d1d1f] text-sm tabular-nums">
                            {doc.bookingCount}
                          </span>
                          <span className="text-[11px] text-[#6e6e73] block">
                            ({doc.completedCount} completed)
                          </span>
                        </td>

                        <td className="py-4 text-right">
                          <span className="font-semibold text-[#0066cc] text-sm tabular-nums">
                            ₹{doc.revenue.toLocaleString()}
                          </span>
                          <span className="text-[11px] text-[#6e6e73] block">at this clinic</span>
                        </td>

                        <td className="py-4 text-right pr-2">
                          <AppleButton
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDetachDoctor(doc.doctorId, doc.fullName)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Detach</span>
                          </AppleButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Desk Receptionists & Front Staff Section */}
        <div id="receptionists-section" className="scroll-mt-6 apple-card p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e5e5ea]/70 mb-6">
            <div>
              <h2 className="text-section-title">
                Desk Receptionists & Front Staff
              </h2>
              <p className="text-meta mt-0.5">
                Manage credentials and assign specific affiliated practitioners to each front desk receptionist.
              </p>
            </div>
            <AppleButton
              variant="secondary"
              size="sm"
              onClick={() => setShowRecModal(true)}
              className="self-start sm:self-auto"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Provision Receptionist</span>
            </AppleButton>
          </div>

          {/* Incoming Receptionist Applications */}
          {data?.incomingReceptionists && data.incomingReceptionists.length > 0 && (
            <div className="mb-6 p-4 rounded-[16px] bg-amber-50/50 border border-amber-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <h3 className="text-card-title text-amber-900">
                    Incoming Receptionist Applications ({data.incomingReceptionists.length})
                  </h3>
                </div>
                <span className="text-[11px] font-medium text-amber-800">
                  Staff requesting front desk access
                </span>
              </div>

              <div className="space-y-2.5">
                {data.incomingReceptionists.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3.5 rounded-[14px] bg-white border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-xs text-[#1d1d1f] flex items-center gap-2">
                        <span>{rec.fullName}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          Pending Approval
                        </span>
                      </div>
                      <div className="text-[11px] text-[#6e6e73] mt-0.5">
                        <span className="font-medium text-[#1d1d1f]">{rec.email}</span>
                        {rec.phone && <span> • {rec.phone}</span>}
                        <span> • Applied {new Date(rec.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <AppleButton
                        variant="destructive"
                        size="sm"
                        disabled={processingRecId === rec.id}
                        onClick={() => handleRespondReceptionist(rec.id, 'REJECT')}
                      >
                        Decline
                      </AppleButton>

                      <AppleButton
                        variant="primary"
                        size="sm"
                        disabled={processingRecId === rec.id}
                        onClick={() => {
                          setApprovingRec({ id: rec.id, fullName: rec.fullName, email: rec.email });
                          setApprovalDoctorIds([]);
                        }}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Review & Assign Doctors</span>
                      </AppleButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!data?.receptionists || data.receptionists.length === 0) ? (
            <div className="py-12 text-center bg-[#f5f5f7]/60 rounded-[16px] border border-dashed border-[#d2d2d7]">
              <div className="w-11 h-11 rounded-[12px] bg-[#0066cc]/10 flex items-center justify-center mx-auto mb-3 text-[#0066cc]">
                <UserCheck className="w-5 h-5" />
              </div>
              <h3 className="text-card-title">No Receptionists Provisioned</h3>
              <p className="text-meta max-w-sm mx-auto mt-1 mb-4">
                Provision secure login credentials for your reception staff. You can configure which doctors each receptionist manages appointments for.
              </p>
              <AppleButton
                variant="primary"
                size="sm"
                onClick={() => setShowRecModal(true)}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Provision First Receptionist</span>
              </AppleButton>
            </div>
          ) : (
            <>
              {/* Mobile Receptionist Cards (< 640px) */}
              <div className="block sm:hidden space-y-3">
                {data.receptionists.map((rec) => (
                  <div key={rec.id} className="p-4 rounded-[16px] bg-[#f5f5f7]/60 border border-[#e5e5ea] space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-[#1d1d1f] text-sm">{rec.fullName}</h4>
                        <div className="text-[11px] text-[#6e6e73]">{rec.email}</div>
                        {rec.phone && <div className="text-[11px] text-[#6e6e73]">{rec.phone}</div>}
                      </div>
                      <div className="text-[11px] text-[#6e6e73] shrink-0">
                        {new Date(rec.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Assigned Doctors */}
                    <div className="pt-2.5 border-t border-[#e5e5ea]">
                      <div className="text-[10px] text-[#6e6e73] uppercase tracking-wider mb-1.5 font-semibold">Assigned Practitioners</div>
                      {(!rec.doctors || rec.doctors.length === 0) ? (
                        <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-semibold">
                          No doctors assigned
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {rec.doctors.map((doc) => (
                            <span
                              key={doc.id}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20"
                            >
                              {cleanDoctorName(doc.fullName)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[#e5e5ea]">
                      <AppleButton
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenEditAssignments(rec)}
                      >
                        Manage Doctors
                      </AppleButton>
                      <AppleButton
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveReceptionist(rec.id, rec.fullName)}
                        title="Remove receptionist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </AppleButton>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e5e5ea] text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73]">
                      <th className="pb-3 pl-2">Receptionist</th>
                      <th className="pb-3">Contact</th>
                      <th className="pb-3">Assigned Doctors</th>
                      <th className="pb-3 text-right pr-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e5ea]/60">
                    {data.receptionists.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[#f5f5f7]/50 transition-colors">
                        <td className="py-4 pl-2">
                          <div className="font-semibold text-[#1d1d1f] text-sm">{rec.fullName}</div>
                          <div className="text-[11px] text-[#6e6e73]">
                            Added {new Date(rec.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="py-4 text-[#6e6e73]">
                          <div className="text-xs text-[#1d1d1f] font-medium">{rec.email}</div>
                          {rec.phone && <div className="text-[11px]">{rec.phone}</div>}
                        </td>
                        <td className="py-4">
                          {(!rec.doctors || rec.doctors.length === 0) ? (
                            <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-semibold">
                              No doctors assigned
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 max-w-md">
                              {rec.doctors.map((doc) => (
                                <span
                                  key={doc.id}
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20"
                                >
                                  {cleanDoctorName(doc.fullName)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-4 text-right pr-2">
                          <div className="inline-flex items-center gap-2">
                            <AppleButton
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenEditAssignments(rec)}
                            >
                              Manage Doctors
                            </AppleButton>
                            <AppleButton
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveReceptionist(rec.id, rec.fullName)}
                              title="Remove receptionist"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </AppleButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* 4. Recent Clinic Appointments Table */}
        <div id="appointments-section" className="scroll-mt-6 apple-card p-5 sm:p-6">
          <div className="pb-4 border-b border-[#e5e5ea]/70 mb-5">
            <h3 className="text-section-title">
              Recent Consultations at this Facility
            </h3>
            <p className="text-meta mt-0.5">
              Live and completed patient encounters across affiliated doctors.
            </p>
          </div>
          {(!data?.recentAppointments || data.recentAppointments.length === 0) ? (
            <div className="py-12 text-center bg-[#f5f5f7]/60 rounded-[16px] border border-dashed border-[#d2d2d7]">
              <CalendarCheck className="w-8 h-8 text-[#86868b] mx-auto mb-2 opacity-60" />
              <p className="text-card-title">No Facility Consultations Recorded Yet</p>
              <p className="text-meta mt-1">When patients book appointments with affiliated practitioners at this clinic, they will appear here.</p>
            </div>
          ) : (
            <>
              {/* Mobile Recent Appointments Cards (< 640px) */}
              <div className="block sm:hidden space-y-3">
                {data.recentAppointments.map((appt) => (
                  <div key={appt.id} className="p-4 rounded-[16px] bg-[#f5f5f7]/60 border border-[#e5e5ea] space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded-[8px] bg-[#0066cc]/10 text-[#0066cc] font-bold text-xs tabular-nums">
                          #{appt.queueNumber}
                        </span>
                        <div>
                          <div className="font-semibold text-sm text-[#1d1d1f]">{appt.patientName}</div>
                          <div className="text-[11px] text-[#6e6e73]">{appt.patientPhone}</div>
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          appt.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : appt.status === 'IN_CONSULTATION'
                            ? 'bg-[#0066cc]/10 text-[#0066cc] border-[#0066cc]/20'
                            : appt.status === 'WAITING'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : appt.status === 'EXPIRED'
                            ? 'bg-[#f5f5f7] text-[#6e6e73] border-[#e5e5ea]'
                            : appt.status === 'PENDING_APPROVAL'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-[#f5f5f7] text-[#6e6e73] border-[#e5e5ea]'
                        }`}
                      >
                        {appt.status === 'PENDING_APPROVAL' ? 'Pending' : appt.status === 'EXPIRED' ? 'Expired' : appt.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#6e6e73] pt-2 border-t border-[#e5e5ea]">
                      <div className="font-medium text-[#1d1d1f]">{appt.doctorName}</div>
                      <div className="font-semibold text-[#1d1d1f] tabular-nums">₹{appt.fee}</div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#6e6e73]">
                      <div>{appt.date}</div>
                      <div>{appt.estimatedTime || appt.checkingWindow}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e5e5ea] text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73]">
                      <th className="pb-3 pl-2">Token #</th>
                      <th className="pb-3">Patient</th>
                      <th className="pb-3">Doctor</th>
                      <th className="pb-3">Date & Time</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right pr-2">Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e5ea]/60">
                    {data.recentAppointments.map((appt) => (
                      <tr key={appt.id} className="hover:bg-[#f5f5f7]/50 transition-colors">
                        <td className="py-3.5 pl-2">
                          <span className="font-bold text-[#0066cc] tabular-nums">
                            #{appt.queueNumber}
                          </span>
                        </td>
                        <td className="py-3.5">
                          <div className="font-semibold text-[#1d1d1f]">{appt.patientName}</div>
                          <div className="text-[11px] text-[#6e6e73]">{appt.patientPhone}</div>
                        </td>
                        <td className="py-3.5 font-medium text-[#1d1d1f]">{appt.doctorName}</td>
                        <td className="py-3.5 text-[#6e6e73]">
                          <div className="text-[#1d1d1f] font-medium">{appt.date}</div>
                          <div className="text-[11px]">{appt.estimatedTime || appt.checkingWindow}</div>
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                              appt.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : appt.status === 'IN_CONSULTATION'
                                ? 'bg-[#0066cc]/10 text-[#0066cc] border-[#0066cc]/20'
                                : appt.status === 'WAITING'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : appt.status === 'EXPIRED'
                                ? 'bg-[#f5f5f7] text-[#6e6e73] border-[#e5e5ea]'
                                : appt.status === 'PENDING_APPROVAL'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-[#f5f5f7] text-[#6e6e73] border-[#e5e5ea]'
                            }`}
                          >
                            {appt.status === 'PENDING_APPROVAL' ? 'Pending Desk' : appt.status === 'EXPIRED' ? 'Expired' : appt.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-right pr-2 font-semibold text-[#1d1d1f] tabular-nums">
                          ₹{appt.fee}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Onboard Doctor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-t-[28px] sm:rounded-[24px] border border-[#e5e5ea] max-w-md w-full p-5 sm:p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-6 shadow-apple-float max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-card-title text-[#1d1d1f]">Onboard Doctor</h3>
                <p className="text-meta text-[#86868b] mt-0.5">
                  Link a verified practitioner to {clinic?.clinicName || 'your clinic'}
                </p>
              </div>
              <button
                disabled={adding}
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f5f5f7] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddDoctor} className="space-y-4 pt-5">
              <div>
                <label className="ui-label">
                  Doctor's Registered Email
                </label>
                <input
                  type="email"
                  required
                  disabled={adding}
                  value={doctorEmail}
                  onChange={(e) => setDoctorEmail(e.target.value)}
                  placeholder="e.g. dr.sarah@mediarca.com"
                  className="ui-input"
                />
              </div>

              {/* Quick Select from Platform Doctors */}
              {allDoctors.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[12px] font-medium text-[#86868b]">
                      Or search & pick from verified doctors:
                    </label>
                    <span className="text-[11px] text-[#86868b]">{allDoctors.length} available</span>
                  </div>
                  <input
                    type="text"
                    value={doctorSearchQuery}
                    onChange={(e) => setDoctorSearchQuery(e.target.value)}
                    placeholder="Filter by name, specialty, or email..."
                    className="w-full h-9 px-3.5 rounded-full border border-[#e5e5ea] text-[13px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] mb-2.5"
                  />
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {allDoctors
                      .filter((d) => {
                        if (!doctorSearchQuery.trim()) return true;
                        const q = doctorSearchQuery.toLowerCase().trim();
                        const name = (d.user?.fullName || '').toLowerCase();
                        const spec = (d.specialty || '').toLowerCase();
                        const email = (d.user?.email || '').toLowerCase();
                        return name.includes(q) || spec.includes(q) || email.includes(q);
                      })
                      .map((d) => {
                        const isAlreadyAdded = doctors.some((doc) => doc.doctorId === d.id);
                        const docEmail = d.user?.email || '';
                        const docName = d.user?.fullName || 'Dr. Specialist';
                        return (
                          <div
                            key={d.id}
                            className="p-2.5 rounded-xl bg-[#f5f5f7]/80 border border-[#e5e5ea] flex items-center justify-between text-xs hover:border-[#0066cc]/30 transition-all"
                          >
                            <div
                              className="cursor-pointer flex-1 mr-2 min-w-0"
                              onClick={() => docEmail && setDoctorEmail(docEmail)}
                              title={docEmail ? 'Click to select email' : undefined}
                            >
                              <div className="font-semibold text-[#1d1d1f] hover:text-[#0066cc] transition-colors truncate">{docName}</div>
                              <div className="text-[11px] text-[#86868b] mt-0.5 truncate">
                                {d.specialty}{docEmail ? ` • ${docEmail}` : ''}
                              </div>
                            </div>
                            {isAlreadyAdded ? (
                              <span className="text-[11px] text-[#86868b] px-2.5 py-1 rounded-full bg-[#e5e5ea]/70 font-medium shrink-0">
                                Affiliated
                              </span>
                            ) : (
                              <AppleButton
                                type="button"
                                variant="primary"
                                size="sm"
                                disabled={adding}
                                onClick={() => handleQuickAdd(docEmail, d.id)}
                                className="h-7 px-3 text-[11px] shrink-0"
                              >
                                {adding ? 'Adding...' : 'Add'}
                              </AppleButton>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-[#f0f0f2] flex justify-end gap-2.5">
                <AppleButton
                  variant="secondary"
                  size="sm"
                  type="button"
                  disabled={adding}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </AppleButton>
                <AppleButton variant="primary" size="sm" type="submit" disabled={adding}>
                  {adding ? 'Onboarding...' : 'Onboard Doctor'}
                </AppleButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Provision Receptionist Modal */}
      {showRecModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-t-[28px] sm:rounded-[24px] border border-[#e5e5ea] max-w-lg w-full p-5 sm:p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-6 shadow-apple-float max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-card-title text-[#1d1d1f]">Provision Desk Receptionist</h3>
                <p className="text-meta text-[#86868b] mt-0.5">
                  Create portal login credentials and assign practitioner management permissions.
                </p>
              </div>
              <button
                disabled={provisioning}
                onClick={() => setShowRecModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f5f5f7] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProvisionReceptionist} className="space-y-4 pt-5">
              <div>
                <label className="ui-label">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={provisioning}
                  value={recFullName}
                  onChange={(e) => setRecFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="ui-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="ui-label">
                    Login Email *
                  </label>
                  <input
                    type="email"
                    required
                    disabled={provisioning}
                    value={recEmail}
                    onChange={(e) => setRecEmail(e.target.value)}
                    placeholder="desk@clinic.com"
                    className="ui-input"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="ui-label mb-0">
                      Temporary Password *
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateRandomPassword}
                      className="text-[11px] text-[#0066cc] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      Auto-generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    disabled={provisioning}
                    value={recPassword}
                    onChange={(e) => setRecPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    minLength={8}
                    className="ui-input"
                  />
                </div>
              </div>

              <div>
                <label className="ui-label">
                  Mobile Number (Optional)
                </label>
                <div className="flex rounded-xl border border-[#e5e5ea] overflow-hidden focus-within:ring-2 focus-within:ring-[#0066cc]/20 focus-within:border-[#0066cc] bg-white transition-all h-11">
                  <span className="inline-flex items-center px-3.5 bg-[#f5f5f7] border-r border-[#e5e5ea] text-[#1d1d1f] font-semibold text-[13px] select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    disabled={provisioning}
                    value={sanitizeIndianPhone(recPhone)}
                    onChange={(e) => {
                      const digits = sanitizeIndianPhone(e.target.value);
                      setRecPhone(digits ? `+91 ${digits}` : '');
                    }}
                    placeholder="98765 43210"
                    maxLength={10}
                    className="flex-1 h-full px-3.5 text-[14px] bg-transparent focus:outline-none text-[#1d1d1f] placeholder:text-[#86868b]"
                  />
                </div>
              </div>

              {/* Doctor Assignments */}
              <div>
                <label className="ui-label">
                  Assign Doctors to this Receptionist Desk
                </label>
                <p className="text-[12px] text-[#86868b] mb-2.5">
                  Select which affiliated doctors this receptionist is authorized to manage queues and appointments for.
                </p>
                {doctors.length === 0 ? (
                  <div className="p-3.5 bg-[#f5f5f7] rounded-xl text-xs text-[#86868b] text-center border border-[#e5e5ea]">
                    No affiliated doctors in this clinic yet. You can assign doctors later.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {doctors.map((doc) => {
                      const isSelected = recDoctorIds.includes(doc.doctorId);
                      return (
                        <div
                          key={doc.doctorId}
                          onClick={() => {
                            if (isSelected) {
                              setRecDoctorIds(recDoctorIds.filter((id) => id !== doc.doctorId));
                            } else {
                              setRecDoctorIds([...recDoctorIds, doc.doctorId]);
                            }
                          }}
                          className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-center justify-between text-xs ${
                            isSelected
                              ? 'bg-[#0066cc]/5 border-[#0066cc]/40 text-[#0066cc]'
                              : 'bg-white border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#fafafc]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                                isSelected
                                  ? 'bg-[#0066cc] border-transparent text-white'
                                  : 'border-[#c7c7cc] bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <div>
                              <div className="font-semibold text-[#1d1d1f]">{cleanDoctorName(doc.fullName)}</div>
                              <div className="text-[11px] text-[#86868b]">{doc.specialty}</div>
                            </div>
                          </div>
                          <span className="text-[12px] font-medium text-[#86868b] tabular-nums">₹{doc.consultationFee}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#f0f0f2] flex justify-end gap-2.5">
                <AppleButton
                  variant="secondary"
                  size="sm"
                  type="button"
                  disabled={provisioning}
                  onClick={() => setShowRecModal(false)}
                >
                  Cancel
                </AppleButton>
                <AppleButton variant="primary" size="sm" type="submit" disabled={provisioning}>
                  {provisioning ? 'Provisioning...' : 'Provision Receptionist'}
                </AppleButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Assigned Doctors Modal */}
      {editingRec && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-t-[28px] sm:rounded-[24px] border border-[#e5e5ea] max-w-md w-full p-5 sm:p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-6 shadow-apple-float max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-card-title text-[#1d1d1f]">Manage Doctor Desk Access</h3>
                <p className="text-meta text-[#86868b] mt-0.5">
                  Configure active doctor assignments for {editingRec.fullName}.
                </p>
              </div>
              <button
                disabled={savingAssignments}
                onClick={() => setEditingRec(null)}
                className="w-8 h-8 rounded-full hover:bg-[#f5f5f7] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateAssignedDoctors} className="space-y-4 pt-5">
              <p className="text-[13px] text-[#86868b]">
                Select which affiliated doctors this receptionist is authorized to book walk-ins and manage queues for:
              </p>

              {doctors.length === 0 ? (
                <div className="p-4 bg-[#f5f5f7] rounded-xl text-xs text-[#86868b] text-center border border-[#e5e5ea]">
                  No affiliated doctors currently onboarded to this clinic.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {doctors.map((doc) => {
                    const isSelected = editDoctorIds.includes(doc.doctorId);
                    return (
                      <div
                        key={doc.doctorId}
                        onClick={() => {
                          if (isSelected) {
                            setEditDoctorIds(editDoctorIds.filter((id) => id !== doc.doctorId));
                          } else {
                            setEditDoctorIds([...editDoctorIds, doc.doctorId]);
                          }
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-[#0066cc]/5 border-[#0066cc]/40 text-[#0066cc]'
                            : 'bg-white border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#fafafc]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                              isSelected
                                ? 'bg-[#0066cc] border-transparent text-white'
                                : 'border-[#c7c7cc] bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div>
                            <div className="font-semibold text-[#1d1d1f]">{cleanDoctorName(doc.fullName)}</div>
                            <div className="text-[11px] text-[#86868b]">{doc.specialty}</div>
                          </div>
                        </div>
                        <span className="text-[12px] font-medium text-[#86868b] tabular-nums">₹{doc.consultationFee}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-4 border-t border-[#f0f0f2] flex justify-end gap-2.5">
                <AppleButton
                  variant="secondary"
                  size="sm"
                  type="button"
                  disabled={savingAssignments}
                  onClick={() => setEditingRec(null)}
                >
                  Cancel
                </AppleButton>
                <AppleButton variant="primary" size="sm" type="submit" disabled={savingAssignments}>
                  {savingAssignments ? 'Saving...' : 'Save Permissions'}
                </AppleButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receptionist Credentials Handover Modal */}
      {createdCredentials && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-t-[28px] sm:rounded-[24px] border border-[#e5e5ea] max-w-md w-full p-5 sm:p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-6 shadow-apple-float space-y-5 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-card-title text-[#1d1d1f]">Desk Credentials Ready</h3>
                  <p className="text-meta text-[#86868b] mt-0.5">Provide these credentials to your front desk staff</p>
                </div>
              </div>
              <button
                onClick={() => setCreatedCredentials(null)}
                className="w-8 h-8 rounded-full text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs space-y-1 leading-relaxed">
              <p className="font-semibold">Handover Notice:</p>
              <p className="text-[12px] text-amber-800">
                Direct public receptionist signup is disabled. Your receptionist must log in using the credentials below via the Receptionist Portal link at the bottom of the landing page.
              </p>
            </div>

            <div className="bg-[#f5f5f7] rounded-xl p-4 border border-[#e5e5ea] space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-[#86868b] uppercase tracking-wider font-semibold block">
                  Staff Member Name
                </span>
                <span className="text-[#1d1d1f] font-semibold text-sm">
                  {createdCredentials.fullName}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#86868b] uppercase tracking-wider font-semibold block">
                  Login Email (Desk ID)
                </span>
                <span className="text-[#0066cc] select-all bg-white px-3 py-1.5 rounded-lg border border-[#e5e5ea] block mt-1 font-semibold">
                  {createdCredentials.email}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#86868b] uppercase tracking-wider font-semibold block">
                  Temporary Password
                </span>
                <span className="text-[#1d1d1f] select-all bg-white px-3 py-1.5 rounded-lg border border-[#e5e5ea] block mt-1 font-semibold">
                  {createdCredentials.password}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#86868b] uppercase tracking-wider font-semibold block">
                  Portal Login URL
                </span>
                <span className="text-[#0066cc] text-[11px] block mt-0.5 select-all font-medium break-all">
                  {`${window.location.origin}${window.location.pathname}#/receptionist/login`}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row justify-end gap-2.5">
              <AppleButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  const portalUrl = `${window.location.origin}${window.location.pathname}#/receptionist/login`;
                  const text = `MediArca Receptionist Desk Credentials\nFacility: ${clinic?.clinicName || 'Clinic'}\nName: ${createdCredentials.fullName}\nEmail (Desk ID): ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nLogin Portal: ${portalUrl}`;
                  navigator.clipboard.writeText(text);
                  setCopiedCreds(true);
                  setTimeout(() => setCopiedCreds(false), 2500);
                }}
                className="flex items-center justify-center gap-1.5"
              >
                {copiedCreds ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copied to Clipboard!
                  </>
                ) : (
                  'Copy All Credentials'
                )}
              </AppleButton>

              <AppleButton
                variant="primary"
                size="sm"
                onClick={() => setCreatedCredentials(null)}
              >
                Done
              </AppleButton>
            </div>
          </div>
        </div>
      )}

      {/* Review & Approve Incoming Receptionist Modal */}
      {approvingRec && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-t-[28px] sm:rounded-[24px] border border-[#e5e5ea] max-w-md w-full p-5 sm:p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-6 shadow-apple-float max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-card-title text-[#1d1d1f]">Approve Receptionist Application</h3>
                <p className="text-meta text-[#86868b] mt-0.5">
                  Assign practitioners to {approvingRec.fullName}
                </p>
              </div>
              <button
                disabled={processingRecId !== null}
                onClick={() => setApprovingRec(null)}
                className="w-8 h-8 rounded-full hover:bg-[#f5f5f7] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs">
                <div className="font-semibold text-[#1d1d1f] text-[13px]">{approvingRec.fullName}</div>
                <div className="text-[12px] text-[#86868b] mt-0.5">{approvingRec.email}</div>
              </div>

              <div>
                <label className="ui-label">
                  Assign Doctors Managed by this Receptionist:
                </label>
                <p className="text-[12px] text-[#86868b] mb-3">
                  This receptionist will only be able to view schedules, book walk-ins, and manage queues for selected practitioners.
                </p>

                {doctors.filter((d) => d.status === 'ACCEPTED').length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-50 text-amber-800 text-xs border border-amber-200">
                    No active affiliated doctors at this clinic yet. You can approve now and assign doctors later.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {doctors
                      .filter((d) => d.status === 'ACCEPTED')
                      .map((doc) => {
                        const isChecked = approvalDoctorIds.includes(doc.doctorId);
                        return (
                          <div
                            key={doc.doctorId}
                            onClick={() => {
                              if (isChecked) {
                                setApprovalDoctorIds(approvalDoctorIds.filter((id) => id !== doc.doctorId));
                              } else {
                                setApprovalDoctorIds([...approvalDoctorIds, doc.doctorId]);
                              }
                            }}
                            className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-center justify-between text-xs ${
                              isChecked
                                ? 'bg-[#0066cc]/5 border-[#0066cc]'
                                : 'bg-[#f5f5f7] border-[#e5e5ea] hover:bg-[#e8e8ed]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                                  isChecked
                                    ? 'bg-[#0066cc] border-[#0066cc] text-white'
                                    : 'bg-white border-[#c7c7cc]'
                                }`}
                              >
                                {isChecked && <Check className="w-3 h-3" />}
                              </div>
                              <span className="font-semibold text-[#1d1d1f]">{cleanDoctorName(doc.fullName)}</span>
                              <span className="text-[11px] text-[#0066cc]">({doc.specialty})</span>
                            </div>
                            <span className="text-[12px] font-medium text-[#86868b] tabular-nums">₹{doc.consultationFee}</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#f0f0f2] flex justify-end gap-2.5">
              <AppleButton
                variant="secondary"
                size="sm"
                type="button"
                disabled={processingRecId !== null}
                onClick={() => setApprovingRec(null)}
              >
                Cancel
              </AppleButton>
              <AppleButton
                variant="primary"
                size="sm"
                type="button"
                disabled={processingRecId !== null}
                onClick={() => handleRespondReceptionist(approvingRec.id, 'ACCEPT', approvalDoctorIds)}
              >
                {processingRecId === approvingRec.id ? 'Approving...' : 'Approve & Activate Desk Access'}
              </AppleButton>
            </div>
          </div>
        </div>
      )}

      {/* Clinic Physical Check-In QR Poster Modal */}
      {showPosterModal && clinic && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-t-[28px] sm:rounded-[24px] border border-[#e5e5ea] max-w-md w-full p-5 sm:p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-6 shadow-apple-float relative max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <button
              onClick={() => setShowPosterModal(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] rounded-full hover:bg-[#f5f5f7] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full border border-[#0066cc]/20 inline-block mb-3">
                Official Clinic Arrival QR
              </span>
              <h3 className="text-section-title text-[#1d1d1f]">
                {clinic.clinicName}
              </h3>
              <p className="text-meta text-[#86868b] mt-0.5">
                {clinic.address}{clinic.city ? `, ${clinic.city}` : ''}
              </p>
            </div>

            {/* Poster Card */}
            <div id="clinic-printable-poster" className="my-5 p-6 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-center">
              <div className="w-48 h-48 mx-auto bg-white p-3 rounded-2xl border border-[#e5e5ea] shadow-apple-xs flex items-center justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                    `${window.location.origin}${window.location.pathname}#/clinic-checkin?clinicId=${clinic.id}&code=${clinic.checkinCode || ''}`
                  )}`}
                  alt="Clinic Arrival QR Code"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="mt-4">
                <p className="text-[13px] font-semibold text-[#1d1d1f]">
                  Scan Upon Arrival at Clinic Desk
                </p>
                <p className="text-[12px] text-[#86868b] mt-1">
                  Patients scan this QR code with their mobile camera to verify physical presence in the waiting room.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5 pt-3 border-t border-[#f0f0f2]">
              <AppleButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  const checkinLink = `${window.location.origin}${window.location.pathname}#/clinic-checkin?clinicId=${clinic.id}&code=${clinic.checkinCode || ''}`;
                  navigator.clipboard.writeText(checkinLink);
                  setCopiedPosterUrl(true);
                  setTimeout(() => setCopiedPosterUrl(false), 2000);
                }}
                className="flex-1 flex items-center justify-center gap-1.5"
              >
                {copiedPosterUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPosterUrl ? 'Copied Link' : 'Copy Check-In Link'}</span>
              </AppleButton>

              <AppleButton
                variant="primary"
                size="sm"
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Poster</span>
              </AppleButton>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
