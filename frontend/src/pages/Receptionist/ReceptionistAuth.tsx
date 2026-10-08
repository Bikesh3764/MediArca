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

    if (!isValidIndianPhone(applyPhone)) {
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
        phone: formatIndianPhone(applyPhone),
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
      <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center py-10 sm:py-14 px-4 sm:px-6">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="text-center mb-6 space-y-2">
            <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
              <BrandLogo variant="full" size="md" imgClassName="h-8 w-auto mx-auto" />
            </Link>
            <div className="pt-1">
              <div className="w-11 h-11 rounded-2xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center mx-auto">
                <Lock className="w-5 h-5" />
              </div>
            </div>
            <div className="space-y-1">
              <h1 className="text-page-title">
                Set Permanent Password
              </h1>
              <p className="text-secondary">
                Update your temporary desk password before continuing.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 sm:p-8 shadow-apple-card">
            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#d70015] text-[13px] flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-[#ff3b30] shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChangeSubmit} className="ui-form-stack">
              <div>
                <label className="ui-label">
                  Temporary / Current Password
                </label>
                <input
                  type="password"
                  required
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="Enter temporary password"
                  className="ui-input"
                />
              </div>

              <div>
                <label className="ui-label">
                  New Permanent Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="ui-input"
                />
              </div>

              <div>
                <label className="ui-label">
                  Confirm Permanent Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="ui-input"
                />
              </div>

              <div className="pt-1">
                <AppleButton
                  variant="primary"
                  size="lg"
                  type="submit"
                  disabled={changingPassword}
                  className="w-full"
                >
                  {changingPassword ? 'Saving Password...' : 'Save & Enter Reception Desk'}
                </AppleButton>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setMustChangePasswordState(false)}
                  className="text-[13px] font-medium text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
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
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center py-10 sm:py-14 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-[440px]">
        {/* Brand Header */}
        <div className="text-center mb-6 space-y-2">
          <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
            <BrandLogo variant="full" size="md" imgClassName="h-8 w-auto mx-auto" />
          </Link>
          <div className="space-y-1">
            <h1 className="text-page-title">
              Receptionist Desk
            </h1>
            <p className="text-secondary">
              {authMode === 'login'
                ? 'Sign in to manage walk-ins and live doctor queues.'
                : 'Apply to join a verified clinic front desk team.'}
            </p>
          </div>
        </div>

        {/* Main Auth Surface */}
        <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 sm:p-8 shadow-apple-card">
          {/* Segmented Mode Selector */}
          <div className="grid grid-cols-2 h-11 rounded-full bg-[#f5f5f7] p-1 border border-[#e5e5ea] mb-6">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setError(null);
                setApplySuccessClinic(null);
              }}
              className={`h-full text-[13px] font-semibold rounded-full transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-white text-[#1d1d1f] shadow-2xs'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
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
              className={`h-full text-[13px] font-semibold rounded-full transition-all cursor-pointer ${
                authMode === 'apply'
                  ? 'bg-white text-[#1d1d1f] shadow-2xs'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              Apply to Clinic
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#d70015] text-[13px] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#ff3b30] shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {applySuccessClinic ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#34c759]/10 text-[#248a3d] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-section-title">
                  Application Submitted
                </h3>
                <p className="text-secondary mt-1.5 max-w-sm mx-auto">
                  Your application to join <strong className="text-[#1d1d1f] font-semibold">{applySuccessClinic}</strong> has been sent to the clinic administrator.
                </p>
              </div>
              <AppleButton
                variant="secondary"
                size="lg"
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
            <form onSubmit={handleApplySubmit} className="ui-form-stack">
              <div>
                <label className="ui-label">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={applyFullName}
                    onChange={(e) => setApplyFullName(e.target.value)}
                    placeholder="Priya Sharma"
                    className="ui-input pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="ui-label">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={applyEmail}
                    onChange={(e) => setApplyEmail(e.target.value)}
                    placeholder="priya@receptionist.com"
                    className="ui-input pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="ui-label">
                  Mobile Number
                </label>
                <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7]/80 bg-white hover:border-[#86868b]/60 focus-within:border-[#0066cc] focus-within:ring-[3px] focus-within:ring-[#0066cc]/15 transition-all duration-150 overflow-hidden">
                  <span className="inline-flex items-center h-full px-3 bg-[#f5f5f7] border-r border-[#e5e5ea] text-[#48484a] font-medium text-[13px] select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    value={sanitizeIndianPhone(applyPhone)}
                    onChange={(e) => setApplyPhone(sanitizeIndianPhone(e.target.value))}
                    placeholder="98765 43210"
                    maxLength={10}
                    className="flex-1 h-full px-3.5 text-[14px] bg-transparent focus:outline-none text-[#1d1d1f] placeholder:text-[#86868b]"
                  />
                </div>
              </div>

              <div>
                <label className="ui-label flex items-center justify-between">
                  <span>Clinic Facility</span>
                  {clinicsLoading && <span className="text-[11px] font-normal text-[#86868b]">Loading clinics...</span>}
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    required
                    value={applyClinicId}
                    onChange={(e) => setApplyClinicId(e.target.value)}
                    className="ui-select pl-10 cursor-pointer"
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
                <label className="ui-label">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={applyPassword}
                    onChange={(e) => setApplyPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="ui-input pl-10"
                  />
                </div>
              </div>

              <div className="pt-1">
                <AppleButton
                  variant="primary"
                  size="lg"
                  type="submit"
                  disabled={submitting || clinics.length === 0}
                  className="w-full"
                >
                  {submitting ? 'Submitting Application...' : 'Submit Application'}
                </AppleButton>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="ui-form-stack">
              <div>
                <label className="ui-label">
                  Desk Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="receptionist@domain.com"
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
                  {submitting ? 'Signing In...' : 'Sign In to Desk'}
                </AppleButton>
              </div>

              {/* Demo 1-Click Login */}
              <div className="pt-4 border-t border-[#f0f0f2]">
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={submitting}
                  className="w-full h-9 px-3 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e5e5ea] text-[12px] font-medium text-[#1d1d1f] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#0066cc]" />
                  <span>Quick Demo: Clara Oswald (Front Desk)</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Link */}
        <p className="mt-5 text-center text-[13px] text-[#6e6e73]">
          Clinic administrator?{' '}
          <Link to="/clinic/login" className="text-[#0066cc] font-semibold hover:underline">
            Clinic Portal Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};
