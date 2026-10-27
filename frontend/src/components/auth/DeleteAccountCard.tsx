import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { clearSavedSession } from '../../utils/savedSession';
import { api } from '../../services/api';
import { siteBase } from '../../utils/siteUrl';

const inputClass =
  'w-full h-11 pl-3.5 pr-10 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150';

const WHAT_GOES: Record<string, string> = {
  PATIENT: 'Your profile and visit history are removed.',
  DOCTOR: 'Your profile, shifts and visit history are removed.',
  CLINIC: 'Your clinic, its front desk logins and doctor links are removed.',
  RECEPTIONIST: 'Your front desk login is removed.',
  ADMIN: 'Your admin login is removed.',
};

/** "Delete account" card for every portal. Needs the current password (FIX-056). */
export const DeleteAccountCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wrongPassword, setWrongPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPassword('');
    setShow(false);
    setError(null);
    setWrongPassword(false);
  };

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  if (!user) return null;

  const finish = () => {
    // Forget the sign-in and reload on the home page: no screen keeps this account's data in memory
    clearSavedSession();
    window.location.replace(`${siteBase()}/`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!password) return setError('Enter your password.');
    setBusy(true);
    setError(null);
    setWrongPassword(false);
    try {
      await api.deleteAccount(password);
      setBusy(false);
      finish();
    } catch (err: any) {
      setBusy(false);
      // A retry after a slow first try that already went through: the account is gone
      if (err?.status === 404) return finish();
      if (err?.code === 'WRONG_PASSWORD') setWrongPassword(true);
      setError(err?.message || 'Could not delete the account. Please try again.');
    }
  };

  return (
    <>
      <div className={`bg-white border border-[#e5e5ea] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${className}`}>
        <div>
          <h2 className="text-sm font-semibold text-[#1d1d1f]">Delete account</h2>
          <p className="text-xs text-[#86868b] mt-1">This can’t be undone.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-11 px-6 rounded-full border border-danger-line text-danger bg-white hover:bg-danger-soft active:scale-[0.98] text-sm cursor-pointer self-start sm:self-auto"
        >
          Delete account
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="bg-white rounded-t-2xl sm:rounded-2xl border border-[#e5e5ea] max-w-md w-full p-6 sm:p-7 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-7 text-left max-h-[92vh] overflow-y-auto"
          >
            <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />
            <h2 id="delete-account-title" className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">
              Delete account?
            </h2>
            <p className="text-xs text-[#86868b] mt-1.5 leading-relaxed">
              {WHAT_GOES[user.role] || WHAT_GOES.PATIENT} This can’t be undone.
            </p>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="delete-password" className="block text-xs text-[#1d1d1f] mb-1.5 tracking-tight">
                  Password
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    id="delete-password"
                    type={show ? 'text' : 'password'}
                    required
                    value={password}
                    autoComplete="current-password"
                    maxLength={128}
                    disabled={busy}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full inline-flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] cursor-pointer"
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="p-3 rounded-xl bg-danger-soft border border-danger-line text-danger text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
                  <span>
                    {error}
                    {wrongPassword && (
                      <>
                        {' '}Used Google?{' '}
                        <Link to={`/forgot-password?role=${user.role}`} state={{ email: user.email }} className="underline">
                          Set a password
                        </Link>
                      </>
                    )}
                  </span>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  className="h-11 px-6 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] text-sm active:scale-[0.98] cursor-pointer disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !password}
                  className="h-11 px-6 rounded-full bg-danger hover:opacity-90 active:scale-[0.98] text-white text-sm inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
