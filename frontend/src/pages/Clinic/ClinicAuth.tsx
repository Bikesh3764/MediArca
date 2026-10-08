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
    if (password.trim().length < 8) {
      setError('Password must be at least 8 characters long.');
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
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center py-10 sm:py-14 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-[460px]">
        {/* Brand Header */}
        <div className="text-center mb-6 space-y-2">
          <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
            <BrandLogo variant="full" size="md" imgClassName="h-8 w-auto mx-auto" />
          </Link>
          <div className="space-y-1">
            <h1 className="text-page-title">
              Clinic Partner Portal
            </h1>
            <p className="text-secondary">
              {mode === 'login'
                ? 'Manage affiliated doctors, reception desks, and outpatient queues.'
                : 'Register your clinical facility on the MediArca network.'}
            </p>
          </div>
        </div>

        {/* Main Auth Surface */}
        <div className="bg-white p-6 sm:p-8 rounded-[24px] border border-[#e5e5ea] shadow-apple-card">
          {/* Segmented Mode Switcher */}
          <div className="grid grid-cols-2 h-11 bg-[#f5f5f7] p-1 rounded-full border border-[#e5e5ea] mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`h-full text-[13px] font-semibold rounded-full transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-[#1d1d1f] shadow-2xs'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
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
              className={`h-full text-[13px] font-semibold rounded-full transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white text-[#1d1d1f] shadow-2xs'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              Register Clinic
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#d70015] text-[13px] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#ff3b30] shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="ui-form-stack">
              <div>
                <label className="ui-label">
                  Clinic Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="clinic@domain.com"
                    className="ui-input pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="ui-label">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="ui-input pl-10 pr-10"
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
                  {submitting ? 'Signing In...' : 'Sign In to Clinic Portal'}
                </AppleButton>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignupSubmit} className="ui-form-stack">
              <div>
                <label className="ui-label">
                  Clinic Legal Name
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="e.g. City Polyclinic & Diagnostic"
                    className="ui-input pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="ui-label">
                  Clinic Location & Address
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Suite, Floor, Street Address"
                    className="ui-input pl-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="ui-label">State</label>
                  <select
                    required
                    value={state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="ui-select cursor-pointer"
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
                  <label className="ui-label">City</label>
                  {!isCustomCity ? (
                    <select
                      required
                      disabled={!state}
                      value={city}
                      onChange={(e) => handleCitySelect(e.target.value)}
                      className="ui-select cursor-pointer"
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
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        required
                        value={customCity}
                        onChange={(e) => {
                          setCustomCity(e.target.value);
                          setCity(e.target.value);
                        }}
                        placeholder="Type city/town name"
                        className="ui-input"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomCity(false);
                          setCity('');
                        }}
                        className="text-[12px] text-[#0066cc] hover:underline cursor-pointer"
                      >
                        ← Choose from list
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="ui-label">
                    Official Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@clinic.com"
                      className="ui-input pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="ui-label">Contact Mobile</label>
                  <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7]/80 bg-white hover:border-[#86868b]/60 focus-within:border-[#0066cc] focus-within:ring-[3px] focus-within:ring-[#0066cc]/15 transition-all duration-150 overflow-hidden">
                    <span className="inline-flex items-center h-full px-3 bg-[#f5f5f7] border-r border-[#e5e5ea] text-[#48484a] font-medium text-[13px] select-none">
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      required
                      value={sanitizeIndianPhone(phone)}
                      onChange={(e) => {
                        const digits = sanitizeIndianPhone(e.target.value);
                        setPhone(digits ? `+91 ${digits}` : '');
                      }}
                      placeholder="98765 43210"
                      maxLength={10}
                      className="flex-1 h-full px-3.5 text-[14px] bg-transparent focus:outline-none text-[#1d1d1f] placeholder:text-[#86868b]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="ui-label">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="ui-input pl-10 pr-10"
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
                  {submitting ? 'Creating Account...' : 'Create Clinic Account'}
                </AppleButton>
              </div>
            </form>
          )}

          {/* Google Sign-In Container */}
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

          {/* Demo 1-Click Login */}
          {mode === 'login' && (
            <div className="mt-6 pt-5 border-t border-[#f0f0f2]">
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={submitting}
                className="w-full h-9 px-3 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e5e5ea] text-[12px] font-medium text-[#1d1d1f] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#0066cc]" />
                <span>Quick Demo: Metropolis Polyclinic</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Link */}
        <p className="mt-5 text-center text-[13px] text-[#6e6e73]">
          Front desk staff?{' '}
          <Link to="/receptionist/login" className="text-[#0066cc] font-semibold hover:underline">
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
