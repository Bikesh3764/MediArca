import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { BellRing, Download, QrCode, Ticket, Smartphone, X } from 'lucide-react';
import { ANDROID_APK_URL, APP_DOWNLOAD_SHORT_URL } from '../../config/app';

const FEATURES = [
  { icon: BellRing, title: 'Alerts on your phone', text: 'Get a ping when you are next.' },
  { icon: Ticket, title: 'Book in seconds', text: 'Pick a doctor and shift, done.' },
  { icon: QrCode, title: 'Scan to check in', text: 'One tap at the clinic desk.' },
];

/** Small phone with a sample live token (decorative). */
const PhoneMock: React.FC = () => (
  <div className="relative mx-auto w-[230px] sm:w-[250px]" aria-hidden="true">
    <div className="pointer-events-none absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgba(0,102,204,0.16),transparent)]" />
    <div className="relative rounded-[40px] bg-[#1d1d1f] p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
      <div className="rounded-[32px] bg-[#f5f5f7] overflow-hidden">
        <div className="h-7 flex items-center justify-center">
          <span className="w-16 h-4 rounded-full bg-[#1d1d1f]" />
        </div>
        <div className="px-4 pb-5">
          <p className="text-[11px] text-[#86868b]">Good morning</p>
          <p className="text-[15px] font-semibold text-[#1d1d1f]">Your visit</p>

          <div className="mt-3 rounded-2xl bg-white p-3.5 shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#1d1d1f]">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-success-dot opacity-60 animate-ping motion-reduce:animate-none" />
                  <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-success-dot" />
                </span>
                Live queue
              </span>
              <span className="text-[10px] text-[#86868b]">9:00 AM – 1:00 PM</span>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="text-[10px] text-[#86868b]">Your token</p>
                <p className="text-[34px] leading-none font-semibold tracking-tight text-[#1d1d1f]">17</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#86868b]">Now serving</p>
                <p className="text-lg leading-none font-semibold text-primary">15</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-[#f0f0f2] overflow-hidden">
              <div className="h-full w-[70%] rounded-full bg-primary" />
            </div>
            <p className="mt-2 text-[10px] text-[#86868b]">2 ahead · about 12 min</p>
          </div>

          <div className="mt-2.5 rounded-2xl bg-white px-3.5 py-3 flex items-center gap-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
            <span className="w-7 h-7 rounded-full bg-primary-soft text-primary inline-flex items-center justify-center shrink-0">
              <QrCode className="w-3.5 h-3.5" />
            </span>
            <span className="text-[11px] text-[#1d1d1f] flex-1">Scan clinic QR</span>
            <span className="text-[11px] text-primary">Open</span>
          </div>
        </div>
      </div>
    </div>

    {/* Floating alert */}
    <div className="ma-float absolute -right-4 sm:-right-16 -top-3 w-[180px] rounded-2xl bg-white/95 backdrop-blur-xl border border-black/[0.06] shadow-[0_12px_32px_rgba(0,0,0,0.14)] px-3 py-2.5 flex items-center gap-2.5">
      <span className="w-8 h-8 rounded-xl bg-primary text-white inline-flex items-center justify-center shrink-0">
        <BellRing className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-[#1d1d1f]">You&rsquo;re next</p>
        <p className="text-[10px] text-[#86868b] truncate">Please reach the clinic</p>
      </div>
    </div>
  </div>
);

/** "Get the app" band on the home page: download button, QR for desktop visitors, phone preview. */
export const GetAppSection: React.FC = () => {
  const [qr, setQr] = useState('');

  useEffect(() => {
    QRCode.toDataURL(APP_DOWNLOAD_SHORT_URL, { margin: 1, width: 240, color: { dark: '#1d1d1f', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, []);

  return (
    <section id="get-app" className="bg-white scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-16 sm:pb-24">
        <div className="relative overflow-clip rounded-[28px] bg-gradient-to-br from-[#f5f5f7] via-[#eef3fa] to-[#e6f0fc] border border-[#e5e5ea]">
          <div className="relative grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] items-center gap-10 px-6 py-12 sm:px-12 sm:py-16">
            <div className="text-center lg:text-left">
              <p className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white border border-[#e5e5ea] text-xs font-semibold text-primary">
                <Smartphone className="w-3.5 h-3.5" />
                MediArca app
              </p>
              <h2 className="mt-4 text-3xl sm:text-[44px] font-semibold tracking-tight leading-tight text-[#1d1d1f]">
                Your token,
                <br />
                <span className="bg-gradient-to-r from-[#0066cc] to-[#2997ff] bg-clip-text text-transparent">in your pocket.</span>
              </h2>
              <p className="mt-3 text-base sm:text-lg text-[#6e6e73] max-w-md mx-auto lg:mx-0">
                For patients, doctors, clinics and front desks.
              </p>

              <ul className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                {FEATURES.map(({ icon: Icon, title, text }) => (
                  <li key={title} className="rounded-2xl bg-white/80 border border-white px-4 py-3 sm:py-3.5 flex items-center gap-3 sm:block">
                    <span className="w-8 h-8 rounded-full bg-primary-soft text-primary inline-flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="sm:mt-2 text-sm font-semibold text-[#1d1d1f]">{title}</p>
                      <p className="text-xs text-[#86868b] mt-0.5">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col sm:flex-row items-center lg:items-stretch gap-4 justify-center lg:justify-start">
                <a
                  href={ANDROID_APK_URL}
                  rel="noopener"
                  className="h-14 pl-4 pr-6 rounded-2xl bg-[#1d1d1f] hover:bg-black text-white inline-flex items-center gap-3 transition-all active:scale-[0.98] self-center"
                >
                  <span className="w-9 h-9 rounded-xl bg-white/10 inline-flex items-center justify-center">
                    <Download className="w-5 h-5" />
                  </span>
                  <span className="text-left leading-tight">
                    <span className="block text-[11px] text-white/70">Download for</span>
                    <span className="block text-base font-semibold">Android</span>
                  </span>
                </a>

                {qr && (
                  <div className="hidden sm:flex items-center gap-3 rounded-2xl bg-white border border-[#e5e5ea] p-2 pr-4">
                    <img src={qr} alt="QR code to download the MediArca app" className="w-20 h-20 rounded-lg" />
                    <p className="text-xs text-[#86868b] leading-snug max-w-[110px]">
                      <span className="block text-sm font-semibold text-[#1d1d1f]">Scan to get it</span>
                      Open your phone camera
                    </p>
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-[#86868b]">Free · For Android phones</p>
            </div>

            <div className="py-4 lg:py-0">
              <PhoneMock />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const BAR_KEY = 'mediarca_app_bar_closed';

/** Slim "Open in app" bar for visitors on Android phones; closes for good once dismissed. */
export const AndroidAppBar: React.FC = () => {
  const [show, setShow] = useState(() => {
    if (typeof navigator === 'undefined' || !/Android/i.test(navigator.userAgent)) return false;
    try {
      return localStorage.getItem(BAR_KEY) !== '1';
    } catch {
      return true; // Storage blocked: just show it
    }
  });

  if (!show) return null;

  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(BAR_KEY, '1');
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-white border-b border-[#e5e5ea] px-4 py-2.5 flex items-center gap-3">
      <span className="w-9 h-9 rounded-xl bg-primary text-white inline-flex items-center justify-center shrink-0">
        <Smartphone className="w-4 h-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#1d1d1f] leading-tight">MediArca app</p>
        <p className="text-xs text-[#86868b] truncate">Live token alerts on your phone</p>
      </div>
      <a
        href={ANDROID_APK_URL}
        rel="noopener"
        className="h-8 px-4 rounded-full bg-primary hover:bg-primary-hover text-white text-xs inline-flex items-center transition-all active:scale-[0.98] shrink-0"
      >
        Get
      </a>
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="w-8 h-8 -mr-1 rounded-full text-[#86868b] hover:bg-[#f5f5f7] inline-flex items-center justify-center shrink-0 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
