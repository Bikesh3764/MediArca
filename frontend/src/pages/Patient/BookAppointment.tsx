import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { api, Doctor, QueuePreview } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SubNav } from '../../components/layout/SubNav';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import { Clock, Calendar, AlertCircle, CheckCircle2, ChevronLeft } from 'lucide-react';

export const BookAppointment: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [appointmentDate, setAppointmentDate] = useState<string>(initialDate);
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [queuePreview, setQueuePreview] = useState<QueuePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchDoctorAndQueue = async () => {
      if (!id) return;
      try {
        const [docData, previewData] = await Promise.all([
          api.getDoctorById(id),
          api.getQueuePreview(id, appointmentDate),
        ]);
        setDoctor(docData);
        setQueuePreview(previewData);
      } catch (err: any) {
        console.error('Failed to load booking info:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctorAndQueue();
  }, [id, appointmentDate, user]);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;

    setError(null);
    setSubmitting(true);

    try {
      await api.bookAppointment({
        doctorId: doctor.id,
        appointmentDate,
        reasonForVisit: reasonForVisit.trim() || 'General Medical Consultation',
        symptoms: symptoms.trim() || undefined,
      });

      // Redirect immediately to My Appointments to view the live pass
      navigate('/patient/appointments');
    } catch (err: any) {
      setError(err.message || 'Failed to complete appointment booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !doctor) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav title="Confirm Appointment" subtitle="Zero payment barrier">
        <AppleButton
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </AppleButton>
      </SubNav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8">
        <UtilityCard>
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Doctor Info Card */}
          <div className="flex items-center gap-4 pb-6 border-b border-[#f0f0f0]">
            <div className="w-16 h-16 rounded-full bg-[#f5f5f7] border border-[#e0e0e0] overflow-hidden flex-shrink-0">
              {doctor.user.avatarUrl ? (
                <img src={doctor.user.avatarUrl} alt={doctor.user.fullName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-xl text-[#0066cc]">
                  {doctor.user.fullName[0]}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[#1d1d1f]">{doctor.user.fullName}</h3>
              <p className="text-xs text-[#0066cc] font-medium">{doctor.specialty} • {doctor.qualifications}</p>
              <p className="text-xs text-[#7a7a7a] mt-0.5">{doctor.clinicAddress}</p>
            </div>
          </div>

          {/* Queue & Schedule Reservation Banner */}
          {queuePreview && (
            <div className="my-6 p-5 rounded-2xl bg-[#1d1d1f] text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[#2997ff] tracking-wider block">
                  Assigned Queue Token
                </span>
                <strong className="text-3xl font-bold tracking-tight">
                  Queue #{queuePreview.nextQueueNumber}
                </strong>
                <p className="text-xs text-[#cccccc] mt-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#2997ff]" />
                  Doctor Checking Hours: {queuePreview.checkingWindow}
                </p>
              </div>

              <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-white/10 w-full sm:w-auto">
                <span className="text-[10px] uppercase font-semibold text-white/70 block">
                  Est. Consultation Time
                </span>
                <strong className="text-xl text-[#2997ff] block">
                  {queuePreview.estimatedTime}
                </strong>
                <span className="text-xs text-white/70">
                  {queuePreview.patientsAhead} patient(s) ahead
                </span>
              </div>
            </div>
          )}

          {/* Booking Form */}
          <form onSubmit={handleBooking} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#0066cc]" />
                Appointment Date
              </label>
              <input
                type="date"
                required
                value={appointmentDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-[#e0e0e0] text-[14px] bg-white focus:outline-none focus:border-[#0066cc]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                Reason for Visit
              </label>
              <input
                type="text"
                value={reasonForVisit}
                onChange={(e) => setReasonForVisit(e.target.value)}
                placeholder="e.g. Annual cardiac review, chest tightness, routine check"
                className="w-full h-11 px-4 rounded-xl border border-[#e0e0e0] text-[14px] focus:outline-none focus:border-[#0066cc]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                Symptoms or Concerns (Optional)
              </label>
              <textarea
                rows={3}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Describe any symptoms you are experiencing..."
                className="w-full p-3 rounded-xl border border-[#e0e0e0] text-[14px] focus:outline-none focus:border-[#0066cc]"
              ></textarea>
            </div>

            {/* Zero Payment Policy Notice */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Direct Clinic Token (No Upfront Payment):</strong> Consultation fee of $
                {doctor.consultationFee} is settled directly with the clinic upon visit. Your queue spot is guaranteed.
              </div>
            </div>

            <div className="pt-4 border-t border-[#f0f0f0] flex justify-end">
              <AppleButton
                variant="primary"
                size="lg"
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                {submitting ? 'Confirming Token...' : `Confirm Queue #${queuePreview?.nextQueueNumber || ''}`}
              </AppleButton>
            </div>
          </form>
        </UtilityCard>
      </div>
    </div>
  );
};
