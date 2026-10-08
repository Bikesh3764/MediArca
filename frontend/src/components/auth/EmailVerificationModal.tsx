import React, { useState, useEffect, useRef } from 'react';
import { Mail, AlertCircle, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';
import { AppleButton } from '../ui/AppleButton';
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
    // Focus first input on open
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // 60-second countdown timer for resend
  useEffect(() => {
    if (!isOpen || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, countdown]);

  if (!isOpen) return null;

  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric digits
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const nextDigits = [...otpDigits];
      nextDigits[index] = '';
      setOtpDigits(nextDigits);
      return;
    }

    // Single digit entry
    const nextDigits = [...otpDigits];
    nextDigits[index] = cleaned[cleaned.length - 1]; // take last entered digit
    setOtpDigits(nextDigits);
    setError(null);

    // Auto-advance to next input
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      // Move focus back on backspace if current cell is empty
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

    // Focus last filled or next input
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-[440px] bg-white/95 backdrop-blur-xl rounded-t-[24px] sm:rounded-[24px] border border-[#e5e5ea] shadow-apple-float p-6 sm:p-8 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-8 max-h-[90vh] overflow-y-auto text-center animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Mobile Sheet Drag Handle */}
        <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-4" />

        {/* Close / Back button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 sm:top-5 sm:left-5 w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#6e6e73] hover:text-[#1d1d1f] flex items-center justify-center transition-colors cursor-pointer"
          title="Back"
          aria-label="Close modal"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center border border-[#0066cc]/15">
          <Mail className="w-5 h-5" />
        </div>

        {/* Heading */}
        <h3 className="text-section-title">
          Verify Your Email
        </h3>
        <p className="mt-1.5 text-secondary">
          Enter the 6-digit verification code sent to
        </p>
        <p className="font-semibold text-[13px] text-[#1d1d1f] mt-0.5 break-all">
          {email}
        </p>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3.5 rounded-xl bg-[#ff3b30]/8 border border-[#ff3b30]/20 text-[#d70015] text-[13px] flex items-start gap-2.5 text-left animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#ff3b30]" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Resend success alert */}
        {resendSuccess && (
          <div className="mt-4 p-3.5 rounded-xl bg-[#1d8348]/8 border border-[#1d8348]/20 text-[#1d8348] text-[13px] flex items-start gap-2.5 text-left animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#1d8348]" />
            <span className="leading-snug">A new 6-digit code has been sent to your email.</span>
          </div>
        )}

        {/* OTP Input Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="flex justify-center gap-2 sm:gap-2.5 max-w-full" onPaste={handlePaste}>
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
                className={`w-10 h-12 sm:w-12 sm:h-13 text-center text-[18px] sm:text-[20px] font-semibold rounded-xl border transition-all outline-none ${
                  digit
                    ? 'border-[#0066cc] bg-white ring-3 ring-[#0066cc]/12 text-[#1d1d1f]'
                    : 'border-[#d2d2d7] bg-[#f5f5f7]/60 text-[#1d1d1f] focus:border-[#0066cc] focus:bg-white focus:ring-3 focus:ring-[#0066cc]/12'
                }`}
              />
            ))}
          </div>

          <AppleButton
            variant="primary"
            size="lg"
            type="submit"
            disabled={submitting || fullOtp.length !== 6}
            className="w-full"
          >
            {submitting ? 'Verifying Code...' : 'Verify & Continue'}
          </AppleButton>
        </form>

        {/* Resend & help options */}
        <div className="mt-6 pt-5 border-t border-[#f0f0f2] flex flex-col items-center gap-2 text-[13px]">
          <p className="text-[#6e6e73]">
            Didn't receive the email? Check your spam folder or
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={countdown > 0 || resending}
            className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
              countdown > 0 || resending
                ? 'text-[#86868b] cursor-not-allowed opacity-60'
                : 'text-[#0066cc] hover:text-[#0071e3] cursor-pointer'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
            <span>
              {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code now'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
