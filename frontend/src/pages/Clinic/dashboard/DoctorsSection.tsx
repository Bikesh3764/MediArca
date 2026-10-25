import React from 'react';
import { getFileUrl, formatDoctorDegrees } from '../../../services/api';
import { UserPlus, Trash2, X, Check, Clock3, Stethoscope } from 'lucide-react';
import { EmptyState } from '../../../components/common/EmptyState';
import { cleanDoctorName } from './helpers';
import { useClinicDashboard } from './state';
export const DoctorsSection: React.FC = () => {
  const {
    data,
    loading,
    setShowAddModal,
    handleDetachDoctor,
    handleCancelInvitation,
    handleRespondDoctorAffiliation,
    doctors,
  } = useClinicDashboard();
  return (
<div id="practitioners-section" className="bg-white rounded-2xl border border-[#e5e5ea] p-6 sm:p-8 ">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#f0f0f2] mb-6">
            <h2 className="text-[18px] font-semibold text-[#1d1d1f] tracking-tight">
              Affiliated Doctors
            </h2>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-normal flex items-center gap-1.5 self-start sm:self-auto  transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite Doctor</span>
            </button>
          </div>

          {/* Incoming Doctor Affiliation Requests */}
          {data?.incomingRequests && data.incomingRequests.length > 0 && (
            <div className="mb-6 p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0066cc]" />
                  <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                    Incoming Doctor Affiliation Requests ({data.incomingRequests.length})
                  </h3>
                </div>
                <span className="text-xs text-[#0066cc] font-normal">Requires Clinic Approval</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.incomingRequests.map((doc) => (
                  <div
                    key={doc.affiliationId || doc.doctorId}
                    className="p-4 rounded-2xl bg-white border border-[#e5e5ea] flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-[14px] text-[#1d1d1f]">{cleanDoctorName(doc.fullName)}</h4>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] font-normal">
                          {doc.specialty}
                        </span>
                      </div>
                      <p className="text-xs text-[#86868b] mt-0.5">{doc.email}</p>
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t border-[#f0f0f2]">
                      <button
                        type="button"
                        onClick={() => handleRespondDoctorAffiliation(doc.affiliationId!, 'ACCEPT')}
                        className="flex-1 h-9 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white font-semibold flex items-center justify-center gap-1 text-xs transition-all cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespondDoctorAffiliation(doc.affiliationId!, 'REJECT')}
                        className="flex-1 h-9 rounded-full bg-[#f5f5f7] hover:bg-danger-soft text-danger border border-[#e5e5ea] font-normal flex items-center justify-center gap-1 text-xs transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Outgoing Doctor Requests */}
          {data?.outgoingRequests && data.outgoingRequests.length > 0 && (
            <div className="mb-6 p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea]">
              <div className="flex items-center gap-2 mb-3">
                <Clock3 className="w-4 h-4 text-[#86868b]" />
                <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                  Pending Doctor Invitations ({data.outgoingRequests.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.outgoingRequests.map((doc) => (
                  <div
                    key={doc.affiliationId || doc.doctorId}
                    className="p-3.5 rounded-2xl bg-white border border-[#e5e5ea] flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[14px] text-[#1d1d1f]">{cleanDoctorName(doc.fullName)}</span>
                      <span className="text-xs text-[#86868b] block mt-0.5">{doc.specialty}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
                        Awaiting Doctor
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCancelInvitation(doc.doctorId, doc.fullName)}
                        className="text-danger hover:bg-danger-soft rounded-full text-xs font-normal h-7 px-2.5 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && !data ? (
            <div className="py-12 text-center text-xs text-[#86868b]">Loading…</div>
          ) : doctors.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title="No Doctors Affiliated Yet"
              description="Add doctors to start taking bookings."
              actionText="Onboard First Doctor"
              onAction={() => setShowAddModal(true)}
            />
          ) : (
            <>
              {/* Mobile Doctor Cards (< 640px) */}
              <div className="block sm:hidden space-y-3">
                {doctors.map((doc) => (
                  <div key={doc.doctorId} className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white border border-[#e5e5ea] overflow-hidden flex-shrink-0">
                          {doc.avatarUrl ? (
                            <img src={getFileUrl(doc.avatarUrl)} alt={doc.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-semibold text-xs text-[#0066cc]">
                              {doc.fullName[0]}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-[#1d1d1f] text-[14px]">{doc.fullName}</div>
                          <div className="text-xs text-[#86868b]">
                            {formatDoctorDegrees(doc.qualifications)} • {doc.experienceYears} yrs exp.
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-normal bg-[#0066cc]/10 text-[#0066cc] shrink-0">
                        {doc.specialty}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-[#e5e5ea] text-center">
                      <div>
                        <div className="text-[11px] text-[#86868b]">Fee</div>
                        <div className="font-semibold text-xs text-[#1d1d1f] mt-0.5">₹{doc.consultationFee.toFixed(0)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#86868b]">Bookings</div>
                        <div className="font-semibold text-xs text-[#1d1d1f] mt-0.5">{doc.bookingCount}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#86868b]">Revenue</div>
                        <div className="font-semibold text-xs text-[#1d1d1f] mt-0.5">₹{doc.revenue.toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => handleDetachDoctor(doc.doctorId, doc.fullName)}
                        className="h-8 px-3 rounded-full text-xs font-normal text-danger hover:bg-danger-soft border border-danger-line transition-all active:scale-[0.98] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Detach Practitioner</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e5e5ea] text-[#86868b] font-normal">
                    <th className="pb-3 pl-2">Practitioner</th>
                    <th className="pb-3">Specialty</th>
                    <th className="pb-3">Fee</th>
                    <th className="pb-3 text-center">Bookings Here</th>
                    <th className="pb-3 text-right">Revenue Here</th>
                    <th className="pb-3 text-right pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f2]">
                  {doctors.map((doc) => (
                    <tr key={doc.doctorId} className="hover:bg-[#f5f5f7]/60 transition-colors">
                      <td className="py-4 pl-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex-shrink-0">
                            {doc.avatarUrl ? (
                              <img
                                src={getFileUrl(doc.avatarUrl)}
                                alt={doc.fullName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-semibold text-xs text-[#0066cc]">
                                {doc.fullName[0]}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-[#1d1d1f] text-[14px]">
                              {doc.fullName}
                            </div>
                            <div className="text-xs text-[#86868b]">
                              {formatDoctorDegrees(doc.qualifications)} • {doc.experienceYears} yrs exp.
                            </div>
                            <div className="text-[11px] text-[#86868b]">{doc.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-normal bg-[#0066cc]/10 text-[#0066cc]">
                          {doc.specialty}
                        </span>
                      </td>

                      <td className="py-4 font-normal text-[#1d1d1f]">
                        ₹{doc.consultationFee.toFixed(0)}
                      </td>

                      <td className="py-4 text-center">
                        <span className="font-semibold text-[#1d1d1f] text-[14px]">
                          {doc.bookingCount}
                        </span>
                        <span className="text-[11px] text-[#86868b] block">
                          ({doc.completedCount} completed)
                        </span>
                      </td>

                      <td className="py-4 text-right">
                        <span className="font-semibold text-[#1d1d1f] text-[14px]">
                          ₹{doc.revenue.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-[#86868b] block">at this clinic</span>
                      </td>

                      <td className="py-4 text-right pr-2">
                        <button
                          onClick={() => handleDetachDoctor(doc.doctorId, doc.fullName)}
                          className="h-8 px-3 rounded-full text-xs font-normal text-danger hover:bg-danger-soft border border-danger-line transition-all active:scale-[0.98] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Detach
                        </button>
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
