import React from 'react';
import QRCode from 'qrcode';
import { appUrl } from '../../utils/siteUrl';
import { X, Printer, Download, Share2, Check } from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';

interface ClinicQrStandeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinicId: string;
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
  checkinCode?: string;
}

type QrKind = 'checkin' | 'booking';

const QR_TEXT: Record<QrKind, { title: string; caption: string; file: string }> = {
  checkin: { title: 'Check-in QR Code', caption: 'Scan with your phone to check in', file: 'check-in' },
  booking: { title: 'Booking QR Code', caption: 'Scan to book a doctor', file: 'booking' },
};

/** Booking link for a clinic. Safe to share anywhere: it has no check-in code. */
const clinicBookingUrl = (clinicId: string) => appUrl(`/clinics/${encodeURIComponent(clinicId)}`);

/** A ready-to-share PNG: clinic name, QR and one line of help on white. */
const drawPoster = async (qrDataUrl: string, clinicName: string, caption: string): Promise<string> => {
  const img = new Image();
  img.src = qrDataUrl;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  if (!ctx) return qrDataUrl;
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1d1d1f';
  ctx.font = `600 44px ${font}`;
  const name = clinicName.length > 30 ? `${clinicName.slice(0, 29)}…` : clinicName;
  ctx.fillText(name, 400, 110);
  ctx.drawImage(img, 120, 160, 560, 560);
  ctx.font = `400 34px ${font}`;
  ctx.fillText(caption, 400, 800);
  ctx.fillStyle = '#0066cc';
  ctx.font = `600 30px ${font}`;
  ctx.fillText('MediArca', 400, 900);
  return canvas.toDataURL('image/png');
};

export const ClinicQrStandeeModal: React.FC<ClinicQrStandeeModalProps> = ({
  isOpen,
  onClose,
  clinicId,
  clinicName,
  clinicAddress,
  checkinCode,
}) => {
  const [kind, setKind] = React.useState<QrKind>('checkin');
  const [linkCopied, setLinkCopied] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const checkinUrl = `${appUrl('/clinic-checkin')}?clinicId=${clinicId}${
    checkinCode ? `&code=${encodeURIComponent(checkinCode)}` : ''
  }`;
  const bookingUrl = clinicBookingUrl(clinicId);
  const activeUrl = kind === 'checkin' ? checkinUrl : bookingUrl;
  const text = QR_TEXT[kind];

  // Drawn in the browser: the check-in code is never sent to an outside QR service
  const [qrImageUrl, setQrImageUrl] = React.useState<string>('');
  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    QRCode.toDataURL(activeUrl, { width: 600, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQrImageUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrImageUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeUrl]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!qrImageUrl) return;
    const poster = await drawPoster(qrImageUrl, clinicName, text.caption).catch(() => qrImageUrl);
    const link = document.createElement('a');
    link.href = poster;
    link.download = `${clinicName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'clinic'}-${text.file}-qr.png`;
    link.click();
  };

  const handleShare = async () => {
    const shareData = { title: clinicName, text: `Book a doctor at ${clinicName}`, url: bookingUrl };
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt('Copy this link', bookingUrl);
    }
  };

  const tabClass = (active: boolean) =>
    `flex-1 h-9 rounded-full text-xs transition-colors cursor-pointer ${
      active ? 'bg-white text-[#1d1d1f] font-semibold border border-[#e5e5ea]' : 'text-[#86868b] font-normal hover:text-[#1d1d1f]'
    }`;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xl animate-fadeIn"
    >
      <div className="relative w-full max-w-[420px] max-h-[92vh] overflow-y-auto bg-white rounded-2xl border border-[#e5e5ea]  p-6 sm:p-7 text-center print:border-none  print:p-0 print:max-h-none print:overflow-visible">
        {/* Close Button (Hidden on Print) */}
        <button aria-label="Close"
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors print:hidden cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand & Header */}
        <div className="flex flex-col items-center text-center mb-4">
          <div className="mb-2.5">
            <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto object-contain mx-auto" />
          </div>
          <h2 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
            {text.title}
          </h2>
        </div>

        {/* Which QR (Hidden on Print) */}
        <div role="tablist" aria-label="QR type" className="flex gap-1 p-1 rounded-full bg-[#f5f5f7] print:hidden">
          <button type="button" role="tab" aria-selected={kind === 'checkin'} onClick={() => setKind('checkin')} className={tabClass(kind === 'checkin')}>
            Check-in
          </button>
          <button type="button" role="tab" aria-selected={kind === 'booking'} onClick={() => setKind('booking')} className={tabClass(kind === 'booking')}>
            Booking
          </button>
        </div>

        {/* Printable Standee Card */}
        <div className="my-4 p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-center print:border print:bg-white print:my-0">
          <div className="text-sm font-semibold text-[#1d1d1f] mb-1">
            {clinicName}
          </div>

          {clinicAddress && (
            <p className="text-xs text-[#86868b] mb-4">
              {clinicAddress}
            </p>
          )}

          {/* QR Code Container */}
          <div className="w-48 h-48 mx-auto bg-white p-3 rounded-2xl border border-[#d2d2d7]  flex items-center justify-center mb-3.5">
            {qrImageUrl ? (
              <img
                src={qrImageUrl}
                alt={`${clinicName} ${kind === 'checkin' ? 'Arrival' : 'Booking'} QR Code`}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-[#0066cc] border-t-transparent animate-spin" aria-label="Loading QR code" />
            )}
          </div>

          <p className="text-xs font-normal text-[#1d1d1f]">
            {text.caption}
          </p>
        </div>

        <p className="text-[11px] text-[#86868b] mb-4 leading-relaxed print:hidden">
          {kind === 'checkin'
            ? 'Keep this at the front desk only.'
            : 'Share it on WhatsApp, Instagram or Google Maps.'}
        </p>

        {/* Action Buttons (Hidden on Print) */}
        <div className="print:hidden space-y-2.5">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print QR Code</span>
          </button>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!qrImageUrl}
              className="flex-1 h-11 px-4 rounded-full bg-white hover:bg-[#f5f5f7] border border-[#e5e5ea] active:scale-[0.98] text-[#1d1d1f] text-sm font-normal transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
            {kind === 'booking' && (
              <button
                type="button"
                onClick={handleShare}
                className="flex-1 h-11 px-4 rounded-full bg-white hover:bg-[#f5f5f7] border border-[#e5e5ea] active:scale-[0.98] text-[#1d1d1f] text-sm font-normal transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
              >
                {linkCopied ? <Check className="w-4 h-4 text-primary" /> : <Share2 className="w-4 h-4" />}
                <span>{linkCopied ? 'Link Copied' : 'Share Link'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
