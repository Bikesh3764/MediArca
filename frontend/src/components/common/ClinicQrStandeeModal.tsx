import React, { useState } from 'react';
import { X, Printer, Copy, Check, QrCode, Building2, MapPin } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-md bg-white rounded-[24px] border border-[#e5e5ea] shadow-apple-float overflow-hidden p-6 sm:p-7 text-center print:border-none print:shadow-none print:p-0">
        {/* Close Button (Hidden on Print) */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f5f5f7] text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#e8e8ed] flex items-center justify-center transition-colors print:hidden cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <div className="w-11 h-11 rounded-[14px] bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center mx-auto mb-3">
            <QrCode className="w-5 h-5" />
          </div>
          <h2 className="text-section-title text-[#1d1d1f]">
            Clinic Check-In Standee
          </h2>
          <p className="text-meta mt-1 max-w-xs mx-auto">
            Place this QR standee at the reception desk for patients to verify on-site arrival.
          </p>
        </div>

        {/* Printable Standee Card */}
        <div className="my-5 p-6 rounded-[20px] bg-[#f5f5f7]/70 border border-[#e5e5ea] text-center print:border print:bg-white print:my-0">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#0066cc] uppercase tracking-wider mb-1.5">
            <Building2 className="w-3.5 h-3.5" />
            <span>{clinicName}</span>
          </div>

          {clinicAddress && (
            <p className="text-meta mb-4 flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3 text-[#86868b] shrink-0" />
              <span className="truncate max-w-[260px]">{clinicAddress}</span>
            </p>
          )}

          {/* QR Code Container */}
          <div className="w-48 h-48 mx-auto bg-white p-3 rounded-[16px] border border-[#e5e5ea] shadow-apple-xs flex items-center justify-center mb-4">
            <img
              src={qrImageUrl}
              alt={`${clinicName} Arrival QR Code`}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="space-y-1">
            <p className="text-[13px] font-semibold text-[#1d1d1f]">
              Scan with Phone Camera to Check In
            </p>
            <p className="text-meta max-w-xs mx-auto">
              Open your camera or MediArca app to confirm presence and notify your doctor.
            </p>
          </div>

          {checkinCode && (
            <div className="mt-4 pt-3.5 border-t border-[#e5e5ea]">
              <span className="text-[10px] uppercase font-semibold text-[#6e6e73] tracking-wider block">
                6-Digit Desk Security Code
              </span>
              <span className="text-[18px] font-bold tracking-[0.2em] text-[#1d1d1f] mt-0.5 inline-block tabular-nums">
                {checkinCode}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons (Hidden on Print) */}
        <div className="flex items-center gap-2.5 print:hidden pt-1">
          <AppleButton
            variant="secondary"
            size="md"
            onClick={handleCopyLink}
            className="flex-1"
          >
            {copied ? <Check className="w-4 h-4 text-[#15803d]" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Link Copied' : 'Copy Link'}</span>
          </AppleButton>

          <AppleButton
            variant="primary"
            size="md"
            onClick={handlePrint}
            className="flex-1"
          >
            <Printer className="w-4 h-4" />
            <span>Print Standee</span>
          </AppleButton>
        </div>
      </div>
    </div>
  );
};
