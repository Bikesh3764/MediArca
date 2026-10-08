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
    if (!user) return;
    if (!clinicId || !code) return;

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
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#f5f5f7] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-[440px] w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-[24px] sm:text-[28px] font-bold text-[#1d1d1f] tracking-tight">
            Clinic Check-In
          </h1>
          <p className="text-secondary mt-1.5">
            Confirm your physical arrival at the clinic.
          </p>
        </div>

        <UtilityCard className="p-6 sm:p-8">
          {/* 1. Direct Visit / Informational Guide (When no QR params in URL) */}
          {!hasQueryParams && !errorMessage && !successData && (
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-section-title">
                Scan Counter QR Standee
              </h3>
              <p className="text-secondary mt-1.5 max-w-xs mx-auto">
                Clinic arrival is confirmed in person by scanning the physical QR standee placed at the reception counter.
              </p>

              {/* Steps Guide */}
              <div className="my-6 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-left space-y-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#1d1d1f]">Arrive at the Clinic</p>
                    <p className="text-xs text-[#6e6e73] mt-0.5">Reach the front desk before your estimated consultation time.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#1d1d1f]">Scan QR Standee</p>
                    <p className="text-xs text-[#6e6e73] mt-0.5">Open your phone camera or My Passes scanner to scan the desk display.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#1d1d1f]">Arrival Verified</p>
                    <p className="text-xs text-[#6e6e73] mt-0.5">Your queue token updates to Checked In automatically.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {user ? (
                  <AppleButton
                    variant="primary"
                    size="lg"
                    onClick={() => navigate('/patient/appointments')}
                    className="w-full"
                  >
                    <span>View My Active Passes</span>
                    <ArrowRight className="w-4 h-4" />
                  </AppleButton>
                ) : (
                  <AppleButton
                    variant="primary"
                    size="lg"
                    onClick={() => navigate('/login?redirect=/patient/appointments')}
                    className="w-full"
                  >
                    <span>Sign In to View Passes</span>
                    <ArrowRight className="w-4 h-4" />
                  </AppleButton>
                )}

                <AppleButton
                  variant="ghost"
                  size="md"
                  onClick={() => navigate('/doctors')}
                  className="w-full"
                >
                  Find Doctors & Clinics
                </AppleButton>
              </div>
            </div>
          )}

          {/* 2. Not Logged In Prompt (When valid QR params exist) */}
          {hasQueryParams && !loadingAuth && !user && (
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center mx-auto mb-4">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-section-title">
                Sign In to Confirm Arrival
              </h3>
              <p className="text-secondary mt-1.5 max-w-xs mx-auto">
                Sign in with the account used to book your token so we can verify your appointment.
              </p>
              <div className="mt-6 space-y-2.5">
                <AppleButton
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    const currentTarget = `${location.pathname}${location.search}`;
                    navigate(`/login?redirect=${encodeURIComponent(currentTarget)}`);
                  }}
                  className="w-full"
                >
                  <span>Sign In & Verify</span>
                  <ArrowRight className="w-4 h-4" />
                </AppleButton>
                <AppleButton
                  variant="ghost"
                  size="md"
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

          {/* 3. Checking In Loader */}
          {hasQueryParams && checkingIn && (
            <div className="text-center py-8">
              <div className="w-9 h-9 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin mx-auto mb-4"></div>
              <h3 className="text-card-title">Verifying Check-In...</h3>
              <p className="text-secondary mt-1">Connecting to clinic reception desk...</p>
            </div>
          )}

          {/* 4. Success Check-In Confirmation */}
          {successData && !checkingIn && (
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-section-title">
                Arrival Confirmed
              </h3>
              <p className="text-secondary mt-1.5 max-w-xs mx-auto">
                {successMessage || 'Doctor and front desk have been notified that you are at the clinic.'}
              </p>

              {/* Ticket Capsule */}
              <div className="my-6 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-left space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-meta uppercase tracking-wider font-semibold">Queue Token</span>
                  <span className="text-2xl font-bold text-[#0066cc] tracking-tight">#{successData.queueNumber}</span>
                </div>
                <div className="flex items-center justify-between text-[13px] pt-2 border-t border-[#e5e5ea]">
                  <span className="text-[#6e6e73]">Doctor</span>
                  <span className="font-semibold text-[#1d1d1f]">
                    {successData.doctor?.user?.fullName
                      ? (successData.doctor.user.fullName.startsWith('Dr.')
                          ? successData.doctor.user.fullName
                          : `Dr. ${successData.doctor.user.fullName}`)
                      : 'Doctor'}
                  </span>
                </div>
                {successData.clinic && (
                  <div className="flex items-center justify-between text-[13px] pt-2 border-t border-[#e5e5ea]">
                    <span className="text-[#6e6e73]">Clinic Venue</span>
                    <span className="font-medium text-[#1d1d1f] truncate max-w-[200px]">
                      {successData.clinic.clinicName}
                    </span>
                  </div>
                )}
              </div>

              <AppleButton
                variant="primary"
                size="lg"
                onClick={() => navigate('/patient/appointments')}
                className="w-full"
              >
                <span>View Live Queue Pass</span>
                <ArrowRight className="w-4 h-4" />
              </AppleButton>
            </div>
          )}

          {/* 5. Error / Notice State */}
          {hasQueryParams && errorMessage && !checkingIn && !successData && (
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-section-title">Check-In Notice</h3>
              <p className="text-[13px] text-[#1d1d1f] bg-[#f5f5f7] p-4 rounded-xl border border-[#e5e5ea] mt-3 leading-relaxed text-left">
                {errorMessage}
              </p>

              <div className="mt-6 flex flex-col gap-2.5">
                <AppleButton variant="primary" size="lg" onClick={handleManualCheckIn} className="w-full">
                  Try Again
                </AppleButton>
                <AppleButton variant="ghost" size="md" onClick={() => navigate('/patient/appointments')} className="w-full">
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
