import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Appointment, getLocalDateString } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { LiveQueueTicket } from '../../components/queue/LiveQueueTicket';
import { AppleButton } from '../../components/ui/AppleButton';
import { Plus, RefreshCw, QrCode, CheckCircle2, AlertCircle, X } from 'lucide-react';
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
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      {/* Sleek Apple Header */}
      <div className="bg-white border-b border-[#e5e5ea]/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">Appointments</h1>
            </div>
            <div className="flex items-center gap-2">
              <AppleButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedApptForScan(null);
                  setScannerOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs text-[#0066cc] hover:text-[#0071e3] hover:bg-[#0066cc]/5 border border-[#0066cc]/20"
              >
                <QrCode className="w-3.5 h-3.5" />
                Scan Clinic QR
              </AppleButton>
              <AppleButton
                variant="ghost"
                size="sm"
                onClick={() => fetchAppointments()}
                className="flex items-center gap-1.5 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </AppleButton>
              <AppleButton
                variant="primary"
                size="sm"
                onClick={() => navigate('/doctors')}
                className="flex items-center gap-1.5 shadow-none bg-[#0066cc] hover:bg-[#0071e3] text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Book Doctor
              </AppleButton>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Check-In Feedback Banner */}
        {checkinMessage && (
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
              checkinMessage.type === 'success'
                ? 'bg-white border-[#e5e5ea] text-[#1d1d1f]'
                : 'bg-rose-50/80 border-rose-200/80 text-rose-700'
            }`}
          >
            <div className="flex items-center gap-2">
              {checkinMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium">{checkinMessage.text}</span>
            </div>
            <button
              onClick={() => setCheckinMessage(null)}
              className="text-[#86868b] hover:text-[#1d1d1f] p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Apple Segmented Filter */}
        <div className="flex justify-center mb-8">
          <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl inline-flex gap-1 select-none">
            <button
              type="button"
              onClick={() => setActiveTab('upcoming')}
              className={`px-5 py-2 rounded-lg text-[13px] transition-all duration-150 cursor-pointer ${
                activeTab === 'upcoming'
                  ? 'bg-white text-[#1d1d1f] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_1px_rgba(0,0,0,0.04)] border border-black/5'
                  : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
              }`}
            >
              Upcoming ({upcomingList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('past')}
              className={`px-5 py-2 rounded-lg text-[13px] transition-all duration-150 cursor-pointer ${
                activeTab === 'past'
                  ? 'bg-white text-[#1d1d1f] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_1px_rgba(0,0,0,0.04)] border border-black/5'
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
              <div key={i} className="h-64 rounded-[24px] bg-white border border-[#e5e5ea] animate-pulse"></div>
            ))}
          </div>
        ) : activeTab === 'upcoming' ? (
          upcomingList.length === 0 ? (
            <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-10 sm:p-12 text-center max-w-md mx-auto shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <h3 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight">No upcoming appointments</h3>
              <p className="text-[13px] text-[#86868b] mt-1 leading-relaxed">
                Your scheduled visits and queue tokens will appear here.
              </p>
              <button
                type="button"
                onClick={() => navigate('/doctors')}
                className="mt-5 h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-medium transition-all duration-150 shadow-[0_2px_8px_rgba(0,102,204,0.2),0_1px_2px_rgba(0,0,0,0.06)] inline-flex items-center justify-center cursor-pointer select-none"
              >
                Book Doctor
              </button>
            </div>
          ) : (
            <div className="space-y-6">
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
          <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-10 sm:p-12 text-center max-w-md mx-auto shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <h3 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight">No past appointments</h3>
            <p className="text-[13px] text-[#86868b] mt-1 leading-relaxed">
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
