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
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center py-8 sm:py-10 px-3 sm:px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-[460px]">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-block hover:opacity-90 transition-opacity mb-3">
            <BrandLogo variant="full" size="md" imgClassName="h-8 w-auto mx-auto" />
          </Link>
          <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">
            Create Account
          </h1>
          <p className="text-xs text-[#86868b] mt-1">
            Join MediArca Clinical Platform
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white py-6 sm:py-7 px-4 sm:px-8 rounded-[20px] sm:rounded-[24px] border border-[#e5e5ea] shadow-xs">
          {/* Segmented Role Switcher */}
          <div className="flex bg-[#f5f5f7] p-1 rounded-full border border-[#e5e5ea] mb-6">
            <button
              type="button"
              onClick={() => {
                setRole('PATIENT');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                role === 'PATIENT'
                  ? 'bg-white text-[#1d1d1f] shadow-xs'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
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
              className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                role === 'DOCTOR'
                  ? 'bg-white text-[#1d1d1f] shadow-xs'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              Doctor
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign-In */}
          <div className="mb-5">
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
                  className="w-full h-11 px-4 rounded-full border border-[#e5e5ea] bg-white hover:bg-[#fbfbfd] text-[#1d1d1f] text-xs font-medium transition-all shadow-2xs active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Sign up with Google</span>
                </button>
              )}
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

          <form className="space-y-3.5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={role === 'DOCTOR' ? 'Dr. First Last' : 'First Last'}
                className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-sm text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20 bg-[#fbfbfd] focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-sm text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20 bg-[#fbfbfd] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Mobile Number
                </label>
                <div className="flex items-center w-full h-11 rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] focus-within:bg-white focus-within:border-[#0088e8] focus-within:ring-2 focus-within:ring-[#0088e8]/20 transition-all overflow-hidden">
                  <div className="h-full px-3.5 bg-[#f5f5f7] border-r border-[#e5e5ea] flex items-center justify-center select-none text-[13px] font-semibold text-[#1d1d1f]">
                    +91
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    maxLength={10}
                    value={sanitizeIndianPhone(phone)}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setPhone(digits ? `+91 ${digits}` : '');
                    }}
                    placeholder="98765 43210"
                    className="flex-1 h-full px-3.5 bg-transparent text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-[#e5e5ea] text-sm text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20 bg-[#fbfbfd] focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Doctor Specific Fields */}
            {role === 'DOCTOR' && (
              <div className="space-y-3 pt-2 border-t border-[#f0f0f2]">
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                      Qualifications
                    </label>
                    <input
                      type="text"
                      required
                      value={qualifications}
                      onChange={(e) => setQualifications(e.target.value)}
                      placeholder="e.g. MBBS, MD"
                      className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-sm text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20 bg-[#fbfbfd] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                      Experience (Years)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      placeholder="5"
                      className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-sm text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20 bg-[#fbfbfd] focus:bg-white"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-[#86868b] leading-relaxed">
                  Doctor profiles require administrative license verification before appearing in search.
                </p>
              </div>
            )}

            <div className="pt-2">
              <AppleButton
                variant="primary"
                size="md"
                type="submit"
                disabled={submitting}
                className="w-full"
              >
                {submitting ? 'Creating Account...' : `Create ${role === 'DOCTOR' ? 'Doctor Profile' : 'Patient Account'}`}
              </AppleButton>
            </div>
          </form>
        </div>

        {/* Footer Navigation */}
        <p className="mt-4 text-center text-xs text-[#86868b]">
          Already registered?{' '}
          <Link
            to={role === 'DOCTOR' ? '/doctor/login' : '/patient/login'}
            className="text-[#0088e8] font-semibold hover:underline"
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
