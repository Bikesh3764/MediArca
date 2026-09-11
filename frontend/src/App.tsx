import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
import { DoctorDashboard } from './pages/Doctor/DoctorDashboard';
import { ConsultationView } from './pages/Doctor/ConsultationView';
import { ManageSchedule } from './pages/Doctor/ManageSchedule';
import { AdminDashboard } from './pages/Admin/AdminDashboard';

// Global Stealth Shortcut Listener (Ctrl + Shift + A)
const AdminShortcutHandler: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        if (user?.role === 'ADMIN') {
          navigate('/admin');
        } else {
          navigate('/login?admin=stealth');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, user]);

  return null;
};

// Protected Route Helpers
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: Array<'PATIENT' | 'DOCTOR' | 'ADMIN'>;
}> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <div className="w-8 h-8 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AdminShortcutHandler />
          <div className="flex flex-col min-h-screen">
          <GlobalNav />
          <main className="flex-grow">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/doctors" element={<DoctorDiscovery />} />
              <Route path="/doctor/:id" element={<DoctorDetail />} />

              {/* Patient Routes */}
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

              {/* Admin Routes */}
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
          <Footer />
        </div>
      </Router>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
