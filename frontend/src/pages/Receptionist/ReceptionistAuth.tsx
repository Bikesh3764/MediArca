import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { Clock, AlertCircle, Sparkles, Mail, Lock, Info } from 'lucide-react';
import { api } from '../../services/api';

export const ReceptionistAuth: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
      const loggedUser = await login({ email, password });
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
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      await api.changeReceptionistPassword({
        currentPassword: tempPassword,
        newPassword,
      });

      // Update auth user in context
      const currentUser = await api.getMe();
      updateUser({ ...currentUser, mustChangePassword: false });
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
    try {
      await login({ email: 'receptionist@mediarca.com', password: 'receptionist123' });
      navigate('/receptionist/dashboard');
    } catch (err: any) {
      setError(err.message || 'Demo receptionist login failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (mustChangePasswordState) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center py-16 px-4 sm:px-6 animate-fadeIn">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
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

          <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 sm:p-8 shadow-sm">
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
                  className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0088e8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  New Permanent Password (min. 6 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0088e8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Confirm Permanent Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0088e8]"
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
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center py-16 px-4 sm:px-6">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-3 hover:opacity-90 transition-opacity">
            <BrandLogo variant="full" size="md" imgClassName="h-8 w-auto mx-auto" />
          </Link>
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-500/20 shadow-xs">
            <Clock className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight">
            Receptionist Desk Portal
          </h1>
          <p className="text-xs sm:text-sm text-[#86868b] mt-1.5 leading-relaxed max-w-xs mx-auto">
            Book rapid walk-in patients, print queue passes, and manage live doctor queues.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-6 sm:p-8 shadow-sm">
          {/* Informational Callout */}
          <div className="mb-6 p-3.5 rounded-2xl bg-[#0088e8]/5 border border-[#0088e8]/15 flex items-start gap-2.5 text-xs text-[#0088e8]">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold block text-[#1d1d1f]">Clinic Provisioned Access Only</span>
              Receptionist desk accounts are created directly by Clinic Administrators in their portal. Please contact your clinic admin to receive your login credentials.
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
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
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0088e8]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#86868b] absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0088e8]"
                />
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
                {submitting ? 'Authenticating...' : 'Sign In to Receptionist Desk'}
              </AppleButton>
            </div>

            {/* Demo 1-Click Login */}
            <div className="pt-3 border-t border-[#f0f0f0]">
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={submitting}
                className="w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100/70 border border-amber-200 text-xs font-medium text-amber-800 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>One-Click Demo Receptionist Login</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
