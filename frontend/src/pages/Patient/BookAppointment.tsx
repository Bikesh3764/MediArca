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
  cleanSlotName,
} from '../../services/api';
import { formatDisplayPhone, toTelUri } from '../../utils/phoneUtils';
import { useAuth } from '../../context/AuthContext';
import { SubNav } from '../../components/layout/SubNav';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronDown,
  Check,
  Building2,
  MapPin,
  Phone,
} from 'lucide-react';

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

  const isSelectedSlotOnLeave = Boolean(queuePreview?.isOnLeave);
  const isSelectedSlotDayOff = Boolean(queuePreview?.isDayOff);
  const isSelectedSlotPassed = Boolean(queuePreview?.isPassed && !isSelectedSlotOnLeave && !isSelectedSlotDayOff);
  const isSelectedSlotFull = Boolean(queuePreview?.isFull);

  const attachedReceptionists = React.useMemo(() => {
    if (!doctor) return [];
    const list: Array<{ id: string; name: string; phone?: string; clinicName?: string }> = [];

    // 1. Doctor-assigned receptionists for this clinic
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

    // 2. Selected clinic's receptionists assigned to this doctor
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

        // Preselect clinic if provided via query params or pick first available clinic (prioritize staffed clinics)
        if (data.clinics && data.clinics.length > 0) {
          const sortedClinics = [...data.clinics].sort((a, b) => {
            if (a.hasReceptionist && !b.hasReceptionist) return -1;
            if (!a.hasReceptionist && b.hasReceptionist) return 1;
            return 0;
          });
          data.clinics = sortedClinics;
          const matchedClinic = initialClinic ? sortedClinics.find((c: any) => c.clinicId === initialClinic) : null;
          const targetClinic = matchedClinic || sortedClinics[0];
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
      setError('This doctor isn’t taking bookings right now.');
      setSubmitting(false);
      return;
    }

    if (doctor.clinics!.length > 1 && !selectedClinicId) {
      setError('Please select a clinic venue.');
      setSubmitting(false);
      return;
    }

    if (!hasActiveReceptionist) {
      setError('Online booking is closed at this clinic for now.');
      setSubmitting(false);
      return;
    }

    if (isSelectedSlotOnLeave) {
      setError(`Dr. ${doctor.user?.fullName || 'the doctor'} is on leave on this date${queuePreview?.leaveReason ? ` (${queuePreview.leaveReason})` : ''}. Please pick another date.`);
      setSubmitting(false);
      return;
    }

    if (isSelectedSlotDayOff) {
      setError(`Dr. ${doctor.user?.fullName || 'the doctor'} does not consult on ${queuePreview?.dayName || 'this day'}s at this clinic facility. Available sitting days: ${(queuePreview?.workingDays || ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']).join(', ')}.`);
      setSubmitting(false);
      return;
    }

    if (isSelectedSlotPassed) {
      setError('This shift has ended. Pick another shift or day.');
      setSubmitting(false);
      return;
    }

    if (isSelectedSlotFull) {
      setError('This shift is full. Pick another shift or day.');
      setSubmitting(false);
      return;
    }

    const isForOther = bookingFor === 'other';
    if (isForOther) {
      if (!patientName.trim()) {
        setError('Please provide the patient full name.');
        setSubmitting(false);
        return;
      }
      if (!patientAge.trim()) {
        setError('Please provide the patient age.');
        setSubmitting(false);
        return;
      }
      const parsedAge = parseInt(patientAge.trim(), 10);
      if (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 125) {
        setError('Please enter a valid patient age between 0 and 125.');
        setSubmitting(false);
        return;
      }
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
        <p className="text-xs text-[#86868b]">Loading…</p>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center py-20 px-4">
        <div className="text-center p-8 bg-white rounded-2xl  border border-[#e5e5ea] max-w-md mx-auto">
          <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">Doctor Not Found</h2>
          <p className="text-xs text-[#86868b] mb-6">The requested doctor is unavailable or inactive.</p>
          <AppleButton variant="primary" onClick={() => navigate('/doctors')}>
            Back to Directory
          </AppleButton>
        </div>
      </div>
    );
  }

  // Receptionist Contact Info resolved for confirmation screen
  const primaryReceptionist = attachedReceptionists[0];
  const receptionistPhone = confirmedAppointment?.receptionistPhone || primaryReceptionist?.phone || null;
  const clinicPhone = confirmedAppointment?.clinic?.phone || selectedClinic?.clinic?.phone || null;
  const deskPhone = receptionistPhone || clinicPhone;

  const deskName =
    confirmedAppointment?.receptionistName ||
    primaryReceptionist?.name ||
    (confirmedAppointment?.clinic?.clinicName
      ? `${confirmedAppointment.clinic.clinicName} Front Desk`
      : selectedClinic?.clinic?.clinicName
      ? `${selectedClinic.clinic.clinicName} Front Desk`
      : 'Front Desk Receptionist');

  // 1. Post-Booking Success & Receptionist Details Screen
  if (confirmedAppointment) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] pb-24 md:pb-16 pb-safe">
        <SubNav title="Requested" width="2xl">
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
            <div>
              <span className="text-xs font-normal text-[#0066cc] block mb-1">
                Request Submitted
              </span>
              <h2 className="text-[22px] sm:text-2xl font-semibold tracking-tight text-[#1d1d1f] leading-snug">
                Pending Receptionist Confirmation
              </h2>
              <p className="text-xs text-[#86868b] mt-1 font-normal">
                {confirmedAppointment.appointmentDate} · {cleanSlotName(confirmedAppointment.checkingWindow)}
              </p>
              <div className="mt-3.5 inline-flex items-baseline gap-2 px-4 py-1.5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]">
                <span className="text-xs font-normal text-[#86868b]">Estimated Token</span>
                <span className="text-xl font-bold text-[#0066cc] tracking-tight">
                  #{confirmedAppointment.estimatedQueueNumber || (confirmedAppointment.queueNumber > 0 ? confirmedAppointment.queueNumber : 1)}
                </span>
              </div>
            </div>

            {/* Receptionist Contact Details Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-left space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-normal text-[#86868b] block">
                    Pay Receptionist to Confirm
                  </span>
                  <h4 className="text-base font-semibold text-[#1d1d1f] mt-0.5 tracking-tight">
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
                  <span className="text-[11px] text-[#86868b]">Fee</span>
                </div>
              </div>

              <p className="text-xs text-[#86868b] leading-relaxed pt-2.5 border-t border-[#e5e5ea]">
                Your token is confirmed when you pay. Call the receptionist to pay by UPI, or pay at the desk. Whoever pays first is confirmed first.
              </p>

              {deskPhone ? (
                <div className="pt-1">
                  <a
                    href={toTelUri(deskPhone)}
                    className="w-full h-11 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-sm font-normal flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-150  cursor-pointer select-none"
                  >
                    <Phone className="w-4 h-4 shrink-0" />
                    <span className="truncate">Call {deskName}: {formatDisplayPhone(deskPhone)}</span>
                  </a>
                </div>
              ) : (
                <div className="pt-1 text-center text-xs text-[#86868b]">
                  Pay at the front desk to confirm your token.
                </div>
              )}
            </div>

            {/* Navigation Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/patient/appointments')}
                className="w-full sm:w-auto h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center cursor-pointer select-none"
              >
                View Request in My Passes
              </button>
              <button
                type="button"
                onClick={() => navigate('/doctors')}
                className="w-full sm:w-auto h-11 px-6 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] active:scale-[0.98] text-[#1d1d1f] border border-[#e5e5ea] text-sm font-normal transition-all duration-150 flex items-center justify-center cursor-pointer select-none"
              >
                Back to Doctors
              </button>
            </div>
          </UtilityCard>
        </div>
      </div>
    );
  }

  // 2. Main Booking Form (Zero receptionist details exposed before confirm)
  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-24 md:pb-16 pb-safe">
      <SubNav title="Book Appointment" width="2xl">
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
            <div className="mb-5 p-3.5 rounded-2xl bg-danger-soft/80 border border-danger-line/80 text-danger text-xs font-normal flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Doctor Info Card */}
          <div className="flex items-center gap-4 pb-5 border-b border-[#f0f0f2]">
            <div className="w-16 h-16 rounded-full bg-white border border-[#e5e5ea] overflow-hidden shrink-0 flex items-center justify-center ">
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
                className={`book-doc-fallback w-full h-full ${doctor.user?.avatarUrl ? 'hidden' : 'flex'} items-center justify-center font-bold text-xl text-white bg-[#0066cc]  select-none`}
              >
                {(doctor.user?.fullName ? doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] : null) || 'D'}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight truncate leading-snug">
                  {doctor.user?.fullName || 'Doctor'}
                </h3>
                <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0" />
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0066cc]/10 text-[#0066cc]">
                  {doctor.specialty}
                </span>
                <span className="text-xs text-[#86868b] font-normal">
                  {formatDoctorDegrees(doctor.qualifications)}
                </span>
              </div>
              {selectedClinic ? (
                <p className="text-xs text-[#6e6e73] font-normal flex items-center gap-1.5 mt-1 truncate">
                  <Building2 className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />
                  <span className="truncate">{selectedClinic.clinic.clinicName}{selectedClinic.clinic.city ? ` · ${selectedClinic.clinic.city}` : ''}</span>
                </p>
              ) : null}
            </div>
          </div>

          {/* Clinic Venue Selection */}
          {!doctor.clinics || doctor.clinics.length === 0 ? (
            <div className="py-4 border-b border-[#f0f0f2]">
              <div className="p-3.5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-[#86868b] shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[#86868b]">
                  This doctor isn’t taking bookings right now.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-4 border-b border-[#f0f0f2]">
              <label className="block text-xs font-normal text-[#1d1d1f] mb-2 tracking-tight">
                Clinic
              </label>

              {doctor.clinics.length === 1 ? (
                <div className="p-3.5 rounded-2xl bg-white border border-[#0066cc] ring-4 ring-[#0066cc]/10 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#1d1d1f] truncate">
                        {doctor.clinics[0].clinic.clinicName}
                      </span>
                      {doctor.clinics[0].hasReceptionist ? (
                        <span className="text-[11px] font-normal text-success bg-success-soft border border-success-line/60 px-2 py-0.5 rounded-full shrink-0">
                          Desk Active
                        </span>
                      ) : (
                        <span className="text-[11px] font-normal text-warning bg-warning-soft border border-warning-line/60 px-2 py-0.5 rounded-full shrink-0">
                          Desk Offline
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#86868b] flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="w-3 h-3 text-[#86868b] shrink-0" />
                      <span className="truncate">{doctor.clinics[0].clinic.address}{doctor.clinics[0].clinic.city ? `, ${doctor.clinics[0].clinic.city}` : ''}</span>
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] px-3 py-1 rounded-full shrink-0 ml-2">
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
                        className={`p-3.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? 'bg-white border-[#0066cc] ring-4 ring-[#0066cc]/10'
                            : 'bg-[#f5f5f7]/60 border-[#e5e5ea] hover:bg-white hover:border-[#d2d2d7]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-sm font-semibold text-[#1d1d1f] truncate">{c.clinic.clinicName}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {c.hasReceptionist ? (
                              <span className="text-[11px] font-normal text-success bg-success-soft border border-success-line/60 px-2 py-0.5 rounded-full">
                                Desk Active
                              </span>
                            ) : (
                              <span className="text-[11px] font-normal text-warning bg-warning-soft border border-warning-line/60 px-2 py-0.5 rounded-full">
                                Desk Offline
                              </span>
                            )}
                            {isSelected && (
                              <span className="w-4 h-4 rounded-full bg-[#0066cc] text-white flex items-center justify-center shrink-0">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-[#86868b] flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-[#86868b] shrink-0" />
                          <span className="truncate">
                            {c.clinic.address}
                            {c.clinic.city && !c.clinic.address.toLowerCase().includes(c.clinic.city.toLowerCase()) ? `, ${c.clinic.city}` : ''}
                          </span>
                        </span>
                        <div className="mt-2 pt-2 border-t border-[#e5e5ea] flex items-center justify-between text-xs">
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
              <label className="text-xs font-normal text-[#1d1d1f] tracking-tight">Date</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAppointmentDate(getLocalDateString())}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-normal transition-all duration-150 cursor-pointer border ${
                    appointmentDate === getLocalDateString()
                      ? 'bg-[#0066cc] text-white border-[#0066cc]'
                      : 'bg-[#f5f5f7] text-[#1d1d1f] border-[#e5e5ea] hover:bg-[#e8e8ed]'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setAppointmentDate(getTomorrowDateString())}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-normal transition-all duration-150 cursor-pointer border ${
                    appointmentDate === getTomorrowDateString()
                      ? 'bg-[#0066cc] text-white border-[#0066cc]'
                      : 'bg-[#f5f5f7] text-[#1d1d1f] border-[#e5e5ea] hover:bg-[#e8e8ed]'
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
              className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
            />
          </div>

          {/* Shift Selection */}
          <div className="py-4 border-b border-[#f0f0f2]">
            <label className="block text-xs font-normal text-[#1d1d1f] mb-2 tracking-tight">Shift</label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(queuePreview?.availableSlots || doctorSlots.map((s) => ({ slot: s }))).map((item: any) => {
                const s = item.slot;
                const isSelected = selectedSlotId === s.id;
                const itemOnLeave = Boolean(item.isOnLeave);
                const itemDayOff = Boolean(item.isDayOff);
                const slotPassed = Boolean(item.isPassed && !itemOnLeave && !itemDayOff);
                const slotFull = Boolean(item.isFull);
                const cleanShiftName = s.name.replace(/\s*\([^)]*\)/, '').trim() || 'Shift';

                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={slotPassed || slotFull || itemOnLeave || itemDayOff}
                    onClick={() => setSelectedSlotId(s.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer ${
                      slotPassed || slotFull || itemOnLeave || itemDayOff
                        ? 'bg-[#f5f5f7] border-[#e5e5ea] opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'bg-white border-[#0066cc] ring-4 ring-[#0066cc]/10'
                        : 'bg-[#f5f5f7]/60 border-[#e5e5ea] hover:bg-white hover:border-[#d2d2d7]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-[#1d1d1f] truncate">
                        {cleanShiftName}
                      </span>
                      {isSelected && !slotPassed && !itemOnLeave && !itemDayOff && (
                        <span className="w-4 h-4 rounded-full bg-[#0066cc] text-white flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[#0066cc] font-normal mb-1.5">
                      {format12Hour(s.startTime)} – {format12Hour(s.endTime)}
                    </div>

                    <div>
                      {itemOnLeave ? (
                        <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-warning-soft border border-warning-line text-warning">
                          Doctor on Leave
                        </span>
                      ) : itemDayOff ? (
                        <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#86868b]">
                          Not Sitting
                        </span>
                      ) : slotPassed ? (
                        <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#86868b]">
                          Shift Ended
                        </span>
                      ) : slotFull ? (
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-danger-soft/80 border border-danger-line/80 text-danger">
                          Full
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0066cc]/8 border border-[#0066cc]/15 text-[#0066cc]">
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
                  <span className="text-[11px] text-[#86868b] block font-normal">Token No.</span>
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0066cc]">
                    {isSelectedSlotOnLeave
                      ? 'On Leave'
                      : isSelectedSlotDayOff
                      ? 'Not Sitting'
                      : isSelectedSlotPassed
                      ? 'Shift Ended'
                      : `#${Math.max(1, queuePreview.nextQueueNumber || 1)}`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-[#86868b] block font-normal">Est. Time</span>
                  <span className="text-base sm:text-lg font-semibold text-[#1d1d1f]">
                    {previewLoading
                      ? 'Updating...'
                      : isSelectedSlotOnLeave
                      ? 'Doctor on Leave'
                      : isSelectedSlotDayOff
                      ? 'Not Sitting on this Day'
                      : isSelectedSlotPassed
                      ? 'Closed'
                      : queuePreview.estimatedTime}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-[#e5e5ea] text-xs text-[#86868b] flex items-center justify-between">
                <span>{cleanSlotName(queuePreview.checkingWindow)}</span>
                <span>
                  {isSelectedSlotOnLeave
                    ? 'Doctor on leave on this date'
                    : isSelectedSlotDayOff
                    ? `Not sitting on ${queuePreview.dayName || 'this day'}s`
                    : isSelectedSlotPassed
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
              <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                Booking For
              </label>
              <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-full flex gap-0.5 max-w-xs select-none">
                <button
                  type="button"
                  onClick={() => setBookingFor('myself')}
                  className={`flex-1 h-9 text-[13px] rounded-full transition-all duration-150 cursor-pointer ${
                    bookingFor === 'myself'
                      ? 'bg-white text-[#1d1d1f] font-semibold  border border-black/5'
                      : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
                  }`}
                >
                  Myself
                </button>
                <button
                  type="button"
                  onClick={() => setBookingFor('other')}
                  className={`flex-1 h-9 text-[13px] rounded-full transition-all duration-150 cursor-pointer ${
                    bookingFor === 'other'
                      ? 'bg-white text-[#1d1d1f] font-semibold  border border-black/5'
                      : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
                  }`}
                >
                  Someone Else
                </button>
              </div>

              {bookingFor === 'other' && (
                <div className="mt-3 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-3">
                  <div className="text-xs font-semibold text-[#1d1d1f] tracking-tight">
                    Patient Details
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                        Full Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        required={bookingFor === 'other'}
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="e.g. Rahul Ray"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                        Age <span className="text-danger">*</span>
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        required={bookingFor === 'other'}
                        value={patientAge}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 3);
                          setPatientAge(digitsOnly);
                        }}
                        placeholder="e.g. 24"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                        Gender
                      </label>
                      <div className="relative">
                        <select
                          value={patientGender}
                          onChange={(e) => setPatientGender(e.target.value)}
                          className="w-full h-11 pl-3.5 pr-9 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 appearance-none cursor-pointer"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                Reason for Visit
              </label>
              <input
                type="text"
                value={reasonForVisit}
                onChange={(e) => setReasonForVisit(e.target.value)}
                placeholder="e.g. Checkup, consultation, follow-up"
                className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
              />
            </div>

            <div>
              <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                Symptoms <span className="text-[#86868b] font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Describe any symptoms (optional)..."
                className="w-full p-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 resize-none"
              ></textarea>
            </div>

            {/* Fee & Confirmation Notice */}
            <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#86868b]">Consultation Fee</span>
                <span className="text-base font-semibold text-[#1d1d1f]">₹{activeFee}</span>
              </div>
              <p className="text-[11px] text-[#86868b] leading-relaxed">
                Pay the receptionist by UPI over a call, or at the desk, to confirm your token. Whoever pays first is confirmed first.
              </p>
            </div>

            {!hasActiveReceptionist && (
              <div className="p-3.5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-[#86868b] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-[#1d1d1f] mb-0.5">Booking Unavailable at this Clinic</span>
                  <span className="text-[#86868b]">
                    Online queue booking is currently closed for this doctor at {selectedClinic?.clinic.clinicName || 'this facility'} at this clinic for now.
                  </span>
                </div>
              </div>
            )}

            {isSelectedSlotOnLeave && (
              <div className="p-3 rounded-xl bg-warning-soft/80 border border-warning-line/80 text-warning text-xs">
                Doctor is on leave on this date{queuePreview?.leaveReason ? ` (${queuePreview.leaveReason})` : ''}. Please pick another date.
              </div>
            )}

            {isSelectedSlotDayOff && (
              <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs">
                Doctor does not consult on {queuePreview?.dayName || 'this day'}s at this clinic facility. Available sitting days: {(queuePreview?.workingDays || ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']).join(', ')}.
              </div>
            )}

            {isSelectedSlotPassed && (
              <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs">
                This shift has ended for today. Pick an upcoming shift or future date.
              </div>
            )}

            {isSelectedSlotFull && !isSelectedSlotPassed && !isSelectedSlotOnLeave && !isSelectedSlotDayOff && (
              <div className="p-3 rounded-xl bg-danger-soft/80 border border-danger-line/80 text-danger text-xs">
                Shift is full. Select another slot or date.
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting || isSelectedSlotOnLeave || isSelectedSlotDayOff || isSelectedSlotPassed || isSelectedSlotFull || !doctor.clinics || doctor.clinics.length === 0 || !hasActiveReceptionist}
                className="w-full sm:w-auto h-11 px-7 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {!doctor.clinics || doctor.clinics.length === 0
                  ? 'Booking Unavailable'
                  : !hasActiveReceptionist
                  ? 'Booking Unavailable (No Desk Staff)'
                  : submitting
                  ? 'Submitting Request...'
                  : isSelectedSlotOnLeave
                  ? 'Doctor on Leave'
                  : isSelectedSlotDayOff
                  ? 'Not Sitting on this Day'
                  : isSelectedSlotPassed
                  ? 'Shift Ended'
                  : isSelectedSlotFull
                  ? 'Shift Full'
                  : `Submit Request to Receptionist (₹${activeFee})`}
              </button>
            </div>
          </form>
        </UtilityCard>
      </div>
    </div>
  );
};
