import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Appointment } from '../../services/api';
import { SubNav } from '../../components/layout/SubNav';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  User,
  Heart,
  FileText,
  Plus,
  Trash2,
  CheckCircle,
  ChevronLeft,
  AlertCircle,
  Clock,
  Eye,
} from 'lucide-react';

interface MedicineRow {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export const ConsultationView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
    const fetchAppointmentData = async () => {
      if (!id) return;
      try {
        const queueRes = await api.getDoctorQueue();
        const found = queueRes.allAppointments.find((a) => a.id === id);
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
            } catch (e) {}
          }
          if (found.prescription) {
            setDiagnosis(found.prescription.diagnosis);
            setAdvice(found.prescription.advice || '');
            setFollowUpDate(found.prescription.followUpDate || '');
            try {
              setMedicines(JSON.parse(found.prescription.medicines));
            } catch (e) {}
          }
        }
      } catch (err: any) {
        console.error('Failed to load consultation appointment:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointmentData();
  }, [id]);

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

      alert('Consultation completed and digital prescription saved!');
      navigate('/doctor/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to complete consultation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !appointment) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin"></div>
      </div>
    );
  }

  const patientUser = appointment.patient?.user;

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav title="Consultation Cabin" subtitle={`Queue #${appointment.queueNumber} • ${patientUser?.fullName}`}>
        <AppleButton variant="ghost" size="sm" onClick={() => navigate('/doctor/dashboard')} className="flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" />
          Queue Console
        </AppleButton>
      </SubNav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
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
                <div className="w-12 h-12 rounded-full bg-[#f5f5f7] border border-[#e0e0e0] flex items-center justify-center font-bold text-lg text-[#0066cc]">
                  {patientUser?.fullName[0] || 'P'}
                </div>
                <div>
                  <h3 className="font-semibold text-[17px] text-[#1d1d1f]">{patientUser?.fullName}</h3>
                  <p className="text-xs text-[#7a7a7a]">{patientUser?.email}</p>
                </div>
              </div>

              <div className="py-4 border-b border-[#f0f0f0] text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#7a7a7a]">Queue Token:</span>
                  <strong className="text-[#0066cc]">Queue #{appointment.queueNumber}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7a7a7a]">Blood Group:</span>
                  <span>{appointment.patient?.bloodGroup || 'Not specified'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7a7a7a]">Allergies:</span>
                  <span className="text-rose-600 font-medium">{appointment.patient?.allergies || 'None reported'}</span>
                </div>
              </div>

              <div className="pt-4 text-xs">
                <span className="text-[#7a7a7a] uppercase font-semibold block mb-1">Reason for Visit:</span>
                <p className="font-medium text-[#1d1d1f]">{appointment.reasonForVisit || 'General'}</p>
                {appointment.symptoms && (
                  <p className="mt-2 text-[#7a7a7a]">
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
                  <label className="block text-[#7a7a7a] mb-1">Blood Pressure</label>
                  <input
                    type="text"
                    value={bp}
                    onChange={(e) => setBp(e.target.value)}
                    placeholder="120/80 mmHg"
                    className="w-full h-9 px-3 rounded-lg border border-[#e0e0e0] focus:border-[#0066cc]"
                  />
                </div>
                <div>
                  <label className="block text-[#7a7a7a] mb-1">Pulse / Heart Rate</label>
                  <input
                    type="text"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    placeholder="72 bpm"
                    className="w-full h-9 px-3 rounded-lg border border-[#e0e0e0] focus:border-[#0066cc]"
                  />
                </div>
                <div>
                  <label className="block text-[#7a7a7a] mb-1">Temperature</label>
                  <input
                    type="text"
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                    placeholder="98.6 °F"
                    className="w-full h-9 px-3 rounded-lg border border-[#e0e0e0] focus:border-[#0066cc]"
                  />
                </div>
                <div>
                  <label className="block text-[#7a7a7a] mb-1">Weight</label>
                  <input
                    type="text"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="70 kg"
                    className="w-full h-9 px-3 rounded-lg border border-[#e0e0e0] focus:border-[#0066cc]"
                  />
                </div>
              </div>
            </UtilityCard>

            {/* Patient Past Uploaded Records */}
            {appointment.patient?.medicalRecords && appointment.patient.medicalRecords.length > 0 && (
              <UtilityCard>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7a7a7a] mb-3">
                  Patient Vault Records ({appointment.patient.medicalRecords.length})
                </h4>
                <div className="space-y-2">
                  {appointment.patient.medicalRecords.map((doc) => (
                    <a
                      key={doc.id}
                      href={`http://localhost:5000${doc.fileUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg bg-[#f5f5f7] hover:bg-[#0066cc]/5 border border-[#e0e0e0] flex justify-between items-center text-xs text-[#1d1d1f] transition-colors"
                    >
                      <span className="truncate max-w-[170px]">{doc.title}</span>
                      <span className="text-[#0066cc] flex items-center gap-1 font-medium">
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
              <h3 className="text-lg font-semibold text-[#1d1d1f] mb-4">
                Clinical Diagnosis & Consultation Notes
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    Primary Clinical Diagnosis *
                  </label>
                  <input
                    type="text"
                    required
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="e.g. Acute Bronchitis, Essential Hypertension Grade 1"
                    className="w-full h-11 px-4 rounded-xl border border-[#e0e0e0] text-[14px] focus:outline-none focus:border-[#0066cc]"
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
                    className="w-full p-3 rounded-xl border border-[#e0e0e0] text-[14px] focus:outline-none focus:border-[#0066cc]"
                  ></textarea>
                </div>
              </div>
            </UtilityCard>

            {/* Digital Prescription Builder */}
            <UtilityCard>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-[#1d1d1f]">Digital Prescription Builder</h3>
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
                {medicines.map((med, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-[#e0e0e0] bg-[#fafafc] space-y-3 relative"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-[#0066cc]">Medication #{idx + 1}</span>
                      {medicines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMedicine(idx)}
                          className="text-[#7a7a7a] hover:text-rose-600 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[#7a7a7a] mb-1">Medicine Name *</label>
                        <input
                          type="text"
                          required
                          value={med.name}
                          onChange={(e) => handleMedicineChange(idx, 'name', e.target.value)}
                          placeholder="e.g. Amoxicillin 500mg"
                          className="w-full h-9 px-3 rounded-lg border border-[#e0e0e0] bg-white text-xs focus:border-[#0066cc]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#7a7a7a] mb-1">Dosage Form</label>
                        <input
                          type="text"
                          value={med.dosage}
                          onChange={(e) => handleMedicineChange(idx, 'dosage', e.target.value)}
                          placeholder="1 Tablet / 5ml Syrup"
                          className="w-full h-9 px-3 rounded-lg border border-[#e0e0e0] bg-white text-xs focus:border-[#0066cc]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[#7a7a7a] mb-1">Frequency</label>
                        <input
                          type="text"
                          value={med.frequency}
                          onChange={(e) => handleMedicineChange(idx, 'frequency', e.target.value)}
                          placeholder="Twice daily after meals"
                          className="w-full h-9 px-3 rounded-lg border border-[#e0e0e0] bg-white text-xs focus:border-[#0066cc]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#7a7a7a] mb-1">Duration</label>
                        <input
                          type="text"
                          value={med.duration}
                          onChange={(e) => handleMedicineChange(idx, 'duration', e.target.value)}
                          placeholder="7 Days"
                          className="w-full h-9 px-3 rounded-lg border border-[#e0e0e0] bg-white text-xs focus:border-[#0066cc]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-[#7a7a7a] mb-1">Patient Instructions</label>
                      <input
                        type="text"
                        value={med.instructions}
                        onChange={(e) => handleMedicineChange(idx, 'instructions', e.target.value)}
                        placeholder="e.g. Avoid dairy 2 hours before and after taking."
                        className="w-full h-9 px-3 rounded-lg border border-[#e0e0e0] bg-white text-xs focus:border-[#0066cc]"
                      />
                    </div>
                  </div>
                ))}
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
                    className="w-full h-11 px-4 rounded-xl border border-[#e0e0e0] text-xs focus:border-[#0066cc]"
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
                    className="w-full h-11 px-4 rounded-xl border border-[#e0e0e0] text-xs bg-white focus:border-[#0066cc]"
                  />
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-[#f0f0f0] flex justify-end">
                <AppleButton
                  variant="primary"
                  size="lg"
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto"
                >
                  {submitting ? 'Saving Prescription...' : 'Complete Consultation & Issue Prescription'}
                </AppleButton>
              </div>
            </UtilityCard>
          </div>
        </form>
      </div>
    </div>
  );
};
