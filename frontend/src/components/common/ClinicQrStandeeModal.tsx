import React, { useState } from 'react';
import { X, Printer, Copy, Check } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-[450px] max-h-[92vh] overflow-y-auto bg-white rounded-[28px] border border-[#e5e5ea] shadow-[0_24px_64px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.04)] p-6 sm:p-7 text-center print:border-none print:shadow-none print:p-0 print:max-h-none print:overflow-visible">
        {/* Close Button (Hidden on Print) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors print:hidden cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand & Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="mb-2.5">
            <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto object-contain mx-auto" />
          </div>
          <h2 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
            Clinic Check-In Standee
          </h2>
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
          <div className="w-48 h-48 mx-auto bg-white p-3 rounded-2xl border border-[#d2d2d7] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center justify-center mb-3.5">
            <img
              src={qrImageUrl}
              alt={`${clinicName} Arrival QR Code`}
              className="w-full h-full object-contain"
            />
          </div>

          <p className="text-xs font-medium text-[#1d1d1f]">
            Scan with phone camera to check in
          </p>

          {checkinCode && (
            <div className="mt-3.5 pt-3 border-t border-[#e5e5ea]">
              <span className="text-xs font-medium text-[#86868b] block">
                6-Digit Desk Code
              </span>
              <span className="text-base font-semibold tracking-widest text-[#1d1d1f] mt-0.5 inline-block">
                {checkinCode}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons (Hidden on Print) */}
        <div className="flex items-center gap-2.5 print:hidden pt-1">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex-1 h-11 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e5e5ea] text-[#1d1d1f] text-sm font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-[#0066cc]" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Link Copied' : 'Copy Link'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-medium transition-all duration-150 shadow-[0_2px_8px_rgba(0,102,204,0.2),0_1px_2px_rgba(0,0,0,0.06)] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Standee</span>
          </button>
        </div>
      </div>
    </div>
  );
};

