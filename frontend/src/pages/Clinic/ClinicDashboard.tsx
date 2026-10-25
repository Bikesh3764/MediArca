import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { ClinicQrStandeeModal } from '../../components/common/ClinicQrStandeeModal';
import { AlertCircle, CheckCircle2, X, ShieldAlert, QrCode, RefreshCw, MapPin, FileText, Settings } from 'lucide-react';
import { ClinicalReportModal } from '../../components/common/ClinicalReportModal';
import { cleanDoctorName } from './dashboard/helpers';
import { useClinicDashboardState, ClinicDashboardContext } from './dashboard/state';
import { DoctorsSection } from './dashboard/DoctorsSection';
import { StaffSection } from './dashboard/StaffSection';
import { BookingsSection } from './dashboard/BookingsSection';
import { InviteDoctorModal } from './dashboard/InviteDoctorModal';
import { AddStaffModal } from './dashboard/AddStaffModal';
import { EditStaffModal } from './dashboard/EditStaffModal';
import { CredentialsModal } from './dashboard/CredentialsModal';
import { ApproveStaffModal } from './dashboard/ApproveStaffModal';
import { ProfileModal } from './dashboard/ProfileModal';
export const ClinicDashboard: React.FC = () => {
  const state = useClinicDashboardState();
  const {
    user,
    data,
    loading,
    error,
    setError,
    successMsg,
    setSuccessMsg,
    activeSection,
    setActiveSection,
    showAddModal,
    showRecModal,
    editingRec,
    createdCredentials,
    showPosterModal,
    setShowPosterModal,
    showReportModal,
    setShowReportModal,
    showProfileModal,
    setShowProfileModal,
    setProfileAddress,
    setProfileState,
    setProfileCity,
    setProfilePhone,
    setProfileError,
    fetchClinicData,
    approvingRec,
    clinic,
    doctors,
    navItems,
  } = state;
  return (
    <ClinicDashboardContext.Provider value={state}>
<DashboardLayout
      portalType="CLINIC"
      portalSubtitle="Clinic Portal"
      navItems={navItems}
      title={clinic?.clinicName || user?.fullName || 'Clinic Partner Portal'}
      subtitle={
        clinic?.address
          ? `${clinic.address}${clinic?.city ? ` • ${clinic.city}` : ''}${clinic?.state ? `, ${clinic.state}` : ''}`
          : clinic?.city
          ? `${clinic.city}${clinic?.state ? `, ${clinic.state}` : ''}`
          : undefined
      }
      headerAction={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/clinic/profile"
            className="h-9 px-4 rounded-full bg-white hover:bg-[#f5f5f7] active:scale-[0.98] text-[#1d1d1f] border border-[#d2d2d7] text-xs font-medium flex items-center gap-2 transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          >
            <Settings className="w-3.5 h-3.5 text-[#0066cc]" />
            <span>Profile & Settings</span>
          </Link>
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="h-9 px-4 rounded-full bg-white hover:bg-[#f5f5f7] active:scale-[0.98] text-[#1d1d1f] border border-[#d2d2d7] text-xs font-medium flex items-center gap-2 transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          >
            <FileText className="w-3.5 h-3.5 text-[#0066cc]" />
            <span>Reports & PDF</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPosterModal(true)}
            className="h-9 px-4 rounded-full bg-white hover:bg-[#f5f5f7] active:scale-[0.98] text-[#1d1d1f] border border-[#d2d2d7] text-xs font-medium flex items-center gap-2 transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          >
            <QrCode className="w-3.5 h-3.5 text-[#0066cc]" />
            <span>QR Code</span>
          </button>
          <button
            type="button"
            onClick={() => fetchClinicData(true)}
            disabled={loading}
            className="h-9 px-4 rounded-full bg-white hover:bg-[#f5f5f7] active:scale-[0.98] text-[#1d1d1f] border border-[#d2d2d7] text-xs font-medium flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#86868b] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6 pb-24 md:pb-16 pb-safe">
        {/* Profile Incompletion Alert (e.g. Google OAuth Clinics) */}
        {(!clinic?.address || !clinic?.city || !clinic?.state) && (
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-amber-300 text-[#1d1d1f] text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-[#1d1d1f] text-sm">Action Needed: Set Clinic Location & Address</div>
                <p className="text-[#86868b] text-xs mt-0.5 leading-relaxed">
                  Your facility address, state, and city are not set yet. Completing this ensures patients and doctors find your clinic in city-wide searches.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setProfileAddress(clinic?.address || '');
                setProfileState(clinic?.state || '');
                setProfileCity(clinic?.city || '');
                setProfilePhone(clinic?.phone || '');
                setProfileError(null);
                setShowProfileModal(true);
              }}
              className="shrink-0 h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white font-medium text-xs transition-colors shadow-sm cursor-pointer select-none"
            >
              Complete Profile
            </button>
          </div>
        )}

        {/* Verification Warning if clinic not yet verified or suspended */}
        {clinic?.verificationStatus === 'SUSPENDED' && (
          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-rose-800 text-xs flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-rose-900">Clinic Facility License Suspended</div>
              <p className="text-rose-700 text-xs mt-0.5 leading-relaxed">
                Your facility license has been suspended by administration. Doctors cannot accept new affiliations or clinic bookings until license reinstatement.
              </p>
            </div>
          </div>
        )}
        {clinic?.verificationStatus === 'REJECTED' && (
          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-rose-800 text-xs flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-rose-900">Clinic Registration Application Rejected</div>
              <p className="text-rose-700 text-xs mt-0.5 leading-relaxed">
                Your clinic registration credentials were not approved. Please contact platform administration to review your facility details.
              </p>
            </div>
          </div>
        )}
        {((clinic?.verificationStatus === 'PENDING' || clinic?.isVerified === false) && clinic?.verificationStatus !== 'SUSPENDED' && clinic?.verificationStatus !== 'REJECTED') && (
          <div className="p-4 rounded-2xl bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-start gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <ShieldAlert className="w-4 h-4 text-[#0066cc] flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[#1d1d1f]">Clinic Pending Administrative Verification</div>
              <p className="text-[#86868b] text-xs mt-0.5 leading-relaxed">
                Your clinic profile is pending review by MediArca administration. While unverified, your clinic will not appear in public searches and online bookings are paused. You can configure your facility profile, onboard doctors, and prepare front desk staff ahead of verification.
              </p>
            </div>
          </div>
        )}

        {/* Banner feedback */}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center justify-between shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
              <span className="font-medium">{successMsg}</span>
            </div>
            <button aria-label="Close"
              onClick={() => setSuccessMsg(null)}
              className="text-[#86868b] hover:text-[#1d1d1f]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-rose-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button aria-label="Close" onClick={() => setError(null)} className="text-rose-700 hover:text-rose-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}


        {/* Segmented Tab Switcher */}
        <div className="inline-flex p-1 rounded-full bg-[#e8e8ed]/80 border border-[#e5e5ea] max-w-full overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveSection('doctors')}
            className={`h-9 px-4 rounded-full text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSection === 'doctors'
                ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)] font-semibold'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <span>Affiliated Doctors</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              activeSection === 'doctors' ? 'bg-[#0066cc]/10 text-[#0066cc]' : 'bg-white/80 text-[#86868b]'
            }`}>
              {doctors.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('receptionists')}
            className={`h-9 px-4 rounded-full text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSection === 'receptionists'
                ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)] font-semibold'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <span>Desk Staff</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              activeSection === 'receptionists' ? 'bg-[#0066cc]/10 text-[#0066cc]' : 'bg-white/80 text-[#86868b]'
            }`}>
              {data?.receptionists?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('appointments')}
            className={`h-9 px-4 rounded-full text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSection === 'appointments'
                ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)] font-semibold'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <span>Facility Bookings</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              activeSection === 'appointments' ? 'bg-[#0066cc]/10 text-[#0066cc]' : 'bg-white/80 text-[#86868b]'
            }`}>
              {data?.recentAppointments?.length || 0}
            </span>
          </button>
        </div>

        {/* 2. Affiliated Doctors Section */}
        {activeSection === 'doctors' && (
        <DoctorsSection />
        )}

        {/* Desk Receptionists & Front Staff Section */}
        {activeSection === 'receptionists' && (
        <StaffSection />
        )}

        {/* 4. Recent Clinic Appointments Table */}
        {activeSection === 'appointments' && (
        <BookingsSection />
        )}
      </div>

      {/* Onboard Doctor Modal */}
      {showAddModal && (
        <InviteDoctorModal />
      )}

      {/* Provision Receptionist Modal */}
      {showRecModal && (
        <AddStaffModal />
      )}

      {/* Edit Assigned Doctors Modal */}
      {editingRec && (
        <EditStaffModal />
      )}

      {/* Receptionist Credentials Handover Modal */}
      {createdCredentials && (
        <CredentialsModal />
      )}

      {/* Review & Approve Incoming Receptionist Modal */}
      {approvingRec && (
        <ApproveStaffModal />
      )}

      {/* Complete Clinic Profile / Address Modal */}
      {showProfileModal && (
        <ProfileModal />
      )}

      {/* Clinic Physical Check-In QR Standee Modal */}
      {clinic && (
        <ClinicQrStandeeModal
          isOpen={showPosterModal}
          onClose={() => setShowPosterModal(false)}
          clinicId={clinic.id}
          clinicName={clinic.clinicName}
          clinicAddress={`${clinic.address || ''}${clinic.city ? `, ${clinic.city}` : ''}`}
          checkinCode={clinic.checkinCode || undefined}
        />
      )}

      {/* Clinic Categorized Report & PDF Export Modal */}
      <ClinicalReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        role="CLINIC"
        clinicName={clinic?.clinicName || user?.fullName}
        availableDoctors={doctors.map((doc) => ({
          doctorId: doc.doctorId,
          fullName: cleanDoctorName(doc.fullName),
          specialty: doc.specialty,
        }))}
      />
    </DashboardLayout>
    </ClinicDashboardContext.Provider>
  );
};