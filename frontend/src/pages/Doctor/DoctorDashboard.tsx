import React from 'react';
import { formatDisplayPhone } from '../../utils/phoneUtils';
import { getLocalDateString } from '../../services/api';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Users, Clock, CheckCircle2, RefreshCw, Building2, Plus, AlertCircle, X, Search, MapPin, Clock3, ChevronDown, Phone, FileText } from 'lucide-react';
import { ClinicQrStandeeModal } from '../../components/common/ClinicQrStandeeModal';
import { ClinicalReportModal } from '../../components/common/ClinicalReportModal';
import { DoctorScheduleLeaveModal } from '../../components/common/DoctorScheduleLeaveModal';
import { EmptyState } from '../../components/common/EmptyState';
import { useDoctorDashboardState, DoctorDashboardContext } from './dashboard/state';
import { AffiliationsTab } from './dashboard/AffiliationsTab';
import { QueueTab } from './dashboard/QueueTab';
import { WalkinModal } from './dashboard/WalkinModal';
import { RescheduleModal } from './dashboard/RescheduleModal';
export const DoctorDashboard: React.FC = () => {
  const state = useDoctorDashboardState();
  const {
    user,
    navigate,
    isStandeeModalOpen,
    setIsStandeeModalOpen,
    selectedStandeeClinic,
    activeTab,
    affiliations,
    publicClinics,
    isAffiliateModalOpen,
    setIsAffiliateModalOpen,
    isReportModalOpen,
    setIsReportModalOpen,
    scheduleLeaveModalClinic,
    setScheduleLeaveModalClinic,
    clinicSearchQuery,
    setClinicSearchQuery,
    clinicStateFilter,
    setClinicStateFilter,
    clinicCityFilter,
    setClinicCityFilter,
    affiliatingClinicId,
    feedbackSuccess,
    setFeedbackSuccess,
    feedbackError,
    setFeedbackError,
    selectedClinicId,
    fetchQueue,
    fetchAffiliations,
    showAddModal,
    setShowAddModal,
    setWalkinDate,
    setWalkinClinicId,
    setWalkinError,
    handleAddClinic,
    rescheduleTarget,
    doctorDisplayName,
    navItems,
  } = state;
  return (
    <DoctorDashboardContext.Provider value={state}>
<DashboardLayout
      portalType="DOCTOR"
      navItems={navItems}
      title={
        activeTab === 'affiliations'
          ? 'Clinics & Staff'
          : `Dr. ${doctorDisplayName}`
      }
      subtitle={
        activeTab === 'affiliations'
          ? undefined
          : user?.doctorProfile?.specialty || undefined
      }
      headerAction={
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 'queue' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (selectedClinicId && selectedClinicId !== 'all') {
                    setWalkinClinicId(selectedClinicId);
                  } else if (affiliations?.clinics && affiliations.clinics.length === 1) {
                    setWalkinClinicId(affiliations.clinics[0].clinicId);
                  }
                  setWalkinDate(getLocalDateString());
                  setWalkinError(null);
                  setShowAddModal(true);
                }}
                className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-normal flex items-center gap-1.5 transition-all  cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Walk-in</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setClinicSearchQuery('');
                  setClinicStateFilter('All');
                  setClinicCityFilter('All');
                  setIsAffiliateModalOpen(true);
                }}
                className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-normal flex items-center gap-1.5 transition-all  cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Clinic</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/doctor/schedule')}
                className="h-9 px-3.5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-normal flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-[#0066cc]" />
                <span>Shifts</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="h-9 px-3.5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-normal flex items-center gap-1.5 transition-all cursor-pointer "
          >
            <FileText className="w-3.5 h-3.5 text-[#0066cc]" />
            <span>Reports</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6 pb-24 md:pb-16 pb-safe">
        {activeTab === 'affiliations' ? (
          <AffiliationsTab />
        ) : (
          <QueueTab />
        )}
      </div>

      {/* Rapid Add Walk-in Patient Modal */}
      {showAddModal && (
        <WalkinModal />
      )}

      {/* Affiliate Clinic Modal */}
      {isAffiliateModalOpen && (() => {
        const availableStates = Array.from(
          new Set(publicClinics.map((c) => c.state).filter(Boolean) as string[])
        ).sort();

        const availableCities = Array.from(
          new Set(
            publicClinics
              .filter((c) => clinicStateFilter === 'All' || c.state === clinicStateFilter)
              .map((c) => c.city)
              .filter(Boolean) as string[]
          )
        ).sort();

        const filteredPublicClinics = publicClinics
          .filter((c) => c.isVerified)
          .filter((c) => {
            if (clinicStateFilter !== 'All' && c.state !== clinicStateFilter) return false;
            if (clinicCityFilter !== 'All' && c.city !== clinicCityFilter) return false;
            if (clinicSearchQuery.trim()) {
              const q = clinicSearchQuery.toLowerCase().trim();
              const name = (c.clinicName || '').toLowerCase();
              const addr = (c.address || '').toLowerCase();
              const city = (c.city || '').toLowerCase();
              const state = (c.state || '').toLowerCase();
              return name.includes(q) || addr.includes(q) || city.includes(q) || state.includes(q);
            }
            return true;
          });

        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsAffiliateModalOpen(false);
            }}
          >
            <div className="relative w-full max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl border border-[#e5e5ea]  overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]">
              <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mt-3 -mb-1" />
              {/* Modal Header */}
              <div className="p-6 border-b border-[#e5e5ea] flex items-start justify-between gap-4 bg-white">
                <div>
                  <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">
                    Join a clinic
                  </h3>
                </div>
                <button aria-label="Close"
                  type="button"
                  onClick={() => setIsAffiliateModalOpen(false)}
                  className="p-2 rounded-full text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* In-Modal Feedback Alerts */}
              {feedbackSuccess && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0" />
                    <span>{feedbackSuccess}</span>
                  </div>
                  <button aria-label="Close" onClick={() => setFeedbackSuccess(null)} className="text-[#86868b] hover:text-[#1d1d1f]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {feedbackError && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-danger-soft/70 border border-danger-line/80 text-danger text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-danger shrink-0" />
                    <span>{feedbackError}</span>
                  </div>
                  <button aria-label="Close" onClick={() => setFeedbackError(null)} className="text-danger hover:text-danger">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Search & Location Filter Bar */}
              <div className="p-5 sm:px-6 border-b border-[#e5e5ea] bg-white space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={clinicSearchQuery}
                    onChange={(e) => setClinicSearchQuery(e.target.value)}
                    placeholder="Search clinics"
                    className="w-full h-11 pl-10 pr-9 rounded-xl bg-white border border-[#d2d2d7] text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
                    autoFocus
                  />
                  {clinicSearchQuery && (
                    <button aria-label="Close"
                      type="button"
                      onClick={() => setClinicSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f] p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* State & City Cascading Dropdowns */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  {availableStates.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-normal text-[#86868b]">State:</span>
                      <div className="relative">
                        <select
                          value={clinicStateFilter}
                          onChange={(e) => {
                            setClinicStateFilter(e.target.value);
                            setClinicCityFilter('All');
                          }}
                          className="h-10 sm:h-9 pl-3 pr-8 rounded-xl bg-white border border-[#d2d2d7] text-base sm:text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] appearance-none cursor-pointer"
                        >
                          <option value="All">All States</option>
                          {availableStates.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-[#86868b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  {(availableCities.length > 0 || clinicStateFilter !== 'All') && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-normal text-[#86868b]">City:</span>
                      <div className="relative">
                        <select
                          value={clinicCityFilter}
                          onChange={(e) => setClinicCityFilter(e.target.value)}
                          className="h-10 sm:h-9 pl-3 pr-8 rounded-xl bg-white border border-[#d2d2d7] text-base sm:text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] appearance-none cursor-pointer"
                        >
                          <option value="All">All Cities</option>
                          {availableCities.map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-[#86868b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  <span className="text-xs text-[#86868b] ml-auto">
                    {filteredPublicClinics.length} verified {filteredPublicClinics.length === 1 ? 'clinic' : 'clinics'} found
                  </span>
                </div>
              </div>

              {/* Clinics List */}
              <div className="p-5 sm:px-6 overflow-y-auto space-y-3 flex-1 bg-[#f5f5f7]">
                {filteredPublicClinics.length === 0 ? (
                  <EmptyState
                    icon={Building2}
                    title="No clinics found"
                    description={
                      clinicSearchQuery || clinicStateFilter !== 'All' || clinicCityFilter !== 'All'
                        ? 'Try a different search.'
                        : 'No clinics yet.'
                    }
                    actionText={
                      clinicSearchQuery || clinicStateFilter !== 'All' || clinicCityFilter !== 'All'
                        ? 'Clear Filters'
                        : undefined
                    }
                    onAction={
                      clinicSearchQuery || clinicStateFilter !== 'All' || clinicCityFilter !== 'All'
                        ? () => {
                            setClinicSearchQuery('');
                            setClinicStateFilter('All');
                            setClinicCityFilter('All');
                          }
                        : undefined
                    }
                  />
                ) : (
                  filteredPublicClinics.map((c) => {
                    const isAffiliated = affiliations?.clinics.some((ac) => ac.clinicId === c.id);
                    const isPending = affiliations?.outgoingRequests?.some(
                      (req) => req.clinicId === c.id || req.clinicName === c.clinicName
                    );
                    const hasIncoming = affiliations?.incomingRequests?.some((req) => req.clinicId === c.id);
                    const isAddingThis = affiliatingClinicId === c.id;

                    return (
                      <div
                        key={c.id}
                        className="p-4 rounded-2xl bg-white border border-[#e5e5ea] hover:border-[#d2d2d7] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-[15px] text-[#1d1d1f] tracking-tight">
                              {c.clinicName}
                            </h4>
                            <span
                              title="Verified clinic"
                              className="inline-flex items-center gap-1 text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc]"
                            >
                              <CheckCircle2 className="w-3 h-3 text-[#0066cc]" />
                              Verified
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-[#86868b] mt-1 truncate">
                            <MapPin className="w-3.5 h-3.5 shrink-0 text-[#86868b]" />
                            <span className="truncate">
                              {c.address}
                              {c.city ? `, ${c.city}` : ''}
                              {c.state ? `, ${c.state}` : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-[#86868b] mt-2">
                            {c.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {formatDisplayPhone(c.phone)}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {c._count?.doctors ?? c.doctors?.length ?? 0} Specialist{c._count?.doctors === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[#f0f0f2]">
                          {isAffiliated ? (
                            <span className="px-3.5 py-1.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] text-xs font-semibold flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Joined
                            </span>
                          ) : isPending ? (
                            <span className="px-3.5 py-1.5 rounded-full bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea] text-xs font-normal flex items-center gap-1.5">
                              <Clock3 className="w-3.5 h-3.5" />
                              Requested
                            </span>
                          ) : hasIncoming ? (
                            <span className="px-3.5 py-1.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] text-xs font-semibold flex items-center gap-1.5">
                              Invited you
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isAddingThis}
                              onClick={() => handleAddClinic(c.id)}
                              className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                            >
                              {isAddingThis ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Sending...</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Join</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[#e5e5ea] bg-white flex items-center justify-between text-xs text-[#86868b] px-6">
                <span>Only verified clinics are shown.</span>
                <button
                  type="button"
                  onClick={() => setIsAffiliateModalOpen(false)}
                  className="h-9 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-normal transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Clinic QR Check-In Standee Modal */}
      {selectedStandeeClinic && (
        <ClinicQrStandeeModal
          isOpen={isStandeeModalOpen}
          onClose={() => setIsStandeeModalOpen(false)}
          clinicId={selectedStandeeClinic.clinicId}
          clinicName={selectedStandeeClinic.clinicName}
          clinicAddress={selectedStandeeClinic.clinicAddress}
          clinicPhone={selectedStandeeClinic.clinicPhone}
          checkinCode={selectedStandeeClinic.checkinCode}
        />
      )}

      {/* Reschedule / Shift Modal for Doctor */}
      {rescheduleTarget && (
        <RescheduleModal />
      )}

      {/* Categorized Practice Report & PDF Export Modal */}
      <ClinicalReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        role="DOCTOR"
        doctorName={`Dr. ${doctorDisplayName}`}
        initialClinicId={selectedClinicId !== 'all' ? selectedClinicId : undefined}
        availableClinics={affiliations?.clinics?.map((c) => ({
          clinicId: c.clinicId,
          clinicName: c.clinicName,
          city: c.city,
        }))}
      />

      {/* Practitioner Schedule & Leave Management Modal */}
      {scheduleLeaveModalClinic && (
        <DoctorScheduleLeaveModal
          isOpen={true}
          onClose={() => setScheduleLeaveModalClinic(null)}
          doctorId={user?.doctorProfile?.id || ''}
          doctorName={user?.fullName || 'Practitioner'}
          clinicId={scheduleLeaveModalClinic.clinicId}
          clinicName={scheduleLeaveModalClinic.clinicName}
          onSuccess={() => {
            fetchAffiliations();
            fetchQueue(false);
          }}
        />
      )}
    </DashboardLayout>
    </DoctorDashboardContext.Provider>
  );
};