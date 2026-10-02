import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { AlertCircle, Sparkles } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { isGoogleConfigured } from '../../config/auth';
import { EmailVerificationModal } from '../../components/auth/EmailVerificationModal';

export interface LoginProps {
  portal?: 'PATIENT' | 'DOCTOR';
}

export const Login: React.FC<LoginProps> = ({ portal }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verificationPendingEmail, setVerificationPendingEmail] = useState<string | null>(null);

  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isDoctorPortal =
    portal === 'DOCTOR' ||
    location.pathname.startsWith('/doctor/login') ||
    new URLSearchParams(location.search).get('role')?.toUpperCase() === 'DOCTOR';

  const portalRole = isDoctorPortal ? 'DOCTOR' : 'PATIENT';

  const getDestination = (role: string) => {
    if (role === 'DOCTOR') return '/doctor/dashboard';
    if (role === 'ADMIN') return '/admin';
    if (role === 'CLINIC') return '/clinic/dashboard';
    if (role === 'RECEPTIONIST') return '/receptionist/dashboard';
    return '/patient/doctors';
  };

  const getTargetDestination = (role: string) => {
    const params = new URLSearchParams(location.search);
    const redirectParam = params.get('redirect');
    if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
      return redirectParam;
    }
    const fromPath = (location.state as any)?.from?.pathname;
    const search = (location.state as any)?.from?.search || '';
    if (fromPath && fromPath !== '/login' && fromPath !== '/signup' && fromPath !== '/doctor/login' && fromPath !== '/patient/login') {
      return `${fromPath}${search}`;
    }
    return getDestination(role);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedUser = await login({ email: email.trim(), password });
      navigate(getTargetDestination(loggedUser.role), { replace: true });
    } catch (err: any) {
      if (err.requiresVerification) {
        setVerificationPendingEmail(err.email || email.trim());
        setError(null);
        return;
      }
      setError(err.message || 'Invalid email or password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string, demoPass: string, redirectPath?: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const loggedUser = await login({ email: demoEmail, password: demoPass });
      navigate(redirectPath || getTargetDestination(loggedUser.role), { replace: true });
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (credentialResponse.credential) {
      setError(null);
      setSubmitting(true);
      try {
        const loggedUser = await loginWithGoogle(credentialResponse.credential, portalRole);
        navigate(getTargetDestination(loggedUser.role), { replace: true });
      } catch (err: any) {
        setError(err.message || 'Google sign-in authentication failed');
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Demo Google Sign-in simulation
  const handleSimulatedGoogleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
      const payload = btoa(
        JSON.stringify({
          email: isDoctorPortal ? 'dr.alex.google@example.com' : 'alex.google@example.com',
          name: isDoctorPortal ? 'Dr. Alex Rivera (Google)' : 'Alex Rivera (Google)',
          picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
        })
      );
      const simulatedToken = `${header}.${payload}.signature`;
      const loggedUser = await loginWithGoogle(simulatedToken, portalRole);
      navigate(getTargetDestination(loggedUser.role), { replace: true });
    } catch (err: any) {
      setError(err.message || 'Simulated Google login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-block mb-3 hover:opacity-90 transition-opacity">
          <BrandLogo variant="full" size="lg" imgClassName="h-9 w-auto mx-auto" />
        </Link>

        <h2 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">
          {isDoctorPortal ? 'Doctor Portal Sign In' : 'Patient Portal Sign In'}
        </h2>
        <p className="mt-2 text-sm text-[#86868b]">
          {isDoctorPortal ? 'Sign in to manage your appointments, live queue, and schedule.' : 'Sign in to access your appointments and live queue passes.'}
        </p>
        <p className="mt-1 text-xs text-[#86868b]">
          Or{' '}
          <Link
            to={{
              pathname: isDoctorPortal ? '/doctor/signup' : '/patient/signup',
              search: location.search,
            }}
            state={location.state}
            className="text-[#0088e8] font-semibold hover:underline"
          >
            {isDoctorPortal ? 'register a new practitioner practice' : 'create a new MediArca patient account'}
          </Link>
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Instant Demo Accounts Banner */}
        <div className="bg-white border border-[#e5e5ea] rounded-[22px] p-4 mb-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1d1d1f]">
              <Sparkles className="w-3.5 h-3.5 text-[#0088e8]" />
              <span>Instant Demo One-Click Login:</span>
            </div>
            {isDoctorPortal && (
              <span className="text-[10px] font-semibold text-[#0088e8] bg-[#0088e8]/10 px-2 py-0.5 rounded-full">
                Doctor Mode
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('john.doe@gmail.com', 'patient123', '/patient/appointments')}
              className={`py-2 px-2 rounded-full border text-[11px] font-semibold transition-all text-center cursor-pointer active:scale-[0.98] shadow-2xs truncate ${
                !isDoctorPortal
                  ? 'bg-[#0088e8] text-white border-[#0088e8]'
                  : 'bg-[#f5f5f7] hover:bg-[#0088e8]/10 text-[#0088e8] border-[#e5e5ea]'
              }`}
            >
              Patient
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('dr.sarah@mediarca.com', 'doctor123', '/doctor/dashboard')}
              className={`py-2 px-2 rounded-full border text-[11px] font-semibold transition-all text-center cursor-pointer active:scale-[0.98] shadow-2xs truncate ${
                isDoctorPortal
                  ? 'bg-[#0088e8] text-white border-[#0088e8]'
                  : 'bg-[#f5f5f7] hover:bg-[#0088e8]/10 text-[#0088e8] border-[#e5e5ea]'
              }`}
            >
              Doctor
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('receptionist@mediarca.com', 'receptionist123', '/receptionist/dashboard')}
              className="py-2 px-2 rounded-full bg-[#f5f5f7] hover:bg-[#0088e8]/10 text-[#0088e8] border border-[#e5e5ea] text-[11px] font-semibold transition-all text-center cursor-pointer active:scale-[0.98] shadow-2xs truncate"
            >
              Receptionist
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('clinic@mediarca.com', 'clinic123', '/clinic/dashboard')}
              className="py-2 px-2 rounded-full bg-[#f5f5f7] hover:bg-[#0088e8]/10 text-[#0088e8] border border-[#e5e5ea] text-[11px] font-semibold transition-all text-center cursor-pointer active:scale-[0.98] shadow-2xs truncate"
            >
              Clinic
            </button>
          </div>
        </div>

        {/* Regular Login Form */}
        <div className="bg-white py-8 px-6 sm:px-10 rounded-[24px] border border-[#e5e5ea] shadow-xs">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign-In Container */}
          <div className="mb-6">
            <div className="flex flex-col items-center justify-center gap-2.5">
              {isGoogleConfigured ? (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google Sign-In was cancelled or origin not authorized')}
                  shape="pill"
                  size="large"
                  text="continue_with"
                  width="320"
                />
              ) : (
                <div className="w-full space-y-2">
                  <button
                    type="button"
                    onClick={handleSimulatedGoogleLogin}
                    className="w-full h-11 px-4 rounded-full border border-[#e5e5ea] bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] text-sm font-medium transition-all shadow-2xs active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>
                      {isDoctorPortal
                        ? 'Continue with Google (Doctor Sign-In)'
                        : 'Continue with Google (Patient Sign-In)'}
                    </span>
                  </button>
                  <p className="text-[11px] text-center text-[#86868b]">
                    {isDoctorPortal
                      ? 'Signs in or registers your practitioner profile directly.'
                      : 'Instant access with your verified Google account.'}
                  </p>
                </div>
              )}
            </div>

            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e5e5ea]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-[#86868b]">or sign in with email</span>
              </div>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                {isDoctorPortal ? 'Doctor Professional Email' : 'Email Address'}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isDoctorPortal ? 'dr.name@domain.com' : 'name@example.com'}
                className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[15px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[15px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20 transition-all"
              />
            </div>

            <div className="pt-2">
              <AppleButton
                variant="primary"
                size="md"
                type="submit"
                disabled={submitting}
                className="w-full"
              >
                {submitting ? 'Authenticating...' : isDoctorPortal ? 'Sign In to Doctor Console' : 'Sign In as Patient'}
              </AppleButton>
            </div>
          </form>
        </div>

        {/* Email Verification Modal */}
        <EmailVerificationModal
          isOpen={Boolean(verificationPendingEmail)}
          email={verificationPendingEmail || ''}
          onSuccess={(verifiedUser) => {
            setVerificationPendingEmail(null);
            navigate(getTargetDestination(verifiedUser.role), { replace: true });
          }}
          onClose={() => setVerificationPendingEmail(null)}
        />
      </div>
    </div>
  );
};

export default Login;
