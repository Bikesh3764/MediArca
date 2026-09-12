import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { AlertCircle, UserCheck, Stethoscope } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { isGoogleConfigured } from '../../config/auth';

export const Signup: React.FC = () => {
  const [role, setRole] = useState<'PATIENT' | 'DOCTOR'>('PATIENT');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Doctor specific fields
  const [specialty, setSpecialty] = useState('General Medicine');
  const [qualifications, setQualifications] = useState('');
  const [experienceYears, setExperienceYears] = useState('5');
  const [consultationFee, setConsultationFee] = useState('60');
  const [checkingStartTime, setCheckingStartTime] = useState('09:00');
  const [checkingEndTime, setCheckingEndTime] = useState('13:00');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload: any = {
        fullName,
        email,
        password,
        phone,
        role,
      };

      if (role === 'DOCTOR') {
        payload.specialty = specialty;
        payload.qualifications = qualifications || 'MBBS, MD';
        payload.experienceYears = Number(experienceYears) || 1;
        payload.consultationFee = Number(consultationFee) || 50;
        payload.checkingStartTime = checkingStartTime;
        payload.checkingEndTime = checkingEndTime;
      }

      const registered = await register(payload);
      if (registered.role === 'DOCTOR') {
        navigate('/doctor/dashboard');
      } else if (registered.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/patient/doctors');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (credentialResponse.credential) {
      setError(null);
      setSubmitting(true);
      try {
        const loggedUser = await loginWithGoogle(credentialResponse.credential, role);
        if (loggedUser.role === 'DOCTOR') {
          navigate('/doctor/dashboard');
        } else if (loggedUser.role === 'ADMIN') {
          navigate('/admin');
        } else {
          navigate('/patient/doctors');
        }
      } catch (err: any) {
        setError(err.message || 'Google sign-up authentication failed');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleSimulatedGoogleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
      const payload = btoa(
        JSON.stringify({
          email: role === 'DOCTOR' ? 'dr.alex.google@example.com' : 'alex.google@example.com',
          name: role === 'DOCTOR' ? 'Dr. Alex Rivera (Google)' : 'Alex Rivera (Google)',
          picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
        })
      );
      const simulatedToken = `${header}.${payload}.signature`;
      const loggedUser = await loginWithGoogle(simulatedToken, role);
      if (loggedUser.role === 'DOCTOR') {
        navigate('/doctor/dashboard');
      } else if (loggedUser.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/patient/doctors');
      }
    } catch (err: any) {
      setError(err.message || 'Simulated Google sign-up failed');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-block mb-4 hover:opacity-90 transition-opacity">
          <BrandLogo variant="full" size="lg" imgClassName="h-9 w-auto mx-auto" />
        </Link>
        <h2 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">
          Create your account
        </h2>
        <p className="mt-2 text-sm text-[#7a7a7a]">
          Already have an account?{' '}
          <Link to="/login" className="text-[#0088e8] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        {/* Role Selector Tabs (Apple Pill Segmented Control) */}
        <div className="bg-white/80 p-1 rounded-full border border-[#e0e0e0] flex max-w-sm mx-auto mb-6 shadow-sm">
          <button
            type="button"
            onClick={() => setRole('PATIENT')}
            className={`flex-1 py-2 rounded-full text-xs font-medium transition-all flex items-center justify-center gap-2 ${
              role === 'PATIENT'
                ? 'bg-gradient-to-r from-[#0088e8] to-[#10b981] text-white shadow-sm font-semibold'
                : 'text-[#7a7a7a] hover:text-[#1d1d1f]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            I am a Patient
          </button>
          <button
            type="button"
            onClick={() => setRole('DOCTOR')}
            className={`flex-1 py-2 rounded-full text-xs font-medium transition-all flex items-center justify-center gap-2 ${
              role === 'DOCTOR'
                ? 'bg-gradient-to-r from-[#0088e8] to-[#10b981] text-white shadow-sm font-semibold'
                : 'text-[#7a7a7a] hover:text-[#1d1d1f]'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            I am a Doctor
          </button>
        </div>

        <div className="bg-white py-8 px-6 sm:px-10 rounded-[20px] border border-[#e0e0e0] shadow-sm">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign-In */}
          <div className="mb-6">
            <div className="flex justify-center">
              {isGoogleConfigured ? (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google sign-up failed')}
                  shape="pill"
                  size="large"
                  text="signup_with"
                  width="320"
                />
              ) : (
                <div className="w-full space-y-2">
                  <button
                    type="button"
                    onClick={handleSimulatedGoogleLogin}
                    className="w-full h-11 px-4 rounded-full border border-[#e0e0e0] bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] text-sm font-medium transition-all shadow-sm flex items-center justify-center gap-3"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Sign up with Google (Demo {role === 'DOCTOR' ? 'Doctor' : 'Patient'})</span>
                  </button>
                  <p className="text-[11px] text-center text-[#7a7a7a]">
                    To connect live Google credentials, add <span className="font-mono text-[10px] bg-gray-100 px-1 py-0.5 rounded">VITE_GOOGLE_CLIENT_ID</span>.
                  </p>
                </div>
              )}
            </div>

            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e0e0e0]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-[#7a7a7a]">or sign up with email</span>
              </div>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={role === 'DOCTOR' ? 'Dr. Jane Smith' : 'John Doe'}
                className="w-full h-11 px-4 rounded-xl border border-[#e0e0e0] text-[15px] focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full h-11 px-4 rounded-xl border border-[#e0e0e0] text-[15px] focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555-0199"
                  className="w-full h-11 px-4 rounded-xl border border-[#e0e0e0] text-[15px] focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20"
                />
              </div>
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
                placeholder="Minimum 6 characters"
                className="w-full h-11 px-4 rounded-xl border border-[#e0e0e0] text-[15px] focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20"
              />
            </div>

            {/* Doctor-Specific Details */}
            {role === 'DOCTOR' && (
              <div className="pt-3 border-t border-[#f0f0f0] space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                      Specialty
                    </label>
                    <select
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-[#e0e0e0] text-[14px] bg-white focus:outline-none focus:border-[#0088e8]"
                    >
                      <option value="Cardiology">Cardiology</option>
                      <option value="Dermatology">Dermatology</option>
                      <option value="Pediatrics">Pediatrics</option>
                      <option value="Orthopedics">Orthopedics</option>
                      <option value="General Medicine">General Medicine</option>
                      <option value="Neurology">Neurology</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                      Qualifications
                    </label>
                    <input
                      type="text"
                      value={qualifications}
                      onChange={(e) => setQualifications(e.target.value)}
                      placeholder="MD, MBBS, etc."
                      className="w-full h-11 px-4 rounded-xl border border-[#e0e0e0] text-[14px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                      Checking Start Time
                    </label>
                    <input
                      type="time"
                      value={checkingStartTime}
                      onChange={(e) => setCheckingStartTime(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-[#e0e0e0] text-[14px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                      Checking End Time
                    </label>
                    <input
                      type="time"
                      value={checkingEndTime}
                      onChange={(e) => setCheckingEndTime(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-[#e0e0e0] text-[14px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                      Experience (Years)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-[#e0e0e0] text-[14px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                      Consultation Fee ($ USD)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={consultationFee}
                      onChange={(e) => setConsultationFee(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-[#e0e0e0] text-[14px]"
                    />
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                  Notice: Doctor accounts require administrative verification before appearing in public searches.
                </div>
              </div>
            )}

            <div className="pt-3">
              <AppleButton
                variant="primary"
                size="md"
                type="submit"
                disabled={submitting}
                className="w-full"
              >
                {submitting ? 'Creating Account...' : 'Complete Registration'}
              </AppleButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
