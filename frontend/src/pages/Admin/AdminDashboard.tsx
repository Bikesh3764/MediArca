import React from 'react';
import { Stethoscope, Building2, CalendarDays, Mail } from 'lucide-react';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { UtilityCard } from '../../components/ui/UtilityCard';
import { useAdminDashboardState, AdminDashboardContext } from './dashboard/state';
import { DoctorsTab } from './dashboard/DoctorsTab';
import { ClinicsTab } from './dashboard/ClinicsTab';
import { AppointmentsTab } from './dashboard/AppointmentsTab';
import { MessagesTab } from './dashboard/MessagesTab';
import { DoctorDetailsModal } from './dashboard/DoctorDetailsModal';
import { ClinicDetailsModal } from './dashboard/ClinicDetailsModal';
import { AppointmentDetailsModal } from './dashboard/AppointmentDetailsModal';

const TAB_TITLES: Record<string, string> = {
  doctors: 'Doctors',
  clinics: 'Clinics',
  appointments: 'Bookings',
  messages: 'Messages',
};

export const AdminDashboard: React.FC = () => {
  const state = useAdminDashboardState();
  const {
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
  } = state;

  const pendingDoctors = doctors.filter((d) => getPractitionerStatus(d) === 'PENDING').length;
  const pendingClinics = clinics.filter((c) => getPractitionerStatus(c) === 'PENDING').length;
  const newMessages = contactMessages.filter((m) => m.status === 'NEW').length;

  const navItems: DashboardNavItem[] = [
    { id: 'doctors', label: 'Doctors', icon: Stethoscope, active: activeTab === 'doctors', onClick: () => setActiveTab('doctors'), badge: pendingDoctors || undefined },
    { id: 'clinics', label: 'Clinics', icon: Building2, active: activeTab === 'clinics', onClick: () => setActiveTab('clinics'), badge: pendingClinics || undefined },
    { id: 'appointments', label: 'Bookings', icon: CalendarDays, active: activeTab === 'appointments', onClick: () => setActiveTab('appointments') },
    { id: 'messages', label: 'Messages', icon: Mail, active: activeTab === 'messages', onClick: () => setActiveTab('messages'), badge: newMessages || undefined },
  ];

  const kpis = [
    { label: 'Patients', value: stats?.totalPatients || 0 },
    { label: 'Doctors', value: stats?.totalDoctors || 0, note: pendingDoctors ? `${pendingDoctors} to review` : undefined },
    { label: 'Clinics', value: stats?.totalClinics || clinics.length, note: pendingClinics ? `${pendingClinics} to review` : undefined },
    { label: 'Bookings', value: stats?.totalAppointments || appointments.length, note: `${stats?.todayAppointments || 0} today` },
  ];

  return (
    <AdminDashboardContext.Provider value={state}>
      <DashboardLayout portalType="ADMIN" navItems={navItems} title={TAB_TITLES[activeTab] || 'Admin'}>
        {loading && !stats ? (
          <div className="flex flex-col items-center justify-center py-24" role="status">
            <div className="w-7 h-7 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin mb-3" />
            <p className="text-[13px] text-[#86868b]">Loading…</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {kpis.map((k) => (
                <UtilityCard key={k.label}>
                  <span className="text-[13px] text-[#86868b] block mb-1">{k.label}</span>
                  <p className="text-[28px] font-semibold text-[#1d1d1f] tracking-tight leading-none">{k.value}</p>
                  {k.note && <p className="text-[12px] text-[#86868b] mt-1.5">{k.note}</p>}
                </UtilityCard>
              ))}
            </div>

            {activeTab === 'doctors' && <DoctorsTab />}
            {activeTab === 'clinics' && <ClinicsTab />}
            {activeTab === 'appointments' && <AppointmentsTab />}
            {activeTab === 'messages' && <MessagesTab />}
          </div>
        )}

        {selectedDoctor && <DoctorDetailsModal />}
        {selectedClinic && <ClinicDetailsModal />}
        {selectedAppointment && <AppointmentDetailsModal />}
      </DashboardLayout>
    </AdminDashboardContext.Provider>
  );
};
