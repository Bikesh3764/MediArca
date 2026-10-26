import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { api, Appointment } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

export const ClinicCheckIn: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: loadingAuth } = useAuth();

  const clinicId = searchParams.get('clinicId') || '';
  const code = searchParams.get('code') || searchParams.get('checkinCode') || undefined;
  const appointmentId = searchParams.get('appointmentId') || undefined;

  const [checkingIn, setCheckingIn] = useState(false);
  const [successData, setSuccessData] = useState<Appointment | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoAttempted, setAutoAttempted] = useState(false);

  // Auto-attempt check-in when clinicId is present from QR scan
  useEffect(() => {
    let mounted = true;
    if (loadingAuth || autoAttempted) return;
    if (!user) return; // Will prompt login
    if (!clinicId) return; // Direct visit: show informational guide

    queueMicrotask(async () => {
      if (!mounted) return;

      setCheckingIn(true);
      setErrorMessage(null);
      try {
        const res: any = await api.checkInWithQR({
          clinicId,
          code,
          appointmentId,
        });

        if (!mounted) return;
        const apptData = res?.id ? res : (res?.data || null);
        if (apptData) {
          setSuccessData(apptData);
          setSuccessMessage(res?.message || 'Arrival confirmed! You are checked in at the clinic desk.');
        } else {
          setErrorMessage(res?.message || 'Failed to check in.');
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error('Check-in error:', err);
        setErrorMessage(err.message || 'Unable to verify arrival. Please ask reception desk to check you in.');
      } finally {
        if (mounted) {
          setCheckingIn(false);
          setAutoAttempted(true);
        }
      }
    });

    return () => {
      mounted = false;
    };
  }, [user, loadingAuth, clinicId, code, appointmentId, autoAttempted]);

  const handleManualCheckIn = async () => {
    if (!clinicId) return;
    setCheckingIn(true);
    setErrorMessage(null);
    try {
      const res: any = await api.checkInWithQR({
        clinicId,
        code,
        appointmentId,
      });

      const apptData = res?.id ? res : (res?.data || null);
      if (apptData) {
        setSuccessData(apptData);
        setSuccessMessage(res?.message || 'Arrival confirmed! You are checked in at the clinic desk.');
      } else {
        setErrorMessage(res?.message || 'Failed to check in.');
      }
    } catch (err: any) {
      console.error('Check-in error:', err);
      setErrorMessage(err.message || 'Unable to verify arrival. Please ask reception desk to check you in.');
    } finally {
      setCheckingIn(false);
    }
  };

  const hasQueryParams = Boolean(clinicId);

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4 sm:p-6 pb-24 sm:pb-6 pb-safe">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl border border-[#e5e5ea]  p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
              Clinic Check-In
            </h1>
            <p className="text-[13px] text-[#86868b] mt-1 leading-relaxed">
              Confirm your physical arrival at the clinic.
            </p>
          </div>

          {/* Direct Visit / Informational Guide (When no QR params in URL) */}
          {!hasQueryParams && !errorMessage && !successData && (
            <div className="space-y-5">
              {/* Steps Guide */}
              <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1d1d1f]">Arrive at the Clinic</p>
                    <p className="text-[11px] text-[#86868b] mt-0.5">Reach the front desk before your time.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1d1d1f]">Scan QR Code</p>
                    <p className="text-[11px] text-[#86868b] mt-0.5">Open your phone camera to scan the reception desk display.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1d1d1f]">Arrival Verified</p>
                    <p className="text-[11px] text-[#86868b] mt-0.5">Your queue token updates to Arrived automatically.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {user ? (
                  <button
                    type="button"
                    onClick={() => navigate('/patient/appointments')}
                    className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center gap-2 cursor-pointer select-none"
                  >
                    <span>View My Active Passes</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate('/login?redirect=/patient/appointments')}
                    className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center gap-2 cursor-pointer select-none"
                  >
                    <span>Sign In to View Passes</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => navigate('/doctors')}
                  className="w-full h-11 px-6 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] active:scale-[0.98] text-[#1d1d1f] border border-[#e5e5ea] text-sm font-normal transition-all duration-150 flex items-center justify-center cursor-pointer select-none"
                >
                  Find Doctors & Clinics
                </button>
              </div>
            </div>
          )}

          {/* Not Logged In Prompt (When valid QR params exist) */}
          {hasQueryParams && !loadingAuth && !user && (
            <div className="space-y-5">
              <p className="text-xs text-[#86868b] leading-relaxed">
                Sign in with the account you booked with.
              </p>
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const currentTarget = `${location.pathname}${location.search}`;
                    navigate(`/login?redirect=${encodeURIComponent(currentTarget)}`);
                  }}
                  className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center gap-2 cursor-pointer select-none"
                >
                  <span>Sign In & Verify</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const currentTarget = `${location.pathname}${location.search}`;
                    navigate(`/signup?redirect=${encodeURIComponent(currentTarget)}`);
                  }}
                  className="w-full h-11 px-6 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] active:scale-[0.98] text-[#1d1d1f] border border-[#e5e5ea] text-sm font-normal transition-all duration-150 flex items-center justify-center cursor-pointer select-none"
                >
                  New Patient? Create Account
                </button>
              </div>
            </div>
          )}

          {/* Checking In Loader */}
          {hasQueryParams && checkingIn && (
            <div className="text-center py-8">
              <div className="w-8 h-8 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin mx-auto mb-3"></div>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">Verifying Check-In...</h3>
              <p className="text-xs text-[#86868b] mt-1">Connecting to clinic reception desk...</p>
            </div>
          )}

          {/* Success Check-In Confirmation */}
          {successData && !checkingIn && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center gap-2.5 text-xs text-[#1d1d1f]">
                <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0" />
                <span className="font-normal">
                  {successMessage || 'Arrival confirmed! Doctor and front desk have been notified.'}
                </span>
              </div>

              {/* Ticket Capsule */}
              <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#86868b]">Queue Token</span>
                  <span className="text-lg font-semibold text-[#0066cc]">#{successData.queueNumber}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#86868b]">Doctor</span>
                  <span className="font-semibold text-[#1d1d1f]">
                    {successData.doctor?.user?.fullName
                      ? (successData.doctor.user.fullName.startsWith('Dr.')
                          ? successData.doctor.user.fullName
                          : `Dr. ${successData.doctor.user.fullName}`)
                      : 'Doctor'}
                  </span>
                </div>
                {successData.clinic && (
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-[#e5e5ea]">
                    <span className="text-[#86868b]">Clinic Venue</span>
                    <span className="font-normal text-[#1d1d1f] truncate max-w-[200px]">
                      {successData.clinic.clinicName}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => navigate('/patient/appointments')}
                className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center gap-2 cursor-pointer select-none"
              >
                <span>View Live Queue Pass</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Error / Notice State */}
          {hasQueryParams && errorMessage && !checkingIn && !successData && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-2xl bg-danger-soft/80 border border-danger-line/80 text-danger text-xs flex items-start gap-2.5 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleManualCheckIn}
                  className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center cursor-pointer select-none"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/patient/appointments')}
                  className="w-full h-11 px-6 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] active:scale-[0.98] text-[#1d1d1f] border border-[#e5e5ea] text-sm font-normal transition-all duration-150 flex items-center justify-center cursor-pointer select-none"
                >
                  Go to My Appointments
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
