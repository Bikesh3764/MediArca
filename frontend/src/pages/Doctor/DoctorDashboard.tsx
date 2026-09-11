import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Appointment } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SubNav } from '../../components/layout/SubNav';
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
} from 'lucide-react';

export const DoctorDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
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

  const fetchQueue = async () => {
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
  };

  useEffect(() => {
    if (!user || user.role !== 'DOCTOR') {
      navigate('/login');
      return;
    }
    fetchQueue();

    // Auto refresh every 10 seconds for real-time clinic updates
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, [date, user]);

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

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav title="Doctor Console" subtitle="Real-time patient queue controller">
        <AppleButton variant="ghost" size="sm" onClick={fetchQueue} className="flex items-center gap-1">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </AppleButton>
        <AppleButton
          variant="ghost"
          size="sm"
          onClick={() => navigate('/doctor/schedule')}
        >
          Manage Hours
        </AppleButton>
      </SubNav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
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
              <RefreshCw className="w-4 h-4 text-[#0066cc] animate-spin" />
              <span>Connecting to cloud database... (Cloud backend may take 30s to resume from idle)</span>
            </div>
            <AppleButton variant="ghost" size="sm" onClick={fetchQueue} className="text-[#0066cc]">
              Retry
            </AppleButton>
          </div>
        )}

        {/* Top Shift & Date Selector Header */}
        <div className="bg-white rounded-[20px] border border-[#e0e0e0] p-6 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-[#1d1d1f]">{user?.fullName}</h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc]">
                {user?.doctorProfile?.specialty || 'Doctor'}
              </span>
            </div>
            <p className="text-xs text-[#7a7a7a] mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#0066cc]" />
              Configured Checking Shift:{' '}
              <strong>
                {user?.doctorProfile?.checkingStartTime || '09:00'} –{' '}
                {user?.doctorProfile?.checkingEndTime || '13:00'}
              </strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-[#7a7a7a]">Queue Date:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 px-3 rounded-xl border border-[#e0e0e0] text-xs bg-white focus:outline-none focus:border-[#0066cc]"
            />
          </div>
        </div>

        {/* Queue Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <UtilityCard className="flex items-center justify-between">
            <div>
              <span className="text-xs text-[#7a7a7a] uppercase font-semibold">Total in Queue</span>
              <h3 className="text-3xl font-bold text-[#1d1d1f] mt-1">
                {queueData?.totalQueue || 0}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </UtilityCard>

          <UtilityCard className="flex items-center justify-between">
            <div>
              <span className="text-xs text-[#7a7a7a] uppercase font-semibold">Waiting to be Seen</span>
              <h3 className="text-3xl font-bold text-[#0066cc] mt-1">
                {queueData?.waitingQueue.length || 0}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </UtilityCard>

          <UtilityCard className="flex items-center justify-between">
            <div>
              <span className="text-xs text-[#7a7a7a] uppercase font-semibold">Completed Consultations</span>
              <h3 className="text-3xl font-bold text-emerald-600 mt-1">
                {queueData?.completedQueue.length || 0}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </UtilityCard>
        </div>

        {/* Main Console Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active In-Consultation Patient (1 Column) */}
          <div className="lg:col-span-1">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#7a7a7a] mb-3">
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

                <h4 className="text-xl font-semibold text-[#1d1d1f]">
                  {queueData.activeInConsultation.patient?.user.fullName}
                </h4>
                <p className="text-xs text-[#7a7a7a] mt-0.5">
                  Scheduled for {queueData.activeInConsultation.estimatedTime}
                </p>

                <div className="my-4 p-3 rounded-xl bg-[#f5f5f7] text-xs text-[#1d1d1f] space-y-1">
                  <div>
                    <strong className="text-[#7a7a7a]">Reason: </strong>
                    {queueData.activeInConsultation.reasonForVisit || 'General Consultation'}
                  </div>
                  {queueData.activeInConsultation.symptoms && (
                    <div>
                      <strong className="text-[#7a7a7a]">Symptoms: </strong>
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
              <div className="bg-white rounded-[20px] border border-[#e0e0e0] p-8 text-center">
                <Stethoscope className="w-10 h-10 text-[#7a7a7a] mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-[#1d1d1f]">Cabin is Free</h4>
                <p className="text-xs text-[#7a7a7a] mt-1">
                  No patient currently in consultation. Click "Call Patient" on the waiting queue below.
                </p>
              </div>
            )}
          </div>

          {/* Waiting Queue List (2 Columns) */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#7a7a7a] mb-3">
              Waiting Queue ({queueData?.waitingQueue.length || 0})
            </h3>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-[18px] bg-white border border-[#e0e0e0] animate-pulse"></div>
                ))}
              </div>
            ) : queueData?.waitingQueue.length === 0 ? (
              <div className="bg-white rounded-[20px] border border-[#e0e0e0] p-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <h4 className="text-base font-semibold text-[#1d1d1f]">Queue is Clear!</h4>
                <p className="text-xs text-[#7a7a7a] mt-1">
                  All patients scheduled for this date have either completed consultation or not yet booked.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {queueData?.waitingQueue.map((appt) => (
                  <div
                    key={appt.id}
                    className="bg-white rounded-[18px] border border-[#e0e0e0] p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-[#0066cc]/30 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-[#1d1d1f] text-white flex flex-col items-center justify-center font-bold">
                        <span className="text-[9px] uppercase tracking-wider text-[#2997ff]">Queue</span>
                        <span className="text-lg leading-none">#{appt.queueNumber}</span>
                      </div>
                      <div>
                        <h4 className="text-[16px] font-semibold text-[#1d1d1f]">
                          {appt.patient?.user.fullName}
                        </h4>
                        <p className="text-xs text-[#7a7a7a] flex items-center gap-1.5 mt-0.5">
                          <span>Est. {appt.estimatedTime}</span>
                          <span>•</span>
                          <span className="text-[#0066cc]">
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
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7a7a7a] mb-3">
                  Completed Today ({queueData.completedQueue.length})
                </h4>
                <div className="space-y-2">
                  {queueData.completedQueue.map((appt) => (
                    <div
                      key={appt.id}
                      className="p-3.5 rounded-xl bg-white border border-[#e0e0e0] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs hover:border-[#0066cc]/30 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#7a7a7a]">Queue #{appt.queueNumber}</span>
                        <span className="font-medium text-[#1d1d1f]">{appt.patient?.user.fullName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium border border-emerald-200">
                          Prescription Issued
                        </span>
                        <AppleButton
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/doctor/consultation/${appt.id}`)}
                          className="text-[#0066cc] text-[11px] py-1 px-2.5"
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
  );
};
