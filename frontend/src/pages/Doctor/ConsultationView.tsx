import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Appointment } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SubNav } from '../../components/layout/SubNav';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  User,
  Phone,
  Calendar,
  Building2,
  FileText,
  Save,
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

  // Clinical Notes (Optional observations / doctor remarks)
  const [clinicalNotes, setClinicalNotes] = useState('');

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
      <div className="min-h-screen bg-[#f5f5f7] p-8 flex items-center justify-center">
        <div className="bg-white rounded-[20px] p-6 max-w-md w-full border border-[#e5e5ea] text-center shadow-sm">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-[#1d1d1f]">Unable to Load Encounter</h2>
          <p className="text-xs text-[#86868b] mt-1 mb-4">{error}</p>
          <AppleButton variant="primary" size="md" onClick={() => navigate('/doctor/dashboard')} className="w-full">
            Return to Dashboard
          </AppleButton>
        </div>
      </div>
    );
  }

  if (!appointment) return null;

  const patientName = appointment.patientName || appointment.patient?.user?.fullName || 'Patient';
  const isCompleted = appointment.status === 'COMPLETED';
  const isCancelled = appointment.status === 'CANCELLED' || appointment.status === 'REJECTED';

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav title="Consultation Desk" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Navigation Breadcrumb */}
        <button
          type="button"
          onClick={() => navigate('/doctor/dashboard')}
          className="inline-flex items-center gap-1.5 text-xs text-[#86868b] hover:text-[#1d1d1f] mb-6 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Doctor Dashboard</span>
        </button>

        {/* Status Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#0066cc]" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Encounter Header Card */}
        <UtilityCard className="mb-6 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#e5e5ea]">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
                  {appointment.status.replace('_', ' ')}
                </span>
                <span className="text-xs font-semibold text-[#86868b]">
                  Token #{appointment.queueNumber}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-[#1d1d1f] tracking-tight">
                {patientName}
              </h1>
              {appointment.isForOther && appointment.patient?.user?.fullName && (
                <p className="text-xs text-[#86868b] mt-0.5">
                  Booked for family member by {appointment.patient.user.fullName}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-[#1d1d1f] bg-[#f5f5f7] px-4 py-2 rounded-2xl border border-[#e5e5ea]">
                #{appointment.queueNumber}
              </span>
            </div>
          </div>

          {/* Patient & Booking Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-xs">
            <div className="space-y-0.5">
              <span className="text-[#86868b] flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#86868b]" />
                Demographics
              </span>
              <p className="font-semibold text-[#1d1d1f]">
                {appointment.patientAge ? `${appointment.patientAge} Yrs` : 'Age N/A'}
                {appointment.patientGender ? ` • ${appointment.patientGender}` : ''}
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[#86868b] flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#86868b]" />
                Phone
              </span>
              <p className="font-semibold text-[#1d1d1f]">
                {appointment.patient?.user?.phone || 'Not provided'}
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[#86868b] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#86868b]" />
                Date & Shift
              </span>
              <p className="font-semibold text-[#1d1d1f]">
                {appointment.appointmentDate}
              </p>
              <p className="text-[11px] text-[#86868b]">
                {appointment.checkingWindow || appointment.estimatedTime || 'Standard'}
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[#86868b] flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-[#86868b]" />
                Clinic Venue
              </span>
              <p className="font-semibold text-[#1d1d1f] truncate">
                {appointment.clinic?.clinicName || 'Direct Facility'}
              </p>
            </div>
          </div>

          {/* Reason for Visit & Symptoms */}
          {(appointment.reasonForVisit || appointment.symptoms) && (
            <div className="mt-6 p-4 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-2 text-xs">
              {appointment.reasonForVisit && (
                <div>
                  <span className="font-semibold text-[#1d1d1f]">Reason for Visit: </span>
                  <span className="text-[#48484a]">{appointment.reasonForVisit}</span>
                </div>
              )}
              {appointment.symptoms && (
                <div>
                  <span className="font-semibold text-[#1d1d1f]">Reported Symptoms: </span>
                  <span className="text-[#48484a]">{appointment.symptoms}</span>
                </div>
              )}
            </div>
          )}
        </UtilityCard>

        {/* Consultation Completion Form / View */}
        {isCompleted ? (
          <UtilityCard className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-[#0066cc]" />
              <h2 className="text-base font-semibold text-[#1d1d1f]">Consultation Completed</h2>
            </div>
            <p className="text-xs text-[#86868b] mb-4">
              This clinical encounter was finalized on {appointment.completedAt ? new Date(appointment.completedAt).toLocaleString() : appointment.appointmentDate}.
            </p>

            {clinicalNotes && (
              <div className="mb-6 p-4 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b] block mb-1">
                  Doctor's Notes
                </span>
                <p className="text-xs text-[#1d1d1f] whitespace-pre-wrap leading-relaxed">
                  {clinicalNotes}
                </p>
              </div>
            )}

            <AppleButton
              variant="primary"
              size="md"
              onClick={() => navigate('/doctor/dashboard')}
              className="w-full bg-[#1d1d1f] hover:bg-black text-white"
            >
              Return to Dashboard
            </AppleButton>
          </UtilityCard>
        ) : isCancelled ? (
          <UtilityCard className="p-6 text-center">
            <AlertCircle className="w-10 h-10 text-[#86868b] mx-auto mb-2" />
            <h2 className="text-base font-semibold text-[#1d1d1f]">Appointment Cancelled</h2>
            <p className="text-xs text-[#86868b] mt-1 mb-4">
              This appointment is cancelled or rejected and cannot be modified.
            </p>
            <AppleButton
              variant="secondary"
              size="md"
              onClick={() => navigate('/doctor/dashboard')}
              className="w-full"
            >
              Return to Dashboard
            </AppleButton>
          </UtilityCard>
        ) : (
          <form onSubmit={handleCompleteConsultation} className="space-y-6">
            {/* Optional Clinical Notes Card */}
            <UtilityCard className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-[#0066cc]" />
                <h2 className="text-sm font-semibold text-[#1d1d1f]">
                  Doctor's Observations & Notes <span className="text-[#86868b] font-normal">(Optional)</span>
                </h2>
              </div>
              <p className="text-xs text-[#86868b] mb-4">
                Add any optional clinical remarks, findings, or follow-up recommendations for your reference.
              </p>

              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={4}
                placeholder="Enter clinical observations, advice, or patient notes..."
                className="w-full rounded-xl border border-[#e5e5ea] bg-[#fafafc] p-3 text-xs text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] transition-all resize-y"
              />

              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  disabled={savingNotes}
                  onClick={handleSaveNotesDraft}
                  className="inline-flex items-center gap-1.5 text-xs text-[#0066cc] hover:text-[#0071e3] font-medium py-1 px-2 rounded-lg hover:bg-[#0066cc]/5 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingNotes ? 'Saving...' : 'Save Notes Draft'}</span>
                </button>
              </div>
            </UtilityCard>

            {/* Action Bar */}
            <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
              <AppleButton
                variant="ghost"
                size="md"
                type="button"
                onClick={() => navigate('/doctor/dashboard')}
                className="w-full sm:w-auto text-xs text-[#86868b] hover:text-[#1d1d1f]"
              >
                Back to Dashboard
              </AppleButton>

              <AppleButton
                variant="primary"
                size="lg"
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1d1d1f] hover:bg-black text-white font-semibold cursor-pointer shadow-none"
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>{submitting ? 'Completing...' : 'Mark Consultation Completed'}</span>
              </AppleButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
