import React from 'react';
import { Appointment } from '../../services/api';
import { Clock, Calendar, MapPin, CheckCircle2, FileText } from 'lucide-react';
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
    <div className="bg-white rounded-[20px] border border-[#e0e0e0] overflow-hidden shadow-sm hover:shadow-apple-card transition-all duration-300">
      {/* Top Header Strip */}
      <div
        className={`px-6 py-4 flex items-center justify-between border-b ${
          status === 'IN_CONSULTATION'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800'
            : status === 'COMPLETED'
            ? 'bg-gray-100 border-gray-200 text-gray-700'
            : 'bg-[#0066cc]/5 border-[#0066cc]/15 text-[#0066cc]'
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
          <Clock className="w-3.5 h-3.5" />
          <span>Doctor Checking Hours: {checkingWindow}</span>
        </div>
        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-white border border-current/20">
          {status === 'IN_CONSULTATION'
            ? 'NOW IN CONSULTATION'
            : status === 'COMPLETED'
            ? 'CONSULTATION COMPLETED'
            : status === 'CANCELLED'
            ? 'CANCELLED'
            : 'SCHEDULED & WAITING'}
        </span>
      </div>

      {/* Main Pass Body */}
      <div className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-[#f0f0f0]">
          {/* Doctor Info */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#f5f5f7] border border-[#e0e0e0] overflow-hidden flex-shrink-0">
              {doctor.user.avatarUrl ? (
                <img
                  src={doctor.user.avatarUrl}
                  alt={doctor.user.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-semibold text-[#0066cc]">
                  {doctor.user.fullName[0]}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight">
                {doctor.user.fullName}
              </h3>
              <p className="text-[14px] text-[#0066cc] font-medium">{doctor.specialty}</p>
              <div className="flex items-center gap-1.5 text-xs text-[#7a7a7a] mt-0.5">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[280px]">{doctor.clinicAddress || 'MediArca Clinic'}</span>
              </div>
            </div>
          </div>

          {/* Prominent Queue Badge (Apple Boarding Pass Style) */}
          <div className="flex flex-col items-end">
            <span className="text-[11px] font-medium text-[#7a7a7a] uppercase tracking-wider mb-0.5">
              Assigned Token
            </span>
            <div className="bg-[#1d1d1f] text-white px-5 py-2 rounded-2xl flex items-baseline gap-1 shadow-sm">
              <span className="text-xs font-normal text-white/70">Queue</span>
              <span className="text-2xl font-bold tracking-tight text-[#2997ff]">#{queueNumber}</span>
            </div>
          </div>
        </div>

        {/* Live Queue Position Tracker */}
        {(status === 'WAITING' || status === 'IN_CONSULTATION') && liveQueue && (
          <div className="my-5 p-4 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0]/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Queue Radar
              </span>
              <span className="text-xs text-[#7a7a7a]">
                Currently Serving: <strong className="text-[#1d1d1f]">Queue #{liveQueue.currentServingQueueNumber || 1}</strong>
              </span>
            </div>

            {liveQueue.isYourTurn ? (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-2.5 rounded-lg text-xs font-medium border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  <strong>It is your turn!</strong> Doctor {doctor.user.fullName} is ready for you.
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-full bg-[#e0e0e0] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#0066cc] h-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          10,
                          ((liveQueue.currentServingQueueNumber || 1) / queueNumber) * 100
                        )
                      )}%`,
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-[12px] text-[#7a7a7a]">
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
            <Calendar className="w-4 h-4 text-[#7a7a7a]" />
            <div>
              <span className="text-[#7a7a7a] block">Date</span>
              <strong className="text-[13px]">{appointmentDate} {isToday ? '(Today)' : ''}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#7a7a7a]" />
            <div>
              <span className="text-[#7a7a7a] block">Est. Consultation</span>
              <strong className="text-[13px] text-[#0066cc]">{estimatedTime}</strong>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <span className="text-[#7a7a7a] block">Reason for Visit</span>
            <p className="text-[13px] truncate">{appointment.reasonForVisit || 'General Consultation'}</p>
          </div>
        </div>

        {/* Action Footer */}
        <div className="mt-6 pt-4 border-t border-[#f0f0f0] flex items-center justify-between">
          <div className="text-[12px] text-[#7a7a7a]">
            Appointment ID: <span className="font-mono text-[11px]">{appointment.id.slice(0, 8)}</span>
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
                View Prescription
              </AppleButton>
            )}

            {status === 'WAITING' && onCancel && (
              <AppleButton
                variant="ghost"
                size="sm"
                onClick={() => onCancel(appointment.id)}
                className="text-rose-600 hover:text-rose-700 hover:border-rose-300"
              >
                Cancel Appointment
              </AppleButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
