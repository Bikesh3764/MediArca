import React, { useState } from 'react';
import { X, Printer, Copy, Check, QrCode, Building2, MapPin, ShieldCheck } from 'lucide-react';
import { AppleButton } from '../ui/AppleButton';

interface ClinicQrStandeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinicId: string;
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
  checkinCode?: string;
}

export const ClinicQrStandeeModal: React.FC<ClinicQrStandeeModalProps> = ({
  isOpen,
  onClose,
  clinicId,
  clinicName,
  clinicAddress,
  checkinCode,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const checkinUrl = `${window.location.origin}${window.location.pathname}#/clinic-checkin?clinicId=${clinicId}&code=${checkinCode || ''}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkinUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(checkinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-[24px] border border-[#e5e5ea] shadow-2xl overflow-hidden p-6 sm:p-8 text-center print:border-none print:shadow-none print:p-0">
        {/* Close Button (Hidden on Print) */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.05] transition-colors print:hidden cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center mx-auto mb-3">
            <QrCode className="w-6 h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-[#1d1d1f] tracking-tight">
            Clinic Check-In Standee
          </h2>
          <p className="text-xs text-[#86868b] mt-1 max-w-sm mx-auto">
            Place this QR standee at the reception desk for patients to verify on-site arrival.
          </p>
        </div>

        {/* Printable Standee Card */}
        <div className="my-5 p-6 rounded-2xl bg-[#fafafc] border border-[#e5e5ea] text-center print:border print:bg-white print:my-0">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#0066cc] uppercase tracking-wider mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>{clinicName}</span>
          </div>

          {clinicAddress && (
            <p className="text-[11px] text-[#86868b] mb-4 flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3 text-[#86868b]" />
              <span>{clinicAddress}</span>
            </p>
          )}

          {/* QR Code Container */}
          <div className="w-52 h-52 mx-auto bg-white p-3 rounded-2xl border border-[#e5e5ea] shadow-xs flex items-center justify-center mb-4">
            <img
              src={qrImageUrl}
              alt={`${clinicName} Arrival QR Code`}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#1d1d1f]">
              Scan with Phone Camera to Check In
            </p>
            <p className="text-[11px] text-[#86868b] max-w-xs mx-auto">
              Open your camera or MediArca app to confirm presence and notify your doctor.
            </p>
          </div>

          {checkinCode && (
            <div className="mt-4 pt-3 border-t border-[#e5e5ea]/80">
              <span className="text-[10px] uppercase font-semibold text-[#86868b] tracking-wider block">
                6-Digit Desk Security Code
              </span>
              <span className="text-base font-bold font-mono tracking-widest text-[#1d1d1f] mt-0.5 inline-block">
                {checkinCode}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons (Hidden on Print) */}
        <div className="flex items-center gap-2.5 print:hidden pt-2">
          <AppleButton
            variant="ghost"
            onClick={handleCopyLink}
            className="flex-1 flex items-center justify-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Link Copied' : 'Copy Link'}</span>
          </AppleButton>

          <AppleButton
            variant="primary"
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Standee</span>
          </AppleButton>
        </div>
      </div>
    </div>
  );
};
