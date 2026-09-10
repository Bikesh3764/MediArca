import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { Activity, AlertCircle, Sparkles } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate('/doctors');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string, demoPass: string, redirectPath = '/doctors') => {
    setError(null);
    setSubmitting(true);
    try {
      await login({ email: demoEmail, password: demoPass });
      navigate(redirectPath);
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (credentialResponse.credential) {
      setError(null);
      setSubmitting(true);
      try {
        await loginWithGoogle(credentialResponse.credential, 'PATIENT');
        navigate('/doctors');
      } catch (err: any) {
        setError(err.message || 'Google sign-in authentication failed');
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Demo Google Sign-in simulation (for testing before user inputs their Google Client ID)
  const handleSimulatedGoogleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      // Mock Google JWT structure
      const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
      const payload = btoa(
        JSON.stringify({
          email: 'alex.google@example.com',
          name: 'Alex Rivera (Google)',
          picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
        })
      );
      const simulatedToken = `${header}.${payload}.signature`;
      await loginWithGoogle(simulatedToken, 'PATIENT');
      navigate('/doctors');
    } catch (err: any) {
      setError(err.message || 'Simulated Google login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-4">
          <Activity className="w-8 h-8 text-[#0066cc]" />
          <span className="font-semibold text-2xl text-[#1d1d1f] tracking-tight">MediArca</span>
        </Link>
        <h2 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">
          Sign in to your account
        </h2>
        <p className="mt-2 text-sm text-[#7a7a7a]">
          Or{' '}
          <Link to="/signup" className="text-[#0066cc] font-medium hover:underline">
            create a new MediArca account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Instant Demo Accounts Banner */}
        <div className="bg-white/90 border border-[#e0e0e0] rounded-2xl p-4 mb-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[#1d1d1f]">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Instant 1-Click Startup Demo Logins:</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('john.doe@gmail.com', 'patient123', '/patient/appointments')}
              className="px-2.5 py-2 rounded-xl bg-[#f5f5f7] hover:bg-[#0066cc]/10 text-[#0066cc] border border-[#e0e0e0] text-xs font-medium transition-all text-center"
            >
              Patient<br />(John Doe)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('dr.sarah@mediarca.com', 'doctor123', '/doctor/dashboard')}
              className="px-2.5 py-2 rounded-xl bg-[#f5f5f7] hover:bg-[#0066cc]/10 text-[#0066cc] border border-[#e0e0e0] text-xs font-medium transition-all text-center"
            >
              Doctor<br />(Dr. Sarah)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin@mediarca.com', 'admin123', '/admin')}
              className="px-2.5 py-2 rounded-xl bg-[#f5f5f7] hover:bg-[#0066cc]/10 text-amber-600 border border-[#e0e0e0] text-xs font-medium transition-all text-center"
            >
              Admin<br />(Verification)
            </button>
          </div>
        </div>

        {/* Regular Login Form */}
        <div className="bg-white py-8 px-6 sm:px-10 rounded-[20px] border border-[#e0e0e0] shadow-sm">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign-In Container */}
          <div className="mb-6">
            <div className="flex flex-col items-center justify-center gap-2.5">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google Sign-In was cancelled or failed')}
                shape="pill"
                size="large"
                text="continue_with"
                width="320"
              />

              {/* Instant Test Button (for testing before Google Cloud credentials are configured) */}
              <button
                type="button"
                onClick={handleSimulatedGoogleLogin}
                className="text-[11px] text-[#7a7a7a] hover:text-[#0066cc] transition-colors underline"
              >
                (Test Google Sign-In Flow Instant Demo)
              </button>
            </div>

            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e0e0e0]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-[#7a7a7a]">or sign in with email</span>
              </div>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full h-11 px-4 rounded-xl border border-[#e0e0e0] text-[15px] focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0071e3]/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-4 rounded-xl border border-[#e0e0e0] text-[15px] focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0071e3]/20"
              />
            </div>

            <div className="pt-2">
              <AppleButton
                variant="primary"
                size="md"
                type="submit"
                disabled={submitting}
                className="w-full"
              >
                {submitting ? 'Authenticating...' : 'Sign In'}
              </AppleButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
