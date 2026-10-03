import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { api, Appointment } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  UserCheck,
} from 'lucide-react';

export const ClinicCheckIn: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: loadingAuth } = useAuth();

  const clinicId = searchParams.get('clinicId') || '';
  const code = searchParams.get('code') || '';
  const appointmentId = searchParams.get('appointmentId') || undefined;

  const [checkingIn, setCheckingIn] = useState(false);
  const [successData, setSuccessData] = useState<Appointment | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoAttempted, setAutoAttempted] = useState(false);

  // Auto-attempt check-in only when both clinicId and code are present
  useEffect(() => {
    let mounted = true;
    if (loadingAuth || autoAttempted) return;
    if (!user) return; // Will prompt login
    if (!clinicId || !code) return; // Direct visit: show informational guide

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
    if (!clinicId || !code) return;
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

  const hasQueryParams = Boolean(clinicId && code);

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full">
        {/* Apple Clean Header without tacky badges */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight">
            Clinic Check-In
          </h1>
          <p className="text-sm text-[#86868b] mt-1.5">
            Confirm your physical arrival at the clinic.
          </p>
        </div>

        <UtilityCard className="p-6 sm:p-8">
          {/* Direct Visit / Informational Guide (When no QR params in URL) */}
          {!hasQueryParams && !errorMessage && !successData && (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-black/[0.04] text-[#1d1d1f] flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold text-[#1d1d1f] tracking-tight">
                Scan Counter QR Standee
              </h3>
              <p className="text-xs text-[#86868b] mt-1.5 leading-relaxed max-w-xs mx-auto">
                Clinic arrival is confirmed in person by scanning the physical QR standee placed at the reception counter.
              </p>

              {/* Steps Guide */}
              <div className="my-6 p-4 rounded-2xl bg-[#fafafc] border border-[#e5e5ea] text-left space-y-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-black/[0.05] text-[#1d1d1f] text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#1d1d1f]">Arrive at the Clinic</p>
                    <p className="text-[11px] text-[#86868b]">Reach the front desk before your estimated consultation time.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-black/[0.05] text-[#1d1d1f] text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#1d1d1f]">Scan QR Standee</p>
                    <p className="text-[11px] text-[#86868b]">Open your phone camera to scan the desk display.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-black/[0.05] text-[#1d1d1f] text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#1d1d1f]">Arrival Verified</p>
                    <p className="text-[11px] text-[#86868b]">Your queue token updates to 'Arrived' automatically.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {user ? (
                  <AppleButton
                    variant="primary"
                    onClick={() => navigate('/patient/appointments')}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <span>View My Active Passes</span>
                    <ArrowRight className="w-4 h-4" />
                  </AppleButton>
                ) : (
                  <AppleButton
                    variant="primary"
                    onClick={() => navigate('/login?redirect=/patient/appointments')}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <span>Sign In to View Passes</span>
                    <ArrowRight className="w-4 h-4" />
                  </AppleButton>
                )}

                <AppleButton
                  variant="ghost"
                  onClick={() => navigate('/doctors')}
                  className="w-full"
                >
                  Find Doctors & Clinics
                </AppleButton>
              </div>
            </div>
          )}

          {/* Not Logged In Prompt (When valid QR params exist) */}
          {hasQueryParams && !loadingAuth && !user && (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-black/[0.04] text-[#1d1d1f] flex items-center justify-center mx-auto mb-4">
                <UserCheck className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold text-[#1d1d1f] tracking-tight">
                Sign In to Confirm Arrival
              </h3>
              <p className="text-xs text-[#86868b] mt-1.5 leading-relaxed max-w-xs mx-auto">
                Sign in with the phone number or account used to book your token so we can verify your appointment.
              </p>
              <div className="mt-6 space-y-2.5">
                <AppleButton
                  variant="primary"
                  onClick={() => {
                    const currentTarget = `${location.pathname}${location.search}`;
                    navigate(`/login?redirect=${encodeURIComponent(currentTarget)}`);
                  }}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <span>Sign In & Verify</span>
                  <ArrowRight className="w-4 h-4" />
                </AppleButton>
                <AppleButton
                  variant="ghost"
                  onClick={() => {
                    const currentTarget = `${location.pathname}${location.search}`;
                    navigate(`/signup?redirect=${encodeURIComponent(currentTarget)}`);
                  }}
                  className="w-full"
                >
                  New Patient? Create Account
                </AppleButton>
              </div>
            </div>
          )}

          {/* Checking In Loader */}
          {hasQueryParams && checkingIn && (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin mx-auto mb-4"></div>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">Verifying Check-In...</h3>
              <p className="text-xs text-[#86868b] mt-1">Connecting to clinic reception desk...</p>
            </div>
          )}

          {/* Success Check-In Confirmation */}
          {successData && !checkingIn && (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold text-[#1d1d1f] tracking-tight">
                Arrival Confirmed
              </h3>
              <p className="text-xs text-[#86868b] mt-1 max-w-xs mx-auto">
                {successMessage || 'Doctor and front desk have been notified that you are at the clinic.'}
              </p>

              {/* Ticket Capsule */}
              <div className="my-6 p-4 rounded-2xl bg-[#fafafc] border border-[#e5e5ea] text-left space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#86868b]">Queue Token</span>
                  <span className="text-lg font-bold text-[#0066cc]">#{successData.queueNumber}</span>
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
                    <span className="font-medium text-[#1d1d1f] truncate max-w-[200px]">
                      {successData.clinic.clinicName}
                    </span>
                  </div>
                )}
              </div>

              <AppleButton
                variant="primary"
                onClick={() => navigate('/patient/appointments')}
                className="w-full flex items-center justify-center gap-2"
              >
                <span>View Live Queue Pass</span>
                <ArrowRight className="w-4 h-4" />
              </AppleButton>
            </div>
          )}

          {/* Error / Notice State */}
          {hasQueryParams && errorMessage && !checkingIn && !successData && (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-[#1d1d1f]">Check-In Notice</h3>
              <p className="text-xs text-[#555558] bg-[#fafafc] p-3.5 rounded-xl border border-[#e5e5ea] mt-3 leading-relaxed text-left">
                {errorMessage}
              </p>

              <div className="mt-6 flex flex-col gap-2.5">
                <AppleButton variant="primary" onClick={handleManualCheckIn}>
                  Try Again
                </AppleButton>
                <AppleButton variant="ghost" onClick={() => navigate('/patient/appointments')}>
                  Go to My Appointments
                </AppleButton>
              </div>
            </div>
          )}
        </UtilityCard>
      </div>
    </div>
  );
};
