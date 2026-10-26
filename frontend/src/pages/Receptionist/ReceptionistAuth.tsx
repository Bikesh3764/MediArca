import { formatClinicAddress } from '../../utils/address';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { AlertCircle, Eye, EyeOff, ChevronDown, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api, ClinicProfile } from '../../services/api';
import { sanitizeIndianPhone, formatIndianPhone, isValidIndianPhone } from '../../utils/phoneUtils';
import { EmailVerificationModal } from '../../components/auth/EmailVerificationModal';
import { useToast } from '../../context/ToastContext';
import { safeStorage } from '../../utils/safeStorage';
import { preloadBotCheck } from '../../services/botCheck';

// Start loading the bot check as soon as this page opens
preloadBotCheck();

export const ReceptionistAuth: React.FC = () => {
  const { toast } = useToast();
  const [authMode, setAuthMode] = useState<'login' | 'apply'>('login');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Login form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationPendingEmail, setVerificationPendingEmail] = useState<string | null>(null);
  const [verificationCooldown, setVerificationCooldown] = useState<number | undefined>(undefined);

  // Apply form fields
  const [applyFullName, setApplyFullName] = useState('');
  const [applyEmail, setApplyEmail] = useState('');
  const [applyPhone, setApplyPhone] = useState('');
  const [applyClinicId, setApplyClinicId] = useState('');
  const [applyPassword, setApplyPassword] = useState('');
  const [applySuccessClinic, setApplySuccessClinic] = useState<string | null>(null);
  const [clinics, setClinics] = useState<ClinicProfile[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(false);

  // Password Change intercept states
  const [mustChangePasswordState, setMustChangePasswordState] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const { login, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedUser = await login({ email: email.trim(), password, role: 'RECEPTIONIST' });
      if (loggedUser.role !== 'RECEPTIONIST') {
        logout();
        setError('This isn’t a receptionist account.');
        setSubmitting(false);
        return;
      }
      if (loggedUser.mustChangePassword) {
        setTempPassword(password);
        setMustChangePasswordState(true);
        setSubmitting(false);
        return;
      }
      navigate('/receptionist/dashboard');
    } catch (err: any) {
      if (err.requiresVerification) {
        setVerificationPendingEmail(err.email || email.trim());
        setVerificationCooldown(err.cooldownSeconds);
        setError(null);
        return;
      }
      const msg = err.message || 'Invalid receptionist credentials';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords don’t match.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await api.changeReceptionistPassword({
        currentPassword: tempPassword,
        newPassword,
      });

      if (res?.token) {
        safeStorage.setItem('mediarca_token', res.token);
      }
      const targetUser = res?.user || res?.data;
      if (targetUser) {
        updateUser({ ...targetUser, mustChangePassword: false });
      } else {
        const currentUser = await api.getMe();
        updateUser({ ...currentUser, mustChangePassword: false });
      }
      toast.success('Password saved');
      navigate('/receptionist/dashboard');
    } catch (err: any) {
      const msg = err.message || 'Couldn’t save password. Try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setSubmitting(true);
    setEmail('receptionist@mediarca.com');
    setPassword('receptionist123');
    try {
      const loggedUser = await login({ email: 'receptionist@mediarca.com', password: 'receptionist123', role: 'RECEPTIONIST' });
      if (loggedUser.role !== 'RECEPTIONIST') {
        logout();
        setError('This isn’t a receptionist account.');
        setSubmitting(false);
        return;
      }
      navigate('/receptionist/dashboard');
    } catch (err: any) {
      setError(err.message || 'Demo receptionist login failed');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (authMode === 'apply' && clinics.length === 0) {
      queueMicrotask(() => {
        if (!mounted) return;
        setClinicsLoading(true);
        api.getPublicClinics()
          .then((res) => {
            if (!mounted) return;
            setClinics(res);
            if (res.length > 0 && !applyClinicId) {
              setApplyClinicId(res[0].id);
            }
          })
          .catch((err) => console.error('Failed to load clinics:', err))
          .finally(() => {
            if (mounted) setClinicsLoading(false);
          });
      });
    }
    return () => {
      mounted = false;
    };
  }, [authMode, clinics.length, applyClinicId]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!applyFullName.trim() || !applyEmail.trim() || !applyPassword.trim()) {
      setError('Enter your name, email and password.');
      return;
    }

    if (!isValidIndianPhone(applyPhone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }

    if (!applyClinicId) {
      setError('Choose a clinic.');
      return;
    }

    if (applyPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedClinic = clinics.find((c) => c.id === applyClinicId);
      await api.applyReceptionist({
        fullName: applyFullName.trim(),
        email: applyEmail.trim(),
        password: applyPassword,
        phone: formatIndianPhone(applyPhone),
        clinicId: applyClinicId,
      });

      setApplySuccessClinic(selectedClinic?.clinicName || 'the clinic');
      toast.success('Request sent to the clinic');
      setApplyFullName('');
      setApplyEmail('');
      setApplyPhone('');
      setApplyPassword('');
    } catch (err: any) {
      const msg = err.message || 'Couldn’t send request. Try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (mustChangePasswordState) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 pb-24 sm:pb-12 pb-safe">
        <div className="max-w-[450px] w-full">
          <div className="bg-white rounded-2xl border border-[#e5e5ea]  p-6 sm:p-7">
            <div className="flex flex-col items-center text-center mb-6">
              <Link to="/" className="mb-2.5 hover:opacity-90 transition-opacity">
                <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto object-contain mx-auto" />
              </Link>
              <h1 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                Set Your Password
              </h1>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-danger-soft border border-danger-line text-danger text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
              <div>
                <label htmlFor="rec-f-1" className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Temporary Password
                </label>
                <input
                  id="rec-f-1" autoComplete="current-password"
                  type="password"
                  required
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="From your clinic"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div>
                <label htmlFor="rec-f-2" className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  New Password
                </label>
                <input
                  id="rec-f-2" autoComplete="new-password"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div>
                <label htmlFor="rec-f-3" className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Confirm Password
                </label>
                <input
                  id="rec-f-3" autoComplete="new-password"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              {/* Real-time Password Rules & Match Feedback */}
              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors ${
                    newPassword.length >= 8 ? 'bg-success-dot text-white' : 'bg-[#e5e5ea] text-transparent'
                  }`}>
                    <CheckCircle2 className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span className={newPassword.length >= 8 ? 'text-[#1d1d1f] font-normal' : 'text-[#86868b]'}>
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors ${
                    confirmPassword && newPassword === confirmPassword
                      ? 'bg-success-dot text-white'
                      : 'bg-[#e5e5ea] text-transparent'
                  }`}>
                    <CheckCircle2 className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span className={confirmPassword && newPassword === confirmPassword ? 'text-[#1d1d1f] font-normal' : 'text-[#86868b]'}>
                    Passwords match
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={changingPassword || newPassword.length < 8 || newPassword !== confirmPassword}
                  className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {changingPassword ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    'Save & Enter Reception Desk'
                  )}
                </button>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setMustChangePasswordState(false)}
                  className="text-xs font-normal text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 pb-24 sm:pb-12 pb-safe">
      <div className="max-w-[450px] w-full">
        <div className="bg-white rounded-2xl border border-[#e5e5ea]  p-6 sm:p-7">
          {/* Brand & Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <Link to="/" className="mb-2.5 hover:opacity-90 transition-opacity">
              <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto object-contain mx-auto" />
            </Link>
            <h1 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
              Receptionist
            </h1>
          </div>

          {/* Segmented Mode Selector */}
          <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl flex gap-1 select-none mb-5">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setError(null);
                setApplySuccessClinic(null);
              }}
              className={`flex-1 py-2 text-xs rounded-lg transition-all duration-150 cursor-pointer text-center ${
                authMode === 'login'
                  ? 'bg-white text-[#1d1d1f] font-semibold  border border-black/5'
                  : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('apply');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs rounded-lg transition-all duration-150 cursor-pointer text-center ${
                authMode === 'apply'
                  ? 'bg-white text-[#1d1d1f] font-semibold  border border-black/5'
                  : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
              }`}
            >
              Join a Clinic
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-danger-soft border border-danger-line text-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {applySuccessClinic ? (
            <div className="text-center py-4 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-[#1d1d1f]">
                  Request sent
                </h3>
                <p className="text-xs text-[#86868b] mt-1 leading-relaxed">
                  Your application to join <span className="font-normal text-[#1d1d1f]">{applySuccessClinic}</span> has been sent to the clinic.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setApplySuccessClinic(null);
                  setAuthMode('login');
                }}
                className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          ) : authMode === 'apply' ? (
            <form onSubmit={handleApplySubmit} className="space-y-4">
              <div>
                <label htmlFor="rec-f-4" className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Full Name
                </label>
                <input
                  id="rec-f-4" autoComplete="name"
                  type="text"
                  required
                  value={applyFullName}
                  onChange={(e) => setApplyFullName(e.target.value)}
                  placeholder="Full name"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div>
                <label htmlFor="rec-f-5" className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Email
                </label>
                <input
                  id="rec-f-5" autoComplete="email"
                  type="email"
                  required
                  value={applyEmail}
                  onChange={(e) => setApplyEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div>
                <label htmlFor="rec-f-6" className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Mobile
                </label>
                <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white  focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all duration-150 overflow-hidden">
                  <div className="h-full px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] flex items-center justify-center select-none text-[13px] font-semibold text-[#1d1d1f]">
                    +91
                  </div>
                  <input
                    id="rec-f-6" autoComplete="tel-national"
                    type="tel"
                    inputMode="numeric"
                    required
                    value={sanitizeIndianPhone(applyPhone)}
                    onChange={(e) => setApplyPhone(sanitizeIndianPhone(e.target.value))}
                    placeholder="98765 43210"
                    maxLength={10}
                    className="flex-1 h-full px-3.5 bg-transparent text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="rec-f-7" className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight flex items-center justify-between">
                  <span>Clinic</span>
                  {clinicsLoading && <span className="text-[11px] font-normal text-[#86868b]">Loading…</span>}
                </label>
                <div className="relative">
                  <select
                    id="rec-f-7"
                    required
                    value={applyClinicId}
                    onChange={(e) => setApplyClinicId(e.target.value)}
                    className="w-full h-11 pl-3.5 pr-8 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 appearance-none cursor-pointer"
                  >
                    {clinics.length === 0 ? (
                      <option value="">No clinics yet</option>
                    ) : (
                      clinics.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.clinicName} — {formatClinicAddress(c, { withState: false })}
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label htmlFor="rec-f-8" className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Password
                </label>
                <input
                  id="rec-f-8" autoComplete="new-password"
                  type="password"
                  required
                  minLength={8}
                  value={applyPassword}
                  onChange={(e) => setApplyPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || clinics.length === 0}
                  className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label htmlFor="rec-f-9" className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Email
                </label>
                <input
                  id="rec-f-9" autoComplete="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="rec-f-10" className="block text-xs font-normal text-[#1d1d1f] tracking-tight">
                    Password
                  </label>
                  <Link to="/forgot-password?role=RECEPTIONIST" state={{ email: email.trim() }} className="text-xs text-[#0066cc] hover:underline py-1">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="rec-f-10" autoComplete="current-password"
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
                    'Sign In to Desk'
                  )}
                </button>
              </div>

              {/* Demo 1-Click Login */}
              <div className="pt-5 border-t border-[#e5e5ea]">
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={submitting}
                  className="w-full h-9 px-3 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e5e5ea] text-xs font-normal text-[#1d1d1f] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span>Try demo desk</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Link */}
        <p className="mt-5 text-center text-xs text-[#86868b]">
          Clinic administrator?{' '}
          <Link to="/clinic/login" className="inline-block py-2 text-[#0066cc] font-semibold hover:underline">
            Clinic sign in
          </Link>
        </p>
      </div>

      {/* Email Verification Modal */}
      <EmailVerificationModal
        isOpen={Boolean(verificationPendingEmail)}
        email={verificationPendingEmail || ''}
        role="RECEPTIONIST"
        initialCooldown={verificationCooldown}
        onSuccess={(verifiedUser) => {
          setVerificationPendingEmail(null);
          setVerificationCooldown(undefined);
          updateUser(verifiedUser);
          navigate('/receptionist/dashboard', { replace: true });
        }}
        onClose={() => {
          setVerificationPendingEmail(null);
          setVerificationCooldown(undefined);
        }}
      />
    </div>
  );
};

