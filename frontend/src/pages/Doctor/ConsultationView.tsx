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
  Save,
  Check,
  Calendar,
  Clock,
  Phone,
} from 'lucide-react';

export const ConsultationView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: loadingAuth } = useAuth();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedMsg, setDraftSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Clinical Notes & Remarks (Simple clean note for doctor)
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
          if (found.clinicalNotes) setClinicalNotes(found.clinicalNotes);
        }
      } catch (err: any) {
        console.error('Failed to load consultation appointment:', err);
        setError(err.message || 'Unable to retrieve appointment record');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointmentData();
  }, [id, user, loadingAuth, navigate]);

  const handleSaveDraft = async () => {
    if (!appointment) return;
    setSavingDraft(true);
    setDraftSavedMsg(null);
    setError(null);

    try {
      await api.updateNotes({
        appointmentId: appointment.id,
        clinicalNotes: clinicalNotes.trim(),
      });

      setDraftSavedMsg('Consultation notes saved as draft.');
      setTimeout(() => setDraftSavedMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save draft notes');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment) return;

    setSubmitting(true);
    setError(null);

    try {
      await api.completeConsultation({
        appointmentId: appointment.id,
        clinicalNotes: clinicalNotes.trim() || undefined,
      });

      navigate('/doctor/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to complete consultation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#0088e8] border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-[20px] border border-[#e5e5ea] max-w-md w-full shadow-sm">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-[#1d1d1f] mb-1">Appointment Not Found</h2>
          <p className="text-xs text-[#86868b] mb-4">
            The requested consultation record could not be found or does not belong to your account.
          </p>
          <AppleButton variant="primary" onClick={() => navigate('/doctor/dashboard')} className="w-full">
            Return to Doctor Console
          </AppleButton>
        </div>
      </div>
    );
  }

  const patientUser = appointment.patient?.user;
  const isForOther = Boolean(appointment.isForOther);
  const actualPatientName = appointment.patientName?.trim() || patientUser?.fullName || 'Walk-in Patient';
  const patientAgeDisplay = appointment.patientAge
    ? (appointment.patientAge.toLowerCase().includes('yr') ? appointment.patientAge : `${appointment.patientAge} yrs`)
    : (appointment.patient?.dateOfBirth ? `${new Date().getFullYear() - new Date(appointment.patient.dateOfBirth).getFullYear()} yrs` : undefined);
  const patientGenderDisplay = appointment.patientGender || appointment.patient?.gender || 'Not specified';

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav
        title="Consultation Cabin"
        subtitle={`Queue #${appointment.queueNumber} • ${actualPatientName}${isForOther ? ` (Family • ${patientUser?.fullName})` : ''}`}
      >
        <div className="flex items-center gap-2">
          <AppleButton variant="ghost" size="sm" onClick={() => navigate('/doctor/dashboard')} className="flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" />
            <span>Return to Queue</span>
          </AppleButton>
          <AppleButton variant="ghost" size="sm" onClick={handleSaveDraft} disabled={savingDraft} className="flex items-center gap-1">
            <Save className="w-3.5 h-3.5 text-[#0088e8]" />
            <span>{savingDraft ? 'Saving...' : 'Save Draft'}</span>
          </AppleButton>
        </div>
      </SubNav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        {draftSavedMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 shadow-sm animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>{draftSavedMsg}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleComplete} className="space-y-6">
          {/* Patient Profile & Visit Details Card */}
          <UtilityCard>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#f0f0f0] gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-[#0088e8]/10 text-[#0088e8] font-bold text-xl flex items-center justify-center flex-shrink-0 border border-[#0088e8]/20">
                  {actualPatientName[0]?.toUpperCase() || 'P'}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg text-[#1d1d1f] tracking-tight">{actualPatientName}</h3>
                    {isForOther && (
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0088e8] border border-blue-200">
                        Family / Dependent
                      </span>
                    )}
                    <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active In Cabin
                    </span>
                  </div>
                  <p className="text-xs text-[#86868b] mt-0.5">
                    {patientAgeDisplay ? `${patientAgeDisplay} • ` : ''}{patientGenderDisplay}
                    {appointment.patient?.bloodGroup ? ` • Blood Group: ${appointment.patient.bloodGroup}` : ''}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right flex sm:flex-col items-center sm:items-end justify-between">
                <span className="text-xs text-[#86868b] uppercase font-semibold">Token Number</span>
                <span className="text-2xl font-bold text-[#0088e8] tracking-tight leading-none mt-0.5">
                  Queue #{appointment.queueNumber}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-b border-[#f0f0f0] text-xs">
              <div className="flex items-center gap-2 text-[#1d1d1f]">
                <Calendar className="w-4 h-4 text-[#86868b]" />
                <span>Date: <strong>{appointment.appointmentDate || 'Today'}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-[#1d1d1f]">
                <Clock className="w-4 h-4 text-[#86868b]" />
                <span>Time: <strong>{appointment.estimatedTime || 'Now'} ({appointment.checkingWindow || 'General Shift'})</strong></span>
              </div>
              {patientUser?.phone && (
                <div className="flex items-center gap-2 text-[#1d1d1f]">
                  <Phone className="w-4 h-4 text-[#86868b]" />
                  <span>Phone: <strong>{patientUser.phone}</strong></span>
                </div>
              )}
            </div>

            {isForOther && (
              <div className="py-3 border-b border-[#f0f0f0] text-xs text-[#86868b]">
                Booked by Account: <strong className="text-[#1d1d1f]">{patientUser?.fullName}</strong> ({patientUser?.email})
              </div>
            )}

            <div className="pt-4 text-xs">
              <span className="text-[#86868b] uppercase font-semibold block mb-1">Reason for Visit:</span>
              <p className="font-medium text-[#1d1d1f] text-sm">{appointment.reasonForVisit || 'General Consultation'}</p>
              {appointment.symptoms && (
                <p className="mt-2 text-[#86868b]">
                  <strong className="text-[#1d1d1f]">Symptoms Reported: </strong> {appointment.symptoms}
                </p>
              )}
            </div>
          </UtilityCard>

          {/* Doctor Consultation Remarks */}
          <UtilityCard>
            <h3 className="text-base font-semibold text-[#1d1d1f] mb-2 tracking-tight">
              Consultation Remarks & Notes (Optional)
            </h3>
            <p className="text-xs text-[#86868b] mb-4">
              Add any clinical observations or notes for your records.
            </p>

            <textarea
              rows={5}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Enter patient observations, clinical notes, or follow-up instructions..."
              className="w-full p-4 rounded-xl border border-[#e5e5ea] text-sm focus:outline-none focus:border-[#0088e8] bg-white transition-all"
            ></textarea>
          </UtilityCard>

          {/* Bottom Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <AppleButton
              variant="ghost"
              size="md"
              type="button"
              onClick={() => navigate('/doctor/dashboard')}
              className="w-full sm:w-auto"
            >
              Cancel & Return to Queue
            </AppleButton>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <AppleButton
                variant="ghost"
                size="md"
                type="button"
                disabled={savingDraft}
                onClick={handleSaveDraft}
                className="w-full sm:w-auto"
              >
                {savingDraft ? 'Saving Draft...' : 'Save Draft'}
              </AppleButton>

              <AppleButton
                variant="primary"
                size="lg"
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'Completing...'
                    : appointment.status === 'COMPLETED'
                    ? 'Update Consultation'
                    : 'Complete Consultation'}
                </span>
              </AppleButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
