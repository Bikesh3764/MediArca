import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, Appointment, getLocalDateString, getFileUrl, cleanSlotName, formatDisplayDate } from '../../services/api';
import { Clock, Calendar, MapPin, CheckCircle2, Building2, Phone, QrCode } from 'lucide-react';
import { AppleButton } from '../ui/AppleButton';
import { CabinStatusBadge } from '../ui/DoctorCabinPresence';
import { formatDisplayPhone, toTelUri } from '../../utils/phoneUtils';
import { useToast } from '../../context/ToastContext';

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

  const { toast } = useToast();
  const [imgError, setImgError] = useState(false);
  const [togglingPresence, setTogglingPresence] = useState(false);
  const [presenceOverride, setPresenceOverride] = useState<boolean | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setPresenceOverride(null);
    });
  }, [appointment.id, appointment.isCheckedIn, appointment.doctor?.cabinStatus]);

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
      toast.success(newState ? 'Checked in' : 'Marked as stepped out');
    } catch (err: any) {
      toast.error(err.message || 'Couldn’t update. Try again.');
    } finally {
      setTogglingPresence(false);
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
    'Front desk';

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
  const cleanShiftWindow = cleanSlotName(checkingWindow, 'Shift');

  return (
    <div className="bg-white rounded-2xl border border-[#e5e5ea]  overflow-hidden hover:border-[#0066cc]/30 transition-all duration-150">
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
                <div className="w-full h-full flex items-center justify-center font-semibold text-xl text-white bg-[#0066cc]">
                  {(rawDocName || 'D')[0]}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
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
                  <span className="text-xs font-normal text-[#86868b]">Est. Token</span>
                  <span className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">#{estToken}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[11px] font-normal text-[#86868b]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#86868b]"></span>
                  <span>Awaiting payment</span>
                </div>
              </div>
            ) : status === 'EXPIRED' ? (
              <div className="bg-[#f5f5f7] border border-[#e5e5ea] px-3.5 py-1.5 rounded-full flex items-center gap-1.5">
                <span className="text-xs font-normal text-[#86868b]">Expired</span>
              </div>
            ) : status === 'COMPLETED' ? (
              <div className="bg-[#f5f5f7] border border-[#e5e5ea] px-3.5 py-1.5 rounded-full flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0066cc]" />
                <span className="text-xs font-semibold text-[#1d1d1f]">Completed • Token #{queueNumber}</span>
              </div>
            ) : isToday && (status === 'IN_CONSULTATION' || (status === 'WAITING' && liveQueue?.currentServingQueueNumber === queueNumber && queueNumber > 0)) ? (
              <div className="bg-[#0066cc] text-white px-4 py-2 rounded-2xl flex items-baseline gap-2 ">
                <span className="text-xs font-normal text-white/80">Serving</span>
                <span className="text-2xl font-semibold text-white tracking-tight">#{queueNumber}</span>
              </div>
            ) : status === 'CANCELLED' || status === 'REJECTED' ? (
              <div className="bg-danger-soft/80 border border-danger-line/80 px-3.5 py-1.5 rounded-full text-xs font-semibold text-danger">
                {status === 'REJECTED' ? 'Declined' : 'Cancelled'}
              </div>
            ) : (
              <div className="bg-[#f5f5f7] border border-[#e5e5ea] px-4 py-2 rounded-2xl flex items-baseline gap-2">
                <span className="text-xs font-normal text-[#86868b]">Queue</span>
                <span className="text-2xl font-semibold text-[#0066cc] tracking-tight">#{queueNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* 3-Tile Apple Metadata Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-5">
          {/* Tile 1: Date */}
          <div className="bg-[#f5f5f7] rounded-xl p-2.5 sm:p-3.5 border border-[#e5e5ea] flex flex-col justify-center min-w-0">
            <span className="text-[11px] font-normal text-[#86868b]">Date</span>
            <div className="text-[13px] sm:text-[14px] font-semibold text-[#1d1d1f] mt-0.5 flex items-center gap-1.5 leading-snug sm:truncate">
              <Calendar className="hidden sm:block w-3.5 h-3.5 text-[#0066cc] shrink-0" />
              <span className="sm:truncate">{formatDisplayDate(appointmentDate)}</span>
            </div>
          </div>

          {/* Tile 2: Shift */}
          <div className="bg-[#f5f5f7] rounded-xl p-2.5 sm:p-3.5 border border-[#e5e5ea] flex flex-col justify-center min-w-0">
            <span className="text-[11px] font-normal text-[#86868b]">Shift</span>
            <div className="text-[13px] sm:text-[14px] font-semibold text-[#1d1d1f] mt-0.5 flex items-center gap-1.5 leading-snug sm:truncate">
              <Clock className="hidden sm:block w-3.5 h-3.5 text-[#0066cc] shrink-0" />
              <span className="sm:truncate">{cleanShiftWindow}</span>
            </div>
          </div>

          {/* Tile 3: Est. Time / Status */}
          <div className="bg-[#f5f5f7] rounded-xl p-2.5 sm:p-3.5 border border-[#e5e5ea] flex flex-col justify-center min-w-0">
            <span className="text-[11px] font-normal text-[#86868b]">
              {status === 'COMPLETED' || status === 'EXPIRED' || status === 'CANCELLED' || status === 'REJECTED' ? 'Status' : 'Time'}
            </span>
            <div className="text-[13px] sm:text-[14px] font-semibold mt-0.5 flex items-center gap-1.5 leading-snug sm:truncate">
              {status === 'IN_CONSULTATION' ? (
                <span className="text-[#0066cc] font-semibold sm:truncate">In Cabin</span>
              ) : status === 'COMPLETED' ? (
                <span className="text-[#86868b] sm:truncate">Completed</span>
              ) : status === 'EXPIRED' ? (
                <span className="text-[#86868b] sm:truncate">Expired</span>
              ) : status === 'CANCELLED' || status === 'REJECTED' ? (
                <span className="text-danger sm:truncate">{status === 'REJECTED' ? 'Declined' : 'Cancelled'}</span>
              ) : isToday && liveQueue?.currentServingQueueNumber === queueNumber && queueNumber > 0 ? (
                <span className="text-[#0066cc] font-semibold sm:truncate">Called</span>
              ) : liveQueue?.isShiftPassed ? (
                <span className="text-[#86868b] sm:truncate">Shift ended</span>
              ) : isToday && liveQueue?.liveEstimatedTime && /\d/.test(liveQueue.liveEstimatedTime) ? (
                // Live time from the server (shift start, doctor away, real pace); "Ahead of you" says who's next
                <span className="text-[#0066cc] sm:truncate">~{liveQueue.liveEstimatedTime}</span>
              ) : (
                <span className="text-[#0066cc] sm:truncate">{estimatedTime || 'By queue'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Reason for Visit (only when custom/non-default) */}
        {appointment.reasonForVisit && appointment.reasonForVisit !== 'General Medical Consultation' && (
          <div className="mt-3 px-3.5 py-2 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs text-[#86868b] flex items-center gap-2">
            <span className="text-[11px] font-normal text-[#86868b] shrink-0">Reason:</span>
            <span className="text-[#1d1d1f] font-normal truncate">{appointment.reasonForVisit}</span>
          </div>
        )}

        {/* Patient Details (When booked for dependent/family member or explicit patient name) */}
        {(appointment.isForOther || (Boolean(appointment.patientName) && appointment.patient?.user?.fullName && appointment.patientName !== appointment.patient.user.fullName)) && (
          <div className="mt-3.5 p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] font-semibold text-[11px]">
                {appointment.isForOther ? 'Family' : 'Patient'}
              </span>
              <span className="font-semibold text-[#1d1d1f]">
                {appointment.patientName || appointment.patient?.user?.fullName || 'Patient'}
              </span>
              {appointment.patientAge && (
                <span className="text-[#86868b]">
                  • {appointment.patientAge} yrs
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
          <div className="mt-4 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                  <span className="text-xs font-semibold text-[#1d1d1f]">
                    Pay to confirm token #{estToken}
                  </span>
                </div>
                <p className="text-xs text-[#1d1d1f] font-normal mt-1">
                  Receptionist: <span className="font-semibold">{receptionistName}</span>
                </p>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Pay by UPI over a call or at the desk. First to pay is confirmed first.
                </p>
              </div>

              {deskPhone ? (
                <div className="w-full sm:w-auto shrink-0">
                  <a
                    href={toTelUri(deskPhone)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 h-10 sm:h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-normal active:scale-[0.98] transition-all duration-150  select-none cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Call {formatDisplayPhone(deskPhone)}</span>
                  </a>
                </div>
              ) : (
                <div className="shrink-0 text-right text-[11px] text-[#86868b]">
                  <span>Pay the receptionist</span>
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
              <span>Not confirmed before the shift ended.</span>
            </div>
            <Link
              to={`/book/${doctor.id}?clinicId=${appointment.clinicId || ''}`}
              className="inline-flex items-center justify-center h-8 px-4 rounded-full bg-[#0066cc] text-white text-xs font-normal hover:bg-[#0071e3] active:scale-[0.97] transition-all duration-150 select-none cursor-pointer self-start sm:self-auto"
            >
              Book Again
            </Link>
          </div>
        )}

        {/* Physical Clinic & Cabin Presence Status */}
        {isToday && (status === 'WAITING' || status === 'IN_CONSULTATION') ? (
          localCheckedIn ? (
            <div className="mt-3.5 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#0066cc] shrink-0"></span>
                <div>
                  <span className="font-semibold text-[#1d1d1f] block text-xs">
                    You’re checked in
                  </span>
                  <span className="text-[11px] text-[#86868b] block mt-0.5">
                    Wait for your turn
                  </span>
                </div>
              </div>
              {status === 'WAITING' ? (
                <button
                  type="button"
                  disabled={togglingPresence}
                  onClick={() => handleTogglePresence(false)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full bg-white hover:bg-[#e8e8ed] text-[#86868b] hover:text-[#1d1d1f] border border-[#e5e5ea] text-xs font-normal active:scale-[0.98] transition-all duration-150 cursor-pointer select-none shrink-0"
                >
                  <span>{togglingPresence ? 'Updating...' : 'Step out'}</span>
                </button>
              ) : (
                <span className="text-xs text-[#0066cc] font-normal px-3 py-1 rounded-full bg-white border border-[#0066cc]/20 self-start sm:self-auto">
                  With doctor
                </span>
              )}
            </div>
          ) : (
            <div className="mt-3.5 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#86868b] shrink-0"></span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#1d1d1f] text-xs">
                      Not checked in
                    </span>
                  </div>
                  <span className="text-[11px] text-[#86868b] block mt-0.5">
                    Scan the QR code at the front desk when you arrive.
                  </span>
                </div>
              </div>
              <div className="w-full sm:w-auto flex items-center gap-2 self-start sm:self-auto shrink-0">
                {onScanQr ? (
                  <button
                    type="button"
                    onClick={() => onScanQr(appointment)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-sm font-normal active:scale-[0.98] transition-all duration-150  cursor-pointer select-none"
                  >
                    <QrCode className="w-4 h-4 shrink-0" />
                    <span>Check in</span>
                  </button>
                ) : (
                  <Link
                    to={`/clinic-checkin?clinicId=${appointment.clinicId || ''}`}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-sm font-normal active:scale-[0.98] transition-all duration-150  select-none"
                  >
                    <QrCode className="w-4 h-4 shrink-0" />
                    <span>Check in</span>
                  </Link>
                )}
              </div>
            </div>
          )
        ) : null}

        {/* Receptionist Contact for Confirmed Waiting Patients */}
        {status === 'WAITING' && deskPhone && !liveQueue?.isShiftPassed && (
          <div className="mt-3.5 p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />
              <span className="text-[#48484a]">
                Front desk: <strong className="text-[#1d1d1f] font-semibold">{receptionistName}</strong>
              </span>
            </div>
            <a
              href={toTelUri(deskPhone)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 h-9 sm:h-8 px-3.5 rounded-full bg-white hover:bg-[#e8e8ed] text-[#0066cc] border border-[#e5e5ea] text-xs font-normal active:scale-[0.97] transition-all duration-150 select-none cursor-pointer"
            >
              <span>Call {formatDisplayPhone(deskPhone)}</span>
            </a>
          </div>
        )}

        {/* Doctor Shift Concluded Notice for Confirmed WAITING Tickets */}
        {isToday && status === 'WAITING' && liveQueue?.isShiftPassed && (
          <div className="mt-3.5 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[#1d1d1f] font-semibold">
                  <Clock className="w-4 h-4 text-[#86868b] shrink-0" />
                  <span>Shift time is over · Token #{queueNumber} is still valid</span>
                </div>
                <p className="text-[#86868b] mt-1 text-[11px] leading-relaxed">
                  If the doctor is late, stay nearby. Or ask the front desk to move your visit.
                </p>
              </div>
              {deskPhone && (
                <div className="w-full sm:w-auto shrink-0">
                  <a
                    href={toTelUri(deskPhone)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 h-9 sm:h-8 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-normal active:scale-[0.97] transition-all duration-150 select-none cursor-pointer"
                  >
                    <Phone className="w-3 h-3 shrink-0" />
                    <span>Call {formatDisplayPhone(deskPhone)}</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Queue Position Tracker */}
        {isToday && (status === 'WAITING' || status === 'IN_CONSULTATION') && liveQueue && (
          <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-3.5">
              <span className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-2 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-[#0066cc] shrink-0"></span>
                Live queue
              </span>
              <div className="px-3 py-1 rounded-full bg-white border border-[#e5e5ea] text-xs font-normal text-[#48484a] select-none whitespace-nowrap">
                Now serving: <strong className="text-[#1d1d1f] font-semibold">{liveQueue.currentServingQueueNumber > 0 ? `Queue #${liveQueue.currentServingQueueNumber}` : 'Waiting to Call'}</strong>
              </div>
            </div>

            {doctor.cabinStatus === 'STEPPED_OUT' && (
              <div className="mb-3.5 p-3 rounded-xl bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-warning-dot shrink-0"></span>
                <span>
                  <strong className="font-semibold">Doctor stepped out.</strong> Back {doctor.expectedReturnTime ? `around ${doctor.expectedReturnTime}` : 'soon'}.
                </span>
              </div>
            )}
            {doctor.cabinStatus === 'NOT_IN_CABIN' && (
              <div className="mb-3.5 p-3 rounded-xl bg-white border border-[#e5e5ea] text-[#86868b] text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#d2d2d7] shrink-0"></span>
                <span>
                  <strong className="text-[#1d1d1f] font-semibold">Doctor hasn’t arrived yet.</strong>
                </span>
              </div>
            )}

            {status === 'IN_CONSULTATION' || (liveQueue.currentServingQueueNumber === queueNumber && queueNumber > 0) ? (
              <div className="flex items-center gap-3 text-[#1d1d1f] bg-white p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm font-normal border border-[#0066cc]/30">
                <CheckCircle2 className="w-5 h-5 text-[#0066cc] shrink-0" />
                <div>
                  <span className="font-semibold text-[#1d1d1f] block">
                    {status === 'IN_CONSULTATION' ? 'In consultation' : 'It’s your turn'}
                  </span>
                  <span className="text-[#86868b] text-xs font-normal mt-0.5 block">
                    {status === 'IN_CONSULTATION'
                      ? `With ${doctorDisplayName}.`
                      : `Please go in. ${doctorDisplayName} is ready.`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-[#e5e5ea] flex flex-col justify-between">
                  <span className="text-xs font-normal text-[#86868b]">
                    Ahead of you
                  </span>
                  <div className="mt-1.5">
                    <div className="text-xl sm:text-2xl font-semibold text-[#1d1d1f] tracking-tight">
                      {liveQueue.patientsAway}
                    </div>
                    <p className="text-[11px] text-[#86868b] mt-0.5 font-normal">
                      {liveQueue.patientsAway === 0 ? 'You’re next' : `Your token: #${queueNumber}`}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-[#e5e5ea] flex flex-col justify-between">
                  <span className="text-xs font-normal text-[#86868b]">
                    Wait time
                  </span>
                  {isToday && liveQueue.isShiftPassed ? (
                    <div className="mt-1.5">
                      <div className="text-xl sm:text-2xl font-semibold text-[#86868b] tracking-tight">
                        Shift ended
                      </div>
                      <p className="text-[11px] text-[#86868b] mt-0.5 font-normal">Token still valid</p>
                    </div>
                  ) : (
                  <div className="mt-1.5">
                    <div className="text-xl sm:text-2xl font-semibold text-[#0066cc] tracking-tight">
                      {liveQueue.estimatedWaitMinutes >= 60 ? (
                        <>
                          ~{Math.floor(liveQueue.estimatedWaitMinutes / 60)} <span className="text-xs sm:text-sm font-semibold text-[#86868b]">hr</span>
                          {liveQueue.estimatedWaitMinutes % 60 > 0 && (
                            <> {liveQueue.estimatedWaitMinutes % 60} <span className="text-xs sm:text-sm font-semibold text-[#86868b]">min</span></>
                          )}
                        </>
                      ) : liveQueue.estimatedWaitMinutes > 0 ? (
                        <>~{liveQueue.estimatedWaitMinutes} <span className="text-xs sm:text-sm font-semibold text-[#86868b]">min</span></>
                      ) : (
                        'Now'
                      )}
                    </div>
                    <p className="text-[11px] text-[#86868b] mt-0.5 font-normal">
                      {liveQueue.delayReason === 'BEFORE_SHIFT'
                        ? 'Shift not started'
                        : liveQueue.delayReason === 'STEPPED_OUT'
                        ? 'Doctor away'
                        : liveQueue.delayReason === 'DOCTOR_NOT_IN'
                        ? 'Doctor not in yet'
                        : 'Approx.'}
                    </p>
                  </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Footer */}
        {(status === 'WAITING' || status === 'PENDING_APPROVAL') && onCancel && (
          <div className="mt-4 pt-3.5 border-t border-[#f0f0f2] flex items-center justify-end">
            <AppleButton
              variant="ghost"
              size="sm"
              onClick={() => onCancel(appointment.id)}
              className="text-danger hover:text-danger hover:bg-danger-soft text-xs font-semibold px-3.5 py-1 rounded-full w-full sm:w-auto active:scale-[0.97] transition-all duration-150 cursor-pointer select-none"
            >
              {status === 'PENDING_APPROVAL' ? 'Cancel request' : 'Cancel token'}
            </AppleButton>
          </div>
        )}
      </div>
    </div>
  );
};
