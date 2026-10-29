import { formatClinicAddress } from '../../utils/address';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  cleanSlotName, getMaxBookingDateString } from '../../services/api';
import { SubNav } from '../../components/layout/SubNav';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import { CabinStatusBadge } from '../../components/ui/DoctorCabinPresence';
import {
  ShieldCheck,
  MapPin,
  ChevronLeft,
  AlertCircle,
  Check,
} from 'lucide-react';



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
  const [searchParams] = useSearchParams();
  const paramClinicId = searchParams.get('clinicId') || searchParams.get('clinic');

  useEffect(() => {
    const fetchDoctor = async () => {
      if (!id) return;
      try {
        const data = await api.getDoctorById(id);
        setDoctor(data);
        if (data.clinics && data.clinics.length > 0) {
          const matchedClinic = paramClinicId
            ? data.clinics.find((c) => c.clinicId === paramClinicId || c.clinic?.id === paramClinicId)
            : null;
          const targetClinic = matchedClinic || data.clinics[0];
          setSelectedClinicId((prev) => prev || targetClinic.clinicId);
          const clinicSlots = (targetClinic.slots && targetClinic.slots.length > 0) ? targetClinic.slots : parseDoctorSlots(data);
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
  }, [id, paramClinicId]);

  useEffect(() => {
    // Ignore answers that arrive after the selection changed (a slow first request
    // without a clinic used to overwrite the right answer and show "closed").
    let stale = false;
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
        if (stale) return;
        setQueuePreview(preview);
        if (preview.selectedSlotId && (!selectedSlotId || (preview.isPassed && preview.selectedSlotId !== selectedSlotId))) {
          setSelectedSlotId(preview.selectedSlotId);
        }
      } catch (err) {
        console.error('Failed to calculate queue preview:', err);
      } finally {
        if (!stale) setLoadingQueue(false);
      }
    };
    fetchQueue();
    return () => {
      stale = true;
    };
  }, [id, selectedDate, selectedSlotId, selectedClinicId]);

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
          <p className="text-xs text-[#86868b] mb-6">This doctor isn’t available.</p>
          <AppleButton variant="primary" onClick={() => navigate('/doctors')}>
            Find Doctors
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
          {/* 1. Doctor Identity, over a soft blue cover */}
          <div className="relative -mx-5 -mt-5 sm:-mx-6 sm:-mt-6 h-24 sm:h-32 rounded-t-2xl overflow-hidden bg-gradient-to-br from-[#d6e8fb] via-[#e9f2fc] to-[#f5f9ff]">
            <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-[radial-gradient(closest-side,rgba(0,102,204,0.18),transparent)]" />
          </div>
          <div className="relative -mt-12 sm:-mt-14 flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-5 pb-6 border-b border-[#f0f0f2]">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white border-4 border-white ring-1 ring-[#e5e5ea] overflow-hidden shrink-0 flex items-center justify-center">
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
              <div className={`doc-detail-fallback w-full h-full ${doctor.user?.avatarUrl ? 'hidden' : 'flex'} items-center justify-center text-2xl sm:text-3xl font-semibold bg-[#0066cc] text-white  select-none`}>
                {(doctor.user?.fullName ? doctor.user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] : null) || 'D'}
              </div>
            </div>

            <div className="flex-1 min-w-0 sm:pb-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[22px] sm:text-[26px] font-semibold text-[#1d1d1f] tracking-tight truncate leading-snug">
                  {doctor.user?.fullName || 'Doctor'}
                </h2>
                <span title="Verified Doctor">
                  <ShieldCheck className="w-5 h-5 text-[#0066cc] shrink-0" />
                </span>
              </div>

              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0066cc]/10 text-[#0066cc]">
                  {doctor.specialty}
                </span>
                <CabinStatusBadge status={doctor.cabinStatus} expectedReturnTime={doctor.expectedReturnTime} size="sm" />
              </div>

              <p className="text-xs text-[#86868b] font-normal mt-1.5">
                {formatDoctorDegrees(doctor.qualifications)}
                {doctor.experienceYears ? ` · ${doctor.experienceYears} yrs experience` : ''}
              </p>
            </div>
          </div>

          {/* Quick facts */}
          <div className="grid grid-cols-3 gap-2.5 py-5 border-b border-[#f0f0f2]">
            {[
              { label: 'Experience', value: doctor.experienceYears ? `${doctor.experienceYears} yrs` : '—' },
              { label: 'Fee', value: activeFee ? `₹${activeFee}` : '—' },
              { label: 'Clinics', value: String(doctor.clinics?.length || 0) },
            ].map((f) => (
              <div key={f.label} className="rounded-2xl bg-[#f5f5f7] px-3 py-3 text-center">
                <p className="text-lg sm:text-xl font-semibold tracking-tight text-[#1d1d1f]">{f.value}</p>
                <p className="mt-0.5 text-[11px] text-[#86868b]">{f.label}</p>
              </div>
            ))}
          </div>

          {/* 2. Schedule */}
          <div className="py-6 border-b border-[#f0f0f2]">
            <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3 tracking-tight">Schedule</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {activeSlots.map((slot, idx) => (
                <div
                  key={slot.id || idx}
                  className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-between"
                >
                  <span className="text-xs font-normal text-[#1d1d1f]">
                    {cleanSlotName(slot.name)}
                  </span>
                  <span className="text-xs font-semibold text-[#0066cc]">
                    {format12Hour(slot.startTime)} – {format12Hour(slot.endTime)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. About */}
          <div className="py-6 border-b border-[#f0f0f2]">
            <h3 className="text-sm font-semibold text-[#1d1d1f] mb-2 tracking-tight">About</h3>
            <p className="text-sm leading-relaxed text-[#48484a]">
              {doctor.bio || `${doctor.specialty || 'Doctor'} consultations.`}
            </p>
          </div>

          {/* 4. Clinics */}
          {doctor.clinics && doctor.clinics.length > 0 ? (
            <div className="py-6 border-b border-[#f0f0f2]">
              <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3 tracking-tight">Clinics</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {doctor.clinics.map((cd) => {
                  const isSelected = selectedClinicId === cd.clinicId;
                  const clinicFee = cd.consultationFee ?? doctor.consultationFee;
                  return (
                    <div
                      key={cd.clinicId}
                      onClick={() => handleSelectClinic(cd.clinicId)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? 'bg-white border-[#0066cc] ring-4 ring-[#0066cc]/10 '
                          : 'bg-[#f5f5f7]/60 border-[#e5e5ea] hover:bg-white hover:border-[#d2d2d7]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-[#1d1d1f] truncate">
                            {cd.clinic.clinicName}
                          </h4>
                          <p className="text-xs text-[#86868b] mt-0.5 flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 shrink-0 text-[#86868b]" />
                            <span className="truncate">
                              {formatClinicAddress(cd.clinic, { withState: false })}
                            </span>
                          </p>
                        </div>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-[#0066cc] text-white flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <div className="mt-2.5 pt-2.5 border-t border-[#e5e5ea] flex items-center justify-between text-xs">
                        <span className="text-[#86868b]">Fee</span>
                        <span className="font-semibold text-[#1d1d1f]">₹{clinicFee}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}


        </UtilityCard>
      </div>

      {/* Live Queue Booking Preview Widget (1 Column) */}
      <div className="space-y-6">
        <UtilityCard className="lg:sticky lg:top-28">
          <h3 className="text-[19px] font-semibold text-[#1d1d1f] tracking-tight mb-4">Book Appointment</h3>

          {/* Clinic Selection */}
          {(!doctor.clinics || doctor.clinics.length === 0) ? (
            <div className="mb-4 p-3.5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs">
              <div className="flex items-center gap-1.5 font-semibold mb-1">
                <AlertCircle className="w-4 h-4 text-[#86868b] shrink-0" />
                <span>Booking closed</span>
              </div>
              <p className="text-xs text-[#86868b]">
                This doctor isn’t linked to a clinic yet.
              </p>
            </div>
          ) : (
            doctor.clinics.length > 1 ? (
              <div className="mb-4">
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">Clinic</label>
                <div className="space-y-1.5">
                  {doctor.clinics.map((cd) => {
                    const isSelected = selectedClinicId === cd.clinicId;
                    return (
                      <button
                        key={cd.clinicId}
                        type="button"
                        onClick={() => handleSelectClinic(cd.clinicId)}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-left text-xs transition-all duration-150 flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-white border-[#0066cc] ring-4 ring-[#0066cc]/10 text-[#1d1d1f] font-semibold'
                            : 'bg-white border-[#d2d2d7] text-[#1d1d1f] hover:border-[#86868b]'
                        }`}
                      >
                        <span className="truncate flex items-center gap-1.5">
                          <span>{cd.clinic.clinicName}</span>
                          {cd.hasReceptionist === false && (
                            <span className="text-[11px] text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full border border-[#e5e5ea]">
                              Closed
                            </span>
                          )}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#0066cc] shrink-0 ml-1.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <span className="block text-xs font-normal text-[#1d1d1f] mb-1 tracking-tight">Clinic</span>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#1d1d1f] truncate">{selectedClinic?.clinic.clinicName}</p>
                  {selectedClinic?.hasReceptionist === false && (
                    <span className="text-[11px] text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full border border-[#e5e5ea] shrink-0">
                      Closed
                    </span>
                  )}
                </div>
              </div>
            )
          )}

          {/* Date & Shift Selectors */}
          {doctor.clinics && doctor.clinics.length > 0 && (
            <>
              {/* Date Selector */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-normal text-[#1d1d1f] tracking-tight">Date</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedDate(getLocalDateString())}
                      className={`h-8 px-3.5 inline-flex items-center rounded-full text-xs font-normal transition-all duration-150 cursor-pointer border ${
                        selectedDate === getLocalDateString()
                          ? 'bg-[#0066cc] text-white border-[#0066cc]'
                          : 'bg-[#f5f5f7] text-[#1d1d1f] border-[#e5e5ea] hover:bg-[#e8e8ed]'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(getTomorrowDateString())}
                      className={`h-8 px-3.5 inline-flex items-center rounded-full text-xs font-normal transition-all duration-150 cursor-pointer border ${
                        selectedDate === getTomorrowDateString()
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
                  value={selectedDate}
                  min={getLocalDateString()}
                  max={getMaxBookingDateString()}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              {/* Shift Selector */}
              {activeSlots.length > 1 && (
                <div className="mb-4">
                  <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">Shift</label>
                  <div className="space-y-1.5">
                    {activeSlots.map((slot) => {
                      const slotStatus = queuePreview?.availableSlots?.find((s) => s.slot.id === slot.id);
                      const isPassed = Boolean(slotStatus?.isPassed);
                      const isFull = Boolean(slotStatus?.isFull);
                      const isSelected = selectedSlotId === slot.id;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={isPassed || isFull}
                          onClick={() => setSelectedSlotId(slot.id)}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-left text-xs transition-all duration-150 flex items-center justify-between ${
                            isPassed || isFull
                              ? 'bg-[#f5f5f7] border-[#e5e5ea] text-[#86868b] cursor-not-allowed opacity-60'
                              : isSelected
                              ? 'bg-white border-[#0066cc] ring-4 ring-[#0066cc]/10 text-[#1d1d1f] font-semibold cursor-pointer'
                              : 'bg-white border-[#d2d2d7] text-[#1d1d1f] hover:border-[#86868b] cursor-pointer'
                          }`}
                        >
                          <span className="truncate">{cleanSlotName(slot.name)}</span>
                          <span className="text-[11px] text-[#86868b] shrink-0 ml-2">
                            {isPassed ? (
                              <span className="text-[#86868b] font-normal">Ended</span>
                            ) : isFull ? (
                              <span className="text-warning font-normal">Full</span>
                            ) : (
                              `${format12Hour(slot.startTime)} – ${format12Hour(slot.endTime)}`
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Live Token Preview Tile */}
              {loadingQueue ? (
                <div className="p-4 rounded-2xl bg-[#f5f5f7] animate-pulse h-20 mb-4"></div>
              ) : queuePreview ? (
                <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] mb-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <div>
                      <span className="text-[11px] text-[#86868b] block font-normal">Token</span>
                      <span className="text-2xl font-semibold tracking-tight text-[#0066cc]">
                        #{queuePreview.nextQueueNumber}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-[#86868b] block font-normal">Est. Time</span>
                      <span className="text-base font-semibold text-[#1d1d1f]">
                        {queuePreview.estimatedTime}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#e5e5ea] text-[11px] text-[#86868b] flex items-center justify-between">
                    <span>{cleanSlotName(queuePreview.checkingWindow)}</span>
                    <span>
                      {queuePreview.patientsAhead === 0
                        ? 'You’d be next'
                        : `${queuePreview.patientsAhead} ahead`}
                    </span>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {/* Fee & Confirmation Notice */}
          <div className="pt-3 border-t border-[#f0f0f2] mb-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#86868b]">Fee</span>
              <span className="text-base font-semibold text-[#1d1d1f]">₹{activeFee}</span>
            </div>
            <p className="text-[11px] text-[#86868b] leading-relaxed">
              Pay the receptionist by UPI over a call or at the desk to confirm your token.
            </p>
          </div>

          {queuePreview?.hasReceptionist === false ? (
            <div className="mb-3 p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-[#86868b] shrink-0 mt-0.5" />
              <span>Online booking is closed at this clinic for now.</span>
            </div>
          ) : queuePreview?.isPassed ? (
            <div className="mb-3 p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs">
              This shift has ended. Pick another shift or date.
            </div>
          ) : queuePreview?.isFull ? (
            <div className="mb-3 p-3 rounded-xl bg-danger-soft/80 border border-danger-line/80 text-danger text-xs">
              This shift is full. Pick another shift or date.
            </div>
          ) : null}

          <button
            type="button"
            disabled={Boolean(!doctor.clinics || doctor.clinics.length === 0 || queuePreview?.isFull || queuePreview?.isPassed || queuePreview?.hasReceptionist === false)}
            onClick={() =>
              navigate(
                `/book/${doctor.id}?date=${selectedDate}${selectedSlotId ? `&slot=${selectedSlotId}` : ''}${selectedClinicId ? `&clinic=${selectedClinicId}` : ''}`
              )
            }
            className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {!doctor.clinics || doctor.clinics.length === 0
              ? 'Booking closed'
              : queuePreview?.hasReceptionist === false
              ? 'Booking closed'
              : queuePreview?.isPassed
              ? 'Shift ended'
              : queuePreview?.isFull
              ? 'Shift full'
              : 'Book Token'}
          </button>
        </UtilityCard>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-24 md:pb-16 pb-safe">
      <SubNav title={doctor.user?.fullName || 'Doctor'} subtitle={doctor.specialty} width="6xl">
        <AppleButton
          variant="ghost"
          size="sm"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/doctors'))}
          className="flex items-center gap-1 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </AppleButton>
      </SubNav>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-5 sm:pt-8">
        {detailContent}
      </div>
    </div>
  );
};
