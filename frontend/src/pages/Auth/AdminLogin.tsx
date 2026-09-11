import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-amber-500 selection:text-black">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Security Shield Icon */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-5 shadow-inner">
          <Shield className="w-7 h-7" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
          MediArca Terminal
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Root Admin
          </span>
        </h1>
        <p className="mt-2 text-xs text-neutral-400 font-mono">
          RESTRICTED PROTOCOL · AUTHORIZED ACCESS ONLY
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#161b22] py-8 px-6 sm:px-10 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {authenticated && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              <span>Admin credentials verified. Opening command center...</span>
            </div>
          )}

          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5 font-mono">
                ADMINISTRATOR EMAIL
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@mediarca.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-white/15 text-white placeholder-neutral-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all font-mono"
                  disabled={submitting || authenticated}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5 font-mono">
                MASTER ACCESS KEY
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-white/15 text-white placeholder-neutral-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all font-mono pr-10"
                  disabled={submitting || authenticated}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || authenticated}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold text-xs tracking-wider uppercase transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    <span>Verifying Cryptographic Session...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Authorize & Unlock Admin Console</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-4 border-t border-white/5 text-center">
            <p className="text-[11px] text-neutral-500 leading-relaxed font-mono">
              Session is secured with 256-bit encrypted JWT. Unauthorized connection attempts are actively audited.
            </p>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to MediArca Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
