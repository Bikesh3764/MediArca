import React, { useState } from 'react';
import { AuthShell } from '../../components/auth/AuthShell';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { Eye, EyeOff, AlertCircle, ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const AdminLogin: React.FC = () => {
  const { toast } = useToast();
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

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Enter your email.');
      setSubmitting(false);
      return;
    }

    try {
      const loggedUser = await login({ email: cleanEmail, password, role: 'ADMIN' });
      if (loggedUser.role?.toUpperCase() !== 'ADMIN') {
        logout();
        setError('This account isn’t an admin account.');
        return;
      }

      setAuthenticated(true);
      toast.success('Signed in');
      setTimeout(() => {
        navigate('/admin', { replace: true });
      }, 500);
    } catch (err: any) {
      const msg = err.message || 'Invalid administrative credentials or account not found';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    if (!import.meta.env.DEV) return;
    // Local seed account only. The live build drops this code (import.meta.env.DEV is false there)
    const demoEmail = 'admin@mediarca.com';
    const demoPassword = 'admin123';
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError(null);
    setSubmitting(true);
    try {
      const loggedUser = await login({ email: demoEmail, password: demoPassword, role: 'ADMIN' });
      if (loggedUser.role?.toUpperCase() !== 'ADMIN') {
        logout();
        setError('This account isn’t an admin account.');
        return;
      }
      setAuthenticated(true);
      setTimeout(() => {
        navigate('/admin', { replace: true });
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Demo admin sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell variant="admin">
      <div className="sm:mx-auto sm:w-full sm:max-w-[440px]">
        <div className="bg-white rounded-[28px] border border-[#e5e5ea] p-6 sm:p-9">
          {/* Brand & Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <Link to="/" className="mb-2.5 hover:opacity-90 transition-opacity">
              <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto object-contain mx-auto" />
            </Link>
            <h1 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
              Admin Sign In
            </h1>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-danger-soft border border-danger-line text-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {authenticated && (
            <div className="mb-4 p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center gap-2.5 font-normal">
              <CheckCircle2 className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
              <span>Signing in…</span>
            </div>
          )}

          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-email" className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                Email
              </label>
              <input
                id="admin-email"
                autoComplete="username"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                disabled={submitting || authenticated}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="admin-password" className="block text-xs font-normal text-[#1d1d1f] tracking-tight">
                  Password
                </label>
                <Link to="/forgot-password?role=ADMIN" state={{ email: email.trim() }} className="text-xs text-[#0066cc] hover:underline py-1">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="admin-password"
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                  disabled={submitting || authenticated}
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
                disabled={submitting || authenticated}
                className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </div>

            {/* Demo admin: local development only (no public admin login on the live site) */}
            {import.meta.env.DEV && (
            <div className="pt-3 border-t border-[#f0f0f2]">
              <div className="flex items-center justify-between text-xs text-[#86868b] mb-2">
                <span>Demo</span>
                <span className="text-[11px] font-normal text-[#1d1d1f]">admin@mediarca.com</span>
              </div>
              <button
                type="button"
                onClick={handleQuickDemoLogin}
                disabled={submitting || authenticated}
                className="w-full h-9 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] disabled:opacity-60"
              >
                <span>Try demo admin</span>
              </button>
            </div>
            )}
          </form>
        </div>

        <div className="mt-5 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 py-2 text-xs font-normal text-[#86868b] hover:text-[#1d1d1f] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Home</span>
          </Link>
        </div>
      </div>
    </AuthShell>
  );
};

