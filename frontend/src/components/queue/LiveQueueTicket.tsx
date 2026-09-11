import React from 'react';
import { Appointment } from '../../services/api';
import { Clock, Calendar, MapPin, CheckCircle2, FileText, Building2 } from 'lucide-react';
import { AppleButton } from '../ui/AppleButton';

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

  const isToday = new Date(appointmentDate).toDateString() === new Date().toDateString();

  return (
    <div className="bg-white rounded-[20px] border border-[#e5e5ea] overflow-hidden shadow-sm hover:shadow-apple-card transition-all duration-300">
      {/* Top Header Strip */}
      <div
        className={`px-6 py-3.5 flex items-center justify-between border-b ${
          status === 'IN_CONSULTATION' || liveQueue?.isYourTurn
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800'
            : liveQueue?.patientsAway === 1
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-800'
            : status === 'COMPLETED'
            ? 'bg-gray-100 border-gray-200 text-gray-700'
            : 'bg-[#0066cc]/5 border-[#0066cc]/15 text-[#0066cc]'
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
          <Clock className="w-3.5 h-3.5 text-[#0066cc]" />
          <span>Doctor Shift: {checkingWindow}</span>
        </div>

        {/* Dynamic Status Pill */}
        {status === 'IN_CONSULTATION' || liveQueue?.isYourTurn ? (
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-600 text-white shadow-sm flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white"></span>
            SERVING NOW
          </span>
        ) : status === 'WAITING' && liveQueue?.patientsAway === 1 ? (
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-500 text-white shadow-sm flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            NEXT IN LINE
          </span>
        ) : status === 'WAITING' ? (
          <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-[#0066cc] text-white shadow-sm">
            SCHEDULED IN QUEUE
          </span>
        ) : status === 'COMPLETED' ? (
          <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            COMPLETED
          </span>
        ) : (
          <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
            CANCELLED
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
                <div className="w-full h-full flex items-center justify-center font-bold text-xl text-[#0066cc]">
                  {doctor.user.fullName[0]}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-[19px] font-semibold text-[#1d1d1f] tracking-tight">
                {doctor.user.fullName}
              </h3>
              <p className="text-[14px] text-[#0066cc] font-medium">{doctor.specialty}</p>
              <div className="flex items-center gap-1.5 text-xs text-[#86868b] mt-0.5">
                {appointment.clinic ? (
                  <>
                    <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-[#0066cc]" />
                    <span className="truncate max-w-[320px]">
                      {appointment.clinic.clinicName} — {appointment.clinic.address}{appointment.clinic.city ? `, ${appointment.clinic.city}` : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-[#0066cc]" />
                    <span className="truncate max-w-[280px]">{doctor.clinicAddress || 'MediArca Healthcare Clinic'}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Prominent Queue Badge (Apple Boarding Pass Style) */}
          <div className="flex flex-col items-start sm:items-end">
            <span className="text-[11px] font-medium text-[#86868b] uppercase tracking-wider mb-1">
              Guaranteed Queue Token
            </span>
            <div className="bg-[#1d1d1f] text-white px-6 py-2.5 rounded-2xl flex items-baseline gap-1.5 shadow-md border border-white/10">
              <span className="text-xs font-normal text-white/70 uppercase">Queue</span>
              <span className="text-3xl font-extrabold tracking-tight text-[#2997ff]">#{queueNumber}</span>
            </div>
          </div>
        </div>

        {/* Live Queue Position Tracker */}
        {(status === 'WAITING' || status === 'IN_CONSULTATION') && liveQueue && (
          <div className="my-5 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Clinic Radar
              </span>
              <span className="text-xs text-[#86868b]">
                Currently Serving: <strong className="text-[#1d1d1f]">Queue #{liveQueue.currentServingQueueNumber || 1}</strong>
              </span>
            </div>

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
                    className="bg-[#0066cc] h-full transition-all duration-500 rounded-full"
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
            <Calendar className="w-4 h-4 text-[#0066cc]" />
            <div>
              <span className="text-[#86868b] block">Date</span>
              <strong className="text-[13px]">{appointmentDate} {isToday ? '(Today)' : ''}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#0066cc]" />
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
                <strong className="text-[13px] text-[#0066cc]" title="Real-time estimated consultation time">
                  ~{liveQueue.liveEstimatedTime} (Live)
                </strong>
              ) : (
                <strong className="text-[13px] text-[#0066cc]">{estimatedTime}</strong>
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
            {status === 'COMPLETED' && appointment.prescription && onViewPrescription && (
              <AppleButton
                variant="primary"
                size="sm"
                onClick={() => onViewPrescription(appointment)}
                className="flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                View & Print Prescription
              </AppleButton>
            )}

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
