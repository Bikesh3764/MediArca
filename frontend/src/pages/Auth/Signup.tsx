import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { AlertCircle, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { isGoogleConfigured } from '../../config/auth';
import { SearchableSpecialtySelect } from '../../components/ui/SearchableSpecialtySelect';
import { formatIndianPhone, isValidIndianPhone } from '../../utils/phoneUtils';
import { EmailVerificationModal } from '../../components/auth/EmailVerificationModal';
import { useToast } from '../../context/ToastContext';

export interface SignupProps {
  initialRole?: 'PATIENT' | 'DOCTOR';
}

export const Signup: React.FC<SignupProps> = ({ initialRole }) => {
  const { toast } = useToast();
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
  const [phone, setPhone] = useState('');

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
      const cleanEmail = email.trim().toLowerCase();
      const cleanFullName = fullName.trim();
      const payload: any = {
        fullName: cleanFullName,
        email: cleanEmail,
        password,
        phone: formatIndianPhone(phone),
        role,
      };

      if (role === 'DOCTOR') {
        const finalSpecialty = specialty === 'Other' ? (customSpecialty.trim() || 'General Medicine') : specialty;
        payload.specialty = finalSpecialty;
        payload.qualifications = qualifications.trim() || 'MBBS, MD';
        payload.experienceYears = Number(experienceYears) || 1;
        payload.consultationFee = 0;
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
      const msg = err.message || 'Registration failed';
      setError(msg);
      toast.error(msg);
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
              Create Account
            </h1>
          </div>

          {/* Segmented Role Switcher */}
          <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl flex gap-1 select-none mb-5">
            <button
              type="button"
              onClick={() => {
                setRole('PATIENT');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs rounded-lg transition-all duration-150 cursor-pointer text-center ${
                role === 'PATIENT'
                  ? 'bg-white text-[#1d1d1f] font-semibold  border border-black/5'
                  : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
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
              className={`flex-1 py-2 text-xs rounded-lg transition-all duration-150 cursor-pointer text-center ${
                role === 'DOCTOR'
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
                  onError={() => setError('Google sign-up failed')}
                  shape="pill"
                  size="large"
                  text="signup_with"
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

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={role === 'DOCTOR' ? 'Dr. First Last' : 'Your full legal name'}
                className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
              />
            </div>

            <div>
              <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
              />
            </div>

            <div>
              <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                Mobile Number
              </label>
              <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white  focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all duration-150 overflow-hidden">
                <div className="h-full px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] flex items-center justify-center select-none text-base sm:text-xs font-semibold text-[#1d1d1f]">
                  +91
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  required
                  maxLength={10}
                  value={phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setPhone(digits);
                  }}
                  placeholder="98765 43210"
                  className="flex-1 h-full px-3.5 bg-transparent text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
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

            {/* Doctor Specific Fields */}
            {role === 'DOCTOR' && (
              <>
                <div>
                  <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                    Medical Qualifications
                  </label>
                  <input
                    type="text"
                    required
                    value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                    placeholder="e.g. MBBS, MD"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                  />
                </div>

                <div>
                  <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                    Medical Specialty
                  </label>
                  <SearchableSpecialtySelect
                    value={specialty}
                    onChange={setSpecialty}
                    customValue={customSpecialty}
                    onCustomChange={setCustomSpecialty}
                    allowOther={true}
                    placeholder="Select specialty..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                    Years of Clinical Experience
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={60}
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                  />
                </div>
              </>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  `Create ${role === 'DOCTOR' ? 'Doctor Profile' : 'Patient Account'}`
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer Navigation */}
        <p className="mt-5 text-center text-xs text-[#86868b]">
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
          role={role}
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

