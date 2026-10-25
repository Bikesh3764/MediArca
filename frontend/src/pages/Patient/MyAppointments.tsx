import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Appointment, getLocalDateString } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { LiveQueueTicket } from '../../components/queue/LiveQueueTicket';
import { CheckCircle2, AlertCircle, X, ChevronDown, Calendar, Clock } from 'lucide-react';
import { useVisibilityPolling } from '../../utils/useVisibilityPolling';
import { useLiveEvent } from '../../utils/liveEvents';
import { requestTurnAlertPermission, useTurnAlerts } from '../../utils/turnAlerts';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { EmptyState } from '../../components/common/EmptyState';

const CameraQrScannerModal = React.lazy(() =>
  import('../../components/common/CameraQrScannerModal').then((m) => ({ default: m.CameraQrScannerModal }))
);

export const MyAppointments: React.FC = () => {
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [loadingPast, setLoadingPast] = useState(false);
  const [hasLoadedPast, setHasLoadedPast] = useState(false);
  const [pastPage, setPastPage] = useState(1);
  const [hasMorePast, setHasMorePast] = useState(false);
  const [loadingMorePast, setLoadingMorePast] = useState(false);

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedApptForScan, setSelectedApptForScan] = useState<Appointment | null>(null);
  const selectedApptRef = useRef<Appointment | null>(null);
  const [checkinMessage, setCheckinMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { user, loading: loadingAuth } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const fetchActiveAppointments = async (isSilent = false) => {
    if (!isSilent) setLoadingUpcoming(true);
    try {
      const data = await api.getPatientAppointments({ status: 'active' });
      setUpcomingAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load active appointments:', err);
    } finally {
      if (!isSilent) setLoadingUpcoming(false);
    }
  };

  const fetchInitialPastAppointments = async () => {
    if (hasLoadedPast || loadingPast) return;
    setLoadingPast(true);
    try {
      const data = await api.getPatientAppointments({ status: 'past', page: 1, limit: 10 });
      const list = Array.isArray(data) ? data : [];
      setPastAppointments(list);
      setHasLoadedPast(true);
      setPastPage(1);
      setHasMorePast(list.length === 10);
    } catch (err) {
      console.error('Failed to load past appointments:', err);
    } finally {
      setLoadingPast(false);
    }
  };

  const handleLoadMorePast = async () => {
    if (loadingMorePast || !hasMorePast) return;
    setLoadingMorePast(true);
    const nextPage = pastPage + 1;
    try {
      const data = await api.getPatientAppointments({ status: 'past', page: nextPage, limit: 10 });
      const list = Array.isArray(data) ? data : [];
      setPastAppointments((prev) => [...prev, ...list]);
      setPastPage(nextPage);
      setHasMorePast(list.length === 10);
    } catch (err) {
      console.error('Failed to load more past appointments:', err);
    } finally {
      setLoadingMorePast(false);
    }
  };

  const handleTabChange = (tab: 'upcoming' | 'past') => {
    setActiveTab(tab);
    if (tab === 'past' && !hasLoadedPast) {
      fetchInitialPastAppointments();
    }
  };

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      navigate('/login');
      return;
    }
    queueMicrotask(() => {
      fetchActiveAppointments();
    });
  }, [user, loadingAuth, navigate]);

  // Calculate adaptive polling interval based on how close patient is to consultation (Step 2)
  const adaptivePollInterval = React.useMemo(() => {
    if (upcomingAppointments.length === 0) return 60000;
    // Find minimum patients ahead across all active bookings
    const minAhead = Math.min(
      ...upcomingAppointments.map((a) => a.liveQueue?.patientsAway ?? 99)
    );
    // 10s: Turn is imminent (in consultation, next in line, or <= 1 patient ahead)
    if (minAhead <= 1 || upcomingAppointments.some((a) => a.status === 'IN_CONSULTATION' || a.liveQueue?.isYourTurn)) {
      return 10000;
    }
    // 15s (15000ms base): Getting close (within 2-5 patients ahead, ~10-15 minutes)
    if (minAhead <= 5) {
      return 15000;
    }
    // 60s: Far back in queue (>5 patients ahead)
    return 60000;
  }, [upcomingAppointments]);

  // Auto-refresh queue silently with adaptive interval ONLY while tab is active AND user has active visits (FIX-012)
  useVisibilityPolling(
    () => fetchActiveAppointments(true),
    adaptivePollInterval,
    Boolean(user) && !loadingAuth && upcomingAppointments.length > 0
  );

  // Instant refresh when this patient's doctor's queue moves (polling above stays as backup)
  useLiveEvent(
    'queue',
    (evt) => {
      if (!evt.doctorId || upcomingAppointments.some((a) => a.doctorId === evt.doctorId)) {
        fetchActiveAppointments(true);
      }
    },
    Boolean(user) && !loadingAuth && upcomingAppointments.length > 0
  );

  // "You're next" / "Go in now" alert (toast, vibration, and a system notification if allowed)
  useTurnAlerts(upcomingAppointments, (title, message) => toast.info(message, title, 8000));

  const handleCancel = async (id: string) => {
    const ok = await confirm({
      title: 'Cancel Queue Token?',
      message: 'Are you sure you want to cancel this appointment queue token? This action cannot be undone.',
      confirmText: 'Yes, Cancel',
      isDestructive: true,
    });
    if (!ok) return;

    try {
      await api.cancelAppointment(id);
      toast.success('Appointment cancelled successfully');
      await fetchActiveAppointments(true);
      if (hasLoadedPast) {
        const data = await api.getPatientAppointments({ status: 'past', page: 1, limit: 10 });
        const list = Array.isArray(data) ? data : [];
        setPastAppointments(list);
        setPastPage(1);
        setHasMorePast(list.length === 10);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel appointment');
    }
  };

  const handleScanSuccess = async (data: { clinicId: string; code: string }) => {
    const targetAppt = selectedApptForScan || selectedApptRef.current;
    const targetApptId = targetAppt?.id;
    try {
      const res = await api.checkInWithQR({
        clinicId: data.clinicId,
        code: data.code,
        appointmentId: targetApptId,
      });

      const updatedAppt = res?.id ? res : (res?.data || null);
      const effectiveId = updatedAppt?.id || targetApptId;

      if (effectiveId) {
        setUpcomingAppointments((prev) =>
          prev.map((a) =>
            a.id === effectiveId
              ? {
                  ...a,
                  ...(updatedAppt || {}),
                  isCheckedIn: true,
                  checkedInAt: updatedAppt?.checkedInAt || new Date().toISOString(),
                }
              : a
          )
        );
      }

      setCheckinMessage({
        type: 'success',
        text:
          res?.message ||
          (res?.alreadyCheckedIn
            ? 'You are already checked in at the clinic desk.'
            : 'Checked in successfully! You are marked as present at the clinic desk.'),
      });

      await fetchActiveAppointments(true);
    } catch (err: any) {
      setCheckinMessage({
        type: 'error',
        text: err.message || 'Failed to complete clinic check-in. Please verify code or speak with reception desk.',
      });
    } finally {
      selectedApptRef.current = null;
    }
  };

  const todayStr = getLocalDateString();
  const upcomingList = upcomingAppointments.filter((a) => {
    if (a.status !== 'WAITING' && a.status !== 'IN_CONSULTATION' && a.status !== 'PENDING_APPROVAL') return false;
    if (a.appointmentDate < todayStr) return false;
    if (a.status === 'PENDING_APPROVAL' && a.appointmentDate === todayStr && a.liveQueue?.isShiftPassed) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-24 md:pb-16 pb-safe">
      {/* Sleek Apple Header */}
      <div className="bg-white border-b border-[#e5e5ea]/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <h1 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">Appointments</h1>
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
            <button aria-label="Close"
              onClick={() => setCheckinMessage(null)}
              className="text-[#86868b] hover:text-[#1d1d1f] p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Apple Segmented Filter */}
        <div className="flex justify-center mb-8">
          <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-full inline-flex gap-0.5 select-none">
            <button
              type="button"
              onClick={() => handleTabChange('upcoming')}
              className={`h-9 px-5 rounded-full text-[13px] active:scale-[0.96] transition-all duration-150 cursor-pointer ${
                activeTab === 'upcoming'
                  ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs border border-black/5'
                  : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
              }`}
            >
              Upcoming ({upcomingList.length})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('past')}
              className={`h-9 px-5 rounded-full text-[13px] active:scale-[0.96] transition-all duration-150 cursor-pointer ${
                activeTab === 'past'
                  ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs border border-black/5'
                  : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
              }`}
            >
              Past {hasLoadedPast ? `(${pastAppointments.length}${hasMorePast ? '+' : ''})` : ''}
            </button>
          </div>
        </div>

        {/* List Content */}
        {loadingUpcoming ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-64 rounded-[24px] bg-white border border-[#e5e5ea] animate-pulse"></div>
            ))}
          </div>
        ) : activeTab === 'upcoming' ? (
          upcomingList.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No upcoming appointments"
              description="Your scheduled visits and queue tokens will appear here."
              actionText="Book Doctor"
              onAction={() => navigate('/doctors')}
            />
          ) : (
            <div className="space-y-6">
              {upcomingList.map((appt) => (
                <LiveQueueTicket
                  key={appt.id}
                  appointment={appt}
                  onCancel={handleCancel}
                  onScanQr={(a) => {
                    requestTurnAlertPermission();
                    setCheckinMessage(null);
                    selectedApptRef.current = a;
                    setSelectedApptForScan(a);
                    setScannerOpen(true);
                  }}
                  onTogglePresence={async (apptId, isPresent) => {
                    setCheckinMessage(null);
                    setUpcomingAppointments((prev) =>
                      prev.map((a) => (a.id === apptId ? { ...a, isCheckedIn: isPresent } : a))
                    );
                    await api.checkInAppointmentDirect(apptId, isPresent);
                    await fetchActiveAppointments(true);
                  }}
                />
              ))}
            </div>
          )
        ) : loadingPast ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 rounded-[24px] bg-white border border-[#e5e5ea] animate-pulse"></div>
            ))}
          </div>
        ) : pastAppointments.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No past appointments"
            description="Completed consultations and past queue visits will appear here."
          />
        ) : (
          <div className="space-y-6">
            {pastAppointments.map((appt) => (
              <LiveQueueTicket
                key={appt.id}
                appointment={appt}
              />
            ))}

            {/* Show More Button (10 records at a time) */}
            {hasMorePast && (
              <div className="flex justify-center pt-2 pb-4">
                <button
                  type="button"
                  onClick={handleLoadMorePast}
                  disabled={loadingMorePast}
                  className="h-11 px-6 rounded-full bg-white hover:bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] font-medium text-sm transition-all duration-150 active:scale-[0.98] shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingMorePast ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#1d1d1f] border-t-transparent rounded-full animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <span>Show More</span>
                      <ChevronDown className="w-4 h-4 text-[#86868b]" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* In-App Camera QR Scanner Modal */}
      {scannerOpen && (
        <Suspense fallback={null}>
          <CameraQrScannerModal
            isOpen={scannerOpen}
            onClose={() => {
              setScannerOpen(false);
              setSelectedApptForScan(null);
            }}
            onScanSuccess={handleScanSuccess}
            defaultClinicId={selectedApptForScan?.clinicId || undefined}
          />
        </Suspense>
      )}
    </div>
  );
};
