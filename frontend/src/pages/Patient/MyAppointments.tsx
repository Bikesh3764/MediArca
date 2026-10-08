import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Appointment, getLocalDateString } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SubNav } from '../../components/layout/SubNav';
import { LiveQueueTicket } from '../../components/queue/LiveQueueTicket';
import { AppleButton } from '../../components/ui/AppleButton';
import { Calendar, Plus, RefreshCw, QrCode, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { CameraQrScannerModal } from '../../components/common/CameraQrScannerModal';
import { useVisibilityPolling } from '../../utils/useVisibilityPolling';

export const MyAppointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedApptForScan, setSelectedApptForScan] = useState<Appointment | null>(null);
  const [checkinMessage, setCheckinMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
  }, [user, loadingAuth, navigate]);

  // Auto-refresh queue silently every 15 seconds only while tab is active/visible (FIX-012)
  useVisibilityPolling(
    () => fetchAppointments(true),
    15000,
    Boolean(user) && !loadingAuth
  );

  const handleCancel = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment queue token?')) return;
    try {
      await api.cancelAppointment(id);
      fetchAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel');
    }
  };

  const handleScanSuccess = async (data: { clinicId: string; code: string }) => {
    try {
      const res = await api.checkInWithQR({
        clinicId: data.clinicId,
        code: data.code,
        appointmentId: selectedApptForScan?.id,
      });
      setCheckinMessage({
        type: 'success',
        text: res?.message || 'Checked in successfully! You are marked as present at the clinic desk.',
      });
      fetchAppointments(true);
    } catch (err: any) {
      setCheckinMessage({
        type: 'error',
        text: err.message || 'Failed to complete clinic check-in. Please verify code or speak with reception desk.',
      });
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
    <div className="min-h-screen bg-[#f5f5f7] pb-20">
      <SubNav
        title="My Appointments"
        subtitle="Live outpatient queue passes and consultation history"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <AppleButton
            variant="secondary"
            size="sm"
            onClick={() => {
              setSelectedApptForScan(null);
              setScannerOpen(true);
            }}
          >
            <QrCode className="w-4 h-4 text-[#0066cc]" />
            <span>Scan Clinic QR</span>
          </AppleButton>
          <AppleButton
            variant="ghost"
            size="sm"
            onClick={() => fetchAppointments()}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </AppleButton>
          <AppleButton
            variant="primary"
            size="sm"
            onClick={() => navigate('/doctors')}
          >
            <Plus className="w-4 h-4" />
            <span>Book Doctor</span>
          </AppleButton>
        </div>
      </SubNav>

      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Check-In Feedback Banner */}
        {checkinMessage && (
          <div
            className={`p-4 rounded-xl border text-[13px] font-medium flex items-center justify-between gap-3 ${
              checkinMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200/80 text-emerald-900'
                : 'bg-[#ff3b30]/8 border-[#ff3b30]/20 text-[#d70015]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {checkinMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-[#ff3b30] shrink-0" />
              )}
              <span>{checkinMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setCheckinMessage(null)}
              className="text-[#86868b] hover:text-[#1d1d1f] p-1 rounded-full transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Segmented Filter */}
        <div className="flex items-center justify-between gap-4">
          <div className="bg-white p-1 rounded-full border border-[#e5e5ea] inline-flex shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('upcoming')}
              className={`px-5 py-1.5 rounded-full text-[13px] transition-all cursor-pointer ${
                activeTab === 'upcoming'
                  ? 'bg-[#1d1d1f] text-white font-semibold'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f] font-medium'
              }`}
            >
              Active & Upcoming ({upcomingList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('past')}
              className={`px-5 py-1.5 rounded-full text-[13px] transition-all cursor-pointer ${
                activeTab === 'past'
                  ? 'bg-[#1d1d1f] text-white font-semibold'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f] font-medium'
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
              <div key={i} className="h-64 apple-card animate-pulse" />
            ))}
          </div>
        ) : activeTab === 'upcoming' ? (
          upcomingList.length === 0 ? (
            <div className="apple-card p-10 sm:p-12 text-center max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center mx-auto mb-4 text-[#86868b]">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-card-title">No upcoming appointments</h3>
              <p className="text-secondary mt-1 mb-6">
                Your scheduled consultations and live queue tokens will appear here.
              </p>
              <AppleButton
                variant="primary"
                size="md"
                onClick={() => navigate('/doctors')}
              >
                Book Doctor
              </AppleButton>
            </div>
          ) : (
            <div className="space-y-5">
              {upcomingList.map((appt) => (
                <LiveQueueTicket
                  key={appt.id}
                  appointment={appt}
                  onCancel={handleCancel}
                  onScanQr={(a) => {
                    setSelectedApptForScan(a);
                    setScannerOpen(true);
                  }}
                  onTogglePresence={async (apptId, isPresent) => {
                    await api.checkInAppointmentDirect(apptId, isPresent);
                    fetchAppointments(true);
                  }}
                />
              ))}
            </div>
          )
        ) : pastList.length === 0 ? (
          <div className="apple-card p-10 sm:p-12 text-center max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center mx-auto mb-4 text-[#86868b]">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-card-title">No past appointments</h3>
            <p className="text-secondary mt-1">
              Completed and archived consultations will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {pastList.map((appt) => (
              <LiveQueueTicket
                key={appt.id}
                appointment={appt}
              />
            ))}
          </div>
        )}
      </div>

      {/* In-App Camera QR Scanner Modal */}
      <CameraQrScannerModal
        isOpen={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          setSelectedApptForScan(null);
        }}
        onScanSuccess={handleScanSuccess}
        defaultClinicId={selectedApptForScan?.clinicId || undefined}
      />
    </div>
  );
};
