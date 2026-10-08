import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { isGoogleConfigured } from '../../config/auth';
import { SearchableSpecialtySelect } from '../../components/ui/SearchableSpecialtySelect';
import { DEFAULT_PHONE_PREFIX } from '../../services/api';
import { sanitizeIndianPhone, formatIndianPhone, isValidIndianPhone } from '../../utils/phoneUtils';
import { EmailVerificationModal } from '../../components/auth/EmailVerificationModal';

export interface SignupProps {
  initialRole?: 'PATIENT' | 'DOCTOR';
}

export const Signup: React.FC<SignupProps> = ({ initialRole }) => {
  const location = useLocation();
  const isDoctorRoute =
    initialRole === 'DOCTOR' ||
    location.pathname.startsWith('/doctor/signup') ||
    new URLSearchParams(location.search).get('role')?.toUpperCase() === 'DOCTOR';

  const [role, setRole] = useState<'PATIENT' | 'DOCTOR'>(isDoctorRoute ? 'DOCTOR' : 'PATIENT');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState(DEFAULT_PHONE_PREFIX);

  // Doctor specific fields
  const [specialty, setSpecialty] = useState('General Medicine');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [experienceYears, setExperienceYears] = useState('5');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verificationPendingEmail, setVerificationPendingEmail] = useState<string | null>(null);

  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const getDestination = (targetRole: string) => {
    if (targetRole === 'DOCTOR') return '/doctor/dashboard';
    if (targetRole === 'ADMIN') return '/admin';
    if (targetRole === 'CLINIC') return '/clinic/dashboard';
    if (targetRole === 'RECEPTIONIST') return '/receptionist/dashboard';
    return '/';
  };

  const getTargetDestination = (targetRole: string) => {
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
    return getDestination(targetRole);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidIndianPhone(phone)) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (password.trim().length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const payload: any = {
        fullName,
        email,
        password,
        phone: formatIndianPhone(phone),
        role,
      };

      if (role === 'DOCTOR') {
        const finalSpecialty = specialty === 'Other' ? (customSpecialty.trim() || 'General Medicine') : specialty;
        payload.specialty = finalSpecialty;
        payload.qualifications = qualifications.trim() || 'MBBS, MD';
        payload.experienceYears = Number(experienceYears) || 1;
        payload.consultationFee = 0; // Configured later upon joining a clinic
        payload.checkingStartTime = '09:00';
        payload.checkingEndTime = '17:00';
      }

      const res = await register(payload);
      if (res.requiresVerification && res.email) {
        setVerificationPendingEmail(res.email);
        return;
      }
      if (res.user) {
        navigate(getTargetDestination(res.user.role), { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (credentialResponse.credential) {
      setError(null);
      setSubmitting(true);
      try {
        const loggedUser = await loginWithGoogle(credentialResponse.credential, role);
        navigate(getTargetDestination(loggedUser.role), { replace: true });
      } catch (err: any) {
        setError(err.message || 'Google sign-up authentication failed');
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
          email: role === 'DOCTOR' ? 'dr.alex.google@example.com' : 'alex.google@example.com',
          name: role === 'DOCTOR' ? 'Dr. Alex Rivera (Google)' : 'Alex Rivera (Google)',
          picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
        })
      );
      const simulatedToken = `${header}.${payload}.signature`;
      const loggedUser = await loginWithGoogle(simulatedToken, role);
      navigate(getTargetDestination(loggedUser.role), { replace: true });
    } catch (err: any) {
      setError(err.message || 'Simulated Google sign-up failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center py-10 sm:py-14 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-[460px]">
        {/* Brand Header */}
        <div className="text-center mb-6 space-y-2">
          <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
            <BrandLogo variant="full" size="md" imgClassName="h-8 w-auto mx-auto" />
          </Link>
          <div className="space-y-1">
            <h1 className="text-page-title">
              Create your account
            </h1>
            <p className="text-secondary">
              {role === 'DOCTOR'
                ? 'Register your clinical profile to manage outpatient queues.'
                : 'Sign up to book free queue tokens at verified clinics.'}
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
                setRole('PATIENT');
                setError(null);
              }}
              className={`h-full text-[13px] font-semibold rounded-full transition-all cursor-pointer ${
                role === 'PATIENT'
                  ? 'bg-white text-[#1d1d1f] shadow-2xs'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              Patient
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('DOCTOR');
                setError(null);
              }}
              className={`h-full text-[13px] font-semibold rounded-full transition-all cursor-pointer ${
                role === 'DOCTOR'
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

          <form className="ui-form-stack" onSubmit={handleSubmit}>
            {/* Group 1: Personal & Contact Information */}
            <div>
              <label className="ui-label">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={role === 'DOCTOR' ? 'Dr. First Last' : 'Enter your full name'}
                className="ui-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="ui-label">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="ui-input"
                />
              </div>

              <div>
                <label className="ui-label">
                  Mobile Number
                </label>
                <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7]/80 bg-white hover:border-[#86868b]/60 focus-within:border-[#0066cc] focus-within:ring-[3px] focus-within:ring-[#0066cc]/15 transition-all duration-150 overflow-hidden">
                  <div className="h-full px-3 bg-[#f5f5f7] border-r border-[#e5e5ea] flex items-center justify-center select-none text-[13px] font-medium text-[#48484a]">
                    +91
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    maxLength={10}
                    value={sanitizeIndianPhone(phone)}
                    onChange={(e) => {
                      const digits = sanitizeIndianPhone(e.target.value);
                      setPhone(digits ? `+91 ${digits}` : '');
                    }}
                    placeholder="98765 43210"
                    className="flex-1 h-full px-3.5 bg-transparent text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="ui-label">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
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

            {/* Group 2: Doctor Specific Credentials */}
            {role === 'DOCTOR' && (
              <div className="space-y-4 pt-4 mt-2 border-t border-[#f0f0f2]">
                <div>
                  <label className="ui-label">
                    Specialty
                  </label>
                  <SearchableSpecialtySelect
                    value={specialty}
                    onChange={setSpecialty}
                    customValue={customSpecialty}
                    onCustomChange={setCustomSpecialty}
                    allowOther={true}
                    placeholder="Select or search specialty..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="ui-label">
                      Qualifications
                    </label>
                    <input
                      type="text"
                      required
                      value={qualifications}
                      onChange={(e) => setQualifications(e.target.value)}
                      placeholder="e.g. MBBS, MD"
                      className="ui-input"
                    />
                  </div>

                  <div>
                    <label className="ui-label">
                      Experience (Years)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      placeholder="5"
                      className="ui-input"
                    />
                  </div>
                </div>

                <p className="text-[12px] text-[#86868b] leading-relaxed">
                  Doctor profiles require administrative license verification before appearing in public search.
                </p>
              </div>
            )}

            <div className="pt-1">
              <AppleButton
                variant="primary"
                size="lg"
                type="submit"
                disabled={submitting}
                className="w-full"
              >
                {submitting
                  ? 'Creating Account...'
                  : `Create ${role === 'DOCTOR' ? 'Doctor Profile' : 'Patient Account'}`}
              </AppleButton>
            </div>
          </form>

          {/* Google Sign-Up Area */}
          <div className="mt-5">
            <div className="relative my-5 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#f0f0f2]" />
              </div>
              <div className="relative flex justify-center text-[12px]">
                <span className="bg-white px-3 text-[#86868b]">or sign up with</span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center">
              {isGoogleConfigured ? (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google sign-up failed')}
                  shape="pill"
                  size="large"
                  text="signup_with"
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
                  <span>Sign up with Google</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <p className="mt-5 text-center text-[13px] text-[#6e6e73]">
          Already registered?{' '}
          <Link
            to={role === 'DOCTOR' ? '/doctor/login' : '/patient/login'}
            className="text-[#0066cc] font-semibold hover:underline"
          >
            Sign in to {role === 'DOCTOR' ? 'Doctor Console' : 'Patient Account'}
          </Link>
        </p>

        {/* Post-Registration Email Verification Modal */}
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

export default Signup;
