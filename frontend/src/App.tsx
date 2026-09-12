import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GlobalNav } from './components/layout/GlobalNav';
import { Footer } from './components/layout/Footer';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

// Pages
import { Home } from './pages/Home';
import { Login } from './pages/Auth/Login';
import { Signup } from './pages/Auth/Signup';
import { DoctorDiscovery } from './pages/Patient/DoctorDiscovery';
import { DoctorDetail } from './pages/Patient/DoctorDetail';
import { BookAppointment } from './pages/Patient/BookAppointment';
import { MyAppointments } from './pages/Patient/MyAppointments';
import { MedicalRecords } from './pages/Patient/MedicalRecords';
import { PatientProfile } from './pages/Patient/PatientProfile';
import { DoctorDashboard } from './pages/Doctor/DoctorDashboard';
import { ConsultationView } from './pages/Doctor/ConsultationView';
import { ManageSchedule } from './pages/Doctor/ManageSchedule';
import { DoctorProfile } from './pages/Doctor/DoctorProfile';
import { AdminDashboard } from './pages/Admin/AdminDashboard';
import { AdminLogin } from './pages/Auth/AdminLogin';
import { ClinicAuth } from './pages/Clinic/ClinicAuth';
import { ClinicDashboard } from './pages/Clinic/ClinicDashboard';
import { ReceptionistAuth } from './pages/Receptionist/ReceptionistAuth';
import { ReceptionistDashboard } from './pages/Receptionist/ReceptionistDashboard';

// Protected Route Helpers
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: Array<'PATIENT' | 'DOCTOR' | 'ADMIN' | 'CLINIC' | 'RECEPTIONIST'>;
}> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <div className="w-8 h-8 rounded-full border-2 border-[#0088e8] border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    if (allowedRoles && allowedRoles.length === 1 && allowedRoles[0] === 'ADMIN') {
      return <Navigate to="/admin-login" replace />;
    }
    if (allowedRoles && allowedRoles.includes('CLINIC')) {
      return <Navigate to="/clinic/login" replace />;
    }
    if (allowedRoles && allowedRoles.includes('RECEPTIONIST')) {
      return <Navigate to="/receptionist/login" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function AppShell() {
  const location = useLocation();
  const { user } = useAuth();

  const isPortalRoute =
    location.pathname.startsWith('/doctor/dashboard') ||
    location.pathname.startsWith('/doctor/consultation') ||
    location.pathname.startsWith('/doctor/schedule') ||
    location.pathname.startsWith('/doctor/profile') ||
    location.pathname.startsWith('/clinic/dashboard') ||
    location.pathname.startsWith('/receptionist/dashboard') ||
    location.pathname.startsWith('/patient/') ||
    (location.pathname === '/doctors' && user?.role === 'PATIENT') ||
    (location.pathname.startsWith('/doctor/') && user?.role === 'PATIENT') ||
    (location.pathname.startsWith('/book/') && user?.role === 'PATIENT') ||
    location.pathname === '/admin';

  return (
    <div className="flex flex-col min-h-screen">
      {!isPortalRoute && <GlobalNav />}
      <main className="flex-grow">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/doctors"
            element={
              user?.role === 'PATIENT' ? (
                <Navigate to="/patient/doctors" replace />
              ) : (
                <DoctorDiscovery />
              )
            }
          />
          <Route path="/doctor/:id" element={<DoctorDetail />} />

          {/* Patient Routes */}
          <Route
            path="/patient/doctors"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <DoctorDiscovery isPortalView={true} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/book/:id"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <BookAppointment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/appointments"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <MyAppointments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/records"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <MedicalRecords />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/profile"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <PatientProfile />
              </ProtectedRoute>
            }
          />

          {/* Doctor Routes */}
          <Route
            path="/doctor/dashboard"
            element={
              <ProtectedRoute allowedRoles={['DOCTOR']}>
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/consultation/:id"
            element={
              <ProtectedRoute allowedRoles={['DOCTOR']}>
                <ConsultationView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/schedule"
            element={
              <ProtectedRoute allowedRoles={['DOCTOR']}>
                <ManageSchedule />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/profile"
            element={
              <ProtectedRoute allowedRoles={['DOCTOR']}>
                <DoctorProfile />
              </ProtectedRoute>
            }
          />

          {/* Clinic Partner Routes */}
          <Route path="/clinic/login" element={<ClinicAuth />} />
          <Route path="/clinic/signup" element={<ClinicAuth />} />
          <Route
            path="/clinic/dashboard"
            element={
              <ProtectedRoute allowedRoles={['CLINIC']}>
                <ClinicDashboard />
              </ProtectedRoute>
            }
          />

          {/* Receptionist Portal Routes */}
          <Route path="/receptionist/login" element={<ReceptionistAuth />} />
          <Route path="/receptionist/signup" element={<Navigate to="/receptionist/login" replace />} />
          <Route
            path="/receptionist/dashboard"
            element={
              <ProtectedRoute allowedRoles={['RECEPTIONIST']}>
                <ReceptionistDashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isPortalRoute && <Footer />}
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppShell />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
