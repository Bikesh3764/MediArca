import React, { useCallback, useState } from 'react';
import { Building2, CheckCircle2, Clock, Phone, Search, Users } from 'lucide-react';
import { api, WalkinTrackResult, formatDisplayDate, cleanSlotName, getFileUrl } from '../../services/api';
import { SubNav } from '../../components/layout/SubNav';
import { AvatarImage } from '../../components/ui/AvatarImage';
import { CabinStatusBadge } from '../../components/ui/DoctorCabinPresence';
import { formatDisplayPhone, isValidIndianPhone, sanitizeIndianPhone, toTelUri } from '../../utils/phoneUtils';
import { useVisibilityPolling } from '../../utils/useVisibilityPolling';

const CODE_CHARS = /[^A-HJKMNP-Z2-9]/g;

const cleanCodeInput = (value: string) => value.toUpperCase().replace(CODE_CHARS, '').slice(0, 6);

const doctorLabel = (name?: string | null) => {
  if (!name) return 'Doctor';
  return /^dr\.?\s+/i.test(name.trim()) ? name.trim() : `Dr. ${name.trim()}`;
};

const DELAY_TEXT: Record<string, string> = {
  BEFORE_SHIFT: 'Shift not started',
  STEPPED_OUT: 'Doctor stepped out',
  DOCTOR_NOT_IN: 'Doctor not in yet',
};

/**
 * Public page where a walk-in patient tracks their queue with the mobile number given at the
 * desk and the 6-character code from their slip (FIX-058). Works without an account.
 */
export const TrackWalkin: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<WalkinTrackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<{ phone: string; code: string } | null>(null);

  const lookup = useCallback(async (query: { phone: string; code: string }, quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await api.trackWalkin(query.phone, query.code);
      setResult(data);
      setError(null);
    } catch (err: any) {
      // A background refresh keeps the last ticket on screen
      if (!quiet) {
        setResult(null);
        setError(err?.message || 'Couldn’t load your queue. Try again.');
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = sanitizeIndianPhone(phone);
    if (!isValidIndianPhone(digits)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (code.length !== 6) {
      setError('Enter the 6-character code.');
      return;
    }
    const query = { phone: digits, code };
    setActive(query);
    lookup(query);
  };

  const live = result?.liveQueue;
  const isActiveVisit = result?.status === 'WAITING' || result?.status === 'IN_CONSULTATION';
  const pollMs = live && live.patientsAway <= 5 ? 30000 : 60000;

  useVisibilityPolling(
    () => (active ? lookup(active, true) : undefined),
    pollMs,
    Boolean(active && result && isActiveVisit)
  );

  const statusChip = () => {
    if (!result) return null;
    switch (result.status) {
      case 'IN_CONSULTATION':
        return <span className="px-3 py-1 rounded-full bg-[#0066cc] text-white text-xs font-semibold">In cabin</span>;
      case 'COMPLETED':
        return (
          <span className="px-3 py-1 rounded-full bg-success-soft border border-success-line text-success text-xs font-semibold inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Done
          </span>
        );
      case 'CANCELLED':
      case 'REJECTED':
      case 'EXPIRED':
        return (
          <span className="px-3 py-1 rounded-full bg-danger-soft border border-danger-line text-danger text-xs font-semibold">
            {result.status === 'EXPIRED' ? 'Expired' : 'Cancelled'}
          </span>
        );
      default:
        return <span className="px-3 py-1 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs font-semibold">Waiting</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <SubNav title="Track walk-in" width="2xl" />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#e5e5ea] p-5 sm:p-6 space-y-4">
          <div>
            <label htmlFor="walkin-phone" className="block text-xs font-normal text-[#1d1d1f] mb-1.5">
              Mobile number
            </label>
            <div className="flex items-center h-11 rounded-xl border border-[#d2d2d7] bg-white focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all">
              <span className="pl-3.5 pr-2 text-sm text-[#86868b] border-r border-[#e5e5ea]">+91</span>
              <input
                id="walkin-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                placeholder="10-digit number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="flex-1 min-w-0 h-full px-3 bg-transparent text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="walkin-code" className="block text-xs font-normal text-[#1d1d1f] mb-1.5">
              Code
            </label>
            <input
              id="walkin-code"
              type="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={6}
              placeholder="e.g. K7MX4P"
              value={code}
              onChange={(e) => setCode(cleanCodeInput(e.target.value))}
              className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm tracking-[0.3em] font-semibold text-[#1d1d1f] placeholder:tracking-normal placeholder:font-normal placeholder:text-[#a1a1a6] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
          >
            <Search className="w-4 h-4" />
            <span>{loading ? 'Checking...' : 'Show my queue'}</span>
          </button>
        </form>

        {result && (
          <div className="bg-white rounded-2xl border border-[#e5e5ea] p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#f5f5f7] border border-[#e5e5ea] shrink-0">
                  <AvatarImage
                    src={result.doctor.avatarUrl ? getFileUrl(result.doctor.avatarUrl) : undefined}
                    name={result.doctor.fullName || 'Doctor'}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight">{doctorLabel(result.doctor.fullName)}</h2>
                    {isActiveVisit && (
                      <CabinStatusBadge
                        status={result.doctor.cabinStatus}
                        expectedReturnTime={result.doctor.expectedReturnTime}
                        size="sm"
                      />
                    )}
                  </div>
                  {result.doctor.specialty && <p className="text-[13px] font-semibold text-[#0066cc]">{result.doctor.specialty}</p>}
                  {result.clinic && (
                    <p className="text-[13px] text-[#86868b] flex items-center gap-1.5 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {result.clinic.clinicName}
                        {result.clinic.city ? ` • ${result.clinic.city}` : ''}
                      </span>
                    </p>
                  )}
                </div>
              </div>
              <div className="shrink-0">{statusChip()}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="bg-[#f5f5f7] rounded-xl p-3.5 border border-[#e5e5ea] text-center">
                <span className="text-[11px] text-[#86868b] block">Your token</span>
                <span className="text-3xl font-semibold text-[#0066cc] tracking-tight">#{result.queueNumber}</span>
              </div>
              <div className="bg-[#f5f5f7] rounded-xl p-3.5 border border-[#e5e5ea] text-center">
                <span className="text-[11px] text-[#86868b] block">Now serving</span>
                <span className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">
                  {live?.currentServingQueueNumber ? `#${live.currentServingQueueNumber}` : '—'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
              <div className="bg-[#f5f5f7] rounded-xl p-2.5 border border-[#e5e5ea] min-w-0">
                <span className="text-[11px] text-[#86868b] block">Date</span>
                <span className="text-[13px] font-semibold text-[#1d1d1f]">{formatDisplayDate(result.appointmentDate)}</span>
              </div>
              <div className="bg-[#f5f5f7] rounded-xl p-2.5 border border-[#e5e5ea] min-w-0">
                <span className="text-[11px] text-[#86868b] block">Ahead</span>
                <span className="text-[13px] font-semibold text-[#1d1d1f] inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-[#86868b]" />
                  {isActiveVisit ? live?.patientsAway ?? 0 : '—'}
                </span>
              </div>
              <div className="bg-[#f5f5f7] rounded-xl p-2.5 border border-[#e5e5ea] min-w-0">
                <span className="text-[11px] text-[#86868b] block">Est. time</span>
                <span className="text-[13px] font-semibold text-[#1d1d1f] inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#86868b]" />
                  {isActiveVisit ? live?.liveEstimatedTime || result.estimatedTime : '—'}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#86868b] text-center">
              {cleanSlotName(result.checkingWindow, 'Shift')}
              {isActiveVisit && live?.delayReason ? ` • ${DELAY_TEXT[live.delayReason] || ''}` : ''}
              {result.status === 'COMPLETED' ? ' • Visit complete' : ''}
            </p>

            {result.receptionistPhone && (
              <a
                href={toTelUri(result.receptionistPhone)}
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-[#e5e5ea] hover:bg-[#f5f5f7] transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-[11px] text-[#86868b] block">{result.receptionistName || 'Front desk'}</span>
                  <span className="text-sm font-semibold text-[#1d1d1f]">{formatDisplayPhone(result.receptionistPhone)}</span>
                </div>
                <span className="h-9 px-4 rounded-full bg-[#0066cc] text-white text-xs inline-flex items-center gap-1.5 shrink-0">
                  <Phone className="w-3.5 h-3.5" /> Call
                </span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackWalkin;
