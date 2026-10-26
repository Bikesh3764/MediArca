import React, { useState } from 'react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const inputClass =
  'w-full h-11 pl-3.5 pr-10 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150';

/** "Password" card for profile and settings pages. */
export const ChangePasswordCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { changePassword } = useAuth();
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError('New password must be at least 8 characters.');
    if (next !== confirm) return setError('The new passwords don’t match.');
    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success('Password changed');
    } catch (err: any) {
      setError(err?.message || 'Could not change the password.');
    } finally {
      setSaving(false);
    }
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, autoComplete: string) => (
    <div>
      <label htmlFor={id} className="block text-xs text-[#1d1d1f] mb-1.5 tracking-tight">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          value={value}
          autoComplete={autoComplete}
          maxLength={128}
          onChange={(e) => set(e.target.value)}
          className={inputClass}
        />
      </div>
    </div>
  );

  return (
    <form onSubmit={submit} className={`bg-white border border-[#e5e5ea] rounded-2xl p-5 sm:p-6 space-y-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#1d1d1f]">Password</h2>
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide passwords' : 'Show passwords'}
          className="w-9 h-9 rounded-full inline-flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] cursor-pointer"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {field('pw-current', 'Current password', current, setCurrent, 'current-password')}
      {field('pw-new', 'New password', next, setNext, 'new-password')}
      {field('pw-confirm', 'Confirm new password', confirm, setConfirm, 'new-password')}
      {error && <p className="text-xs text-danger">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
      >
        {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
        Change password
      </button>
    </form>
  );
};
