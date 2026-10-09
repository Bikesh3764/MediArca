import React, { useEffect, useState, useCallback } from 'react';
import { api, ClinicDashboardData, ClinicReceptionistItem, Doctor, getFileUrl, formatDoctorDegrees } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { ClinicQrStandeeModal } from '../../components/common/ClinicQrStandeeModal';
import { sanitizeIndianPhone, isValidIndianPhone, formatIndianPhone } from '../../utils/phoneUtils';
import {
  Users,
  CalendarCheck,
  UserPlus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  UserCheck,
  Check,
  ShieldAlert,
  Clock3,
  Sparkles,
  QrCode,
  RefreshCw,
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
  const [activeSection, setActiveSection] = useState<'doctors' | 'receptionists' | 'appointments'>('doctors');

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
      setError(err.message || 'Failed to detach doctor');
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
    if (recPhone.trim() && !isValidIndianPhone(recPhone.trim())) {
      setError('Please provide a valid 10-digit Indian mobile number for the receptionist.');
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
        phone: recPhone.trim() ? formatIndianPhone(recPhone.trim()) : undefined,
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
      id: 'doctors',
      label: 'Affiliated Doctors',
      icon: Users,
      active: activeSection === 'doctors',
      badge: totalPendingRequests > 0 ? `${totalPendingRequests} new` : undefined,
      onClick: () => setActiveSection('doctors'),
    },
    {
      id: 'receptionists',
      label: 'Desk Staff & Reception',
      icon: UserCheck,
      active: activeSection === 'receptionists',
      badge: incomingRecCount > 0 ? `${incomingRecCount} new` : (data?.receptionists?.length || undefined),
      onClick: () => setActiveSection('receptionists'),
    },
    {
      id: 'appointments',
      label: 'Facility Bookings',
      icon: CalendarCheck,
      active: activeSection === 'appointments',
      badge: data?.totalBookings || undefined,
      onClick: () => setActiveSection('appointments'),
    },
  ];

  return (
    <DashboardLayout
      portalType="CLINIC"
      portalSubtitle="Clinic Portal"
      navItems={navItems}
      title={clinic?.clinicName || user?.fullName || 'Clinic Partner Portal'}
      subtitle={`${clinic?.address || 'Clinical Operations Dashboard'}${
        clinic?.city ? ` • ${clinic.city}` : ''
      }${clinic?.state ? `, ${clinic.state}` : ''}`}
      headerAction={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPosterModal(true)}
            className="h-9 px-3.5 rounded-full bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5 text-[#0066cc]" />
            <span>QR Standee</span>
          </button>
          <button
            type="button"
            onClick={() => fetchClinicData(true)}
            disabled={loading}
            className="h-9 px-3.5 rounded-full bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#86868b] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Verification Warning if clinic not yet verified or suspended */}
        {clinic?.verificationStatus === 'SUSPENDED' && (
          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-rose-800 text-xs flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-rose-900">Clinic Facility License Suspended</div>
              <p className="text-rose-700 text-xs mt-0.5 leading-relaxed">
                Your facility license has been suspended by administration. Doctors cannot accept new affiliations or clinic bookings until license reinstatement.
              </p>
            </div>
          </div>
        )}
        {clinic?.verificationStatus === 'REJECTED' && (
          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-rose-800 text-xs flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-rose-900">Clinic Registration Application Rejected</div>
              <p className="text-rose-700 text-xs mt-0.5 leading-relaxed">
                Your clinic registration credentials were not approved. Please contact platform administration to review your facility details.
              </p>
            </div>
          </div>
        )}
        {((clinic?.verificationStatus === 'PENDING' || clinic?.isVerified === false) && clinic?.verificationStatus !== 'SUSPENDED' && clinic?.verificationStatus !== 'REJECTED') && (
          <div className="p-4 rounded-2xl bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-start gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <ShieldAlert className="w-4 h-4 text-[#0066cc] flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[#1d1d1f]">Clinic Pending Administrative Verification</div>
              <p className="text-[#86868b] text-xs mt-0.5 leading-relaxed">
                Your clinic profile is pending review by MediArca administration. While unverified, your clinic will not appear in public clinic searches. You can still onboard doctors, manage front desk staff, and configure operations.
              </p>
            </div>
          </div>
        )}

        {/* Banner feedback */}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center justify-between shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
              <span className="font-medium">{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-[#86868b] hover:text-[#1d1d1f]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-rose-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-700 hover:text-rose-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. Clinic Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#86868b]">
                Affiliated Doctors
              </span>
              {totalPendingRequests > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#0066cc]/10 text-[#0066cc]">
                  {totalPendingRequests} pending
                </span>
              )}
            </div>
            <div className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight mt-2">
              {data?.totalDoctors ?? doctors.length}
            </div>
          </div>

          <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#86868b]">
                Facility Consultations
              </span>
              <span className="text-xs font-medium text-[#86868b]">
                {data?.receptionists?.length || 0} desk staff
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight mt-2">
              {data?.totalBookings ?? 0}
            </div>
          </div>

          <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <div className="text-xs font-medium text-[#86868b]">
              Clinic Revenue
            </div>
            <div className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight mt-2">
              ₹{data?.totalRevenue ? data.totalRevenue.toLocaleString() : '0'}
            </div>
          </div>
        </div>

        {/* Segmented Tab Switcher */}
        <div className="inline-flex p-1 rounded-full bg-[#e8e8ed]/80 border border-[#e5e5ea] max-w-full overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSection('doctors')}
            className={`h-9 px-4 rounded-full text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSection === 'doctors'
                ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)] font-semibold'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <span>Affiliated Doctors</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              activeSection === 'doctors' ? 'bg-[#0066cc]/10 text-[#0066cc]' : 'bg-white/80 text-[#86868b]'
            }`}>
              {doctors.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('receptionists')}
            className={`h-9 px-4 rounded-full text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSection === 'receptionists'
                ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)] font-semibold'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <span>Desk Staff</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              activeSection === 'receptionists' ? 'bg-[#0066cc]/10 text-[#0066cc]' : 'bg-white/80 text-[#86868b]'
            }`}>
              {data?.receptionists?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('appointments')}
            className={`h-9 px-4 rounded-full text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSection === 'appointments'
                ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)] font-semibold'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <span>Facility Bookings</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              activeSection === 'appointments' ? 'bg-[#0066cc]/10 text-[#0066cc]' : 'bg-white/80 text-[#86868b]'
            }`}>
              {data?.recentAppointments?.length || 0}
            </span>
          </button>
        </div>

        {/* 2. Affiliated Doctors Section */}
        {activeSection === 'doctors' && (
        <div id="practitioners-section" className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#f0f0f2] mb-6">
            <div>
              <h2 className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight">
                Affiliated Doctors
              </h2>
              <p className="text-[13px] text-[#86868b] mt-0.5">
                Doctors and revenue generated at {clinic?.clinicName || 'this clinic'}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Invite Doctor
            </button>
          </div>

          {/* Incoming Doctor Affiliation Requests */}
          {data?.incomingRequests && data.incomingRequests.length > 0 && (
            <div className="mb-6 p-5 rounded-[20px] bg-[#f5f5f7] border border-[#e5e5ea]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0066cc]" />
                  <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                    Incoming Doctor Affiliation Requests ({data.incomingRequests.length})
                  </h3>
                </div>
                <span className="text-xs text-[#0066cc] font-medium">Requires Clinic Approval</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.incomingRequests.map((doc) => (
                  <div
                    key={doc.affiliationId || doc.doctorId}
                    className="p-4 rounded-2xl bg-white border border-[#e5e5ea] flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-[14px] text-[#1d1d1f]">{cleanDoctorName(doc.fullName)}</h4>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] font-medium">
                          {doc.specialty}
                        </span>
                      </div>
                      <p className="text-xs text-[#86868b] mt-0.5">{doc.email}</p>
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t border-[#f0f0f2]">
                      <button
                        type="button"
                        onClick={() => handleRespondDoctorAffiliation(doc.affiliationId!, 'ACCEPT')}
                        className="flex-1 h-9 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white font-semibold flex items-center justify-center gap-1 text-xs transition-all cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespondDoctorAffiliation(doc.affiliationId!, 'REJECT')}
                        className="flex-1 h-9 rounded-full bg-[#f5f5f7] hover:bg-rose-50 text-rose-600 border border-[#e5e5ea] font-medium flex items-center justify-center gap-1 text-xs transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Outgoing Doctor Requests */}
          {data?.outgoingRequests && data.outgoingRequests.length > 0 && (
            <div className="mb-6 p-5 rounded-[20px] bg-[#f5f5f7] border border-[#e5e5ea]">
              <div className="flex items-center gap-2 mb-3">
                <Clock3 className="w-4 h-4 text-[#86868b]" />
                <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                  Pending Doctor Invitations ({data.outgoingRequests.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.outgoingRequests.map((doc) => (
                  <div
                    key={doc.affiliationId || doc.doctorId}
                    className="p-3.5 rounded-2xl bg-white border border-[#e5e5ea] flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[14px] text-[#1d1d1f]">{cleanDoctorName(doc.fullName)}</span>
                      <span className="text-xs text-[#86868b] block mt-0.5">{doc.specialty}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
                        Awaiting Doctor
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCancelInvitation(doc.doctorId, doc.fullName)}
                        className="text-rose-600 hover:bg-rose-50 rounded-full text-xs font-medium h-7 px-2.5 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-xs text-[#86868b]">Loading roster...</div>
          ) : doctors.length === 0 ? (
            <div className="py-12 text-center">
              <h3 className="text-[15px] font-semibold text-[#1d1d1f]">No Doctors Affiliated Yet</h3>
              <p className="text-xs text-[#86868b] max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
                Onboard doctors to your clinic to begin receiving facility appointments and tracking isolated clinic revenue.
              </p>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Onboard First Doctor
              </button>
            </div>
          ) : (
            <>
              {/* Mobile Doctor Cards (< 640px) */}
              <div className="block sm:hidden space-y-3">
                {doctors.map((doc) => (
                  <div key={doc.doctorId} className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white border border-[#e5e5ea] overflow-hidden flex-shrink-0">
                          {doc.avatarUrl ? (
                            <img src={getFileUrl(doc.avatarUrl)} alt={doc.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-semibold text-xs text-[#0066cc]">
                              {doc.fullName[0]}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-[#1d1d1f] text-[14px]">{doc.fullName}</div>
                          <div className="text-xs text-[#86868b]">
                            {formatDoctorDegrees(doc.qualifications)} • {doc.experienceYears} yrs exp.
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#0066cc]/10 text-[#0066cc] shrink-0">
                        {doc.specialty}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-[#e5e5ea] text-center">
                      <div>
                        <div className="text-[11px] text-[#86868b]">Fee</div>
                        <div className="font-semibold text-xs text-[#1d1d1f] mt-0.5">₹{doc.consultationFee.toFixed(0)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#86868b]">Bookings</div>
                        <div className="font-semibold text-xs text-[#1d1d1f] mt-0.5">{doc.bookingCount}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#86868b]">Revenue</div>
                        <div className="font-semibold text-xs text-[#1d1d1f] mt-0.5">₹{doc.revenue.toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => handleDetachDoctor(doc.doctorId, doc.fullName)}
                        className="h-8 px-3 rounded-full text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all active:scale-[0.98] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Detach Practitioner</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e5e5ea] text-[#86868b] font-medium">
                    <th className="pb-3 pl-2">Practitioner</th>
                    <th className="pb-3">Specialty</th>
                    <th className="pb-3">Fee</th>
                    <th className="pb-3 text-center">Bookings Here</th>
                    <th className="pb-3 text-right">Revenue Here</th>
                    <th className="pb-3 text-right pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f2]">
                  {doctors.map((doc) => (
                    <tr key={doc.doctorId} className="hover:bg-[#f5f5f7]/60 transition-colors">
                      <td className="py-4 pl-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex-shrink-0">
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
                            <div className="font-semibold text-[#1d1d1f] text-[14px]">
                              {doc.fullName}
                            </div>
                            <div className="text-xs text-[#86868b]">
                              {formatDoctorDegrees(doc.qualifications)} • {doc.experienceYears} yrs exp.
                            </div>
                            <div className="text-[11px] text-[#86868b]">{doc.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#0066cc]/10 text-[#0066cc]">
                          {doc.specialty}
                        </span>
                      </td>

                      <td className="py-4 font-medium text-[#1d1d1f]">
                        ₹{doc.consultationFee.toFixed(0)}
                      </td>

                      <td className="py-4 text-center">
                        <span className="font-semibold text-[#1d1d1f] text-[14px]">
                          {doc.bookingCount}
                        </span>
                        <span className="text-[11px] text-[#86868b] block">
                          ({doc.completedCount} completed)
                        </span>
                      </td>

                      <td className="py-4 text-right">
                        <span className="font-semibold text-[#1d1d1f] text-[14px]">
                          ₹{doc.revenue.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-[#86868b] block">at this clinic</span>
                      </td>

                      <td className="py-4 text-right pr-2">
                        <button
                          onClick={() => handleDetachDoctor(doc.doctorId, doc.fullName)}
                          className="h-8 px-3 rounded-full text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all active:scale-[0.98] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Detach
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        </div>
        )}

        {/* Desk Receptionists & Front Staff Section */}
        {activeSection === 'receptionists' && (
        <div id="receptionists-section" className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#f0f0f2] mb-6">
            <div>
              <h2 className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight">
                Desk Receptionists & Front Staff
              </h2>
              <p className="text-[13px] text-[#86868b] mt-0.5">
                Manage credentials and assign specific affiliated practitioners to each front desk receptionist.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRecModal(true)}
              className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto transition-all cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Provision Receptionist
            </button>
          </div>

          {/* Incoming Receptionist Applications */}
          {data?.incomingReceptionists && data.incomingReceptionists.length > 0 && (
            <div className="mb-6 p-5 rounded-[20px] bg-[#f5f5f7] border border-[#e5e5ea]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0066cc]" />
                  <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                    Incoming Receptionist Applications ({data.incomingReceptionists.length})
                  </h3>
                </div>
                <span className="text-xs font-medium text-[#86868b]">
                  Staff requesting front desk access
                </span>
              </div>

              <div className="space-y-2.5">
                {data.incomingReceptionists.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-2xl bg-white border border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-[14px] text-[#1d1d1f] flex items-center gap-2">
                        <span>{rec.fullName}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#0066cc]/10 text-[#0066cc]">
                          Pending Approval
                        </span>
                      </div>
                      <div className="text-xs text-[#86868b] mt-0.5">
                        <span className="font-medium text-[#1d1d1f]">{rec.email}</span>
                        {rec.phone && <span> • {rec.phone}</span>}
                        <span> • Applied {new Date(rec.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={processingRecId === rec.id}
                        onClick={() => handleRespondReceptionist(rec.id, 'REJECT')}
                        className="h-9 px-3.5 rounded-full text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                      >
                        Decline
                      </button>

                      <button
                        type="button"
                        disabled={processingRecId === rec.id}
                        onClick={() => {
                          setApprovingRec({ id: rec.id, fullName: rec.fullName, email: rec.email });
                          setApprovalDoctorIds([]);
                        }}
                        className="h-9 px-4 rounded-full text-xs font-semibold text-white bg-[#0066cc] hover:bg-[#0071e3] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Review & Assign Doctors
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!data?.receptionists || data.receptionists.length === 0) ? (
            <div className="py-12 text-center">
              <h3 className="text-[15px] font-semibold text-[#1d1d1f]">No Receptionists Provisioned</h3>
              <p className="text-xs text-[#86868b] max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
                Provision secure login credentials for your reception staff. You can configure which doctors each receptionist manages appointments for.
              </p>
              <button
                type="button"
                onClick={() => setShowRecModal(true)}
                className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Provision First Receptionist
              </button>
            </div>
          ) : (
            <>
              {/* Mobile Receptionist Cards (< 640px) */}
              <div className="block sm:hidden space-y-3">
                {data.receptionists.map((rec) => (
                  <div key={rec.id} className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-[#1d1d1f] text-[14px]">{rec.fullName}</h4>
                        <div className="text-xs text-[#86868b]">{rec.email}</div>
                        {rec.phone && <div className="text-xs text-[#86868b]">{rec.phone}</div>}
                      </div>
                      <div className="text-[11px] text-[#86868b] shrink-0">
                        {new Date(rec.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Assigned Doctors */}
                    <div className="pt-2.5 border-t border-[#e5e5ea]">
                      <div className="text-xs text-[#86868b] mb-1.5 font-medium">Assigned Practitioners</div>
                      {(!rec.doctors || rec.doctors.length === 0) ? (
                        <span className="text-xs text-[#86868b] bg-white border border-[#e5e5ea] px-2.5 py-0.5 rounded-full font-medium">
                          No doctors assigned
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {rec.doctors.map((doc) => (
                            <span
                              key={doc.id}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#0066cc]/10 text-[#0066cc]"
                            >
                              {cleanDoctorName(doc.fullName)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[#e5e5ea]">
                      <button
                        onClick={() => handleOpenEditAssignments(rec)}
                        className="h-8 px-3.5 rounded-full text-xs font-medium text-[#1d1d1f] bg-white hover:bg-[#e8e8ed] border border-[#e5e5ea] transition-all active:scale-[0.98] cursor-pointer"
                      >
                        Manage Doctors
                      </button>
                      <button
                        onClick={() => handleRemoveReceptionist(rec.id, rec.fullName)}
                        className="h-8 px-2.5 rounded-full text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all active:scale-[0.98] cursor-pointer"
                        title="Remove receptionist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e5e5ea] text-[#86868b] font-medium">
                    <th className="pb-3 pl-2">Receptionist</th>
                    <th className="pb-3">Contact</th>
                    <th className="pb-3">Assigned Doctors</th>
                    <th className="pb-3 text-right pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f2]">
                  {data.receptionists.map((rec) => (
                    <tr key={rec.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                      <td className="py-4 pl-2">
                        <div className="font-semibold text-[14px] text-[#1d1d1f]">{rec.fullName}</div>
                        <div className="text-[11px] text-[#86868b]">
                          Added {new Date(rec.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-4 text-[#86868b]">
                        <div className="text-xs text-[#1d1d1f] font-medium">{rec.email}</div>
                        {rec.phone && <div className="text-[11px]">{rec.phone}</div>}
                      </td>
                      <td className="py-4">
                        {(!rec.doctors || rec.doctors.length === 0) ? (
                          <span className="text-xs text-[#86868b] bg-[#f5f5f7] border border-[#e5e5ea] px-2.5 py-0.5 rounded-full font-medium">
                            No doctors assigned
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {rec.doctors.map((doc) => (
                              <span
                                key={doc.id}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#0066cc]/10 text-[#0066cc]"
                              >
                                {cleanDoctorName(doc.fullName)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-4 text-right pr-2">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditAssignments(rec)}
                            className="h-8 px-3.5 rounded-full text-xs font-medium text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e5e5ea] transition-all active:scale-[0.98] cursor-pointer"
                          >
                            Manage Doctors
                          </button>
                          <button
                            onClick={() => handleRemoveReceptionist(rec.id, rec.fullName)}
                            className="p-2 rounded-full text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all active:scale-[0.98] cursor-pointer"
                            title="Remove receptionist"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
        )}

        {/* 4. Recent Clinic Appointments Table */}
        {activeSection === 'appointments' && (
        <div id="appointments-section" className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="pb-5 border-b border-[#f0f0f2] mb-6">
            <h2 className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight">
              Recent Consultations at this Facility
            </h2>
            <p className="text-[13px] text-[#86868b] mt-0.5">
              Appointments booked across affiliated practitioners at {clinic?.clinicName || 'this clinic'}.
            </p>
          </div>
          {(!data?.recentAppointments || data.recentAppointments.length === 0) ? (
            <div className="py-12 text-center text-xs text-[#86868b]">
              <p className="font-semibold text-[14px] text-[#1d1d1f]">No Facility Consultations Recorded Yet</p>
              <p className="mt-1">When patients book appointments with affiliated practitioners at this clinic, they will appear here.</p>
            </div>
          ) : (
            <>
              {/* Mobile Recent Appointments Cards (< 640px) */}
              <div className="block sm:hidden space-y-3">
                {data.recentAppointments.map((appt) => (
                  <div key={appt.id} className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#0066cc]/10 text-[#0066cc] font-semibold text-xs">
                          #{appt.queueNumber}
                        </span>
                        <div>
                          <div className="font-semibold text-[14px] text-[#1d1d1f]">{appt.patientName}</div>
                          <div className="text-[11px] text-[#86868b]">{appt.patientPhone}</div>
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                          appt.status === 'COMPLETED' || appt.status === 'IN_CONSULTATION'
                            ? 'bg-[#0066cc]/10 text-[#0066cc]'
                            : 'bg-white text-[#1d1d1f] border border-[#e5e5ea]'
                        }`}
                      >
                        {appt.status === 'PENDING_APPROVAL' ? 'Pending' : appt.status === 'EXPIRED' ? 'Expired' : appt.status === 'IN_CONSULTATION' ? 'In Consultation' : appt.status === 'COMPLETED' ? 'Completed' : 'Waiting'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#86868b] pt-2 border-t border-[#e5e5ea]">
                      <div>{appt.doctorName}</div>
                      <div className="font-semibold text-[#1d1d1f]">₹{appt.fee}</div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#86868b]">
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
                  <tr className="border-b border-[#e5e5ea] text-[#86868b] font-medium">
                    <th className="pb-3 pl-2">Token #</th>
                    <th className="pb-3">Patient</th>
                    <th className="pb-3">Doctor</th>
                    <th className="pb-3">Date & Time</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right pr-2">Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f2]">
                  {data.recentAppointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                      <td className="py-3.5 pl-2">
                        <span className="font-semibold text-[#0066cc]">
                          #{appt.queueNumber}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <div className="font-semibold text-[#1d1d1f]">{appt.patientName}</div>
                        <div className="text-[11px] text-[#86868b]">{appt.patientPhone}</div>
                      </td>
                      <td className="py-3.5 font-medium text-[#1d1d1f]">{appt.doctorName}</td>
                      <td className="py-3.5 text-[#86868b]">
                        <div>{appt.date}</div>
                        <div className="text-[11px]">{appt.estimatedTime || appt.checkingWindow}</div>
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                            appt.status === 'COMPLETED' || appt.status === 'IN_CONSULTATION'
                              ? 'bg-[#0066cc]/10 text-[#0066cc]'
                              : 'bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]'
                          }`}
                        >
                          {appt.status === 'PENDING_APPROVAL' ? 'Pending Desk' : appt.status === 'EXPIRED' ? 'Expired' : appt.status === 'IN_CONSULTATION' ? 'In Consultation' : appt.status === 'COMPLETED' ? 'Completed' : 'Waiting'}
                        </span>
                      </td>
                      <td className="py-3.5 text-right pr-2 font-semibold text-[#1d1d1f]">
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
        )}
      </div>

      {/* Onboard Doctor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-t-[28px] sm:rounded-[28px] border border-[#e5e5ea] max-w-md w-full p-6 sm:p-8 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-8 shadow-[0_24px_60px_rgba(0,0,0,0.16)] max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
            {/* Apple Drag Handle Pill */}
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">Onboard Doctor</h3>
                <p className="text-[13px] text-[#86868b] mt-0.5">
                  Link a verified practitioner to {clinic?.clinicName || 'your clinic'}
                </p>
              </div>
              <button
                disabled={adding}
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-full hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDoctor} className="space-y-4 pt-5">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Doctor's Registered Email
                </label>
                <input
                  type="email"
                  required
                  disabled={adding}
                  value={doctorEmail}
                  onChange={(e) => setDoctorEmail(e.target.value)}
                  placeholder="dr.sarah@mediarca.com"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              {/* Quick Select from Platform Doctors */}
              {allDoctors.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[#86868b]">
                      Or search from verified doctors
                    </label>
                    <span className="text-xs text-[#86868b]">{allDoctors.length} available</span>
                  </div>
                  <input
                    type="text"
                    value={doctorSearchQuery}
                    onChange={(e) => setDoctorSearchQuery(e.target.value)}
                    placeholder="Filter by name, specialty, or email..."
                    className="w-full h-10 px-3.5 rounded-xl border border-[#d2d2d7] text-xs bg-white text-[#1d1d1f] placeholder:text-[#a1a1a6] transition-all focus:outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] mb-2.5"
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
                            className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-between text-xs hover:border-[#d2d2d7] transition-all"
                          >
                            <div
                              className="cursor-pointer flex-1 mr-2"
                              onClick={() => docEmail && setDoctorEmail(docEmail)}
                              title={docEmail ? 'Click to select email' : undefined}
                            >
                              <div className="font-semibold text-[13px] text-[#1d1d1f] hover:text-[#0066cc] transition-colors">{docName}</div>
                              <div className="text-[11px] text-[#86868b] mt-0.5">
                                {d.specialty}{docEmail ? ` • ${docEmail}` : ''}
                              </div>
                            </div>
                            {isAlreadyAdded ? (
                              <span className="text-[11px] text-[#86868b] px-2.5 py-1 rounded-full bg-white border border-[#e5e5ea] font-medium shrink-0">
                                Affiliated
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={adding}
                                onClick={() => handleQuickAdd(docEmail, d.id)}
                                className="h-7 px-3 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold cursor-pointer transition-all active:scale-[0.98] shrink-0"
                              >
                                {adding ? 'Adding...' : 'Add'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-[#f0f0f2] flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={adding}
                  onClick={() => setShowAddModal(false)}
                  className="h-10 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="h-10 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  {adding ? 'Onboarding...' : 'Onboard Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Provision Receptionist Modal */}
      {showRecModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-t-[28px] sm:rounded-[28px] border border-[#e5e5ea] max-w-lg w-full p-6 sm:p-8 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-8 shadow-[0_24px_60px_rgba(0,0,0,0.16)] max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
            {/* Apple Drag Handle Pill */}
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">Provision Desk Receptionist</h3>
                <p className="text-[13px] text-[#86868b] mt-0.5">
                  Create portal login credentials and assign practitioner permissions.
                </p>
              </div>
              <button
                disabled={provisioning}
                onClick={() => setShowRecModal(false)}
                className="p-2 rounded-full hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProvisionReceptionist} className="space-y-4 pt-5">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  disabled={provisioning}
                  value={recFullName}
                  onChange={(e) => setRecFullName(e.target.value)}
                  placeholder="Enter receptionist's full name"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                    Login Email
                  </label>
                  <input
                    type="email"
                    required
                    disabled={provisioning}
                    value={recEmail}
                    onChange={(e) => setRecEmail(e.target.value)}
                    placeholder="desk@clinic.com"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-[#1d1d1f] tracking-tight">
                      Temporary Password
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateRandomPassword}
                      className="text-xs text-[#0066cc] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
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
                    className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Mobile Number <span className="text-[#86868b] font-normal">(Optional)</span>
                </label>
                <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all duration-150 overflow-hidden">
                  <div className="h-full px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] flex items-center justify-center select-none">
                    <span className="text-[13px] font-semibold text-[#1d1d1f]">+91</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    disabled={provisioning}
                    value={sanitizeIndianPhone(recPhone)}
                    onChange={(e) => {
                      const digits = sanitizeIndianPhone(e.target.value);
                      setRecPhone(digits ? `+91 ${digits}` : '');
                    }}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    className="w-full h-full px-3.5 bg-transparent text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none tracking-wide"
                  />
                </div>
              </div>

              {/* Doctor Assignments */}
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1 tracking-tight">
                  Assign Doctors to this Receptionist Desk
                </label>
                <p className="text-xs text-[#86868b] mb-2.5">
                  Select which affiliated doctors this receptionist is authorized to manage queues and appointments for.
                </p>
                {doctors.length === 0 ? (
                  <div className="p-3.5 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl text-xs text-[#86868b] text-center">
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
                              : 'bg-white border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#f5f5f7]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                                isSelected
                                  ? 'bg-[#0066cc] border-transparent text-white'
                                  : 'border-[#d2d2d7] bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <div>
                              <div className="font-semibold text-[13px] text-[#1d1d1f]">{cleanDoctorName(doc.fullName)}</div>
                              <div className="text-[11px] text-[#86868b]">{doc.specialty}</div>
                            </div>
                          </div>
                          <span className="text-xs text-[#86868b]">₹{doc.consultationFee}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#f0f0f2] flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={provisioning}
                  onClick={() => setShowRecModal(false)}
                  className="h-10 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provisioning}
                  className="h-10 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  {provisioning ? 'Provisioning...' : 'Provision Receptionist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Assigned Doctors Modal */}
      {editingRec && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-t-[28px] sm:rounded-[28px] border border-[#e5e5ea] max-w-md w-full p-6 sm:p-8 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-8 shadow-[0_24px_60px_rgba(0,0,0,0.16)] max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
            {/* Apple Drag Handle Pill */}
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">Manage Doctor Desk Access</h3>
                <p className="text-[13px] text-[#86868b] mt-0.5">
                  Configure active doctor assignments for {editingRec.fullName}.
                </p>
              </div>
              <button
                disabled={savingAssignments}
                onClick={() => setEditingRec(null)}
                className="p-2 rounded-full hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAssignedDoctors} className="space-y-4 pt-5">
              <p className="text-xs text-[#86868b] leading-relaxed">
                Select which affiliated doctors this receptionist is authorized to book walk-ins and manage queues for:
              </p>

              {doctors.length === 0 ? (
                <div className="p-4 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl text-xs text-[#86868b] text-center">
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
                            : 'bg-white border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#f5f5f7]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                              isSelected
                                ? 'bg-[#0066cc] border-transparent text-white'
                                : 'border-[#d2d2d7] bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div>
                            <div className="font-semibold text-[13px] text-[#1d1d1f]">{cleanDoctorName(doc.fullName)}</div>
                            <div className="text-[11px] text-[#86868b]">{doc.specialty}</div>
                          </div>
                        </div>
                        <span className="text-xs text-[#86868b]">₹{doc.consultationFee}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-4 border-t border-[#f0f0f2] flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={savingAssignments}
                  onClick={() => setEditingRec(null)}
                  className="h-10 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAssignments}
                  className="h-10 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingAssignments ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receptionist Credentials Handover Modal */}
      {createdCredentials && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-t-[28px] sm:rounded-[28px] border border-[#e5e5ea] max-w-md w-full p-6 sm:p-8 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-8 shadow-[0_24px_60px_rgba(0,0,0,0.16)] space-y-5 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
            {/* Apple Drag Handle Pill */}
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">Desk Credentials Ready</h3>
                <p className="text-[13px] text-[#86868b] mt-0.5">Provide these credentials to your front desk staff</p>
              </div>
              <button
                onClick={() => setCreatedCredentials(null)}
                className="p-2 rounded-full text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs space-y-1 leading-relaxed">
              <p className="font-semibold">Handover Notice</p>
              <p className="text-xs text-[#86868b]">
                Your receptionist can log in using the credentials below via the Receptionist Portal link at the bottom of the landing page.
              </p>
            </div>

            <div className="bg-[#f5f5f7] rounded-2xl p-4 border border-[#e5e5ea] space-y-3 text-xs">
              <div>
                <span className="text-xs text-[#86868b] font-medium block mb-0.5">
                  Staff Member Name
                </span>
                <span className="text-[#1d1d1f] font-semibold text-[14px]">
                  {createdCredentials.fullName}
                </span>
              </div>

              <div>
                <span className="text-xs text-[#86868b] font-medium block mb-1">
                  Login Email (Desk ID)
                </span>
                <span className="text-[#0066cc] select-all bg-white px-3 py-2 rounded-xl border border-[#e5e5ea] block font-semibold">
                  {createdCredentials.email}
                </span>
              </div>

              <div>
                <span className="text-xs text-[#86868b] font-medium block mb-1">
                  Temporary Password
                </span>
                <span className="text-[#1d1d1f] select-all bg-white px-3 py-2 rounded-xl border border-[#e5e5ea] block font-semibold">
                  {createdCredentials.password}
                </span>
              </div>

              <div>
                <span className="text-xs text-[#86868b] font-medium block mb-0.5">
                  Portal Login URL
                </span>
                <span className="text-[#0066cc] text-xs block select-all font-medium break-all">
                  {`${window.location.origin}${window.location.pathname}#/receptionist/login`}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const portalUrl = `${window.location.origin}${window.location.pathname}#/receptionist/login`;
                  const text = `MediArca Receptionist Desk Credentials\nFacility: ${clinic?.clinicName || 'Clinic'}\nName: ${createdCredentials.fullName}\nEmail (Desk ID): ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nLogin Portal: ${portalUrl}`;
                  navigator.clipboard.writeText(text);
                  setCopiedCreds(true);
                  setTimeout(() => setCopiedCreds(false), 2500);
                }}
                className="h-10 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedCreds ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#0066cc]" />
                    Copied to Clipboard
                  </>
                ) : (
                  'Copy All Credentials'
                )}
              </button>

              <button
                type="button"
                onClick={() => setCreatedCredentials(null)}
                className="h-10 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review & Approve Incoming Receptionist Modal */}
      {approvingRec && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-t-[28px] sm:rounded-[28px] border border-[#e5e5ea] max-w-md w-full p-6 sm:p-8 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-8 shadow-[0_24px_60px_rgba(0,0,0,0.16)] max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
            {/* Apple Drag Handle Pill */}
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">Approve Receptionist</h3>
                <p className="text-[13px] text-[#86868b] mt-0.5">
                  Assign practitioners to {approvingRec.fullName}
                </p>
              </div>
              <button
                disabled={processingRecId !== null}
                onClick={() => setApprovingRec(null)}
                className="p-2 rounded-full hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs">
                <div className="font-semibold text-[14px] text-[#1d1d1f]">{approvingRec.fullName}</div>
                <div className="text-xs text-[#86868b] mt-0.5">{approvingRec.email}</div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1 tracking-tight">
                  Assign Doctors Managed by this Receptionist
                </label>
                <p className="text-xs text-[#86868b] mb-3 leading-relaxed">
                  This receptionist will only be able to view schedules, book walk-ins, and manage queues for selected practitioners.
                </p>

                {doctors.filter((d) => d.status === 'ACCEPTED').length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#f5f5f7] text-[#86868b] text-xs border border-[#e5e5ea]">
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
                                    : 'bg-white border-[#d2d2d7]'
                                }`}
                              >
                                {isChecked && <Check className="w-3 h-3" />}
                              </div>
                              <span className="font-semibold text-[#1d1d1f]">{cleanDoctorName(doc.fullName)}</span>
                              <span className="text-xs text-[#0066cc]">({doc.specialty})</span>
                            </div>
                            <span className="text-xs text-[#86868b]">₹{doc.consultationFee}</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#f0f0f2] flex justify-end gap-2.5">
              <button
                type="button"
                disabled={processingRecId !== null}
                onClick={() => setApprovingRec(null)}
                className="h-10 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingRecId !== null}
                onClick={() => handleRespondReceptionist(approvingRec.id, 'ACCEPT', approvalDoctorIds)}
                className="h-10 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                {processingRecId === approvingRec.id ? 'Approving...' : 'Approve & Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clinic Physical Check-In QR Standee Modal */}
      {clinic && (
        <ClinicQrStandeeModal
          isOpen={showPosterModal}
          onClose={() => setShowPosterModal(false)}
          clinicId={clinic.id}
          clinicName={clinic.clinicName}
          clinicAddress={`${clinic.address || ''}${clinic.city ? `, ${clinic.city}` : ''}`}
          checkinCode={clinic.checkinCode || undefined}
        />
      )}
    </DashboardLayout>
  );
};
