import React, { useEffect, useState, useCallback } from 'react';
import {
  api,
  ReceptionistDashboardData,
  ReceptionistQueueItem,
  getLocalDateString,
} from '../../services/api';
import { sanitizeIndianPhone, formatIndianPhone, isValidIndianPhone } from '../../utils/phoneUtils';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import {
  Clock,
  UserPlus,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  Printer,
  Stethoscope,
  Activity,
  Building2,
  ShieldCheck,
  Lock,
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'walkin' | 'queue' | 'doctors'>('walkin');

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  // Success Token Pass Modal
  const [bookedPass, setBookedPass] = useState<TokenPassData | null>(null);

  // Queue tab state
  const [queueDoctorId, setQueueDoctorId] = useState<string>('');
  const [queueDate, setQueueDate] = useState<string>(getLocalDateString());
  const [queueAppointments, setQueueAppointments] = useState<ReceptionistQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueSearch, setQueueSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED'>('ALL');

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
      }
    } catch (err: any) {
      console.error('Failed to load desk data:', err);
      setError(err.message || 'Failed to load desk details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeskData();
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
    } catch (err: any) {
      console.error('Failed to load queue:', err);
    } finally {
      setQueueLoading(false);
    }
  }, [queueDoctorId, queueDate]);

  useEffect(() => {
    if (activeTab === 'queue' && queueDoctorId) {
      fetchQueue();
    }
  }, [activeTab, queueDoctorId, queueDate, fetchQueue]);

  const linkedDoctors = data?.doctors || [];
  const activeSelectedDoctor = linkedDoctors.find((d) => d.doctorId === selectedDoctorId);
  const effectiveClinicId = data?.clinic?.id || walkinClinicId || activeSelectedDoctor?.clinics?.[0]?.clinicId;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!currentPassword) {
      setPasswordError('Please enter your current temporary password');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
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
      if (res?.data && updateUser) {
        updateUser(res.data);
      }
      await refreshUser();
      setSuccessMsg('Temporary password changed successfully. Receptionist desk unlocked.');
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
      setError('Please provide doctor, patient name, and phone number');
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
        reasonForVisit: reasonForVisit.trim() || 'Rapid Walk-in Consultation',
      });

      const queuedDoctor = linkedDoctors.find((d) => d.doctorId === selectedDoctorId);
      const savedPatientName = patientName.trim();
      const savedPatientPhone = formattedPhone;

      setBookedPass({
        queueNumber: res.data.queueNumber,
        estimatedTime: res.data.estimatedTime || 'Active',
        checkingWindow: res.data.checkingWindow || 'General Hours',
        appointmentDate,
        patientName: savedPatientName,
        patientPhone: savedPatientPhone,
        doctorName: queuedDoctor?.fullName || 'Practitioner',
        doctorSpecialty: queuedDoctor?.specialty,
        clinicName: data?.clinic?.clinicName,
        clinicAddress: data?.clinic?.address,
      });
      setSuccessMsg(`Token #${res.data.queueNumber} assigned to ${savedPatientName}`);

      // Reset form
      setPatientName('');
      setPatientAge('');
      setPatientPhone('');
      setReasonForVisit('');

      // Refresh data
      fetchDeskData();
    } catch (err: any) {
      setError(err.message || 'Failed to book walk-in appointment');
    } finally {
      setBookingLoading(false);
    }
  };

  // Handle status updates
  const handleStatusChange = async (appointmentId: string, status: string) => {
    try {
      await api.updateAppointmentStatus(appointmentId, status);
      fetchQueue();
      fetchDeskData();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const navItems: DashboardNavItem[] = [
    {
      id: 'walkin',
      label: 'New Walk-in Patient',
      icon: UserPlus,
      active: activeTab === 'walkin',
      onClick: () => setActiveTab('walkin'),
    },
    {
      id: 'queue',
      label: 'Live Queue Tracker',
      icon: Clock,
      active: activeTab === 'queue',
      onClick: () => setActiveTab('queue'),
      badge: queueAppointments.length > 0 ? queueAppointments.length : undefined,
    },
    {
      id: 'doctors',
      label: 'Assigned Doctors',
      icon: Stethoscope,
      active: activeTab === 'doctors',
      onClick: () => setActiveTab('doctors'),
      badge: linkedDoctors.length,
    },
  ];

  return (
    <DashboardLayout
      portalType="RECEPTIONIST"
      portalSubtitle="RECEPTION DESK"
      navItems={navItems}
      title={data?.clinic?.clinicName ? `${data.clinic.clinicName} Desk` : (data?.receptionist.fullName || user?.fullName || 'Receptionist Desk')}
      subtitle={`${data?.clinic?.address || 'Front Desk Operations'}${data?.clinic?.city ? ` • ${data.clinic.city}` : ''} | Staff: ${data?.receptionist.fullName || user?.fullName || 'Desk Operator'}`}
    >
      <div className="space-y-8 print:hidden">
        {/* Banner Feedback */}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
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

        {/* 1. Metrics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
                Linked Doctors
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#0088e8]/10 text-[#0088e8] flex items-center justify-center">
                <Stethoscope className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-semibold text-[#1d1d1f]">{linkedDoctors.length}</div>
            <p className="text-[11px] text-[#86868b] mt-1">Practitioners available for walk-in dispatch</p>
          </div>

          <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
                Today's Desk Queue
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-semibold text-[#1d1d1f]">
              {linkedDoctors.reduce((sum, d) => sum + d.todayTotalBookings, 0)}
            </div>
            <p className="text-[11px] text-[#86868b] mt-1">Total appointments booked across your desk today</p>
          </div>

          <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
                Patients Waiting
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-semibold text-[#1d1d1f]">
              {linkedDoctors.reduce((sum, d) => sum + d.todayWaitingPatients, 0)}
            </div>
            <p className="text-[11px] text-[#86868b] mt-1">Currently waiting in clinic waiting areas</p>
          </div>
        </div>

        {/* 2. Three Main Functionality Tabs */}
        <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 sm:p-8 shadow-xs">
          <div className="flex items-center gap-2 border-b border-[#f0f0f0] pb-4 mb-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('walkin')}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'walkin'
                  ? 'bg-[#1d1d1f] text-white shadow-xs'
                  : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#e8e8ed]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Rapid Walk-in Booking
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'queue'
                  ? 'bg-[#1d1d1f] text-white shadow-xs'
                  : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#e8e8ed]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Live Queue Manager
            </button>

            <button
              onClick={() => setActiveTab('doctors')}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'doctors'
                  ? 'bg-[#1d1d1f] text-white shadow-xs'
                  : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#e8e8ed]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Linked Doctors Desk
            </button>
          </div>

          {/* TAB 1: Rapid Walk-in Booking */}
          {activeTab === 'walkin' && (
            <div>
              <div className="mb-6">
                <h3 className="text-base font-semibold text-[#1d1d1f]">
                  Walk-in Patient Instant Booking
                </h3>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Directly dispatch incoming patients into a practitioner's live queue with guaranteed token generation.
                </p>
              </div>

              {linkedDoctors.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#f5f5f7] text-[#86868b] flex items-center justify-center mx-auto mb-3">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-[#1d1d1f] mb-1">No Doctors Linked Yet</h4>
                  <p className="text-xs text-[#86868b] max-w-xs mx-auto mb-4">
                    Link doctors to your desk roster first in the "Linked Doctors Desk" tab before booking walk-ins.
                  </p>
                  <AppleButton variant="primary" size="sm" onClick={() => setActiveTab('doctors')}>
                    Go to Doctor Desk Roster
                  </AppleButton>
                </div>
              ) : (
                <form onSubmit={handleWalkinSubmit} className="space-y-5 max-w-2xl">
                  {/* Select Doctor */}
                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
                      Select Practitioner
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                ? 'bg-[#0088e8]/5 border-[#0088e8] shadow-xs'
                                : 'bg-[#fafafc] border-[#e5e5ea] hover:border-gray-300'
                            }`}
                          >
                            <div className="w-10 h-10 rounded-full bg-white border border-[#e5e5ea] overflow-hidden flex-shrink-0">
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
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-xs text-[#1d1d1f] truncate">
                                {doc.fullName}
                              </div>
                              <div className="text-[11px] text-[#0088e8]">{doc.specialty}</div>
                              <div className="text-[10px] text-[#86868b] mt-0.5">
                                Fee: ${doc.consultationFee.toFixed(0)} • Queue: {doc.todayWaitingPatients} waiting
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Date & Shift */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                        Consultation Date
                      </label>
                      <input
                        type="date"
                        required
                        value={appointmentDate}
                        onChange={(e) => setAppointmentDate(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0088e8]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                        Checking Shift
                      </label>
                      <select
                        value={slotId}
                        onChange={(e) => setSlotId(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0088e8]"
                      >
                        {activeSelectedDoctor?.slots.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} (Max {s.maxPatients} pts • ~{s.avgConsultationMinutes}m pace)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Clinic / Facility Attribution */}
                  {activeSelectedDoctor?.clinics && activeSelectedDoctor.clinics.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#0088e8]" />
                        Clinic / Facility Attribution
                      </label>
                      <select
                        value={walkinClinicId}
                        onChange={(e) => setWalkinClinicId(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0088e8]"
                      >
                        {activeSelectedDoctor.clinics.map((c) => (
                          <option key={c.clinicId} value={c.clinicId}>
                            {c.clinic.clinicName} — {c.clinic.address}{c.clinic.city ? `, ${c.clinic.city}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Booking For Toggle */}
                  <div>
                    <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                      Booking For:
                    </label>
                    <div className="flex rounded-full bg-[#f5f5f7] p-1 border border-[#e5e5ea] max-w-xs mb-3 shadow-xs">
                      <button
                        type="button"
                        onClick={() => setBookingFor('self')}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-[0.98] ${
                          bookingFor === 'self'
                            ? 'bg-white text-[#1d1d1f] shadow-xs'
                            : 'text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                      >
                        Patient Themselves
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingFor('other')}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-[0.98] ${
                          bookingFor === 'other'
                            ? 'bg-white text-[#1d1d1f] shadow-xs'
                            : 'text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                      >
                        Dependent / Family
                      </button>
                    </div>
                  </div>

                  {/* Patient Name, Age & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                        Patient Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="e.g. Rahul Ray"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                        Patient Age
                      </label>
                      <input
                        type="text"
                        value={patientAge}
                        onChange={(e) => setPatientAge(e.target.value)}
                        placeholder="e.g. 12"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                        Contact Phone *
                      </label>
                      <input
                        type="tel"
                        required
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(sanitizeIndianPhone(e.target.value))}
                        placeholder="10-digit mobile number"
                        maxLength={10}
                        className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                      />
                    </div>
                  </div>

                  {/* Gender & Reason */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1">Gender</label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                      >
                        <option value="Not Specified">Not Specified</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                        Reason for Visit / Chief Symptoms
                      </label>
                      <input
                        type="text"
                        value={reasonForVisit}
                        onChange={(e) => setReasonForVisit(e.target.value)}
                        placeholder="e.g. Acute fever, migraine, blood pressure check"
                        className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                      />
                    </div>
                  </div>

                  <div className="pt-3">
                    <AppleButton
                      variant="primary"
                      size="lg"
                      type="submit"
                      disabled={bookingLoading}
                      className="w-full sm:w-auto px-8"
                    >
                      {bookingLoading ? 'Issuing Token...' : 'Generate Guaranteed Queue Token'}
                    </AppleButton>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: Live Queue Manager */}
          {activeTab === 'queue' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-semibold text-[#1d1d1f]">Live Patient Queue</h3>
                  <p className="text-xs text-[#86868b] mt-0.5">
                    Advance consultations, monitor waiting times, and manage patient flow in real time.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={queueDoctorId}
                    onChange={(e) => setQueueDoctorId(e.target.value)}
                    className="h-10 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] text-[#1d1d1f] transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                  >
                    {linkedDoctors.map((doc) => (
                      <option key={doc.doctorId} value={doc.doctorId}>
                        {doc.fullName} ({doc.specialty})
                      </option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={queueDate}
                    onChange={(e) => setQueueDate(e.target.value)}
                    className="h-10 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] text-[#1d1d1f] transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                  />

                  <AppleButton
                    variant="secondary"
                    size="sm"
                    onClick={() => fetchQueue()}
                    className="flex-shrink-0"
                  >
                    Refresh
                  </AppleButton>
                </div>
              </div>

              {/* Status Filter & Live Queue Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-[#f0f0f0]">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {(['ALL', 'WAITING', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all active:scale-[0.98] whitespace-nowrap ${
                        statusFilter === st
                          ? 'bg-[#1d1d1f] text-white shadow-xs'
                          : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    placeholder="Search patient, phone, token #..."
                    className="h-9 px-4 rounded-full border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] w-full sm:w-64"
                  />
                  {queueSearch && (
                    <button
                      type="button"
                      onClick={() => setQueueSearch('')}
                      className="text-xs text-[#86868b] hover:text-[#1d1d1f]"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {queueLoading ? (
                <div className="py-12 text-center text-xs text-[#86868b]">Loading live queue...</div>
              ) : queueAppointments.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#f5f5f7] text-[#86868b] flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-[#1d1d1f] mb-1">Queue is Empty</h4>
                  <p className="text-xs text-[#86868b] max-w-xs mx-auto mb-4">
                    No patients booked in this queue for {queueDate}.
                  </p>
                  <AppleButton variant="primary" size="sm" onClick={() => setActiveTab('walkin')}>
                    Book First Walk-in
                  </AppleButton>
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

                if (filteredAppointments.length === 0) {
                  return (
                    <div className="py-12 text-center">
                      <p className="text-xs text-[#86868b]">
                        No patients match status "{statusFilter}" and search "{queueSearch}".
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter('ALL');
                          setQueueSearch('');
                        }}
                        className="mt-2 text-xs text-[#0088e8] font-semibold hover:underline"
                      >
                        Reset Filters
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#e5e5ea] text-[#86868b] font-medium">
                          <th className="pb-3 pl-2">Token #</th>
                          <th className="pb-3">Patient</th>
                          <th className="pb-3">Contact</th>
                          <th className="pb-3">Est. Time / Window</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3 text-right pr-2">Dispatch Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f0f0]">
                        {filteredAppointments.map((appt) => (
                          <tr key={appt.id} className="hover:bg-[#fafafc]">
                            <td className="py-3 pl-2">
                              <span className="font-mono font-bold text-sm text-[#0088e8]">
                                #{appt.queueNumber}
                              </span>
                            </td>

                            <td className="py-3">
                              <div className="font-medium text-[#1d1d1f]">{appt.patientName}</div>
                              {appt.reasonForVisit && (
                                <div className="text-[10px] text-[#86868b]">{appt.reasonForVisit}</div>
                              )}
                            </td>

                            <td className="py-3 text-[#86868b] font-mono">{appt.patientPhone}</td>

                            <td className="py-3 text-[#1d1d1f]">
                              <div>{appt.estimatedTime || 'Pending'}</div>
                              <div className="text-[10px] text-[#86868b]">{appt.checkingWindow}</div>
                            </td>

                            <td className="py-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                  appt.status === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : appt.status === 'IN_CONSULTATION'
                                    ? 'bg-[#0088e8]/10 text-[#0088e8] border border-[#0088e8]/20'
                                    : appt.status === 'WAITING'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {appt.status}
                              </span>
                            </td>

                            <td className="py-3 text-right pr-2">
                              <div className="inline-flex items-center gap-1.5">
                                {appt.status === 'WAITING' && (
                                  <button
                                    onClick={() => handleStatusChange(appt.id, 'IN_CONSULTATION')}
                                    className="px-3 py-1 rounded-full bg-[#0088e8] text-white text-[11px] font-medium hover:bg-[#0077cc] shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                                  >
                                    Call In
                                  </button>
                                )}
                                {appt.status === 'IN_CONSULTATION' && (
                                  <button
                                    onClick={() => handleStatusChange(appt.id, 'COMPLETED')}
                                    className="px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700 shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                                  >
                                    Complete
                                  </button>
                                )}
                                {appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && (
                                  <button
                                    onClick={() => handleStatusChange(appt.id, 'CANCELLED')}
                                    className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 text-[11px] font-medium border border-rose-200"
                                  >
                                    Cancel
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const queueDoctor = linkedDoctors.find((d) => d.doctorId === queueDoctorId);
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
                                  className="p-1 rounded-lg text-[#0088e8] hover:bg-blue-50 border border-blue-200 transition-colors"
                                  title="Reprint Token Pass"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 3: Assigned Doctors Desk Roster */}
          {activeTab === 'doctors' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-[#fafafc] border border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#1d1d1f] flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#0088e8]" />
                    {data?.clinic?.clinicName || 'Clinic'} Assigned Practitioners
                  </h3>
                  <p className="text-xs text-[#86868b] mt-0.5">
                    Front-desk staff have queue management and walk-in dispatch permissions for these practitioners as assigned by your Clinic Administrator.
                  </p>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#0088e8]/10 text-[#0088e8] border border-[#0088e8]/20 self-start sm:self-auto">
                  {linkedDoctors.length} Assigned
                </span>
              </div>

              <div>
                {linkedDoctors.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#86868b] bg-[#fafafc] rounded-2xl border border-dashed border-[#e5e5ea]">
                    <Stethoscope className="w-8 h-8 text-[#86868b] mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-[#1d1d1f]">No Doctors Assigned Yet</p>
                    <p className="mt-1">Please ask your Clinic Administrator to assign practitioners to your desk.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {linkedDoctors.map((doc) => (
                      <div
                        key={doc.doctorId}
                        className="p-4 rounded-2xl bg-white border border-[#e5e5ea] flex items-center justify-between gap-3 shadow-2xs hover:border-gray-300"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex-shrink-0">
                            {doc.avatarUrl ? (
                              <img src={doc.avatarUrl} alt={doc.fullName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-semibold text-xs text-[#0088e8]">
                                {doc.fullName[0]}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-[#1d1d1f]">{doc.fullName}</div>
                            <div className="text-[11px] text-[#0088e8]">{doc.specialty}</div>
                            <div className="text-[10px] text-[#86868b]">{doc.clinicAddress || 'Clinic Practice'}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-semibold text-emerald-600 block">
                            ${doc.consultationFee}
                          </span>
                          <span className="text-[10px] text-[#86868b]">
                            {doc.todayTotalBookings} booked today
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Guaranteed Queue Token Pass Modal */}
      {bookedPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn print:hidden">
          <div className="bg-white rounded-[24px] border border-[#e5e5ea] max-w-md w-full p-6 sm:p-8 shadow-2xl">
            <div className="text-center pb-4 border-b border-[#f0f0f0]">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-[#1d1d1f]">Walk-in Token Issued</h3>
              <p className="text-xs text-[#86868b] mt-0.5">Live guaranteed consultation queue pass</p>
            </div>

            {/* Token Badge Display */}
            <div className="my-6 p-6 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-center space-y-3">
              <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider block">
                Queue Token Number
              </span>
              <div className="text-5xl font-mono font-bold text-[#0088e8] tracking-tight">
                #{bookedPass.queueNumber}
              </div>
              <div className="pt-2 border-t border-[#e5e5ea] grid grid-cols-2 gap-2 text-xs">
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

            <div className="space-y-2 text-xs mb-6 p-3 rounded-xl bg-blue-50/50 border border-blue-100">
              <div className="flex justify-between">
                <span className="text-[#86868b]">Patient Name:</span>
                <span className="font-semibold text-[#1d1d1f]">{bookedPass.patientName}</span>
              </div>
              {bookedPass.patientPhone && (
                <div className="flex justify-between">
                  <span className="text-[#86868b]">Patient Phone:</span>
                  <span className="font-semibold text-[#1d1d1f]">{bookedPass.patientPhone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#86868b]">Doctor:</span>
                <span className="font-semibold text-[#1d1d1f]">Dr. {bookedPass.doctorName}</span>
              </div>
              {bookedPass.doctorSpecialty && (
                <div className="flex justify-between">
                  <span className="text-[#86868b]">Specialty:</span>
                  <span className="font-semibold text-[#1d1d1f]">{bookedPass.doctorSpecialty}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#86868b]">Date:</span>
                <span className="font-semibold text-[#1d1d1f]">{bookedPass.appointmentDate}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <AppleButton
                variant="secondary"
                size="md"
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print Token
              </AppleButton>
              <AppleButton
                variant="primary"
                size="md"
                onClick={() => setBookedPass(null)}
                className="flex-1"
              >
                Done / Next Patient
              </AppleButton>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Printable Thermal Token Pass */}
      {bookedPass && (
        <div className="hidden print:block font-mono text-black p-6 bg-white max-w-xs mx-auto border-2 border-black rounded-xl">
          <div className="text-center pb-3 border-b-2 border-dashed border-gray-400">
            <h2 className="text-base font-bold uppercase tracking-wide">
              {bookedPass.clinicName || 'MediArca Clinic'}
            </h2>
            {bookedPass.clinicAddress && (
              <p className="text-[11px] text-gray-700 mt-0.5">{bookedPass.clinicAddress}</p>
            )}
            <p className="text-[10px] text-gray-600 mt-1 uppercase tracking-wider">
              Guaranteed Queue Token
            </p>
          </div>

          <div className="py-4 text-center">
            <div className="text-xs uppercase text-gray-500 tracking-wider">Token Number</div>
            <div className="text-5xl font-black tracking-tight my-1">
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
              <span className="font-bold">Dr. {bookedPass.doctorName}</span>
            </div>
            {bookedPass.doctorSpecialty && (
              <div className="flex justify-between">
                <span className="text-gray-600">Specialty:</span>
                <span>{bookedPass.doctorSpecialty}</span>
              </div>
            )}
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
            Please retain this slip and listen for token announcement.
            <br />
            MediArca Digital OPD
          </div>
        </div>
      )}

      {/* Mandatory Password Change Modal for Provisioned Accounts */}
      {user?.mustChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn print:hidden">
          <div className="bg-white rounded-[24px] border border-[#e5e5ea] max-w-md w-full p-6 sm:p-8 shadow-2xl relative text-left">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[#1d1d1f] text-center mb-1">
              Update Temporary Password
            </h2>
            <p className="text-xs text-[#86868b] text-center mb-6 leading-relaxed">
              Your clinic administrator provisioned your account with a temporary password. For clinical data security, you must set a permanent password before accessing the receptionist desk.
            </p>

            {passwordError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Current Temporary Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter temporary password"
                    className="w-full h-11 px-3.5 pl-9 rounded-xl border border-[#e5e5ea] text-sm focus:outline-none focus:border-[#0088e8]"
                  />
                  <Lock className="w-4 h-4 text-[#86868b] absolute left-3 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  New Permanent Password (min. 6 characters)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full h-11 px-3.5 pl-9 rounded-xl border border-[#e5e5ea] text-sm focus:outline-none focus:border-[#0088e8]"
                  />
                  <Lock className="w-4 h-4 text-[#86868b] absolute left-3 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full h-11 px-3.5 pl-9 rounded-xl border border-[#e5e5ea] text-sm focus:outline-none focus:border-[#0088e8]"
                  />
                  <Lock className="w-4 h-4 text-[#86868b] absolute left-3 top-3.5" />
                </div>
              </div>

              <AppleButton
                variant="primary"
                size="lg"
                type="submit"
                disabled={changingPassword}
                className="w-full mt-2 shadow-sm"
              >
                {changingPassword ? 'Updating Password...' : 'Save & Unlock Receptionist Desk'}
              </AppleButton>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
