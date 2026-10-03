import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GlobalNav } from './components/layout/GlobalNav';
import { Footer } from './components/layout/Footer';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

// Pages
import { Home } from './pages/Home';
import { Login } from './pages/Auth/Login';
import { Signup } from './pages/Auth/Signup';
import { DoctorDiscovery } from './pages/Patient/DoctorDiscovery';
import { BookAppointment } from './pages/Patient/BookAppointment';
import { MyAppointments } from './pages/Patient/MyAppointments';
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
import { ClinicCheckIn } from './pages/Patient/ClinicCheckIn';
import { ProfileCompletionModal } from './components/auth/ProfileCompletionModal';

// Company & Informational Pages
import { AboutUs } from './pages/Company/AboutUs';
import { ContactUs } from './pages/Company/ContactUs';
import { HowItWorks } from './pages/Company/HowItWorks';
import { FAQ } from './pages/Company/FAQ';

// Legal & Compliance Pages
import { Terms } from './pages/Legal/Terms';
import { PrivacyPolicy } from './pages/Legal/PrivacyPolicy';
import { RefundPolicy } from './pages/Legal/RefundPolicy';

// Protected Route Helpers
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: Array<'PATIENT' | 'DOCTOR' | 'ADMIN' | 'CLINIC' | 'RECEPTIONIST'>;
}> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <div className="w-8 h-8 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin"></div>
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
    if (allowedRoles && allowedRoles.includes('DOCTOR') && !allowedRoles.includes('PATIENT')) {
      return <Navigate to="/doctor/login" state={{ from: location }} replace />;
    }
    if (allowedRoles && allowedRoles.includes('PATIENT') && !allowedRoles.includes('DOCTOR')) {
      return <Navigate to="/patient/login" state={{ from: location }} replace />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const DoctorRouteRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/book/${id || ''}`} replace />;
};

const ScrollToTop: React.FC = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, search]);

  return null;
};

function AppShell() {
  const location = useLocation();

  // Only enterprise staff desks and administrative backends use dedicated sidebar layouts.
  // Patient experience is fully integrated into the main website under GlobalNav.
  const isPortalRoute =
    location.pathname.startsWith('/doctor/dashboard') ||
    location.pathname.startsWith('/doctor/consultation') ||
    location.pathname.startsWith('/doctor/schedule') ||
    location.pathname.startsWith('/doctor/profile') ||
    location.pathname.startsWith('/clinic/dashboard') ||
    location.pathname.startsWith('/receptionist/dashboard') ||
    location.pathname === '/clinic-checkin' ||
    location.pathname === '/admin' ||
    location.pathname === '/admin-login';

  return (
    <div className="flex flex-col min-h-screen">
      {!isPortalRoute && <GlobalNav />}
      <ProfileCompletionModal />
      <main className="flex-grow">
        <Routes>
          {/* Public & Dedicated Portals */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/patient/login" element={<Login portal="PATIENT" />} />
          <Route path="/patient/signup" element={<Signup initialRole="PATIENT" />} />
          <Route path="/doctor/login" element={<Login portal="DOCTOR" />} />
          <Route path="/doctor/signup" element={<Signup initialRole="DOCTOR" />} />
          <Route path="/clinic-checkin" element={<ClinicCheckIn />} />

          {/* Company & Informational Pages */}
          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/faq" element={<FAQ />} />

          {/* Legal & Compliance Pages */}
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/refunds" element={<Navigate to="/refund-policy" replace />} />
          <Route path="/cancellation-policy" element={<Navigate to="/refund-policy" replace />} />

          {/* Directory & Booking */}
          <Route path="/doctors" element={<DoctorDiscovery />} />
          <Route path="/patient/doctors" element={<Navigate to="/doctors" replace />} />
          <Route path="/doctor/:id" element={<DoctorRouteRedirect />} />
          <Route path="/patient/doctor/:id" element={<DoctorRouteRedirect />} />
          <Route
            path="/book/:id"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <BookAppointment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/book/:id"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <BookAppointment />
              </ProtectedRoute>
            }
          />

          {/* Patient Dedicated Pages */}
          <Route
            path="/patient/appointments"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <MyAppointments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/appointments"
            element={<Navigate to="/patient/appointments" replace />}
          />
          <Route
            path="/patient/profile"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <PatientProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={<Navigate to="/patient/profile" replace />}
          />
          <Route
            path="/patient/records"
            element={<Navigate to="/patient/appointments" replace />}
          />
          <Route
            path="/records"
            element={<Navigate to="/patient/appointments" replace />}
          />
          <Route
            path="/patient/vault"
            element={<Navigate to="/patient/appointments" replace />}
          />
          <Route
            path="/vault"
            element={<Navigate to="/patient/appointments" replace />}
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
          <Route path="/admin/login" element={<AdminLogin />} />
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
          <ScrollToTop />
          <AppShell />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
