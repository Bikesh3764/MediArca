import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import { Users, Shield, RefreshCw, Globe, LogOut } from 'lucide-react';
import { useAdminDashboardState, AdminDashboardContext } from './dashboard/state';
import { DoctorsTab } from './dashboard/DoctorsTab';
import { ClinicsTab } from './dashboard/ClinicsTab';
import { AppointmentsTab } from './dashboard/AppointmentsTab';
import { MessagesTab } from './dashboard/MessagesTab';
import { DoctorDetailsModal } from './dashboard/DoctorDetailsModal';
import { ClinicDetailsModal } from './dashboard/ClinicDetailsModal';
import { AppointmentDetailsModal } from './dashboard/AppointmentDetailsModal';
export const AdminDashboard: React.FC = () => {
  const state = useAdminDashboardState();
  const {
    user,
    handleLogout,
    stats,
    doctors,
    clinics,
    appointments,
    contactMessages,
    loading,
    selectedDoctor,
    selectedClinic,
    activeTab,
    setActiveTab,
    selectedAppointment,
    getPractitionerStatus,
    fetchData,
  } = state;
  return (
    <AdminDashboardContext.Provider value={state}>
<div className="min-h-screen bg-[#f5f5f7] pb-24 md:pb-16 pb-safe">
      {/* Sticky Apple-styled Admin Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-[#e5e5ea] select-none shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity" title="Return to Main Website">
              <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto" />
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea] text-[11px] font-medium">
              <Shield className="w-3 h-3 text-[#86868b]" />
              Root Admin Console
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium text-[#48484a] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-all border border-[#e5e5ea]"
              title="Return to Main Website"
            >
              <Globe className="w-3.5 h-3.5 text-[#86868b]" />
              <span className="hidden sm:inline">Main Website</span>
              <span className="sm:hidden">Home</span>
            </Link>

            <AppleButton
              variant="ghost"
              size="sm"
              onClick={fetchData}
              className="flex items-center gap-1.5 text-xs text-[#48484a]"
              title="Refresh platform statistics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0066cc]' : ''}`} />
              <span className="hidden md:inline">Refresh</span>
            </AppleButton>

            <div className="h-4 w-px bg-[#e5e5ea] hidden sm:block" />

            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[11px] text-[#48484a]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0066cc]" />
              <span className="font-medium truncate max-w-[140px]">{user?.email || 'admin@mediarca.com'}</span>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all border border-rose-200 cursor-pointer active:scale-[0.98]"
              title="Sign Out of Admin Console"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Page Title & Subtitle banner */}
      <div className="bg-white border-b border-[#e5e5ea] px-4 sm:px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-[#1d1d1f] leading-snug">
              Admin Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#86868b]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] font-medium text-[#1d1d1f]">
              <Users className="w-3.5 h-3.5 text-[#0066cc]" />
              {(stats?.totalDoctors || 0) + (stats?.totalClinics || clinics.length)} Registered Providers
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-5 sm:pt-8 space-y-6 sm:space-y-8">
        {loading && !stats ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin mb-3"></div>
            <p className="text-xs text-[#86868b]">Loading records...</p>
          </div>
        ) : (
          <>
            {/* KPI Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <UtilityCard>
                <div>
                  <span className="text-xs font-medium text-[#86868b] block mb-1.5">Patients</span>
                  <h3 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">{stats?.totalPatients || 0}</h3>
                </div>
              </UtilityCard>

              <UtilityCard>
                <div>
                  <span className="text-xs font-medium text-[#86868b] block mb-1.5">Doctors</span>
                  <h3 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">{stats?.totalDoctors || 0}</h3>
                  <p className="text-[11px] text-[#86868b] font-medium mt-1">{stats?.pendingDoctors || 0} pending review</p>
                </div>
              </UtilityCard>

              <UtilityCard>
                <div>
                  <span className="text-xs font-medium text-[#86868b] block mb-1.5">Clinics</span>
                  <h3 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">{stats?.totalClinics || clinics.length}</h3>
                  <p className="text-[11px] text-[#86868b] font-medium mt-1">
                    {clinics.filter((c) => getPractitionerStatus(c) === 'PENDING').length} pending review
                  </p>
                </div>
              </UtilityCard>

              <UtilityCard>
                <div>
                  <span className="text-xs font-medium text-[#86868b] block mb-1.5">Pending Review</span>
                  <h3 className="text-3xl font-semibold text-[#0066cc] tracking-tight">
                    {doctors.filter((d) => getPractitionerStatus(d) === 'PENDING').length +
                      clinics.filter((c) => getPractitionerStatus(c) === 'PENDING').length}
                  </h3>
                  <p className="text-[11px] text-[#86868b] font-medium mt-1">Docs & Clinics</p>
                </div>
              </UtilityCard>

              <UtilityCard>
                <div>
                  <span className="text-xs font-medium text-[#86868b] block mb-1.5">Total Bookings</span>
                  <h3 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">{stats?.totalAppointments || 0}</h3>
                  <p className="text-[11px] text-[#0066cc] font-medium mt-1">{stats?.todayAppointments || 0} today</p>
                </div>
              </UtilityCard>
            </div>

            {/* Verification Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-[#e5e5ea] pb-4 overflow-x-auto scrollbar-none">
              <div className="inline-flex p-1 bg-[#e8e8ed]/70 rounded-full border border-[#e5e5ea] whitespace-nowrap">
                <button
                  onClick={() => setActiveTab('doctors')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                    activeTab === 'doctors'
                      ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  <span>Doctor Verification</span>
                  {doctors.filter((d) => getPractitionerStatus(d) === 'PENDING').length > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#0066cc] text-white text-[10px] font-semibold">
                      {doctors.filter((d) => getPractitionerStatus(d) === 'PENDING').length} pending
                    </span>
                  ) : (
                    <span className="text-[10px] opacity-70">({doctors.length})</span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('clinics')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                    activeTab === 'clinics'
                      ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  <span>Clinic Verification</span>
                  {clinics.filter((c) => getPractitionerStatus(c) === 'PENDING').length > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#0066cc] text-white text-[10px] font-semibold">
                      {clinics.filter((c) => getPractitionerStatus(c) === 'PENDING').length} pending
                    </span>
                  ) : (
                    <span className="text-[10px] opacity-70">({clinics.length})</span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('appointments')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                    activeTab === 'appointments'
                      ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  <span>Platform Bookings ({appointments.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('messages')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                    activeTab === 'messages'
                      ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  <span>Contact Inquiries</span>
                  {contactMessages.filter((m) => m.status === 'NEW').length > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#0066cc] text-white text-[10px] font-semibold">
                      {contactMessages.filter((m) => m.status === 'NEW').length} new
                    </span>
                  ) : (
                    <span className="text-[10px] opacity-70">({contactMessages.length})</span>
                  )}
                </button>
              </div>
            </div>

            {/* Tab 1: Doctor Verification Portal */}
            {activeTab === 'doctors' && (
              <DoctorsTab />
            )}

            {/* Tab 2: Clinic Verification Portal */}
            {activeTab === 'clinics' && (
              <ClinicsTab />
            )}

            {/* Tab 3: Platform Appointments Oversight - Organized by Dates & Clinics */}
            {activeTab === 'appointments' && (
              <AppointmentsTab />
            )}

            {/* Tab 4: Contact Form Messages & Inquiries */}
            {activeTab === 'messages' && (
              <MessagesTab />
            )}
        </>
        )}
      </div>

      {/* Doctor Verification Credentials Inspection Modal */}
      {selectedDoctor && (
        <DoctorDetailsModal />
      )}

      {/* Clinic Facility Inspection & Verification Modal */}
      {selectedClinic && (
        <ClinicDetailsModal />
      )}

      {/* Platform Booking Inspection Modal */}
      {selectedAppointment && (
        <AppointmentDetailsModal />
      )}
    </div>
    </AdminDashboardContext.Provider>
  );
};