import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { Activity, AlertCircle, UserCheck, Stethoscope } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

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

      await register(payload);
      if (role === 'DOCTOR') {
        navigate('/doctor/dashboard');
      } else {
        navigate('/doctors');
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
        await loginWithGoogle(credentialResponse.credential, role);
        if (role === 'DOCTOR') {
          navigate('/doctor/dashboard');
        } else {
          navigate('/doctors');
        }
      } catch (err: any) {
        setError(err.message || 'Google sign-up authentication failed');
      } finally {
        setSubmitting(false);
      }
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
          Create your account
        </h2>
        <p className="mt-2 text-sm text-[#7a7a7a]">
          Already have an account?{' '}
          <Link to="/login" className="text-[#0066cc] font-medium hover:underline">
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
                ? 'bg-[#0066cc] text-white shadow-sm'
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
                ? 'bg-[#0066cc] text-white shadow-sm'
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
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google sign-up failed')}
                shape="pill"
                size="large"
                text="signup_with"
                width="320"
              />
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
                className="w-full h-11 px-4 rounded-xl border border-[#e0e0e0] text-[15px] focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0071e3]/20"
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
                  className="w-full h-11 px-4 rounded-xl border border-[#e0e0e0] text-[15px] focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0071e3]/20"
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
                  className="w-full h-11 px-4 rounded-xl border border-[#e0e0e0] text-[15px] focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0071e3]/20"
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
                className="w-full h-11 px-4 rounded-xl border border-[#e0e0e0] text-[15px] focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0071e3]/20"
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
                      className="w-full h-11 px-3 rounded-xl border border-[#e0e0e0] text-[14px] bg-white focus:outline-none focus:border-[#0066cc]"
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
