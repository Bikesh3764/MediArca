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
  ShieldCheck,
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

    if (doctor.receptionists && doctor.receptionists.length > 0) {
      doctor.receptionists.forEach((r) => {
        if (!selectedClinicId || !r.clinicId || r.clinicId === selectedClinicId) {
          if (!list.some((item) => (r.phone && item.phone === r.phone) || item.name === r.name)) {
            list.push({
              id: r.id,
              name: r.name,
              phone: r.phone || undefined,
              clinicName: r.clinicName || selectedClinic?.clinic.clinicName,
            });
          }
        }
      });
    }

    if (selectedClinic?.receptionists && selectedClinic.receptionists.length > 0) {
      selectedClinic.receptionists.forEach((r) => {
        if (!list.some((item) => (r.phone && item.phone === r.phone) || item.name === r.name)) {
          list.push({
            id: r.id,
            name: r.name,
            phone: r.phone || undefined,
            clinicName: selectedClinic.clinic.clinicName,
          });
        }
      });
    }

    return list;
  }, [doctor, selectedClinic, selectedClinicId]);

  const hasActiveReceptionist = Boolean(
    (queuePreview && typeof queuePreview.hasReceptionist === 'boolean')
      ? queuePreview.hasReceptionist
      : (attachedReceptionists.length > 0 || selectedClinic?.hasReceptionist)
  );

  useEffect(() => {
    const fetchDoctor = async () => {
      if (!id) return;
      try {
        const data = await api.getDoctorById(id);
        setDoctor(data);

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

    if (!hasActiveReceptionist) {
      setError('Online booking is unavailable because no front-desk receptionist is currently assigned at this facility.');
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
        <p className="text-secondary">Loading booking...</p>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center py-20 px-4">
        <div className="apple-card text-center p-8 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-[#ff3b30]/10 text-[#ff3b30] flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-section-title mb-2">Doctor Not Found</h2>
          <p className="text-secondary mb-6">The requested doctor is unavailable or inactive.</p>
          <AppleButton variant="primary" onClick={() => navigate('/doctors')}>
            Back to Directory
          </AppleButton>
        </div>
      </div>
    );
  }

  const isSelectedSlotPassed = Boolean(queuePreview?.isPassed);
  const isSelectedSlotFull = Boolean(queuePreview?.isFull);

  const primaryReceptionist = attachedReceptionists[0];
  const deskPhone = confirmedAppointment?.receptionistPhone || primaryReceptionist?.phone || null;
  const deskName = confirmedAppointment?.receptionistName || primaryReceptionist?.name || 'Clinic Front Desk';

  // 1. Post-Booking Success & Receptionist Details Screen
  if (confirmedAppointment) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] pb-20">
        <SubNav title="Appointment Requested" subtitle={doctor.user?.fullName || 'Doctor'}>
          <AppleButton variant="ghost" size="sm" onClick={() => navigate('/doctors')}>
            <ChevronLeft className="w-4 h-4" />
            <span>Doctors</span>
          </AppleButton>
        </SubNav>

        <div className="max-w-xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
          <UtilityCard className="p-6 sm:p-8 text-center space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center mx-auto">
              <Clock className="w-7 h-7" />
            </div>

            <div>
              <span className="text-meta uppercase tracking-wider font-semibold text-[#0066cc] block mb-1">
                Request Submitted
              </span>
              <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-[#1d1d1f]">
                Pending Receptionist Confirmation
              </h2>
              <p className="text-secondary mt-1">
                {confirmedAppointment.appointmentDate} · {confirmedAppointment.checkingWindow}
              </p>

              <div className="mt-4 inline-flex items-baseline gap-2.5 px-5 py-2 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]">
                <span className="text-meta uppercase tracking-wider font-semibold">Estimated Token</span>
                <span className="text-2xl font-bold text-[#0066cc] tracking-tight">
                  #{confirmedAppointment.estimatedQueueNumber || (confirmedAppointment.queueNumber > 0 ? confirmedAppointment.queueNumber : 1)}
                </span>
              </div>
            </div>

            {/* Receptionist Contact Details Card */}
            <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-left space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider block">
                    Pay Receptionist to Confirm
                  </span>
                  <h4 className="text-[15px] font-bold text-[#1d1d1f] mt-0.5">
                    {deskName}
                  </h4>
                  <p className="text-xs text-[#6e6e73] mt-0.5">
                    {selectedClinic?.clinic.clinicName} · {selectedClinic?.clinic.address}
                    {selectedClinic?.clinic.city ? `, ${selectedClinic.clinic.city}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-lg font-bold text-[#1d1d1f] block">₹{activeFee}</span>
                  <span className="text-meta">Consultation Fee</span>
                </div>
              </div>

              <p className="text-xs text-[#6e6e73] leading-relaxed pt-3 border-t border-[#e5e5ea]">
                Your token is officially assigned by the receptionist upon payment. If another patient confirms earlier, their token will be assigned first.
              </p>

              {deskPhone ? (
                <div className="pt-1">
                  <a
                    href={`tel:${deskPhone.replace(/\s+/g, '')}`}
                    className="w-full h-11 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-[14px] font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Call Receptionist: {formatDisplayPhone(deskPhone)}</span>
                  </a>
                </div>
              ) : (
                <div className="pt-1 text-center text-xs text-[#6e6e73]">
                  Please visit the clinic front desk in person to pay the consultation fee and confirm your token.
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

  // 2. Main Booking Sequence: Doctor -> Clinic -> Date -> Shift -> Patient Details -> Confirmation
  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-20">
      <SubNav title="Book Appointment" subtitle={doctor.user?.fullName || 'Doctor'}>
        <AppleButton variant="ghost" size="sm" onClick={handleBack}>
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </AppleButton>
      </SubNav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        <UtilityCard className="p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-[#ff3b30]/8 border border-[#ff3b30]/20 text-[#d70015] text-[13px] font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 0: Doctor Summary Header */}
          <div className="flex items-center gap-4 pb-6 border-b border-[#e5e5ea]/80">
            <div className="w-16 h-16 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden shrink-0 flex items-center justify-center">
              {doctor.user?.avatarUrl ? (
                <img
                  src={getFileUrl(doctor.user.avatarUrl)}
                  alt={doctor.user?.fullName || 'Doctor'}
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.book-doc-fallback');
                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className={`book-doc-fallback w-full h-full ${
                  doctor.user?.avatarUrl ? 'hidden' : 'flex'
                } items-center justify-center font-bold text-xl text-white bg-[#0066cc] select-none`}
              >
                {(doctor.user?.fullName ? doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] : null) || 'D'}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-[18px] font-bold text-[#1d1d1f] tracking-tight truncate">
                  {doctor.user?.fullName || 'Doctor'}
                </h3>
                <ShieldCheck className="w-4 h-4 text-[#0066cc] shrink-0" />
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0066cc]/10 text-[#0066cc]">
                  {doctor.specialty}
                </span>
                <span className="text-xs text-[#6e6e73] font-medium">
                  {formatDoctorDegrees(doctor.qualifications)}
                </span>
              </div>
              {selectedClinic && (
                <p className="text-xs text-[#6e6e73] flex items-center gap-1.5 mt-1.5 truncate">
                  <Building2 className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                  <span className="truncate">
                    {selectedClinic.clinic.clinicName}
                    {selectedClinic.clinic.city ? ` · ${selectedClinic.clinic.city}` : ''}
                  </span>
                </p>
              )}
            </div>
          </div>

          <form onSubmit={handleBooking} className="divide-y divide-[#e5e5ea]/80">
            {/* Step 1: Clinic Venue Selection */}
            <div className="py-6">
              <label className="ui-label">1. Select Clinic</label>

              {!doctor.clinics || doctor.clinics.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Doctor is not currently affiliated with an active clinic. Online booking is disabled.
                  </p>
                </div>
              ) : doctor.clinics.length === 1 ? (
                <div className="p-4 rounded-xl bg-[#0066cc]/[0.03] border border-[#0066cc] ring-2 ring-[#0066cc]/12 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[14px] font-semibold text-[#1d1d1f] block truncate">
                      {doctor.clinics[0].clinic.clinicName}
                    </span>
                    <span className="text-xs text-[#6e6e73] flex items-center gap-1.5 mt-1 truncate">
                      <MapPin className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                      <span className="truncate">
                        {doctor.clinics[0].clinic.address}
                        {doctor.clinics[0].clinic.city ? `, ${doctor.clinics[0].clinic.city}` : ''}
                      </span>
                    </span>
                  </div>
                  <span className="text-[13px] font-semibold text-[#1d1d1f] bg-white border border-[#e5e5ea] px-3 py-1 rounded-full shrink-0">
                    ₹{doctor.clinics[0].consultationFee ?? doctor.consultationFee}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {doctor.clinics.map((c) => {
                    const isSelected = selectedClinicId === c.clinicId;
                    const clinicFee = c.consultationFee ?? doctor.consultationFee;
                    return (
                      <button
                        key={c.clinicId}
                        type="button"
                        onClick={() => handleSelectClinic(c.clinicId)}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#0066cc]/[0.03] border-[#0066cc] ring-2 ring-[#0066cc]/12'
                            : 'bg-[#f5f5f7]/60 border-[#e5e5ea] hover:bg-white hover:border-[#d2d2d7]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[14px] font-semibold text-[#1d1d1f] truncate">
                            {c.clinic.clinicName}
                          </span>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-[#0066cc] text-white flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[#6e6e73] flex items-center gap-1 truncate">
                          <MapPin className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                          <span className="truncate">
                            {c.clinic.address}
                            {c.clinic.city ? `, ${c.clinic.city}` : ''}
                          </span>
                        </span>
                        <div className="mt-3 pt-2.5 border-t border-[#e5e5ea]/70 flex items-center justify-between text-xs">
                          <span className="text-[#86868b]">Fee</span>
                          <span className="font-semibold text-[#1d1d1f]">₹{clinicFee}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2: Date Selection */}
            <div className="py-6">
              <div className="flex items-center justify-between mb-2">
                <label className="ui-label mb-0">2. Select Date</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAppointmentDate(getLocalDateString())}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      appointmentDate === getLocalDateString()
                        ? 'bg-[#1d1d1f] text-white'
                        : 'bg-[#f5f5f7] text-[#6e6e73] hover:text-[#1d1d1f]'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppointmentDate(getTomorrowDateString())}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      appointmentDate === getTomorrowDateString()
                        ? 'bg-[#1d1d1f] text-white'
                        : 'bg-[#f5f5f7] text-[#6e6e73] hover:text-[#1d1d1f]'
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
                className="ui-input"
              />
            </div>

            {/* Step 3: Shift / Slot Selection & Live Queue Preview */}
            <div className="py-6">
              <label className="ui-label">3. Select Shift</label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      className={`p-4 rounded-xl border text-left transition-all ${
                        slotPassed
                          ? 'bg-[#f5f5f7] border-[#e5e5ea] opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#0066cc]/[0.03] border-[#0066cc] ring-2 ring-[#0066cc]/12 cursor-pointer'
                          : 'bg-[#f5f5f7]/60 border-[#e5e5ea] hover:bg-white hover:border-[#d2d2d7] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[14px] font-semibold text-[#1d1d1f] truncate">
                          {cleanShiftName}
                        </span>
                        {isSelected && !slotPassed && (
                          <span className="w-5 h-5 rounded-full bg-[#0066cc] text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <div className="text-[13px] text-[#0066cc] font-medium mb-2.5">
                        {format12Hour(s.startTime)} – {format12Hour(s.endTime)}
                      </div>

                      <div>
                        {slotPassed ? (
                          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#e5e5ea] text-[#6e6e73]">
                            Shift Ended
                          </span>
                        ) : slotFull ? (
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#ff3b30]/10 text-[#d70015]">
                            Full
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            Available
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Live Queue Preview Banner */}
              {queuePreview && (
                <div className="mt-4 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]">
                  <div className="flex items-baseline justify-between mb-2">
                    <div>
                      <span className="text-meta block">Estimated Token</span>
                      <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0066cc]">
                        {isSelectedSlotPassed ? 'Shift Ended' : `#${Math.max(1, queuePreview.nextQueueNumber || 1)}`}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-meta block">Est. Consultation Time</span>
                      <span className="text-base sm:text-lg font-semibold text-[#1d1d1f]">
                        {previewLoading ? 'Updating...' : isSelectedSlotPassed ? 'Closed' : queuePreview.estimatedTime}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2.5 border-t border-[#e5e5ea] text-xs text-[#6e6e73] flex items-center justify-between">
                    <span>{queuePreview.checkingWindow}</span>
                    <span>
                      {isSelectedSlotPassed
                        ? 'Pick an upcoming shift'
                        : 'Assigned upon receptionist payment'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 4: Patient & Visit Information */}
            <div className="py-6 space-y-5">
              <div>
                <label className="ui-label">4. Patient Details</label>
                <div className="inline-flex rounded-full bg-[#f5f5f7] p-1 border border-[#e5e5ea] w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setBookingFor('myself')}
                    className={`flex-1 sm:flex-initial px-5 py-1.5 text-[13px] font-semibold rounded-full transition-all cursor-pointer ${
                      bookingFor === 'myself'
                        ? 'bg-white text-[#1d1d1f] shadow-2xs'
                        : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                    }`}
                  >
                    Myself
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingFor('other')}
                    className={`flex-1 sm:flex-initial px-5 py-1.5 text-[13px] font-semibold rounded-full transition-all cursor-pointer ${
                      bookingFor === 'other'
                        ? 'bg-white text-[#1d1d1f] shadow-2xs'
                        : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                    }`}
                  >
                    Someone Else
                  </button>
                </div>

                {bookingFor === 'other' && (
                  <div className="mt-4 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-1">
                      <label className="ui-label">Full Name *</label>
                      <input
                        type="text"
                        required={bookingFor === 'other'}
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="e.g. Rahul Ray"
                        className="ui-input"
                      />
                    </div>
                    <div>
                      <label className="ui-label">Age *</label>
                      <input
                        type="text"
                        required={bookingFor === 'other'}
                        value={patientAge}
                        onChange={(e) => setPatientAge(e.target.value)}
                        placeholder="e.g. 24"
                        className="ui-input"
                      />
                    </div>
                    <div>
                      <label className="ui-label">Gender</label>
                      <select
                        value={patientGender}
                        onChange={(e) => setPatientGender(e.target.value)}
                        className="ui-select"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="ui-label">Reason for Visit</label>
                  <input
                    type="text"
                    value={reasonForVisit}
                    onChange={(e) => setReasonForVisit(e.target.value)}
                    placeholder="e.g. General consultation, checkup, follow-up"
                    className="ui-input"
                  />
                </div>

                <div>
                  <label className="ui-label">
                    Symptoms <span className="text-[#86868b] font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="Describe any symptoms..."
                    className="ui-textarea resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Step 5: Confirmation */}
            <div className="pt-6 space-y-4">
              <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium text-[#1d1d1f]">Consultation Fee</span>
                  <span className="text-lg font-bold text-[#1d1d1f]">₹{activeFee}</span>
                </div>
                <p className="text-meta leading-relaxed">
                  Paid directly to the clinic receptionist to confirm your token. Unconfirmed requests may be claimed by patients who confirm earlier.
                </p>
              </div>

              {!hasActiveReceptionist && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-amber-950 mb-0.5">Booking Unavailable at this Clinic</span>
                    Online queue booking is closed for this doctor at {selectedClinic?.clinic.clinicName || 'this facility'} because no front-desk receptionist is currently assigned.
                  </div>
                </div>
              )}

              {isSelectedSlotPassed && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs">
                  This shift has ended for today. Please select an upcoming shift or a future date.
                </div>
              )}

              {isSelectedSlotFull && !isSelectedSlotPassed && (
                <div className="p-3 rounded-xl bg-[#ff3b30]/8 border border-[#ff3b30]/20 text-[#d70015] text-xs">
                  This shift is full. Please select another slot or date.
                </div>
              )}

              <AppleButton
                variant="primary"
                size="lg"
                type="submit"
                disabled={
                  submitting ||
                  isSelectedSlotPassed ||
                  isSelectedSlotFull ||
                  !doctor.clinics ||
                  doctor.clinics.length === 0 ||
                  !hasActiveReceptionist
                }
                className="w-full"
              >
                {!doctor.clinics || doctor.clinics.length === 0
                  ? 'Booking Unavailable'
                  : !hasActiveReceptionist
                  ? 'Booking Unavailable (No Desk Staff)'
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
