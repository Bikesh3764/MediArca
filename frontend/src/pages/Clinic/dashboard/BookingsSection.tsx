import React from 'react';
import { cleanSlotName } from '../../../services/api';
import { Calendar } from 'lucide-react';
import { EmptyState } from '../../../components/common/EmptyState';
import { useClinicDashboard } from './state';
export const BookingsSection: React.FC = () => {
  const {
    data,
    clinic,
    getApptStatusBadge,
  } = useClinicDashboard();
  return (
<div id="appointments-section" className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="pb-5 border-b border-[#f0f0f2] mb-6">
            <h2 className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight">
              Recent Consultations at this Facility
            </h2>
            <p className="text-[13px] text-[#86868b] mt-0.5">
              Appointments booked across affiliated practitioners at {clinic?.clinicName || 'this clinic'}.
            </p>
          </div>
          {(!data?.recentAppointments || data.recentAppointments.length === 0) ? (
            <EmptyState
              icon={Calendar}
              title="No Facility Consultations Recorded Yet"
              description="When patients book appointments with affiliated practitioners at this clinic, they will appear here in real-time."
            />
          ) : (
            <>
              {/* Mobile Recent Appointments Cards (< 640px) */}
              <div className="block sm:hidden space-y-3">
                {data.recentAppointments.map((appt) => (
                  <div key={appt.id} className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#0066cc]/10 text-[#0066cc] font-semibold text-xs">
                          #{appt.queueNumber}
                        </span>
                        <div>
                          <div className="font-semibold text-[14px] text-[#1d1d1f]">{appt.patientName}</div>
                          <div className="text-[11px] text-[#86868b]">{appt.patientPhone}</div>
                        </div>
                      </div>
                      {(() => {
                        const badge = getApptStatusBadge(appt.status);
                        return (
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#86868b] pt-2 border-t border-[#e5e5ea]">
                      <div>{appt.doctorName}</div>
                      <div className="font-semibold text-[#1d1d1f]">₹{appt.fee}</div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#86868b]">
                      <div>{appt.date}</div>
                      <div>{appt.estimatedTime || cleanSlotName(appt.checkingWindow)}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e5e5ea] text-[#86868b] font-medium">
                    <th className="pb-3 pl-2">Token #</th>
                    <th className="pb-3">Patient</th>
                    <th className="pb-3">Doctor</th>
                    <th className="pb-3">Date & Time</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right pr-2">Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f2]">
                  {data.recentAppointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                      <td className="py-3.5 pl-2">
                        <span className="font-semibold text-[#0066cc]">
                          #{appt.queueNumber}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <div className="font-semibold text-[#1d1d1f]">{appt.patientName}</div>
                        <div className="text-[11px] text-[#86868b]">{appt.patientPhone}</div>
                      </td>
                      <td className="py-3.5 font-medium text-[#1d1d1f]">{appt.doctorName}</td>
                      <td className="py-3.5 text-[#86868b]">
                        <div>{appt.date}</div>
                        <div className="text-[11px]">{appt.estimatedTime || cleanSlotName(appt.checkingWindow)}</div>
                      </td>
                      <td className="py-3.5">
                        {(() => {
                          const badge = getApptStatusBadge(appt.status);
                          return (
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${badge.className}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 text-right pr-2 font-semibold text-[#1d1d1f]">
                        ₹{appt.fee}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        </div>
  );
};
