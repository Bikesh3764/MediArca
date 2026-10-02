import React, { useState } from 'react';
import { api, Appointment, getLocalDateString, getFileUrl } from '../../services/api';
import { Clock, Calendar, MapPin, CheckCircle2, Building2, Star } from 'lucide-react';
import { AppleButton } from '../ui/AppleButton';
import { CabinStatusBadge } from '../ui/DoctorCabinPresence';

interface LiveQueueTicketProps {
  appointment: Appointment;
  onCancel?: (id: string) => void;
}

export const LiveQueueTicket: React.FC<LiveQueueTicketProps> = ({
  appointment,
  onCancel,
}) => {
  const { doctor, queueNumber, status, appointmentDate, checkingWindow, estimatedTime, liveQueue } =
    appointment;

  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [submittedReview, setSubmittedReview] = useState(appointment.review);

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

  return (
    <div className="relative bg-white rounded-[24px] border border-[#e5e5ea] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-200 group">
      {/* Top Header Strip */}
      <div
        className={`px-4 py-3 sm:px-6 sm:py-3.5 flex flex-wrap items-center justify-between gap-2 border-b ${
          status === 'IN_CONSULTATION' || liveQueue?.isYourTurn
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800'
            : status === 'PENDING_APPROVAL'
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-800'
            : liveQueue?.patientsAway === 1
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-800'
            : status === 'COMPLETED'
            ? 'bg-[#f5f5f7] border-[#e5e5ea] text-slate-700'
            : status === 'EXPIRED'
            ? 'bg-slate-50 border-slate-200 text-slate-600'
            : status === 'CANCELLED' || status === 'REJECTED'
            ? 'bg-rose-50 border-rose-200 text-rose-700'
            : 'bg-[#0066cc]/5 border-[#0066cc]/15 text-[#0066cc]'
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-[#1d1d1f]">
          <Clock className="w-3.5 h-3.5 text-[#0066cc]" />
          <span>{checkingWindow ? checkingWindow.replace(/^Doctor Shift:\s*/i, '') : 'Consultation Hours'}</span>
        </div>

        {/* Dynamic Status Pill */}
        {status === 'PENDING_APPROVAL' ? (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Awaiting Approval
          </span>
        ) : status === 'EXPIRED' ? (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            Expired
          </span>
        ) : status === 'IN_CONSULTATION' || liveQueue?.isYourTurn ? (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            Serving Now
          </span>
        ) : status === 'WAITING' && liveQueue?.patientsAway === 1 ? (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500 text-white shadow-sm flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            Next in Line
          </span>
        ) : status === 'WAITING' ? (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0066cc] text-white">
            In Queue
          </span>
        ) : status === 'COMPLETED' ? (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            Completed
          </span>
        ) : status === 'REJECTED' ? (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
            Declined
          </span>
        ) : (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
            Cancelled
          </span>
        )}
      </div>

      {/* Main Pass Body */}
      <div className="p-4 sm:p-7">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Doctor Info */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] bg-[#f5f5f7] border border-black/[0.08] overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
              {doctor.user?.avatarUrl ? (
                <img
                  src={getFileUrl(doctor.user.avatarUrl)}
                  alt={doctor.user?.fullName || 'Doctor'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-xl sm:text-2xl text-[#0066cc]">
                  {(doctor.user?.fullName || 'D')[0]}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-[#1d1d1f] tracking-tight">
                  {doctor.user?.fullName || 'Doctor'}
                </h3>
                <CabinStatusBadge status={doctor.cabinStatus} expectedReturnTime={doctor.expectedReturnTime} size="sm" />
              </div>
              <p className="text-xs sm:text-sm text-[#0066cc] font-semibold mt-0.5">{doctor.specialty}</p>
              <div className="flex items-center gap-1.5 text-xs text-[#86868b] mt-1">
                {appointment.clinic ? (
                  <>
                    <Building2 className="w-3.5 h-3.5 shrink-0 text-[#86868b]" />
                    <span className="truncate max-w-[200px] sm:max-w-[320px]">
                      {appointment.clinic.clinicName}
                      {appointment.clinic.city ? ` • ${appointment.clinic.city}` : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-[#86868b]" />
                    <span className="truncate max-w-[200px] sm:max-w-[280px]">{doctor.clinicAddress || 'Healthcare Clinic'}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Prominent Queue Badge */}
          <div className="flex items-center justify-between w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#f0f0f2]">
            {status === 'PENDING_APPROVAL' ? (
              <div className="bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-full flex items-center gap-1.5">
                <span className="text-xs font-semibold text-amber-800">Pending Approval</span>
              </div>
            ) : status === 'EXPIRED' ? (
              <div className="bg-[#f5f5f7] border border-[#e5e5ea] px-3.5 py-1.5 rounded-full flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[#86868b]">Expired</span>
              </div>
            ) : status === 'COMPLETED' ? (
              <div className="bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-2xl flex items-baseline gap-1.5">
                <span className="text-xs font-semibold text-emerald-700">Token</span>
                <span className="text-xl font-bold text-emerald-800 tracking-tight">#{queueNumber}</span>
              </div>
            ) : (
              <div className="bg-[#f5f5f7] border border-[#e5e5ea] px-4 py-1.5 rounded-2xl flex items-baseline gap-1.5 group-hover:border-[#0066cc]/30 transition-all">
                <span className="text-xs font-semibold text-[#86868b]">Queue</span>
                <span className="text-2xl sm:text-3xl font-bold text-[#0066cc] tracking-tight">#{queueNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* Clean Apple Hairline Divider */}
        <div className="my-5 border-t border-[#f0f0f2]" />

        {/* Patient Details (When booked for dependent/family member or explicit patient name) */}
        {(appointment.isForOther || (Boolean(appointment.patientName) && appointment.patient?.user?.fullName && appointment.patientName !== appointment.patient.user.fullName)) && (
          <div className="my-3 p-3 rounded-xl bg-[#0066cc]/5 border border-[#0066cc]/15 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
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
          <div className="my-4 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f]">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-[#1d1d1f]">
                    Awaiting Front Desk Confirmation
                  </h4>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Fee: ₹{appointment.fee || (appointment as any).consultationFee || doctor.consultationFee || 0} • Pay at Desk
                  </span>
                </div>
                <p className="text-xs text-[#86868b] mt-1">
                  Queue spot activates upon reception check-in. Consultation fee is payable at the clinic desk.
                </p>
                {appointment.clinic?.phone && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <a
                      href={`tel:${appointment.clinic.phone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1d1d1f] text-white text-xs font-semibold hover:bg-black transition-all"
                    >
                      <span>Call Desk: {appointment.clinic.phone}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Expired Consultation Notice */}
        {status === 'EXPIRED' && (
          <div className="my-4 p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#48484a]">
              <Clock className="w-4 h-4 text-[#86868b] shrink-0" />
              <span>Shift ended on {appointmentDate} before confirmation.</span>
            </div>
            <a
              href={`#/book/${doctor.id}?clinicId=${appointment.clinicId || ''}`}
              className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-[#0066cc] text-white text-xs font-semibold hover:bg-[#0071e3] transition-all self-start sm:self-auto"
            >
              Book Again
            </a>
          </div>
        )}

        {/* Physical Clinic Check-In Status */}
        {appointment.isCheckedIn ? (
          <div className="my-3 p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-emerald-900">
                Checked In at Clinic 📍
              </span>
            </div>
            <span className="text-[11px] font-medium text-emerald-700">
              In Waiting Area
            </span>
          </div>
        ) : isToday && (status === 'WAITING' || status === 'IN_CONSULTATION') ? (
          <div className="my-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span className="font-medium text-[#1d1d1f]">
                Not Yet Checked In (En Route)
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[#0066cc] bg-white px-2.5 py-1 rounded-full border border-[#0066cc]/20 self-start sm:self-auto">
              Scan Desk QR Upon Arrival
            </span>
          </div>
        ) : null}

        {/* Live Queue Position Tracker */}
        {(status === 'WAITING' || status === 'IN_CONSULTATION') && liveQueue && (
          <div className="my-5 p-4 sm:p-5 rounded-[22px] bg-[#f5f5f7] border border-black/[0.04] shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live Tracker
              </span>
              <span className="text-xs text-[#86868b]">
                Serving: <strong className="text-[#1d1d1f] font-bold">Queue #{liveQueue.currentServingQueueNumber || 1}</strong>
              </span>
            </div>

            {doctor.cabinStatus === 'STEPPED_OUT' && (
              <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs flex items-center gap-2 animate-fadeIn">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0"></span>
                <span>
                  <strong>Doctor stepped out:</strong> Expected back {doctor.expectedReturnTime ? `around ${doctor.expectedReturnTime}` : 'soon'}.
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
              <div className="flex items-center gap-2.5 text-emerald-950 bg-emerald-100/80 p-3.5 rounded-xl text-xs font-medium border border-emerald-300 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span>
                  <strong>It is your turn!</strong> Doctor {doctor.user?.fullName || 'the Doctor'} is ready for you now.
                </span>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="w-full bg-[#e5e5ea] h-2.5 rounded-full overflow-hidden p-0.5">
                  <div
                    className="bg-[#0066cc] h-full transition-all duration-500 rounded-full"
                    style={{
                      width: `${queueNumber > 0 ? Math.min(100, Math.max(10, ((liveQueue.currentServingQueueNumber || 1) / queueNumber) * 100)) : 10}%`,
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-[12px] text-[#86868b]">
                  <span>
                    <strong className="text-[#1d1d1f] font-semibold">{liveQueue.patientsAway}</strong> patient(s) ahead
                  </span>
                  <span className="font-semibold text-[#0066cc]">
                    Est. Wait: ~<strong>{liveQueue.estimatedWaitMinutes} mins</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Date, Est Time, Reason */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 text-xs text-[#1d1d1f]">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#0066cc] shrink-0" />
            <div>
              <span className="text-[#86868b] block text-[11px]">Date</span>
              <strong className="text-[13px] font-semibold">{appointmentDate} {isToday ? '(Today)' : ''}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#0066cc] shrink-0" />
            <div>
              <span className="text-[#86868b] block text-[11px]">Est. Time</span>
              {status === 'IN_CONSULTATION' ? (
                <strong className="text-[13px] font-semibold text-emerald-600">In Cabin</strong>
              ) : status === 'COMPLETED' ? (
                <strong className="text-[13px] font-semibold text-[#86868b]">Completed</strong>
              ) : status === 'EXPIRED' ? (
                <strong className="text-[13px] font-semibold text-[#86868b]">Expired</strong>
              ) : liveQueue?.isYourTurn ? (
                <strong className="text-[13px] font-semibold text-emerald-600 animate-pulse">Your Turn</strong>
              ) : liveQueue?.isShiftPassed ? (
                <strong className="text-[13px] font-semibold text-amber-600">Shift Ended</strong>
              ) : isToday && liveQueue?.isShiftActive && liveQueue?.liveEstimatedTime ? (
                <strong className="text-[13px] font-semibold text-[#0066cc]">
                  ~{liveQueue.liveEstimatedTime}
                </strong>
              ) : (
                <strong className="text-[13px] font-semibold text-[#0066cc]">{estimatedTime}</strong>
              )}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <span className="text-[#86868b] block text-[11px]">Reason</span>
            <p className="text-[13px] font-medium truncate">{appointment.reasonForVisit || 'General Consultation'}</p>
          </div>
        </div>

        {/* Doctor Summary & Review Card for Completed Consultations */}
        {status === 'COMPLETED' && (
          <div className="mt-5 p-4 rounded-2xl bg-[#fafafc] border border-[#e5e5ea] space-y-3">
            {appointment.clinicalNotes && (
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0066cc] block mb-1">
                  Doctor's Summary
                </span>
                <div className="text-xs text-[#1d1d1f] whitespace-pre-wrap break-words leading-relaxed font-normal bg-white p-3 rounded-xl border border-[#e5e5ea]">
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
                    className="text-xs px-3 py-1 rounded-lg bg-[#0066cc] hover:bg-[#0071e3] shadow-none"
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
        <div className="mt-5 pt-3.5 border-t border-[#f0f0f2] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-[#86868b]">
            Pass ID: <span className="font-mono text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] px-2 py-0.5 rounded-md">{appointment.id.slice(0, 8)}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {status === 'COMPLETED' ? (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Consultation Completed</span>
              </span>
            ) : null}

            {(status === 'WAITING' || status === 'PENDING_APPROVAL') && onCancel && (
              <AppleButton
                variant="ghost"
                size="sm"
                onClick={() => onCancel(appointment.id)}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-semibold px-3 py-1 rounded-full w-full sm:w-auto"
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
