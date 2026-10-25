import React from 'react';
import { Trash2, UserCheck, Check } from 'lucide-react';
import { EmptyState } from '../../../components/common/EmptyState';
import { cleanDoctorName } from './helpers';
import { useClinicDashboard } from './state';
export const StaffSection: React.FC = () => {
  const {
    data,
    setShowRecModal,
    handleOpenEditAssignments,
    handleRemoveReceptionist,
    setApprovingRec,
    setApprovalDoctorIds,
    processingRecId,
    handleRespondReceptionist,
  } = useClinicDashboard();
  return (
<div id="receptionists-section" className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#f0f0f2] mb-6">
            <h2 className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight">
              Front Desk Staff
            </h2>
            <button
              type="button"
              onClick={() => setShowRecModal(true)}
              className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-medium flex items-center gap-1.5 self-start sm:self-auto shadow-[0_1px_2px_rgba(0,102,204,0.2)] transition-all cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Add Receptionist</span>
            </button>
          </div>

          {/* Incoming Receptionist Applications */}
          {data?.incomingReceptionists && data.incomingReceptionists.length > 0 && (
            <div className="mb-6 p-5 rounded-[20px] bg-[#f5f5f7] border border-[#e5e5ea]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0066cc]" />
                  <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                    Incoming Receptionist Applications ({data.incomingReceptionists.length})
                  </h3>
                </div>
                <span className="text-xs font-medium text-[#86868b]">
                  Staff requesting front desk access
                </span>
              </div>

              <div className="space-y-2.5">
                {data.incomingReceptionists.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-2xl bg-white border border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-[14px] text-[#1d1d1f] flex items-center gap-2">
                        <span>{rec.fullName}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#0066cc]/10 text-[#0066cc]">
                          Pending Approval
                        </span>
                      </div>
                      <div className="text-xs text-[#86868b] mt-0.5">
                        <span className="font-medium text-[#1d1d1f]">{rec.email}</span>
                        {rec.phone && <span> • {rec.phone}</span>}
                        <span> • Applied {new Date(rec.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={processingRecId === rec.id}
                        onClick={() => handleRespondReceptionist(rec.id, 'REJECT')}
                        className="h-9 px-3.5 rounded-full text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                      >
                        Decline
                      </button>

                      <button
                        type="button"
                        disabled={processingRecId === rec.id}
                        onClick={() => {
                          setApprovingRec({ id: rec.id, fullName: rec.fullName, email: rec.email });
                          setApprovalDoctorIds([]);
                        }}
                        className="h-9 px-4 rounded-full text-xs font-semibold text-white bg-[#0066cc] hover:bg-[#0071e3] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Review & Assign Doctors
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!data?.receptionists || data.receptionists.length === 0) ? (
            <EmptyState
              icon={UserCheck}
              title="No Receptionists Provisioned"
              description="Provision front-desk receptionists to handle patient arrivals, verify QR check-ins, and manage waiting room queues."
              actionText="Provision First Receptionist"
              onAction={() => setShowRecModal(true)}
            />
          ) : (
            <>
              {/* Mobile Receptionist Cards (< 640px) */}
              <div className="block sm:hidden space-y-3">
                {data.receptionists.map((rec) => (
                  <div key={rec.id} className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-[#1d1d1f] text-[14px]">{rec.fullName}</h4>
                        <div className="text-xs text-[#86868b]">{rec.email}</div>
                        {rec.phone && <div className="text-xs text-[#86868b]">{rec.phone}</div>}
                      </div>
                      <div className="text-[11px] text-[#86868b] shrink-0">
                        {new Date(rec.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Assigned Doctors */}
                    <div className="pt-2.5 border-t border-[#e5e5ea]">
                      <div className="text-xs text-[#86868b] mb-1.5 font-medium">Assigned Practitioners</div>
                      {(!rec.doctors || rec.doctors.length === 0) ? (
                        <span className="text-xs text-[#86868b] bg-white border border-[#e5e5ea] px-2.5 py-0.5 rounded-full font-medium">
                          No doctors assigned
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {rec.doctors.map((doc) => (
                            <span
                              key={doc.id}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#0066cc]/10 text-[#0066cc]"
                            >
                              {cleanDoctorName(doc.fullName)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[#e5e5ea]">
                      <button
                        onClick={() => handleOpenEditAssignments(rec)}
                        className="h-8 px-3.5 rounded-full text-xs font-medium text-[#1d1d1f] bg-white hover:bg-[#e8e8ed] border border-[#e5e5ea] transition-all active:scale-[0.98] cursor-pointer"
                      >
                        Manage Doctors
                      </button>
                      <button
                        onClick={() => handleRemoveReceptionist(rec.id, rec.fullName)}
                        className="h-8 px-2.5 rounded-full text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all active:scale-[0.98] cursor-pointer"
                        title="Remove receptionist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e5e5ea] text-[#86868b] font-medium">
                    <th className="pb-3 pl-2">Receptionist</th>
                    <th className="pb-3">Contact</th>
                    <th className="pb-3">Assigned Doctors</th>
                    <th className="pb-3 text-right pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f2]">
                  {data.receptionists.map((rec) => (
                    <tr key={rec.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                      <td className="py-4 pl-2">
                        <div className="font-semibold text-[14px] text-[#1d1d1f]">{rec.fullName}</div>
                        <div className="text-[11px] text-[#86868b]">
                          Added {new Date(rec.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-4 text-[#86868b]">
                        <div className="text-xs text-[#1d1d1f] font-medium">{rec.email}</div>
                        {rec.phone && <div className="text-[11px]">{rec.phone}</div>}
                      </td>
                      <td className="py-4">
                        {(!rec.doctors || rec.doctors.length === 0) ? (
                          <span className="text-xs text-[#86868b] bg-[#f5f5f7] border border-[#e5e5ea] px-2.5 py-0.5 rounded-full font-medium">
                            No doctors assigned
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {rec.doctors.map((doc) => (
                              <span
                                key={doc.id}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#0066cc]/10 text-[#0066cc]"
                              >
                                {cleanDoctorName(doc.fullName)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-4 text-right pr-2">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditAssignments(rec)}
                            className="h-8 px-3.5 rounded-full text-xs font-medium text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e5e5ea] transition-all active:scale-[0.98] cursor-pointer"
                          >
                            Manage Doctors
                          </button>
                          <button
                            onClick={() => handleRemoveReceptionist(rec.id, rec.fullName)}
                            className="p-2 rounded-full text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all active:scale-[0.98] cursor-pointer"
                            title="Remove receptionist"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
