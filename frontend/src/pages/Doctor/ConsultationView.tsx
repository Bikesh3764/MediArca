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
  Plus,
  Trash2,
  Pill,
} from 'lucide-react';

export interface MedicineItem {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

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

  // Prescription Medicines State
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFrequency, setMedFrequency] = useState('1-0-1');
  const [medDuration, setMedDuration] = useState('5 days');
  const [medInstructions, setMedInstructions] = useState('After meals');

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
            let raw = found.clinicalNotes;
            const diagMatch = raw.match(/^Diagnosis:\s*([^\n]+)/m);
            if (diagMatch) {
              setDiagnosis(diagMatch[1].trim());
              raw = raw.replace(diagMatch[0], '');
            }

            const adviceMatch = raw.match(/^Advice:\s*([^\n]+)/m);
            if (adviceMatch) {
              setAdvice(adviceMatch[1].trim());
              raw = raw.replace(adviceMatch[0], '');
            }

            const followMatch = raw.match(/^Follow-up Date:\s*([^\n]+)/m);
            if (followMatch) {
              setFollowUpDate(followMatch[1].trim());
              raw = raw.replace(followMatch[0], '');
            }

            const medsMatch = raw.match(/Prescribed Medications:\s*\n((?:\s*\d+\..*(?:\n|$))*)/);
            if (medsMatch) {
              const medBlock = medsMatch[1];
              raw = raw.replace(medsMatch[0], '');
              const lines = medBlock.split('\n').map((l) => l.trim()).filter(Boolean);
              const parsedMeds: MedicineItem[] = lines.map((line, idx) => {
                const cleanLine = line.replace(/^\d+\.\s*/, '').trim();
                let name = cleanLine;
                let dosage = '1 Tab';
                let frequency = '1-0-1';
                let duration = '5 days';
                let instructions = '';

                const instMatch = name.match(/\[(.*?)\]/);
                if (instMatch) {
                  instructions = instMatch[1];
                  name = name.replace(instMatch[0], '').trim();
                }
                const durMatch = name.match(/for\s+(.*?)(?=\s*\(|$)/i);
                if (durMatch) {
                  duration = durMatch[1].trim();
                  name = name.replace(durMatch[0], '').trim();
                }
                const freqMatch = name.match(/\((.*?)\)/);
                if (freqMatch) {
                  frequency = freqMatch[1].trim();
                  name = name.replace(freqMatch[0], '').trim();
                }
                const dosageMatch = name.match(/-\s*(.*?)$/);
                if (dosageMatch) {
                  dosage = dosageMatch[1].trim();
                  name = name.replace(/-\s*.*?$/, '').trim();
                }

                return {
                  id: `med_parsed_${idx}_${Date.now()}`,
                  name: name || cleanLine,
                  dosage,
                  frequency,
                  duration,
                  instructions,
                };
              });
              if (parsedMeds.length > 0) {
                setMedicines(parsedMeds);
              }
            }

            setClinicalNotes(raw.trim());
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
          if ((found as any).prescription?.items) {
            setMedicines(
              (found as any).prescription.items.map((item: any) => ({
                id: item.id || `med_${Math.random().toString(36).substring(2, 7)}`,
                name: item.medicineName || item.name || '',
                dosage: item.dosage || '',
                frequency: item.frequency || '',
                duration: item.duration || '',
                instructions: item.instructions || '',
              }))
            );
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

  const handleAddMedicine = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!medName.trim()) return;
    setMedicines((prev) => [
      ...prev,
      {
        id: `med_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: medName.trim(),
        dosage: medDosage.trim() || '1 Tab',
        frequency: medFrequency.trim() || '1-0-1',
        duration: medDuration.trim() || '5 days',
        instructions: medInstructions.trim(),
      },
    ]);
    setMedName('');
    setMedDosage('');
  };

  const handleRemoveMedicine = (idToRemove: string) => {
    setMedicines((prev) => prev.filter((m) => m.id !== idToRemove));
  };

  const handleSaveDraft = async () => {
    if (!appointment || appointment.status === 'COMPLETED') return;
    setSavingDraft(true);
    setDraftSavedMsg(null);
    setError(null);

    const vitalsObj = {
      bp: bp.trim() || undefined,
      pulse: pulse.trim() || undefined,
      temp: temp.trim() || undefined,
      weight: weight.trim() || undefined,
    };

    try {
      await api.updateNotes({
        appointmentId: appointment.id,
        clinicalNotes: clinicalNotes.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
        advice: advice.trim() || undefined,
        followUpDate: followUpDate || undefined,
        vitals: vitalsObj,
        medicines: medicines.filter((m) => m.name.trim()).map((m) => ({
          name: m.name.trim(),
          dosage: m.dosage.trim(),
          frequency: m.frequency.trim(),
          duration: m.duration.trim(),
          instructions: m.instructions.trim(),
        })),
      });

      setDraftSavedMsg('Consultation notes, medicines & vitals saved as draft.');
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
        medicines: medicines.filter((m) => m.name.trim()).map((m) => ({
          name: m.name.trim(),
          dosage: m.dosage.trim(),
          frequency: m.frequency.trim(),
          duration: m.duration.trim(),
          instructions: m.instructions.trim(),
        })),
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
          {appointment.status !== 'COMPLETED' && (
            <AppleButton variant="ghost" size="sm" onClick={handleSaveDraft} disabled={savingDraft} className="flex items-center gap-1">
              <Save className="w-3.5 h-3.5 text-[#0088e8]" />
              <span>{savingDraft ? 'Saving...' : 'Save Draft'}</span>
            </AppleButton>
          )}
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
                    disabled={appointment.status === 'COMPLETED'}
                    value={bp}
                    onChange={(e) => setBp(e.target.value)}
                    placeholder="120/80 mmHg"
                    className="w-full h-9 px-3 rounded-xl border border-[#e5e5ea] bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] transition-all disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
                  />
                </div>
                <div>
                  <label className="block text-[#86868b] mb-1">Pulse Rate</label>
                  <input
                    type="text"
                    disabled={appointment.status === 'COMPLETED'}
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    placeholder="72 bpm"
                    className="w-full h-9 px-3 rounded-xl border border-[#e5e5ea] bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] transition-all disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
                  />
                </div>
                <div>
                  <label className="block text-[#86868b] mb-1">Temperature</label>
                  <input
                    type="text"
                    disabled={appointment.status === 'COMPLETED'}
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                    placeholder="98.6 °F"
                    className="w-full h-9 px-3 rounded-xl border border-[#e5e5ea] bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] transition-all disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
                  />
                </div>
                <div>
                  <label className="block text-[#86868b] mb-1">Weight</label>
                  <input
                    type="text"
                    disabled={appointment.status === 'COMPLETED'}
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="70 kg"
                    className="w-full h-9 px-3 rounded-xl border border-[#e5e5ea] bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] transition-all disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
                  />
                </div>
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
                        disabled={appointment.status === 'COMPLETED'}
                        onClick={() => setDiagnosis(diag)}
                        className={`px-3 py-1 rounded-full text-[11px] transition-colors ${
                          diagnosis === diag
                            ? 'bg-[#0088e8] text-white font-medium shadow-2xs'
                            : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]'
                        } ${appointment.status === 'COMPLETED' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {diag}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    disabled={appointment.status === 'COMPLETED'}
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="e.g. Acute Bronchitis, Essential Hypertension"
                    className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] transition-all disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    Clinical Examination Remarks & Findings
                  </label>
                  <textarea
                    rows={4}
                    disabled={appointment.status === 'COMPLETED'}
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="Enter physical observations, clinical examination notes, and doctor remarks..."
                    className="w-full p-3 rounded-xl border border-[#e5e5ea] text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] transition-all disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                      Advice / Clinical Precautions
                    </label>
                    <input
                      type="text"
                      disabled={appointment.status === 'COMPLETED'}
                      value={advice}
                      onChange={(e) => setAdvice(e.target.value)}
                      placeholder="e.g. Bed rest, warm fluids, hydration"
                      className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                      Next Follow-Up Date (Optional)
                    </label>
                    <input
                      type="date"
                      disabled={appointment.status === 'COMPLETED'}
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
                    />
                  </div>
                </div>
              </div>
            </UtilityCard>

            {/* Prescription & Medications Builder Card (Rx) */}
            <UtilityCard>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#f0f0f0]">
                <div className="flex items-center gap-2">
                  <Pill className="w-5 h-5 text-[#0088e8]" />
                  <h3 className="text-base font-semibold text-[#1d1d1f] tracking-tight">
                    Prescription & Medications (Rx)
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-[#0088e8] bg-[#0088e8]/10 px-2.5 py-0.5 rounded-full">
                  {medicines.length} Medication{medicines.length === 1 ? '' : 's'} Added
                </span>
              </div>

              {appointment.status !== 'COMPLETED' && (
                <div className="p-3.5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] mb-4 space-y-3">
                  <span className="text-[11px] font-semibold text-[#1d1d1f] uppercase tracking-wider block">
                    Add Medicine / Rx Item
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                    <div className="sm:col-span-2 lg:col-span-1">
                      <label className="block text-[#86868b] mb-1 font-medium">Medicine Name & Strength</label>
                      <input
                        type="text"
                        value={medName}
                        onChange={(e) => setMedName(e.target.value)}
                        placeholder="e.g. Paracetamol 650mg"
                        className="w-full h-9 px-3 rounded-xl border border-[#e5e5ea] bg-white text-xs text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#0088e8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[#86868b] mb-1 font-medium">Dosage</label>
                      <input
                        type="text"
                        value={medDosage}
                        onChange={(e) => setMedDosage(e.target.value)}
                        placeholder="e.g. 1 Tablet / 5ml"
                        className="w-full h-9 px-3 rounded-xl border border-[#e5e5ea] bg-white text-xs text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#0088e8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[#86868b] mb-1 font-medium">Frequency</label>
                      <select
                        value={medFrequency}
                        onChange={(e) => setMedFrequency(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-[#e5e5ea] bg-white text-xs text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#0088e8]"
                      >
                        <option value="1-0-1">1-0-1 (Morning & Night)</option>
                        <option value="1-1-1">1-1-1 (TDS - Thrice daily)</option>
                        <option value="1-0-0">1-0-0 (Morning only)</option>
                        <option value="0-0-1">0-0-1 (Night only)</option>
                        <option value="0-1-0">0-1-0 (Afternoon only)</option>
                        <option value="SOS">SOS (As needed)</option>
                        <option value="Once daily">Once daily</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[#86868b] mb-1 font-medium">Duration</label>
                      <input
                        type="text"
                        value={medDuration}
                        onChange={(e) => setMedDuration(e.target.value)}
                        placeholder="e.g. 5 days, 1 week"
                        className="w-full h-9 px-3 rounded-xl border border-[#e5e5ea] bg-white text-xs text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#0088e8]"
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-1">
                      <label className="block text-[#86868b] mb-1 font-medium">Instructions / Timing</label>
                      <input
                        type="text"
                        value={medInstructions}
                        onChange={(e) => setMedInstructions(e.target.value)}
                        placeholder="e.g. After meals with water"
                        className="w-full h-9 px-3 rounded-xl border border-[#e5e5ea] bg-white text-xs text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#0088e8]"
                      />
                    </div>
                    <div className="flex items-end">
                      <AppleButton
                        variant="primary"
                        size="sm"
                        type="button"
                        onClick={handleAddMedicine}
                        disabled={!medName.trim()}
                        className="w-full h-9 flex items-center justify-center gap-1.5 text-xs font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Rx Item</span>
                      </AppleButton>
                    </div>
                  </div>
                </div>
              )}

              {medicines.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-[#e5e5ea] text-[#86868b] text-xs">
                  <Pill className="w-6 h-6 mx-auto mb-1 text-[#d2d2d7]" />
                  <p className="font-medium text-[#1d1d1f]">No prescription medications added</p>
                  <p className="mt-0.5 text-[11px]">Add medications above to generate a digital prescription slip for the patient.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#e5e5ea]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f5f5f7] border-b border-[#e5e5ea] text-[#86868b] font-medium">
                      <tr>
                        <th className="py-2.5 px-3">Medicine</th>
                        <th className="py-2.5 px-3">Dosage</th>
                        <th className="py-2.5 px-3">Frequency</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3">Instructions</th>
                        {appointment.status !== 'COMPLETED' && (
                          <th className="py-2.5 px-3 text-right">Action</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f5f5f7] bg-white">
                      {medicines.map((m) => (
                        <tr key={m.id} className="hover:bg-[#fafafc]">
                          <td className="py-2.5 px-3 font-semibold text-[#1d1d1f]">{m.name}</td>
                          <td className="py-2.5 px-3 text-[#1d1d1f]">{m.dosage}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-medium text-[11px] border border-blue-200">
                              {m.frequency}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[#1d1d1f]">{m.duration}</td>
                          <td className="py-2.5 px-3 text-[#86868b]">{m.instructions || '—'}</td>
                          {appointment.status !== 'COMPLETED' && (
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveMedicine(m.id)}
                                className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Remove medication"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </UtilityCard>

            {/* Bottom Actions Card */}
            {appointment.status === 'COMPLETED' ? (
              <UtilityCard className="bg-emerald-50/50 border-emerald-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-emerald-900">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold">Consultation Finalized & Completed</h4>
                      <p className="text-xs text-emerald-700">This clinical record is finalized. Digital prescription and consultation summary have been issued.</p>
                    </div>
                  </div>
                  <AppleButton
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => navigate('/doctor/dashboard')}
                  >
                    Back to Console
                  </AppleButton>
                </div>
              </UtilityCard>
            ) : (
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
                    <span>{submitting ? 'Finalizing...' : 'Complete Consultation'}</span>
                  </AppleButton>
                </div>
              </UtilityCard>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
