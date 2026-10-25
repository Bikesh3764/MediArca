import React from 'react';
import { api, getFileUrl } from '../../../services/api';
import { CabinStatusControl } from '../../../components/ui/DoctorCabinPresence';
import { CalendarDays, CalendarX, CalendarCheck, CalendarOff, Users } from 'lucide-react';
import { EmptyState } from '../../../components/common/EmptyState';
import { WeekdayDisplay } from '../../../components/common/WeekdayDisplay';
import { cleanDoctorName } from './helpers';
import { useReceptionistDashboard } from './state';
export const DoctorsTab: React.FC = () => {
  const {
    data,
    setData,
    setError,
    setScheduleModalDoctor,
    fetchDeskData,
    linkedDoctors,
  } = useReceptionistDashboard();
  return (
<div className="space-y-5">
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#f0f0f2]">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-[#1d1d1f] tracking-tight">
                    Assigned Practitioners
                  </h3>
                </div>
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]">
                  {linkedDoctors.length} {linkedDoctors.length === 1 ? 'Doctor' : 'Doctors'}
                </span>
              </div>

              {linkedDoctors.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No Doctors Assigned Yet"
                  description="Please ask your Clinic Administrator to assign practitioners to your reception desk."
                />
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {linkedDoctors.map((doc) => (
                    <div
                      key={doc.doctorId}
                      className="p-5 rounded-2xl bg-white border border-[#e5e5ea] space-y-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden shrink-0">
                          {doc.avatarUrl ? (
                            <img src={getFileUrl(doc.avatarUrl)} alt={doc.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-semibold text-base text-[#0066cc]">
                              {doc.fullName[0]}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-base text-[#1d1d1f] tracking-tight leading-snug truncate">
                              {cleanDoctorName(doc.fullName)}
                            </h4>
                            {doc.isOnLeaveToday ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#fff1f0] text-[#ff3b30] border border-[#ff3b30]/20 inline-flex items-center gap-1 shrink-0">
                                <CalendarX className="w-3 h-3" />
                                On Leave Today
                              </span>
                            ) : doc.isWorkingToday === false ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#fffbeb] text-[#b45309] border border-[#f59e0b]/20 inline-flex items-center gap-1 shrink-0">
                                <CalendarOff className="w-3 h-3" />
                                Off Today
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#f2fbf4] text-[#34c759] border border-[#34c759]/20 inline-flex items-center gap-1 shrink-0">
                                <CalendarCheck className="w-3 h-3" />
                                Sitting Today
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#0066cc] font-medium mt-0.5">{doc.specialty}</div>
                          <div className="text-xs text-[#86868b] mt-1">
                            Consultation Fee: ₹{doc.consultationFee}
                          </div>
                        </div>
                      </div>

                      {/* CABIN STATUS */}
                      <div className="pt-3 border-t border-[#f0f0f2]">
                        <CabinStatusControl
                          currentStatus={doc.cabinStatus}
                          expectedReturnTime={doc.expectedReturnTime}
                          doctorId={doc.doctorId}
                          doctorName={cleanDoctorName(doc.fullName)}
                          onStatusChange={(newStatus, newReturnTime) => {
                            setData((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                doctors: prev.doctors.map((d) =>
                                  d.doctorId === doc.doctorId
                                    ? { ...d, cabinStatus: newStatus, expectedReturnTime: newReturnTime }
                                    : d
                                ),
                              };
                            });
                          }}
                        />
                      </div>

                      {/* SITTING DAYS & LEAVES */}
                      <div className="pt-3 border-t border-[#f0f0f2] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-[#0066cc]" />
                            <span>Schedule</span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setScheduleModalDoctor({
                                doctorId: doc.doctorId,
                                doctorName: cleanDoctorName(doc.fullName),
                              })
                            }
                            className="text-xs font-medium text-[#0066cc] hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>

                        {/* Weekday Display */}
                        <WeekdayDisplay
                          days={doc.workingDays || ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']}
                          isOnLeaveToday={doc.isOnLeaveToday}
                        />

                        {/* Quick leave toggle */}
                        <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                          <span className="text-[11px] text-[#86868b] truncate">
                            {doc.isOnLeaveToday ? (
                              <span className="text-[#ff3b30] font-medium truncate">
                                {doc.todayLeave?.reason ? `Leave: ${doc.todayLeave.reason}` : 'On leave today'}
                              </span>
                            ) : (
                              'Available today'
                            )}
                          </span>

                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                if (doc.isOnLeaveToday && doc.todayLeave) {
                                  await api.cancelDoctorLeave(doc.doctorId, doc.todayLeave.id);
                                } else {
                                  await api.addDoctorLeave(doc.doctorId, {
                                    type: 'TODAY',
                                    reason: 'Marked on leave today',
                                    clinicId: data?.clinic?.id || undefined,
                                  });
                                }
                                fetchDeskData();
                              } catch (err: any) {
                                setError(err?.message || 'Failed to toggle doctor leave');
                              }
                            }}
                            className={`h-7 px-3 rounded-full text-[11px] font-medium transition-all active:scale-95 cursor-pointer flex items-center gap-1 shrink-0 ${
                              doc.isOnLeaveToday
                                ? 'bg-[#34c759] hover:bg-[#30b753] text-white'
                                : 'bg-[#fff1f0] hover:bg-[#ffe2e0] text-[#ff3b30] border border-[#ff3b30]/20'
                            }`}
                          >
                            {doc.isOnLeaveToday ? (
                              <>
                                <CalendarCheck className="w-3 h-3" />
                                <span>Resume</span>
                              </>
                            ) : (
                              <>
                                <CalendarX className="w-3 h-3" />
                                <span>Leave</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
  );
};
