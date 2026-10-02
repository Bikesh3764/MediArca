import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { AlertCircle, UserCheck, Stethoscope, Building2, ArrowRight } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { isGoogleConfigured } from '../../config/auth';
import { SearchableSpecialtySelect } from '../../components/ui/SearchableSpecialtySelect';
import { DEFAULT_PHONE_PREFIX } from '../../services/api';
import { sanitizeIndianPhone, formatIndianPhone, isValidIndianPhone } from '../../utils/phoneUtils';

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
  const [phone, setPhone] = useState(DEFAULT_PHONE_PREFIX);

  // Doctor specific fields
  const [specialty, setSpecialty] = useState('General Medicine');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [experienceYears, setExperienceYears] = useState('5');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const getDestination = (targetRole: string) => {
    if (targetRole === 'DOCTOR') return '/doctor/dashboard';
    if (targetRole === 'ADMIN') return '/admin';
    if (targetRole === 'CLINIC') return '/clinic/dashboard';
    if (targetRole === 'RECEPTIONIST') return '/receptionist/dashboard';
    return '/patient/doctors';
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
    const rawDigits = sanitizeIndianPhone(phone);
    if (rawDigits.length > 0 && !isValidIndianPhone(phone)) {
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
        phone: isValidIndianPhone(phone) ? formatIndianPhone(phone) : undefined,
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

      const registered = await register(payload);
      navigate(getTargetDestination(registered.role), { replace: true });
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
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-block mb-3 hover:opacity-90 transition-opacity">
          <BrandLogo variant="full" size="lg" imgClassName="h-9 w-auto mx-auto" />
        </Link>

        {/* Portal Identifier Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0088e8]/10 text-[#0088e8] text-xs font-semibold mb-3 border border-[#0088e8]/20 shadow-2xs">
          {role === 'DOCTOR' ? (
            <>
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Doctor Practice Portal</span>
            </>
          ) : (
            <>
              <UserCheck className="w-3.5 h-3.5" />
              <span>Patient Healthcare Portal</span>
            </>
          )}
        </div>

        <h2 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">
          {role === 'DOCTOR' ? 'Doctor Practice Registration' : 'Patient Registration'}
        </h2>
        <p className="mt-2 text-sm text-[#86868b]">
          Already registered?{' '}
          <Link
            to={{
              pathname: role === 'DOCTOR' ? '/doctor/login' : '/patient/login',
              search: location.search,
            }}
            state={location.state}
            className="text-[#0088e8] font-semibold hover:underline"
          >
            {role === 'DOCTOR' ? 'Sign in to Doctor Portal' : 'Sign in to Patient Portal'}
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        {/* Role Selector Tabs (Apple Pill Segmented Control) */}
        <div className="bg-[#f5f5f7] p-1 rounded-full border border-[#e5e5ea] flex max-w-sm mx-auto mb-6 shadow-2xs">
          <button
            type="button"
            onClick={() => setRole('PATIENT')}
            className={`flex-1 py-2 rounded-full text-xs font-medium transition-all flex items-center justify-center gap-2 ${
              role === 'PATIENT'
                ? 'bg-[#1d1d1f] text-white shadow-xs font-semibold'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            I am a Patient
          </button>
          <button
            type="button"
            onClick={() => setRole('DOCTOR')}
            className={`flex-1 py-2 rounded-full text-xs font-medium transition-all flex items-center justify-center gap-2 ${
              role === 'DOCTOR'
                ? 'bg-[#1d1d1f] text-white shadow-xs font-semibold'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            I am a Doctor
          </button>
        </div>

        <div className="bg-white py-8 px-6 sm:px-10 rounded-[24px] border border-[#e5e5ea] shadow-xs">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign-In */}
          <div className="mb-6">
            <div className="flex justify-center">
              {isGoogleConfigured ? (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google sign-up failed')}
                  shape="pill"
                  size="large"
                  text="signup_with"
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
                    <span>Sign up with Google ({role === 'DOCTOR' ? 'Doctor' : 'Patient'})</span>
                  </button>
                  <p className="text-[11px] text-center text-[#86868b]">
                    Instant registration using your verified Google profile.
                  </p>
                </div>
              )}
            </div>

            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e5e5ea]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-[#86868b]">or register with details</span>
              </div>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
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
                className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[15px] text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[15px] text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Mobile Number (+91)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[15px] text-[#1d1d1f] font-mono placeholder:text-[#86868b] transition-all focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[15px] text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20"
              />
            </div>

            {/* Doctor Specific Fields */}
            {role === 'DOCTOR' && (
              <div className="space-y-4 pt-2 border-t border-[#f5f5f7]">
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
                    placeholder="Search specialty (e.g. Cardiology, Dermatology)..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                      Qualifications
                    </label>
                    <input
                      type="text"
                      required
                      value={qualifications}
                      onChange={(e) => setQualifications(e.target.value)}
                      placeholder="e.g. MBBS, MD, MS"
                      className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      placeholder="Years of clinical practice"
                      className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-[#fafafc] rounded-2xl border border-[#e5e5ea] flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 text-[#0088e8] flex-shrink-0 mt-0.5" />
                  <div className="text-[11px] text-[#6e6e73] leading-relaxed">
                    <span className="font-semibold text-[#1d1d1f]">Practice Notice: </span>
                    Clinic venue, consultation fee, and practice shifts are configured when connecting with your practicing clinics.
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                  Notice: Doctor accounts require administrative verification before appearing in public searches.
                </div>
              </div>
            )}

            <div className="pt-3">
              <AppleButton
                variant="primary"
                size="md"
                type="submit"
                disabled={submitting}
                className="w-full"
              >
                {submitting ? 'Creating Account...' : 'Complete Registration'}
              </AppleButton>
            </div>
          </form>
        </div>

        {/* Portal Switcher Card */}
        <div className="mt-5 p-4 rounded-2xl bg-white border border-[#e5e5ea] shadow-2xs space-y-2.5">
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
            Switch Dedicated Portal:
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            {role === 'DOCTOR' ? (
              <Link
                to="/patient/signup"
                onClick={() => setRole('PATIENT')}
                className="flex items-center gap-1.5 text-[#0088e8] hover:text-[#0077cc] font-medium transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Patient Registration</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            ) : (
              <Link
                to="/doctor/signup"
                onClick={() => setRole('DOCTOR')}
                className="flex items-center gap-1.5 text-[#0088e8] hover:text-[#0077cc] font-medium transition-colors"
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Doctor Practice Registration</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}

            <Link
              to="/clinic/signup"
              className="flex items-center gap-1.5 text-[#86868b] hover:text-[#1d1d1f] font-medium transition-colors"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Clinic Partner Portal</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
