import React from 'react';
import { AppleButton } from '../../../components/ui/AppleButton';
import { UtilityCard } from '../../../components/ui/UtilityCard';
import { X, Search } from 'lucide-react';
import { useAdminDashboard } from './state';
export const ClinicsTab: React.FC = () => {
  const {
    clinics,
    clinicActionId,
    setSelectedClinic,
    clinicSearchQuery,
    setClinicSearchQuery,
    clinicStatusFilter,
    setClinicStatusFilter,
    getPractitionerStatus,
    filteredClinics,
    renderStatusBadge,
    handleVerifyClinic,
  } = useAdminDashboard();
  return (
<UtilityCard>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">Clinic Facility Verification Queue</h3>
                    <p className="text-[13px] text-[#86868b] mt-1 leading-relaxed">
                      Clinics appear in search after approval.
                    </p>
                  </div>
                  <span className="text-xs text-[#86868b]">
                    {filteredClinics.length} of {clinics.length} Registered Clinic(s)
                  </span>
                </div>

                {/* Search & Status Filters */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={clinicSearchQuery}
                      onChange={(e) => setClinicSearchQuery(e.target.value)}
                      placeholder="Search clinic by name, address, city, contact..."
                      className="w-full h-10 pl-10 pr-8 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-base sm:text-xs text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none focus:bg-white focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                    />
                    {clinicSearchQuery && (
                      <button aria-label="Close"
                        type="button"
                        onClick={() => setClinicSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="inline-flex items-center p-1 bg-[#e8e8ed]/70 rounded-full border border-[#e5e5ea] overflow-x-auto no-scrollbar max-w-full self-start sm:self-auto">
                    {(['ALL', 'PENDING', 'VERIFIED', 'SUSPENDED', 'REJECTED'] as const).map((st) => {
                      const count = st === 'ALL'
                        ? clinics.length
                        : clinics.filter((c) => getPractitionerStatus(c) === st).length;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setClinicStatusFilter(st)}
                          className={`px-3 py-1 rounded-full text-xs font-normal transition-all cursor-pointer whitespace-nowrap ${
                            clinicStatusFilter === st
                              ? 'bg-white text-[#1d1d1f]  font-semibold'
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
                        <th className="py-3 px-3">Facility</th>
                        <th className="py-3 px-3">Location</th>
                        <th className="py-3 px-3">Capacity & Team</th>
                        <th className="py-3 px-3">Verification Status</th>
                        <th className="py-3 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f0]">
                      {filteredClinics.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-xs text-[#86868b]">
                            {clinicSearchQuery || clinicStatusFilter !== 'ALL'
                              ? 'No clinical facilities match your search query or status filter.'
                              : 'No clinical facilities registered on the platform yet.'}
                          </td>
                        </tr>
                      ) : (
                        filteredClinics.map((c) => (
                          <tr key={c.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                            <td className="py-3.5 px-3">
                              <div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedClinic(c)}
                                  className="text-[13px] text-[#1d1d1f] font-semibold block text-left hover:text-[#0066cc] transition-colors cursor-pointer"
                                >
                                  {c.clinicName}
                                </button>
                                <div className="text-[#86868b]">
                                  {c.user?.fullName} • {c.user?.email}
                                </div>
                                {c.phone && <div className="text-[11px] text-[#86868b]">{c.phone}</div>}
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-[#1d1d1f]">
                              <div>{c.address}</div>
                              <div className="text-[#86868b] text-[11px]">{c.city}</div>
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[#1d1d1f] font-normal">
                                  {c._count?.doctors ?? c.doctorsCount ?? 0} Affiliated Doctor(s)
                                </span>
                                <span className="text-[11px] text-[#86868b]">
                                  {c._count?.receptionists ?? c.receptionistsCount ?? 0} Receptionist(s) • {c._count?.appointments ?? c.appointmentsCount ?? 0} Bookings
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              {renderStatusBadge(getPractitionerStatus(c))}
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <AppleButton
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedClinic(c)}
                                  className="text-xs"
                                >
                                  Details
                                </AppleButton>

                                {getPractitionerStatus(c) === 'PENDING' && (
                                  <>
                                    <AppleButton
                                      variant="ghost"
                                      size="sm"
                                      disabled={clinicActionId === c.id}
                                      onClick={() => handleVerifyClinic(c.id, 'REJECTED')}
                                      className="text-danger hover:text-danger hover:border-danger-line text-xs"
                                    >
                                      {clinicActionId === c.id ? 'Updating...' : 'Reject'}
                                    </AppleButton>
                                    <AppleButton
                                      variant="primary"
                                      size="sm"
                                      disabled={clinicActionId === c.id}
                                      onClick={() => handleVerifyClinic(c.id, 'VERIFIED')}
                                      className="text-xs"
                                    >
                                      {clinicActionId === c.id ? 'Verifying...' : 'Approve & Verify'}
                                    </AppleButton>
                                  </>
                                )}

                                {getPractitionerStatus(c) === 'VERIFIED' && (
                                  <AppleButton
                                    variant="ghost"
                                    size="sm"
                                    disabled={clinicActionId === c.id}
                                    onClick={() => handleVerifyClinic(c.id, 'SUSPENDED')}
                                    className="text-danger hover:text-danger hover:border-danger-line text-xs"
                                  >
                                    {clinicActionId === c.id ? 'Suspending...' : 'Suspend'}
                                  </AppleButton>
                                )}

                                {getPractitionerStatus(c) === 'SUSPENDED' && (
                                  <AppleButton
                                    variant="primary"
                                    size="sm"
                                    disabled={clinicActionId === c.id}
                                    onClick={() => handleVerifyClinic(c.id, 'VERIFIED')}
                                    className="text-xs font-normal"
                                  >
                                    {clinicActionId === c.id ? 'Activating...' : 'Re-activate'}
                                  </AppleButton>
                                )}

                                {getPractitionerStatus(c) === 'REJECTED' && (
                                  <AppleButton
                                    variant="ghost"
                                    size="sm"
                                    disabled={clinicActionId === c.id}
                                    onClick={() => handleVerifyClinic(c.id, 'VERIFIED')}
                                    className="text-[#0066cc] hover:text-[#0071e3] text-xs"
                                  >
                                    {clinicActionId === c.id ? 'Updating...' : 'Approve & Verify'}
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
