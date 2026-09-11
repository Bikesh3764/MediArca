import React, { useEffect, useState } from 'react';
import { api, ClinicDashboardData, Doctor } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { SubNav } from '../../components/layout/SubNav';
import {
  Building2,
  Users,
  CalendarCheck,
  DollarSign,
  UserPlus,
  Trash2,
  MapPin,
  Phone,
  AlertCircle,
  CheckCircle2,
  X,
  Clock,
  Search,
} from 'lucide-react';

export const ClinicDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<ClinicDashboardData | null>(null);
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [doctorEmail, setDoctorEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchClinicData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getMyClinic();
      setData(res);
    } catch (err: any) {
      console.error('Failed to load clinic details:', err);
      setError(err.message || 'Failed to load clinic statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableDoctors = async () => {
    try {
      const docs = await api.getDoctors();
      setAllDoctors(docs);
    } catch (err) {
      console.error('Failed to load doctor catalog:', err);
    }
  };

  useEffect(() => {
    fetchClinicData();
    fetchAvailableDoctors();
  }, []);

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

  const clinic = data?.clinic;
  const doctors = data?.doctors || [];

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav
        title={clinic?.clinicName || user?.fullName || 'Clinic Partner Portal'}
        subtitle={`${clinic?.address || 'Clinical Operations Dashboard'} ${
          clinic?.city ? `• ${clinic.city}` : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <AppleButton
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Onboard Doctor
          </AppleButton>
        </div>
      </SubNav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
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
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center">
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
        <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 sm:p-8 shadow-xs">
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
              Onboard Doctor
            </AppleButton>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-[#86868b]">Loading roster data...</div>
          ) : doctors.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-[#f5f5f7] text-[#86868b] flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-[#1d1d1f] mb-1">No Doctors Onboarded Yet</h3>
              <p className="text-xs text-[#86868b] max-w-xs mx-auto mb-4">
                Onboard doctors by entering their registered email or selecting from the directory below.
              </p>
              <AppleButton variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
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
                    <th className="pb-3 text-center">Facility Bookings</th>
                    <th className="pb-3 text-right">Facility Revenue</th>
                    <th className="pb-3 text-right pr-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f0]">
                  {doctors.map((doc) => (
                    <tr key={doc.doctorId} className="hover:bg-[#fafafc] transition-colors">
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
                              <div className="w-full h-full flex items-center justify-center font-semibold text-xs text-[#0066cc]">
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
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 text-[#0066cc] border border-blue-100">
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

        {/* 3. Recent Clinic Appointments Table */}
        {data?.recentAppointments && data.recentAppointments.length > 0 && (
          <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 sm:p-8 shadow-xs">
            <h3 className="text-base font-semibold text-[#1d1d1f] mb-4">
              Recent Consultations at this Facility
            </h3>
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
                        <span className="font-mono font-semibold text-[#0066cc]">
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
                              ? 'bg-blue-50 text-[#0066cc] border border-blue-200'
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
          </div>
        )}
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
                  className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-xs focus:outline-none focus:border-[#0066cc]"
                />
              </div>

              {/* Quick Select from Platform Doctors */}
              {allDoctors.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[#86868b] mb-1.5">
                    Or select from platform verified doctors:
                  </label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {allDoctors.map((d) => {
                      const isAlreadyAdded = doctors.some((doc) => doc.doctorId === d.id);
                      return (
                        <div
                          key={d.id}
                          className="p-2 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-medium text-[#1d1d1f]">{d.user.fullName}</div>
                            <div className="text-[10px] text-[#86868b]">{d.specialty} • {d.user.email}</div>
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
                              className="px-2.5 py-1 rounded-full bg-[#0066cc] text-white text-[11px] font-medium hover:bg-[#0071e3]"
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
    </div>
  );
};
