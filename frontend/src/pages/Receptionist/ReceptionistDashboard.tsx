import React, { useEffect, useState } from 'react';
import {
  api,
  ReceptionistDashboardData,
  ReceptionistQueueItem,
  getLocalDateString,
  Doctor,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { SubNav } from '../../components/layout/SubNav';
import {
  Clock,
  UserPlus,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  Printer,
  Trash2,
  Stethoscope,
  Activity,
  Building2,
} from 'lucide-react';

export const ReceptionistDashboard: React.FC = () => {
  const { user } = useAuth();

  const [data, setData] = useState<ReceptionistDashboardData | null>(null);
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'walkin' | 'queue' | 'doctors'>('walkin');

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Walk-in form state
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [walkinClinicId, setWalkinClinicId] = useState<string>('');
  const [appointmentDate, setAppointmentDate] = useState<string>(getLocalDateString());
  const [slotId, setSlotId] = useState<string>('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [gender, setGender] = useState('Not Specified');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  // Success Token Pass Modal
  const [bookedPass, setBookedPass] = useState<any | null>(null);

  // Queue tab state
  const [queueDoctorId, setQueueDoctorId] = useState<string>('');
  const [queueDate, setQueueDate] = useState<string>(getLocalDateString());
  const [queueAppointments, setQueueAppointments] = useState<ReceptionistQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);

  // Link doctor state
  const [doctorEmailToLink, setDoctorEmailToLink] = useState('');
  const [linkingLoading, setLinkingLoading] = useState(false);

  const fetchDeskData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getMyReceptionist();
      setData(res);
      if (res.doctors.length > 0) {
        if (!selectedDoctorId) setSelectedDoctorId(res.doctors[0].doctorId);
        if (!queueDoctorId) setQueueDoctorId(res.doctors[0].doctorId);
      }
    } catch (err: any) {
      console.error('Failed to load desk data:', err);
      setError(err.message || 'Failed to load desk details');
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const docs = await api.getDoctors();
      setAllDoctors(docs);
    } catch (err) {
      console.error('Failed to load doctors catalogue:', err);
    }
  };

  useEffect(() => {
    fetchDeskData();
    fetchCatalog();
  }, []);

  // Fetch queue when queueDoctorId or queueDate changes
  const fetchQueue = async (docId?: string, dateStr?: string) => {
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
  };

  useEffect(() => {
    if (activeTab === 'queue' && queueDoctorId) {
      fetchQueue();
    }
  }, [activeTab, queueDoctorId, queueDate]);

  const linkedDoctors = data?.doctors || [];
  const activeSelectedDoctor = linkedDoctors.find((d) => d.doctorId === selectedDoctorId);

  useEffect(() => {
    if (activeSelectedDoctor?.clinics && activeSelectedDoctor.clinics.length > 0) {
      setWalkinClinicId((prev) => {
        const stillValid = activeSelectedDoctor.clinics?.some((c) => c.clinicId === prev);
        return stillValid ? prev : activeSelectedDoctor.clinics![0].clinicId;
      });
    } else {
      setWalkinClinicId('');
    }
  }, [activeSelectedDoctor]);

  // Handle rapid walk-in booking
  const handleWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !patientName.trim() || !patientPhone.trim()) {
      setError('Please provide doctor, patient name, and phone number');
      return;
    }

    setBookingLoading(true);
    setError(null);
    try {
      const res = await api.bookWalkinAppointment({
        doctorId: selectedDoctorId,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        gender,
        appointmentDate,
        slotId: slotId || undefined,
        clinicId: walkinClinicId || undefined,
        reasonForVisit: reasonForVisit.trim() || 'Rapid Walk-in Consultation',
      });

      setBookedPass(res.data);
      setSuccessMsg(`Token #${res.data.queueNumber} assigned to ${patientName}`);

      // Reset form
      setPatientName('');
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

  // Handle link doctor
  const handleLinkDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorEmailToLink.trim()) return;

    setLinkingLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.addDoctorToReceptionist({ doctorEmail: doctorEmailToLink.trim() });
      setSuccessMsg(res.message || 'Doctor linked successfully');
      setDoctorEmailToLink('');
      fetchDeskData();
    } catch (err: any) {
      setError(err.message || 'Failed to link doctor');
    } finally {
      setLinkingLoading(false);
    }
  };

  const handleQuickLink = async (email: string) => {
    setLinkingLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.addDoctorToReceptionist({ doctorEmail: email });
      setSuccessMsg(res.message || 'Doctor linked successfully');
      fetchDeskData();
    } catch (err: any) {
      setError(err.message || 'Failed to link doctor');
    } finally {
      setLinkingLoading(false);
    }
  };

  // Handle unlink doctor
  const handleUnlinkDoctor = async (doctorId: string, docName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to remove Dr. ${docName} from your desk roster? You won't be able to book walk-ins for them until re-linked.`
      )
    ) {
      return;
    }

    try {
      await api.removeDoctorFromReceptionist(doctorId);
      setSuccessMsg(`Dr. ${docName} removed from desk.`);
      fetchDeskData();
    } catch (err: any) {
      alert(err.message || 'Failed to remove doctor link');
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav
        title={data?.receptionist.fullName || user?.fullName || 'Receptionist Desk'}
        subtitle={`Live Walk-in & Queue Dispatch • Phone: ${data?.receptionist.phone || 'Desk'}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#86868b] font-medium hidden sm:inline-block">
            {linkedDoctors.length} Linked Practitioner{linkedDoctors.length === 1 ? '' : 's'}
          </span>
        </div>
      </SubNav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
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
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center">
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
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'walkin'
                  ? 'bg-[#0066cc] text-white shadow-xs'
                  : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Rapid Walk-in Booking
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'queue'
                  ? 'bg-[#0066cc] text-white shadow-xs'
                  : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Live Queue Manager
            </button>

            <button
              onClick={() => setActiveTab('doctors')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'doctors'
                  ? 'bg-[#0066cc] text-white shadow-xs'
                  : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'
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
                                ? 'bg-blue-50/50 border-[#0066cc] shadow-xs'
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
                                <div className="w-full h-full flex items-center justify-center font-semibold text-xs text-[#0066cc]">
                                  {doc.fullName[0]}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-xs text-[#1d1d1f] truncate">
                                {doc.fullName}
                              </div>
                              <div className="text-[11px] text-[#0066cc]">{doc.specialty}</div>
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
                        className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0066cc]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                        Checking Shift
                      </label>
                      <select
                        value={slotId}
                        onChange={(e) => setSlotId(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0066cc]"
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
                        <Building2 className="w-3.5 h-3.5 text-[#0066cc]" />
                        Clinic / Facility Attribution
                      </label>
                      <select
                        value={walkinClinicId}
                        onChange={(e) => setWalkinClinicId(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0066cc]"
                      >
                        {activeSelectedDoctor.clinics.map((c) => (
                          <option key={c.clinicId} value={c.clinicId}>
                            {c.clinic.clinicName} — {c.clinic.address}{c.clinic.city ? `, ${c.clinic.city}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Patient Name & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                        Patient Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="e.g. John Smith"
                        className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0066cc]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                        Contact Phone Number
                      </label>
                      <input
                        type="tel"
                        required
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                        placeholder="+1 555-0144"
                        className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0066cc]"
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
                        className="w-full h-11 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0066cc]"
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
                        className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0066cc]"
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
                    className="h-10 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] text-[#1d1d1f] focus:outline-none focus:border-[#0066cc]"
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
                    className="h-10 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] text-[#1d1d1f] focus:outline-none focus:border-[#0066cc]"
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
              ) : (
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
                      {queueAppointments.map((appt) => (
                        <tr key={appt.id} className="hover:bg-[#fafafc]">
                          <td className="py-3 pl-2">
                            <span className="font-mono font-bold text-sm text-[#0066cc]">
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
                                  ? 'bg-blue-50 text-[#0066cc] border border-blue-200'
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
                                  className="px-2.5 py-1 rounded-lg bg-[#0066cc] text-white text-[11px] font-medium hover:bg-[#0071e3]"
                                >
                                  Call In
                                </button>
                              )}
                              {appt.status === 'IN_CONSULTATION' && (
                                <button
                                  onClick={() => handleStatusChange(appt.id, 'COMPLETED')}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700"
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
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Linked Doctors Desk Management */}
          {activeTab === 'doctors' && (
            <div className="space-y-8">
              {/* Top: Link new doctor by email */}
              <div className="p-5 rounded-2xl bg-[#fafafc] border border-[#e5e5ea]">
                <h3 className="text-sm font-semibold text-[#1d1d1f] mb-1">Link Doctor to Your Desk</h3>
                <p className="text-xs text-[#86868b] mb-4">
                  Add a practitioner to your desk roster by entering their registered email or choosing from below.
                </p>

                <form onSubmit={handleLinkDoctor} className="flex flex-col sm:flex-row gap-3 max-w-lg mb-4">
                  <input
                    type="email"
                    required
                    value={doctorEmailToLink}
                    onChange={(e) => setDoctorEmailToLink(e.target.value)}
                    placeholder="dr.sarah@mediarca.com"
                    className="flex-1 h-10 px-4 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0066cc]"
                  />
                  <AppleButton
                    variant="primary"
                    size="sm"
                    type="submit"
                    disabled={linkingLoading}
                    className="flex-shrink-0"
                  >
                    {linkingLoading ? 'Linking...' : 'Link to Desk'}
                  </AppleButton>
                </form>

                {/* Quick Add from Platform Catalogue */}
                {allDoctors.length > 0 && (
                  <div>
                    <span className="text-[11px] font-medium text-[#86868b] block mb-2">
                      Available Platform Specialists:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {allDoctors.map((doc) => {
                        const isLinked = linkedDoctors.some((d) => d.doctorId === doc.id);
                        return (
                          <div
                            key={doc.id}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#e5e5ea] text-xs"
                          >
                            <span className="font-medium text-[#1d1d1f]">{doc.user.fullName}</span>
                            <span className="text-[10px] text-[#0066cc] font-medium">({doc.specialty})</span>
                            {isLinked ? (
                              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                Linked
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleQuickLink(doc.user.email)}
                                className="text-[11px] text-[#0066cc] hover:underline font-semibold ml-1"
                              >
                                + Link
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Roster of Linked Doctors */}
              <div>
                <h3 className="text-base font-semibold text-[#1d1d1f] mb-3">
                  Currently Linked Practitioners ({linkedDoctors.length})
                </h3>

                {linkedDoctors.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#86868b]">
                    No doctors currently linked to this desk.
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
                              <div className="w-full h-full flex items-center justify-center font-semibold text-xs text-[#0066cc]">
                                {doc.fullName[0]}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-[#1d1d1f]">{doc.fullName}</div>
                            <div className="text-[11px] text-[#0066cc]">{doc.specialty}</div>
                            <div className="text-[10px] text-[#86868b]">{doc.clinicAddress}</div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleUnlinkDoctor(doc.doctorId, doc.fullName)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1 flex-shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                          Unlink
                        </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
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
              <div className="text-5xl font-mono font-bold text-[#0066cc] tracking-tight">
                #{bookedPass.queueNumber}
              </div>
              <div className="pt-2 border-t border-[#e5e5ea] grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[11px] text-[#86868b] block">Est. Consultation</span>
                  <span className="font-semibold text-[#1d1d1f]">{bookedPass.estimatedTime || 'Active'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-[#86868b] block">Checking Shift</span>
                  <span className="font-semibold text-[#1d1d1f]">{bookedPass.checkingWindow}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs mb-6 p-3 rounded-xl bg-blue-50/50 border border-blue-100">
              <div className="flex justify-between">
                <span className="text-[#86868b]">Patient Name:</span>
                <span className="font-semibold text-[#1d1d1f]">{patientName || bookedPass.patient?.user?.fullName || 'Walk-in'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868b]">Doctor:</span>
                <span className="font-semibold text-[#1d1d1f]">{activeSelectedDoctor?.fullName || 'Doctor'}</span>
              </div>
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
    </div>
  );
};
