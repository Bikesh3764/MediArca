import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Appointment } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SubNav } from '../../components/layout/SubNav';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  Heart,
  ChevronLeft,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Save,
  Check,
  Stethoscope,
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

  // Vitals State
  const [bp, setBp] = useState('');
  const [pulse, setPulse] = useState('');
  const [temp, setTemp] = useState('');
  const [weight, setWeight] = useState('');

  // Clinical Notes & Diagnosis
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [advice, setAdvice] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

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
          if (found.vitals) {
            try {
              const parsed = JSON.parse(found.vitals);
              if (parsed.bp) setBp(parsed.bp);
              if (parsed.pulse) setPulse(parsed.pulse);
              if (parsed.temp) setTemp(parsed.temp);
              if (parsed.weight) setWeight(parsed.weight);
            } catch {}
          }
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

    const vitalsObj = {
      bp: bp.trim() || undefined,
      pulse: pulse.trim() || undefined,
      temp: temp.trim() || undefined,
      weight: weight.trim() || undefined,
    };

    const combinedNotes = [
      diagnosis.trim() ? `Diagnosis: ${diagnosis.trim()}` : '',
      clinicalNotes.trim(),
      advice.trim() ? `Advice: ${advice.trim()}` : '',
      followUpDate ? `Follow-up Date: ${followUpDate}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      await api.updateNotes({
        appointmentId: appointment.id,
        clinicalNotes: combinedNotes,
        vitals: vitalsObj,
      });

      setDraftSavedMsg('Consultation notes & vitals saved as draft.');
      setTimeout(() => setDraftSavedMsg(null), 4000);
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

    const vitalsObj = {
      bp: bp.trim() || undefined,
      pulse: pulse.trim() || undefined,
      temp: temp.trim() || undefined,
      weight: weight.trim() || undefined,
    };

    try {
      await api.completeConsultation({
        appointmentId: appointment.id,
        diagnosis: diagnosis.trim() || 'General Medical Consultation',
        advice: advice.trim() || undefined,
        followUpDate: followUpDate || undefined,
        clinicalNotes: clinicalNotes.trim() || undefined,
        vitals: vitalsObj,
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

const calculatePreciseAge = (dobString: string): number => {
  if (!dobString) return 0;
  const birth = new Date(dobString);
  if (isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
};

  const patientUser = appointment.patient?.user;
  const isForOther = Boolean(appointment.isForOther);
  const actualPatientName = appointment.patientName?.trim() || patientUser?.fullName || 'Walk-in Patient';
  const patientAgeDisplay = appointment.patientAge
    ? (appointment.patientAge.toLowerCase().includes('yr') ? appointment.patientAge : `${appointment.patientAge} yrs`)
    : (appointment.patient?.dateOfBirth ? `${calculatePreciseAge(appointment.patient.dateOfBirth)} yrs` : undefined);
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
            Queue
          </AppleButton>
          <AppleButton variant="ghost" size="sm" onClick={handleSaveDraft} disabled={savingDraft} className="flex items-center gap-1">
            <Save className="w-3.5 h-3.5 text-[#0088e8]" />
            <span>{savingDraft ? 'Saving...' : 'Save Draft'}</span>
          </AppleButton>
        </div>
      </SubNav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8">
        {draftSavedMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 shadow-sm">
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

        <form onSubmit={handleComplete} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Patient Profile & Vitals */}
          <div className="lg:col-span-1 space-y-6">
            <UtilityCard>
              <div className="flex items-center gap-3 pb-4 border-b border-[#f0f0f0]">
                <div className="w-12 h-12 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center font-bold text-lg text-[#0088e8] flex-shrink-0">
                  {actualPatientName[0] || 'P'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-semibold text-[17px] text-[#1d1d1f] truncate">{actualPatientName}</h3>
                    {isForOther && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#0088e8] border border-blue-200">
                        Family / Dependent
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#86868b] truncate">
                    {patientAgeDisplay ? `${patientAgeDisplay} • ` : ''}{patientGenderDisplay}
                  </p>
                  {isForOther && (
                    <p className="text-[11px] text-[#86868b] mt-0.5">
                      Booked by: <span className="font-medium text-[#1d1d1f]">{patientUser?.fullName}</span> ({patientUser?.phone || patientUser?.email})
                    </p>
                  )}
                  {!isForOther && (
                    <p className="text-xs text-[#86868b] truncate">{patientUser?.email}</p>
                  )}
                </div>
              </div>

              <div className="py-4 border-b border-[#f0f0f0] text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#86868b]">Queue Token:</span>
                  <strong className="text-[#0088e8] font-bold">Queue #{appointment.queueNumber}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#86868b]">Blood Group:</span>
                  <span className="font-medium text-[#1d1d1f]">{appointment.patient?.bloodGroup || 'Not specified'}</span>
                </div>
              </div>

              <div className="pt-4 text-xs">
                <span className="text-[#86868b] uppercase font-semibold block mb-1">Reason for Visit:</span>
                <p className="font-medium text-[#1d1d1f]">{appointment.reasonForVisit || 'General Consultation'}</p>
                {appointment.symptoms && (
                  <p className="mt-2 text-[#86868b]">
                    <strong>Symptoms: </strong> {appointment.symptoms}
                  </p>
                )}
              </div>
            </UtilityCard>

            {/* Patient Clinical History & Known Allergies (BUG-22) */}
            <UtilityCard>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f]">
                  Clinical History & Allergies
                </h4>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[#86868b] block text-[11px] font-medium mb-1">Known Allergies</span>
                  {appointment.patient?.allergies ? (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-medium">
                      ⚠️ {appointment.patient.allergies}
                    </div>
                  ) : (
                    <span className="text-[#86868b] italic">No known drug allergies reported</span>
                  )}
                </div>

                <div>
                  <span className="text-[#86868b] block text-[11px] font-medium mb-1">Existing Conditions / Chronic Illness</span>
                  {appointment.patient?.existingConditions ? (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-medium">
                      {appointment.patient.existingConditions}
                    </div>
                  ) : (
                    <span className="text-[#86868b] italic">No chronic conditions recorded</span>
                  )}
                </div>

                <div>
                  <span className="text-[#86868b] block text-[11px] font-medium mb-1">Current Active Medications</span>
                  {appointment.patient?.currentMedications ? (
                    <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 font-medium">
                      💊 {appointment.patient.currentMedications}
                    </div>
                  ) : (
                    <span className="text-[#86868b] italic">No active medications recorded</span>
                  )}
                </div>

                {appointment.patient?.emergencyContact && (
                  <div className="pt-2 border-t border-[#f0f0f0] flex justify-between">
                    <span className="text-[#86868b]">Emergency Contact:</span>
                    <span className="font-medium text-[#1d1d1f]">{appointment.patient.emergencyContact}</span>
                  </div>
                )}
              </div>
            </UtilityCard>

            {/* Vitals Recording Widget */}
            <UtilityCard>
              <div className="flex items-center gap-2 mb-4">
                <Heart className="w-4 h-4 text-rose-500" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f]">
                  Patient Vitals (Optional)
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[#86868b] mb-1">Blood Pressure</label>
                  <input
                    type="text"
                    value={bp}
                    onChange={(e) => setBp(e.target.value)}
                    placeholder="120/80 mmHg"
                    className="w-full h-9 px-3 rounded-xl border border-[#e5e5ea] bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[#86868b] mb-1">Pulse Rate</label>
                  <input
                    type="text"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    placeholder="72 bpm"
                    className="w-full h-9 px-3 rounded-xl border border-[#e5e5ea] bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[#86868b] mb-1">Temperature</label>
                  <input
                    type="text"
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                    placeholder="98.6 °F"
                    className="w-full h-9 px-3 rounded-xl border border-[#e5e5ea] bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[#86868b] mb-1">Weight</label>
                  <input
                    type="text"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="70 kg"
                    className="w-full h-9 px-3 rounded-xl border border-[#e5e5ea] bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] transition-all"
                  />
                </div>
              </div>
            </UtilityCard>

            {/* Patient Clinical History & Allergies Card (BUG-22) */}
            <UtilityCard>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#f0f0f0]">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f]">
                  Clinical History & Known Allergies
                </h4>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[#86868b] block mb-1">Known Allergies</span>
                  {appointment.patient?.allergies ? (
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 font-medium">
                      ⚠️ {appointment.patient.allergies}
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      No known allergies recorded
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[#86868b] block mb-0.5">Existing Conditions</span>
                  <p className="font-medium text-[#1d1d1f]">
                    {appointment.patient?.existingConditions || 'None reported'}
                  </p>
                </div>

                <div>
                  <span className="text-[#86868b] block mb-0.5">Current Medications</span>
                  <p className="font-medium text-[#1d1d1f]">
                    {appointment.patient?.currentMedications || 'None reported'}
                  </p>
                </div>

                {appointment.patient?.emergencyContact && (
                  <div className="pt-2 border-t border-[#f0f0f0]">
                    <span className="text-[#86868b] block mb-0.5">Emergency Contact</span>
                    <p className="font-medium text-[#1d1d1f]">
                      {appointment.patient.emergencyContact}
                    </p>
                  </div>
                )}
              </div>
            </UtilityCard>
          </div>

          {/* Right Column: Diagnosis, Clinical Notes, Advice, Follow-Up */}
          <div className="lg:col-span-2 space-y-6">
            <UtilityCard>
              <div className="flex items-center gap-2 mb-4">
                <Stethoscope className="w-5 h-5 text-[#0088e8]" />
                <h3 className="text-lg font-semibold text-[#1d1d1f] tracking-tight">
                  Clinical Diagnosis & Observations
                </h3>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-[#1d1d1f]">
                      Primary Clinical Diagnosis
                    </label>
                    <span className="text-[11px] text-[#86868b]">Quick suggestions:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {[
                      'Acute Upper Respiratory Infection',
                      'Essential Hypertension',
                      'Acute Bronchitis',
                      'Type 2 Diabetes Review',
                      'Gastroenteritis',
                      'Viral Fever',
                    ].map((diag) => (
                      <button
                        key={diag}
                        type="button"
                        onClick={() => setDiagnosis(diag)}
                        className={`px-3 py-1 rounded-full text-[11px] transition-colors ${
                          diagnosis === diag
                            ? 'bg-[#0088e8] text-white font-medium shadow-2xs'
                            : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]'
                        }`}
                      >
                        {diag}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="e.g. Acute Bronchitis, Essential Hypertension"
                    className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    Clinical Examination Remarks & Findings
                  </label>
                  <textarea
                    rows={4}
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="Enter physical observations, clinical examination notes, and doctor remarks..."
                    className="w-full p-3 rounded-xl border border-[#e5e5ea] text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] transition-all"
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                      Advice / Clinical Precautions
                    </label>
                    <input
                      type="text"
                      value={advice}
                      onChange={(e) => setAdvice(e.target.value)}
                      placeholder="e.g. Bed rest, warm fluids, hydration"
                      className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                      Next Follow-Up Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                    />
                  </div>
                </div>
              </div>
            </UtilityCard>

            {/* Bottom Actions Card */}
            <UtilityCard>
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                <AppleButton
                  variant="ghost"
                  size="md"
                  type="button"
                  disabled={savingDraft}
                  onClick={handleSaveDraft}
                  className="flex items-center gap-1.5 w-full sm:w-auto justify-center"
                >
                  <Save className="w-4 h-4 text-[#0088e8]" />
                  <span>{savingDraft ? 'Saving Draft...' : 'Save Draft'}</span>
                </AppleButton>

                <AppleButton
                  variant="primary"
                  size="lg"
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Finalizing...'
                      : appointment.status === 'COMPLETED'
                      ? 'Update Consultation'
                      : 'Complete Consultation'}
                  </span>
                </AppleButton>
              </div>
            </UtilityCard>
          </div>
        </form>
      </div>
    </div>
  );
};
