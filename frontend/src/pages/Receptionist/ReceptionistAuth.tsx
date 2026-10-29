import React, { useState } from 'react';
import { AuthShell } from '../../components/auth/AuthShell';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { AlertCircle, Eye, EyeOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';
import { EmailVerificationModal } from '../../components/auth/EmailVerificationModal';
import { useToast } from '../../context/ToastContext';
import { safeStorage } from '../../utils/safeStorage';

export const ReceptionistAuth: React.FC = () => {
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Login form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationPendingEmail, setVerificationPendingEmail] = useState<string | null>(null);
  const [verificationCooldown, setVerificationCooldown] = useState<number | undefined>(undefined);

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

  if (mustChangePasswordState) {
    return (
      <AuthShell variant="receptionist">
        <div className="max-w-[450px] w-full">
          <div className="bg-white rounded-[28px] border border-[#e5e5ea] p-6 sm:p-9">
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
      </AuthShell>
    );
  }

  return (
    <AuthShell variant="receptionist">
      <div className="max-w-[450px] w-full">
        <div className="bg-white rounded-[28px] border border-[#e5e5ea] p-6 sm:p-9">
          {/* Brand & Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <Link to="/" className="mb-2.5 hover:opacity-90 transition-opacity">
              <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto object-contain mx-auto" />
            </Link>
            <h1 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
              Receptionist
            </h1>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-danger-soft border border-danger-line text-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

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
          // First sign-in: email confirmed, now replace the clinic's temporary password
          if (verifiedUser.mustChangePassword) {
            setTempPassword(password);
            setMustChangePasswordState(true);
            return;
          }
          navigate('/receptionist/dashboard', { replace: true });
        }}
        onClose={() => {
          setVerificationPendingEmail(null);
          setVerificationCooldown(undefined);
        }}
      />
    </AuthShell>
  );
};

