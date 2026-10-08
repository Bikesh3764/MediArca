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
        <div className="w-8 h-8 border-2 border-[#0066cc] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !appointment) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] p-6 flex items-center justify-center">
        <div className="apple-card p-6 sm:p-8 max-w-md w-full text-center">
          <div className="w-11 h-11 rounded-[14px] bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h2 className="text-section-title text-[#1d1d1f]">Unable to Load Encounter</h2>
          <p className="text-secondary mt-1 mb-5">{error}</p>
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
      <SubNav title="Consultation Desk" subtitle={`Token #${appointment.queueNumber}`} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {/* Navigation Breadcrumb */}
        <button
          type="button"
          onClick={() => navigate('/doctor/dashboard')}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6e6e73] hover:text-[#1d1d1f] mb-5 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Doctor Dashboard</span>
        </button>

        {/* Status Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-[16px] bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] text-[13px] flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#dc2626]" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-[16px] bg-[#f0fdf4] border border-[#bbf7d0] text-[#15803d] text-[13px] flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#15803d]" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        {/* Encounter Header Card */}
        <UtilityCard className="mb-6 p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#e5e5ea]">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    isCompleted
                      ? 'bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]'
                      : isCancelled
                      ? 'bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]'
                      : 'bg-[#0066cc]/10 text-[#0066cc] border-[#0066cc]/20'
                  }`}
                >
                  {appointment.status.replace('_', ' ')}
                </span>
                <span className="text-meta">
                  Queue Token #{appointment.queueNumber}
                </span>
              </div>
              <h1 className="text-page-title text-[#1d1d1f]">
                {patientName}
              </h1>
              {appointment.isForOther && appointment.patient?.user?.fullName && (
                <p className="text-meta mt-0.5">
                  Booked for family member by {appointment.patient.user.fullName}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <div className="px-4 py-2 rounded-[14px] bg-[#f5f5f7] border border-[#e5e5ea] text-center">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73] block">
                  Token
                </span>
                <span className="text-xl font-bold text-[#1d1d1f] tabular-nums">
                  #{appointment.queueNumber}
                </span>
              </div>
            </div>
          </div>

          {/* Patient & Booking Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
            <div className="space-y-1">
              <span className="text-meta flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#86868b]" />
                Demographics
              </span>
              <p className="text-[13px] font-semibold text-[#1d1d1f]">
                {appointment.patientAge ? `${appointment.patientAge} Yrs` : 'Age N/A'}
                {appointment.patientGender ? ` • ${appointment.patientGender}` : ''}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-meta flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#86868b]" />
                Phone
              </span>
              <p className="text-[13px] font-semibold text-[#1d1d1f]">
                {appointment.patient?.user?.phone || 'Not provided'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-meta flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#86868b]" />
                Date &amp; Shift
              </span>
              <p className="text-[13px] font-semibold text-[#1d1d1f]">
                {appointment.appointmentDate}
              </p>
              <p className="text-meta">
                {appointment.checkingWindow || appointment.estimatedTime || 'Standard'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-meta flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#86868b]" />
                Clinic Venue
              </span>
              <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">
                {appointment.clinic?.clinicName || 'Direct Facility'}
              </p>
            </div>
          </div>

          {/* Reason for Visit & Symptoms */}
          {(appointment.reasonForVisit || appointment.symptoms) && (
            <div className="mt-5 p-4 rounded-[14px] bg-[#f5f5f7]/70 border border-[#e5e5ea] space-y-2 text-[13px]">
              {appointment.reasonForVisit && (
                <div>
                  <span className="font-semibold text-[#1d1d1f]">Reason for Visit: </span>
                  <span className="text-[#6e6e73]">{appointment.reasonForVisit}</span>
                </div>
              )}
              {appointment.symptoms && (
                <div>
                  <span className="font-semibold text-[#1d1d1f]">Reported Symptoms: </span>
                  <span className="text-[#6e6e73]">{appointment.symptoms}</span>
                </div>
              )}
            </div>
          )}
        </UtilityCard>

        {/* Consultation Completion Form / View */}
        {isCompleted ? (
          <UtilityCard className="p-6 sm:p-7">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-[10px] bg-[#f0fdf4] border border-[#bbf7d0] text-[#15803d] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h2 className="text-section-title text-[#1d1d1f]">Consultation Completed</h2>
            </div>
            <p className="text-secondary mb-5">
              This clinical encounter was finalized on{' '}
              {appointment.completedAt
                ? new Date(appointment.completedAt).toLocaleString()
                : (appointment as any).updatedAt
                ? new Date((appointment as any).updatedAt).toLocaleString()
                : appointment.appointmentDate}
              .
            </p>

            {clinicalNotes && (
              <div className="mb-6 p-4 rounded-[14px] bg-[#f5f5f7]/70 border border-[#e5e5ea]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] block mb-1.5">
                  Doctor's Notes
                </span>
                <p className="text-[13px] text-[#1d1d1f] whitespace-pre-wrap leading-relaxed">
                  {clinicalNotes}
                </p>
              </div>
            )}

            <AppleButton
              variant="primary"
              size="md"
              onClick={() => navigate('/doctor/dashboard')}
              className="w-full"
            >
              Return to Dashboard
            </AppleButton>
          </UtilityCard>
        ) : isCancelled ? (
          <UtilityCard className="p-6 sm:p-8 text-center">
            <div className="w-11 h-11 rounded-[14px] bg-[#f5f5f7] border border-[#e5e5ea] text-[#6e6e73] flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h2 className="text-section-title text-[#1d1d1f]">Appointment Cancelled</h2>
            <p className="text-secondary mt-1 mb-5">
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
            <UtilityCard className="p-6 sm:p-7">
              <div className="flex items-center gap-2 mb-1.5">
                <FileText className="w-4 h-4 text-[#0066cc]" />
                <h2 className="text-card-title text-[#1d1d1f]">
                  Doctor's Observations &amp; Notes{' '}
                  <span className="text-[#86868b] font-normal text-[13px]">(Optional)</span>
                </h2>
              </div>
              <p className="text-secondary mb-4">
                Add any optional clinical remarks, findings, or follow-up recommendations for your reference.
              </p>

              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={4}
                placeholder="Enter clinical observations, advice, or patient notes..."
                className="ui-textarea"
              />

              <div className="flex justify-end mt-3">
                <AppleButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={savingNotes}
                  onClick={handleSaveNotesDraft}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingNotes ? 'Saving...' : 'Save Notes Draft'}</span>
                </AppleButton>
              </div>
            </UtilityCard>

            {/* Action Bar */}
            <div className="apple-card p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <AppleButton
                variant="secondary"
                size="md"
                type="button"
                onClick={() => navigate('/doctor/dashboard')}
                className="w-full sm:w-auto"
              >
                Back to Dashboard
              </AppleButton>

              <AppleButton
                variant="primary"
                size="lg"
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Completing...' : 'Mark Consultation Completed'}</span>
              </AppleButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
