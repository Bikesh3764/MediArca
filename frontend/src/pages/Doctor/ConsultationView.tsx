import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Appointment } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { UtilityCard } from '../../components/ui/UtilityCard';
import { formatDisplayPhone } from '../../utils/phoneUtils';
import {
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  Save,
  LayoutDashboard,
  Building2,
  Calendar,
  Settings,
  UserCheck,
  Clock,
} from 'lucide-react';

export const ConsultationView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: loadingAuth } = useAuth();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [clinicalNotes, setClinicalNotes] = useState('');

  const navItems: DashboardNavItem[] = [
    {
      id: 'dashboard',
      label: 'Live Queue',
      icon: LayoutDashboard,
      path: '/doctor/dashboard',
      active: true,
    },
    {
      id: 'affiliations',
      label: 'Clinics & Staff',
      icon: Building2,
      path: '/doctor/dashboard?tab=affiliations',
    },
    {
      id: 'schedule',
      label: 'Shifts & Fees',
      icon: Calendar,
      path: '/doctor/schedule',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/doctor/profile',
    },
  ];

  useEffect(() => {
    if (loadingAuth) return;
    if (!user || user.role?.toUpperCase() !== 'DOCTOR') {
      navigate('/login');
      return;
    }

    const fetchAppointmentData = async () => {
      if (!id) return;
      try {
        const found = await api.getAppointmentById(id);
        if (found) {
          setAppointment(found);
          if (found.clinicalNotes) {
            setClinicalNotes(found.clinicalNotes);
          }
        } else {
          setError('Encounter record could not be retrieved.');
        }
      } catch (err: any) {
        setError(err.message || 'Error loading appointment details');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointmentData();
  }, [id, user, loadingAuth, navigate]);

  const handleSaveNotesDraft = async () => {
    if (!appointment) return;
    setSavingNotes(true);
    setError(null);
    try {
      await api.updateNotes({
        appointmentId: appointment.id,
        clinicalNotes: clinicalNotes.trim(),
      });
      setSuccessMsg('Consultation notes saved.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const [callingPatient, setCallingPatient] = useState(false);

  const handleCallPatient = async () => {
    if (!appointment) return;
    setCallingPatient(true);
    setError(null);
    try {
      const updated = await api.callPatient(appointment.id);
      setAppointment(updated);
      setSuccessMsg(`Token #${updated.queueNumber} called into cabin.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to call patient into cabin');
    } finally {
      setCallingPatient(false);
    }
  };

  const handleCompleteConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment) return;

    setSubmitting(true);
    setError(null);

    try {
      await api.completeConsultation({
        appointmentId: appointment.id,
        clinicalNotes: clinicalNotes.trim(),
      });
      navigate('/doctor/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to complete consultation');
      setSubmitting(false);
    }
  };

  if (loading || loadingAuth) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0066cc] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error && !appointment) {
    return (
      <DashboardLayout
        portalType="DOCTOR"
        navItems={navItems}
        title="Consultation Desk"
      >
        <div className="bg-white rounded-[24px] p-8 max-w-md border border-[#e5e5ea] text-center shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <h2 className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight">Unable to Load Encounter</h2>
          <p className="text-[13px] text-[#86868b] mt-1 mb-5">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/doctor/dashboard')}
            className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-medium transition-all duration-150 flex items-center justify-center cursor-pointer"
          >
            Return to Queue
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (!appointment) return null;

  const patientName = appointment.patientName || appointment.patient?.user?.fullName || 'Patient';
  const isCompleted = appointment.status === 'COMPLETED';
  const isCancelled = appointment.status === 'CANCELLED' || appointment.status === 'REJECTED';
  const isPendingApproval = appointment.status === 'PENDING_APPROVAL';
  const isWaiting = appointment.status === 'WAITING';

  return (
    <DashboardLayout
      portalType="DOCTOR"
      navItems={navItems}
      title="Patient Consultation"
      subtitle={`Token #${appointment.queueNumber} • ${patientName}`}
      headerAction={
        <button
          type="button"
          onClick={() => navigate('/doctor/dashboard')}
          className="h-9 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Queue</span>
        </button>
      }
    >
      <div className="max-w-3xl space-y-6">
        {/* Status Alerts */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#0066cc]" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Encounter Header Card */}
        <UtilityCard className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#e5e5ea]">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc]">
                  {appointment.status === 'IN_CONSULTATION'
                    ? 'In Consultation'
                    : appointment.status === 'COMPLETED'
                    ? 'Completed'
                    : appointment.status.replace('_', ' ')}
                </span>
                <span className="text-xs font-medium text-[#86868b]">
                  Token #{appointment.queueNumber}
                </span>
              </div>
              <h2 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                {patientName}
              </h2>
              {appointment.isForOther && appointment.patient?.user?.fullName && (
                <p className="text-xs text-[#86868b] mt-0.5">
                  Booked for family member by {appointment.patient.user.fullName}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[18px] font-semibold text-[#0066cc] bg-[#0066cc]/10 px-4 py-1.5 rounded-2xl">
                #{appointment.queueNumber}
              </span>
            </div>
          </div>

          {/* Patient & Booking Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 text-xs">
            <div className="space-y-1">
              <span className="text-[#86868b] font-medium block">Patient Info</span>
              <p className="font-semibold text-[#1d1d1f] text-[13px]">
                {appointment.patientAge ? `${appointment.patientAge} Yrs` : 'Age N/A'}
                {appointment.patientGender ? ` • ${appointment.patientGender}` : ''}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[#86868b] font-medium block">Phone</span>
              <p className="font-semibold text-[#1d1d1f] text-[13px]">
                {appointment.patientPhone || appointment.patient?.user?.phone
                  ? formatDisplayPhone(appointment.patientPhone || appointment.patient?.user?.phone || '')
                  : 'Not provided'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[#86868b] font-medium block">Date & Shift</span>
              <p className="font-semibold text-[#1d1d1f] text-[13px]">
                {appointment.appointmentDate}
              </p>
              <p className="text-xs text-[#86868b]">
                {appointment.checkingWindow || appointment.estimatedTime || 'Standard'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[#86868b] font-medium block">Clinic Venue</span>
              <p className="font-semibold text-[#1d1d1f] text-[13px] truncate">
                {appointment.clinic?.clinicName || 'Direct Facility'}
              </p>
            </div>
          </div>

          {/* Reason for Visit & Symptoms */}
          {(appointment.reasonForVisit || appointment.symptoms) && (
            <div className="mt-5 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-1.5 text-[13px]">
              {appointment.reasonForVisit && (
                <div>
                  <span className="font-semibold text-[#1d1d1f]">Reason for Visit: </span>
                  <span className="text-[#48484a] whitespace-pre-wrap break-words">{appointment.reasonForVisit}</span>
                </div>
              )}
              {appointment.symptoms && (
                <div>
                  <span className="font-semibold text-[#1d1d1f]">Reported Symptoms: </span>
                  <span className="text-[#48484a] whitespace-pre-wrap break-words">{appointment.symptoms}</span>
                </div>
              )}
            </div>
          )}
        </UtilityCard>

        {/* Consultation Completion Form / View */}
        {isCompleted ? (
          <UtilityCard className="p-6">
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle2 className="w-5 h-5 text-[#0066cc]" />
              <h2 className="text-[16px] font-semibold text-[#1d1d1f] tracking-tight">Consultation Completed</h2>
            </div>
            <p className="text-[13px] text-[#86868b] mb-5">
              Completed on {appointment.completedAt ? new Date(appointment.completedAt).toLocaleString() : (appointment as any).updatedAt ? new Date((appointment as any).updatedAt).toLocaleString() : appointment.appointmentDate}.
            </p>

            {clinicalNotes && (
              <div className="mb-6 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]">
                <span className="text-xs font-medium text-[#86868b] block mb-1.5">
                  Consultation Notes
                </span>
                <p className="text-[14px] text-[#1d1d1f] whitespace-pre-wrap break-words leading-relaxed">
                  {clinicalNotes}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate('/doctor/dashboard')}
              className="w-full sm:w-auto h-10 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-semibold transition-all duration-150 flex items-center justify-center cursor-pointer"
            >
              Return to Live Queue
            </button>
          </UtilityCard>
        ) : isCancelled ? (
          <UtilityCard className="p-6 text-center">
            <h2 className="text-[16px] font-semibold text-[#1d1d1f] tracking-tight">Appointment Cancelled</h2>
            <p className="text-[13px] text-[#86868b] mt-1 mb-5">
              This appointment is cancelled or rejected and cannot be modified.
            </p>
            <button
              type="button"
              onClick={() => navigate('/doctor/dashboard')}
              className="w-full sm:w-auto h-10 px-6 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium transition-all inline-flex items-center justify-center cursor-pointer"
            >
              Return to Live Queue
            </button>
          </UtilityCard>
        ) : isPendingApproval ? (
          <UtilityCard className="p-6 text-center">
            <h2 className="text-[16px] font-semibold text-[#1d1d1f] tracking-tight">Appointment Pending Approval</h2>
            <p className="text-[13px] text-[#86868b] mt-1 mb-5">
              This appointment request is pending front desk approval before it can enter the active queue.
            </p>
            <button
              type="button"
              onClick={() => navigate('/doctor/dashboard')}
              className="w-full sm:w-auto h-10 px-6 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium transition-all inline-flex items-center justify-center cursor-pointer"
            >
              Return to Live Queue
            </button>
          </UtilityCard>
        ) : isWaiting ? (
          <UtilityCard className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-[#86868b]" />
              <h2 className="text-[16px] font-semibold text-[#1d1d1f] tracking-tight">Patient in Waiting Queue</h2>
            </div>
            <p className="text-[13px] text-[#86868b] mb-5">
              Token #{appointment.queueNumber} is currently waiting. Call the patient into the cabin when you are ready to begin consultation.
            </p>
            {appointment.isCheckedIn ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/doctor/dashboard')}
                  className="w-full sm:w-auto h-10 px-5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium transition-all cursor-pointer"
                >
                  Return to Live Queue
                </button>
                <button
                  type="button"
                  disabled={callingPatient}
                  onClick={handleCallPatient}
                  className="w-full sm:w-auto h-10 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <UserCheck className="w-4 h-4 text-white" />
                  <span>{callingPatient ? 'Calling...' : 'Call into Cabin'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-medium inline-block text-left">
                  Patient has not arrived at the clinic yet. Arrival check-in is required before beginning consultation.
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => navigate('/doctor/dashboard')}
                    className="w-full sm:w-auto h-10 px-6 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium transition-all inline-flex items-center justify-center cursor-pointer"
                  >
                    Return to Live Queue
                  </button>
                </div>
              </div>
            )}
          </UtilityCard>
        ) : (
          <form onSubmit={handleCompleteConsultation} className="space-y-6">
            <UtilityCard className="p-6">
              <div className="flex items-center justify-between gap-2 mb-3">
                <label className="text-xs font-medium text-[#1d1d1f] tracking-tight">
                  Consultation Notes <span className="text-[#86868b] font-normal">(Optional)</span>
                </label>
                <button
                  type="button"
                  disabled={savingNotes}
                  onClick={handleSaveNotesDraft}
                  className="inline-flex items-center gap-1.5 text-xs text-[#0066cc] hover:text-[#0071e3] font-medium py-1 px-2.5 rounded-full bg-[#0066cc]/10 hover:bg-[#0066cc]/15 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingNotes ? 'Saving...' : 'Save Draft'}</span>
                </button>
              </div>

              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={4}
                placeholder="Add clinical observations, findings, or follow-up notes..."
                className="w-full rounded-xl border border-[#d2d2d7] bg-white p-3.5 text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 resize-y"
              />

              <div className="mt-5 pt-4 border-t border-[#e5e5ea] flex flex-col sm:flex-row items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate('/doctor/dashboard')}
                  className="w-full sm:w-auto h-10 px-5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium transition-all cursor-pointer"
                >
                  Back to Queue
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto h-10 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-semibold transition-all duration-150 shadow-[0_2px_8px_rgba(0,102,204,0.2)] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>{submitting ? 'Completing...' : 'Complete Consultation'}</span>
                </button>
              </div>
            </UtilityCard>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
};


