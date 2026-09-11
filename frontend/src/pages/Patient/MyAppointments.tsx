import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Appointment } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { LiveQueueTicket } from '../../components/queue/LiveQueueTicket';
import { PrescriptionModal } from '../../components/ui/PrescriptionModal';
import { AppleButton } from '../../components/ui/AppleButton';
import { Calendar, Plus, RefreshCw, FileText, Stethoscope, User as UserIcon } from 'lucide-react';

export const MyAppointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedPrescriptionAppt, setSelectedPrescriptionAppt] = useState<Appointment | null>(null);

  const { user, loading: loadingAuth } = useAuth();
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
    if (loadingAuth) return;
    if (!user) {
      navigate('/login');
      return;
    }
    fetchAppointments();

    // Auto-refresh queue every 15 seconds so patient sees live queue position updates
    const interval = setInterval(fetchAppointments, 15000);
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

  const upcomingList = appointments.filter(
    (a) => a.status === 'WAITING' || a.status === 'IN_CONSULTATION'
  );
  const pastList = appointments.filter(
    (a) => a.status === 'COMPLETED' || a.status === 'CANCELLED'
  );

  const navItems: DashboardNavItem[] = [
    {
      id: 'appointments',
      label: 'Live Queue & Passes',
      icon: Calendar,
      path: '/patient/appointments',
      active: true,
      badge: upcomingList.length > 0 ? upcomingList.length : undefined,
    },
    {
      id: 'records',
      label: 'Medical Records Vault',
      icon: FileText,
      path: '/patient/records',
    },
    {
      id: 'find-doctors',
      label: 'Find Specialists',
      icon: Stethoscope,
      path: '/doctors',
    },
    {
      id: 'profile',
      label: 'Patient Profile',
      icon: UserIcon,
      path: '/patient/profile',
    },
  ];

  return (
    <DashboardLayout
      portalType="PATIENT"
      portalSubtitle="PATIENT PORTAL"
      navItems={navItems}
      title="My Appointments & Live Passes"
      subtitle="Track your live queue position and view consultation boarding passes"
      headerAction={
        <div className="flex items-center gap-2">
          <AppleButton
            variant="ghost"
            size="sm"
            onClick={fetchAppointments}
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
            Book Specialist
          </AppleButton>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Apple Pill Segmented Filter */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/90 p-1 rounded-full border border-[#e5e5ea] flex shadow-sm">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-6 py-2 rounded-full text-xs font-medium transition-all ${
                activeTab === 'upcoming'
                  ? 'bg-[#0066cc] text-white shadow-sm'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              Active Queue Passes ({upcomingList.length})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`px-6 py-2 rounded-full text-xs font-medium transition-all ${
                activeTab === 'past'
                  ? 'bg-[#0066cc] text-white shadow-sm'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
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
                  onViewPrescription={(a) => setSelectedPrescriptionAppt(a)}
                />
              ))}
            </div>
          )
        ) : pastList.length === 0 ? (
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-12 text-center max-w-lg mx-auto shadow-sm">
            <Calendar className="w-10 h-10 text-[#86868b] mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-[#1d1d1f]">No past consultations recorded</h3>
            <p className="text-xs text-[#86868b] mt-1">
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
    </DashboardLayout>
  );
};
