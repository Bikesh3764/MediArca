import React from 'react';
import { format12Hour, getFileUrl } from '../../../services/api';
import { AppleButton } from '../../../components/ui/AppleButton';
import { UtilityCard } from '../../../components/ui/UtilityCard';
import { X, Search } from 'lucide-react';
import { useAdminDashboard } from './state';
export const DoctorsTab: React.FC = () => {
  const {
    doctors,
    actionId,
    setSelectedDoctor,
    doctorSearchQuery,
    setDoctorSearchQuery,
    doctorStatusFilter,
    setDoctorStatusFilter,
    getPractitionerStatus,
    filteredDoctors,
    renderStatusBadge,
    handleVerify,
  } = useAdminDashboard();
  return (
<UtilityCard>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">Practitioner Verification Queue</h3>
                    <p className="text-[13px] text-[#86868b] mt-1 leading-relaxed">
                      Doctors must be verified by admin before appearing in patient searches.
                    </p>
                  </div>
                  <span className="text-xs text-[#86868b]">
                    {filteredDoctors.length} of {doctors.length} Registered Doctor(s)
                  </span>
                </div>

                {/* Search & Status Filters */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={doctorSearchQuery}
                      onChange={(e) => setDoctorSearchQuery(e.target.value)}
                      placeholder="Search doctor by name, specialty, email..."
                      className="w-full h-10 pl-10 pr-8 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-base sm:text-xs text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none focus:bg-white focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                    />
                    {doctorSearchQuery && (
                      <button aria-label="Close"
                        type="button"
                        onClick={() => setDoctorSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="inline-flex items-center p-1 bg-[#e8e8ed]/70 rounded-full border border-[#e5e5ea] overflow-x-auto scrollbar-none self-start sm:self-auto">
                    {(['ALL', 'PENDING', 'VERIFIED', 'SUSPENDED', 'REJECTED'] as const).map((st) => {
                      const count = st === 'ALL'
                        ? doctors.length
                        : doctors.filter((d) => getPractitionerStatus(d) === st).length;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setDoctorStatusFilter(st)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                            doctorStatusFilter === st
                              ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-semibold'
                              : 'text-[#86868b] hover:text-[#1d1d1f]'
                          }`}
                        >
                          <span>{st === 'ALL' ? 'All' : st === 'PENDING' ? 'Pending' : st === 'VERIFIED' ? 'Verified' : st === 'SUSPENDED' ? 'Suspended' : 'Rejected'}</span>
                          <span className="ml-1 opacity-70">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#e5e5ea] text-[#86868b] font-semibold">
                      <tr>
                        <th className="py-3 px-3">Practitioner</th>
                        <th className="py-3 px-3">Specialty</th>
                        <th className="py-3 px-3">Checking Shift</th>
                        <th className="py-3 px-3">Fee</th>
                        <th className="py-3 px-3">Verification Status</th>
                        <th className="py-3 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f0]">
                      {filteredDoctors.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-[#86868b]">
                            No practitioners match the current search or status filter.
                          </td>
                        </tr>
                      ) : (
                        filteredDoctors.map((doc) => (
                        <tr key={doc.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex-shrink-0 cursor-pointer"
                                onClick={() => setSelectedDoctor(doc)}
                              >
                                {doc.user.avatarUrl ? (
                                  <img
                                    src={getFileUrl(doc.user.avatarUrl)}
                                    alt={doc.user.fullName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center font-bold text-[#0066cc]">
                                    {doc.user.fullName[0]}
                                  </div>
                                )}
                              </div>
                              <div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedDoctor(doc)}
                                  className="text-[13px] text-[#1d1d1f] font-semibold block text-left hover:text-[#0066cc] transition-colors"
                                >
                                  {doc.user.fullName}
                                </button>
                                <span className="text-[#86868b]">{doc.user.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 font-medium text-[#1d1d1f]">{doc.specialty}</td>
                          <td className="py-3.5 px-3 text-[#86868b]">
                            {doc.checkingStartTime
                              ? `${format12Hour(doc.checkingStartTime)} – ${format12Hour(doc.checkingEndTime)}`
                              : 'Flexible'}
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-[#1d1d1f]">₹{doc.consultationFee}</td>
                          <td className="py-3.5 px-3">
                            {renderStatusBadge(getPractitionerStatus(doc))}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <AppleButton
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedDoctor(doc)}
                                className="text-xs"
                              >
                                Details
                              </AppleButton>

                              {getPractitionerStatus(doc) === 'PENDING' && (
                                <>
                                  <AppleButton
                                    variant="ghost"
                                    size="sm"
                                    disabled={actionId === doc.id}
                                    onClick={() => handleVerify(doc.id, 'REJECTED')}
                                    className="text-rose-600 hover:text-rose-700 hover:border-rose-300 text-xs"
                                  >
                                    {actionId === doc.id ? 'Updating...' : 'Reject'}
                                  </AppleButton>
                                  <AppleButton
                                    variant="primary"
                                    size="sm"
                                    disabled={actionId === doc.id}
                                    onClick={() => handleVerify(doc.id, 'VERIFIED')}
                                    className="text-xs"
                                  >
                                    {actionId === doc.id ? 'Verifying...' : 'Approve & Verify'}
                                  </AppleButton>
                                </>
                              )}

                              {getPractitionerStatus(doc) === 'VERIFIED' && (
                                <AppleButton
                                  variant="ghost"
                                  size="sm"
                                  disabled={actionId === doc.id}
                                  onClick={() => handleVerify(doc.id, 'SUSPENDED')}
                                  className="text-rose-600 hover:text-rose-700 hover:border-rose-300 text-xs"
                                >
                                  {actionId === doc.id ? 'Suspending...' : 'Suspend'}
                                </AppleButton>
                              )}

                              {getPractitionerStatus(doc) === 'SUSPENDED' && (
                                <AppleButton
                                  variant="primary"
                                  size="sm"
                                  disabled={actionId === doc.id}
                                  onClick={() => handleVerify(doc.id, 'VERIFIED')}
                                  className="text-xs font-medium"
                                >
                                  {actionId === doc.id ? 'Activating...' : 'Re-activate'}
                                </AppleButton>
                              )}

                              {getPractitionerStatus(doc) === 'REJECTED' && (
                                <AppleButton
                                  variant="ghost"
                                  size="sm"
                                  disabled={actionId === doc.id}
                                  onClick={() => handleVerify(doc.id, 'VERIFIED')}
                                  className="text-[#0066cc] hover:text-[#0071e3] text-xs"
                                >
                                  {actionId === doc.id ? 'Updating...' : 'Approve & Verify'}
                                </AppleButton>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                    </tbody>
                  </table>
                </div>
              </UtilityCard>
  );
};
