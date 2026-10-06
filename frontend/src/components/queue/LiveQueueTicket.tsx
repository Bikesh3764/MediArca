import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, Appointment, getLocalDateString, getFileUrl } from '../../services/api';
import { Clock, Calendar, MapPin, CheckCircle2, Building2, Star, Phone, QrCode } from 'lucide-react';
import { AppleButton } from '../ui/AppleButton';
import { CabinStatusBadge } from '../ui/DoctorCabinPresence';
import { formatDisplayPhone } from '../../utils/phoneUtils';

interface LiveQueueTicketProps {
  appointment: Appointment;
  onCancel?: (id: string) => void;
  onScanQr?: (appointment: Appointment) => void;
  onTogglePresence?: (appointmentId: string, isCheckedIn: boolean) => Promise<void>;
}

export const LiveQueueTicket: React.FC<LiveQueueTicketProps> = ({
  appointment,
  onCancel,
  onScanQr,
  onTogglePresence,
}) => {
  const { doctor, queueNumber, status, appointmentDate, checkingWindow, estimatedTime, liveQueue } =
    appointment;

  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [submittedReview, setSubmittedReview] = useState(appointment.review);
  const [imgError, setImgError] = useState(false);
  const [togglingPresence, setTogglingPresence] = useState(false);
  const [presenceOverride, setPresenceOverride] = useState<boolean | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setPresenceOverride(null);
    });
  }, [appointment.doctor?.cabinStatus]);

  const localCheckedIn = presenceOverride !== null ? presenceOverride : Boolean(appointment.isCheckedIn);

  const handleTogglePresence = async (newState: boolean) => {
    setTogglingPresence(true);
    try {
      if (onTogglePresence) {
        await onTogglePresence(appointment.id, newState);
      } else {
        await api.checkInAppointmentDirect(appointment.id, newState);
      }
      setPresenceOverride(newState);
    } catch (err: any) {
      alert(err.message || 'Failed to update presence status');
    } finally {
      setTogglingPresence(false);
    }
  };

  const handleSubmitReview = async () => {
    setSubmittingReview(true);
    setReviewError(null);
    try {
      const res = await api.submitAppointmentReview(appointment.id, {
        rating,
        comment: comment.trim() || undefined,
      });
      setSubmittedReview(res?.data || { rating, comment });
    } catch (err: any) {
      setReviewError(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const isToday = appointmentDate === getLocalDateString();

  // Prioritize receptionist phone, fallback to clinic phone
  const receptionistPhone = appointment.receptionistPhone;
  const clinicPhone = appointment.clinic?.phone;
  const deskPhone = receptionistPhone || clinicPhone;

  // Resolved receptionist / front desk name
  const receptionistName =
    appointment.receptionistName ||
    (appointment.clinic?.clinicName ? `${appointment.clinic.clinicName} Front Desk` : 'Front Desk Receptionist');

  // Estimated token number calculation (guaranteed to start from 1, never 0 or negative)
  const rawEstToken =
    appointment.estimatedQueueNumber ||
    liveQueue?.estimatedQueueNumber ||
    (queueNumber > 0 ? queueNumber : 1);
  const estToken = Math.max(1, rawEstToken);

  // Clean doctor name to prevent duplicate "Dr. Dr."
  const rawDocName = doctor.user?.fullName || 'Doctor';
  const doctorDisplayName = rawDocName.startsWith('Dr.') ? rawDocName : `Dr. ${rawDocName}`;

  // Clean shift window display
  const cleanShiftWindow = checkingWindow
    ? checkingWindow.replace(/^Doctor Shift:\s*/i, '').replace(/^Shift\s*\d+\s*\((.+)\)$/i, '$1')
    : 'Standard Hours';

  return (
    <div className="bg-white rounded-[20px] border border-[#e5e5ea] shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.03)] overflow-hidden hover:border-[#0066cc]/30 transition-all duration-150">
      <div className="p-5 sm:p-6">
        {/* Unified Apple Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Doctor Info */}
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#f5f5f7] border border-black/[0.06] overflow-hidden shrink-0 flex items-center justify-center">
              {doctor.user?.avatarUrl && !imgError ? (
                <img
                  src={getFileUrl(doctor.user.avatarUrl)}
                  alt={doctorDisplayName}
                  className="w-full h-full object-cover object-top"
                  onError={() => setImgError(true)}
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-semibold text-xl text-[#0066cc] bg-[#0066cc]/10">
                  {(rawDocName || 'D')[0]}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight">
                  {doctorDisplayName}
                </h3>
                <CabinStatusBadge status={doctor.cabinStatus} expectedReturnTime={doctor.expectedReturnTime} size="sm" />
              </div>
              <p className="text-[13px] font-semibold text-[#0066cc] mt-0.5">{doctor.specialty}</p>
              <div className="flex items-center gap-1.5 text-[13px] text-[#86868b] mt-0.5">
                {appointment.clinic ? (
                  <>
                    <Building2 className="w-3.5 h-3.5 shrink-0 text-[#86868b]" />
                    <span className="truncate max-w-[220px] sm:max-w-[340px]">
                      {appointment.clinic.clinicName}
                      {appointment.clinic.city ? ` • ${appointment.clinic.city}` : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-[#86868b]" />
                    <span className="truncate max-w-[220px] sm:max-w-[300px]">{doctor.clinicAddress || 'Healthcare Clinic'}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Apple Status / Token Capsule */}
          <div className="shrink-0 self-start sm:self-center">
            {status === 'PENDING_APPROVAL' ? (
              <div className="flex flex-col items-end gap-1.5">
                <div className="bg-[#f5f5f7] border border-[#e5e5ea] px-4 py-1.5 rounded-2xl flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Est. Token</span>
                  <span className="text-2xl font-bold text-[#1d1d1f] tracking-tight">#{estToken}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[11px] font-medium text-[#86868b]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#86868b]"></span>
                  <span>Pending Approval</span>
                </div>
              </div>
            ) : status === 'EXPIRED' ? (
              <div className="bg-[#f5f5f7] border border-[#e5e5ea] px-3.5 py-1.5 rounded-full flex items-center gap-1.5">
                <span className="text-xs font-medium text-[#86868b]">Expired</span>
              </div>
            ) : status === 'COMPLETED' ? (
              <div className="bg-[#f5f5f7] border border-[#e5e5ea] px-3.5 py-1.5 rounded-full flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0066cc]" />
                <span className="text-xs font-semibold text-[#1d1d1f]">Completed • Token #{queueNumber}</span>
              </div>
            ) : status === 'IN_CONSULTATION' || liveQueue?.isYourTurn ? (
              <div className="bg-[#1d1d1f] text-white px-4 py-2 rounded-2xl flex items-baseline gap-2 shadow-2xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Serving</span>
                <span className="text-2xl font-bold text-white tracking-tight">#{queueNumber}</span>
              </div>
            ) : status === 'CANCELLED' || status === 'REJECTED' ? (
              <div className="bg-rose-50 border border-rose-200 px-3.5 py-1.5 rounded-full text-xs font-semibold text-rose-700">
                {status === 'REJECTED' ? 'Declined' : 'Cancelled'}
              </div>
            ) : (
              <div className="bg-[#f5f5f7] border border-[#e5e5ea] px-4 py-2 rounded-2xl flex items-baseline gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Queue</span>
                <span className="text-2xl font-bold text-[#0066cc] tracking-tight">#{queueNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* 3-Tile Apple Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          {/* Tile 1: Date */}
          <div className="bg-[#f5f5f7] rounded-xl p-3.5 border border-black/[0.03] flex flex-col justify-center">
            <span className="text-[11px] font-medium text-[#86868b]">Date</span>
            <div className="text-[14px] font-semibold text-[#1d1d1f] mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />
              <span>{appointmentDate} {isToday ? '(Today)' : ''}</span>
            </div>
          </div>

          {/* Tile 2: Shift */}
          <div className="bg-[#f5f5f7] rounded-xl p-3.5 border border-black/[0.03] flex flex-col justify-center">
            <span className="text-[11px] font-medium text-[#86868b]">Shift</span>
            <div className="text-[14px] font-semibold text-[#1d1d1f] mt-0.5 flex items-center gap-1.5 truncate">
              <Clock className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />
              <span className="truncate">{cleanShiftWindow}</span>
            </div>
          </div>

          {/* Tile 3: Est. Time / Status */}
          <div className="bg-[#f5f5f7] rounded-xl p-3.5 border border-black/[0.03] flex flex-col justify-center">
            <span className="text-[11px] font-medium text-[#86868b]">
              {status === 'COMPLETED' || status === 'EXPIRED' || status === 'CANCELLED' || status === 'REJECTED' ? 'Status' : 'Est. Time'}
            </span>
            <div className="text-[14px] font-semibold mt-0.5 flex items-center gap-1.5">
              {status === 'IN_CONSULTATION' ? (
                <span className="text-[#0066cc] font-semibold">In Cabin</span>
              ) : status === 'COMPLETED' ? (
                <span className="text-[#86868b]">Completed</span>
              ) : status === 'EXPIRED' ? (
                <span className="text-[#86868b]">Expired</span>
              ) : status === 'CANCELLED' || status === 'REJECTED' ? (
                <span className="text-rose-600">{status === 'REJECTED' ? 'Declined' : 'Cancelled'}</span>
              ) : liveQueue?.isYourTurn ? (
                <span className="text-[#0066cc] font-semibold">Your Turn</span>
              ) : liveQueue?.isShiftPassed ? (
                <span className="text-amber-600">Shift Ended</span>
              ) : isToday && liveQueue?.isShiftActive && liveQueue?.liveEstimatedTime ? (
                <span className="text-[#0066cc]">~{liveQueue.liveEstimatedTime}</span>
              ) : (
                <span className="text-[#0066cc]">{estimatedTime || 'Per Queue Flow'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Reason for Visit (only when custom/non-default) */}
        {appointment.reasonForVisit && appointment.reasonForVisit !== 'General Medical Consultation' && (
          <div className="mt-3 px-3 py-1.5 rounded-lg bg-[#f5f5f7] text-xs text-[#86868b] flex items-center gap-2">
            <span className="text-[11px] font-medium text-[#86868b] shrink-0">Reason:</span>
            <span className="text-[#1d1d1f] font-medium truncate">{appointment.reasonForVisit}</span>
          </div>
        )}

        {/* Patient Details (When booked for dependent/family member or explicit patient name) */}
        {(appointment.isForOther || (Boolean(appointment.patientName) && appointment.patient?.user?.fullName && appointment.patientName !== appointment.patient.user.fullName)) && (
          <div className="mt-3.5 p-3 rounded-xl bg-[#0066cc]/5 border border-[#0066cc]/15 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] font-semibold text-[10px]">
                {appointment.isForOther ? 'Family / Dependent' : 'Patient'}
              </span>
              <span className="font-semibold text-[#1d1d1f]">
                Patient: {appointment.patientName || appointment.patient?.user?.fullName || 'Patient'}
              </span>
              {appointment.patientAge && (
                <span className="text-[#86868b]">
                  • Age {appointment.patientAge}
                  {appointment.patientGender ? ` (${appointment.patientGender})` : ''}
                </span>
              )}
            </div>
            {appointment.patient?.user?.fullName && (
              <span className="text-[11px] text-[#86868b]">
                Booked by {appointment.patient.user.fullName}
              </span>
            )}
          </div>
        )}

        {/* Pending Receptionist Verification Callout */}
        {status === 'PENDING_APPROVAL' && (
          <div className="mt-4 p-4 rounded-[16px] bg-[#f5f5f7] border border-[#e5e5ea]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                  <span className="text-xs font-semibold text-[#1d1d1f]">
                    Desk Confirmation Pending • Estimated Token #{estToken}
                  </span>
                </div>
                <p className="text-xs text-[#1d1d1f] font-medium mt-1">
                  Receptionist: <span className="font-semibold">{receptionistName}</span>
                </p>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Pay at receptionist desk to confirm token #{estToken}. First come, first confirmed.
                </p>
              </div>

              {deskPhone && (
                <div className="shrink-0">
                  <a
                    href={`tel:${deskPhone.replace(/\s+/g, '')}`}
                    className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full bg-[#1d1d1f] hover:bg-black text-white text-xs font-medium active:scale-[0.97] transition-all duration-150 shadow-2xs select-none cursor-pointer"
                  >
                    <Phone className="w-3 h-3 text-[#86868b] shrink-0" />
                    <span>Call {receptionistName}: {formatDisplayPhone(deskPhone)}</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Expired Consultation Notice */}
        {status === 'EXPIRED' && (
          <div className="mt-3.5 p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#48484a]">
              <Clock className="w-4 h-4 text-[#86868b] shrink-0" />
              <span>Shift ended on {appointmentDate} before confirmation.</span>
            </div>
            <Link
              to={`/book/${doctor.id}?clinicId=${appointment.clinicId || ''}`}
              className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-[#0066cc] text-white text-xs font-medium hover:bg-[#0071e3] active:scale-[0.97] transition-all duration-150 select-none cursor-pointer self-start sm:self-auto"
            >
              Book Again
            </Link>
          </div>
        )}

        {/* Physical Clinic & Cabin Presence Status */}
        {isToday && (status === 'WAITING' || status === 'IN_CONSULTATION') ? (
          localCheckedIn ? (
            <div className="mt-3.5 p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0066cc]"></span>
                <span className="font-semibold text-[#1d1d1f]">
                  Checked In at Clinic • Waiting Area
                </span>
              </div>
              <button
                type="button"
                disabled={togglingPresence}
                onClick={() => handleTogglePresence(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-[#fafafc] text-[#86868b] hover:text-[#1d1d1f] border border-[#e5e5ea] text-[11px] font-medium active:scale-[0.97] transition-all duration-150 shadow-2xs cursor-pointer select-none self-start sm:self-auto"
              >
                <span>{togglingPresence ? 'Updating...' : 'Step Out (Not in Cabin)'}</span>
              </button>
            </div>
          ) : (
            <div className="mt-3.5 p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#86868b]"></span>
                <span className="font-medium text-[#48484a]">
                  Not Checked In (En Route / Outside)
                </span>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                {onScanQr ? (
                  <button
                    type="button"
                    onClick={() => onScanQr(appointment)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-[11px] font-semibold active:scale-[0.97] transition-all duration-150 shadow-2xs cursor-pointer select-none"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Scan Clinic QR to Check In</span>
                  </button>
                ) : (
                  <Link
                    to={`/clinic-checkin?clinicId=${appointment.clinicId || ''}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-[11px] font-semibold active:scale-[0.97] transition-all duration-150 shadow-2xs select-none"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Scan Clinic QR to Check In</span>
                  </Link>
                )}

              </div>
            </div>
          )
        ) : null}

        {/* Doctor Shift Concluded Notice for Confirmed WAITING Tickets */}
        {isToday && status === 'WAITING' && liveQueue?.isShiftPassed && (
          <div className="mt-3.5 p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-amber-900 font-semibold">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Doctor Shift Concluded • Token #{queueNumber} Remains Valid</span>
                </div>
                <p className="text-[#48484a] mt-1 text-[11px] leading-relaxed">
                  If your doctor is consulting overtime, please stay nearby in the waiting area. Otherwise, please speak with the reception desk to reschedule your visit or shift your token to the next day.
                </p>
              </div>
              {deskPhone && (
                <div className="shrink-0">
                  <a
                    href={`tel:${deskPhone.replace(/\s+/g, '')}`}
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-amber-900 hover:bg-black text-white text-xs font-medium active:scale-[0.97] transition-all duration-150 shadow-2xs select-none cursor-pointer"
                  >
                    <Phone className="w-3 h-3 text-amber-200 shrink-0" />
                    <span>Contact Desk: {formatDisplayPhone(deskPhone)}</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Queue Position Tracker */}
        {(status === 'WAITING' || status === 'IN_CONSULTATION') && liveQueue && (
          <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]">
            <div className="flex items-center justify-between gap-3 mb-3.5">
              <span className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0066cc] shrink-0"></span>
                Live Queue Flow
              </span>
              <div className="px-3 py-1 rounded-full bg-white border border-[#e5e5ea] text-xs font-medium text-[#48484a] shadow-[0_1px_2px_rgba(0,0,0,0.02)] select-none">
                Serving: <strong className="text-[#1d1d1f] font-semibold">Queue #{liveQueue.currentServingQueueNumber || 1}</strong>
              </div>
            </div>

            {doctor.cabinStatus === 'STEPPED_OUT' && (
              <div className="mb-3.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                <span>
                  <strong>Doctor stepped out:</strong> Expected back {doctor.expectedReturnTime ? `around ${doctor.expectedReturnTime}` : 'soon'}.
                </span>
              </div>
            )}
            {doctor.cabinStatus === 'NOT_IN_CABIN' && (
              <div className="mb-3.5 p-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0"></span>
                <span>
                  <strong>Doctor not yet in cabin:</strong> Waiting for doctor arrival.
                </span>
              </div>
            )}

            {liveQueue.isYourTurn ? (
              <div className="flex items-center gap-3 text-[#1d1d1f] bg-white p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm font-medium border border-[#0066cc]/30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <CheckCircle2 className="w-5 h-5 text-[#0066cc] shrink-0" />
                <div>
                  <span className="font-semibold text-[#1d1d1f] block">It is your turn now!</span>
                  <span className="text-[#86868b] text-xs font-normal mt-0.5 block">{doctorDisplayName} is ready for you in the consultation cabin.</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-[#e5e5ea] flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                    Patients Ahead
                  </span>
                  <div className="mt-1.5">
                    <div className="text-xl sm:text-2xl font-bold text-[#1d1d1f] tracking-tight">
                      {liveQueue.patientsAway}
                    </div>
                    <p className="text-[11px] text-[#86868b] mt-0.5 font-normal">
                      {liveQueue.patientsAway === 0 ? 'You are next in line' : `Ahead of your Token #${queueNumber}`}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-[#e5e5ea] flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                    Estimated Wait
                  </span>
                  <div className="mt-1.5">
                    <div className="text-xl sm:text-2xl font-bold text-[#0066cc] tracking-tight">
                      ~{liveQueue.estimatedWaitMinutes} <span className="text-xs sm:text-sm font-semibold text-[#86868b]">mins</span>
                    </div>
                    <p className="text-[11px] text-[#86868b] mt-0.5 font-normal">
                      Based on live clinic pace
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Doctor Summary & Review Card for Completed Consultations */}
        {status === 'COMPLETED' && (
          <div className="mt-4 p-4 rounded-xl bg-[#fafafc] border border-[#e5e5ea] space-y-3">
            {appointment.clinicalNotes && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0066cc] block mb-1">
                  Doctor's Summary
                </span>
                <div className="text-xs text-[#1d1d1f] whitespace-pre-wrap break-words leading-relaxed font-normal bg-white p-3 rounded-lg border border-[#e5e5ea]">
                  {appointment.clinicalNotes}
                </div>
              </div>
            )}

            {/* Patient Review Widget */}
            {submittedReview ? (
              <div className="pt-2 border-t border-[#f0f0f0] text-xs">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[#86868b] font-medium">Your Feedback:</span>
                  <div className="flex text-amber-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${
                          star <= (submittedReview.rating || 5)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-[#1d1d1f] ml-1">
                    {submittedReview.rating}/5
                  </span>
                </div>
                {submittedReview.comment && (
                  <p className="text-[#86868b] italic">"{submittedReview.comment}"</p>
                )}
              </div>
            ) : (
              <div className="pt-2 border-t border-[#f0f0f0]">
                <span className="text-[11px] font-semibold text-[#1d1d1f] block mb-1.5">
                  How was your consultation experience?
                </span>
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          star <= rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-gray-300 hover:text-amber-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-semibold text-[#1d1d1f] ml-1.5">{rating} / 5</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Optional feedback..."
                    className="flex-1 h-8 px-3 rounded-lg border border-[#e5e5ea] text-xs bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
                  />
                  <AppleButton
                    variant="primary"
                    size="sm"
                    disabled={submittingReview}
                    onClick={handleSubmitReview}
                    className="text-xs px-3.5 py-1 rounded-lg bg-[#0066cc] hover:bg-[#0071e3] shadow-none"
                  >
                    {submittingReview ? 'Submitting...' : 'Submit'}
                  </AppleButton>
                </div>
                {reviewError && (
                  <p className="text-[11px] text-rose-600 mt-1">{reviewError}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Footer */}
        <div className="mt-4 pt-3.5 border-t border-[#f0f0f2] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-[#86868b] flex items-center gap-1.5">
            <span>Pass ID:</span>
            <span className="font-mono text-[11px] font-medium text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] px-2 py-0.5 rounded-md select-all">
              {appointment.id.slice(0, 8)}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {status === 'COMPLETED' ? (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] flex items-center gap-1.5 select-none">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0066cc]" />
                <span>Consultation Completed</span>
              </span>
            ) : null}

            {(status === 'WAITING' || status === 'PENDING_APPROVAL') && onCancel && (
              <AppleButton
                variant="ghost"
                size="sm"
                onClick={() => onCancel(appointment.id)}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-semibold px-3.5 py-1 rounded-full w-full sm:w-auto active:scale-[0.97] transition-all duration-150 cursor-pointer select-none"
              >
                {status === 'PENDING_APPROVAL' ? 'Withdraw Request' : 'Cancel Token'}
              </AppleButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
