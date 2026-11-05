import React from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { UserPlus, CheckCircle2, AlertCircle, X, QrCode, FileText } from 'lucide-react';
import { ClinicQrStandeeModal } from '../../components/common/ClinicQrStandeeModal';
import { ClinicalReportModal } from '../../components/common/ClinicalReportModal';
import { DoctorScheduleLeaveModal } from '../../components/common/DoctorScheduleLeaveModal';
import { cleanDoctorName } from './desk/helpers';
import { useReceptionistDashboardState, ReceptionistDashboardContext } from './desk/state';
import { QueueTab } from './desk/QueueTab';
import { WalkinTab } from './desk/WalkinTab';
import { PendingTab } from './desk/PendingTab';
import { DoctorsTab } from './desk/DoctorsTab';
import { NotificationsTab } from './desk/NotificationsTab';
import { BookedPassModal } from './desk/BookedPassModal';
import { PasswordChangeModal } from './desk/PasswordChangeModal';
import { RescheduleModal } from './desk/RescheduleModal';
import { ChangePasswordCard } from '../../components/auth/ChangePasswordCard';
import { DeleteAccountCard } from '../../components/auth/DeleteAccountCard';
export const ReceptionistDashboard: React.FC = () => {
  const state = useReceptionistDashboardState();
  const {
    user,
    data,
    activeTab,
    setActiveTab,
    error,
    setError,
    successMsg,
    setSuccessMsg,
    isStandeeModalOpen,
    setIsStandeeModalOpen,
    isReportModalOpen,
    setIsReportModalOpen,
    scheduleModalDoctor,
    setScheduleModalDoctor,
    rescheduleTarget,
    bookedPass,
    queueDoctorId,
    fetchDeskData,
    linkedDoctors,
    fetchWalkinPreview,
    navItems,
    titleText,
    subtitleText,
  } = state;
  return (
    <ReceptionistDashboardContext.Provider value={state}>
<DashboardLayout
      portalType="RECEPTIONIST"
      portalSubtitle="Front Desk"
      navItems={navItems}
      title={titleText}
      subtitle={subtitleText}
      headerAction={
        <div className="flex items-center gap-2">
          {activeTab !== 'walkin' && (
            <button
              type="button"
              onClick={() => setActiveTab('walkin')}
              className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-normal inline-flex items-center gap-1.5  transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Walk-in</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="h-9 px-3.5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-normal inline-flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-[#0066cc]" />
            <span>Reports</span>
          </button>
          {data?.clinic?.id && (
            <button
              type="button"
              onClick={() => setIsStandeeModalOpen(true)}
              className="h-9 px-4 rounded-full bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] border border-[#d2d2d7] text-xs font-normal inline-flex items-center gap-2 transition-all active:scale-[0.98]  cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-[#0066cc]" />
              <span>QR Code</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6 print:hidden pb-24 md:pb-16 pb-safe">
        {/* Feedback Banners */}
        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
              <span className="font-normal">{successMsg}</span>
            </div>
            <button aria-label="Close" onClick={() => setSuccessMsg(null)} className="text-[#86868b] hover:text-[#1d1d1f] p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-2xl bg-danger-soft border border-danger-line text-danger text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-normal">{error}</span>
            </div>
            <button aria-label="Close" onClick={() => setError(null)} className="text-danger hover:text-danger p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {activeTab === 'account' && (
          <div className="max-w-2xl space-y-6">
            <ChangePasswordCard />
            <DeleteAccountCard />
          </div>
        )}

        {/* Primary Workspace Container */}
        {activeTab !== 'account' && (
        <div className="bg-white rounded-2xl border border-[#e5e5ea] p-4 sm:p-7">
          {/* TAB 1: LIVE QUEUE (Primary Front Desk View) */}
          {activeTab === 'queue' && (
            <QueueTab />
          )}

          {/* TAB 2: WALK-IN BOOKING (Balanced 2-Column Layout) */}
          {activeTab === 'walkin' && (
            <WalkinTab />
          )}

          {/* TAB 3: PENDING APPROVALS (Clean Horizontal Cards) */}
          {activeTab === 'pending' && (
            <PendingTab />
          )}

          {/* TAB 4: ASSIGNED DOCTORS ROSTER */}
          {activeTab === 'doctors' && (
            <DoctorsTab />
          )}

          {/* TAB 5: DESK NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <NotificationsTab />
          )}
        </div>
        )}
      </div>

      {/* 3. Guaranteed Queue Token Pass Modal */}
      {bookedPass && (
        <BookedPassModal />
      )}

      {/* Mandatory Password Change Modal for Provisioned Accounts */}
      {user?.mustChangePassword && (
        <PasswordChangeModal />
      )}

      {/* Clinic QR Check-In Standee Modal */}
      {data?.clinic && (
        <ClinicQrStandeeModal
          isOpen={isStandeeModalOpen}
          onClose={() => setIsStandeeModalOpen(false)}
          clinicId={data.clinic.id}
          clinicName={data.clinic.clinicName || 'Clinic Front Desk'}
          clinicAddress={data.clinic.address || ''}
          clinicPhone={data.clinic.phone || ''}
          checkinCode={data.clinic.checkinCode || ''}
        />
      )}

      {/* Reschedule Appointment Modal */}
      {rescheduleTarget && (
        <RescheduleModal />
      )}

      {/* Categorized Desk Report & PDF Export Modal */}
      <ClinicalReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        role="RECEPTIONIST"
        clinicName={data?.clinic?.clinicName}
        initialDoctorId={queueDoctorId || undefined}
        availableDoctors={linkedDoctors.map((doc) => ({
          doctorId: doc.doctorId,
          fullName: cleanDoctorName(doc.fullName),
          specialty: doc.specialty,
        }))}
      />

      {/* Practitioner Schedule & Leave Management Modal */}
      {scheduleModalDoctor && (
        <DoctorScheduleLeaveModal
          isOpen={true}
          onClose={() => setScheduleModalDoctor(null)}
          doctorId={scheduleModalDoctor.doctorId}
          doctorName={scheduleModalDoctor.doctorName}
          clinicId={data?.clinic?.id}
          clinicName={data?.clinic?.clinicName}
          onSuccess={() => {
            fetchDeskData();
            if (activeTab === 'walkin') {
              fetchWalkinPreview();
            }
          }}
        />
      )}
    </DashboardLayout>
    </ReceptionistDashboardContext.Provider>
  );
};