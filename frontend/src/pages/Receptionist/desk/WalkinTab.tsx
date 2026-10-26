import { formatDisplayDate } from '../../../services/api';
import { AvatarImage } from '../../../components/ui/AvatarImage';
import React from 'react';
import { getLocalDateString, getFileUrl, formatShiftOption, WEEKDAY_NAMES, getMaxBookingDateString } from '../../../services/api';
import { sanitizeIndianPhone } from '../../../utils/phoneUtils';
import { ChevronDown, CalendarX, CalendarOff } from 'lucide-react';
import { cleanDoctorName } from './helpers';
import { useReceptionistDashboard } from './state';
export const WalkinTab: React.FC = () => {
  const {
    data,
    setActiveTab,
    setScheduleModalDoctor,
    selectedDoctorId,
    setSelectedDoctorId,
    appointmentDate,
    setAppointmentDate,
    slotId,
    setSlotId,
    bookingFor,
    setBookingFor,
    patientName,
    setPatientName,
    patientAge,
    setPatientAge,
    patientPhone,
    setPatientPhone,
    gender,
    setGender,
    reasonForVisit,
    setReasonForVisit,
    bookingLoading,
    walkinPreview,
    previewLoading,
    linkedDoctors,
    activeSelectedDoctor,
    isSelectedShiftEnded,
    isSelectedShiftFull,
    handleWalkinSubmit,
  } = useReceptionistDashboard();
  return (
<div>
              <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[#f0f0f2]">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-[#1d1d1f] tracking-tight">
                    Walk-in
                  </h3>
                  <p className="text-xs text-[#86868b] mt-0.5">
                    Create a token for someone at the desk.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('queue')}
                  className="h-8 px-3.5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-xs font-normal text-[#1d1d1f] border border-[#e5e5ea] transition-all cursor-pointer shrink-0"
                >
                  View Queue
                </button>
              </div>

              {linkedDoctors.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="text-sm font-semibold text-[#1d1d1f]">No Doctors Assigned</p>
                  <p className="text-xs text-[#86868b] mt-1 max-w-xs mx-auto">
                    Ask your clinic to assign doctors to you.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column (7 cols): Walk-in Registration Form */}
                  <form onSubmit={handleWalkinSubmit} className="lg:col-span-7 space-y-5">
                    {/* 1. Practitioner Selection */}
                    <div>
                      <label className="block text-xs font-normal text-[#1d1d1f] mb-2 tracking-tight">
                        Doctor
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {linkedDoctors.map((doc) => {
                          const isSelected = selectedDoctorId === doc.doctorId;
                          return (
                            <div
                              key={doc.doctorId}
                              onClick={() => {
                                setSelectedDoctorId(doc.doctorId);
                                setSlotId(doc.slots[0]?.id || '');
                              }}
                              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                                isSelected
                                  ? 'bg-[#0066cc]/[0.04] border-[#0066cc] ring-2 ring-[#0066cc]/10'
                                  : 'bg-white border-[#e5e5ea] hover:border-[#d2d2d7]'
                              }`}
                            >
                              <div className="w-10 h-10 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden shrink-0">
                                {doc.avatarUrl ? (
                                  <AvatarImage src={getFileUrl(doc.avatarUrl)} name={doc.fullName} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center font-semibold text-xs text-[#0066cc]">
                                    {doc.fullName[0]}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-xs text-[#1d1d1f] leading-snug">
                                  {cleanDoctorName(doc.fullName)}
                                </div>
                                <div className="text-[11px] text-[#0066cc] font-normal mt-0.5">
                                  {doc.specialty}
                                </div>
                                <div className="text-[11px] text-[#86868b] mt-0.5">
                                  Consultation Fee: ₹{doc.consultationFee.toFixed(0)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Date & Checking Shift */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                          Date
                        </label>
                        <input
                          type="date"
                          required
                          min={getLocalDateString()}
                          max={getMaxBookingDateString()}
                          value={appointmentDate}
                          onChange={(e) => setAppointmentDate(e.target.value)}
                          className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                          Shift
                        </label>
                        <div className="relative">
                          <select
                            value={slotId}
                            onChange={(e) => setSlotId(e.target.value)}
                            disabled={!activeSelectedDoctor?.slots || activeSelectedDoctor.slots.length === 0}
                            className="w-full h-11 pl-3.5 pr-8 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all appearance-none cursor-pointer disabled:bg-[#f5f5f7] disabled:text-[#86868b] disabled:cursor-not-allowed"
                          >
                            {!activeSelectedDoctor?.slots || activeSelectedDoctor.slots.length === 0 ? (
                              <option value="">No shifts configured</option>
                            ) : (
                              activeSelectedDoctor.slots.map((s) => {
                                const sStatus = walkinPreview?.availableSlots?.find((as) => as.slot.id === s.id);
                                const isEnded = sStatus?.isPassed;
                                return (
                                  <option key={s.id} value={s.id}>
                                    {formatShiftOption(s, isEnded)}
                                  </option>
                                );
                              })
                            )}
                          </select>
                          <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Fixed Reception Desk Clinic Facility (DEF-06) */}
                    <div>
                      <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                        Clinic
                      </label>
                      <div className="h-11 px-3.5 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] flex items-center justify-between text-[13px] text-[#1d1d1f]">
                        <span className="font-normal truncate">{data?.clinic?.clinicName || 'Clinic Desk'}</span>
                        <span className="text-xs text-[#86868b] truncate ml-2">{data?.clinic?.address || ''}</span>
                      </div>
                    </div>

                    {/* Shift Status & Attendance Warnings */}
                    {activeSelectedDoctor?.isOnLeaveToday && appointmentDate === getLocalDateString() && (
                      <div className="p-3.5 rounded-2xl bg-danger-soft border border-danger-line text-xs text-danger flex items-start justify-between gap-3 animate-fadeIn">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <CalendarX className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold block text-danger">
                              Doctor is on leave today
                            </span>
                            <span className="text-danger mt-0.5 block leading-relaxed">
                              {activeSelectedDoctor.todayLeave?.reason
                                ? `Reason: ${activeSelectedDoctor.todayLeave.reason}`
                                : `${cleanDoctorName(activeSelectedDoctor.fullName)} is not taking consultations today.`}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setScheduleModalDoctor({
                              doctorId: activeSelectedDoctor.doctorId,
                              doctorName: cleanDoctorName(activeSelectedDoctor.fullName),
                            })
                          }
                          className="h-7 px-3 rounded-full bg-white hover:bg-danger-soft text-danger border border-danger-line font-semibold text-[11px] shrink-0 transition-all cursor-pointer"
                        >
                          Leave
                        </button>
                      </div>
                    )}

                    {(() => {
                      if (!appointmentDate || !activeSelectedDoctor) return null;
                      const [y, m, d] = appointmentDate.split('-').map(Number);
                      const dayCode = (['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(y, m - 1, d).getDay()]);
                      const docDays = activeSelectedDoctor.workingDays || ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                      if (!docDays.includes(dayCode)) {
                        return (
                          <div className="p-3.5 rounded-2xl bg-warning-soft border border-warning-line text-xs text-warning flex items-center justify-between gap-3 animate-fadeIn">
                            <div className="flex items-center gap-2">
                              <CalendarOff className="w-4 h-4 text-warning shrink-0" />
                              <span>
                                <span className="font-semibold">Day off:</span> {cleanDoctorName(activeSelectedDoctor.fullName)} does not sit on {WEEKDAY_NAMES[dayCode as any] || dayCode}s at this clinic.
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setScheduleModalDoctor({
                                  doctorId: activeSelectedDoctor.doctorId,
                                  doctorName: cleanDoctorName(activeSelectedDoctor.fullName),
                                })
                              }
                              className="h-7 px-2.5 rounded-full bg-white hover:bg-warning-soft text-warning border border-warning-line font-semibold text-[11px] shrink-0 transition-all cursor-pointer"
                            >
                              Edit Days
                            </button>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {(!activeSelectedDoctor?.slots || activeSelectedDoctor.slots.length === 0) && (
                      <div className="p-3.5 rounded-xl bg-warning-soft border border-warning-line text-xs text-warning">
                        <span className="font-semibold">No Practice Shifts Configured:</span> This doctor has no shifts here yet. Ask them to add shifts.
                      </div>
                    )}

                    {isSelectedShiftEnded && (
                      <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs text-[#1d1d1f]">
                        <span className="font-semibold">Shift ended.</span> Pick another shift or tomorrow.
                      </div>
                    )}

                    {!isSelectedShiftEnded && isSelectedShiftFull && (
                      <div className="p-3.5 rounded-xl bg-danger-soft border border-danger-line text-xs text-danger">
                        <span className="font-semibold">Shift full.</span> Pick another shift or date.
                      </div>
                    )}

                    {/* 3. Patient Information */}
                    <div className="pt-2 border-t border-[#f0f0f2] space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-xs font-normal text-[#1d1d1f] tracking-tight">
                          Patient
                        </label>
                        <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-full flex gap-0.5 w-full sm:w-64 select-none">
                          <button
                            type="button"
                            onClick={() => setBookingFor('self')}
                            className={`flex-1 h-8 text-xs rounded-full transition-all cursor-pointer ${
                              bookingFor === 'self'
                                ? 'bg-white text-[#1d1d1f] font-semibold  border border-black/5'
                                : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
                            }`}
                          >
                            Self
                          </button>
                          <button
                            type="button"
                            onClick={() => setBookingFor('other')}
                            className={`flex-1 h-8 text-xs rounded-full transition-all cursor-pointer ${
                              bookingFor === 'other'
                                ? 'bg-white text-[#1d1d1f] font-semibold  border border-black/5'
                                : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
                            }`}
                          >
                            Family
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                            Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={patientName}
                            maxLength={100}
                            onChange={(e) => setPatientName(e.target.value)}
                            placeholder="e.g. Rahul Ray"
                            className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                            Mobile *
                          </label>
                          <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white  focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all overflow-hidden">
                            <div className="h-full px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] flex items-center justify-center select-none text-[13px] font-semibold text-[#1d1d1f]">
                              +91
                            </div>
                            <input
                              type="tel"
                              inputMode="numeric"
                              required
                              value={sanitizeIndianPhone(patientPhone)}
                              onChange={(e) => setPatientPhone(sanitizeIndianPhone(e.target.value))}
                              placeholder="98765 43210"
                              maxLength={10}
                              className="flex-1 h-full px-3.5 text-base sm:text-sm bg-transparent focus:outline-none text-[#1d1d1f] placeholder:text-[#a1a1a6]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                        <div>
                          <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                            Age {bookingFor === 'other' ? '*' : ''}
                          </label>
                          <input
                            type="text"
                            value={patientAge}
                            onChange={(e) => setPatientAge(e.target.value)}
                            placeholder="e.g. 28"
                            className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                            Gender
                          </label>
                          <div className="relative">
                            <select
                              value={gender}
                              onChange={(e) => setGender(e.target.value)}
                              className="w-full h-11 pl-3 pr-8 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all appearance-none cursor-pointer"
                            >
                              <option value="Not Specified">Select</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                            <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                            Reason (optional)
                          </label>
                          <input
                            type="text"
                            value={reasonForVisit}
                            onChange={(e) => setReasonForVisit(e.target.value)}
                            placeholder="e.g. Fever, general checkup"
                            className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={bookingLoading || isSelectedShiftEnded || isSelectedShiftFull || !activeSelectedDoctor?.slots || activeSelectedDoctor.slots.length === 0}
                        className={`w-full h-11 px-6 rounded-full text-sm font-normal transition-all flex items-center justify-center ${
                          isSelectedShiftEnded || isSelectedShiftFull || !activeSelectedDoctor?.slots || activeSelectedDoctor.slots.length === 0
                            ? 'bg-[#e5e5ea] text-[#86868b] cursor-not-allowed'
                            : 'bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white  cursor-pointer'
                        }`}
                      >
                        {bookingLoading
                          ? 'Issuing Token...'
                          : !activeSelectedDoctor?.slots || activeSelectedDoctor.slots.length === 0
                          ? 'No Shifts Configured'
                          : isSelectedShiftEnded
                          ? 'Shift ended'
                          : isSelectedShiftFull
                          ? 'Shift full'
                          : `Issue Token #${walkinPreview?.nextQueueNumber || 1}`}
                      </button>
                    </div>
                  </form>

                  {/* Right Column (5 cols): Live Token Allocation Summary Card */}
                  <div className="lg:col-span-5 bg-[#f5f5f7] rounded-2xl border border-[#e5e5ea] p-5 sm:p-6 space-y-5">
                    <div className="flex items-center justify-between border-b border-[#e5e5ea] pb-4">
                      <div>
                        <span className="text-xs font-normal text-[#86868b] block">
                          Next token
                        </span>
                        <span className="text-xs text-[#1d1d1f] font-normal mt-0.5 block">
                          {formatDisplayDate(appointmentDate)}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-normal border ${
                          isSelectedShiftEnded || isSelectedShiftFull
                            ? 'bg-white text-[#86868b] border-[#e5e5ea]'
                            : 'bg-[#0066cc]/10 text-[#0066cc] border-[#0066cc]/20'
                        }`}
                      >
                        {isSelectedShiftEnded
                          ? 'Shift Ended'
                          : isSelectedShiftFull
                          ? 'Shift Full'
                          : 'Available'}
                      </span>
                    </div>

                    <div className="py-3 text-center bg-white rounded-2xl border border-[#e5e5ea]">
                      <span className="text-[11px] font-normal text-[#86868b] uppercase tracking-wider block">
                        Token
                      </span>
                      <div className="text-4xl font-semibold text-[#0066cc] tracking-tight my-1">
                        #{walkinPreview?.nextQueueNumber || 1}
                      </div>
                      <span className="text-xs text-[#86868b]">
                        {previewLoading ? 'Calculating...' : `Est. Time: ${walkinPreview?.estimatedTime || 'Immediate'}`}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between py-1.5 border-b border-[#e5e5ea]">
                        <span className="text-[#86868b]">Doctor</span>
                        <span className="font-semibold text-[#1d1d1f]">
                          {cleanDoctorName(activeSelectedDoctor?.fullName)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-b border-[#e5e5ea]">
                        <span className="text-[#86868b]">Ahead</span>
                        <span className="font-semibold text-[#1d1d1f]">
                          {previewLoading ? '...' : `${walkinPreview?.patientsAhead ?? 0} waiting`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-[#86868b]">Fee</span>
                        <span className="text-sm font-semibold text-[#1d1d1f]">
                          ₹{activeSelectedDoctor?.consultationFee?.toFixed(0) || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
  );
};
