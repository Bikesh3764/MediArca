import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { AlertCircle, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { isGoogleConfigured } from '../../config/auth';
import { EmailVerificationModal } from '../../components/auth/EmailVerificationModal';
import { useToast } from '../../context/ToastContext';

export interface LoginProps {
  portal?: 'PATIENT' | 'DOCTOR';
}

export const Login: React.FC<LoginProps> = ({ portal }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();
  const { toast } = useToast();

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
  const [verificationCooldown, setVerificationCooldown] = useState<number | undefined>(undefined);

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
    const rawFrom = (location.state as any)?.from;
    const fromPath = typeof rawFrom === 'string' ? rawFrom : rawFrom?.pathname;
    const search = typeof rawFrom === 'object' && rawFrom?.search ? rawFrom.search : '';
    if (
      fromPath &&
      fromPath.startsWith('/') &&
      !fromPath.startsWith('//') &&
      fromPath !== '/login' &&
      fromPath !== '/signup' &&
      fromPath !== '/doctor/login' &&
      fromPath !== '/patient/login'
    ) {
      return `${fromPath}${search}`;
    }
    return getDestination(role);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedUser = await login({ email: email.trim(), password, role: activeRole });
      navigate(getTargetDestination(loggedUser.role), { replace: true });
    } catch (err: any) {
      if (err.requiresVerification) {
        setVerificationPendingEmail(err.email || email.trim());
        setVerificationCooldown(err.cooldownSeconds);
        setError(null);
        return;
      }
      const msg = err.message || 'Invalid email or password';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string, demoPass: string, redirectPath?: string, demoRole?: 'PATIENT' | 'DOCTOR') => {
    setError(null);
    setSubmitting(true);
    try {
      const loggedUser = await login({ email: demoEmail, password: demoPass, role: demoRole });
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


  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center py-8 sm:py-10 px-4 sm:px-6 pb-24 sm:pb-12 pb-safe">
      <div className="sm:mx-auto sm:w-full sm:max-w-[450px]">
        <div className="bg-white rounded-2xl border border-[#e5e5ea]  p-6 sm:p-7">
          {/* Brand & Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <Link to="/" className="mb-2.5 hover:opacity-90 transition-opacity">
              <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto object-contain mx-auto" />
            </Link>
            <h1 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
              Sign In
            </h1>
          </div>

          {/* Segmented Role Switcher */}
          <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl flex gap-1 select-none mb-5">
            <button
              type="button"
              onClick={() => {
                setActiveRole('PATIENT');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs rounded-lg transition-all duration-150 cursor-pointer text-center ${
                activeRole === 'PATIENT'
                  ? 'bg-white text-[#1d1d1f] font-semibold  border border-black/5'
                  : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
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
              className={`flex-1 py-2 text-xs rounded-lg transition-all duration-150 cursor-pointer text-center ${
                activeRole === 'DOCTOR'
                  ? 'bg-white text-[#1d1d1f] font-semibold  border border-black/5'
                  : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
              }`}
            >
              Doctor
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-danger-soft border border-danger-line text-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign-In */}
          {isGoogleConfigured && (
          <div className="mb-5">
            <div className="flex flex-col items-center justify-center">
              {isGoogleConfigured ? (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google sign-in didn’t work. Try again or use email.')}
                  shape="pill"
                  size="large"
                  text="continue_with"
                  width="100%"
                />
              ) : null}
            </div>

            <div className="relative my-5 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e5e5ea]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-[#86868b]">or</span>
              </div>
            </div>
          </div>
          )}

          {/* Email / Password Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                {activeRole === 'DOCTOR' ? 'Doctor Email' : 'Email Address'}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={activeRole === 'DOCTOR' ? 'dr.name@mediarca.com' : 'name@example.com'}
                className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
              />
            </div>

            <div>
              <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
                <button aria-label={showPassword ? 'Hide password' : 'Show password'}
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 rounded-full text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  `Sign In as ${activeRole === 'DOCTOR' ? 'Doctor' : 'Patient'}`
                )}
              </button>
            </div>
          </form>

          {/* Demo Access */}
          <div className="mt-6 pt-5 border-t border-[#e5e5ea]">
            <div className="text-xs font-normal text-[#1d1d1f] mb-2.5 tracking-tight">
              Try a demo
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('john.doe@gmail.com', 'patient123', '/patient/appointments', 'PATIENT')}
                className="h-9 px-3 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] text-xs font-normal transition-all text-center cursor-pointer active:scale-[0.98]"
              >
                Demo Patient
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('dr.sarah@mediarca.com', 'doctor123', '/doctor/dashboard', 'DOCTOR')}
                className="h-9 px-3 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] text-xs font-normal transition-all text-center cursor-pointer active:scale-[0.98]"
              >
                Demo Doctor
              </button>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#86868b]">
              <span>Staff:</span>
              <Link to="/receptionist/login" className="text-[#0066cc] hover:underline font-normal">
                Receptionist
              </Link>
              <span>•</span>
              <Link to="/clinic/login" className="text-[#0066cc] hover:underline font-normal">
                Clinic
              </Link>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <p className="mt-5 text-center text-xs text-[#86868b]">
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
          role={activeRole}
          initialCooldown={verificationCooldown}
          onSuccess={(verifiedUser) => {
            setVerificationPendingEmail(null);
            setVerificationCooldown(undefined);
            navigate(getTargetDestination(verifiedUser.role), { replace: true });
          }}
          onClose={() => {
            setVerificationPendingEmail(null);
            setVerificationCooldown(undefined);
          }}
        />
      </div>
    </div>
  );
};

export default Login;

