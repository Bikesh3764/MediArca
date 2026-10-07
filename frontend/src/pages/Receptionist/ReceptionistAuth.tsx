import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { AlertCircle, Sparkles, Mail, Lock, Building2, User, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { api, ClinicProfile } from '../../services/api';
import { sanitizeIndianPhone, formatIndianPhone, isValidIndianPhone } from '../../utils/phoneUtils';

export const ReceptionistAuth: React.FC = () => {
  const [authMode, setAuthMode] = useState<'login' | 'apply'>('login');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Login form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  const { login, updateUser } = useAuth();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedUser = await login({ email: email.trim(), password });
      if (loggedUser.role !== 'RECEPTIONIST') {
        setError('This account does not have receptionist desk permissions.');
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
      setError(err.message || 'Invalid receptionist credentials');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await api.changeReceptionistPassword({
        currentPassword: tempPassword,
        newPassword,
      });

      // Synchronize fresh session token and auth context (Finding H2)
      if (res?.token) {
        localStorage.setItem('mediarca_token', res.token);
      }
      const targetUser = res?.user || res?.data;
      if (targetUser) {
        updateUser({ ...targetUser, mustChangePassword: false });
      } else {
        const currentUser = await api.getMe();
        updateUser({ ...currentUser, mustChangePassword: false });
      }
      navigate('/receptionist/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to update permanent password');
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
      const loggedUser = await login({ email: 'receptionist@mediarca.com', password: 'receptionist123' });
      if (loggedUser.role !== 'RECEPTIONIST') {
        setError('This account does not have receptionist desk permissions.');
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
      setError('Please fill in your full name, email, and password.');
      return;
    }

    if (applyPhone && !isValidIndianPhone(applyPhone)) {
      setError('Please provide a valid 10-digit Indian phone number.');
      return;
    }

    if (!applyClinicId) {
      setError('Please select a verified clinic to join.');
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
        phone: applyPhone ? formatIndianPhone(applyPhone) : undefined,
        clinicId: applyClinicId,
      });

      setApplySuccessClinic(selectedClinic?.clinicName || 'the clinic');
      setApplyFullName('');
      setApplyEmail('');
      setApplyPhone('');
      setApplyPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit receptionist application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (mustChangePasswordState) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center py-8 sm:py-16 px-3 sm:px-6 animate-fadeIn">
        <div className="max-w-md w-full">
          <div className="text-center mb-6 sm:mb-8">
            <Link to="/" className="inline-block mb-3 hover:opacity-90 transition-opacity">
              <BrandLogo variant="full" size="md" imgClassName="h-8 w-auto mx-auto" />
            </Link>
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-500/20 shadow-xs">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight">
              Set Your Permanent Password
            </h1>
            <p className="text-xs sm:text-sm text-[#86868b] mt-1.5 leading-relaxed max-w-xs mx-auto">
              Your clinic administrator provisioned your account with a temporary password. You must set a private password to continue.
            </p>
          </div>

          <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#e5e5ea] p-4 sm:p-8 shadow-sm">
            {error && (
              <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Temporary / Current Password
                </label>
                <input
                  type="password"
                  required
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="Enter temporary password"
                  className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  New Permanent Password (min. 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Confirm Permanent Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                />
              </div>

              <div className="pt-2">
                <AppleButton
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={changingPassword}
                  className="w-full"
                >
                  {changingPassword ? 'Saving Permanent Password...' : 'Save & Enter Reception Desk'}
                </AppleButton>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setMustChangePasswordState(false)}
                  className="text-xs text-[#86868b] hover:text-[#1d1d1f] transition-colors"
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
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center py-8 sm:py-12 px-3 sm:px-6">
      <div className="max-w-[440px] w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-block hover:opacity-90 transition-opacity mb-3">
            <BrandLogo variant="full" size="md" imgClassName="h-8 w-auto mx-auto" />
          </Link>
          <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">
            Reception Desk
          </h1>
          <p className="text-xs text-[#86868b] mt-1">
            Front desk queue and walk-in management
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#e5e5ea] p-4 sm:p-8 shadow-xs">
          {/* Segmented Mode Selector */}
          <div className="flex rounded-full bg-[#f5f5f7] p-1 border border-[#e5e5ea] mb-6 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setError(null);
                setApplySuccessClinic(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-[0.98] ${
                authMode === 'login'
                  ? 'bg-white text-[#1d1d1f] shadow-xs'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              Desk Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('apply');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-[0.98] ${
                authMode === 'apply'
                  ? 'bg-white text-[#1d1d1f] shadow-xs'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              Apply to Clinic
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {applySuccessClinic ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#1d1d1f]">
                  Application Submitted
                </h3>
                <p className="text-xs text-[#86868b] mt-1.5 leading-relaxed max-w-sm mx-auto">
                  Your application to join <strong>{applySuccessClinic}</strong> has been sent to the clinic administrator. Once reviewed and approved, your desk credentials will be activated.
                </p>
              </div>
              <AppleButton
                variant="secondary"
                size="md"
                onClick={() => {
                  setApplySuccessClinic(null);
                  setAuthMode('login');
                }}
                className="w-full"
              >
                Back to Desk Sign In
              </AppleButton>
            </div>
          ) : authMode === 'apply' ? (
            <form onSubmit={handleApplySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={applyFullName}
                    onChange={(e) => setApplyFullName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Work / Personal Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={applyEmail}
                    onChange={(e) => setApplyEmail(e.target.value)}
                    placeholder="priya@receptionist.com"
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Mobile Number
                </label>
                <div className="flex rounded-xl border border-[#e5e5ea] overflow-hidden focus-within:ring-2 focus-within:ring-[#0088e8]/20 focus-within:border-[#0088e8] bg-[#f5f5f7] focus-within:bg-white transition-all h-11">
                  <span className="inline-flex items-center px-3 bg-[#e5e5ea]/50 border-r border-[#e5e5ea] text-[#1d1d1f] font-semibold text-[13px] select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={sanitizeIndianPhone(applyPhone)}
                    onChange={(e) => setApplyPhone(sanitizeIndianPhone(e.target.value))}
                    placeholder="98765 43210"
                    maxLength={10}
                    className="flex-1 h-full px-3.5 text-[14px] bg-transparent focus:outline-none text-[#1d1d1f] placeholder:text-[#86868b]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1 flex items-center justify-between">
                  <span>Select Clinic Facility *</span>
                  {clinicsLoading && <span className="text-[10px] text-[#86868b]">Loading clinics...</span>}
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-[#86868b] absolute left-3.5 top-3.5" />
                  <select
                    required
                    value={applyClinicId}
                    onChange={(e) => setApplyClinicId(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                  >
                    {clinics.length === 0 ? (
                      <option value="">No verified clinics available</option>
                    ) : (
                      clinics.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.clinicName} — {c.address}{c.city ? `, ${c.city}` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Choose Account Password * (min. 8 characters)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={applyPassword}
                    onChange={(e) => setApplyPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <AppleButton
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={submitting || clinics.length === 0}
                  className="w-full"
                >
                  {submitting ? 'Submitting Application...' : 'Submit Join Application'}
                </AppleButton>
              </div>

              <p className="text-[11px] text-[#86868b] text-center mt-2 leading-relaxed">
                Clinic administrators will verify your application and assign doctor queues before activating your desk.
              </p>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Desk Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="receptionist@domain.com"
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-sm bg-[#fbfbfd] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
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
                    className="w-full h-11 pl-10 pr-10 rounded-xl border border-[#e5e5ea] text-sm bg-[#fbfbfd] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
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
                  {submitting ? 'Authenticating...' : 'Sign In to Desk'}
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
                  <span>Instant Demo: Clara Oswald (Front Desk)</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Link */}
        <p className="mt-4 text-center text-xs text-[#86868b]">
          Clinic administrator?{' '}
          <Link to="/clinic/login" className="text-[#0088e8] font-semibold hover:underline">
            Clinic Portal Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};
