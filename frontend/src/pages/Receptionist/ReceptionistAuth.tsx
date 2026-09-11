import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { Clock, AlertCircle, Sparkles, Phone, Mail, Lock, User } from 'lucide-react';

export const ReceptionistAuth: React.FC = () => {
  const location = useLocation();
  const isSignupInit = location.pathname.includes('signup');

  const [mode, setMode] = useState<'login' | 'signup'>(isSignupInit ? 'signup' : 'login');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login({ email, password });
      if (user.role !== 'RECEPTIONIST') {
        setError('This account does not have receptionist desk permissions.');
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

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({
        role: 'RECEPTIONIST',
        fullName,
        phone,
        email,
        password,
      });
      navigate('/receptionist/dashboard');
    } catch (err: any) {
      setError(err.message || 'Receptionist registration failed');
    } finally {
      setSubmitting(false);
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

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center py-16 px-4 sm:px-6">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
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
          {/* Tab Switcher */}
          <div className="flex bg-[#f5f5f7] p-1 rounded-xl mb-6 border border-[#e5e5ea]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white text-[#1d1d1f] shadow-xs'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-white text-[#1d1d1f] shadow-xs'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              Register Desk
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'login' ? (
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
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0066cc]"
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
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0066cc]"
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
          ) : (
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Receptionist Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Clara Oswald"
                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0066cc]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Desk Contact Phone
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555-0188"
                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0066cc]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Email Address (for Login)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="receptionist@domain.com"
                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0066cc]"
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
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] focus:bg-white focus:outline-none focus:border-[#0066cc]"
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
                  {submitting ? 'Creating Desk Account...' : 'Register Receptionist Desk'}
                </AppleButton>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
