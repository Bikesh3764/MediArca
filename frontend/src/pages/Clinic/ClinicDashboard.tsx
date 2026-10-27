import { formatClinicAddress } from '../../utils/address';
import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { ClinicQrStandeeModal } from '../../components/common/ClinicQrStandeeModal';
import { AlertCircle, CheckCircle2, X, ShieldAlert, QrCode, MapPin, FileText, Settings } from 'lucide-react';
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
import { ProfileModal } from './dashboard/ProfileModal';
export const ClinicDashboard: React.FC = () => {
  const state = useClinicDashboardState();
  const {
    user,
    error,
    setError,
    successMsg,
    setSuccessMsg,
    activeSection,
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
    clinic,
    doctors,
    navItems,
  } = state;
  return (
    <ClinicDashboardContext.Provider value={state}>
<DashboardLayout
      portalType="CLINIC"
      portalSubtitle="Clinic"
      navItems={navItems}
      title={clinic?.clinicName || user?.fullName || 'Clinic Partner Portal'}
      subtitle={
        clinic?.address
          ? formatClinicAddress(clinic)
          : clinic?.city
          ? `${clinic.city}${clinic?.state ? `, ${clinic.state}` : ''}`
          : undefined
      }
      headerAction={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/clinic/profile"
            className="h-9 px-4 rounded-full bg-white hover:bg-[#f5f5f7] active:scale-[0.98] text-[#1d1d1f] border border-[#d2d2d7] text-xs font-normal flex items-center gap-2 transition-all cursor-pointer "
          >
            <Settings className="w-3.5 h-3.5 text-[#0066cc]" />
            <span>Settings</span>
          </Link>
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="h-9 px-4 rounded-full bg-white hover:bg-[#f5f5f7] active:scale-[0.98] text-[#1d1d1f] border border-[#d2d2d7] text-xs font-normal flex items-center gap-2 transition-all cursor-pointer "
          >
            <FileText className="w-3.5 h-3.5 text-[#0066cc]" />
            <span>Reports</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPosterModal(true)}
            className="h-9 px-4 rounded-full bg-white hover:bg-[#f5f5f7] active:scale-[0.98] text-[#1d1d1f] border border-[#d2d2d7] text-xs font-normal flex items-center gap-2 transition-all cursor-pointer "
          >
            <QrCode className="w-3.5 h-3.5 text-[#0066cc]" />
            <span>QR Code</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6 pb-24 md:pb-16 pb-safe">
        {/* Profile Incompletion Alert (e.g. Google OAuth Clinics) */}
        {(!clinic?.address || !clinic?.city || !clinic?.state) && (
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-warning-line text-[#1d1d1f] text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-[#1d1d1f] text-sm">Add your city and state</div>
                <p className="text-[#86868b] text-xs mt-0.5 leading-relaxed">
                  Patients find clinics by city.
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
              className="shrink-0 h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white font-normal text-xs transition-colors  cursor-pointer select-none"
            >
              Add location
            </button>
          </div>
        )}

        {/* Verification Warning if clinic not yet verified or suspended */}
        {clinic?.verificationStatus === 'SUSPENDED' && (
          <div className="p-4 rounded-2xl bg-danger-soft/70 border border-danger-line/80 text-danger text-xs flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-danger">Clinic suspended</div>
              <p className="text-danger text-xs mt-0.5 leading-relaxed">
                Bookings are paused. Contact MediArca support.
              </p>
            </div>
          </div>
        )}
        {clinic?.verificationStatus === 'REJECTED' && (
          <div className="p-4 rounded-2xl bg-danger-soft/70 border border-danger-line/80 text-danger text-xs flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-danger">Registration not approved</div>
              <p className="text-danger text-xs mt-0.5 leading-relaxed">
                Contact MediArca support to review your details.
              </p>
            </div>
          </div>
        )}
        {((clinic?.verificationStatus === 'PENDING' || clinic?.isVerified === false) && clinic?.verificationStatus !== 'SUSPENDED' && clinic?.verificationStatus !== 'REJECTED') && (
          <div className="p-4 rounded-2xl bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-start gap-3 ">
            <ShieldAlert className="w-4 h-4 text-[#0066cc] flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[#1d1d1f]">Waiting for verification</div>
              <p className="text-[#86868b] text-xs mt-0.5 leading-relaxed">
                You can add doctors and staff now. Your clinic goes live once approved.
              </p>
            </div>
          </div>
        )}

        {/* Banner feedback */}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center justify-between ">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
              <span className="font-normal">{successMsg}</span>
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
          <div className="p-4 rounded-2xl bg-danger-soft/70 border border-danger-line/80 text-danger text-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-danger" />
              <span>{error}</span>
            </div>
            <button aria-label="Close" onClick={() => setError(null)} className="text-danger hover:text-danger">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}


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
          clinicAddress={formatClinicAddress(clinic, { withState: false })}
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