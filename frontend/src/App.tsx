import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GlobalNav } from './components/layout/GlobalNav';
import { Footer } from './components/layout/Footer';
import { MobileTabBar } from './components/layout/MobileTabBar';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ProfileCompletionModal } from './components/auth/ProfileCompletionModal';
import { ScrollToTop } from './components/common/ScrollToTop';

// Route-level code-split pages (FIX-011)
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Auth/Login'));
const Signup = lazy(() => import('./pages/Auth/Signup'));
const DoctorDiscovery = lazy(() => import('./pages/Patient/DoctorDiscovery').then(m => ({ default: m.DoctorDiscovery })));
const BookAppointment = lazy(() => import('./pages/Patient/BookAppointment').then(m => ({ default: m.BookAppointment })));
const MyAppointments = lazy(() => import('./pages/Patient/MyAppointments').then(m => ({ default: m.MyAppointments })));
const PatientProfile = lazy(() => import('./pages/Patient/PatientProfile').then(m => ({ default: m.PatientProfile })));
const DoctorDashboard = lazy(() => import('./pages/Doctor/DoctorDashboard').then(m => ({ default: m.DoctorDashboard })));
const ConsultationView = lazy(() => import('./pages/Doctor/ConsultationView').then(m => ({ default: m.ConsultationView })));
const ManageSchedule = lazy(() => import('./pages/Doctor/ManageSchedule').then(m => ({ default: m.ManageSchedule })));
const DoctorProfile = lazy(() => import('./pages/Doctor/DoctorProfile').then(m => ({ default: m.DoctorProfile })));
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminLogin = lazy(() => import('./pages/Auth/AdminLogin').then(m => ({ default: m.AdminLogin })));
const ClinicAuth = lazy(() => import('./pages/Clinic/ClinicAuth').then(m => ({ default: m.ClinicAuth })));
const ClinicDashboard = lazy(() => import('./pages/Clinic/ClinicDashboard').then(m => ({ default: m.ClinicDashboard })));
const ReceptionistAuth = lazy(() => import('./pages/Receptionist/ReceptionistAuth').then(m => ({ default: m.ReceptionistAuth })));
const ReceptionistDashboard = lazy(() => import('./pages/Receptionist/ReceptionistDashboard').then(m => ({ default: m.ReceptionistDashboard })));
const ClinicCheckIn = lazy(() => import('./pages/Patient/ClinicCheckIn').then(m => ({ default: m.ClinicCheckIn })));

// Company & Informational Pages
const AboutUs = lazy(() => import('./pages/Company/AboutUs').then(m => ({ default: m.AboutUs })));
const ContactUs = lazy(() => import('./pages/Company/ContactUs').then(m => ({ default: m.ContactUs })));
const HowItWorks = lazy(() => import('./pages/Company/HowItWorks').then(m => ({ default: m.HowItWorks })));
const FAQ = lazy(() => import('./pages/Company/FAQ').then(m => ({ default: m.FAQ })));

// Legal & Compliance Pages
const Terms = lazy(() => import('./pages/Legal/Terms').then(m => ({ default: m.Terms })));
const PrivacyPolicy = lazy(() => import('./pages/Legal/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const RefundPolicy = lazy(() => import('./pages/Legal/RefundPolicy').then(m => ({ default: m.RefundPolicy })));

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

const RouteLoadingFallback: React.FC = () => (
  <div className="min-h-[50vh] flex items-center justify-center bg-transparent" role="status" aria-label="Loading view">
    <div className="w-8 h-8 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin"></div>
  </div>
);


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
      <main
        className={`flex-grow animate-in fade-in duration-200 ${!isPortalRoute ? 'pb-20 md:pb-0' : ''}`}
        key={location.pathname}
      >
        <Suspense fallback={<RouteLoadingFallback />}>
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
        </Suspense>
      </main>
      <MobileTabBar />
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
