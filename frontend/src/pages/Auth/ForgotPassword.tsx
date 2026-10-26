import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { preloadBotCheck } from '../../services/botCheck';

// Start loading the bot check as soon as this page opens
preloadBotCheck();

type Role = 'PATIENT' | 'DOCTOR' | 'CLINIC' | 'RECEPTIONIST' | 'ADMIN';

const ROLE_INFO: Record<Role, { label: string; login: string }> = {
  PATIENT: { label: 'Patient', login: '/patient/login' },
  DOCTOR: { label: 'Doctor', login: '/doctor/login' },
  CLINIC: { label: 'Clinic', login: '/clinic/login' },
  RECEPTIONIST: { label: 'Receptionist', login: '/receptionist/login' },
  ADMIN: { label: 'Admin', login: '/admin-login' },
};

const inputClass =
  'w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150';
const labelClass = 'block text-xs text-[#1d1d1f] mb-1.5 tracking-tight';
const primaryButton =
  'w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';

export const ForgotPassword: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const rawRole = String(params.get('role') || 'PATIENT').toUpperCase() as Role;
  const role: Role = rawRole in ROLE_INFO ? rawRole : 'PATIENT';
  const info = ROLE_INFO[role];

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(String((location.state as { email?: string } | null)?.email || ''));
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.requestPasswordReset(email.trim(), role);
      setStep('code');
      setNotice(
        res?.devOtp
          ? `Test mode code: ${res.devOtp}`
          : 'If this email has an account, a 6-digit code is on its way. Check your inbox and spam.'
      );
    } catch (err: any) {
      setError(err?.message || 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('The passwords don’t match.');
    setBusy(true);
    try {
      await api.resetPassword({ email: email.trim(), role, otp: otp.trim(), newPassword: password });
      toast.success('Password updated. Sign in with your new password.');
      navigate(info.login, { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Could not reset the password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center py-8 sm:py-10 px-4 sm:px-6 pb-24 sm:pb-12 pb-safe">
      <div className="sm:mx-auto sm:w-full sm:max-w-[450px]">
        <div className="bg-white rounded-2xl border border-[#e5e5ea] p-6 sm:p-7">
          <div className="flex flex-col items-center text-center mb-6">
            <Link to="/" className="mb-2.5 hover:opacity-90 transition-opacity">
              <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto object-contain mx-auto" />
            </Link>
            <h1 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">Reset Password</h1>
            <p className="text-xs text-[#86868b] mt-1">{info.label} account</p>
          </div>

          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-danger-soft border border-danger-line text-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {notice && step === 'code' && (
            <div role="status" className="mb-4 p-3 rounded-xl bg-[#0066cc]/[0.06] border border-[#0066cc]/15 text-[#1d1d1f] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#0066cc]" />
              <span>{notice}</span>
            </div>
          )}

          {step === 'email' ? (
            <form className="space-y-4" onSubmit={sendCode}>
              <div>
                <label htmlFor="reset-email" className={labelClass}>Email Address</label>
                <input
                  id="reset-email"
                  type="email"
                  required
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className={inputClass}
                />
              </div>
              <button type="submit" disabled={busy} className={primaryButton}>
                {busy && <RefreshCw className="w-4 h-4 animate-spin" />}
                Send Code
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={resetPassword}>
              <div>
                <label htmlFor="reset-code" className={labelClass}>6-digit code</label>
                <input
                  id="reset-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  pattern="\d{6}"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className={`${inputClass} tracking-[0.3em]`}
                />
              </div>
              <div>
                <label htmlFor="reset-new" className={labelClass}>New password</label>
                <input
                  id="reset-new"
                  type="password"
                  required
                  autoComplete="new-password"
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="reset-confirm" className={labelClass}>Confirm new password</label>
                <input
                  id="reset-confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  maxLength={128}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button type="submit" disabled={busy} className={primaryButton}>
                {busy && <RefreshCw className="w-4 h-4 animate-spin" />}
                Set New Password
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => sendCode()}
                className="w-full h-11 rounded-full text-sm text-[#0066cc] hover:bg-[#0066cc]/[0.06] cursor-pointer disabled:opacity-60"
              >
                Send a new code
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-[#e5e5ea] text-center">
            <Link to={info.login} className="inline-block py-2 text-sm text-[#0066cc] hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
