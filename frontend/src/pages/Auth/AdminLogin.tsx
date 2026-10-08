import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { AppleButton } from '../../components/ui/AppleButton';
import { Shield, Lock, Eye, EyeOff, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  const { login, logout } = useAuth();
  const navigate = useNavigate();

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const loggedUser = await login({ email, password });
      if (loggedUser.role !== 'ADMIN') {
        logout();
        setError('Access Denied: This account does not have platform administrator credentials.');
        return;
      }

      setAuthenticated(true);
      setTimeout(() => {
        navigate('/admin', { replace: true });
      }, 600);
    } catch (err: any) {
      setError(err.message || 'Invalid administrative credentials or account not found');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center py-10 sm:py-14 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-[440px]">
        {/* Brand Header */}
        <div className="text-center mb-6 space-y-2">
          <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
            <BrandLogo variant="full" size="md" imgClassName="h-8 w-auto mx-auto" />
          </Link>
          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]">
              <Shield className="w-3.5 h-3.5 text-[#0066cc]" />
              <span>Root Admin</span>
            </span>
          </div>
          <div className="space-y-1">
            <h1 className="text-page-title">
              Administrator Sign In
            </h1>
            <p className="text-secondary">
              Authorized MediArca administration access only.
            </p>
          </div>
        </div>

        {/* Main Auth Surface */}
        <div className="bg-white p-6 sm:p-8 rounded-[24px] border border-[#e5e5ea] shadow-apple-card">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-[13px] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {authenticated && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[13px] flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Admin credentials verified. Opening control center...</span>
            </div>
          )}

          <form onSubmit={handleAdminSubmit} className="ui-form-stack">
            <div>
              <label className="ui-label">
                Administrator Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@mediarca.com"
                className="ui-input"
                disabled={submitting || authenticated}
              />
            </div>

            <div>
              <label className="ui-label">
                Master Access Key
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  className="ui-input pr-10"
                  disabled={submitting || authenticated}
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
                type="submit"
                variant="primary"
                size="lg"
                disabled={submitting || authenticated}
                className="w-full"
              >
                <Lock className="w-4 h-4" />
                <span>{submitting ? 'Signing In...' : 'Sign In as Admin'}</span>
              </AppleButton>
            </div>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-4 border-t border-[#f0f0f2] text-center">
            <p className="text-[12px] text-[#86868b]">
              Protected platform governance console.
            </p>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-5 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to MediArca Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
