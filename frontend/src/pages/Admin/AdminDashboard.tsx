import React, { useEffect, useState } from 'react';
import { api, Doctor } from '../../services/api';
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
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<{
    totalPatients: number;
    totalDoctors: number;
    pendingDoctors: number;
    totalAppointments: number;
    todayAppointments: number;
  } | null>(null);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, doctorsData, apptsData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminDoctors(),
        api.getAdminAppointments(),
      ]);
      setStats(statsData);
      setDoctors(doctorsData);
      setAppointments(apptsData);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      navigate('/login');
      return;
    }
    fetchData();
  }, [user]);

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
            <div className="w-8 h-8 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin mb-3"></div>
            <p className="text-xs text-[#7a7a7a]">Loading platform telemetry and practitioner records...</p>
          </div>
        ) : (
          <>
            {/* KPI Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <UtilityCard>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#7a7a7a] uppercase font-semibold">Patients</span>
                <h3 className="text-3xl font-bold text-[#1d1d1f] mt-1">{stats?.totalPatients || 0}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </UtilityCard>

          <UtilityCard>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#7a7a7a] uppercase font-semibold">Doctors</span>
                <h3 className="text-3xl font-bold text-[#1d1d1f] mt-1">{stats?.totalDoctors || 0}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
          </UtilityCard>

          <UtilityCard>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#7a7a7a] uppercase font-semibold">Pending Review</span>
                <h3 className="text-3xl font-bold text-amber-600 mt-1">{stats?.pendingDoctors || 0}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
          </UtilityCard>

          <UtilityCard>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#7a7a7a] uppercase font-semibold">Total Bookings</span>
                <h3 className="text-3xl font-bold text-[#1d1d1f] mt-1">{stats?.totalAppointments || 0}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
          </UtilityCard>
        </div>

        {/* Doctor Verification Portal */}
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
                        <div className="w-8 h-8 rounded-full bg-[#e0e0e0] overflow-hidden flex-shrink-0">
                          {doc.user.avatarUrl ? (
                            <img src={doc.user.avatarUrl} alt={doc.user.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-[#0066cc]">
                              {doc.user.fullName[0]}
                            </div>
                          )}
                        </div>
                        <div>
                          <strong className="text-[13px] text-[#1d1d1f] block">{doc.user.fullName}</strong>
                          <span className="text-[#7a7a7a]">{doc.user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-medium text-[#1d1d1f]">{doc.specialty}</td>
                    <td className="py-3.5 px-3 text-[#7a7a7a]">
                      {doc.checkingStartTime} – {doc.checkingEndTime}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </UtilityCard>

        {/* Platform Appointments Oversight */}
        <UtilityCard>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold text-[#1d1d1f]">Recent Platform Bookings</h3>
              <p className="text-xs text-[#7a7a7a] mt-0.5">
                Audit trail of queue numbers and consultation statuses.
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
                {appointments.slice(0, 10).map((appt) => (
                  <tr key={appt.id} className="hover:bg-[#f5f5f7]/60">
                    <td className="py-3 px-3 font-medium text-[#1d1d1f]">{appt.appointmentDate}</td>
                    <td className="py-3 px-3 font-bold text-[#0066cc]">Queue #{appt.queueNumber}</td>
                    <td className="py-3 px-3">{appt.patient?.user.fullName}</td>
                    <td className="py-3 px-3">{appt.doctor?.user.fullName}</td>
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
        </>
        )}
      </div>
    </div>
  );
};
