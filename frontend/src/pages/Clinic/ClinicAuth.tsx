import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { Building2, AlertCircle, Sparkles, MapPin, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { sanitizeIndianPhone, formatIndianPhone, isValidIndianPhone } from '../../utils/phoneUtils';
import { INDIAN_STATES, getCitiesForState } from '../../utils/indiaStates';
import { GoogleLogin } from '@react-oauth/google';
import { isGoogleConfigured } from '../../config/auth';
import { EmailVerificationModal } from '../../components/auth/EmailVerificationModal';

export const ClinicAuth: React.FC = () => {
  const location = useLocation();
  const isSignupInit = location.pathname.includes('signup');

  const [mode, setMode] = useState<'login' | 'signup'>(isSignupInit ? 'signup' : 'login');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verificationPendingEmail, setVerificationPendingEmail] = useState<string | null>(null);

  // Form fields
  const [clinicName, setClinicName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [isCustomCity, setIsCustomCity] = useState(false);
  const [customCity, setCustomCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const stateCities = state ? getCitiesForState(state) : [];

  const handleStateChange = (newState: string) => {
    setState(newState);
    setCity('');
    setIsCustomCity(false);
    setCustomCity('');
  };

  const handleCitySelect = (val: string) => {
    if (val === '__custom__') {
      setIsCustomCity(true);
      setCity(customCity);
    } else {
      setIsCustomCity(false);
      setCity(val);
    }
  };

  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (credentialResponse.credential) {
      setError(null);
      setSubmitting(true);
      try {
        const loggedUser = await loginWithGoogle(credentialResponse.credential, 'CLINIC');
        if (loggedUser.role !== 'CLINIC') {
          setError('This account does not have clinic administrative permissions.');
          setSubmitting(false);
          return;
        }
        navigate('/clinic/dashboard');
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
          email: 'clinic.google@mediarca.com',
          name: 'City Care Clinic (Google)',
          picture: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=256&q=80',
        })
      );
      const simulatedToken = `${header}.${payload}.signature`;
      const loggedUser = await loginWithGoogle(simulatedToken, 'CLINIC');
      if (loggedUser.role !== 'CLINIC') {
        setError('This account does not have clinic administrative permissions.');
        setSubmitting(false);
        return;
      }
      navigate('/clinic/dashboard');
    } catch (err: any) {
      setError(err.message || 'Simulated Google login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login({ email: email.trim(), password });
      if (user.role !== 'CLINIC') {
        setError('This account does not have clinic administrative permissions.');
        setSubmitting(false);
        return;
      }
      navigate('/clinic/dashboard');
    } catch (err: any) {
      if (err.requiresVerification) {
        setVerificationPendingEmail(err.email || email.trim());
        setError(null);
        return;
      }
      setError(err.message || 'Invalid clinic credentials');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state) {
      setError('Please select the state where your clinic is located');
      return;
    }
    if (!isValidIndianPhone(phone)) {
      setError('Please enter a valid 10-digit Indian phone number');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await register({
        role: 'CLINIC',
        fullName: clinicName,
        clinicName,
        address,
        city: city || undefined,
        state: state || undefined,
        phone: formatIndianPhone(phone),
        email: email.trim(),
        password,
      });
      if (res.requiresVerification && res.email) {
        setVerificationPendingEmail(res.email);
        return;
      }
      navigate('/clinic/dashboard');
    } catch (err: any) {
      setError(err.message || 'Clinic registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setSubmitting(true);
    setEmail('clinic@mediarca.com');
    setPassword('clinic123');
    try {
      const loggedUser = await login({ email: 'clinic@mediarca.com', password: 'clinic123' });
      if (loggedUser.role !== 'CLINIC') {
        setError('This account does not have clinic administrative permissions.');
        setSubmitting(false);
        return;
      }
      navigate('/clinic/dashboard');
    } catch (err: any) {
      setError(err.message || 'Demo clinic login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center py-8 sm:py-12 px-3 sm:px-6">
      <div className="max-w-[440px] w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-block hover:opacity-90 transition-opacity mb-3">
            <BrandLogo variant="full" size="md" imgClassName="h-8 w-auto mx-auto" />
          </Link>
          <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">
            Clinic Portal
          </h1>
          <p className="text-xs text-[#86868b] mt-1">
            Sign in or register your healthcare facility
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#e5e5ea] p-4 sm:p-8 shadow-xs">
          {/* Tab Pill Switcher */}
          <div className="flex bg-[#f5f5f7] p-1 rounded-full mb-6 border border-[#e5e5ea] shadow-xs">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all active:scale-[0.98] ${
                mode === 'login'
                  ? 'bg-white text-[#1d1d1f] shadow-xs'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all active:scale-[0.98] ${
                mode === 'signup'
                  ? 'bg-white text-[#1d1d1f] shadow-xs'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              Register Clinic
            </button>
          </div>

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
                  width="100%"
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
                    <span>Continue with Google (Clinic Admin)</span>
                  </button>
                  <p className="text-[11px] text-center text-[#86868b]">
                    Sign in or onboard your clinical facility using Google workspace.
                  </p>
                </div>
              )}
            </div>

            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e5e5ea]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-[#86868b]">or {mode === 'login' ? 'sign in' : 'register'} with email</span>
              </div>
            </div>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Clinic Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="clinic@domain.com"
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-10 pr-10 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#fbfbfd] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
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

              <div className="pt-2">
                <AppleButton
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={submitting}
                  className="w-full"
                >
                  {submitting ? 'Authenticating...' : 'Sign In to Clinic Portal'}
                </AppleButton>
              </div>

              {/* Demo 1-Click Login */}
              <div className="pt-4 border-t border-[#f0f0f2]">
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={submitting}
                  className="w-full py-2 px-3 rounded-xl bg-[#f5f5f7] hover:bg-[#ebebee] border border-[#e5e5ea] text-xs font-medium text-[#1d1d1f] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#0088e8]" />
                  <span>Instant Demo: Metropolis Polyclinic</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Clinic Legal Name
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="e.g. City Polyclinic & Diagnostic"
                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Clinic Location & Address
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Suite, Floor, Street Address"
                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">State</label>
                  <select
                    required
                    value={state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] cursor-pointer"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">City</label>
                  {!isCustomCity ? (
                    <select
                      required
                      disabled={!state}
                      value={city}
                      onChange={(e) => handleCitySelect(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">{state ? 'Select City' : 'Select State First'}</option>
                      {stateCities.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      {state && <option value="__custom__">Other City / Town (Write-in)</option>}
                    </select>
                  ) : (
                    <div className="space-y-1">
                      <input
                        type="text"
                        required
                        value={customCity}
                        onChange={(e) => {
                          setCustomCity(e.target.value);
                          setCity(e.target.value);
                        }}
                        placeholder="Type city/town name"
                        className="w-full h-10 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomCity(false);
                          setCity('');
                        }}
                        className="text-[11px] text-[#0088e8] hover:underline cursor-pointer"
                      >
                        ← Choose from list
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">Official Contact Phone</label>
                <div className="flex rounded-xl border border-[#e5e5ea] overflow-hidden focus-within:ring-2 focus-within:ring-[#0088e8]/20 focus-within:border-[#0088e8] bg-[#f5f5f7] focus-within:bg-white transition-all">
                  <span className="inline-flex items-center gap-1 px-2.5 bg-[#e5e5ea]/50 border-r border-[#e5e5ea] text-[#1d1d1f] font-semibold text-xs select-none">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </span>
                  <input
                    type="tel"
                    required
                    value={sanitizeIndianPhone(phone)}
                    onChange={(e) => {
                      const digits = sanitizeIndianPhone(e.target.value);
                      setPhone(digits ? `+91 ${digits}` : '');
                    }}
                    placeholder="98765 43210"
                    maxLength={10}
                    className="w-full h-10 px-3 text-xs bg-transparent focus:outline-none tracking-wider font-mono text-[#1d1d1f] placeholder:text-[#86868b]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Official Email (for Login)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@clinic.com"
                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full h-10 pl-10 pr-10 rounded-xl border border-[#e5e5ea] text-xs bg-[#fbfbfd] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
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

              <div className="pt-2">
                <AppleButton
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={submitting}
                  className="w-full"
                >
                  {submitting ? 'Registering Clinic...' : 'Create Clinic Account'}
                </AppleButton>
              </div>
            </form>
          )}
        </div>

        {/* Footer Link */}
        <p className="mt-4 text-center text-xs text-[#86868b]">
          Front desk staff?{' '}
          <Link to="/receptionist/login" className="text-[#0088e8] font-semibold hover:underline">
            Receptionist Desk Sign In
          </Link>
        </p>

        {/* Email Verification Modal */}
        <EmailVerificationModal
          isOpen={Boolean(verificationPendingEmail)}
          email={verificationPendingEmail || ''}
          onSuccess={() => {
            setVerificationPendingEmail(null);
            navigate('/clinic/dashboard');
          }}
          onClose={() => setVerificationPendingEmail(null)}
        />
      </div>
    </div>
  );
};
