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
    try {
      await api.resendEmailOtp(email);
      setResendSuccess(true);
      setCountdown(60);
      setOtpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white/95 backdrop-blur-xl rounded-[24px] sm:rounded-[28px] border border-[#e5e5ea] shadow-2xl p-5 sm:p-8 text-center">
        {/* Close / Back button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 sm:top-5 sm:left-5 p-2 rounded-full hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] transition-colors"
          title="Back to registration"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-3 sm:mb-4 rounded-2xl bg-[#0088e8]/10 text-[#0088e8] flex items-center justify-center border border-[#0088e8]/20 shadow-xs">
          <Mail className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>

        {/* Heading */}
        <h3 className="text-xl sm:text-2xl font-semibold text-[#1d1d1f] tracking-tight">
          Verify Your Email
        </h3>
        <p className="mt-2 text-xs sm:text-sm text-[#86868b] leading-relaxed">
          We have sent a 6-digit verification code to
        </p>
        <p className="font-semibold text-xs sm:text-sm text-[#1d1d1f] mt-0.5 break-all">
          {email}
        </p>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 text-left animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Resend success alert */}
        {resendSuccess && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 text-left animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>New 6-digit code has been sent to your email!</span>
          </div>
        )}

        {/* OTP Input Form */}
        <form onSubmit={handleSubmit} className="mt-5 sm:mt-6">
          <div className="flex justify-center gap-1.5 sm:gap-2.5 mb-5 sm:mb-6 max-w-full" onPaste={handlePaste}>
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
                className={`w-9 h-11 sm:w-12 sm:h-14 text-center text-lg sm:text-2xl font-bold rounded-lg sm:rounded-xl border transition-all outline-none font-mono ${
                  digit
                    ? 'border-[#0088e8] bg-white ring-2 ring-[#0088e8]/20 text-[#1d1d1f]'
                    : 'border-[#e5e5ea] bg-[#f5f5f7] text-[#1d1d1f] focus:border-[#0088e8] focus:bg-white focus:ring-2 focus:ring-[#0088e8]/20'
                }`}
              />
            ))}
          </div>

          <AppleButton
            variant="primary"
            size="md"
            type="submit"
            disabled={submitting || fullOtp.length !== 6}
            className="w-full"
          >
            {submitting ? 'Verifying Code...' : 'Verify & Continue'}
          </AppleButton>
        </form>

        {/* Resend & help options */}
        <div className="mt-5 pt-4 border-t border-[#f0f0f0] flex flex-col items-center gap-2 text-xs">
          <p className="text-[#86868b]">
            Didn't receive the email? Check your spam folder or
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={countdown > 0 || resending}
            className={`inline-flex items-center gap-1.5 font-semibold transition-colors ${
              countdown > 0 || resending
                ? 'text-[#86868b] cursor-not-allowed opacity-60'
                : 'text-[#0088e8] hover:text-[#0077cc] cursor-pointer'
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
