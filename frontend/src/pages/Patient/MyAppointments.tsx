import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Appointment } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SubNav } from '../../components/layout/SubNav';
import { LiveQueueTicket } from '../../components/queue/LiveQueueTicket';
import { PrescriptionModal } from '../../components/ui/PrescriptionModal';
import { AppleButton } from '../../components/ui/AppleButton';
import { Calendar, Plus, RefreshCw } from 'lucide-react';

export const MyAppointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedPrescriptionAppt, setSelectedPrescriptionAppt] = useState<Appointment | null>(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const data = await api.getPatientAppointments();
      setAppointments(data);
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchAppointments();

    // Auto-refresh queue every 15 seconds so patient sees live queue position updates!
    const interval = setInterval(fetchAppointments, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const handleCancel = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment queue token?')) return;
    try {
      await api.cancelAppointment(id);
      fetchAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel');
    }
  };

  const upcomingList = appointments.filter(
    (a) => a.status === 'WAITING' || a.status === 'IN_CONSULTATION'
  );
  const pastList = appointments.filter(
    (a) => a.status === 'COMPLETED' || a.status === 'CANCELLED'
  );

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav title="My Appointments" subtitle="Live queue passes and consultations">
        <AppleButton
          variant="ghost"
          size="sm"
          onClick={fetchAppointments}
          className="flex items-center gap-1"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </AppleButton>
        <AppleButton
          variant="primary"
          size="sm"
          onClick={() => navigate('/doctors')}
          className="flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Book Specialist
        </AppleButton>
      </SubNav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        {/* Apple Pill Segmented Filter */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/80 p-1 rounded-full border border-[#e0e0e0] flex shadow-sm">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-6 py-2 rounded-full text-xs font-medium transition-all ${
                activeTab === 'upcoming'
                  ? 'bg-[#0066cc] text-white shadow-sm'
                  : 'text-[#7a7a7a] hover:text-[#1d1d1f]'
              }`}
            >
              Active Queue Passes ({upcomingList.length})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`px-6 py-2 rounded-full text-xs font-medium transition-all ${
                activeTab === 'past'
                  ? 'bg-[#0066cc] text-white shadow-sm'
                  : 'text-[#7a7a7a] hover:text-[#1d1d1f]'
              }`}
            >
              Past Consultations ({pastList.length})
            </button>
          </div>
        </div>

        {/* List Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-64 rounded-[20px] bg-white border border-[#e0e0e0] animate-pulse"></div>
            ))}
          </div>
        ) : activeTab === 'upcoming' ? (
          upcomingList.length === 0 ? (
            <div className="bg-white rounded-[20px] border border-[#e0e0e0] p-12 text-center">
              <Calendar className="w-10 h-10 text-[#7a7a7a] mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-[#1d1d1f]">No active queue tokens</h3>
              <p className="text-xs text-[#7a7a7a] mt-1 max-w-sm mx-auto">
                You have no scheduled appointments currently waiting in queue.
              </p>
              <AppleButton
                variant="primary"
                size="md"
                onClick={() => navigate('/doctors')}
                className="mt-5"
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
                  onViewPrescription={(a) => setSelectedPrescriptionAppt(a)}
                />
              ))}
            </div>
          )
        ) : pastList.length === 0 ? (
          <div className="bg-white rounded-[20px] border border-[#e0e0e0] p-12 text-center">
            <Calendar className="w-10 h-10 text-[#7a7a7a] mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-[#1d1d1f]">No past consultations recorded</h3>
            <p className="text-xs text-[#7a7a7a] mt-1">
              Completed consultations and digital prescriptions will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {pastList.map((appt) => (
              <LiveQueueTicket
                key={appt.id}
                appointment={appt}
                onViewPrescription={(a) => setSelectedPrescriptionAppt(a)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Prescription Modal */}
      <PrescriptionModal
        appointment={selectedPrescriptionAppt}
        onClose={() => setSelectedPrescriptionAppt(null)}
      />
    </div>
  );
};
