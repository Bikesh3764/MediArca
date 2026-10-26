import React from 'react';
import { api, Appointment, getLocalDateString, getTomorrowDateString } from '../../../services/api';
import { CabinStatusControl } from '../../../components/ui/DoctorCabinPresence';
import { Clock, CheckCircle2, AlertTriangle, Play, FileEdit, RefreshCw, Building2, AlertCircle, X, CalendarX, PauseCircle, SlidersHorizontal } from 'lucide-react';
import { AppleFilterSelect } from '../../../components/ui/AppleFilterSelect';
import { getCleanReason, getSlotShortLabel, getYesterdayDateString } from './helpers';
import { useDoctorDashboard } from './state';
export const QueueTab: React.FC = () => {
  const {
    user,
    updateUser,
    navigate,
    toast,
    affiliations,
    setScheduleLeaveModalClinic,
    date,
    setDate,
    queueScope,
    setQueueScope,
    selectedClinicId,
    selectedSlotId,
    setSelectedSlotId,
    queueFiltersDrawerOpen,
    setQueueFiltersDrawerOpen,
    queueSearch,
    setQueueSearch,
    queueData,
    loading,
    callingId,
    fetchError,
    handleClinicChange,
    fetchQueue,
    fetchAffiliations,
    holdingId,
    handleHoldConsultation,
    handleCallPatient,
    completingId,
    handleCompleteConsultation,
    togglingCheckinId,
    handleToggleCheckIn,
    cancellingId,
    handleCancelAppointment,
    setRescheduleTarget,
    setRescheduleDate,
    setRescheduleSlotId,
    setRescheduleError,
    rescheduleSuccess,
    setRescheduleSuccess,
    isVerified,
    isDoctorAway,
    availableShifts,
    displayedWaitingQueue,
    displayedCompletedQueue,
    displayedActiveInConsultation,
    totalShiftQueueCount,
    clinicFilterOptions,
    shiftFilterOptions,
  } = useDoctorDashboard();
  return (
<div className="space-y-6">
            {/* Verification Warning if Doctor is unverified or suspended/rejected */}
            {user?.doctorProfile?.verificationStatus === 'SUSPENDED' && (
              <div className="p-4 rounded-2xl bg-danger-soft border border-danger-line/80 text-danger text-xs flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-[14px] text-danger">Account suspended</h4>
                  <p className="mt-0.5 leading-relaxed text-danger">
                    Bookings are paused. Please contact MediArca support.
                  </p>
                </div>
              </div>
            )}
            {user?.doctorProfile?.verificationStatus === 'REJECTED' && (
              <div className="p-4 rounded-2xl bg-danger-soft border border-danger-line/80 text-danger text-xs flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-[14px] text-danger">Profile not approved</h4>
                  <p className="mt-0.5 leading-relaxed text-danger">
                    Please contact MediArca support.
                  </p>
                </div>
              </div>
            )}
            {(!isVerified && user?.doctorProfile?.verificationStatus !== 'SUSPENDED' && user?.doctorProfile?.verificationStatus !== 'REJECTED') && (
              <div className="p-4 rounded-2xl bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-start gap-3 ">
                <AlertTriangle className="w-5 h-5 text-[#0066cc] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-[14px] text-[#1d1d1f]">Profile under review</h4>
                  <p className="mt-0.5 leading-relaxed text-[#86868b]">
                    Patients can find you once it’s approved.
                  </p>
                </div>
              </div>
            )}

            {/* Server Connection Issue Banner */}
            {fetchError && (
              <div className="p-4 rounded-2xl bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#0066cc] animate-spin" />
                  <span>Connecting...</span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchQueue(true)}
                  className="text-xs font-normal text-[#0066cc] hover:underline cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Doctor On Leave Banner */}
            {(() => {
              const activeClinic = selectedClinicId !== 'all'
                ? affiliations?.clinics.find((c) => c.clinicId === selectedClinicId)
                : affiliations?.clinics.find((c) => c.isOnLeaveToday);
              const isOnLeave = activeClinic ? activeClinic.isOnLeaveToday : user?.doctorProfile?.isOnLeaveToday;
              const leaveInfo = activeClinic ? activeClinic.todayLeave : user?.doctorProfile?.todayLeave;
              if (!isOnLeave) return null;
              return (
                <div className="p-4 rounded-2xl bg-warning-soft border border-warning-line text-xs text-[#1d1d1f] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CalendarX className="w-5 h-5 text-warning shrink-0" />
                    <div>
                      <h4 className="font-semibold text-[13px] text-[#1d1d1f]">
                        You’re on leave today
                      </h4>
                      <p className="text-[#86868b] mt-0.5 leading-relaxed">
                        {leaveInfo?.reason ? leaveInfo.reason : 'Bookings and walk-ins are paused.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {leaveInfo?.id && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if (user?.doctorProfile?.id) {
                              await api.cancelDoctorLeave(user.doctorProfile.id, leaveInfo.id);
                              await fetchAffiliations();
                              await fetchQueue(false);
                            }
                          } catch (err: any) {
                            toast.error(err?.message || 'Couldn’t resume. Try again.');
                          }
                        }}
                        className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white font-normal text-xs transition-all cursor-pointer"
                      >
                        Resume
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setScheduleLeaveModalClinic({ clinicId: activeClinic?.clinicId, clinicName: activeClinic?.clinicName })}
                      className="h-9 px-4 rounded-full bg-white hover:bg-[#f5f5f7] active:scale-[0.98] text-[#1d1d1f] border border-[#e5e5ea] font-normal text-xs transition-all cursor-pointer"
                    >
                      Leaves
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Reschedule Success Feedback Banner */}
            {rescheduleSuccess && (
              <div className="p-4 rounded-2xl bg-[#0066cc]/10 border border-[#0066cc]/20 text-[#0066cc] text-xs flex items-center justify-between  animate-fadeIn">
                <div className="flex items-center gap-2 font-normal">
                  <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0" />
                  <span>{rescheduleSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRescheduleSuccess(null)}
                  className="text-xs font-semibold hover:underline ml-3 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Unified Top Control Bar: Date Scope Selector + Cabin Presence + Clinic & Shift Controls */}
            <div className="bg-white rounded-2xl border border-[#e5e5ea] p-4 sm:p-5  space-y-3.5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                {/* Date Filter Segmented Bar + Date Input */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-full flex items-center gap-0.5 overflow-x-auto max-w-full no-scrollbar">
                    <button
                      type="button"
                      onClick={() => {
                        setQueueScope('date');
                        setDate(getLocalDateString());
                      }}
                      className={`h-8 px-3.5 rounded-full text-xs transition-all cursor-pointer whitespace-nowrap ${
                        queueScope === 'date' && date === getLocalDateString()
                          ? 'bg-white text-[#1d1d1f] font-semibold  border border-black/5'
                          : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQueueScope('date');
                        const tomorrowStr = queueData?.upcomingSummary?.tomorrowDate || getTomorrowDateString();
                        setDate(tomorrowStr);
                      }}
                      className={`h-8 px-3.5 rounded-full text-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        queueScope === 'date' && date === (queueData?.upcomingSummary?.tomorrowDate || getTomorrowDateString())
                          ? 'bg-white text-[#1d1d1f] font-semibold  border border-black/5'
                          : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
                      }`}
                    >
                      <span>Tomorrow</span>
                      {queueData?.upcomingSummary && queueData.upcomingSummary.tomorrowCount > 0 && (
                        <span className="text-[11px] font-semibold px-1.5 py-0.2 rounded-full bg-[#0066cc] text-white">
                          {queueData.upcomingSummary.tomorrowCount}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQueueScope('all-upcoming');
                      }}
                      className={`h-8 px-3.5 rounded-full text-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        queueScope === 'all-upcoming'
                          ? 'bg-white text-[#1d1d1f] font-semibold  border border-black/5'
                          : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
                      }`}
                    >
                      <span>Upcoming</span>
                      {queueData?.upcomingSummary && queueData.upcomingSummary.totalUpcomingCount > 0 && (
                        <span className="text-[11px] font-semibold px-1.5 py-0.2 rounded-full bg-[#0066cc] text-white">
                          {queueData.upcomingSummary.totalUpcomingCount}
                        </span>
                      )}
                    </button>
                  </div>

                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setQueueScope('date');
                      setDate(e.target.value);
                    }}
                    className="h-10 px-3.5 rounded-full border border-[#e5e5ea] text-base sm:text-xs font-normal bg-[#f5f5f7] hover:bg-[#e8e8ed]/70 focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:border-[#0066cc] cursor-pointer w-full sm:w-auto text-center"
                    title="Pick a date"
                  />
                </div>

                {/* Live Cabin Presence */}
                <div className="w-full lg:w-auto">
                  <CabinStatusControl
                    currentStatus={user?.doctorProfile?.cabinStatus}
                    expectedReturnTime={user?.doctorProfile?.expectedReturnTime}
                    onStatusChange={(newStatus, newReturnTime) => {
                      if (user?.doctorProfile) {
                        updateUser({
                          ...user,
                          doctorProfile: {
                            ...user.doctorProfile,
                            cabinStatus: newStatus,
                            expectedReturnTime: newReturnTime,
                          },
                        });
                      }
                    }}
                  />
                </div>
              </div>

              {/* Clinic & Shift Differentiation Controls */}
              {((affiliations?.clinics && affiliations.clinics.length > 0) || availableShifts.length > 0) && (
                <div className="pt-3.5 border-t border-[#f0f0f2] flex flex-col gap-3">
                  {/* Desktop View: Sleek Apple Dropdown Selectors */}
                  <div className="hidden sm:flex items-center gap-3.5 flex-wrap">
                    {affiliations?.clinics && affiliations.clinics.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#1d1d1f] tracking-tight shrink-0">
                          Clinic:
                        </span>
                        <div className="h-9 min-w-[200px] max-w-[280px] bg-[#f5f5f7] hover:bg-[#e8e8ed]/60 border border-[#e5e5ea] rounded-full px-2 flex items-center transition-all">
                          <AppleFilterSelect
                            value={selectedClinicId === 'all' ? 'All' : selectedClinicId}
                            onChange={(val) => handleClinicChange(val === 'All' ? 'all' : val)}
                            options={clinicFilterOptions}
                            placeholder="All Clinics"
                            allLabel="All Clinics"
                            allCount={queueData?.waitingQueue?.length || 0}
                            variant="bar"
                            icon={<Building2 className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />}
                          />
                        </div>
                      </div>
                    )}

                    {availableShifts.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#1d1d1f] tracking-tight shrink-0">
                          Shift:
                        </span>
                        <div className="h-9 min-w-[190px] max-w-[260px] bg-[#f5f5f7] hover:bg-[#e8e8ed]/60 border border-[#e5e5ea] rounded-full px-2 flex items-center transition-all">
                          <AppleFilterSelect
                            value={selectedSlotId === 'all' ? 'All' : selectedSlotId}
                            onChange={(val) => setSelectedSlotId(val === 'All' ? 'all' : val)}
                            options={shiftFilterOptions}
                            placeholder="All Shifts"
                            allLabel="All Shifts"
                            allCount={totalShiftQueueCount}
                            variant="bar"
                            icon={<Clock className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />}
                          />
                        </div>
                      </div>
                    )}

                    {(selectedClinicId !== 'all' || selectedSlotId !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          handleClinicChange('all');
                          setSelectedSlotId('all');
                        }}
                        className="h-8 px-3 rounded-full text-xs font-normal text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.04] cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>

                  {/* Mobile View: Clean Expandable Drawer matching States & Cities */}
                  <div className="sm:hidden flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setQueueFiltersDrawerOpen(!queueFiltersDrawerOpen)}
                      className="h-8 px-3.5 rounded-full border border-[#e5e5ea] bg-[#f5f5f7] hover:bg-[#e8e8ed] text-xs font-normal text-[#1d1d1f] flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-all"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[#0066cc]" />
                      <span>Filters{(selectedClinicId !== 'all' || selectedSlotId !== 'all') ? ' • Active' : ''}</span>
                    </button>
                    {(selectedClinicId !== 'all' || selectedSlotId !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          handleClinicChange('all');
                          setSelectedSlotId('all');
                        }}
                        className="text-xs text-[#86868b] hover:text-[#1d1d1f] underline cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {queueFiltersDrawerOpen && (
                    <div className="sm:hidden w-full bg-white rounded-2xl border border-[#e5e5ea] p-3.5  space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between pb-2 border-b border-[#e5e5ea]">
                        <span className="text-xs font-semibold text-[#1d1d1f]">Filters</span>
                        <button
                          type="button"
                          onClick={() => setQueueFiltersDrawerOpen(false)}
                          className="text-xs font-normal text-[#0066cc] cursor-pointer"
                        >
                          Done
                        </button>
                      </div>

                      {affiliations?.clinics && affiliations.clinics.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-normal text-[#86868b]">Clinic</label>
                          <div className="w-full h-10 bg-[#f5f5f7] border border-[#e5e5ea] rounded-full px-2 flex items-center">
                            <AppleFilterSelect
                              value={selectedClinicId === 'all' ? 'All' : selectedClinicId}
                              onChange={(val) => handleClinicChange(val === 'All' ? 'all' : val)}
                              options={clinicFilterOptions}
                              placeholder="All Clinics"
                              allLabel="All Clinics"
                              allCount={queueData?.waitingQueue?.length || 0}
                              variant="bar"
                              icon={<Building2 className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />}
                            />
                          </div>
                        </div>
                      )}

                      {availableShifts.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-normal text-[#86868b]">Shift</label>
                          <div className="w-full h-10 bg-[#f5f5f7] border border-[#e5e5ea] rounded-full px-2 flex items-center">
                            <AppleFilterSelect
                              value={selectedSlotId === 'all' ? 'All' : selectedSlotId}
                              onChange={(val) => setSelectedSlotId(val === 'All' ? 'all' : val)}
                              options={shiftFilterOptions}
                              placeholder="All Shifts"
                              allLabel="All Shifts"
                              allCount={totalShiftQueueCount}
                              variant="bar"
                              icon={<Clock className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />}
                            />
                          </div>
                        </div>
                      )}

                      {(selectedClinicId !== 'all' || selectedSlotId !== 'all') && (
                        <div className="pt-2 border-t border-[#f0f0f2] flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              handleClinicChange('all');
                              setSelectedSlotId('all');
                            }}
                            className="text-xs font-normal text-[#86868b] hover:text-[#1d1d1f] cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clean 3-Column Metrics Strip */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="bg-white rounded-2xl sm:rounded-2xl border border-[#e5e5ea] p-3 sm:p-5 ">
                <p className="text-[11px] sm:text-xs text-[#86868b] font-normal leading-tight truncate">Waiting</p>
                <h3 className="text-[20px] sm:text-[30px] font-semibold text-[#1d1d1f] mt-1 tracking-tight leading-none">
                  {displayedWaitingQueue.length}
                </h3>
              </div>

              <div className="bg-white rounded-2xl sm:rounded-2xl border border-[#e5e5ea] p-3 sm:p-5 ">
                <p className="text-[11px] sm:text-xs text-[#86868b] font-normal leading-tight truncate">Completed</p>
                <h3 className="text-[20px] sm:text-[30px] font-semibold text-[#0066cc] mt-1 tracking-tight leading-none">
                  {displayedCompletedQueue.length}
                </h3>
              </div>

              <div className="bg-white rounded-2xl sm:rounded-2xl border border-[#e5e5ea] p-3 sm:p-5 ">
                <p className="text-[11px] sm:text-xs text-[#86868b] font-normal leading-tight truncate">Total</p>
                <h3 className="text-[20px] sm:text-[30px] font-semibold text-[#1d1d1f] mt-1 tracking-tight leading-none">
                  {(displayedActiveInConsultation ? 1 : 0) + displayedWaitingQueue.length + displayedCompletedQueue.length}
                </h3>
              </div>
            </div>

            {/* Main Live Queue Workspace (2-Column Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (5 cols): Active Cabin */}
              <div className="lg:col-span-5">
                <div className="bg-white rounded-2xl border border-[#e5e5ea] p-6 ">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#e5e5ea]">
                    <h3 className="text-[16px] font-semibold text-[#1d1d1f] tracking-tight">
                      In cabin
                    </h3>
                    {displayedActiveInConsultation ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20 font-semibold text-xs px-2.5 py-0.5 rounded-full">
                          Token #{displayedActiveInConsultation.queueNumber}
                        </span>
                        <span className="bg-[#f5f5f7] text-[#0066cc] border border-[#0066cc]/20 font-semibold text-xs px-2.5 py-0.5 rounded-full">
                          {getSlotShortLabel(displayedActiveInConsultation, availableShifts)}
                        </span>
                        {selectedClinicId === 'all' && (displayedActiveInConsultation.clinic?.clinicName || (user?.doctorProfile as any)?.primaryClinicAddress) && (
                          <span className="bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] font-normal text-xs px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-[#0066cc]" />
                            <span className="truncate max-w-[140px]">{displayedActiveInConsultation.clinic?.clinicName || (user?.doctorProfile as any)?.primaryClinicAddress}</span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea] font-normal text-xs px-2.5 py-0.5 rounded-full">
                        Available
                      </span>
                    )}
                  </div>

                  {displayedActiveInConsultation ? (
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight">
                          {displayedActiveInConsultation.patientName || displayedActiveInConsultation.patient?.user?.fullName || 'Patient'}
                        </h4>
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
                          {getSlotShortLabel(displayedActiveInConsultation, availableShifts)}
                        </span>
                        {selectedClinicId === 'all' && (displayedActiveInConsultation.clinic?.clinicName || (user?.doctorProfile as any)?.primaryClinicAddress) && (
                          <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-[#0066cc]" />
                            <span>{displayedActiveInConsultation.clinic?.clinicName || (user?.doctorProfile as any)?.primaryClinicAddress}</span>
                          </span>
                        )}
                        {displayedActiveInConsultation.isForOther && (
                          <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]">
                            {displayedActiveInConsultation.reasonForVisit?.toLowerCase().includes('walk-in')
                              ? `Walk-in${displayedActiveInConsultation.patientAge ? ` (Age ${displayedActiveInConsultation.patientAge})` : ''}`
                              : `Family (${displayedActiveInConsultation.patientAge ? `Age ${displayedActiveInConsultation.patientAge}` : 'Other'})`}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-normal text-[#1d1d1f] mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-[#0066cc]">{getSlotShortLabel(displayedActiveInConsultation, availableShifts)}</span>
                        {selectedClinicId === 'all' && (displayedActiveInConsultation.clinic?.clinicName || (user?.doctorProfile as any)?.primaryClinicAddress) && (
                          <>
                            <span className="text-[#86868b]">•</span>
                            <span className="text-[#86868b] flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-[#0066cc]" />
                              {displayedActiveInConsultation.clinic?.clinicName || (user?.doctorProfile as any)?.primaryClinicAddress}
                            </span>
                          </>
                        )}
                      </p>

                      {(() => {
                        const cleanReason = getCleanReason(
                          displayedActiveInConsultation.reasonForVisit,
                          displayedActiveInConsultation.patientName || displayedActiveInConsultation.patient?.user?.fullName
                        );
                        if (!cleanReason && !displayedActiveInConsultation.symptoms) return null;
                        return (
                          <div className="my-4 p-3.5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-[13px] text-[#1d1d1f] space-y-1.5">
                            {cleanReason && (
                              <div className="whitespace-pre-wrap break-words">
                                <span className="text-[#86868b] font-normal">Reason: </span>
                                {cleanReason}
                              </div>
                            )}
                            {displayedActiveInConsultation.symptoms && (
                              <div className="whitespace-pre-wrap break-words">
                                <span className="text-[#86868b] font-normal">Symptoms: </span>
                                {displayedActiveInConsultation.symptoms}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="flex flex-col sm:flex-row items-center gap-2.5">
                        <button
                          type="button"
                          disabled={completingId === displayedActiveInConsultation.id}
                          onClick={() => handleCompleteConsultation(displayedActiveInConsultation.id)}
                          className="w-full sm:flex-1 h-10 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4 text-white" />
                          <span>{completingId === displayedActiveInConsultation.id ? 'Completing...' : 'Complete Consultation'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={holdingId === displayedActiveInConsultation.id}
                          onClick={() => handleHoldConsultation(displayedActiveInConsultation.id)}
                          className="w-full sm:w-auto h-10 px-4 rounded-full bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-normal flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                          title="Send back to the waiting list"
                        >
                          <PauseCircle className="w-3.5 h-3.5" />
                          <span>{holdingId === displayedActiveInConsultation.id ? 'Holding...' : 'Hold'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/doctor/consultation/${displayedActiveInConsultation.id}`)
                          }
                          className="w-full sm:w-auto h-10 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-normal flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <FileEdit className="w-3.5 h-3.5" />
                          <span>Notes</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center">
                      <h4 className="text-[14px] font-semibold text-[#1d1d1f] tracking-tight">No one in cabin</h4>
                      <p className="text-xs text-[#86868b] mt-1 max-w-xs mx-auto leading-relaxed">
                        Call the next patient who has arrived.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column (7 cols): Waiting Queue & Completed */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white rounded-2xl border border-[#e5e5ea] p-6 ">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3.5 border-b border-[#e5e5ea]">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[16px] font-semibold text-[#1d1d1f] tracking-tight">
                        Waiting
                      </h3>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f]">
                        {displayedWaitingQueue.length}
                      </span>
                    </div>

                    {(() => {
                      const filteredWaiting = displayedWaitingQueue.filter((appt) => {
                        if (!queueSearch.trim()) return true;
                        const q = queueSearch.toLowerCase().trim();
                        const name = (appt.patientName || appt.patient?.user?.fullName || '').toLowerCase();
                        const phone = (appt.patient?.user?.phone || '').toLowerCase();
                        const token = String(appt.queueNumber || '');
                        return name.includes(q) || phone.includes(q) || token.includes(q);
                      });
                      const nextPresentTarget = filteredWaiting.find(
                        (appt) =>
                          appt.isCheckedIn &&
                          (appt.appointmentDate === getLocalDateString() ||
                            appt.appointmentDate === getYesterdayDateString())
                      );

                      return (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                          <input
                            type="text"
                            value={queueSearch}
                            onChange={(e) => setQueueSearch(e.target.value)}
                            placeholder="Search name, phone or token"
                            className="h-10 sm:h-9 px-3.5 rounded-full border border-[#d2d2d7] text-base sm:text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#a1a1a6] transition-all focus:outline-none focus:border-[#0066cc] w-full sm:w-48"
                          />
                          {!isDoctorAway && nextPresentTarget && (
                            <button
                              type="button"
                              disabled={callingId !== null}
                              onClick={() => handleCallPatient(nextPresentTarget.id)}
                              className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap w-full sm:w-auto cursor-pointer transition-all"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              {callingId === nextPresentTarget.id
                                ? 'Calling...'
                                : `Call #${nextPresentTarget.queueNumber} (${getSlotShortLabel(nextPresentTarget, availableShifts)})`}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {loading && !queueData ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-20 rounded-2xl bg-[#f5f5f7] animate-pulse"></div>
                      ))}
                    </div>
                  ) : displayedWaitingQueue.length === 0 ? (
                    <div className="py-8 text-center select-none">
                      <div className="w-10 h-10 rounded-full bg-success-soft border border-success-line/60 flex items-center justify-center mx-auto mb-2.5 text-success">
                        <CheckCircle2 className="w-5 h-5 stroke-[2]" />
                      </div>
                      <h4 className="text-[14px] font-semibold text-[#1d1d1f] tracking-tight">
                        Queue is Clear for {queueScope === 'all-upcoming' ? 'All Upcoming Dates' : date === getLocalDateString() ? 'Today' : date === queueData?.upcomingSummary?.tomorrowDate ? 'Tomorrow' : date}
                      </h4>
                      <p className="text-xs text-[#86868b] mt-1 max-w-md mx-auto leading-relaxed">
                        No one is waiting.
                      </p>
                    </div>
                  ) : (() => {
                    const filteredWaiting = displayedWaitingQueue.filter((appt) => {
                      if (!queueSearch.trim()) return true;
                      const q = queueSearch.toLowerCase().trim();
                      const name = (appt.patientName || appt.patient?.user?.fullName || '').toLowerCase();
                      const phone = (appt.patient?.user?.phone || '').toLowerCase();
                      const token = String(appt.queueNumber || '');
                      return name.includes(q) || phone.includes(q) || token.includes(q);
                    });

                    if (filteredWaiting.length === 0) {
                      return (
                        <div className="py-8 text-center">
                          <p className="text-xs text-[#86868b]">
                            No waiting patients matching "{queueSearch}".
                          </p>
                          <button
                            type="button"
                            onClick={() => setQueueSearch('')}
                            className="mt-2 text-xs text-[#0066cc] font-semibold hover:underline cursor-pointer"
                          >
                            Clear Search
                          </button>
                        </div>
                      );
                    }

                    const renderApptCard = (appt: Appointment) => {
                      const shiftLabel = getSlotShortLabel(appt, availableShifts);
                      const clinicDisplay = appt.clinic?.clinicName || (user?.doctorProfile as any)?.primaryClinicAddress || '';
                      return (
                        <div
                          key={appt.id}
                          className="rounded-2xl border border-[#e5e5ea] p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-[#d2d2d7] transition-colors duration-150 bg-white"
                        >
                          <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto sm:flex-1">
                            <div className="w-11 h-11 rounded-full bg-[#f5f5f7] flex items-center justify-center font-semibold text-[15px] text-[#1d1d1f] shrink-0">
                              #{appt.queueNumber}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-[15px] font-semibold text-[#1d1d1f] tracking-tight">
                                  {appt.patientName || appt.patient?.user?.fullName || 'Patient'}
                                </h4>
                                {appt.isForOther && (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#48484a]">
                                    {appt.reasonForVisit?.toLowerCase().includes('walk-in')
                                      ? `Walk-in${appt.patientAge ? ` · ${appt.patientAge}y` : ''}`
                                      : `Family${appt.patientAge ? ` · ${appt.patientAge}y` : ''}`}
                                  </span>
                                )}
                                {appt.isCheckedIn ? (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-success-soft text-success inline-flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-success-dot" />
                                    Arrived
                                  </span>
                                ) : (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#86868b]">
                                    Not arrived
                                  </span>
                                )}
                              </div>
                              <p className="text-[13px] text-[#86868b] mt-0.5 truncate">
                                {[
                                  appt.appointmentDate && appt.appointmentDate !== getLocalDateString() && queueScope !== 'all-upcoming'
                                    ? (appt.appointmentDate === queueData?.upcomingSummary?.tomorrowDate ? 'Tomorrow' : appt.appointmentDate)
                                    : null,
                                  shiftLabel,
                                  selectedClinicId === 'all' ? clinicDisplay : null,
                                  getCleanReason(appt.reasonForVisit, appt.patientName || appt.patient?.user?.fullName),
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>
                          </div>

                        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-end shrink-0 flex-wrap pt-2 sm:pt-0 border-t sm:border-t-0 border-[#e5e5ea]/60">
                          {/* Arrival toggle */}
                          <button
                            type="button"
                            disabled={togglingCheckinId === appt.id}
                            onClick={() => handleToggleCheckIn(appt.id, appt.isCheckedIn)}
                            className={`h-8 px-3 rounded-full text-xs font-normal border transition-all flex items-center gap-1.5 cursor-pointer ${
                              appt.isCheckedIn
                                ? 'bg-[#0066cc]/10 border-[#0066cc]/30 text-[#0066cc]'
                                : 'bg-white border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#f5f5f7]'
                            }`}
                            title={appt.isCheckedIn ? 'Undo arrival' : 'Mark as arrived'}
                          >
                            <CheckCircle2
                              className={`w-3.5 h-3.5 ${appt.isCheckedIn ? 'text-[#0066cc]' : 'text-[#86868b]'}`}
                            />
                            <span>{togglingCheckinId === appt.id ? 'Saving…' : appt.isCheckedIn ? 'Arrived' : 'Mark arrived'}</span>
                          </button>

                          {/* Call Patient (if arrived and today) */}
                          {(appt.appointmentDate === getLocalDateString() || (appt.appointmentDate === getYesterdayDateString() && appt.isCheckedIn)) && appt.isCheckedIn && (
                            isDoctorAway ? (
                              <span className="h-8 px-3 rounded-full text-xs font-normal text-[#86868b] bg-white border border-[#e5e5ea] flex items-center">
                                You’re away
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={callingId !== null}
                                onClick={() => handleCallPatient(appt.id)}
                                className="h-8 px-3.5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all active:scale-[0.98]"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                {callingId === appt.id ? 'Calling…' : 'Call in'}
                              </button>
                            )
                          )}

                          {/* Shift appointment to another shift or date */}
                          <button
                            type="button"
                            onClick={() => {
                              setRescheduleTarget({
                                appointmentId: appt.id,
                                patientName: appt.patientName || appt.patient?.user?.fullName || 'Patient',
                                doctorName: user?.fullName || 'Practitioner',
                                currentDate: appt.appointmentDate || date,
                                currentQueueNumber: appt.queueNumber,
                                doctorId: user?.doctorProfile?.id || '',
                                slotId: appt.slotId,
                              });
                              const [y, m, day] = (appt.appointmentDate || date || getLocalDateString()).split('-').map(Number);
                              const d = new Date(y, m - 1, day + 1);
                              setRescheduleDate(getLocalDateString(d));
                              setRescheduleSlotId(appt.slotId || '');
                              setRescheduleError(null);
                            }}
                            className="h-8 px-3 rounded-full text-[#1d1d1f] hover:bg-[#f5f5f7] text-xs font-normal border border-[#e5e5ea] transition-all cursor-pointer"
                            title="Move to another shift or date"
                          >
                            Move
                          </button>

                          {/* Cancel appointment */}
                          <button
                            type="button"
                            disabled={cancellingId === appt.id}
                            onClick={() => handleCancelAppointment(appt.id, appt.patientName || appt.patient?.user?.fullName || 'Patient')}
                            className="h-8 px-3 rounded-full text-[#86868b] hover:text-danger hover:bg-danger-soft text-xs font-normal border border-[#e5e5ea] transition-all cursor-pointer disabled:opacity-50"
                            title="Cancel appointment"
                          >
                            {cancellingId === appt.id ? 'Cancelling…' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    );
                  };

                    if (queueScope === 'all-upcoming') {
                      const groups: Record<string, Appointment[]> = {};
                      filteredWaiting.forEach((appt) => {
                        const d = appt.appointmentDate || 'Upcoming';
                        if (!groups[d]) groups[d] = [];
                        groups[d].push(appt);
                      });

                      return (
                        <div className="space-y-5">
                          {Object.entries(groups).map(([groupDate, dateAppts]) => (
                            <div key={groupDate} className="space-y-2.5">
                              <div className="flex items-center justify-between px-1">
                                <span className="text-xs font-semibold text-[#1d1d1f] tracking-tight">
                                  {groupDate === queueData?.upcomingSummary?.tomorrowDate ? 'Tomorrow' : groupDate}
                                </span>
                                <span className="text-[11px] font-normal text-[#86868b]">
                                  {dateAppts.length} patient{dateAppts.length > 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="space-y-2.5">
                                {dateAppts.map((appt) => renderApptCard(appt))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {filteredWaiting.map((appt) => renderApptCard(appt))}
                      </div>
                    );
                  })()}
                </div>

                {/* Completed Consultations Card */}
                {displayedCompletedQueue.length > 0 && (
                  <div className="bg-white rounded-2xl border border-[#e5e5ea] p-6 ">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[15px] font-semibold text-[#1d1d1f] tracking-tight">
                        Completed Consultations ({displayedCompletedQueue.length})
                      </h4>
                    </div>
                    <div className="space-y-2.5">
                      {displayedCompletedQueue.map((appt) => (
                        <div
                          key={appt.id}
                          className="p-3.5 rounded-2xl bg-[#f5f5f7]/60 border border-[#e5e5ea] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-semibold text-[#86868b]">#{appt.queueNumber}</span>
                            <span className="font-semibold text-[14px] text-[#1d1d1f]">
                              {appt.patientName || appt.patient?.user?.fullName || 'Patient'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[#0066cc] bg-[#0066cc]/10 px-2.5 py-0.5 rounded-full font-normal">
                              Completed
                            </span>
                            <button
                              type="button"
                              onClick={() => navigate(`/doctor/consultation/${appt.id}`)}
                              className="h-8 px-3 rounded-full bg-white hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-normal transition-all cursor-pointer"
                            >
                              Notes
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
  );
};
