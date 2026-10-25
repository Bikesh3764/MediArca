import React from 'react';
import { WeekdayDisplay } from '../../../components/common/WeekdayDisplay';
import { Users, Clock, CheckCircle2, Trash2, Plus, AlertCircle, X, MapPin, Check, Calendar, QrCode } from 'lucide-react';
import { EmptyState } from '../../../components/common/EmptyState';
import { useDoctorDashboard } from './state';
export const AffiliationsTab: React.FC = () => {
  const {
    user,
    navigate,
    setIsStandeeModalOpen,
    setSelectedStandeeClinic,
    affiliations,
    affiliationsLoading,
    setIsAffiliateModalOpen,
    setScheduleLeaveModalClinic,
    setClinicSearchQuery,
    setClinicStateFilter,
    setClinicCityFilter,
    feedbackSuccess,
    setFeedbackSuccess,
    feedbackError,
    setFeedbackError,
    handleRemoveClinic,
    handleRespondClinicAffiliation,
    handleRemoveReceptionist,
  } = useDoctorDashboard();
  return (
<div className="space-y-6 animate-fadeIn">
            {/* Feedback Alerts */}
            {feedbackSuccess && (
              <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
                  <span className="font-normal">{feedbackSuccess}</span>
                </div>
                <button aria-label="Close"
                  onClick={() => setFeedbackSuccess(null)}
                  className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {feedbackError && (
              <div className="p-3.5 rounded-xl bg-danger-soft border border-danger-line/80 text-danger text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
                  <span className="font-normal">{feedbackError}</span>
                </div>
                <button aria-label="Close"
                  onClick={() => setFeedbackError(null)}
                  className="text-danger hover:text-danger cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Clean 3-Column Metrics Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-[#e5e5ea] p-5 ">
                <span className="text-xs text-[#86868b] font-normal block">Affiliated Clinics</span>
                <h3 className="text-[28px] font-semibold text-[#1d1d1f] mt-1 tracking-tight leading-none">
                  {affiliations?.clinics.length || 0}
                </h3>
              </div>

              <div className="bg-white rounded-2xl border border-[#e5e5ea] p-5 ">
                <span className="text-xs text-[#86868b] font-normal block">Assigned Desk Staff</span>
                <h3 className="text-[28px] font-semibold text-[#1d1d1f] mt-1 tracking-tight leading-none">
                  {affiliations?.receptionists.length || 0}
                </h3>
              </div>

              <div className="bg-white rounded-2xl border border-[#e5e5ea] p-5 ">
                <span className="text-xs text-[#86868b] font-normal block">Total Clinic Earnings</span>
                <h3 className="text-[28px] font-semibold text-[#0066cc] mt-1 tracking-tight leading-none">
                  ₹{(
                    affiliations?.clinics.reduce(
                      (sum: number, c) => sum + (c.revenue || 0),
                      0
                    ) || 0
                  ).toLocaleString('en-IN')}
                </h3>
              </div>
            </div>

            {/* Incoming Clinic Affiliation Invitations */}
            {affiliations?.incomingRequests && affiliations.incomingRequests.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#e5e5ea] p-6 ">
                <div className="mb-4">
                  <h3 className="text-[16px] font-semibold text-[#1d1d1f] tracking-tight">
                    Incoming Clinic Invitations ({affiliations.incomingRequests.length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {affiliations.incomingRequests.map((req) => (
                    <div
                      key={req.affiliationId}
                      className="rounded-2xl border border-[#e5e5ea] p-4 bg-[#f5f5f7] flex flex-col justify-between"
                    >
                      <div>
                        <h4 className="font-semibold text-[15px] text-[#1d1d1f]">{req.clinicName}</h4>
                        <p className="text-xs text-[#86868b] flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-[#86868b]" />
                          {req.address}{req.city ? `, ${req.city}` : ''}
                        </p>
                        {req.phone && (
                          <p className="text-xs text-[#86868b] mt-0.5">Phone: {req.phone}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#e5e5ea]">
                        <button
                          type="button"
                          onClick={() => handleRespondClinicAffiliation(req.affiliationId, 'ACCEPT')}
                          className="flex-1 h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-normal flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondClinicAffiliation(req.affiliationId, 'REJECT')}
                          className="flex-1 h-9 px-4 rounded-full bg-white hover:bg-danger-soft text-danger border border-[#e5e5ea] text-xs font-normal flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Outgoing Clinic Requests */}
            {affiliations?.outgoingRequests && affiliations.outgoingRequests.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#e5e5ea] p-6 ">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-[16px] font-semibold text-[#1d1d1f] tracking-tight">
                    Pending Clinic Approvals ({affiliations.outgoingRequests.length})
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {affiliations.outgoingRequests.map((req) => (
                    <div
                      key={req.affiliationId}
                      className="rounded-2xl border border-[#e5e5ea] bg-[#f5f5f7] p-4 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-semibold text-[14px] text-[#1d1d1f]">{req.clinicName}</h4>
                        <p className="text-xs text-[#86868b] mt-0.5">{req.address}{req.city ? `, ${req.city}` : ''}</p>
                      </div>
                      <span className="text-xs font-normal px-2.5 py-1 rounded-full bg-white text-[#86868b] border border-[#e5e5ea]">
                        Pending
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 1: Affiliated Clinics */}
            <div className="bg-white rounded-2xl border border-[#e5e5ea] p-6 ">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
                <div className="flex items-center gap-2">
                  <h3 className="text-[16px] font-semibold text-[#1d1d1f] tracking-tight">
                    Affiliated Clinics
                  </h3>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f]">
                    {affiliations?.clinics.length || 0}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setClinicSearchQuery('');
                    setClinicStateFilter('All');
                    setClinicCityFilter('All');
                    setIsAffiliateModalOpen(true);
                  }}
                  className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-normal flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Affiliate New Clinic</span>
                </button>
              </div>

              {affiliationsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-32 rounded-2xl bg-[#f5f5f7] animate-pulse" />
                  ))}
                </div>
              ) : affiliations?.clinics.length === 0 ? (
                <div className="p-8 text-center bg-[#f5f5f7] rounded-2xl border border-[#e5e5ea]">
                  <h4 className="text-[15px] font-semibold text-[#1d1d1f]">No Clinics Affiliated</h4>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setClinicSearchQuery('');
                        setClinicStateFilter('All');
                        setClinicCityFilter('All');
                        setIsAffiliateModalOpen(true);
                      }}
                      className="h-9 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-normal inline-flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Find & Affiliate Clinic</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {affiliations?.clinics.map((clinic) => (
                    <div
                      key={clinic.clinicId}
                      className="rounded-2xl border border-[#e5e5ea] p-5 hover:border-[#d2d2d7] transition-all duration-150 flex flex-col justify-between bg-white"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-semibold text-[15px] text-[#1d1d1f] tracking-tight truncate">
                                {clinic.clinicName}
                              </h4>
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />
                            </div>
                            <p className="text-xs text-[#86868b] flex items-center gap-1 mt-0.5 truncate">
                              <MapPin className="w-3.5 h-3.5 text-[#86868b] flex-shrink-0" />
                              <span className="truncate">{clinic.address}{clinic.city ? `, ${clinic.city}` : ''}</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveClinic(clinic.clinicId, clinic.clinicName)}
                            className="text-[#86868b] hover:text-danger hover:bg-danger-soft p-1.5 rounded-full transition-all flex-shrink-0 cursor-pointer"
                            title="Detach from Clinic"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Clean Stats Row */}
                        <div className="grid grid-cols-3 gap-2 mt-4 p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-center">
                          <div>
                            <span className="text-[11px] font-normal text-[#86868b] block">Fee</span>
                            <span className="text-sm font-semibold text-[#1d1d1f] mt-0.5 block">
                              ₹{clinic.consultationFee ?? user?.doctorProfile?.consultationFee ?? 500}
                            </span>
                          </div>
                          <div className="border-x border-[#e5e5ea]">
                            <span className="text-[11px] font-normal text-[#86868b] block">Bookings</span>
                            <span className="text-sm font-semibold text-[#1d1d1f] mt-0.5 block">
                              {clinic.bookingCount || 0}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] font-normal text-[#86868b] block">Revenue</span>
                            <span className="text-sm font-semibold text-[#0066cc] mt-0.5 block">
                              ₹{(clinic.revenue ?? 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>

                        {/* Shifts Status */}
                        <div className="mt-3 flex items-center justify-between text-xs px-1 text-[#86868b]">
                          <span className="font-normal">Practice Shifts</span>
                          <span className="font-normal text-[#1d1d1f] truncate max-w-[220px]">
                            {clinic.slots && clinic.slots.length > 0
                              ? `${clinic.slots.length} ${clinic.slots.length === 1 ? 'Shift' : 'Shifts'}`
                              : 'Default schedule'}
                          </span>
                        </div>

                        {/* Schedule & Weekday Display */}
                        <div className="mt-3 pt-3 border-t border-[#e5e5ea]">
                          <WeekdayDisplay
                            days={clinic.workingDays || ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']}
                            isOnLeaveToday={clinic.isOnLeaveToday}
                          />
                        </div>
                      </div>

                      {/* Actions & Footer */}
                      <div className="mt-4 pt-3 border-t border-[#e5e5ea] flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/doctor/schedule?clinic=${clinic.clinicId}`)}
                          className="flex-1 min-w-[80px] h-9 px-3 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-normal flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Shifts</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setScheduleLeaveModalClinic({ clinicId: clinic.clinicId, clinicName: clinic.clinicName })}
                          className="h-9 px-3.5 rounded-full bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-normal flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                          title="Doctor Schedule & Leave"
                        >
                          <Calendar className="w-3.5 h-3.5 text-[#0066cc]" />
                          <span>Schedule</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStandeeClinic({
                              clinicId: clinic.clinicId,
                              clinicName: clinic.clinicName,
                              clinicAddress: `${clinic.address || ''}${clinic.city ? `, ${clinic.city}` : ''}`,
                              clinicPhone: clinic.phone || '',
                              checkinCode: (clinic as any).checkinCode || '',
                            });
                            setIsStandeeModalOpen(true);
                          }}
                          className="h-9 px-3.5 rounded-full bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] border border-[#d2d2d7] text-xs font-normal flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]  cursor-pointer"
                          title="Clinic QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5 text-[#0066cc]" />
                          <span>QR Code</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Authorized Clinic Desk Staff */}
            <div className="bg-white rounded-2xl border border-[#e5e5ea] p-6 ">
              <div className="flex items-center gap-2 mb-5">
                <h3 className="text-[16px] font-semibold text-[#1d1d1f] tracking-tight">
                  Authorized Desk Staff
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f]">
                  {affiliations?.receptionists.length || 0}
                </span>
              </div>

              {affiliationsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-20 rounded-2xl bg-[#f5f5f7] animate-pulse" />
                  ))}
                </div>
              ) : affiliations?.receptionists.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No Desk Staff Assigned"
                  description="No receptionist assigned yet."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {affiliations?.receptionists.map((rec) => (
                    <div
                      key={rec.receptionistId}
                      className="rounded-2xl border border-[#e5e5ea] p-4 sm:p-5 hover:border-[#d2d2d7] transition-all duration-150 flex items-center justify-between gap-4 bg-white"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-[14px] text-[#1d1d1f] tracking-tight truncate">
                            {rec.fullName}
                          </h4>
                          {rec.clinicName && (
                            <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] truncate max-w-[160px]">
                              {rec.clinicName}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#86868b] truncate mt-0.5">{rec.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveReceptionist(rec.receptionistId, rec.fullName)}
                        className="h-8 px-3 rounded-full text-xs font-normal text-[#86868b] hover:text-danger hover:bg-danger-soft border border-[#e5e5ea] hover:border-danger-line transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                        title="Unlink Receptionist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Unlink</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
  );
};
