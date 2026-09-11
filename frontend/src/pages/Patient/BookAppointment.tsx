import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { api, Doctor, QueuePreview, parseDoctorSlots, format12Hour } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SubNav } from '../../components/layout/SubNav';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Check,
} from 'lucide-react';

export const BookAppointment: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const initialSlot = searchParams.get('slot') || null;

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [appointmentDate, setAppointmentDate] = useState<string>(initialDate);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(initialSlot);
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [queuePreview, setQueuePreview] = useState<QueuePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  // Load doctor profile
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchDoctor = async () => {
      if (!id) return;
      try {
        const docData = await api.getDoctorById(id);
        setDoctor(docData);
        const slots = parseDoctorSlots(docData);
        if (slots.length > 0 && !selectedSlotId) {
          // If a slot was provided in query param and exists, use it; otherwise let queue preview select first available
          const matchingSlot = initialSlot ? slots.find((s) => s.id === initialSlot) : null;
          if (matchingSlot) {
            setSelectedSlotId(matchingSlot.id);
          }
        }
      } catch (err: any) {
        console.error('Failed to load doctor:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctor();
  }, [id, user, navigate]);

  // Fetch queue preview when date or slotId changes
  useEffect(() => {
    const fetchQueue = async () => {
      if (!id || !doctor) return;
      setPreviewLoading(true);
      try {
        const previewData = await api.getQueuePreview(id, appointmentDate, selectedSlotId || undefined);
        setQueuePreview(previewData);
        if (previewData.selectedSlotId && (!selectedSlotId || previewData.isPassed)) {
          setSelectedSlotId(previewData.selectedSlotId);
        }
      } catch (err: any) {
        console.error('Failed to load queue preview:', err);
      } finally {
        setPreviewLoading(false);
      }
    };

    if (doctor) {
      fetchQueue();
    }
  }, [id, doctor, appointmentDate, selectedSlotId]);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;

    setError(null);
    setSubmitting(true);

    try {
      await api.bookAppointment({
        doctorId: doctor.id,
        appointmentDate,
        slotId: selectedSlotId || undefined,
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

  const doctorSlots = parseDoctorSlots(doctor);
  const isSelectedSlotPassed = Boolean(queuePreview?.isPassed);
  const isSelectedSlotFull = Boolean(queuePreview?.isFull);

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav title="Confirm Appointment" subtitle="Guaranteed queue spot with zero payment barrier">
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
              <p className="text-xs text-[#0066cc] font-medium">
                {doctor.specialty} • {doctor.qualifications}
              </p>
              <p className="text-xs text-[#7a7a7a] mt-0.5">{doctor.clinicAddress || 'MediArca Clinic'}</p>
            </div>
          </div>

          {/* Date Picker */}
          <div className="pt-6 pb-2">
            <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#0066cc]" />
              Select Appointment Date
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

          {/* Multiple Checking Slots Selection */}
          <div className="py-4">
            <label className="block text-xs font-medium text-[#1d1d1f] mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#0066cc]" />
                Choose Doctor Checking Slot (Shift)
              </span>
              <span className="text-[11px] text-[#7a7a7a]">
                {doctorSlots.length} available shift{doctorSlots.length > 1 ? 's' : ''}
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(queuePreview?.availableSlots || doctorSlots.map((s) => ({ slot: s }))).map((item: any) => {
                const s = item.slot;
                const isSelected = selectedSlotId === s.id;
                const slotPassed = Boolean(item.isPassed);
                const slotFull = Boolean(item.isFull);
                const slotInProgress = Boolean(item.isInProgress);

                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={slotPassed}
                    onClick={() => setSelectedSlotId(s.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                      slotPassed
                        ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'bg-[#0066cc]/5 border-[#0066cc] ring-2 ring-[#0066cc]/20 shadow-sm'
                        : 'bg-white border-[#e0e0e0] hover:border-[#0066cc]/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-[#1d1d1f] block truncate">
                        {s.name}
                      </span>
                      {isSelected && !slotPassed && (
                        <span className="w-4 h-4 rounded-full bg-[#0066cc] text-white flex items-center justify-center flex-shrink-0">
                          <Check className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[#0066cc] font-medium flex items-center gap-1 mb-1">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span>
                        {format12Hour(s.startTime)} – {format12Hour(s.endTime)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#7a7a7a] mt-2 pt-2 border-t border-black/5">
                      <span>Max {s.maxPatients} patients</span>
                      <span className="text-[#1d1d1f] font-medium">
                        ~{s.avgConsultationMinutes}m pace
                      </span>
                    </div>

                    {/* Status Pill */}
                    <div className="mt-2">
                      {slotPassed ? (
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                          Shift Ended for Today
                        </span>
                      ) : slotInProgress ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Active In Progress Now
                        </span>
                      ) : slotFull ? (
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                          Capacity Reached
                        </span>
                      ) : (
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#0066cc]">
                          Available for Booking
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Queue & Schedule Reservation Banner */}
          {queuePreview && (
            <div className="my-5 p-5 rounded-2xl bg-[#1d1d1f] text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[#2997ff] tracking-wider block">
                  Guaranteed Queue Allocation
                </span>
                <strong className="text-3xl font-bold tracking-tight block mt-0.5">
                  Queue #{queuePreview.nextQueueNumber}
                </strong>
                <p className="text-xs text-[#cccccc] mt-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#2997ff]" />
                  Checking Shift: {queuePreview.checkingWindow}
                </p>
              </div>

              <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-white/10 w-full sm:w-auto">
                <span className="text-[10px] uppercase font-semibold text-white/70 block">
                  Est. Consultation Time
                </span>
                <strong
                  className={`text-xl block ${
                    isSelectedSlotPassed ? 'text-rose-400' : 'text-[#2997ff]'
                  }`}
                >
                  {previewLoading ? 'Updating...' : queuePreview.estimatedTime}
                </strong>
                <span className="text-xs text-white/70 block mt-0.5">
                  {queuePreview.patientsAhead} patient(s) ahead • ~{queuePreview.avgConsultationMinutes}m pace
                </span>
              </div>
            </div>
          )}

          {/* Booking Form */}
          <form onSubmit={handleBooking} className="space-y-4">
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

            {/* Warning if slot has ended for today */}
            {isSelectedSlotPassed && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>This checking shift has already ended for today.</strong> Please select an upcoming shift above or pick a future appointment date to reserve your queue token.
                </div>
              </div>
            )}

            {isSelectedSlotFull && !isSelectedSlotPassed && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>This checking slot has reached maximum capacity. Please pick another slot or date.</span>
              </div>
            )}

            <div className="pt-4 border-t border-[#f0f0f0] flex justify-end">
              <AppleButton
                variant="primary"
                size="lg"
                type="submit"
                disabled={submitting || isSelectedSlotPassed || isSelectedSlotFull}
                className="w-full sm:w-auto"
              >
                {submitting
                  ? 'Confirming Token...'
                  : isSelectedSlotPassed
                  ? 'Shift Concluded — Select Next Shift'
                  : isSelectedSlotFull
                  ? 'Slot Full — Select Another'
                  : `Confirm Queue #${queuePreview?.nextQueueNumber || ''}`}
              </AppleButton>
            </div>
          </form>
        </UtilityCard>
      </div>
    </div>
  );
};
