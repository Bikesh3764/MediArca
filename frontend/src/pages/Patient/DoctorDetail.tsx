import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  api,
  Doctor,
  QueuePreview,
  parseDoctorSlots,
  format12Hour,
  getLocalDateString,
  getTomorrowDateString,
  formatDoctorDegrees,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { SubNav } from '../../components/layout/SubNav';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import { CabinStatusBadge } from '../../components/ui/DoctorCabinPresence';
import {
  ShieldCheck,
  Star,
  Clock,
  MapPin,
  Award,
  Calendar,
  UserCheck,
  ChevronLeft,
  Building2,
  Stethoscope,
  User as UserIcon,
  AlertCircle,
  Check,
} from 'lucide-react';

export const DoctorDetail: React.FC = () => {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateString());
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [queuePreview, setQueuePreview] = useState<QueuePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(false);

  const navigate = useNavigate();
  const isPatient = user?.role === 'PATIENT';

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

  useEffect(() => {
    const fetchDoctor = async () => {
      if (!id) return;
      try {
        const data = await api.getDoctorById(id);
        setDoctor(data);
        if (data.clinics && data.clinics.length > 0) {
          const firstClinic = data.clinics[0];
          setSelectedClinicId((prev) => prev || firstClinic.clinicId);
          const clinicSlots = (firstClinic.slots && firstClinic.slots.length > 0) ? firstClinic.slots : parseDoctorSlots(data);
          if (clinicSlots.length > 0) {
            setSelectedSlotId((prev) => prev || clinicSlots[0].id);
          }
        } else {
          const slots = parseDoctorSlots(data);
          if (slots.length > 0) {
            setSelectedSlotId((prev) => prev || slots[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load doctor:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDoctor();
  }, [id]);

  useEffect(() => {
    const fetchQueue = async () => {
      if (!id || !selectedDate) return;
      setLoadingQueue(true);
      try {
        const preview = await api.getQueuePreview(
          id,
          selectedDate,
          selectedSlotId || undefined,
          selectedClinicId || undefined
        );
        setQueuePreview(preview);
        if (preview.selectedSlotId && (!selectedSlotId || (preview.isPassed && preview.selectedSlotId !== selectedSlotId))) {
          setSelectedSlotId(preview.selectedSlotId);
        }
      } catch (err) {
        console.error('Failed to calculate queue preview:', err);
      } finally {
        setLoadingQueue(false);
      }
    };
    fetchQueue();
  }, [id, selectedDate, selectedSlotId, selectedClinicId]);

  if (loading) {
    if (isPatient) {
      return (
        <DashboardLayout
          portalType="PATIENT"
          portalSubtitle="PATIENT PORTAL"
          navItems={patientNavItems}
          title="Loading Specialist Profile..."
          subtitle="Retrieving doctor credentials, verification status and shift schedule"
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
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-[#0088e8] border-t-transparent animate-spin mb-3"></div>
            <p className="text-xs text-[#86868b]">Loading doctor profile and clinic schedule...</p>
          </div>
        </DashboardLayout>
      );
    }
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#0088e8] border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!doctor) {
    if (isPatient) {
      return (
        <DashboardLayout
          portalType="PATIENT"
          portalSubtitle="PATIENT PORTAL"
          navItems={patientNavItems}
          title="Practitioner Not Available"
          subtitle="The requested doctor profile could not be located"
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
            <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">Practitioner Not Found</h2>
            <p className="text-xs text-[#86868b] mb-6">The requested doctor profile is unavailable or inactive.</p>
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
          <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">Practitioner Not Found</h2>
          <p className="text-xs text-[#86868b] mb-6">The requested doctor profile is unavailable or inactive.</p>
          <AppleButton variant="primary" onClick={() => navigate('/doctors')}>
            Return to Directory
          </AppleButton>
        </div>
      </div>
    );
  }

  const selectedClinic = doctor.clinics?.find((c) => c.clinicId === selectedClinicId) || doctor.clinics?.[0];
  const activeFee = selectedClinic?.consultationFee ?? queuePreview?.consultationFee ?? doctor.consultationFee;
  const activeSlots = (selectedClinic?.slots && selectedClinic.slots.length > 0)
    ? selectedClinic.slots
    : parseDoctorSlots(doctor);

  const handleSelectClinic = (clinicId: string) => {
    setSelectedClinicId(clinicId);
    const targetClinic = doctor.clinics?.find((c) => c.clinicId === clinicId);
    const clinicSlots = (targetClinic?.slots && targetClinic.slots.length > 0)
      ? targetClinic.slots
      : parseDoctorSlots(doctor);
    if (clinicSlots.length > 0 && !clinicSlots.some((s) => s.id === selectedSlotId)) {
      setSelectedSlotId(clinicSlots[0].id);
    }
  };

  const detailContent = (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Doctor Bio & Credentials (2 Columns) */}
          <div className="lg:col-span-2 space-y-6">
            <UtilityCard>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-[#f0f0f0]">
                <div className="w-24 h-24 rounded-full bg-white border border-[#e5e5ea] overflow-hidden flex-shrink-0 flex items-center justify-center shadow-xs">
                  {doctor.user.avatarUrl ? (
                    <img
                      src={doctor.user.avatarUrl}
                      alt={doctor.user.fullName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.doc-detail-fallback');
                        if (fallback) (fallback as HTMLElement).style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className={`doc-detail-fallback w-full h-full ${doctor.user.avatarUrl ? 'hidden' : 'flex'} items-center justify-center text-3xl font-bold bg-[#0088e8] text-white shadow-inner select-none`}>
                    {doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] || 'D'}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">{doctor.user.fullName}</h2>
                    <span title="Verified Practitioner"><ShieldCheck className="w-5 h-5 text-[#10b981]" /></span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0088e8]/10 text-[#0088e8] border border-[#0088e8]/20">
                      {doctor.specialty}
                    </span>
                    <CabinStatusBadge status={doctor.cabinStatus} expectedReturnTime={doctor.expectedReturnTime} size="sm" />
                  </div>
                  <p className="text-xs text-[#6e6e73] font-medium mt-1.5">{formatDoctorDegrees(doctor.qualifications)}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-[#1d1d1f]">
                    <span className="flex items-center gap-1.5 text-[#1d1d1f] font-medium">
                      <Award className="w-4 h-4 text-[#0088e8]" />
                      {doctor.experienceYears} Years Experience
                    </span>
                    <span className="text-[#d2d2d7]">•</span>
                    <span className="text-[#86868b]">Verified Clinical Specialist</span>
                  </div>
                </div>
              </div>

              {/* Checking Shifts & Practice Hours */}
              <div className="py-6 border-b border-[#f0f0f0]">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#86868b] mb-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#0088e8]" />
                  Active Practice Shifts & Capacities{selectedClinic ? ` (${selectedClinic.clinic.clinicName})` : ''}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeSlots.map((slot, idx) => (
                    <div key={slot.id || idx} className="p-3.5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]">
                      <span className="text-xs font-semibold text-[#1d1d1f] block mb-1">
                        {slot.name}
                      </span>
                      <div className="text-xs text-[#0088e8] font-medium mb-1">
                        {format12Hour(slot.startTime)} – {format12Hour(slot.endTime)}
                      </div>
                      <div className="flex justify-between text-[11px] text-[#86868b]">
                        <span>Capacity: {slot.maxPatients} patients</span>
                        <span className="font-medium text-[#1d1d1f]">~{slot.avgConsultationMinutes}m pace</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bio & Clinic */}
              <div className="py-6 border-b border-[#f0f0f0]">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#86868b] mb-2">About the Doctor</h3>
                <p className="text-[15px] leading-relaxed text-[#1d1d1f]">{doctor.bio}</p>

                {/* Affiliated Clinics */}
                {doctor.clinics && doctor.clinics.length > 0 ? (
                  <div className="mt-5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-[#0088e8]" />
                        Practicing Clinics & Consultation Venues ({doctor.clinics.length})
                      </h4>
                      <span className="text-[11px] text-[#86868b]">Select clinic for token appointment</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {doctor.clinics.map((cd) => {
                        const isSelected = selectedClinicId === cd.clinicId;
                        const clinicFee = cd.consultationFee ?? doctor.consultationFee;
                        return (
                          <div
                            key={cd.clinicId}
                            onClick={() => handleSelectClinic(cd.clinicId)}
                            className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                              isSelected
                                ? 'bg-[#0088e8]/5 border-[#0088e8] ring-1 ring-[#0088e8]/30 shadow-xs'
                                : 'bg-[#f5f5f7] border-[#e5e5ea] hover:border-[#0088e8]/40 hover:bg-white'
                            }`}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <span className="text-sm font-semibold text-[#1d1d1f] block">
                                  {cd.clinic.clinicName}
                                </span>
                                {isSelected && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#0088e8] text-white flex-shrink-0">
                                    <Check className="w-3 h-3" />
                                    Selected
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#86868b] mt-0.5 flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-[#86868b] flex-shrink-0" />
                                <span>{cd.clinic.address}{cd.clinic.city ? `, ${cd.clinic.city}` : ''}</span>
                              </p>
                              {cd.clinic.phone && (
                                <span className="text-[11px] text-[#0088e8] block mt-1.5 font-medium">
                                  Contact: {cd.clinic.phone}
                                </span>
                              )}
                              <div className="flex items-center gap-2 mt-2.5">
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold">
                                  Fee: ₹{clinicFee}
                                </span>
                                {cd.slots && cd.slots.length > 0 && (
                                  <span className="px-2 py-0.5 rounded-md bg-sky-50 text-[#0088e8] text-xs font-medium">
                                    {cd.slots.length} shift{cd.slots.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 pt-2.5 border-t border-[#e5e5ea]/70 flex items-center justify-between text-[11px]">
                              <span className="text-[#86868b]">In-Person Clinic</span>
                              <span className={`font-semibold ${isSelected ? 'text-[#0088e8]' : 'text-[#86868b]'}`}>
                                {isSelected ? 'Selected for Booking' : 'Click to Select'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 p-5 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-700">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                        No Affiliated Practice Venue
                      </h4>
                      <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                        Dr. {doctor.user.fullName} is currently not practicing at any verified clinic location. Online queue booking is disabled until an active clinic affiliation is established.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Patient Reviews */}
              <div className="pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#86868b] mb-4">
                  Patient Reviews ({doctor.reviews?.length || 0})
                </h3>
                <div className="space-y-3">
                  {doctor.reviews && doctor.reviews.length > 0 ? (
                    doctor.reviews.map((rev) => (
                      <div key={rev.id} className="p-4 rounded-2xl border border-[#e5e5ea] bg-[#fafafc]">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="font-semibold text-xs text-[#1d1d1f]">
                            {rev.patientUser.fullName}
                          </span>
                          <div className="flex items-center gap-1">
                            {[...Array(rev.rating)].map((_, i) => (
                              <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-[#86868b] italic">"{rev.comment}"</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#86868b]">No reviews yet for this doctor.</p>
                  )}
                </div>
              </div>
            </UtilityCard>
          </div>

          {/* Live Queue Booking Preview Widget (1 Column) */}
          <div className="space-y-6">
            <UtilityCard className="lg:sticky lg:top-28">
              <span className="text-xs font-semibold text-[#0088e8] uppercase tracking-wider block mb-1">
                Queue Reservation
              </span>
              <h3 className="text-xl font-semibold text-[#1d1d1f] mb-4">Book Your Token</h3>

              {/* Clinic Selection (Step 1) */}
              {(!doctor.clinics || doctor.clinics.length === 0) ? (
                <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
                  <div className="flex items-center gap-2 font-semibold text-xs text-amber-900 mb-1">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Booking Unavailable</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    This doctor is currently not affiliated with any active verified clinic venue. Online queue reservations cannot be issued.
                  </p>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[#1d1d1f] flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-[#0088e8]" />
                      Consultation Clinic Venue
                    </label>
                    <span className="text-[11px] text-[#86868b]">
                      {doctor.clinics.length} Venue{doctor.clinics.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {doctor.clinics.map((cd) => {
                      const isSelected = selectedClinicId === cd.clinicId;
                      return (
                        <button
                          key={cd.clinicId}
                          type="button"
                          onClick={() => setSelectedClinicId(cd.clinicId)}
                          className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#0088e8]/10 border-[#0088e8] ring-1 ring-[#0088e8]/30 text-[#1d1d1f]'
                              : 'bg-white border-[#e5e5ea] text-[#1d1d1f] hover:border-[#0088e8]/50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold block truncate">{cd.clinic.clinicName}</span>
                            <span className="text-[11px] text-[#86868b] block truncate">
                              {cd.clinic.address}{cd.clinic.city ? `, ${cd.clinic.city}` : ''}
                            </span>
                          </div>
                          {isSelected ? (
                            <span className="w-2 h-2 rounded-full bg-[#0088e8] flex-shrink-0 ml-2" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Date & Shift Selectors (Only shown if doctor is affiliated with clinic) */}
              {doctor.clinics && doctor.clinics.length > 0 ? (
                <>
                  {/* Date Selector with Quick Shortcuts */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-[#1d1d1f] flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#0088e8]" />
                        Appointment Date
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedDate(getLocalDateString())}
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                            selectedDate === getLocalDateString()
                              ? 'bg-[#1d1d1f] text-white shadow-2xs'
                              : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#e8e8ed]'
                          }`}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDate(getTomorrowDateString())}
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                            selectedDate === getTomorrowDateString()
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
                      value={selectedDate}
                      min={getLocalDateString()}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-[14px] bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                    />
                  </div>

                  {/* Shift Selector */}
                  {activeSlots.length > 1 && (
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 flex items-center justify-between">
                        <span>Select Checking Shift</span>
                        <span className="text-[11px] text-[#86868b]">
                          {activeSlots.length} shifts
                        </span>
                      </label>
                      <div className="space-y-2">
                        {activeSlots.map((slot) => {
                          const slotStatus = queuePreview?.availableSlots?.find((s) => s.slot.id === slot.id);
                          const isPassed = Boolean(slotStatus?.isPassed);
                          const isSelected = selectedSlotId === slot.id;
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              disabled={isPassed}
                              onClick={() => setSelectedSlotId(slot.id)}
                              className={`w-full p-3 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                                isPassed
                                  ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-[#0088e8]/10 border-[#0088e8] ring-1 ring-[#0088e8]/30 text-[#1d1d1f]'
                                  : 'bg-white border-[#e5e5ea] text-[#1d1d1f] hover:border-[#0088e8]/50'
                              }`}
                            >
                              <div>
                                <span className="font-semibold block">{slot.name}</span>
                                <span className="text-[11px] text-[#0088e8] font-medium">
                                  {format12Hour(slot.startTime)} – {format12Hour(slot.endTime)}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] block text-[#86868b]">Cap: {slot.maxPatients} pts</span>
                                {isPassed ? (
                                  <span className="text-[10px] text-gray-500 font-medium">Shift Ended</span>
                                ) : slotStatus?.isFull ? (
                                  <span className="text-[10px] text-rose-600 font-semibold">Fully Booked</span>
                                ) : slotStatus?.isInProgress ? (
                                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 justify-end">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    In Progress
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-[#0088e8] font-medium">Available</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Dynamic Queue Preview Card */}
                  {loadingQueue ? (
                    <div className="p-6 rounded-2xl bg-[#f5f5f7] animate-pulse h-40"></div>
                  ) : queuePreview ? (
                    <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] mb-5 space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-[#e5e5ea]">
                        <span className="text-xs text-[#86868b]">Checking Shift:</span>
                        <strong className="text-xs text-[#0088e8] flex items-center gap-1 font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          {queuePreview.checkingWindow}
                        </strong>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-[#86868b] uppercase block">Assigned Token</span>
                          <strong className="text-2xl font-bold tracking-tight text-[#0088e8]">
                            Queue #{queuePreview.nextQueueNumber}
                          </strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-[#86868b] uppercase block">Est. Start Time</span>
                          <strong
                            className={`text-base ${
                              queuePreview.isPassed ? 'text-rose-600' : 'text-[#0088e8]'
                            }`}
                          >
                            {queuePreview.estimatedTime}
                          </strong>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#0088e8]/10 text-xs text-[#86868b] flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          {queuePreview.patientsAhead === 0
                            ? 'No patients ahead! You will be first in this shift.'
                            : `${queuePreview.patientsAhead} patient(s) ahead • ~${queuePreview.avgConsultationMinutes}m pace`}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {/* Price summary & Proceed */}
              <div className="pt-2 border-t border-[#f0f0f0] mb-5">
                <div className="flex justify-between text-xs mb-1 text-[#86868b]">
                  <span>Consultation Fee{selectedClinic ? ` (${selectedClinic.clinic.clinicName})` : ''}:</span>
                  <span className="font-semibold text-[#1d1d1f] text-sm">₹{activeFee}</span>
                </div>
                <div className="flex justify-between text-xs text-[#86868b]">
                  <span>Booking Fee:</span>
                  <span className="text-emerald-600 font-semibold">₹0 (Pay at Reception)</span>
                </div>
              </div>

              {queuePreview?.isPassed ? (
                <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
                  <span>This shift has concluded for today. Pick an upcoming shift or future date.</span>
                </div>
              ) : queuePreview?.isFull ? (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <span>Doctor's maximum capacity reached for this shift. Please select another slot or date.</span>
                </div>
              ) : null}

              <AppleButton
                variant="primary"
                size="lg"
                disabled={Boolean(!doctor.clinics || doctor.clinics.length === 0 || queuePreview?.isFull || queuePreview?.isPassed)}
                onClick={() =>
                  navigate(
                    isPatient
                      ? `/patient/book/${doctor.id}?date=${selectedDate}${selectedSlotId ? `&slot=${selectedSlotId}` : ''}${selectedClinicId ? `&clinic=${selectedClinicId}` : ''}`
                      : `/book/${doctor.id}?date=${selectedDate}${selectedSlotId ? `&slot=${selectedSlotId}` : ''}${selectedClinicId ? `&clinic=${selectedClinicId}` : ''}`
                  )
                }
                className="w-full"
              >
                {!doctor.clinics || doctor.clinics.length === 0
                  ? 'No Clinic Affiliation — Booking Disabled'
                  : queuePreview?.isPassed
                  ? 'Shift Ended — Choose Next'
                  : queuePreview?.isFull
                  ? 'Fully Booked for Shift'
                  : 'Proceed to Confirm Queue'}
              </AppleButton>
            </UtilityCard>
          </div>
    </div>
  );

  if (isPatient) {
    return (
      <DashboardLayout
        portalType="PATIENT"
        portalSubtitle="PATIENT PORTAL"
        navItems={patientNavItems}
        title={doctor.user.fullName}
        subtitle={`${doctor.specialty} • ${doctor.experienceYears} Years Experience`}
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
        <div className="space-y-6">
          {detailContent}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav title={doctor.user.fullName} subtitle={doctor.specialty}>
        <AppleButton variant="ghost" size="sm" onClick={() => navigate('/doctors')} className="flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" />
          Back to Directory
        </AppleButton>
      </SubNav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        {detailContent}
      </div>
    </div>
  );
};
