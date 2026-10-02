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
  formatDoctorDegrees,
  getFileUrl,
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
  Phone,
  Stethoscope,
  User as UserIcon,
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

const patientNavItems: DashboardNavItem[] = [
  {
    id: 'appointments',
    label: 'Live Queue & Passes',
    icon: Calendar,
    path: '/patient/appointments',
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
  const initialClinic = searchParams.get('clinic') || null;

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
  const [showAllReceptionists, setShowAllReceptionists] = useState(false);

  const { user, loading: loadingAuth } = useAuth();
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

    // 3. Fallback to clinic front desk phone
    if (list.length === 0 && selectedClinic?.clinic.phone) {
      list.push({
        id: 'desk_default',
        name: `${selectedClinic.clinic.clinicName} Reception Desk`,
        phone: selectedClinic.clinic.phone,
        clinicName: selectedClinic.clinic.clinicName,
      });
    }

    return list;
  }, [doctor, selectedClinic, selectedClinicId]);

  const handleSelectClinic = (clinicId: string) => {
    setSelectedClinicId(clinicId);
    if (!doctor) return;
    const targetClinic = doctor.clinics?.find((c) => c.clinicId === clinicId);
    const clinicSlots = (targetClinic?.slots && targetClinic.slots.length > 0)
      ? targetClinic.slots
      : parseDoctorSlots(doctor);
    if (clinicSlots.length > 0 && !clinicSlots.some((s) => s.id === selectedSlotId)) {
      setSelectedSlotId(clinicSlots[0].id);
    }
  };

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
        let targetClinicId = '';
        if (initialClinic && docData.clinics?.some((c: any) => c.clinicId === initialClinic)) {
          targetClinicId = initialClinic;
          setSelectedClinicId(initialClinic);
        } else if (docData.clinics && docData.clinics.length > 0) {
          targetClinicId = docData.clinics[0].clinicId;
          setSelectedClinicId(docData.clinics[0].clinicId);
        }

        const activeClinic = docData.clinics?.find((c: any) => c.clinicId === targetClinicId) || docData.clinics?.[0];
        const slots = (activeClinic?.slots && activeClinic.slots.length > 0) ? activeClinic.slots : parseDoctorSlots(docData);
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
  }, [id, user, loadingAuth, navigate, initialSlot, initialClinic]);

  // Fetch queue preview when date, slotId, or clinicId changes
  useEffect(() => {
    const fetchQueue = async () => {
      if (!id || !doctor) return;
      setPreviewLoading(true);
      try {
        const previewData = await api.getQueuePreview(
          id,
          appointmentDate,
          selectedSlotId || undefined,
          selectedClinicId || undefined
        );
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
  }, [id, doctor, appointmentDate, selectedSlotId, selectedClinicId]);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;

    setError(null);
    setSubmitting(true);

    const hasClinics = Boolean(doctor.clinics && doctor.clinics.length > 0);
    if (!hasClinics) {
      setError('This doctor is currently not associated with any active verified clinic. Appointments cannot be booked.');
      setSubmitting(false);
      return;
    }

    if (doctor.clinics!.length > 1 && !selectedClinicId) {
      setError('Please select which clinic venue you wish to attend.');
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

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else if (id) {
      navigate(user?.role === 'PATIENT' ? `/patient/doctor/${id}` : `/doctor/${id}`);
    } else {
      navigate(user?.role === 'PATIENT' ? '/patient/doctors' : '/doctors');
    }
  };

  if (loading) {
    if (user?.role === 'PATIENT') {
      return (
        <DashboardLayout
          portalType="PATIENT"
          portalSubtitle="PATIENT PORTAL"
          navItems={patientNavItems}
          title="Confirm Appointment"
          subtitle="Loading shift and queue preview..."
          headerAction={
            <AppleButton
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="flex items-center gap-1.5 text-xs font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </AppleButton>
          }
        >
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin mb-3"></div>
            <p className="text-xs text-[#86868b]">Loading appointment booking workspace...</p>
          </div>
        </DashboardLayout>
      );
    }
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!doctor) {
    if (user?.role === 'PATIENT') {
      return (
        <DashboardLayout
          portalType="PATIENT"
          portalSubtitle="PATIENT PORTAL"
          navItems={patientNavItems}
          title="Booking Unavailable"
          subtitle="The requested doctor could not be found"
          headerAction={
            <AppleButton
              variant="ghost"
              size="sm"
              onClick={() => navigate('/patient/doctors')}
              className="flex items-center gap-1.5 text-xs font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Specialists
            </AppleButton>
          }
        >
          <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-[#e5e5ea] max-w-md mx-auto my-12">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">Doctor Profile Unavailable</h2>
            <p className="text-xs text-[#86868b] mb-6">{error || 'This doctor is unavailable or inactive.'}</p>
            <AppleButton variant="primary" onClick={() => navigate('/patient/doctors')}>
              Return to Specialists
            </AppleButton>
          </div>
        </DashboardLayout>
      );
    }
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-[#e5e5ea] max-w-md">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">Doctor Profile Unavailable</h2>
          <p className="text-xs text-[#86868b] mb-6">{error || 'This doctor is unavailable or inactive.'}</p>
          <AppleButton variant="primary" onClick={() => navigate('/doctors')}>
            Return to Directory
          </AppleButton>
        </div>
      </div>
    );
  }

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
            <div className="w-16 h-16 rounded-full bg-white border border-[#e5e5ea] overflow-hidden flex-shrink-0 flex items-center justify-center shadow-xs">
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
                <h3 className="text-xl font-bold text-[#1d1d1f] tracking-tight">{doctor.user?.fullName || 'Doctor'}</h3>
                <CheckCircle2 className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
                  {doctor.specialty}
                </span>
                <span className="text-xs text-[#6e6e73] font-medium">{formatDoctorDegrees(doctor.qualifications)}</span>
              </div>
              {selectedClinic ? (
                <p className="text-xs text-[#48484a] font-medium flex items-center gap-1.5 mt-1">
                  <Building2 className="w-3.5 h-3.5 text-[#0066cc] flex-shrink-0" />
                  <span>Practicing at {selectedClinic.clinic.clinicName}{selectedClinic.clinic.city ? ` • ${selectedClinic.clinic.city}` : ''}</span>
                </p>
              ) : (
                <p className="text-xs text-[#86868b] mt-1">{doctor.clinicAddress || 'MediArca Healthcare Network'}</p>
              )}
            </div>
          </div>

          {/* Clinic / Practice Venue Selection */}
          {!doctor.clinics || doctor.clinics.length === 0 ? (
            <div className="py-4 border-b border-[#f0f0f0]">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                    No Clinic Affiliation Registered
                  </h4>
                  <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                    {doctor.user?.fullName ? (doctor.user.fullName.startsWith('Dr.') ? doctor.user.fullName : `Dr. ${doctor.user.fullName}`) : 'The practitioner'} is currently not practicing at any active verified clinic venue. Online queue reservations cannot be issued.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4 border-b border-[#f0f0f0]">
              <label className="block text-xs font-medium text-[#1d1d1f] mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Building2 className="w-3.5 h-3.5 text-[#0066cc]" />
                  Consultation Venue / Clinic
                </span>
                <span className="text-[11px] text-[#86868b]">
                  {doctor.clinics.length} facility location{doctor.clinics.length > 1 ? 's' : ''}
                </span>
              </label>

              {doctor.clinics.length === 1 ? (
                <div className="p-4 sm:p-5 rounded-[22px] bg-white border-2 border-[#0066cc] shadow-[0_4px_16px_rgba(0,136,232,0.08)] flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#1d1d1f] block truncate">
                        {doctor.clinics[0].clinic.clinicName}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0066cc] text-white flex-shrink-0 shadow-2xs">
                        Selected Venue
                      </span>
                    </div>
                    <span className="text-xs text-[#86868b] flex items-center gap-1.5 mt-1 line-clamp-1">
                      <MapPin className="w-3.5 h-3.5 text-[#86868b] flex-shrink-0" />
                      <span>{doctor.clinics[0].clinic.address}{doctor.clinics[0].clinic.city ? `, ${doctor.clinics[0].clinic.city}` : ''}</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-semibold">
                        Fee: ₹{doctor.clinics[0].consultationFee ?? doctor.consultationFee}
                      </span>
                      {doctor.clinics[0].slots && doctor.clinics[0].slots.length > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] text-xs font-medium">
                          {doctor.clinics[0].slots.length} shift{doctor.clinics[0].slots.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {doctor.clinics[0].clinic.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-[#0066cc] font-medium mt-3 pt-2.5 border-t border-[#f5f5f7]">
                        <Phone className="w-3.5 h-3.5 text-[#0066cc] flex-shrink-0" />
                        <a href={`tel:${doctor.clinics[0].clinic.phone.replace(/\s+/g, '')}`} className="hover:underline">
                          Reception Desk: {formatDisplayPhone(doctor.clinics[0].clinic.phone)}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {doctor.clinics.map((c) => {
                    const isSelected = selectedClinicId === c.clinicId;
                    const clinicFee = c.consultationFee ?? doctor.consultationFee;
                    return (
                      <button
                        key={c.clinicId}
                        type="button"
                        onClick={() => handleSelectClinic(c.clinicId)}
                        className={`p-4 sm:p-5 rounded-[22px] border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-white border-[#0066cc] ring-2 ring-[#0066cc]/20 shadow-[0_4px_20px_rgba(0,136,232,0.1)]'
                            : 'bg-white border-[#e5e5ea] hover:border-[#0066cc]/40 hover:bg-[#fafafa]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-sm font-bold text-[#1d1d1f] truncate">{c.clinic.clinicName}</span>
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0066cc] text-white flex-shrink-0 shadow-2xs">
                                <Check className="w-3 h-3" />
                                Selected
                              </span>
                            ) : null}
                          </div>
                          <span className="text-[13px] font-semibold text-[#1d1d1f] tracking-tight flex items-center gap-1.5 mt-1 line-clamp-1">
                            <MapPin className="w-3.5 h-3.5 text-[#0066cc] flex-shrink-0" />
                            <span>{c.clinic.address}{c.clinic.city ? `, ${c.clinic.city}` : ''}</span>
                          </span>
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-semibold">
                              Fee: ₹{clinicFee}
                            </span>
                            {c.slots && c.slots.length > 0 && (
                              <span className="px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] text-xs font-medium">
                                {c.slots.length} shift{c.slots.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        {c.clinic.phone && (
                          <div className="flex items-center gap-1.5 text-[13px] text-[#1d1d1f] font-semibold tracking-tight mt-3 pt-2.5 border-t border-[#f5f5f7]">
                            <Phone className="w-3.5 h-3.5 text-[#0066cc] flex-shrink-0" />
                            <span>Reception Desk: {formatDisplayPhone(c.clinic.phone)}</span>
                          </div>
                        )}
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
                <Calendar className="w-3.5 h-3.5 text-[#0066cc]" />
                Select Appointment Date
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAppointmentDate(getLocalDateString())}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${
                    appointmentDate === getLocalDateString()
                      ? 'bg-[#1d1d1f] text-white shadow-2xs'
                      : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#e8e8ed]'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setAppointmentDate(getTomorrowDateString())}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${
                    appointmentDate === getTomorrowDateString()
                      ? 'bg-[#1d1d1f] text-white shadow-2xs'
                      : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#e8e8ed]'
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
              className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
            />
          </div>

          {/* Multiple Checking Slots Selection */}
          <div className="py-4">
            <label className="block text-xs font-medium text-[#1d1d1f] mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#0066cc]" />
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
                const cleanShiftName = s.name.replace(/\s*\([^)]*\)/, '').trim() || 'Checking Shift';

                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={slotPassed}
                    onClick={() => setSelectedSlotId(s.id)}
                    className={`p-4 rounded-2xl border text-left transition-all relative cursor-pointer ${
                      slotPassed
                        ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'bg-white border-[#0066cc] ring-2 ring-[#0066cc]/20 shadow-sm'
                        : 'bg-white border-[#e5e5ea] hover:border-[#0066cc]/40 hover:bg-[#fafafa]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold text-[#1d1d1f] block truncate">
                        {cleanShiftName}
                      </span>
                      {isSelected && !slotPassed && (
                        <span className="w-4 h-4 rounded-full bg-[#0066cc] text-white flex items-center justify-center flex-shrink-0">
                          <Check className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[#0066cc] font-medium flex items-center gap-1.5 mb-2">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        {format12Hour(s.startTime)} – {format12Hour(s.endTime)}
                      </span>
                    </div>

                    {/* Status Pill */}
                    <div className="mt-1">
                      {slotPassed ? (
                        <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          Shift Ended
                        </span>
                      ) : slotFull ? (
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          Capacity Reached
                        </span>
                      ) : (
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f]">
                          Available
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
            <div
              className={`my-5 p-5 rounded-[22px] border transition-all ${
                isSelectedSlotPassed
                  ? 'bg-[#fafafc] border-[#e5e5ea]'
                  : 'bg-[#f5f5f7] border-[#e5e5ea]'
              } flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}
            >
              <div>
                <span className="text-[10px] uppercase font-semibold text-[#86868b] tracking-wider block">
                  {isSelectedSlotPassed ? 'Shift Status' : 'Queue Position'}
                </span>
                <strong
                  className={`text-2xl sm:text-3xl font-bold tracking-tight block mt-0.5 ${
                    isSelectedSlotPassed ? 'text-[#86868b]' : 'text-[#0066cc]'
                  }`}
                >
                  {isSelectedSlotPassed ? 'Shift Ended' : `Queue #${queuePreview.nextQueueNumber}`}
                </strong>
                <p className="text-xs text-[#86868b] mt-1 flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-[#0066cc]" />
                  Checking Shift: {queuePreview.checkingWindow}
                </p>
              </div>

              <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-[#e5e5ea] w-full sm:w-auto">
                <span className="text-[10px] uppercase font-semibold text-[#86868b] block">
                  {isSelectedSlotPassed ? 'Availability' : 'Est. Consultation Time'}
                </span>
                <strong
                  className={`text-xl sm:text-2xl block tracking-tight ${
                    isSelectedSlotPassed ? 'text-amber-600' : 'text-[#1d1d1f]'
                  }`}
                >
                  {previewLoading
                    ? 'Updating...'
                    : isSelectedSlotPassed
                    ? 'Closed For Today'
                    : queuePreview.estimatedTime}
                </strong>
                <span className="text-xs text-[#86868b] block mt-0.5 font-medium">
                  {isSelectedSlotPassed
                    ? 'Please pick an upcoming shift or future date'
                    : queuePreview.patientsAhead === 0
                    ? 'First in line for this shift'
                    : `${queuePreview.patientsAhead} patient(s) ahead in line`}
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
              <div className="flex rounded-full bg-[#f5f5f7] p-1 border border-[#e5e5ea] max-w-sm shadow-xs">
                <button
                  type="button"
                  onClick={() => setBookingFor('myself')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-[0.98] ${
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
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-[0.98] ${
                    bookingFor === 'other'
                      ? 'bg-white text-[#1d1d1f] shadow-xs'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  Someone Else / Family
                </button>
              </div>

              {bookingFor === 'other' && (
                <div className="mt-3 p-4 rounded-2xl bg-[#0066cc]/5 border border-[#0066cc]/20 space-y-3 animate-fadeIn">
                  <div className="text-xs font-semibold text-[#0066cc]">
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
                        className="w-full h-10 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
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
                        className="w-full h-10 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1">
                        Gender
                      </label>
                      <select
                        value={patientGender}
                        onChange={(e) => setPatientGender(e.target.value)}
                        className="w-full h-10 px-2.5 rounded-xl border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
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
                placeholder="e.g. General checkup, consultation, follow-up"
                className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-sm bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                Symptoms or Concerns <span className="text-[#86868b] font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Describe any symptoms or concerns for the doctor..."
                className="w-full p-3.5 rounded-xl border border-[#e5e5ea] text-sm bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] resize-none"
              ></textarea>
            </div>

            {/* Receptionist Payment & Queue Confirmation Card */}
            <div className="p-4 sm:p-5 rounded-[22px] bg-white border border-[#e5e5ea] shadow-xs space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-[#1d1d1f] tracking-tight">
                      Pay Receptionist to Confirm Queue Spot
                    </h4>
                    <p className="text-xs text-[#86868b] mt-0.5 leading-relaxed">
                      Queue token is verified and confirmed upon paying the consultation fee directly to the clinic receptionist.
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-sm font-bold block">
                    ₹{activeFee}
                  </span>
                  <span className="text-[10px] text-[#86868b] block mt-0.5">Consultation Fee</span>
                </div>
              </div>

              {/* Receptionist Contact Roster */}
              {attachedReceptionists.length > 0 && (
                <div className="pt-3 border-t border-[#f0f0f2] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-[#0066cc]" />
                      Clinic Reception Desk ({attachedReceptionists.length})
                    </span>
                    {attachedReceptionists.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setShowAllReceptionists(!showAllReceptionists)}
                        className="text-[11px] font-semibold text-[#0066cc] hover:underline cursor-pointer"
                      >
                        {showAllReceptionists ? 'Show Less' : `View All (${attachedReceptionists.length}) Details`}
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {(showAllReceptionists ? attachedReceptionists : attachedReceptionists.slice(0, 1)).map((rec, idx) => (
                      <div
                        key={rec.id || idx}
                        className="p-3 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all"
                      >
                        <div className="min-w-0 flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-white border border-[#e5e5ea] text-[#1d1d1f] flex items-center justify-center text-xs font-bold shadow-2xs flex-shrink-0">
                            {rec.name.replace(/^Dr\.\s*/i, '').trim()[0] || 'R'}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-[#1d1d1f] block truncate">
                              {rec.name}
                            </span>
                            <span className="text-[11px] text-[#86868b] block truncate">
                              {rec.clinicName || selectedClinic?.clinic.clinicName || 'Clinic'} • Reception Desk
                            </span>
                          </div>
                        </div>

                        {rec.phone && (
                          <a
                            href={`tel:${rec.phone.replace(/\s+/g, '')}`}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-[#e5e5ea] hover:border-[#0066cc] text-xs font-semibold text-[#0066cc] hover:bg-[#0066cc]/5 transition-all active:scale-[0.98] shadow-2xs whitespace-nowrap self-start sm:self-auto"
                          >
                            <Phone className="w-3 h-3 text-[#0066cc]" />
                            <span>Call {formatDisplayPhone(rec.phone)}</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Warning if slot has ended for today */}
            {isSelectedSlotPassed && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>This checking shift has already ended for today.</strong> Please select an upcoming shift above or pick a future appointment date.
                </div>
              </div>
            )}

            {isSelectedSlotFull && !isSelectedSlotPassed && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>This checking slot has reached maximum capacity. Please pick another slot or date.</span>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <AppleButton
                variant="primary"
                size="lg"
                type="submit"
                disabled={submitting || isSelectedSlotPassed || isSelectedSlotFull || !doctor.clinics || doctor.clinics.length === 0}
                className="w-full sm:w-auto font-semibold shadow-apple-button"
              >
                {!doctor.clinics || doctor.clinics.length === 0
                  ? 'No Clinic Associated — Booking Disabled'
                  : submitting
                  ? 'Reserving Token...'
                  : isSelectedSlotPassed
                  ? 'Shift Concluded — Select Next Shift'
                  : isSelectedSlotFull
                  ? 'Shift Fully Booked — Select Another Shift'
                  : `Confirm & Pay Receptionist (₹${activeFee})`}
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
            onClick={handleBack}
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
          onClick={handleBack}
          className="flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </AppleButton>
      </SubNav>

      <div className="max-w-2xl mx-auto px-3 sm:px-6 pt-5 sm:pt-8">
        {bookingContent}
      </div>
    </div>
  );
};
