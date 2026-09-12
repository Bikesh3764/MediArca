import React, { useEffect, useState } from 'react';
import { api, Doctor, format12Hour } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { SubNav } from '../../components/layout/SubNav';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  Users,
  ShieldCheck,
  Calendar,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Clock,
  X,
  Building2,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user, loading: loadingAuth } = useAuth();
  const navigate = useNavigate();

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
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [clinicActionId, setClinicActionId] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'doctors' | 'clinics' | 'appointments'>('doctors');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, doctorsData, clinicsData, apptsData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminDoctors(),
        api.getAdminClinics(),
        api.getAdminAppointments(),
      ]);
      setStats(statsData);
      setDoctors(doctorsData);
      setClinics(clinicsData);
      setAppointments(apptsData);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loadingAuth) return;
    if (!user || user.role?.toUpperCase() !== 'ADMIN') {
      navigate('/login');
      return;
    }
    fetchData();
  }, [user, loadingAuth, navigate]);

  const handleVerifyClinic = async (clinicId: string, isVerified: boolean) => {
    setClinicActionId(clinicId);
    try {
      await api.verifyClinic(clinicId, isVerified);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Clinic verification update failed');
    } finally {
      setClinicActionId(null);
    }
  };

  const handleVerify = async (doctorId: string, isVerified: boolean) => {
    setActionId(doctorId);
    try {
      await api.verifyDoctor(doctorId, isVerified);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Verification update failed');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav title="Administrative Oversight" subtitle="Platform verification & audit console">
        <AppleButton variant="ghost" size="sm" onClick={fetchData} className="flex items-center gap-1">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Stats
        </AppleButton>
      </SubNav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {loading && !stats ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-[#0088e8] border-t-transparent animate-spin mb-3"></div>
            <p className="text-xs text-[#7a7a7a]">Loading platform telemetry and practitioner records...</p>
          </div>
        ) : (
          <>
            {/* KPI Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <UtilityCard>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-[#86868b] uppercase font-semibold">Patients</span>
                    <h3 className="text-3xl font-semibold text-[#1d1d1f] mt-1">{stats?.totalPatients || 0}</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#0088e8]/10 text-[#0088e8] flex items-center justify-center">
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
                    <p className="text-[10px] text-amber-600 font-medium mt-0.5">{stats?.pendingClinics || 0} pending review</p>
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
                      {(stats?.pendingDoctors || 0) + (stats?.pendingClinics || 0)}
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
            <div className="flex flex-wrap items-center gap-2 border-b border-[#e5e5ea] pb-3">
              <button
                onClick={() => setActiveTab('doctors')}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'doctors'
                    ? 'bg-[#1d1d1f] text-white shadow-xs'
                    : 'bg-white text-[#86868b] hover:text-[#1d1d1f] border border-[#e5e5ea]'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-[#0088e8]" />
                <span>Doctor Verification</span>
                {(stats?.pendingDoctors || 0) > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                    {stats?.pendingDoctors} pending
                  </span>
                ) : (
                  <span className="text-[10px] opacity-70">({doctors.length})</span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('clinics')}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'clinics'
                    ? 'bg-[#1d1d1f] text-white shadow-xs'
                    : 'bg-white text-[#86868b] hover:text-[#1d1d1f] border border-[#e5e5ea]'
                }`}
              >
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>Clinic Verification</span>
                {(stats?.pendingClinics || 0) > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse">
                    {stats?.pendingClinics} pending
                  </span>
                ) : (
                  <span className="text-[10px] opacity-70">({clinics.length})</span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('appointments')}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'appointments'
                    ? 'bg-[#1d1d1f] text-white shadow-xs'
                    : 'bg-white text-[#86868b] hover:text-[#1d1d1f] border border-[#e5e5ea]'
                }`}
              >
                <Calendar className="w-4 h-4 text-purple-600" />
                <span>Platform Bookings ({appointments.length})</span>
              </button>
            </div>

            {/* Tab 1: Doctor Verification Portal */}
            {activeTab === 'doctors' && (
              <UtilityCard>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1d1d1f]">Practitioner Verification Queue</h3>
                    <p className="text-xs text-[#7a7a7a] mt-0.5">
                      Doctors must be verified by admin before appearing in patient searches.
                    </p>
                  </div>
                  <span className="text-xs text-[#7a7a7a]">{doctors.length} Registered Doctor(s)</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#e0e0e0] text-[#7a7a7a] uppercase tracking-wider font-semibold">
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
                                className="w-8 h-8 rounded-full bg-[#e0e0e0] overflow-hidden flex-shrink-0 cursor-pointer"
                                onClick={() => setSelectedDoctor(doc)}
                              >
                                {doc.user.avatarUrl ? (
                                  <img
                                    src={doc.user.avatarUrl}
                                    alt={doc.user.fullName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center font-bold text-[#0088e8]">
                                    {doc.user.fullName[0]}
                                  </div>
                                )}
                              </div>
                              <div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedDoctor(doc)}
                                  className="text-[13px] text-[#1d1d1f] font-semibold block text-left hover:text-[#0088e8] transition-colors"
                                >
                                  {doc.user.fullName}
                                </button>
                                <span className="text-[#7a7a7a]">{doc.user.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 font-medium text-[#1d1d1f]">{doc.specialty}</td>
                          <td className="py-3.5 px-3 text-[#86868b]">
                            {doc.checkingStartTime
                              ? `${format12Hour(doc.checkingStartTime)} – ${format12Hour(doc.checkingEndTime)}`
                              : 'Flexible'}
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-[#1d1d1f]">${doc.consultationFee}</td>
                          <td className="py-3.5 px-3">
                            {doc.isVerified ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-semibold border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-semibold border border-amber-200 animate-pulse">
                                <Clock className="w-3 h-3" />
                                Pending Review
                              </span>
                            )}
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
                              {doc.isVerified ? (
                                <AppleButton
                                  variant="ghost"
                                  size="sm"
                                  disabled={actionId === doc.id}
                                  onClick={() => handleVerify(doc.id, false)}
                                  className="text-rose-600 hover:text-rose-700 hover:border-rose-300"
                                >
                                  Suspend
                                </AppleButton>
                              ) : (
                                <AppleButton
                                  variant="primary"
                                  size="sm"
                                  disabled={actionId === doc.id}
                                  onClick={() => handleVerify(doc.id, true)}
                                >
                                  {actionId === doc.id ? 'Verifying...' : 'Approve & Verify'}
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
                    <p className="text-xs text-[#7a7a7a] mt-0.5">
                      Clinics must be verified by MediArca administration before appearing in patient searches or doctor affiliation lists.
                    </p>
                  </div>
                  <span className="text-xs text-[#7a7a7a]">{clinics.length} Registered Clinic(s)</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#e0e0e0] text-[#7a7a7a] uppercase tracking-wider font-semibold">
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
                                    className="text-[13px] text-[#1d1d1f] font-semibold block text-left hover:text-[#0088e8] transition-colors cursor-pointer"
                                  >
                                    {c.clinicName}
                                  </button>
                                  <div className="text-[#7a7a7a]">
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
                              {c.isVerified ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-semibold border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-semibold border border-amber-200 animate-pulse">
                                  <Clock className="w-3 h-3" />
                                  Pending Review
                                </span>
                              )}
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
                                {c.isVerified ? (
                                  <AppleButton
                                    variant="ghost"
                                    size="sm"
                                    disabled={clinicActionId === c.id}
                                    onClick={() => handleVerifyClinic(c.id, false)}
                                    className="text-rose-600 hover:text-rose-700 hover:border-rose-300"
                                  >
                                    Suspend
                                  </AppleButton>
                                ) : (
                                  <AppleButton
                                    variant="primary"
                                    size="sm"
                                    disabled={clinicActionId === c.id}
                                    onClick={() => handleVerifyClinic(c.id, true)}
                                  >
                                    {clinicActionId === c.id ? 'Verifying...' : 'Approve & Verify'}
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

            {/* Tab 3: Platform Appointments Oversight */}
            {activeTab === 'appointments' && (
              <UtilityCard>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1d1d1f]">Recent Platform Bookings</h3>
                    <p className="text-xs text-[#7a7a7a] mt-0.5">
                      Audit trail of queue numbers and consultation statuses across facilities.
                    </p>
                  </div>
                  <span className="text-xs text-[#7a7a7a]">{appointments.length} Total</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#e0e0e0] text-[#7a7a7a] uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Queue Token</th>
                        <th className="py-3 px-3">Patient</th>
                        <th className="py-3 px-3">Practitioner</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Est. Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f0]">
                      {appointments.slice(0, 15).map((appt) => (
                        <tr key={appt.id} className="hover:bg-[#f5f5f7]/60">
                          <td className="py-3 px-3 font-medium text-[#1d1d1f]">{appt.appointmentDate}</td>
                          <td className="py-3 px-3 font-bold text-[#0088e8]">Queue #{appt.queueNumber}</td>
                          <td className="py-3 px-3">{appt.patient?.user?.fullName}</td>
                          <td className="py-3 px-3">{appt.doctor?.user?.fullName}</td>
                          <td className="py-3 px-3">
                            <span className="font-medium text-[11px] uppercase">{appt.status}</span>
                          </td>
                          <td className="py-3 px-3 text-[#7a7a7a]">{appt.estimatedTime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </UtilityCard>
            )}
        </>
        )}
      </div>

      {/* Doctor Verification Credentials Inspection Modal */}
      {selectedDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[24px] border border-[#e0e0e0] max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f0]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#f5f5f7] border border-[#e0e0e0] overflow-hidden flex items-center justify-center font-bold text-lg text-[#0088e8]">
                  {selectedDoctor.user.avatarUrl ? (
                    <img src={selectedDoctor.user.avatarUrl} alt={selectedDoctor.user.fullName} className="w-full h-full object-cover" />
                  ) : (
                    selectedDoctor.user.fullName[0]
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#1d1d1f]">{selectedDoctor.user.fullName}</h3>
                  <p className="text-xs text-[#0088e8] font-medium">{selectedDoctor.specialty}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDoctor(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-[#7a7a7a]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#f5f5f7]">
                <div>
                  <span className="text-[#7a7a7a] block">Qualifications:</span>
                  <strong className="text-[#1d1d1f]">{selectedDoctor.qualifications}</strong>
                </div>
                <div>
                  <span className="text-[#7a7a7a] block">Experience:</span>
                  <strong className="text-[#1d1d1f]">{selectedDoctor.experienceYears} Years</strong>
                </div>
                <div>
                  <span className="text-[#7a7a7a] block">Consultation Fee:</span>
                  <strong className="text-[#1d1d1f]">${selectedDoctor.consultationFee}</strong>
                </div>
                <div>
                  <span className="text-[#86868b] block">Checking Window:</span>
                  <strong className="text-[#0088e8]">
                    {selectedDoctor.checkingStartTime ? `${format12Hour(selectedDoctor.checkingStartTime)} – ${format12Hour(selectedDoctor.checkingEndTime)}` : 'Flexible'}
                  </strong>
                </div>
              </div>

              <div>
                <span className="text-[#7a7a7a] font-semibold block mb-1">Clinic Address:</span>
                <p className="text-[#1d1d1f] p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                  {selectedDoctor.clinicAddress || 'MediArca Clinic Facility'}
                </p>
              </div>

              <div>
                <span className="text-[#7a7a7a] font-semibold block mb-1">Professional Bio & Practice Philosophy:</span>
                <p className="text-[#1d1d1f] p-2.5 rounded-lg bg-gray-50 border border-gray-100 leading-relaxed">
                  {selectedDoctor.bio || 'Dedicated medical practitioner accepting outpatient consultations.'}
                </p>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[#7a7a7a]">Email: {selectedDoctor.user.email}</span>
                <span className="text-[#7a7a7a]">Phone: {selectedDoctor.user.phone || 'N/A'}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#f0f0f0] flex justify-end gap-2">
              <AppleButton variant="ghost" size="sm" onClick={() => setSelectedDoctor(null)}>
                Close
              </AppleButton>
              {selectedDoctor.isVerified ? (
                <AppleButton
                  variant="ghost"
                  size="sm"
                  disabled={actionId === selectedDoctor.id}
                  onClick={async () => {
                    await handleVerify(selectedDoctor.id, false);
                    setSelectedDoctor(null);
                  }}
                  className="text-rose-600 hover:text-rose-700"
                >
                  Suspend Credentials
                </AppleButton>
              ) : (
                <AppleButton
                  variant="primary"
                  size="sm"
                  disabled={actionId === selectedDoctor.id}
                  onClick={async () => {
                    await handleVerify(selectedDoctor.id, true);
                    setSelectedDoctor(null);
                  }}
                >
                  {actionId === selectedDoctor.id ? 'Approving...' : 'Approve & Verify License'}
                </AppleButton>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clinic Facility Inspection & Verification Modal */}
      {selectedClinic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[24px] border border-[#e0e0e0] max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex justify-between items-start pb-4 border-b border-[#f0f0f0]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#1d1d1f] tracking-tight">{selectedClinic.clinicName}</h3>
                  <p className="text-xs text-[#7a7a7a]">Clinical Healthcare Facility Verification</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedClinic(null)}
                className="p-1 rounded-full text-[#7a7a7a] hover:bg-[#f5f5f7] transition-colors"
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
                  <span className="text-[10px] text-[#86868b] uppercase font-semibold block">City & Region</span>
                  <p className="font-medium mt-0.5">{selectedClinic.city || 'Not Specified'}</p>
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
                  <p className="text-base font-bold text-[#0088e8] mt-0.5">
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
                {selectedClinic.isVerified ? (
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-semibold border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified & Publicly Discoverable
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-semibold border border-amber-200 animate-pulse">
                    <Clock className="w-3.5 h-3.5" />
                    Pending Administrative Review
                  </span>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#f0f0f0] flex justify-end gap-2">
              <AppleButton variant="ghost" size="sm" onClick={() => setSelectedClinic(null)}>
                Close
              </AppleButton>
              {selectedClinic.isVerified ? (
                <AppleButton
                  variant="ghost"
                  size="sm"
                  disabled={clinicActionId === selectedClinic.id}
                  onClick={async () => {
                    await handleVerifyClinic(selectedClinic.id, false);
                    setSelectedClinic(null);
                  }}
                  className="text-rose-600 hover:text-rose-700"
                >
                  Suspend Verification
                </AppleButton>
              ) : (
                <AppleButton
                  variant="primary"
                  size="sm"
                  disabled={clinicActionId === selectedClinic.id}
                  onClick={async () => {
                    await handleVerifyClinic(selectedClinic.id, true);
                    setSelectedClinic(null);
                  }}
                >
                  {clinicActionId === selectedClinic.id ? 'Approving...' : 'Approve & Verify Facility'}
                </AppleButton>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
