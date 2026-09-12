import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Appointment, getFileUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SubNav } from '../../components/layout/SubNav';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  Heart,
  Plus,
  Trash2,
  ChevronLeft,
  AlertCircle,
  Eye,
  Printer,
  CheckCircle2,
  Save,
} from 'lucide-react';

interface MedicineRow {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

const calculateTotalDose = (frequency: string, duration: string) => {
  let perDay = 1;
  const f = (frequency || '').toLowerCase().trim();
  if (f.includes('four') || f.includes('4') || f.includes('qid') || f.includes('1-1-1-1')) perDay = 4;
  else if (f.includes('thrice') || f.includes('three') || f.includes('3') || f.includes('tid') || f.includes('1-1-1')) perDay = 3;
  else if (f.includes('twice') || f.includes('two') || f.includes('2') || f.includes('bid') || f.includes('1-0-1') || f.includes('1-0-0-1') || f.includes('0-1-1')) perDay = 2;
  else if (f.includes('once') || f.includes('one') || f.includes('1') || f.includes('od') || f.includes('qd') || f.includes('1-0-0') || f.includes('0-0-1') || f.includes('0-1-0') || f.includes('prn')) perDay = 1;

  let days = 5;
  const d = (duration || '').toLowerCase().trim();
  if (d.includes('month')) {
    const match = d.match(/\d+/);
    days = (match ? parseInt(match[0], 10) : 1) * 30;
  } else if (d.includes('week')) {
    const match = d.match(/\d+/);
    days = (match ? parseInt(match[0], 10) : 1) * 7;
  } else {
    const match = d.match(/\d+/);
    if (match) days = parseInt(match[0], 10);
  }

  const total = perDay * days;
  return { perDay, days, total };
};

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

  // Medicine Prescription Rows
  const [medicines, setMedicines] = useState<MedicineRow[]>([
    {
      name: '',
      dosage: '1 Tab',
      frequency: 'Twice daily after food',
      duration: '5 Days',
      instructions: 'Take with warm water',
    },
  ]);

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
          if (found.vitals) {
            try {
              const parsed = JSON.parse(found.vitals);
              if (parsed.bp) setBp(parsed.bp);
              if (parsed.pulse) setPulse(parsed.pulse);
              if (parsed.temp) setTemp(parsed.temp);
              if (parsed.weight) setWeight(parsed.weight);
            } catch {}
          }
          if (found.prescription) {
            setDiagnosis(found.prescription.diagnosis);
            setAdvice(found.prescription.advice || '');
            setFollowUpDate(found.prescription.followUpDate || '');
            try {
              setMedicines(JSON.parse(found.prescription.medicines));
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

  const handleAddMedicine = () => {
    setMedicines([
      ...medicines,
      {
        name: '',
        dosage: '1 Tab',
        frequency: 'Twice daily',
        duration: '5 Days',
        instructions: '',
      },
    ]);
  };

  const handleRemoveMedicine = (idx: number) => {
    setMedicines(medicines.filter((_, i) => i !== idx));
  };

  const handleMedicineChange = (idx: number, field: keyof MedicineRow, value: string) => {
    const updated = [...medicines];
    updated[idx][field] = value;
    setMedicines(updated);
  };

  const handleSaveDraft = async () => {
    if (!appointment) return;
    setSavingDraft(true);
    setError(null);
    setDraftSavedMsg(null);

    const vitalsObj = {
      bp: bp.trim() || undefined,
      pulse: pulse.trim() || undefined,
      temp: temp.trim() || undefined,
      weight: weight.trim() || undefined,
    };

    try {
      await api.updateNotes({
        appointmentId: appointment.id,
        vitals: vitalsObj,
        clinicalNotes: clinicalNotes.trim() || undefined,
      });
      setDraftSavedMsg('Clinical notes and vitals saved successfully!');
      setTimeout(() => setDraftSavedMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to save notes draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePrintPrescription = () => {
    window.print();
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment) return;
    if (!diagnosis.trim()) {
      setError('Please provide a clinical diagnosis before completing consultation.');
      return;
    }

    const validMedicines = medicines.filter((m) => m.name.trim() !== '');
    if (validMedicines.length === 0) {
      setError('Please prescribe at least one medication or recommendation.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const vitalsObj = {
      bp: bp.trim() || undefined,
      pulse: pulse.trim() || undefined,
      temp: temp.trim() || undefined,
      weight: weight.trim() || undefined,
    };

    try {
      await api.completePrescription({
        appointmentId: appointment.id,
        diagnosis,
        medicines: validMedicines,
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
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-[#1d1d1f]">Appointment Not Found</h3>
          <p className="text-xs text-[#86868b] mt-1 mb-6">
            {error || 'This consultation appointment could not be located or has been cancelled.'}
          </p>
          <AppleButton variant="primary" size="md" onClick={() => navigate('/doctor/dashboard')} className="w-full">
            Return to Doctor Console
          </AppleButton>
        </div>
      </div>
    );
  }

  const patientUser = appointment.patient?.user;
  const isForOther = Boolean(appointment.isForOther);
  const actualPatientName = isForOther && appointment.patientName ? appointment.patientName : (patientUser?.fullName || 'Walk-in Patient');
  const patientAgeDisplay = appointment.patientAge ? `${appointment.patientAge} yrs` : (appointment.patient?.dateOfBirth ? `${new Date().getFullYear() - new Date(appointment.patient.dateOfBirth).getFullYear()} yrs` : undefined);
  const patientGenderDisplay = appointment.patientGender || appointment.patient?.gender || 'Not specified';

  return (
    <>
    <div className="min-h-screen bg-[#f5f5f7] pb-16 print:hidden">
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
          <AppleButton variant="ghost" size="sm" onClick={handlePrintPrescription} className="flex items-center gap-1">
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </AppleButton>
        </div>
      </SubNav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
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

        <form onSubmit={handleComplete} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Patient Profile, Medical Summary & Vitals (1 Column) */}
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
                  <strong className="text-[#0088e8]">Queue #{appointment.queueNumber}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#86868b]">Blood Group:</span>
                  <span className="font-medium text-[#1d1d1f]">{appointment.patient?.bloodGroup || 'Not specified'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#86868b]">Allergies:</span>
                  <span className="text-rose-600 font-medium">{appointment.patient?.allergies || 'None reported'}</span>
                </div>
              </div>

              <div className="pt-4 text-xs">
                <span className="text-[#86868b] uppercase font-semibold block mb-1">Reason for Visit:</span>
                <p className="font-medium text-[#1d1d1f]">{appointment.reasonForVisit || 'General'}</p>
                {appointment.symptoms && (
                  <p className="mt-2 text-[#86868b]">
                    <strong>Symptoms: </strong> {appointment.symptoms}
                  </p>
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
                    className="w-full h-9 px-3 rounded-lg border border-[#e5e5ea] focus:border-[#0088e8]"
                  />
                </div>
                <div>
                  <label className="block text-[#86868b] mb-1">Pulse Rate</label>
                  <input
                    type="text"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    placeholder="72 bpm"
                    className="w-full h-9 px-3 rounded-lg border border-[#e5e5ea] focus:border-[#0088e8]"
                  />
                </div>
                <div>
                  <label className="block text-[#86868b] mb-1">Temperature</label>
                  <input
                    type="text"
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                    placeholder="98.6 °F"
                    className="w-full h-9 px-3 rounded-lg border border-[#e5e5ea] focus:border-[#0088e8]"
                  />
                </div>
                <div>
                  <label className="block text-[#86868b] mb-1">Weight</label>
                  <input
                    type="text"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="70 kg"
                    className="w-full h-9 px-3 rounded-lg border border-[#e5e5ea] focus:border-[#0088e8]"
                  />
                </div>
              </div>
            </UtilityCard>

            {/* Patient Past Uploaded Records */}
            {appointment.patient?.medicalRecords && appointment.patient.medicalRecords.length > 0 && (
              <UtilityCard>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#86868b] mb-3">
                  Patient Vault Records ({appointment.patient.medicalRecords.length})
                </h4>
                <div className="space-y-2">
                  {appointment.patient.medicalRecords.map((doc) => (
                    <a
                      key={doc.id}
                      href={getFileUrl(doc.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-xl bg-[#f5f5f7] hover:bg-[#0088e8]/5 border border-[#e5e5ea] flex justify-between items-center text-xs text-[#1d1d1f] transition-colors"
                    >
                      <span className="truncate max-w-[170px]">{doc.title}</span>
                      <span className="text-[#0088e8] flex items-center gap-1 font-medium">
                        <Eye className="w-3 h-3" /> View
                      </span>
                    </a>
                  ))}
                </div>
              </UtilityCard>
            )}
          </div>

          {/* Right Column: Diagnosis, Prescription Builder & Completion (2 Columns) */}
          <div className="lg:col-span-2 space-y-6">
            <UtilityCard>
              <h3 className="text-lg font-semibold text-[#1d1d1f] mb-4 tracking-tight">
                Clinical Diagnosis & Consultation Notes
              </h3>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-[#1d1d1f]">
                      Primary Clinical Diagnosis *
                    </label>
                    <span className="text-[11px] text-[#86868b]">Common:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[
                      'Acute Upper Respiratory Infection',
                      'Essential Hypertension',
                      'Acute Bronchitis',
                      'Type 2 Diabetes Review',
                      'Gastroenteritis',
                    ].map((diag) => (
                      <button
                        key={diag}
                        type="button"
                        onClick={() => setDiagnosis(diag)}
                        className={`px-3 py-1 rounded-full text-[11px] transition-colors ${
                          diagnosis === diag
                            ? 'bg-gradient-to-r from-[#0088e8] to-[#10b981] text-white font-medium shadow-sm'
                            : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]'
                        }`}
                      >
                        {diag}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    required
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="e.g. Acute Bronchitis, Essential Hypertension Grade 1"
                    className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] focus:outline-none focus:border-[#0088e8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    Consultation Clinical Notes
                  </label>
                  <textarea
                    rows={3}
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="Physical examination observations, lab interpretations, treatment rationale..."
                    className="w-full p-3 rounded-xl border border-[#e5e5ea] text-[14px] focus:outline-none focus:border-[#0088e8]"
                  ></textarea>
                </div>
              </div>
            </UtilityCard>

            {/* Digital Prescription Builder */}
            <UtilityCard>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[#1d1d1f] tracking-tight">Digital Prescription Writing Pad</h3>
                  <p className="text-xs text-[#86868b] mt-0.5">
                    Prescribe medications with auto-calculating total dispense quantity.
                  </p>
                </div>
                <AppleButton
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={handleAddMedicine}
                  className="flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Medicine
                </AppleButton>
              </div>

              <div className="space-y-4">
                {medicines.map((med, idx) => {
                  const { perDay, days, total } = calculateTotalDose(med.frequency, med.duration);
                  return (
                    <div
                      key={idx}
                      className="p-4 sm:p-5 rounded-2xl border border-[#e5e5ea] bg-[#fafafc] space-y-3.5 relative transition-all"
                    >
                      <div className="flex justify-between items-center pb-2 border-b border-[#f0f0f0]">
                        <span className="text-xs font-semibold text-[#0088e8]">Medication #{idx + 1}</span>
                        {medicines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMedicine(idx)}
                            className="text-[#86868b] hover:text-rose-600 transition-colors p-1 rounded hover:bg-rose-50"
                            title="Remove medication"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[#86868b] mb-1 font-medium">Medicine Name *</label>
                          <input
                            type="text"
                            required
                            value={med.name}
                            onChange={(e) => handleMedicineChange(idx, 'name', e.target.value)}
                            placeholder="e.g. Amoxicillin 500mg, Paracetamol 650mg"
                            className="w-full h-9 px-3 rounded-lg border border-[#e5e5ea] bg-white text-xs focus:border-[#0088e8]"
                          />
                        </div>
                        <div>
                          <label className="block text-[#86868b] mb-1 font-medium">Dosage Form</label>
                          <input
                            type="text"
                            value={med.dosage}
                            onChange={(e) => handleMedicineChange(idx, 'dosage', e.target.value)}
                            placeholder="1 Tablet / 5ml Syrup / 1 Capsule"
                            className="w-full h-9 px-3 rounded-lg border border-[#e5e5ea] bg-white text-xs focus:border-[#0088e8]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[#86868b] font-medium mb-1">Frequency</label>
                          <input
                            type="text"
                            value={med.frequency}
                            onChange={(e) => handleMedicineChange(idx, 'frequency', e.target.value)}
                            placeholder="Twice daily after meals"
                            className="w-full h-9 px-3 rounded-lg border border-[#e5e5ea] bg-white text-xs focus:border-[#0088e8] mb-1"
                          />
                          <div className="flex flex-wrap gap-1">
                            {['Once daily', 'Twice daily', 'Thrice daily', 'As needed'].map((f) => (
                              <button
                                key={f}
                                type="button"
                                onClick={() => handleMedicineChange(idx, 'frequency', f)}
                                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                                  med.frequency.toLowerCase().includes(f.toLowerCase())
                                    ? 'bg-[#0088e8] text-white'
                                    : 'bg-white border border-[#e5e5ea] text-[#86868b] hover:text-[#1d1d1f]'
                                }`}
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[#86868b] font-medium mb-1">Duration</label>
                          <input
                            type="text"
                            value={med.duration}
                            onChange={(e) => handleMedicineChange(idx, 'duration', e.target.value)}
                            placeholder="5 Days / 1 Week"
                            className="w-full h-9 px-3 rounded-lg border border-[#e5e5ea] bg-white text-xs focus:border-[#0088e8] mb-1"
                          />
                          <div className="flex flex-wrap gap-1">
                            {['3 Days', '5 Days', '7 Days', '14 Days', '30 Days'].map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => handleMedicineChange(idx, 'duration', d)}
                                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                                  med.duration.toLowerCase() === d.toLowerCase()
                                    ? 'bg-[#0088e8] text-white'
                                    : 'bg-white border border-[#e5e5ea] text-[#86868b] hover:text-[#1d1d1f]'
                                }`}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Auto-calculating Dosage Banner */}
                      <div className="p-2.5 rounded-xl bg-white border border-[#e5e5ea] flex items-center justify-between text-[11px]">
                        <span className="text-[#86868b]">
                          Auto-Calculated Schedule: <strong>{perDay}x daily</strong> for <strong>{days} day(s)</strong>
                        </span>
                        <span className="font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Total: ~{total} Units
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs text-[#86868b] mb-1 font-medium">Patient Instructions</label>
                        <input
                          type="text"
                          value={med.instructions}
                          onChange={(e) => handleMedicineChange(idx, 'instructions', e.target.value)}
                          placeholder="e.g. Take after meals with plenty of water. Avoid skipping doses."
                          className="w-full h-9 px-3 rounded-lg border border-[#e5e5ea] bg-white text-xs focus:border-[#0088e8]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Lifestyle Advice & Follow-Up */}
              <div className="mt-6 pt-4 border-t border-[#f0f0f0] space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    Dietary & Lifestyle Advice
                  </label>
                  <input
                    type="text"
                    value={advice}
                    onChange={(e) => setAdvice(e.target.value)}
                    placeholder="e.g. Low sodium diet, hydrate well, rest for 3 days."
                    className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-xs focus:border-[#0088e8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    Follow-Up Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:border-[#0088e8]"
                  />
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-[#f0f0f0] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <AppleButton
                    variant="ghost"
                    size="md"
                    type="button"
                    disabled={savingDraft}
                    onClick={handleSaveDraft}
                    className="flex items-center gap-1.5 w-full sm:w-auto justify-center"
                  >
                    <Save className="w-4 h-4 text-[#0088e8]" />
                    <span>{savingDraft ? 'Saving Draft...' : 'Save Draft Notes'}</span>
                  </AppleButton>
                  <AppleButton
                    variant="ghost"
                    size="md"
                    type="button"
                    onClick={handlePrintPrescription}
                    className="flex items-center gap-1.5 w-full sm:w-auto justify-center"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print</span>
                  </AppleButton>
                </div>

                <AppleButton
                  variant="primary"
                  size="lg"
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto"
                >
                  {submitting
                    ? 'Saving Prescription...'
                    : appointment.status === 'COMPLETED'
                    ? 'Update Prescription & Notes'
                    : 'Complete Consultation & Issue Prescription'}
                </AppleButton>
              </div>
            </UtilityCard>
          </div>
        </form>
      </div>
    </div>

    {/* Printable Prescription Letterhead (Visible ONLY during print) */}
    <div className="hidden print:block font-sans text-black p-8 bg-white max-w-4xl mx-auto">
      {/* Letterhead Top Header */}
      <div className="flex justify-between items-start pb-6 border-b-2 border-black">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black">Dr. {user?.fullName}</h1>
          <p className="text-sm font-semibold text-gray-700">{user?.doctorProfile?.qualifications || 'MBBS'}</p>
          <p className="text-xs font-semibold text-blue-700 mt-0.5">{user?.doctorProfile?.specialty || 'General Specialist'}</p>
          {user?.doctorProfile?.clinicAddress && (
            <p className="text-xs text-gray-600 mt-1">{user.doctorProfile.clinicAddress}</p>
          )}
          {user?.phone && <p className="text-xs text-gray-600">Contact: {user.phone}</p>}
        </div>

        <div className="text-right">
          <h2 className="text-xl font-bold tracking-tight text-blue-600">MediArca Clinical Platform</h2>
          <p className="text-xs text-gray-500 mt-0.5">Verified Medical Consultation Slip</p>
          <p className="text-xs font-mono font-semibold mt-2">Queue Token: #{appointment.queueNumber}</p>
          <p className="text-xs text-gray-700">Date: {appointment.appointmentDate || new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Patient Information Banner */}
      <div className="my-6 p-4 rounded-xl border border-gray-300 bg-gray-50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-gray-500 block">Patient Name</span>
          <strong className="text-sm text-black">{actualPatientName}</strong>
          {isForOther && <span className="text-[10px] text-gray-600 block">(Family Member)</span>}
        </div>
        <div>
          <span className="text-gray-500 block">Age / Gender</span>
          <strong className="text-black">{patientAgeDisplay || 'N/A'} / {patientGenderDisplay}</strong>
        </div>
        <div>
          <span className="text-gray-500 block">Blood Group / Allergies</span>
          <strong className="text-black">{appointment.patient?.bloodGroup || 'N/A'} • {appointment.patient?.allergies || 'None'}</strong>
        </div>
        <div>
          <span className="text-gray-500 block">Contact Phone</span>
          <strong className="text-black">{patientUser?.phone || 'N/A'}</strong>
        </div>
      </div>

      {/* Recorded Vitals */}
      {(bp || pulse || temp || weight) && (
        <div className="mb-6 p-3 rounded-lg border border-gray-200 bg-white flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-700">Vitals Recorded:</span>
          {bp && <span>BP: <strong>{bp}</strong></span>}
          {pulse && <span>Pulse: <strong>{pulse} bpm</strong></span>}
          {temp && <span>Temp: <strong>{temp} °F</strong></span>}
          {weight && <span>Weight: <strong>{weight} kg</strong></span>}
        </div>
      )}

      {/* Diagnosis */}
      <div className="mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
          Clinical Diagnosis
        </h3>
        <p className="text-sm font-semibold text-black bg-gray-50 p-3 rounded-lg border border-gray-200">
          {diagnosis || appointment.prescription?.diagnosis || 'General Consultation'}
        </p>
      </div>

      {/* Rx Medicines Table */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl font-serif font-bold text-blue-700">℞</span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Prescribed Medications & Regimen
          </h3>
        </div>
        <table className="w-full text-left text-xs border border-gray-300">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300 text-gray-700">
              <th className="py-2 px-3">#</th>
              <th className="py-2 px-3">Medicine Name</th>
              <th className="py-2 px-3">Dosage</th>
              <th className="py-2 px-3">Frequency</th>
              <th className="py-2 px-3">Duration</th>
              <th className="py-2 px-3">Instructions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {medicines.filter((m) => m.name.trim() !== '').map((med, idx) => (
              <tr key={idx}>
                <td className="py-2 px-3 font-semibold">{idx + 1}</td>
                <td className="py-2 px-3 font-bold text-black">{med.name}</td>
                <td className="py-2 px-3">{med.dosage}</td>
                <td className="py-2 px-3">{med.frequency}</td>
                <td className="py-2 px-3">{med.duration}</td>
                <td className="py-2 px-3 text-gray-600">{med.instructions || 'As directed'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Advice & Follow-Up */}
      <div className="grid grid-cols-2 gap-4 mb-8 text-xs">
        <div>
          <h4 className="font-bold text-gray-500 uppercase tracking-wider mb-1">Dietary & Lifestyle Advice</h4>
          <p className="text-gray-800 bg-gray-50 p-2.5 rounded-lg border border-gray-200 min-h-[50px]">
            {advice || 'Maintain hydration and follow general clinical precautions.'}
          </p>
        </div>
        <div>
          <h4 className="font-bold text-gray-500 uppercase tracking-wider mb-1">Next Follow-Up Date</h4>
          <p className="text-gray-800 bg-gray-50 p-2.5 rounded-lg border border-gray-200 min-h-[50px]">
            {followUpDate ? new Date(followUpDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'As needed if symptoms persist'}
          </p>
        </div>
      </div>

      {/* Footer & Doctor Signature Block */}
      <div className="pt-8 border-t-2 border-gray-200 flex justify-between items-end text-xs">
        <div>
          <p className="text-gray-500 text-[10px]">Generated via MediArca Clinical Platform</p>
          <p className="text-gray-500 text-[10px]">Electronic Prescription Slip • Timestamp: {new Date().toLocaleString()}</p>
        </div>
        <div className="text-right">
          <div className="w-48 border-b border-black mb-1"></div>
          <strong className="text-sm block">Dr. {user?.fullName}</strong>
          <span className="text-[11px] text-gray-600">Authorized Medical Signature</span>
        </div>
      </div>
    </div>
    </>
  );
};
