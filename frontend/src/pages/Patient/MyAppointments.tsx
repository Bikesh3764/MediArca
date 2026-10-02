import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Appointment, getLocalDateString } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { LiveQueueTicket } from '../../components/queue/LiveQueueTicket';
import { AppleButton } from '../../components/ui/AppleButton';
import { Calendar, Plus, RefreshCw } from 'lucide-react';

export const MyAppointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const { user, loading: loadingAuth } = useAuth();
  const navigate = useNavigate();

  const fetchAppointments = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await api.getPatientAppointments();
      setAppointments(data);
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      navigate('/login');
      return;
    }
    queueMicrotask(() => {
      fetchAppointments();
    });

    // Auto-refresh queue silently every 15 seconds so patient sees live queue position updates without flickering
    const interval = setInterval(() => fetchAppointments(true), 15000);
    return () => clearInterval(interval);
  }, [user, loadingAuth, navigate]);

  const handleCancel = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment queue token?')) return;
    try {
      await api.cancelAppointment(id);
      fetchAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel');
    }
  };

  const todayStr = getLocalDateString();
  const upcomingList = appointments.filter((a) => {
    if (a.status !== 'WAITING' && a.status !== 'IN_CONSULTATION' && a.status !== 'PENDING_APPROVAL') return false;
    if (a.appointmentDate < todayStr) return false;
    if (a.status === 'PENDING_APPROVAL' && a.appointmentDate === todayStr && a.liveQueue?.isShiftPassed) return false;
    return true;
  });
  const pastList = appointments.filter((a) => !upcomingList.includes(a));

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      {/* Sleek Apple Header */}
      <div className="bg-white border-b border-[#e5e5ea]/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0066cc]">Live Care Access</span>
                {upcomingList.length > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#0066cc]/10 text-[#0066cc]">
                    {upcomingList.length} Active {upcomingList.length === 1 ? 'Pass' : 'Passes'}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] tracking-tight">Appointments & Passes</h1>
              <p className="text-xs sm:text-sm text-[#86868b] mt-0.5">Track your live queue position, consultation passes, and token updates</p>
            </div>
            <div className="flex items-center gap-2">
              <AppleButton
                variant="ghost"
                size="sm"
                onClick={() => fetchAppointments()}
                className="flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </AppleButton>
              <AppleButton
                variant="primary"
                size="sm"
                onClick={() => navigate('/doctors')}
                className="flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Book Doctor
              </AppleButton>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Apple Pill Segmented Filter */}
        <div className="flex justify-center mb-8">
          <div className="bg-[#f5f5f7] p-1 rounded-full border border-[#e5e5ea] flex shadow-2xs">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-4 sm:px-6 py-2 rounded-full text-xs transition-all cursor-pointer active:scale-[0.98] ${
                activeTab === 'upcoming'
                  ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs'
                  : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
              }`}
            >
              Active Passes ({upcomingList.length})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`px-4 sm:px-6 py-2 rounded-full text-xs transition-all cursor-pointer active:scale-[0.98] ${
                activeTab === 'past'
                  ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs'
                  : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
              }`}
            >
              Past ({pastList.length})
            </button>
          </div>
        </div>

        {/* List Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-64 rounded-[20px] bg-white border border-[#e5e5ea] animate-pulse"></div>
            ))}
          </div>
        ) : activeTab === 'upcoming' ? (
          upcomingList.length === 0 ? (
            <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-12 text-center max-w-lg mx-auto shadow-sm">
              <Calendar className="w-10 h-10 text-[#86868b] mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-[#1d1d1f]">No active queue tokens</h3>
              <p className="text-xs text-[#86868b] mt-1 max-w-sm mx-auto">
                You have no scheduled appointments currently waiting in queue.
              </p>
              <AppleButton
                variant="primary"
                size="md"
                onClick={() => navigate('/doctors')}
                className="mt-6"
              >
                Find and Book a Doctor
              </AppleButton>
            </div>
          ) : (
            <div className="space-y-6">
              {upcomingList.map((appt) => (
                <LiveQueueTicket
                  key={appt.id}
                  appointment={appt}
                  onCancel={handleCancel}
                />
              ))}
            </div>
          )
        ) : pastList.length === 0 ? (
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-12 text-center max-w-lg mx-auto shadow-sm">
            <Calendar className="w-10 h-10 text-[#86868b] mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-[#1d1d1f]">No past consultations recorded</h3>
            <p className="text-xs text-[#86868b] mt-1">
              Completed consultations will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {pastList.map((appt) => (
              <LiveQueueTicket
                key={appt.id}
                appointment={appt}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
