import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  api,
  Doctor,
  Appointment,
  QueuePreview,
  parseDoctorSlots,
  format12Hour,
  getLocalDateString,
  getTomorrowDateString,
  formatDoctorDegrees,
  getFileUrl,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SubNav } from '../../components/layout/SubNav';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Check,
  Building2,
  MapPin,
  Phone,
  Clock,
} from 'lucide-react';

const formatDisplayPhone = (phone?: string) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    const raw10 = digits.slice(2);
    return `+91 ${raw10.slice(0, 5)} ${raw10.slice(5)}`;
  }
  return phone.startsWith('+91') ? phone : `+91 ${phone}`;
};

export const BookAppointment: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialDate = searchParams.get('date') || getLocalDateString();
  const initialSlot = searchParams.get('slot') || null;
  const initialClinic = searchParams.get('clinic') || searchParams.get('clinicId') || null;

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
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  const selectedClinic = doctor?.clinics?.find((c) => c.clinicId === selectedClinicId) || doctor?.clinics?.[0];
  const activeFee = selectedClinic?.consultationFee ?? queuePreview?.consultationFee ?? doctor?.consultationFee ?? 0;
  const doctorSlots = (selectedClinic?.slots && selectedClinic.slots.length > 0)
    ? selectedClinic.slots
    : (doctor ? parseDoctorSlots(doctor) : []);

  const attachedReceptionists = React.useMemo(() => {
    if (!doctor) return [];
    const list: Array<{ id: string; name: string; phone?: string; clinicName?: string }> = [];

    // 1. Doctor-assigned receptionists for this clinic
    if (doctor.receptionists && doctor.receptionists.length > 0) {
      doctor.receptionists.forEach((r) => {
        if (!selectedClinicId || !r.clinicId || r.clinicId === selectedClinicId) {
          if (!list.some((item) => item.phone === r.phone && item.name === r.name)) {
            list.push({
              id: r.id,
              name: r.name,
              phone: r.phone || selectedClinic?.clinic.phone,
              clinicName: r.clinicName || selectedClinic?.clinic.clinicName,
            });
          }
        }
      });
    }

    // 2. Selected clinic's receptionists
    if (selectedClinic?.receptionists && selectedClinic.receptionists.length > 0) {
      selectedClinic.receptionists.forEach((r) => {
        const phone = r.phone || selectedClinic.clinic.phone;
        if (!list.some((item) => item.phone === phone && item.name === r.name)) {
          list.push({
            id: r.id,
            name: r.name,
            phone,
            clinicName: selectedClinic.clinic.clinicName,
          });
        }
      });
    }

    return list;
  }, [doctor, selectedClinic, selectedClinicId]);

  useEffect(() => {
    const fetchDoctor = async () => {
      if (!id) return;
      try {
        const data = await api.getDoctorById(id);
        setDoctor(data);

        // Preselect clinic if provided via query params or pick first available clinic
        if (data.clinics && data.clinics.length > 0) {
          const matchedClinic = initialClinic ? data.clinics.find((c) => c.clinicId === initialClinic) : null;
          const targetClinic = matchedClinic || data.clinics[0];
          setSelectedClinicId(targetClinic.clinicId);

          const slots = (targetClinic.slots && targetClinic.slots.length > 0) ? targetClinic.slots : parseDoctorSlots(data);
          if (slots.length > 0) {
            setSelectedSlotId(initialSlot || slots[0].id);
          }
        } else {
          const slots = parseDoctorSlots(data);
          if (slots.length > 0) {
            setSelectedSlotId(initialSlot || slots[0].id);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load doctor profile');
      } finally {
        setLoading(false);
      }
    };

    fetchDoctor();
  }, [id, initialClinic, initialSlot]);

  // Sync queue preview dynamically when slot or date or clinic changes
  useEffect(() => {
    const fetchPreview = async () => {
      if (!id || !appointmentDate) return;
      setPreviewLoading(true);
      try {
        const preview = await api.getQueuePreview(
          id,
          appointmentDate,
          selectedSlotId || undefined,
          selectedClinicId || undefined
        );
        setQueuePreview(preview);
        if (preview.selectedSlotId && (!selectedSlotId || (preview.isPassed && preview.selectedSlotId !== selectedSlotId))) {
          setSelectedSlotId(preview.selectedSlotId);
        }
      } catch (err) {
        console.error('Queue calculation preview failed:', err);
      } finally {
        setPreviewLoading(false);
      }
    };

    fetchPreview();
  }, [id, appointmentDate, selectedSlotId, selectedClinicId]);

  const handleSelectClinic = (clinicId: string) => {
    setSelectedClinicId(clinicId);
    const target = doctor?.clinics?.find((c) => c.clinicId === clinicId);
    const clinicSlots = (target?.slots && target.slots.length > 0)
      ? target.slots
      : (doctor ? parseDoctorSlots(doctor) : []);

    if (clinicSlots.length > 0 && !clinicSlots.some((s) => s.id === selectedSlotId)) {
      setSelectedSlotId(clinicSlots[0].id);
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;

    if (!user) {
      navigate('/patient/login', { state: { from: `/book/${doctor.id}` } });
      return;
    }

    setError(null);
    setSubmitting(true);

    const hasClinics = Boolean(doctor.clinics && doctor.clinics.length > 0);
    if (!hasClinics) {
      setError('This doctor is currently not associated with an active clinic. Appointments cannot be booked.');
      setSubmitting(false);
      return;
    }

    if (doctor.clinics!.length > 1 && !selectedClinicId) {
      setError('Please select a clinic venue.');
      setSubmitting(false);
      return;
    }

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
      const appt = await api.bookAppointment({
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

      // Reveal confirmed appointment and receptionist contact details
      setConfirmedAppointment(appt);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Failed to complete appointment booking');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/doctors');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin mb-3"></div>
        <p className="text-xs text-[#86868b]">Loading booking...</p>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center py-20 px-4">
        <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-[#e5e5ea] max-w-md mx-auto">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">Doctor Not Found</h2>
          <p className="text-xs text-[#86868b] mb-6">The requested doctor is unavailable or inactive.</p>
          <AppleButton variant="primary" onClick={() => navigate('/doctors')}>
            Back to Directory
          </AppleButton>
        </div>
      </div>
    );
  }

  const isSelectedSlotPassed = Boolean(queuePreview?.isPassed);
  const isSelectedSlotFull = Boolean(queuePreview?.isFull);

  // Receptionist Contact Info resolved for confirmation screen
  const primaryReceptionist = attachedReceptionists[0];
  const deskPhone = primaryReceptionist?.phone || selectedClinic?.clinic.phone;
  const deskName = primaryReceptionist?.name || 'Clinic Reception Desk';

  // 1. Post-Booking Success & Receptionist Details Screen
  if (confirmedAppointment) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] pb-16">
        <SubNav title="Appointment Requested">
          <AppleButton
            variant="ghost"
            size="sm"
            onClick={() => navigate('/doctors')}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Doctors
          </AppleButton>
        </SubNav>

        <div className="max-w-xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
          <UtilityCard className="text-center py-8 px-5 sm:px-8 space-y-6">
            <div className="w-16 h-16 rounded-full bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] flex items-center justify-center mx-auto shadow-2xs">
              <Clock className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#86868b] block mb-1">
                Request Submitted
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1d1d1f]">
                Pending Receptionist Confirmation
              </h2>
              <p className="text-xs text-[#86868b] mt-1 font-medium">
                {confirmedAppointment.appointmentDate} · {confirmedAppointment.checkingWindow}
              </p>
              <div className="mt-3 inline-flex items-baseline gap-2 px-4 py-1.5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Estimated Token</span>
                <span className="text-xl font-bold text-[#1d1d1f] tracking-tight">
                  #{confirmedAppointment.estimatedQueueNumber || (confirmedAppointment.queueNumber > 0 ? confirmedAppointment.queueNumber : 1)}
                </span>
              </div>
            </div>

            {/* Receptionist Contact Details Card (NOW REVEALED!) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-left space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider block">
                    Pay Receptionist to Confirm
                  </span>
                  <h4 className="text-base font-bold text-[#1d1d1f] mt-0.5">
                    {deskName}
                  </h4>
                  <p className="text-xs text-[#86868b] mt-0.5">
                    {selectedClinic?.clinic.clinicName} · {selectedClinic?.clinic.address}{selectedClinic?.clinic.city ? `, ${selectedClinic.clinic.city}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-base font-bold text-[#1d1d1f] block">
                    ₹{activeFee}
                  </span>
                  <span className="text-[10px] text-[#86868b]">Fee</span>
                </div>
              </div>

              <p className="text-xs text-[#86868b] leading-relaxed pt-2.5 border-t border-[#e5e5ea]">
                Your token will be officially assigned by the receptionist upon payment. If another patient pays earlier, their token will be confirmed before yours.
              </p>

              {deskPhone && (
                <div className="pt-1">
                  <a
                    href={`tel:${deskPhone.replace(/\s+/g, '')}`}
                    className="w-full h-11 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm cursor-pointer"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Call Receptionist: {formatDisplayPhone(deskPhone)}</span>
                  </a>
                </div>
              )}
            </div>

            {/* Navigation Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <AppleButton
                variant="primary"
                size="lg"
                onClick={() => navigate('/patient/appointments')}
                className="w-full sm:w-auto"
              >
                View Request in My Passes
              </AppleButton>
              <AppleButton
                variant="secondary"
                size="lg"
                onClick={() => navigate('/doctors')}
                className="w-full sm:w-auto"
              >
                Back to Doctors
              </AppleButton>
            </div>
          </UtilityCard>
        </div>
      </div>
    );
  }

  // 2. Main Booking Form (Zero receptionist details exposed before confirm)
  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav title="Book Appointment">
        <AppleButton
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </AppleButton>
      </SubNav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8">
        <UtilityCard>
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Doctor Info Card */}
          <div className="flex items-center gap-4 pb-5 border-b border-[#f0f0f2]">
            <div className="w-16 h-16 rounded-full bg-white border border-[#e5e5ea] overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
              {doctor.user?.avatarUrl ? (
                <img
                  src={getFileUrl(doctor.user.avatarUrl)}
                  alt={doctor.user?.fullName || 'Doctor'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.book-doc-fallback');
                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className={`book-doc-fallback w-full h-full ${doctor.user?.avatarUrl ? 'hidden' : 'flex'} items-center justify-center font-bold text-xl text-white bg-[#0066cc] shadow-inner select-none`}
              >
                {(doctor.user?.fullName ? doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] : null) || 'D'}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#1d1d1f] tracking-tight truncate">
                  {doctor.user?.fullName || 'Doctor'}
                </h3>
                <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0" />
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0066cc]/10 text-[#0066cc]">
                  {doctor.specialty}
                </span>
                <span className="text-xs text-[#86868b] font-medium">
                  {formatDoctorDegrees(doctor.qualifications)}
                </span>
              </div>
              {selectedClinic ? (
                <p className="text-xs text-[#6e6e73] font-medium flex items-center gap-1.5 mt-1 truncate">
                  <Building2 className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />
                  <span className="truncate">{selectedClinic.clinic.clinicName}{selectedClinic.clinic.city ? ` · ${selectedClinic.clinic.city}` : ''}</span>
                </p>
              ) : null}
            </div>
          </div>

          {/* Clinic Venue Selection */}
          {!doctor.clinics || doctor.clinics.length === 0 ? (
            <div className="py-4 border-b border-[#f0f0f2]">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Doctor is not currently affiliated with an active clinic. Online booking is disabled.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-4 border-b border-[#f0f0f2]">
              <label className="block text-xs font-semibold text-[#1d1d1f] mb-2">
                Clinic
              </label>

              {doctor.clinics.length === 1 ? (
                <div className="p-3.5 rounded-2xl bg-white border border-[#0066cc] ring-2 ring-[#0066cc]/10 shadow-xs flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-[#1d1d1f] block truncate">
                      {doctor.clinics[0].clinic.clinicName}
                    </span>
                    <span className="text-xs text-[#86868b] flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="w-3 h-3 text-[#86868b] shrink-0" />
                      <span className="truncate">{doctor.clinics[0].clinic.address}{doctor.clinics[0].clinic.city ? `, ${doctor.clinics[0].clinic.city}` : ''}</span>
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full shrink-0 ml-2">
                    Fee: ₹{doctor.clinics[0].consultationFee ?? doctor.consultationFee}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {doctor.clinics.map((c) => {
                    const isSelected = selectedClinicId === c.clinicId;
                    const clinicFee = c.consultationFee ?? doctor.consultationFee;
                    return (
                      <button
                        key={c.clinicId}
                        type="button"
                        onClick={() => handleSelectClinic(c.clinicId)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white border-[#0066cc] ring-2 ring-[#0066cc]/15 shadow-xs'
                            : 'bg-[#fafafc] border-[#e5e5ea] hover:bg-white hover:border-[#d2d2d7]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-sm font-semibold text-[#1d1d1f] truncate">{c.clinic.clinicName}</span>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-[#0066cc] text-white flex items-center justify-center shrink-0">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[#86868b] flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-[#86868b] shrink-0" />
                          <span className="truncate">{c.clinic.address}{c.clinic.city ? `, ${c.clinic.city}` : ''}</span>
                        </span>
                        <div className="mt-2 pt-2 border-t border-[#f0f0f2] flex items-center justify-between text-xs">
                          <span className="text-[#86868b]">Fee</span>
                          <span className="font-semibold text-[#1d1d1f]">₹{clinicFee}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Date Picker */}
          <div className="pt-4 pb-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#1d1d1f]">Date</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAppointmentDate(getLocalDateString())}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    appointmentDate === getLocalDateString()
                      ? 'bg-[#1d1d1f] text-white'
                      : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setAppointmentDate(getTomorrowDateString())}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    appointmentDate === getTomorrowDateString()
                      ? 'bg-[#1d1d1f] text-white'
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
              className="w-full h-10 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] transition-all focus:outline-none focus:border-[#0066cc]"
            />
          </div>

          {/* Shift Selection */}
          <div className="py-4 border-b border-[#f0f0f2]">
            <label className="block text-xs font-semibold text-[#1d1d1f] mb-2">Shift</label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(queuePreview?.availableSlots || doctorSlots.map((s) => ({ slot: s }))).map((item: any) => {
                const s = item.slot;
                const isSelected = selectedSlotId === s.id;
                const slotPassed = Boolean(item.isPassed);
                const slotFull = Boolean(item.isFull);
                const cleanShiftName = s.name.replace(/\s*\([^)]*\)/, '').trim() || 'Shift';

                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={slotPassed}
                    onClick={() => setSelectedSlotId(s.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      slotPassed
                        ? 'bg-[#f5f5f7] border-[#e5e5ea] opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'bg-white border-[#0066cc] ring-2 ring-[#0066cc]/15 shadow-xs'
                        : 'bg-[#fafafc] border-[#e5e5ea] hover:bg-white hover:border-[#d2d2d7]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-[#1d1d1f] truncate">
                        {cleanShiftName}
                      </span>
                      {isSelected && !slotPassed && (
                        <span className="w-4 h-4 rounded-full bg-[#0066cc] text-white flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[#0066cc] font-medium mb-1.5">
                      {format12Hour(s.startTime)} – {format12Hour(s.endTime)}
                    </div>

                    <div>
                      {slotPassed ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                          Shift Ended
                        </span>
                      ) : slotFull ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                          Full
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          Available
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Queue Preview Tile */}
          {queuePreview && (
            <div className="my-4 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]">
              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <span className="text-[11px] text-[#86868b] block font-medium">Token No.</span>
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0066cc]">
                    {isSelectedSlotPassed ? 'Shift Ended' : `#${Math.max(1, queuePreview.nextQueueNumber || 1)}`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-[#86868b] block font-medium">Est. Time</span>
                  <span className="text-base sm:text-lg font-semibold text-[#1d1d1f]">
                    {previewLoading ? 'Updating...' : isSelectedSlotPassed ? 'Closed' : queuePreview.estimatedTime}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-[#e5e5ea] text-xs text-[#86868b] flex items-center justify-between">
                <span>{queuePreview.checkingWindow}</span>
                <span>
                  {isSelectedSlotPassed
                    ? 'Pick an upcoming shift'
                    : 'Assigned upon receptionist payment'}
                </span>
              </div>
            </div>
          )}

          {/* Booking Form */}
          <form onSubmit={handleBooking} className="space-y-4">
            {/* Booking For Toggle */}
            <div className="py-2 border-b border-[#f0f0f2] pb-4">
              <label className="block text-xs font-semibold text-[#1d1d1f] mb-2">
                Booking For:
              </label>
              <div className="flex rounded-full bg-[#f5f5f7] p-1 border border-[#e5e5ea] max-w-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => setBookingFor('myself')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    bookingFor === 'myself'
                      ? 'bg-white text-[#1d1d1f] shadow-xs'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  Myself
                </button>
                <button
                  type="button"
                  onClick={() => setBookingFor('other')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    bookingFor === 'other'
                      ? 'bg-white text-[#1d1d1f] shadow-xs'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  Someone Else
                </button>
              </div>

              {bookingFor === 'other' && (
                <div className="mt-3 p-3.5 rounded-2xl bg-[#0066cc]/5 border border-[#0066cc]/20 space-y-3">
                  <div className="text-xs font-semibold text-[#0066cc]">
                    Patient Details
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required={bookingFor === 'other'}
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="e.g. Rahul Ray"
                        className="w-full h-10 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] focus:outline-none focus:border-[#0066cc]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1">
                        Age *
                      </label>
                      <input
                        type="text"
                        required={bookingFor === 'other'}
                        value={patientAge}
                        onChange={(e) => setPatientAge(e.target.value)}
                        placeholder="e.g. 24"
                        className="w-full h-10 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] focus:outline-none focus:border-[#0066cc]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1">
                        Gender
                      </label>
                      <select
                        value={patientGender}
                        onChange={(e) => setPatientGender(e.target.value)}
                        className="w-full h-10 px-2.5 rounded-xl border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] focus:outline-none focus:border-[#0066cc]"
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
              <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                Reason for Visit
              </label>
              <input
                type="text"
                value={reasonForVisit}
                onChange={(e) => setReasonForVisit(e.target.value)}
                placeholder="e.g. Checkup, consultation, follow-up"
                className="w-full h-10 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] focus:outline-none focus:border-[#0066cc]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                Symptoms <span className="text-[#86868b] font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Describe any symptoms (optional)..."
                className="w-full p-3 rounded-xl border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] resize-none"
              ></textarea>
            </div>

            {/* Fee & Confirmation Notice (ZERO receptionist contact exposed before button click!) */}
            <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#86868b]">Consultation Fee</span>
                <span className="text-base font-semibold text-[#1d1d1f]">₹{activeFee}</span>
              </div>
              <p className="text-[11px] text-[#86868b] leading-relaxed">
                Fee is paid directly to the receptionist to confirm your token. Unconfirmed requests may be claimed by other patients who confirm first.
              </p>
            </div>

            {isSelectedSlotPassed && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                This shift has ended for today. Pick an upcoming shift or future date.
              </div>
            )}

            {isSelectedSlotFull && !isSelectedSlotPassed && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                Shift is full. Select another slot or date.
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <AppleButton
                variant="primary"
                size="lg"
                type="submit"
                disabled={submitting || isSelectedSlotPassed || isSelectedSlotFull || !doctor.clinics || doctor.clinics.length === 0}
                className="w-full sm:w-auto font-semibold"
              >
                {!doctor.clinics || doctor.clinics.length === 0
                  ? 'Booking Unavailable'
                  : submitting
                  ? 'Submitting Request...'
                  : isSelectedSlotPassed
                  ? 'Shift Ended'
                  : isSelectedSlotFull
                  ? 'Shift Full'
                  : `Submit Request to Receptionist (₹${activeFee})`}
              </AppleButton>
            </div>
          </form>
        </UtilityCard>
      </div>
    </div>
  );
};
