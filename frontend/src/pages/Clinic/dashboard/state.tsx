import React, { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ClinicDashboardData, ClinicReceptionistItem, Doctor } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { DashboardNavItem } from '../../../components/layout/DashboardLayout';
import { isValidIndianPhone, formatIndianPhone } from '../../../utils/phoneUtils';
import { Users, CalendarCheck, UserCheck, Settings } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';

/** All data, effects and actions for ClinicDashboard, shared with its parts through context. */
export const useClinicDashboardState = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [data, setData] = useState<ClinicDashboardData | null>(null);
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeSection: 'doctors' | 'receptionists' | 'appointments' =
    tabParam === 'receptionists' || tabParam === 'appointments' ? tabParam : 'doctors';
  const setActiveSection = (section: 'doctors' | 'receptionists' | 'appointments') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', section);
      return next;
    });
  };
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
  const [showReportModal, setShowReportModal] = useState(false);
  // Clinic Profile Completion Modal (Address, State, City)
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileAddress, setProfileAddress] = useState('');
  const [profileState, setProfileState] = useState('');
  const [profileCity, setProfileCity] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
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
      const docs = await api.getDoctors({ limit: 50 });
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
    const ok = await confirm({
      title: 'Detach Doctor?',
      message: `Are you sure you want to detach Dr. ${docName} from your clinic? Their existing records will remain preserved.`,
      confirmText: 'Detach Doctor',
      isDestructive: true,
    });
    if (!ok) return;

    try {
      await api.removeDoctorFromClinic(doctorId);
      toast.success(`Dr. ${docName} has been detached from your clinic`);
      setSuccessMsg(`Dr. ${docName} has been detached from your clinic.`);
      fetchClinicData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to detach doctor');
      setError(err.message || 'Failed to detach doctor');
    }
  };
  const handleCancelInvitation = async (doctorId: string, docName: string) => {
    const ok = await confirm({
      title: 'Cancel Invitation?',
      message: `Are you sure you want to cancel the pending affiliation invitation to Dr. ${docName}?`,
      confirmText: 'Cancel Invitation',
      isDestructive: true,
    });
    if (!ok) return;

    try {
      await api.removeDoctorFromClinic(doctorId);
      toast.success(`Invitation to Dr. ${docName} has been cancelled`);
      setSuccessMsg(`Invitation to Dr. ${docName} has been cancelled.`);
      fetchClinicData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel invitation');
      setError(err.message || 'Failed to cancel invitation');
    }
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
      setError('Enter name, email and password.');
      return;
    }
    if (recPassword.trim().length < 8) {
      setError('Receptionist password must be at least 8 characters long.');
      return;
    }
    if (recPhone.trim() && !isValidIndianPhone(recPhone.trim())) {
      setError('Enter a valid 10-digit mobile number.');
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
    const ok = await confirm({
      title: 'Remove Receptionist?',
      message: `Are you sure you want to remove receptionist "${recName}"? Their portal credentials will be revoked immediately.`,
      confirmText: 'Revoke & Remove',
      isDestructive: true,
    });
    if (!ok) return;

    try {
      await api.removeClinicReceptionist(recId);
      toast.success(`Receptionist "${recName}" removed`);
      setSuccessMsg(`Receptionist "${recName}" removed successfully.`);
      fetchClinicData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove receptionist');
      setError(err.message || 'Failed to remove receptionist');
    }
  };
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileAddress.trim()) {
      setProfileError('Clinic street address is required.');
      return;
    }
    if (!profileState) {
      setProfileError('Please select a State.');
      return;
    }
    if (!profileCity) {
      setProfileError('Please select or enter a City.');
      return;
    }
    if (profilePhone.trim() && !isValidIndianPhone(profilePhone.trim())) {
      setProfileError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    setProfileError(null);
    setSavingProfile(true);
    try {
      await api.updateClinicProfile({
        address: profileAddress.trim(),
        state: profileState,
        city: profileCity.trim(),
        phone: profilePhone.trim() ? formatIndianPhone(profilePhone.trim()) : undefined,
      });
      setShowProfileModal(false);
      setSuccessMsg('Clinic location details updated successfully.');
      fetchClinicData(false);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update clinic profile.');
    } finally {
      setSavingProfile(false);
    }
  };
  // Receptionist Application Approval State
  const [approvingRec, setApprovingRec] = useState<{ id: string; fullName: string; email: string } | null>(null);
  const [approvalDoctorIds, setApprovalDoctorIds] = useState<string[]>([]);
  const [processingRecId, setProcessingRecId] = useState<string | null>(null);
  const isAnyModalOpen =
    showAddModal ||
    showRecModal ||
    Boolean(editingRec) ||
    Boolean(createdCredentials) ||
    Boolean(approvingRec) ||
    showProfileModal ||
    showPosterModal ||
    showReportModal;
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
      label: 'Doctors',
      icon: Users,
      active: activeSection === 'doctors',
      badge: totalPendingRequests > 0 ? `${totalPendingRequests} new` : undefined,
      onClick: () => setActiveSection('doctors'),
    },
    {
      id: 'receptionists',
      label: 'Staff',
      icon: UserCheck,
      active: activeSection === 'receptionists',
      badge: incomingRecCount > 0 ? `${incomingRecCount} new` : (data?.receptionists?.length || undefined),
      onClick: () => setActiveSection('receptionists'),
    },
    {
      id: 'appointments',
      label: 'Bookings',
      icon: CalendarCheck,
      active: activeSection === 'appointments',
      badge: data?.totalBookings || undefined,
      onClick: () => setActiveSection('appointments'),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/clinic/profile',
    },
  ];
  const getApptStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'IN_CONSULTATION':
        return {
          label: status === 'COMPLETED' ? 'Completed' : 'In Consultation',
          className: 'bg-[#0066cc]/10 text-[#0066cc]',
        };
      case 'PENDING_APPROVAL':
        return {
          label: 'Pending Desk',
          className: 'bg-warning-soft text-warning border border-warning-line/80',
        };
      case 'CANCELLED':
        return {
          label: 'Cancelled',
          className: 'bg-danger-soft text-danger border border-danger-line/80',
        };
      case 'REJECTED':
        return {
          label: 'Declined',
          className: 'bg-danger-soft text-danger border border-danger-line/80',
        };
      case 'EXPIRED':
        return {
          label: 'Expired',
          className: 'bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]',
        };
      default:
        return {
          label: 'Waiting',
          className: 'bg-white text-[#1d1d1f] border border-[#e5e5ea]',
        };
    }
  };
  return {
    user,
    toast,
    confirm,
    data,
    setData,
    allDoctors,
    setAllDoctors,
    loading,
    setLoading,
    error,
    setError,
    successMsg,
    setSuccessMsg,
    searchParams,
    setSearchParams,
    tabParam,
    activeSection,
    setActiveSection,
    showAddModal,
    setShowAddModal,
    doctorEmail,
    setDoctorEmail,
    adding,
    setAdding,
    showRecModal,
    setShowRecModal,
    recFullName,
    setRecFullName,
    recEmail,
    setRecEmail,
    recPassword,
    setRecPassword,
    recPhone,
    setRecPhone,
    recDoctorIds,
    setRecDoctorIds,
    provisioning,
    setProvisioning,
    editingRec,
    setEditingRec,
    editDoctorIds,
    setEditDoctorIds,
    savingAssignments,
    setSavingAssignments,
    createdCredentials,
    setCreatedCredentials,
    doctorSearchQuery,
    setDoctorSearchQuery,
    copiedCreds,
    setCopiedCreds,
    showPosterModal,
    setShowPosterModal,
    showReportModal,
    setShowReportModal,
    showProfileModal,
    setShowProfileModal,
    profileAddress,
    setProfileAddress,
    profileState,
    setProfileState,
    profileCity,
    setProfileCity,
    profilePhone,
    setProfilePhone,
    profileError,
    setProfileError,
    savingProfile,
    setSavingProfile,
    fetchClinicData,
    fetchAvailableDoctors,
    handleAddDoctor,
    handleQuickAdd,
    handleDetachDoctor,
    handleCancelInvitation,
    handleRespondDoctorAffiliation,
    handleProvisionReceptionist,
    handleOpenEditAssignments,
    handleUpdateAssignedDoctors,
    handleRemoveReceptionist,
    handleSaveProfile,
    approvingRec,
    setApprovingRec,
    approvalDoctorIds,
    setApprovalDoctorIds,
    processingRecId,
    setProcessingRecId,
    isAnyModalOpen,
    handleRespondReceptionist,
    clinic,
    doctors,
    totalPendingRequests,
    incomingRecCount,
    navItems,
    getApptStatusBadge,
  };
};

export type ClinicDashboardState = ReturnType<typeof useClinicDashboardState>;
export const ClinicDashboardContext = createContext<ClinicDashboardState | null>(null);
export const useClinicDashboard = (): ClinicDashboardState => {
  const value = useContext(ClinicDashboardContext);
  if (!value) throw new Error('useClinicDashboard must be used inside ClinicDashboard');
  return value;
};
