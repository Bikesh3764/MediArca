import React from 'react';
import { Appointment, getLocalDateString } from '../../services/api';
import { Clock, Calendar, MapPin, CheckCircle2, Building2, FileText } from 'lucide-react';
import { AppleButton } from '../ui/AppleButton';
import { CabinStatusBadge } from '../ui/DoctorCabinPresence';

interface LiveQueueTicketProps {
  appointment: Appointment;
  onCancel?: (id: string) => void;
  onViewPrescription?: (appointment: Appointment) => void;
}

export const LiveQueueTicket: React.FC<LiveQueueTicketProps> = ({
  appointment,
  onCancel,
  onViewPrescription,
}) => {
  const { doctor, queueNumber, status, appointmentDate, checkingWindow, estimatedTime, liveQueue } =
    appointment;

  const isToday = appointmentDate === getLocalDateString();

  return (
    <div className="bg-white rounded-[20px] border border-[#e5e5ea] overflow-hidden shadow-sm hover:shadow-apple-card transition-all duration-300">
      {/* Top Header Strip */}
      <div
        className={`px-6 py-3.5 flex items-center justify-between border-b ${
          status === 'IN_CONSULTATION' || liveQueue?.isYourTurn
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800'
            : status === 'PENDING_APPROVAL'
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-800'
            : liveQueue?.patientsAway === 1
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-800'
            : status === 'COMPLETED'
            ? 'bg-gray-100 border-gray-200 text-gray-700'
            : 'bg-[#0088e8]/5 border-[#0088e8]/15 text-[#0088e8]'
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
          <Clock className="w-3.5 h-3.5 text-[#0088e8]" />
          <span>Doctor Shift: {checkingWindow}</span>
        </div>

        {/* Dynamic Status Pill */}
        {status === 'PENDING_APPROVAL' ? (
          <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-amber-500 text-white shadow-2xs flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            Awaiting Desk Approval
          </span>
        ) : status === 'IN_CONSULTATION' || liveQueue?.isYourTurn ? (
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-600 text-white shadow-sm flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white"></span>
            Serving Now
          </span>
        ) : status === 'WAITING' && liveQueue?.patientsAway === 1 ? (
          <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-amber-500 text-white shadow-sm flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            Next in Line
          </span>
        ) : status === 'WAITING' ? (
          <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-[#0088e8] text-white shadow-2xs">
            In Queue
          </span>
        ) : status === 'COMPLETED' ? (
          <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            Completed
          </span>
        ) : status === 'REJECTED' ? (
          <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
            Declined
          </span>
        ) : (
          <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
            Cancelled
          </span>
        )}
      </div>

      {/* Main Pass Body */}
      <div className="p-6 sm:p-7">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-[#f0f0f0]">
          {/* Doctor Info */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex-shrink-0">
              {doctor.user.avatarUrl ? (
                <img
                  src={doctor.user.avatarUrl}
                  alt={doctor.user.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-xl text-[#0088e8]">
                  {doctor.user.fullName[0]}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[19px] font-semibold text-[#1d1d1f] tracking-tight">
                  {doctor.user.fullName}
                </h3>
                <CabinStatusBadge status={doctor.cabinStatus} expectedReturnTime={doctor.expectedReturnTime} size="sm" />
              </div>
              <p className="text-[14px] text-[#0088e8] font-medium">{doctor.specialty}</p>
              <div className="flex items-center gap-1.5 text-xs text-[#86868b] mt-0.5">
                {appointment.clinic ? (
                  <>
                    <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-[#0088e8]" />
                    <span className="truncate max-w-[320px]">
                      {appointment.clinic.clinicName} — {appointment.clinic.address}{appointment.clinic.city ? `, ${appointment.clinic.city}` : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-[#0088e8]" />
                    <span className="truncate max-w-[280px]">{doctor.clinicAddress || 'MediArca Healthcare Clinic'}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Prominent Queue Badge (Apple Boarding Pass Style) */}
          <div className="flex flex-col items-start sm:items-end">
            <span className="text-[11px] font-medium text-[#86868b] uppercase tracking-wider mb-1">
              Queue Token
            </span>
            <div className="bg-[#1d1d1f] text-white px-5 py-2.5 rounded-[18px] flex items-baseline gap-1.5 shadow-2xs border border-black/10">
              <span className="text-xs font-normal text-white/60 uppercase">Queue</span>
              {status === 'PENDING_APPROVAL' ? (
                <span className="text-lg font-bold tracking-tight text-amber-400">PENDING</span>
              ) : (
                <span className="text-3xl font-extrabold tracking-tight text-[#0088e8]">#{queueNumber}</span>
              )}
            </div>
          </div>
        </div>

        {/* Patient Details (When booked for dependent/family member or explicit patient name) */}
        {(appointment.isForOther || (Boolean(appointment.patientName) && appointment.patient?.user?.fullName && appointment.patientName !== appointment.patient.user.fullName)) && (
          <div className="my-3 p-3 rounded-xl bg-[#0088e8]/5 border border-[#0088e8]/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-[#0088e8]/15 text-[#0088e8] border border-[#0088e8]/25 font-semibold text-[10px]">
                {appointment.isForOther ? 'Dependent / Family' : 'Patient'}
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
                Booked by account: {appointment.patient.user.fullName}
              </span>
            )}
          </div>
        )}

        {/* Pending Receptionist & Payment Verification Callout */}
        {status === 'PENDING_APPROVAL' && (
          <div className="my-5 p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-950">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-200/60 text-amber-900 flex-shrink-0 mt-0.5">
                <Clock className="w-5 h-5 text-amber-800" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-amber-950">
                    Action Required: Verify Booking with Receptionist
                  </h4>
                  <span className="text-xs font-bold text-amber-900 bg-white px-3 py-1 rounded-full border border-amber-300 shadow-2xs">
                    Consultation Fee: ₹{appointment.fee || (appointment as any).consultationFee || doctor.consultationFee || 0}
                  </span>
                </div>
                <p className="text-xs text-amber-800/90 mt-1.5 leading-relaxed">
                  To confirm your official queue token and appointment time, please call the clinic receptionist and complete your consultation payment (UPI / Cash / Card). The receptionist will activate your token immediately.
                </p>
                {appointment.clinic?.phone && (
                  <div className="mt-3.5 flex flex-wrap items-center gap-3">
                    <a
                      href={`tel:${appointment.clinic.phone}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1d1d1f] text-white text-xs font-semibold hover:bg-black transition-all active:scale-[0.98] shadow-xs"
                    >
                      <span>📞 Call Receptionist: {appointment.clinic.phone}</span>
                    </a>
                    <span className="text-[11px] text-amber-800">
                      Clinic: {appointment.clinic.clinicName}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Physical Clinic Check-In Status */}
        {appointment.isCheckedIn ? (
          <div className="my-3 p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-emerald-900">
                Physically Checked In at Clinic 📍
              </span>
            </div>
            <span className="text-[11px] font-medium text-emerald-700">
              Doctor notified • In Waiting Area
            </span>
          </div>
        ) : isToday && (status === 'WAITING' || status === 'IN_CONSULTATION') ? (
          <div className="my-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span className="font-medium text-[#1d1d1f]">
                Not Yet Checked In at Clinic (En Route)
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[#0088e8] bg-white px-2.5 py-1 rounded-full border border-[#0088e8]/20 self-start sm:self-auto">
              Scan Clinic Desk QR Upon Arrival
            </span>
          </div>
        ) : null}

        {/* Live Queue Position Tracker */}
        {(status === 'WAITING' || status === 'IN_CONSULTATION') && liveQueue && (
          <div className="my-5 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Queue Tracker
              </span>
              <span className="text-xs text-[#86868b]">
                Serving: <strong className="text-[#1d1d1f]">Queue #{liveQueue.currentServingQueueNumber || 1}</strong>
              </span>
            </div>

            {doctor.cabinStatus === 'STEPPED_OUT' && (
              <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs flex items-center gap-2 animate-fadeIn">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0"></span>
                <span>
                  <strong>Doctor stepped out:</strong> Expected back {doctor.expectedReturnTime ? `around ${doctor.expectedReturnTime}` : 'soon'}. Consultations will resume upon return.
                </span>
              </div>
            )}
            {doctor.cabinStatus === 'NOT_IN_CABIN' && (
              <div className="mb-3 p-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 text-xs flex items-center gap-2 animate-fadeIn">
                <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0"></span>
                <span>
                  <strong>Doctor not yet in cabin:</strong> Waiting for doctor arrival.
                </span>
              </div>
            )}

            {liveQueue.isYourTurn ? (
              <div className="flex items-center gap-2 text-emerald-800 bg-emerald-100/70 p-3 rounded-xl text-xs font-medium border border-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span>
                  <strong>It is your turn!</strong> Doctor {doctor.user.fullName} is ready to consult with you now.
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-full bg-[#e5e5ea] h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#0088e8] h-full transition-all duration-500 rounded-full"
                    style={{
                      width: `${queueNumber > 0 ? Math.min(100, Math.max(10, ((liveQueue.currentServingQueueNumber || 1) / queueNumber) * 100)) : 10}%`,
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-[12px] text-[#86868b]">
                  <span>
                    <strong>{liveQueue.patientsAway}</strong> patient(s) ahead in consultation
                  </span>
                  <span>
                    Est. Wait: ~<strong>{liveQueue.estimatedWaitMinutes} mins</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Date, Est Time, Reason */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 text-xs text-[#1d1d1f]">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#0088e8]" />
            <div>
              <span className="text-[#86868b] block">Date</span>
              <strong className="text-[13px]">{appointmentDate} {isToday ? '(Today)' : ''}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#0088e8]" />
            <div>
              <span className="text-[#86868b] block">Est. Consultation</span>
              {status === 'IN_CONSULTATION' ? (
                <strong className="text-[13px] text-emerald-600">Now in Cabin</strong>
              ) : status === 'COMPLETED' ? (
                <strong className="text-[13px] text-gray-600">Completed</strong>
              ) : liveQueue?.isYourTurn ? (
                <strong className="text-[13px] text-emerald-600 animate-pulse">Your Turn Now</strong>
              ) : liveQueue?.isShiftPassed ? (
                <strong className="text-[13px] text-amber-600">Shift Concluded</strong>
              ) : isToday && liveQueue?.isShiftActive && liveQueue?.liveEstimatedTime ? (
                <strong className="text-[13px] text-[#0088e8]" title="Real-time estimated consultation time">
                  ~{liveQueue.liveEstimatedTime} (Live)
                </strong>
              ) : (
                <strong className="text-[13px] text-[#0088e8]">{estimatedTime}</strong>
              )}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <span className="text-[#86868b] block">Reason for Visit</span>
            <p className="text-[13px] font-medium truncate">{appointment.reasonForVisit || 'General Consultation'}</p>
          </div>
        </div>

        {/* Action Footer */}
        <div className="mt-6 pt-4 border-t border-[#f0f0f0] flex items-center justify-between">
          <div className="text-[12px] text-[#86868b]">
            Pass ID: <span className="font-mono text-[11px] font-medium bg-[#f5f5f7] border border-[#e5e5ea] px-1.5 py-0.5 rounded">{appointment.id.slice(0, 8)}</span>
          </div>

          <div className="flex items-center gap-2">
            {status === 'COMPLETED' && (appointment.prescription || appointment.clinicalNotes) && onViewPrescription ? (
              <AppleButton
                variant="primary"
                size="sm"
                onClick={() => onViewPrescription(appointment)}
                className="flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>View Prescription</span>
              </AppleButton>
            ) : status === 'COMPLETED' ? (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Consultation Completed</span>
              </span>
            ) : null}

            {status === 'WAITING' && onCancel && (
              <AppleButton
                variant="ghost"
                size="sm"
                onClick={() => onCancel(appointment.id)}
                className="text-rose-600 hover:text-rose-700 hover:border-rose-300"
              >
                Cancel Token
              </AppleButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
