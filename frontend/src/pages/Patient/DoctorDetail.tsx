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
  getFileUrl,
} from '../../services/api';
import { SubNav } from '../../components/layout/SubNav';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import { CabinStatusBadge } from '../../components/ui/DoctorCabinPresence';
import {
  ShieldCheck,
  Star,
  MapPin,
  ChevronLeft,
  AlertCircle,
  Check,
  Clock,
} from 'lucide-react';

const cleanSlotName = (name: string): string => {
  return name.replace(/\s*\([^)]*\)/g, '').trim() || name;
};

export const DoctorDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateString());
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [queuePreview, setQueuePreview] = useState<QueuePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(false);

  const navigate = useNavigate();

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
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin mb-3"></div>
        <p className="text-secondary">Loading doctor profile...</p>
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
          <p className="text-secondary mb-6">The requested doctor profile is unavailable or inactive.</p>
          <AppleButton variant="primary" onClick={() => navigate('/doctors')}>
            Back to Directory
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

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-20">
      <SubNav title={doctor.user?.fullName || 'Doctor'} subtitle={doctor.specialty}>
        <AppleButton variant="ghost" size="sm" onClick={() => navigate('/doctors')}>
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </AppleButton>
      </SubNav>

      <div className="ui-page-container">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
          {/* Left Column: Doctor Identity, Credentials, Clinic, Schedule, Reviews */}
          <div className="lg:col-span-2">
            <UtilityCard className="p-6 sm:p-8 space-y-8">
              {/* 1. Doctor Identity & Credentials */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-7 border-b border-[#e5e5ea]/80">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden shrink-0 flex items-center justify-center">
                  {doctor.user?.avatarUrl ? (
                    <img
                      src={getFileUrl(doctor.user.avatarUrl)}
                      alt={doctor.user?.fullName || 'Doctor'}
                      className="w-full h-full object-cover object-top"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.doc-detail-fallback');
                        if (fallback) (fallback as HTMLElement).style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className={`doc-detail-fallback w-full h-full ${
                      doctor.user?.avatarUrl ? 'hidden' : 'flex'
                    } items-center justify-center text-2xl sm:text-3xl font-bold bg-[#0066cc] text-white select-none`}
                  >
                    {(doctor.user?.fullName ? doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] : null) || 'D'}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[22px] sm:text-[26px] font-bold text-[#1d1d1f] tracking-tight truncate">
                      {doctor.user?.fullName || 'Doctor'}
                    </h2>
                    <span title="Verified Specialist" className="shrink-0">
                      <ShieldCheck className="w-5 h-5 text-[#0066cc]" />
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0066cc]/10 text-[#0066cc]">
                      {doctor.specialty}
                    </span>
                    <CabinStatusBadge
                      status={doctor.cabinStatus}
                      expectedReturnTime={doctor.expectedReturnTime}
                      size="sm"
                    />
                  </div>

                  <p className="text-[13px] text-[#6e6e73] font-medium mt-2">
                    {formatDoctorDegrees(doctor.qualifications)}
                    {doctor.experienceYears ? ` · ${doctor.experienceYears} yrs clinical experience` : ''}
                  </p>
                </div>
              </div>

              {/* 2. About / Professional Information */}
              <div className="pb-7 border-b border-[#e5e5ea]/80">
                <h3 className="text-card-title mb-2">About</h3>
                <p className="text-body text-[#6e6e73]">
                  {doctor.bio || 'Consultant specialist providing clinical care and outpatient consultations.'}
                </p>
              </div>

              {/* 3. Affiliated Clinics & Consultation Fee */}
              {doctor.clinics && doctor.clinics.length > 0 && (
                <div className="pb-7 border-b border-[#e5e5ea]/80">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-card-title">
                      {doctor.clinics.length > 1 ? 'Practicing Clinics' : 'Clinic & Consultation'}
                    </h3>
                    {doctor.clinics.length > 1 && (
                      <span className="text-meta">Select a clinic to view its schedule</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {doctor.clinics.map((cd) => {
                      const isSelected = selectedClinicId === cd.clinicId;
                      const clinicFee = cd.consultationFee ?? doctor.consultationFee;
                      return (
                        <button
                          key={cd.clinicId}
                          type="button"
                          onClick={() => handleSelectClinic(cd.clinicId)}
                          className={`p-4 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                            isSelected
                              ? 'bg-[#0066cc]/[0.03] border-[#0066cc] ring-2 ring-[#0066cc]/12'
                              : 'bg-[#f5f5f7]/60 border-[#e5e5ea] hover:bg-white hover:border-[#d2d2d7]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-[14px] font-semibold text-[#1d1d1f] truncate">
                                {cd.clinic.clinicName}
                              </h4>
                              <p className="text-xs text-[#6e6e73] mt-1 flex items-center gap-1.5 truncate">
                                <MapPin className="w-3.5 h-3.5 shrink-0 text-[#86868b]" />
                                <span className="truncate">
                                  {cd.clinic.address}
                                  {cd.clinic.city ? `, ${cd.clinic.city}` : ''}
                                </span>
                              </p>
                            </div>
                            {isSelected && (
                              <span className="w-5 h-5 rounded-full bg-[#0066cc] text-white flex items-center justify-center shrink-0 mt-0.5">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </span>
                            )}
                          </div>
                          <div className="mt-3 pt-2.5 border-t border-[#e5e5ea]/70 flex items-center justify-between text-xs">
                            <span className="text-[#86868b] font-medium">Consultation Fee</span>
                            <span className="font-semibold text-[#1d1d1f] text-[13px]">₹{clinicFee}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Schedule */}
              <div className={doctor.reviews && doctor.reviews.length > 0 ? 'pb-7 border-b border-[#e5e5ea]/80' : ''}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-card-title">Consultation Schedule</h3>
                  {selectedClinic && (
                    <span className="text-meta truncate max-w-[200px]">
                      {selectedClinic.clinic.clinicName}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeSlots.map((slot, idx) => (
                    <div
                      key={slot.id || idx}
                      className="px-4 py-3 rounded-xl bg-[#f5f5f7]/80 border border-[#e5e5ea] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Clock className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                        <span className="text-[13px] font-medium text-[#1d1d1f] truncate">
                          {cleanSlotName(slot.name)}
                        </span>
                      </div>
                      <span className="text-[13px] font-semibold text-[#0066cc] shrink-0">
                        {format12Hour(slot.startTime)} – {format12Hour(slot.endTime)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Reviews */}
              {doctor.reviews && doctor.reviews.length > 0 && (
                <div>
                  <h3 className="text-card-title mb-4">Patient Reviews</h3>
                  <div className="divide-y divide-[#e5e5ea]/80">
                    {doctor.reviews.map((rev) => (
                      <div key={rev.id} className="py-3.5 first:pt-0 last:pb-0">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-[13px] text-[#1d1d1f]">
                            {rev.patientUser.fullName}
                          </span>
                          <div className="flex items-center gap-0.5">
                            {[...Array(rev.rating)].map((_, i) => (
                              <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            ))}
                          </div>
                        </div>
                        {rev.comment?.trim() ? (
                          <p className="text-[13px] text-[#6e6e73] mt-1 leading-relaxed">
                            "{rev.comment.trim()}"
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </UtilityCard>
          </div>

          {/* Right Column: Sticky Booking Widget */}
          <div className="lg:sticky lg:top-24">
            <UtilityCard className="p-6">
              <h3 className="text-section-title mb-5">Book Appointment</h3>

              {/* Clinic Selection */}
              {(!doctor.clinics || doctor.clinics.length === 0) ? (
                <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs">
                  <div className="flex items-center gap-2 font-semibold mb-1">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Booking Unavailable</span>
                  </div>
                  <p className="text-xs text-amber-800">
                    No active clinic affiliation is configured for this doctor.
                  </p>
                </div>
              ) : doctor.clinics.length > 1 ? (
                <div className="mb-5">
                  <label className="ui-label">Clinic</label>
                  <div className="space-y-2">
                    {doctor.clinics.map((cd) => {
                      const isSelected = selectedClinicId === cd.clinicId;
                      return (
                        <button
                          key={cd.clinicId}
                          type="button"
                          onClick={() => handleSelectClinic(cd.clinicId)}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-left text-[13px] transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-[#0066cc]/[0.04] border-[#0066cc] text-[#1d1d1f] font-semibold ring-2 ring-[#0066cc]/12'
                              : 'bg-white border-[#d2d2d7] text-[#1d1d1f] hover:border-[#86868b]'
                          }`}
                        >
                          <span className="truncate flex items-center gap-2">
                            <span className="truncate">{cd.clinic.clinicName}</span>
                            {cd.hasReceptionist === false && (
                              <span className="text-[10px] text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full border border-[#e5e5ea] font-medium shrink-0">
                                No Desk Staff
                              </span>
                            )}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-[#0066cc] shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mb-5 pb-4 border-b border-[#e5e5ea]/80">
                  <span className="text-meta block mb-1">Clinic</span>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-semibold text-[#1d1d1f] truncate">
                      {selectedClinic?.clinic.clinicName}
                    </p>
                    {selectedClinic?.hasReceptionist === false && (
                      <span className="text-[10px] text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full border border-[#e5e5ea] shrink-0">
                        No Desk Staff
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Date & Shift Selectors */}
              {doctor.clinics && doctor.clinics.length > 0 && (
                <>
                  {/* Date Selector */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="ui-label mb-0">Date</label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedDate(getLocalDateString())}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                            selectedDate === getLocalDateString()
                              ? 'bg-[#1d1d1f] text-white'
                              : 'bg-[#f5f5f7] text-[#6e6e73] hover:text-[#1d1d1f]'
                          }`}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDate(getTomorrowDateString())}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                            selectedDate === getTomorrowDateString()
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
                      value={selectedDate}
                      min={getLocalDateString()}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="ui-input"
                    />
                  </div>

                  {/* Shift Selector */}
                  {activeSlots.length > 1 && (
                    <div className="mb-5">
                      <label className="ui-label">Shift</label>
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
                              className={`w-full px-3.5 py-2.5 rounded-xl border text-left text-[13px] transition-all flex items-center justify-between ${
                                isPassed
                                  ? 'bg-[#f5f5f7] border-[#e5e5ea] text-[#86868b] cursor-not-allowed opacity-60'
                                  : isSelected
                                  ? 'bg-[#0066cc]/[0.04] border-[#0066cc] text-[#1d1d1f] font-semibold ring-2 ring-[#0066cc]/12 cursor-pointer'
                                  : 'bg-white border-[#d2d2d7] text-[#1d1d1f] hover:border-[#86868b] cursor-pointer'
                              }`}
                            >
                              <span className="truncate">{cleanSlotName(slot.name)}</span>
                              <span className="text-xs text-[#6e6e73] shrink-0 ml-2">
                                {format12Hour(slot.startTime)} – {format12Hour(slot.endTime)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Live Token Preview Tile */}
                  {loadingQueue ? (
                    <div className="p-4 rounded-2xl bg-[#f5f5f7] animate-pulse h-24 mb-5" />
                  ) : queuePreview ? (
                    <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] mb-5">
                      <div className="flex items-baseline justify-between mb-2">
                        <div>
                          <span className="text-meta block">Your Token</span>
                          <span className="text-2xl font-bold tracking-tight text-[#0066cc]">
                            #{queuePreview.nextQueueNumber}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-meta block">Est. Time</span>
                          <span className="text-[15px] font-semibold text-[#1d1d1f]">
                            {queuePreview.estimatedTime}
                          </span>
                        </div>
                      </div>
                      <div className="pt-2.5 border-t border-[#e5e5ea] text-xs text-[#6e6e73] flex items-center justify-between">
                        <span>{queuePreview.checkingWindow}</span>
                        <span className="font-medium">
                          {queuePreview.patientsAhead === 0
                            ? 'Next in line'
                            : `${queuePreview.patientsAhead} ahead`}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </>
              )}

              {/* Consultation Fee & Receptionist Notice */}
              <div className="pt-4 border-t border-[#e5e5ea]/80 mb-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-secondary">Consultation Fee</span>
                  <span className="text-lg font-bold text-[#1d1d1f]">₹{activeFee}</span>
                </div>
                <p className="text-meta leading-relaxed">
                  Pay at the clinic front desk to confirm your token.
                </p>
              </div>

              {queuePreview?.hasReceptionist === false ? (
                <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Online booking closed: No front-desk receptionist is assigned at this facility.</span>
                </div>
              ) : queuePreview?.isPassed ? (
                <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs">
                  Shift ended. Pick an upcoming shift or date.
                </div>
              ) : queuePreview?.isFull ? (
                <div className="mb-4 p-3 rounded-xl bg-[#ff3b30]/8 border border-[#ff3b30]/20 text-[#d70015] text-xs">
                  Shift is full. Select another slot or date.
                </div>
              ) : null}

              <AppleButton
                variant="primary"
                size="lg"
                disabled={Boolean(
                  !doctor.clinics ||
                    doctor.clinics.length === 0 ||
                    queuePreview?.isFull ||
                    queuePreview?.isPassed ||
                    queuePreview?.hasReceptionist === false
                )}
                onClick={() =>
                  navigate(
                    `/book/${doctor.id}?date=${selectedDate}${selectedSlotId ? `&slot=${selectedSlotId}` : ''}${
                      selectedClinicId ? `&clinic=${selectedClinicId}` : ''
                    }`
                  )
                }
                className="w-full"
              >
                {!doctor.clinics || doctor.clinics.length === 0
                  ? 'Booking Unavailable'
                  : queuePreview?.hasReceptionist === false
                  ? 'No Desk Staff at Clinic'
                  : queuePreview?.isPassed
                  ? 'Shift Ended'
                  : queuePreview?.isFull
                  ? 'Shift Full'
                  : 'Continue to Booking'}
              </AppleButton>
            </UtilityCard>
          </div>
        </div>
      </div>
    </div>
  );
};
