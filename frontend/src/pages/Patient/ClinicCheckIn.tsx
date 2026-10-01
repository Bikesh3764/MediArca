import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { api, Appointment } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  MapPin,
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

  // Auto-attempt check-in once user is loaded
  useEffect(() => {
    let mounted = true;
    if (loadingAuth || autoAttempted) return;
    if (!user) return; // Will prompt login

    queueMicrotask(async () => {
      if (!mounted) return;
      if (!clinicId || !code) {
        setErrorMessage('Invalid QR check-in link. Please scan the official physical QR poster located at the clinic desk.');
        return;
      }

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

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f5f5f7] text-[#0088e8] border border-[#e5e5ea] text-xs font-semibold mb-3">
            <MapPin className="w-3.5 h-3.5 text-[#0088e8]" />
            <span>Clinic Arrival Check-In</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1d1d1f] tracking-tight">
            Clinic Check-In
          </h1>
          <p className="text-xs text-[#86868b] mt-1">
            Confirm your arrival at the clinic.
          </p>
        </div>

        <UtilityCard className="p-6 sm:p-8">
          {/* Missing Parameters / Tampered Link Alert */}
          {(!clinicId || !code) && !errorMessage && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-[#1d1d1f]">Invalid Check-In Link</h3>
              <p className="text-xs text-[#86868b] mt-2 leading-relaxed">
                Clinic arrival can only be verified by scanning the physical QR poster displayed inside the clinic facility.
              </p>
              <div className="mt-6">
                <AppleButton variant="primary" onClick={() => navigate('/patient/appointments')} className="w-full">
                  Return to My Passes
                </AppleButton>
              </div>
            </div>
          )}

          {/* Not Logged In Prompt */}
          {!loadingAuth && !user && clinicId && code && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-[#0088e8]/10 text-[#0088e8] flex items-center justify-center mx-auto mb-4">
                <UserCheck className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-[#1d1d1f]">Sign In to Confirm Arrival</h3>
              <p className="text-xs text-[#86868b] mt-2 leading-relaxed">
                Please sign in with the phone number or account used to book your queue token so we can match your appointment.
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
                  <span>Sign In & Verify Check-In</span>
                  <ArrowRight className="w-4 h-4" />
                </AppleButton>
                <AppleButton
                  variant="secondary"
                  onClick={() => {
                    const currentTarget = `${location.pathname}${location.search}`;
                    navigate(`/signup?redirect=${encodeURIComponent(currentTarget)}`);
                  }}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <span>New Patient? Create Account</span>
                </AppleButton>
              </div>
            </div>
          )}

          {/* Checking In Loader */}
          {checkingIn && (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-full border-3 border-[#0088e8] border-t-transparent animate-spin mx-auto mb-4"></div>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">Verifying Check-In...</h3>
              <p className="text-xs text-[#86868b] mt-1">Confirming arrival with clinic...</p>
            </div>
          )}

          {/* Success Check-In Confirmation */}
          {successData && !checkingIn && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50/50 animate-fadeIn">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/60 px-3 py-1 rounded-full border border-emerald-300">
                You Are Checked In 📍
              </span>
              <h3 className="text-xl font-bold text-[#1d1d1f] tracking-tight mt-3">
                Welcome to Clinic
              </h3>
              <p className="text-xs text-[#86868b] mt-1">
                {successMessage || 'Doctor and reception desk have been notified that you are at the clinic.'}
              </p>

              {/* Ticket Capsule */}
              <div className="my-6 p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#86868b]">Queue Token</span>
                  <span className="text-lg font-bold text-[#0088e8]">#{successData.queueNumber}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#86868b]">Doctor</span>
                  <span className="font-semibold text-[#1d1d1f]">
                    {successData.doctor?.user?.fullName ? (successData.doctor.user.fullName.startsWith('Dr.') ? successData.doctor.user.fullName : `Dr. ${successData.doctor.user.fullName}`) : 'Doctor'}
                  </span>
                </div>
                {successData.clinic && (
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-[#e5e5ea]">
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
                <span>View My Live Queue Pass</span>
                <ArrowRight className="w-4 h-4" />
              </AppleButton>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && !checkingIn && !successData && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-[#1d1d1f]">Check-In Notice</h3>
              <p className="text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200 mt-3 leading-relaxed">
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
