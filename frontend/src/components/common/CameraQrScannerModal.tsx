import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { X, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

interface CameraQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: { clinicId: string; code: string }) => void;
  defaultClinicId?: string;
}

export const CameraQrScannerModal: React.FC<CameraQrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  defaultClinicId,
}) => {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const manualClinicId = defaultClinicId || '';
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedFeedback, setScannedFeedback] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const parseQrText = (text: string): { clinicId: string; code: string } | null => {
    try {
      // 1. Try URL parameter parsing (e.g. ...#/clinic-checkin?clinicId=xxx&code=yyy or ?clinicId=xxx&code=yyy)
      if (text.includes('clinicId') && text.includes('code')) {
        let queryString = '';
        if (text.includes('?')) {
          queryString = text.slice(text.indexOf('?') + 1);
        } else {
          queryString = text;
        }
        const params = new URLSearchParams(queryString);
        const clinicId = params.get('clinicId');
        const code = params.get('code');
        if (clinicId && code) {
          return { clinicId, code };
        }
      }

      // 2. Try JSON parsing
      if (text.startsWith('{') && text.endsWith('}')) {
        const parsed = JSON.parse(text);
        if (parsed.clinicId && parsed.code) {
          return { clinicId: parsed.clinicId, code: String(parsed.code) };
        }
      }
    } catch {
      // Fallback
    }
    return null;
  };

  const handleDetected = useCallback((data: { clinicId: string; code: string }) => {
    if (scannedFeedback) return;
    setScannedFeedback(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(100);
    }
    setTimeout(() => {
      onScanSuccess(data);
      onClose();
    }, 600);
  }, [scannedFeedback, onScanSuccess, onClose]);

  // Start Camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported on this browser/device.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      let msg = 'Could not access camera. Please allow camera permissions or enter the 6-digit desk code manually.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission was denied. Please allow camera access in browser settings or enter the desk code manually.';
      }
      setCameraError(msg);
    }
  }, []);

  // Stop Camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Frame scanning loop
  useEffect(() => {
    if (!isOpen || mode !== 'camera' || scannedFeedback) {
      stopCamera();
      return;
    }

    queueMicrotask(() => {
      startCamera();
    });

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (qrCode && qrCode.data) {
            const parsed = parseQrText(qrCode.data);
            if (parsed) {
              handleDetected(parsed);
              return;
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      stopCamera();
    };
  }, [isOpen, mode, scannedFeedback, startCamera, stopCamera, handleDetected]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onScanSuccess({
      clinicId: manualClinicId.trim(),
      code: manualCode.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-[450px] bg-white rounded-[28px] border border-[#e5e5ea] shadow-[0_24px_64px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.04)] overflow-hidden p-6 sm:p-7 text-center">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <h2 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
            Clinic Check-In
          </h2>
          <p className="text-xs text-[#86868b] mt-1">
            Scan the reception desk QR standee or enter the 6-digit code.
          </p>
        </div>

        {/* Segmented Toggle: Camera vs Code */}
        <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl flex gap-1 select-none mb-5">
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={`flex-1 py-2 text-xs rounded-lg transition-all duration-150 cursor-pointer text-center ${
              mode === 'camera'
                ? 'bg-white text-[#1d1d1f] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_1px_rgba(0,0,0,0.04)] border border-black/5'
                : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
            }`}
          >
            Camera Scanner
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 py-2 text-xs rounded-lg transition-all duration-150 cursor-pointer text-center ${
              mode === 'manual'
                ? 'bg-white text-[#1d1d1f] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_1px_rgba(0,0,0,0.04)] border border-black/5'
                : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
            }`}
          >
            6-Digit Code
          </button>
        </div>

        {/* Camera View Mode */}
        {mode === 'camera' && (
          <div>
            {cameraError ? (
              <div className="my-4 p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-center">
                <AlertCircle className="w-6 h-6 text-[#86868b] mx-auto mb-2.5" />
                <p className="text-xs font-semibold text-[#1d1d1f] mb-1">Camera Unavailable</p>
                <p className="text-xs text-[#86868b] mb-4 leading-relaxed">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => setMode('manual')}
                  className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-medium transition-all duration-150 shadow-[0_2px_8px_rgba(0,102,204,0.2),0_1px_2px_rgba(0,0,0,0.06)] flex items-center justify-center cursor-pointer"
                >
                  Enter 6-Digit Code
                </button>
              </div>
            ) : (
              <div className="relative w-full aspect-square max-w-[280px] mx-auto rounded-2xl overflow-hidden bg-black border border-[#d2d2d7] flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Viewfinder overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-[#0066cc] rounded-xl relative shadow-[0_0_20px_rgba(0,102,204,0.3)]">
                    <div className="w-full h-0.5 bg-[#0066cc] shadow-[0_0_8px_#0066cc] absolute top-0 left-0 animate-pulse transition-all" />
                  </div>
                </div>

                {scannedFeedback && (
                  <div className="absolute inset-0 bg-[#0066cc]/95 backdrop-blur-xs flex flex-col items-center justify-center text-white animate-fadeIn">
                    <CheckCircle2 className="w-10 h-10 mb-2" />
                    <p className="text-sm font-semibold">QR Code Verified</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Manual Code Mode */}
        {mode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                6-Digit Desk Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-center text-base font-semibold tracking-widest text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={manualCode.trim().length !== 6}
              className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-medium transition-all duration-150 shadow-[0_2px_8px_rgba(0,102,204,0.2),0_1px_2px_rgba(0,0,0,0.06)] flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span>Confirm Arrival</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

