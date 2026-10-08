import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { AlertCircle, Sparkles, Eye, EyeOff } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { isGoogleConfigured } from '../../config/auth';
import { EmailVerificationModal } from '../../components/auth/EmailVerificationModal';

export interface LoginProps {
  portal?: 'PATIENT' | 'DOCTOR';
}

export const Login: React.FC<LoginProps> = ({ portal }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();

  const isDoctorInitial =
    portal === 'DOCTOR' ||
    location.pathname.startsWith('/doctor/login') ||
    new URLSearchParams(location.search).get('role')?.toUpperCase() === 'DOCTOR';

  const [activeRole, setActiveRole] = useState<'PATIENT' | 'DOCTOR'>(isDoctorInitial ? 'DOCTOR' : 'PATIENT');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verificationPendingEmail, setVerificationPendingEmail] = useState<string | null>(null);

  const getDestination = (role: string) => {
    if (role === 'DOCTOR') return '/doctor/dashboard';
    if (role === 'ADMIN') return '/admin';
    if (role === 'CLINIC') return '/clinic/dashboard';
    if (role === 'RECEPTIONIST') return '/receptionist/dashboard';
    return '/';
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
        const loggedUser = await loginWithGoogle(credentialResponse.credential, activeRole);
        navigate(getTargetDestination(loggedUser.role), { replace: true });
      } catch (err: any) {
        setError(err.message || 'Google sign-in authentication failed');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleSimulatedGoogleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
      const payload = btoa(
        JSON.stringify({
          email: activeRole === 'DOCTOR' ? 'dr.alex.google@example.com' : 'alex.google@example.com',
          name: activeRole === 'DOCTOR' ? 'Dr. Alex Rivera (Google)' : 'Alex Rivera (Google)',
          picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
        })
      );
      const simulatedToken = `${header}.${payload}.signature`;
      const loggedUser = await loginWithGoogle(simulatedToken, activeRole);
      navigate(getTargetDestination(loggedUser.role), { replace: true });
    } catch (err: any) {
      setError(err.message || 'Simulated Google login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center py-10 sm:py-14 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-[440px]">
        {/* Brand Header */}
        <div className="text-center mb-6 space-y-2">
          <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
            <BrandLogo variant="full" size="md" imgClassName="h-8 w-auto mx-auto" />
          </Link>
          <div className="space-y-1">
            <h1 className="text-page-title">
              Sign in to MediArca
            </h1>
            <p className="text-secondary">
              {activeRole === 'DOCTOR'
                ? 'Access your clinical queue and consultation console.'
                : 'Book doctor queue tokens and track your live turn.'}
            </p>
          </div>
        </div>

        {/* Main Auth Surface */}
        <div className="bg-white p-6 sm:p-8 rounded-[24px] border border-[#e5e5ea] shadow-apple-card">
          {/* Segmented Role Switcher */}
          <div className="grid grid-cols-2 h-11 bg-[#f5f5f7] p-1 rounded-full border border-[#e5e5ea] mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveRole('PATIENT');
                setError(null);
              }}
              className={`h-full text-[13px] font-semibold rounded-full transition-all cursor-pointer ${
                activeRole === 'PATIENT'
                  ? 'bg-white text-[#1d1d1f] shadow-2xs'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              Patient
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveRole('DOCTOR');
                setError(null);
              }}
              className={`h-full text-[13px] font-semibold rounded-full transition-all cursor-pointer ${
                activeRole === 'DOCTOR'
                  ? 'bg-white text-[#1d1d1f] shadow-2xs'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              Doctor
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#d70015] text-[13px] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#ff3b30] shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Email / Password Form */}
          <form className="ui-form-stack" onSubmit={handleSubmit}>
            <div>
              <label className="ui-label">
                {activeRole === 'DOCTOR' ? 'Doctor Email' : 'Email Address'}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={activeRole === 'DOCTOR' ? 'dr.name@mediarca.com' : 'name@example.com'}
                className="ui-input"
              />
            </div>

            <div>
              <label className="ui-label">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="ui-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f] p-1 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-1">
              <AppleButton
                variant="primary"
                size="lg"
                type="submit"
                disabled={submitting}
                className="w-full"
              >
                {submitting
                  ? 'Signing In...'
                  : `Sign In as ${activeRole === 'DOCTOR' ? 'Doctor' : 'Patient'}`}
              </AppleButton>
            </div>
          </form>

          {/* Google Sign-In Area */}
          <div className="mt-5">
            <div className="relative my-5 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#f0f0f2]" />
              </div>
              <div className="relative flex justify-center text-[12px]">
                <span className="bg-white px-3 text-[#86868b]">or continue with</span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center">
              {isGoogleConfigured ? (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google Sign-In was cancelled or origin not authorized')}
                  shape="pill"
                  size="large"
                  text="continue_with"
                  width="100%"
                />
              ) : (
                <button
                  type="button"
                  onClick={handleSimulatedGoogleLogin}
                  className="w-full h-11 px-4 rounded-full border border-[#d2d2d7]/80 bg-white hover:bg-[#fafafc] text-[#1d1d1f] text-[13px] font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              )}
            </div>
          </div>

          {/* Subordinate Demo & Staff Portal Links */}
          <div className="mt-6 pt-5 border-t border-[#f0f0f2] space-y-4">
            <div>
              <div className="flex items-center justify-between text-[11px] text-[#86868b] mb-2">
                <span className="inline-flex items-center gap-1 font-medium text-[#6e6e73]">
                  <Sparkles className="w-3 h-3 text-[#0066cc]" />
                  Quick Demo Access
                </span>
                <span>1-Click</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('john.doe@gmail.com', 'patient123', '/patient/appointments')}
                  className="h-9 px-3 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-[12px] font-medium transition-all text-center cursor-pointer active:scale-[0.98]"
                >
                  Demo Patient
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('dr.sarah@mediarca.com', 'doctor123', '/doctor/dashboard')}
                  className="h-9 px-3 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-[12px] font-medium transition-all text-center cursor-pointer active:scale-[0.98]"
                >
                  Demo Doctor
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-[12px] text-[#86868b]">
              <span>Partner Portals:</span>
              <Link to="/clinic/login" className="text-[#48484a] hover:text-[#0066cc] font-medium transition-colors">
                Clinic Portal
              </Link>
              <span className="text-[#d2d2d7]">•</span>
              <Link to="/receptionist/login" className="text-[#48484a] hover:text-[#0066cc] font-medium transition-colors">
                Receptionist Desk
              </Link>
            </div>
          </div>
        </div>

        {/* Secondary Navigation */}
        <p className="mt-5 text-center text-[13px] text-[#6e6e73]">
          Don't have an account?{' '}
          <Link
            to={activeRole === 'DOCTOR' ? '/doctor/signup' : '/patient/signup'}
            className="text-[#0066cc] font-semibold hover:underline"
          >
            Create {activeRole === 'DOCTOR' ? 'Doctor Profile' : 'Patient Account'}
          </Link>
        </p>

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
