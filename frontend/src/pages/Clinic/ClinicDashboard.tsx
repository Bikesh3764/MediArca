import React, { useEffect, useState, useCallback } from 'react';
import { api, ClinicDashboardData, ClinicReceptionistItem, Doctor } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import {
  Users,
  CalendarCheck,
  DollarSign,
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
} from 'lucide-react';

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
    fetchClinicData(false);
    fetchAvailableDoctors();
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

  const handleQuickAdd = async (email: string) => {
    setAdding(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.addDoctorToClinic({ doctorEmail: email });
      setSuccessMsg(res.message || 'Doctor onboarded successfully');
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
      setSuccessMsg(res.message || 'Assigned doctor permissions updated successfully.');
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

  const clinic = data?.clinic;
  const doctors = data?.doctors || [];
  const totalPendingRequests = data?.incomingRequests?.length || 0;

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
      badge: data?.receptionists?.length || undefined,
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
      subtitle={`${clinic?.address || 'Clinical Operations Dashboard'} ${
        clinic?.city ? `• ${clinic.city}` : ''
      }`}
      headerAction={
        <div className="flex items-center gap-2.5">
          <AppleButton
            variant="secondary"
            size="sm"
            onClick={() => setShowRecModal(true)}
            className="flex items-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Provision Receptionist
          </AppleButton>
          <AppleButton
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Invite Doctor
          </AppleButton>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Verification Warning if clinic not yet verified or suspended */}
        {clinic?.verificationStatus === 'SUSPENDED' && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3 shadow-xs">
            <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-rose-900">Clinic Facility License Suspended</div>
              <p className="text-rose-800 text-[11px] mt-0.5">
                Your facility license has been suspended by administration. Doctors cannot accept new affiliations or clinic bookings until license reinstatement.
              </p>
            </div>
          </div>
        )}
        {clinic?.verificationStatus === 'REJECTED' && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3 shadow-xs">
            <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-rose-900">Clinic Registration Application Rejected</div>
              <p className="text-rose-800 text-[11px] mt-0.5">
                Your clinic registration credentials were not approved. Please contact platform administration to review your facility details.
              </p>
            </div>
          </div>
        )}
        {((clinic?.verificationStatus === 'PENDING' || clinic?.isVerified === false) && clinic?.verificationStatus !== 'SUSPENDED' && clinic?.verificationStatus !== 'REJECTED') && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3 shadow-xs">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-900">Clinic Pending Administrative Verification</div>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Your clinic profile is currently pending review by MediArca administration. While unverified, your clinic will not appear in public clinic searches or doctor affiliation directories. You can still onboard doctors, manage front desk staff, and configure operations.
              </p>
            </div>
          </div>
        )}

        {/* Banner feedback */}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-700 hover:text-emerald-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-700 hover:text-rose-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. Clinic Metrics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
                Affiliated Doctors
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0088e8] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-semibold text-[#1d1d1f]">
              {data?.totalDoctors ?? doctors.length}
            </div>
            <p className="text-[11px] text-[#86868b] mt-1">Practitioners linked to this facility</p>
          </div>

          <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
                Clinic Appointments
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <CalendarCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-semibold text-[#1d1d1f]">
              {data?.totalBookings ?? 0}
            </div>
            <p className="text-[11px] text-[#86868b] mt-1">Booked at this facility across all doctors</p>
          </div>

          <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
                Clinic Revenue
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-semibold text-[#1d1d1f]">
              ${data?.totalRevenue ? data.totalRevenue.toLocaleString() : '0'}
            </div>
            <p className="text-[11px] text-[#86868b] mt-1">
              Generated specifically at this facility
            </p>
          </div>
        </div>

        {/* 2. Affiliated Doctors Section */}
        <div id="practitioners-section" className="scroll-mt-6 bg-white rounded-[24px] border border-[#e5e5ea] p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#f0f0f0] mb-6">
            <div>
              <h2 className="text-lg font-semibold text-[#1d1d1f] tracking-tight">
                Practitioner Roster & Attribution
              </h2>
              <p className="text-xs text-[#86868b] mt-0.5">
                Each practitioner's bookings and revenue generated specifically at{' '}
                {clinic?.clinicName || 'this clinic'}.
              </p>
            </div>
            <AppleButton
              variant="secondary"
              size="sm"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 self-start sm:self-auto"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Invite Doctor
            </AppleButton>
          </div>

          {/* Incoming Doctor Affiliation Requests */}
          {data?.incomingRequests && data.incomingRequests.length > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-[#0088e8]/5 border-2 border-[#0088e8]/20 animate-fadeIn">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-[#0088e8]" />
                  <h3 className="text-sm font-semibold text-[#1d1d1f]">
                    Incoming Doctor Affiliation Requests ({data.incomingRequests.length})
                  </h3>
                </div>
                <span className="text-[11px] text-[#0088e8] font-medium">Requires Clinic Approval</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.incomingRequests.map((doc) => (
                  <div
                    key={doc.affiliationId || doc.doctorId}
                    className="p-3.5 rounded-xl bg-white border border-[#e5e5ea] flex flex-col justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-xs text-[#1d1d1f]">Dr. {doc.fullName}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-[#0088e8] font-medium">
                          {doc.specialty}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#86868b] mt-0.5">{doc.email}</p>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-[#f0f0f0]">
                      <AppleButton
                        size="sm"
                        variant="primary"
                        onClick={() => handleRespondDoctorAffiliation(doc.affiliationId!, 'ACCEPT')}
                        className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Accept
                      </AppleButton>
                      <AppleButton
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRespondDoctorAffiliation(doc.affiliationId!, 'REJECT')}
                        className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 text-rose-600 hover:bg-rose-50"
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

          {/* Pending Outgoing Doctor Requests */}
          {data?.outgoingRequests && data.outgoingRequests.length > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-50/50 border border-amber-200">
              <div className="flex items-center gap-2 mb-3">
                <Clock3 className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-[#1d1d1f]">
                  Pending Doctor Invitations ({data.outgoingRequests.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.outgoingRequests.map((doc) => (
                  <div
                    key={doc.affiliationId || doc.doctorId}
                    className="p-3 rounded-xl bg-white border border-amber-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#1d1d1f]">Dr. {doc.fullName}</span>
                      <span className="text-[10px] text-[#86868b] block">{doc.specialty}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        Awaiting Doctor
                      </span>
                      <AppleButton
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancelInvitation(doc.doctorId, doc.fullName)}
                        className="text-rose-600 hover:bg-rose-50 text-[11px] h-7 px-2"
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
            <div className="py-12 text-center text-xs text-[#86868b]">Loading roster...</div>
          ) : doctors.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] flex items-center justify-center mx-auto mb-3 text-[#86868b]">
                <Stethoscope className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">No Doctors Affiliated Yet</h3>
              <p className="text-xs text-[#86868b] max-w-sm mx-auto mt-1 mb-4">
                Onboard doctors to your clinic to begin receiving facility appointments and tracking isolated clinic revenue.
              </p>
              <AppleButton
                variant="primary"
                size="sm"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Onboard First Doctor
              </AppleButton>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                <tbody className="divide-y divide-[#f0f0f0]">
                  {doctors.map((doc) => (
                    <tr key={doc.doctorId} className="hover:bg-[#fafafc]">
                      <td className="py-4 pl-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex-shrink-0">
                            {doc.avatarUrl ? (
                              <img
                                src={doc.avatarUrl}
                                alt={doc.fullName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-semibold text-xs text-[#0088e8]">
                                {doc.fullName[0]}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-[#1d1d1f] text-sm">
                              {doc.fullName}
                            </div>
                            <div className="text-[11px] text-[#86868b]">
                              {doc.qualifications} • {doc.experienceYears} yrs exp.
                            </div>
                            <div className="text-[10px] text-[#86868b]">{doc.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 text-[#0088e8] border border-blue-100">
                          {doc.specialty}
                        </span>
                      </td>

                      <td className="py-4 font-medium text-[#1d1d1f]">
                        ${doc.consultationFee.toFixed(0)}
                      </td>

                      <td className="py-4 text-center">
                        <span className="font-semibold text-[#1d1d1f] text-sm">
                          {doc.bookingCount}
                        </span>
                        <span className="text-[10px] text-[#86868b] block">
                          ({doc.completedCount} completed)
                        </span>
                      </td>

                      <td className="py-4 text-right">
                        <span className="font-semibold text-emerald-600 text-sm">
                          ${doc.revenue.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#86868b] block">at this clinic</span>
                      </td>

                      <td className="py-4 text-right pr-2">
                        <button
                          onClick={() => handleDetachDoctor(doc.doctorId, doc.fullName)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors inline-flex items-center gap-1"
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
          )}
        </div>

        {/* Desk Receptionists & Front Staff Section */}
        <div id="receptionists-section" className="scroll-mt-6 bg-white rounded-[24px] border border-[#e5e5ea] p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#f0f0f0] mb-6">
            <div>
              <h2 className="text-lg font-semibold text-[#1d1d1f] tracking-tight">
                Desk Receptionists & Front Staff
              </h2>
              <p className="text-xs text-[#86868b] mt-0.5">
                Manage credentials and assign specific affiliated practitioners to each front desk receptionist.
              </p>
            </div>
            <AppleButton
              variant="secondary"
              size="sm"
              onClick={() => setShowRecModal(true)}
              className="flex items-center gap-1.5 self-start sm:self-auto"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Provision Receptionist
            </AppleButton>
          </div>

          {(!data?.receptionists || data.receptionists.length === 0) ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] flex items-center justify-center mx-auto mb-3 text-[#86868b]">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">No Receptionists Provisioned</h3>
              <p className="text-xs text-[#86868b] max-w-sm mx-auto mt-1 mb-4">
                Provision secure login credentials for your reception staff. You can configure which doctors each receptionist manages appointments for.
              </p>
              <AppleButton
                variant="primary"
                size="sm"
                onClick={() => setShowRecModal(true)}
                className="inline-flex items-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Provision First Receptionist
              </AppleButton>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e5e5ea] text-[#86868b] font-medium">
                    <th className="pb-3 pl-2">Receptionist</th>
                    <th className="pb-3">Contact</th>
                    <th className="pb-3">Assigned Doctors</th>
                    <th className="pb-3 text-right pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f0]">
                  {data.receptionists.map((rec) => (
                    <tr key={rec.id} className="hover:bg-[#fafafc]">
                      <td className="py-4 pl-2">
                        <div className="font-semibold text-[#1d1d1f]">{rec.fullName}</div>
                        <div className="text-[10px] text-[#86868b]">
                          Added {new Date(rec.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-4 text-[#86868b]">
                        <div className="text-[11px] text-[#1d1d1f] font-mono">{rec.email}</div>
                        {rec.phone && <div className="text-[10px]">{rec.phone}</div>}
                      </td>
                      <td className="py-4">
                        {(!rec.doctors || rec.doctors.length === 0) ? (
                          <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-medium">
                            No doctors assigned
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {rec.doctors.map((doc) => (
                              <span
                                key={doc.id}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-[#0088e8] border border-blue-100"
                              >
                                Dr. {doc.fullName}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-4 text-right pr-2">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditAssignments(rec)}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#0088e8] hover:bg-blue-50 border border-blue-200 transition-colors"
                          >
                            Manage Doctors
                          </button>
                          <button
                            onClick={() => handleRemoveReceptionist(rec.id, rec.fullName)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
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
          )}
        </div>

        {/* 4. Recent Clinic Appointments Table */}
        <div id="appointments-section" className="scroll-mt-6 bg-white rounded-[24px] border border-[#e5e5ea] p-6 sm:p-8 shadow-xs">
          <h3 className="text-base font-semibold text-[#1d1d1f] mb-4">
            Recent Consultations at this Facility
          </h3>
          {(!data?.recentAppointments || data.recentAppointments.length === 0) ? (
            <div className="py-12 text-center text-xs text-[#86868b]">
              <CalendarCheck className="w-8 h-8 text-[#86868b] mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-[#1d1d1f]">No Facility Consultations Recorded Yet</p>
              <p className="mt-1">When patients book appointments with affiliated practitioners at this clinic, they will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                <tbody className="divide-y divide-[#f0f0f0]">
                  {data.recentAppointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-[#fafafc]">
                      <td className="py-3 pl-2">
                        <span className="font-mono font-semibold text-[#0088e8]">
                          #{appt.queueNumber}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="font-medium text-[#1d1d1f]">{appt.patientName}</div>
                        <div className="text-[10px] text-[#86868b]">{appt.patientPhone}</div>
                      </td>
                      <td className="py-3 font-medium text-[#1d1d1f]">{appt.doctorName}</td>
                      <td className="py-3 text-[#86868b]">
                        <div>{appt.date}</div>
                        <div className="text-[10px]">{appt.estimatedTime || appt.checkingWindow}</div>
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            appt.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : appt.status === 'IN_CONSULTATION'
                              ? 'bg-blue-50 text-[#0088e8] border border-blue-200'
                              : appt.status === 'WAITING'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {appt.status}
                        </span>
                      </td>
                      <td className="py-3 text-right pr-2 font-medium text-[#1d1d1f]">
                        ${appt.fee}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Onboard Doctor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[24px] border border-[#e5e5ea] max-w-md w-full p-6 sm:p-8 shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-[#f0f0f0]">
              <div>
                <h3 className="text-base font-semibold text-[#1d1d1f]">Onboard Doctor</h3>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Link a verified practitioner to {clinic?.clinicName || 'your clinic'}
                </p>
              </div>
              <button
                disabled={adding}
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-[#86868b]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDoctor} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Doctor's Registered Email
                </label>
                <input
                  type="email"
                  required
                  disabled={adding}
                  value={doctorEmail}
                  onChange={(e) => setDoctorEmail(e.target.value)}
                  placeholder="e.g. dr.sarah@mediarca.com"
                  className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-xs focus:outline-none focus:border-[#0088e8]"
                />
              </div>

              {/* Quick Select from Platform Doctors */}
              {allDoctors.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[#86868b]">
                      Or search & pick from verified doctors:
                    </label>
                    <span className="text-[10px] text-[#86868b]">{allDoctors.length} available</span>
                  </div>
                  <input
                    type="text"
                    value={doctorSearchQuery}
                    onChange={(e) => setDoctorSearchQuery(e.target.value)}
                    placeholder="Filter by name, specialty, or email..."
                    className="w-full h-8 px-3 rounded-lg border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0088e8] mb-2"
                  />
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {allDoctors
                      .filter((d) => {
                        if (!doctorSearchQuery.trim()) return true;
                        const q = doctorSearchQuery.toLowerCase().trim();
                        return (
                          d.user.fullName.toLowerCase().includes(q) ||
                          d.specialty.toLowerCase().includes(q) ||
                          d.user.email.toLowerCase().includes(q)
                        );
                      })
                      .map((d) => {
                        const isAlreadyAdded = doctors.some((doc) => doc.doctorId === d.id);
                        return (
                          <div
                            key={d.id}
                            className="p-2 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-medium text-[#1d1d1f]">{d.user.fullName}</div>
                              <div className="text-[10px] text-[#86868b]">
                                {d.specialty} • {d.user.email}
                              </div>
                            </div>
                            {isAlreadyAdded ? (
                              <span className="text-[10px] text-[#86868b] px-2 py-0.5 rounded-full bg-[#e5e5ea]">
                                Affiliated
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={adding}
                                onClick={() => handleQuickAdd(d.user.email)}
                                className="px-2.5 py-1 rounded-full bg-gradient-to-r from-[#0088e8] to-[#10b981] text-white text-[11px] font-medium hover:opacity-95 shadow-xs cursor-pointer"
                              >
                                Add
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-[#f0f0f0] flex justify-end gap-2">
                <AppleButton
                  variant="ghost"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[24px] border border-[#e5e5ea] max-w-lg w-full p-6 sm:p-8 shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-[#f0f0f0]">
              <div>
                <h3 className="text-base font-semibold text-[#1d1d1f]">Provision Desk Receptionist</h3>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Create portal login credentials and assign practitioner management permissions.
                </p>
              </div>
              <button
                disabled={provisioning}
                onClick={() => setShowRecModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-[#86868b]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProvisionReceptionist} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={provisioning}
                  value={recFullName}
                  onChange={(e) => setRecFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-xs focus:outline-none focus:border-[#0088e8]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    Login Email *
                  </label>
                  <input
                    type="email"
                    required
                    disabled={provisioning}
                    value={recEmail}
                    onChange={(e) => setRecEmail(e.target.value)}
                    placeholder="desk@clinic.com"
                    className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-xs focus:outline-none focus:border-[#0088e8]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-[#1d1d1f]">
                      Temporary Password *
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateRandomPassword}
                      className="text-[11px] text-[#0088e8] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
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
                    placeholder="Min. 6 characters"
                    className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-xs focus:outline-none focus:border-[#0088e8] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  disabled={provisioning}
                  value={recPhone}
                  onChange={(e) => setRecPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-xs focus:outline-none focus:border-[#0088e8]"
                />
              </div>

              {/* Doctor Assignments */}
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Assign Doctors to this Receptionist Desk
                </label>
                <p className="text-[11px] text-[#86868b] mb-2">
                  Select which affiliated doctors this receptionist is authorized to manage queues and appointments for.
                </p>
                {doctors.length === 0 ? (
                  <div className="p-3 bg-[#f5f5f7] rounded-xl text-xs text-[#86868b] text-center">
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
                          className={`p-2.5 rounded-xl border cursor-pointer transition-colors flex items-center justify-between text-xs ${
                            isSelected
                              ? 'bg-[#0088e8]/5 border-[#0088e8]/40 text-[#0088e8]'
                              : 'bg-white border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#fafafc]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                                isSelected
                                  ? 'bg-gradient-to-r from-[#0088e8] to-[#10b981] border-transparent text-white'
                                  : 'border-[#c7c7cc] bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <div>
                              <div className="font-medium text-[#1d1d1f]">Dr. {doc.fullName}</div>
                              <div className="text-[10px] text-[#86868b]">{doc.specialty}</div>
                            </div>
                          </div>
                          <span className="text-[10px] text-[#86868b]">${doc.consultationFee}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#f0f0f0] flex justify-end gap-2">
                <AppleButton
                  variant="ghost"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[24px] border border-[#e5e5ea] max-w-md w-full p-6 sm:p-8 shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-[#f0f0f0]">
              <div>
                <h3 className="text-base font-semibold text-[#1d1d1f]">Manage Doctor Desk Access</h3>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Configure active doctor assignments for {editingRec.fullName}.
                </p>
              </div>
              <button
                disabled={savingAssignments}
                onClick={() => setEditingRec(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-[#86868b]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAssignedDoctors} className="space-y-4 pt-4">
              <p className="text-xs text-[#86868b]">
                Select which affiliated doctors this receptionist is authorized to book walk-ins and manage queues for:
              </p>

              {doctors.length === 0 ? (
                <div className="p-4 bg-[#f5f5f7] rounded-xl text-xs text-[#86868b] text-center">
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
                        className={`p-2.5 rounded-xl border cursor-pointer transition-colors flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-[#0088e8]/5 border-[#0088e8]/40 text-[#0088e8]'
                            : 'bg-white border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#fafafc]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                              isSelected
                                ? 'bg-gradient-to-r from-[#0088e8] to-[#10b981] border-transparent text-white'
                                : 'border-[#c7c7cc] bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div>
                            <div className="font-medium text-[#1d1d1f]">Dr. {doc.fullName}</div>
                            <div className="text-[10px] text-[#86868b]">{doc.specialty}</div>
                          </div>
                        </div>
                        <span className="text-[10px] text-[#86868b]">${doc.consultationFee}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-4 border-t border-[#f0f0f0] flex justify-end gap-2">
                <AppleButton
                  variant="ghost"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[24px] border border-[#e5e5ea] max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f0]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1d1d1f]">Desk Credentials Ready</h3>
                  <p className="text-xs text-[#86868b]">Provide these credentials to your front desk staff</p>
                </div>
              </div>
              <button
                onClick={() => setCreatedCredentials(null)}
                className="p-1 rounded-full text-[#86868b] hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs space-y-1 leading-relaxed">
              <p className="font-semibold">Handover Notice:</p>
              <p className="text-[11px] text-amber-800">
                Direct public receptionist signup is disabled. Your receptionist must log in using the credentials below via the Receptionist Portal link at the bottom of the landing page.
              </p>
            </div>

            <div className="bg-[#f5f5f7] rounded-2xl p-4 border border-[#e5e5ea] space-y-3 font-mono text-xs">
              <div>
                <span className="text-[10px] text-[#86868b] uppercase tracking-wider font-sans font-semibold block">
                  Staff Member Name
                </span>
                <span className="text-[#1d1d1f] font-sans font-semibold text-sm">
                  {createdCredentials.fullName}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#86868b] uppercase tracking-wider font-sans font-semibold block">
                  Login Email (Desk ID)
                </span>
                <span className="text-[#1d1d1f] select-all bg-white px-2.5 py-1 rounded-lg border border-[#e5e5ea] block mt-0.5 font-bold text-[#0088e8]">
                  {createdCredentials.email}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#86868b] uppercase tracking-wider font-sans font-semibold block">
                  Temporary Password
                </span>
                <span className="text-[#1d1d1f] select-all bg-white px-2.5 py-1 rounded-lg border border-[#e5e5ea] block mt-0.5 font-bold">
                  {createdCredentials.password}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#86868b] uppercase tracking-wider font-sans font-semibold block">
                  Portal Login URL
                </span>
                <span className="text-[#0088e8] text-[11px] block mt-0.5 select-all font-mono break-all">
                  {`${window.location.origin}${window.location.pathname}#/receptionist/login`}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row justify-end gap-2">
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
    </DashboardLayout>
  );
};
