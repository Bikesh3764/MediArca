import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  api,
  Doctor,
  QueuePreview,
  parseDoctorSlots,
  format12Hour,
  getLocalDateString,
  getTomorrowDateString,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
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
  Building2,
  MapPin,
  FileText,
  Stethoscope,
  User as UserIcon,
} from 'lucide-react';

const patientNavItems: DashboardNavItem[] = [
  {
    id: 'appointments',
    label: 'Live Queue & Passes',
    icon: Calendar,
    path: '/patient/appointments',
  },
  {
    id: 'records',
    label: 'Medical Records Vault',
    icon: FileText,
    path: '/patient/records',
  },
  {
    id: 'find-doctors',
    label: 'Find Specialists',
    icon: Stethoscope,
    path: '/patient/doctors',
    active: true,
  },
  {
    id: 'profile',
    label: 'Patient Profile',
    icon: UserIcon,
    path: '/patient/profile',
  },
];

export const BookAppointment: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialDate = searchParams.get('date') || getLocalDateString();
  const initialSlot = searchParams.get('slot') || null;

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [appointmentDate, setAppointmentDate] = useState<string>(initialDate);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(initialSlot);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [queuePreview, setQueuePreview] = useState<QueuePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [bookingFor, setBookingFor] = useState<'myself' | 'other'>('myself');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('Male');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, loading: loadingAuth } = useAuth();
  const navigate = useNavigate();

  // Load doctor profile
  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchDoctor = async () => {
      if (!id) return;
      try {
        const docData = await api.getDoctorById(id);
        setDoctor(docData);
        if (docData.clinics && docData.clinics.length > 0) {
          setSelectedClinicId(docData.clinics[0].clinicId);
        }
        const slots = parseDoctorSlots(docData);
        if (slots.length > 0) {
          setSelectedSlotId((prev) => {
            if (prev) return prev;
            const matchingSlot = initialSlot ? slots.find((s) => s.id === initialSlot) : null;
            return matchingSlot ? matchingSlot.id : slots[0].id;
          });
        }
      } catch (err: any) {
        console.error('Failed to load doctor:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctor();
  }, [id, user, loadingAuth, navigate, initialSlot]);

  // Fetch queue preview when date or slotId changes
  useEffect(() => {
    const fetchQueue = async () => {
      if (!id || !doctor) return;
      setPreviewLoading(true);
      try {
        const previewData = await api.getQueuePreview(id, appointmentDate, selectedSlotId || undefined);
        setQueuePreview(previewData);
        if (previewData.selectedSlotId && (!selectedSlotId || (previewData.isPassed && previewData.selectedSlotId !== selectedSlotId))) {
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

    const isForOther = bookingFor === 'other';
    if (isForOther && !patientName.trim()) {
      setError('Please provide the patient full name.');
      setSubmitting(false);
      return;
    }
    if (isForOther && !patientAge.trim()) {
      setError('Please provide the patient age.');
      setSubmitting(false);
      return;
    }

    try {
      await api.bookAppointment({
        doctorId: doctor.id,
        clinicId: selectedClinicId || undefined,
        appointmentDate,
        slotId: selectedSlotId || undefined,
        reasonForVisit: reasonForVisit.trim() || 'General Medical Consultation',
        symptoms: symptoms.trim() || undefined,
        isForOther,
        patientName: isForOther ? patientName.trim() : undefined,
        patientAge: isForOther ? patientAge.trim() : undefined,
        patientGender: isForOther ? patientGender : undefined,
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
        <div className="w-8 h-8 rounded-full border-2 border-[#0088e8] border-t-transparent animate-spin"></div>
      </div>
    );
  }

  const doctorSlots = parseDoctorSlots(doctor);
  const isSelectedSlotPassed = Boolean(queuePreview?.isPassed);
  const isSelectedSlotFull = Boolean(queuePreview?.isFull);

  const bookingContent = (
    <UtilityCard>
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Doctor Info Card */}
          <div className="flex items-center gap-4 pb-6 border-b border-[#f0f0f0]">
            <div className="w-16 h-16 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex-shrink-0">
              {doctor.user.avatarUrl ? (
                <img src={doctor.user.avatarUrl} alt={doctor.user.fullName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-xl text-[#0088e8]">
                  {doctor.user.fullName[0]}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[#1d1d1f] tracking-tight">{doctor.user.fullName}</h3>
              <p className="text-xs text-[#0088e8] font-medium">
                {doctor.specialty} • {doctor.qualifications}
              </p>
              <p className="text-xs text-[#86868b] mt-0.5">{doctor.clinicAddress || 'MediArca Clinic'}</p>
            </div>
          </div>

          {/* Clinic / Practice Venue Selection */}
          {doctor.clinics && doctor.clinics.length > 0 && (
            <div className="py-4 border-b border-[#f0f0f0]">
              <label className="block text-xs font-medium text-[#1d1d1f] mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#0088e8]" />
                  Consultation Venue / Clinic
                </span>
                <span className="text-[11px] text-[#86868b]">
                  {doctor.clinics.length} facility location{doctor.clinics.length > 1 ? 's' : ''}
                </span>
              </label>

              {doctor.clinics.length === 1 ? (
                <div className="p-3.5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#0088e8] mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-[#1d1d1f] block">
                      {doctor.clinics[0].clinic.clinicName}
                    </span>
                    <span className="text-[11px] text-[#86868b]">
                      {doctor.clinics[0].clinic.address}{doctor.clinics[0].clinic.city ? `, ${doctor.clinics[0].clinic.city}` : ''}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {doctor.clinics.map((c) => {
                    const isSelected = selectedClinicId === c.clinicId;
                    return (
                      <button
                        key={c.clinicId}
                        type="button"
                        onClick={() => setSelectedClinicId(c.clinicId)}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? 'bg-[#0088e8]/10 border-[#0088e8] ring-1 ring-[#0088e8]/30 shadow-xs'
                            : 'bg-[#f5f5f7] border-[#e5e5ea] hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-[#1d1d1f]">{c.clinic.clinicName}</span>
                          {isSelected && <span className="w-2 h-2 rounded-full bg-[#0088e8]"></span>}
                        </div>
                        <span className="text-[11px] text-[#86868b] block line-clamp-1">
                          {c.clinic.address}{c.clinic.city ? `, ${c.clinic.city}` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Date Picker with Quick Shortcuts */}
          <div className="pt-4 pb-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#1d1d1f] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#0088e8]" />
                Select Appointment Date
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAppointmentDate(getLocalDateString())}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${
                    appointmentDate === getLocalDateString()
                      ? 'bg-gradient-to-r from-[#0088e8] to-[#10b981] text-white shadow-xs'
                      : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setAppointmentDate(getTomorrowDateString())}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${
                    appointmentDate === getTomorrowDateString()
                      ? 'bg-gradient-to-r from-[#0088e8] to-[#10b981] text-white shadow-xs'
                      : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  Tomorrow
                </button>
              </div>
            </div>
            <input
              type="date"
              required
              value={appointmentDate}
              min={getLocalDateString()}
              onChange={(e) => setAppointmentDate(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-white focus:outline-none focus:border-[#0088e8]"
            />
          </div>

          {/* Multiple Checking Slots Selection */}
          <div className="py-4">
            <label className="block text-xs font-medium text-[#1d1d1f] mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#0088e8]" />
                Choose Doctor Checking Slot (Shift)
              </span>
              <span className="text-[11px] text-[#86868b]">
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
                        ? 'bg-[#0088e8]/5 border-[#0088e8] ring-2 ring-[#0088e8]/20 shadow-xs'
                        : 'bg-white border-[#e5e5ea] hover:border-[#0088e8]/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-[#1d1d1f] block truncate">
                        {s.name}
                      </span>
                      {isSelected && !slotPassed && (
                        <span className="w-4 h-4 rounded-full bg-[#0088e8] text-white flex items-center justify-center flex-shrink-0">
                          <Check className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[#0088e8] font-medium flex items-center gap-1 mb-1">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span>
                        {format12Hour(s.startTime)} – {format12Hour(s.endTime)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#86868b] mt-2 pt-2 border-t border-black/5">
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
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-[#0088e8] border border-sky-200">
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
            <div className="my-5 p-5 rounded-2xl bg-[#0f172a] text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all border border-slate-800 shadow-md">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[#38bdf8] tracking-wider block">
                  Guaranteed Queue Allocation
                </span>
                <strong className="text-3xl font-bold tracking-tight block mt-0.5">
                  Queue #{queuePreview.nextQueueNumber}
                </strong>
                <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#38bdf8]" />
                  Checking Shift: {queuePreview.checkingWindow}
                </p>
              </div>

              <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-white/10 w-full sm:w-auto">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  Est. Consultation Time
                </span>
                <strong
                  className={`text-xl block ${
                    isSelectedSlotPassed ? 'text-rose-400' : 'text-[#38bdf8]'
                  }`}
                >
                  {previewLoading ? 'Updating...' : queuePreview.estimatedTime}
                </strong>
                <span className="text-xs text-slate-400 block mt-0.5">
                  {queuePreview.patientsAhead} patient(s) ahead • ~{queuePreview.avgConsultationMinutes}m pace
                </span>
              </div>
            </div>
          )}

          {/* Booking Form */}
          <form onSubmit={handleBooking} className="space-y-4">
            {/* Booking For Segmented Control */}
            <div className="py-2 border-b border-[#e5e5ea] pb-4">
              <label className="block text-xs font-semibold text-[#1d1d1f] mb-2">
                Booking For:
              </label>
              <div className="flex rounded-xl bg-[#f5f5f7] p-1 border border-[#e5e5ea] max-w-sm">
                <button
                  type="button"
                  onClick={() => setBookingFor('myself')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    bookingFor === 'myself'
                      ? 'bg-white text-[#1d1d1f] shadow-xs font-semibold'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  Myself
                </button>
                <button
                  type="button"
                  onClick={() => setBookingFor('other')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    bookingFor === 'other'
                      ? 'bg-white text-[#1d1d1f] shadow-xs font-semibold'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  Someone Else / Family
                </button>
              </div>

              {bookingFor === 'other' && (
                <div className="mt-3 p-4 rounded-2xl bg-[#0088e8]/5 border border-[#0088e8]/20 space-y-3 animate-fadeIn">
                  <div className="text-xs font-semibold text-[#0088e8]">
                    Patient Details (Dependent / Family Member)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1">
                        Patient Full Name *
                      </label>
                      <input
                        type="text"
                        required={bookingFor === 'other'}
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="e.g. Rahul Ray"
                        className="w-full h-10 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1">
                        Patient Age *
                      </label>
                      <input
                        type="text"
                        required={bookingFor === 'other'}
                        value={patientAge}
                        onChange={(e) => setPatientAge(e.target.value)}
                        placeholder="e.g. 12"
                        className="w-full h-10 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1">
                        Gender
                      </label>
                      <select
                        value={patientGender}
                        onChange={(e) => setPatientGender(e.target.value)}
                        className="w-full h-10 px-2.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8]"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-[#1d1d1f]">
                  Reason for Visit
                </label>
                <span className="text-[11px] text-[#86868b]">Quick Select:</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[
                  'General Consultation',
                  'Routine Checkup',
                  'Prescription Refill',
                  'Follow-up Review',
                  'Flu / Fever Symptoms',
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setReasonForVisit(tag)}
                    className={`px-3 py-1 rounded-full text-[11px] transition-colors ${
                      reasonForVisit === tag
                        ? 'bg-gradient-to-r from-[#0088e8] to-[#10b981] text-white font-medium shadow-xs'
                        : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={reasonForVisit}
                onChange={(e) => setReasonForVisit(e.target.value)}
                placeholder="e.g. Annual cardiac review, chest tightness, routine check"
                className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] focus:outline-none focus:border-[#0088e8]"
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
                className="w-full p-3 rounded-xl border border-[#e5e5ea] text-[14px] focus:outline-none focus:border-[#0088e8]"
              ></textarea>
            </div>

            {/* Zero Payment Policy Notice */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Direct Clinic Token (No Upfront Payment):</strong> Consultation fee of $
                {doctor.consultationFee} is settled directly with the clinic upon visit. Your queue spot is guaranteed.
              </div>
            </div>

            {/* Warning if slot has ended for today */}
            {isSelectedSlotPassed && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>This checking shift has already ended for today.</strong> Please select an upcoming shift above or pick a future appointment date to reserve your queue token.
                </div>
              </div>
            )}

            {isSelectedSlotFull && !isSelectedSlotPassed && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
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
                  : queuePreview?.nextQueueNumber
                  ? `Confirm Queue #${queuePreview.nextQueueNumber}`
                  : 'Confirm Queue Token'}
              </AppleButton>
            </div>
          </form>
        </UtilityCard>
  );

  if (user?.role === 'PATIENT') {
    return (
      <DashboardLayout
        portalType="PATIENT"
        portalSubtitle="PATIENT PORTAL"
        navItems={patientNavItems}
        title="Confirm Appointment"
        subtitle="Guaranteed queue spot with zero payment barrier"
        headerAction={
          <AppleButton
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </AppleButton>
        }
      >
        <div className="max-w-2xl mx-auto space-y-6">
          {bookingContent}
        </div>
      </DashboardLayout>
    );
  }

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
        {bookingContent}
      </div>
    </div>
  );
};
