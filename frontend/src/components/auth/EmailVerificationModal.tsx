import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';
import { api, User } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface EmailVerificationModalProps {
  isOpen: boolean;
  email: string;
  onSuccess: (user: User) => void;
  onClose: () => void;
}

export const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  isOpen,
  email,
  onSuccess,
  onClose,
}) => {
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { verifyOtp } = useAuth();

  useEffect(() => {
    if (!isOpen) {
      queueMicrotask(() => {
        setOtpDigits(['', '', '', '', '', '']);
        setError(null);
        setResendSuccess(false);
        setCountdown(60);
      });
      return;
    }
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, countdown]);

  if (!isOpen) return null;

  const handleDigitChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const nextDigits = [...otpDigits];
      nextDigits[index] = '';
      setOtpDigits(nextDigits);
      return;
    }

    const nextDigits = [...otpDigits];
    nextDigits[index] = cleaned[cleaned.length - 1];
    setOtpDigits(nextDigits);
    setError(null);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const nextDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      nextDigits[i] = pasted[i] || '';
    }
    setOtpDigits(nextDigits);
    setError(null);

    const nextFocusIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextFocusIndex]?.focus();
  };

  const fullOtp = otpDigits.join('');

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (fullOtp.length !== 6) {
      setError('Please enter all 6 digits of your verification code.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const verifiedUser = await verifyOtp(email, fullOtp);
      onSuccess(verifiedUser);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setError(null);
    setResending(true);
    const safetyTimer = setTimeout(() => setResending(false), 6000);
    try {
      await api.resendEmailOtp(email);
      clearTimeout(safetyTimer);
      setResendSuccess(true);
      setCountdown(60);
      setOtpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err: any) {
      clearTimeout(safetyTimer);
      setError(err.message || 'Failed to resend verification code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-[450px] bg-white/95 backdrop-blur-2xl rounded-t-[28px] sm:rounded-[28px] border border-[#e5e5ea] shadow-[0_24px_64px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.04)] p-6 sm:p-7 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-7 text-center animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
        {/* Apple Sheet Drag Handle Indicator (Mobile Only) */}
        <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-4" />

        {/* Close / Back button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 sm:top-5 sm:left-5 p-2 rounded-full hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Brand & Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="mb-2.5">
            <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto object-contain mx-auto" />
          </div>
          <h3 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
            Verify Your Email
          </h3>
          <p className="mt-1.5 text-xs text-[#86868b]">
            Enter the 6-digit code sent to <span className="font-medium text-[#1d1d1f]">{email}</span>
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Resend success alert */}
        {resendSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center gap-2 text-left">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#0066cc]" />
            <span>A new 6-digit code has been sent.</span>
          </div>
        )}

        {/* OTP Input Form */}
        <form onSubmit={handleSubmit}>
          <div className="flex justify-center gap-2 mb-5 max-w-full" onPaste={handlePaste}>
            {otpDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className="w-11 h-12 text-center text-lg font-semibold rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={submitting || fullOtp.length !== 6}
            className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-medium transition-all duration-150 shadow-[0_2px_8px_rgba(0,102,204,0.2),0_1px_2px_rgba(0,0,0,0.06)] flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              'Verify & Continue'
            )}
          </button>
        </form>

        {/* Resend option */}
        <div className="mt-5 pt-4 border-t border-[#e5e5ea] flex items-center justify-center text-xs">
          <button
            type="button"
            onClick={handleResend}
            disabled={countdown > 0 || resending}
            className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
              countdown > 0 || resending
                ? 'text-[#86868b] cursor-not-allowed'
                : 'text-[#0066cc] hover:text-[#0071e3] cursor-pointer'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
            <span>
              {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

