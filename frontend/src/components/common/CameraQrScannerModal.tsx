import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { X, Camera, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { AppleButton } from '../ui/AppleButton';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-[440px] bg-white/95 backdrop-blur-xl rounded-t-[24px] sm:rounded-[24px] border border-[#e5e5ea] shadow-apple-float overflow-hidden p-6 sm:p-8 max-h-[90vh] overflow-y-auto text-center">
        {/* Mobile Sheet Drag Handle */}
        <div className="w-10 h-1 rounded-full bg-[#d2d2d7] mx-auto mb-5 sm:hidden" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#ebebf0] text-[#6e6e73] hover:text-[#1d1d1f] flex items-center justify-center transition-colors cursor-pointer z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <div className="w-11 h-11 rounded-2xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center mx-auto mb-3.5">
            <Camera className="w-5 h-5" />
          </div>
          <h2 className="text-section-title">
            Scan Clinic QR Standee
          </h2>
          <p className="text-secondary mt-1 max-w-xs mx-auto">
            Point your camera at the physical QR standee at the reception desk to verify your arrival.
          </p>
        </div>

        {/* Segmented Toggle: Camera vs Code */}
        <div className="flex rounded-full bg-[#f5f5f7] p-1 border border-[#e5e5ea] mb-6">
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={`flex-1 py-1.5 text-[13px] font-semibold rounded-full transition-all cursor-pointer ${
              mode === 'camera'
                ? 'bg-white text-[#1d1d1f] shadow-2xs'
                : 'text-[#6e6e73] hover:text-[#1d1d1f]'
            }`}
          >
            Camera Scanner
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 py-1.5 text-[13px] font-semibold rounded-full transition-all cursor-pointer ${
              mode === 'manual'
                ? 'bg-white text-[#1d1d1f] shadow-2xs'
                : 'text-[#6e6e73] hover:text-[#1d1d1f]'
            }`}
          >
            Enter 6-Digit Code
          </button>
        </div>

        {/* Camera View Mode */}
        {mode === 'camera' && (
          <div>
            {cameraError ? (
              <div className="my-4 p-5 rounded-2xl bg-amber-50 border border-amber-200/80 text-center">
                <AlertCircle className="w-7 h-7 text-amber-600 mx-auto mb-2.5" />
                <p className="text-[14px] text-[#1d1d1f] font-semibold mb-1.5">Camera Unavailable</p>
                <p className="text-xs text-[#6e6e73] mb-4 leading-relaxed">{cameraError}</p>
                <AppleButton
                  variant="primary"
                  size="md"
                  onClick={() => setMode('manual')}
                  className="w-full"
                >
                  Enter Desk Code Manually
                </AppleButton>
              </div>
            ) : (
              <div className="relative w-full aspect-square max-w-[280px] mx-auto rounded-2xl overflow-hidden bg-[#1d1d1f] border border-[#e5e5ea] flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Viewfinder overlay */}
                <div className="absolute inset-0 border-2 border-white/20 rounded-2xl pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-[#0066cc] rounded-xl relative shadow-[0_0_20px_rgba(0,102,204,0.3)]">
                    <div className="w-full h-0.5 bg-[#0066cc] shadow-[0_0_8px_#0066cc] absolute top-0 left-0 animate-pulse transition-all" />
                  </div>
                </div>

                {scannedFeedback && (
                  <div className="absolute inset-0 bg-emerald-600/90 backdrop-blur-xs flex flex-col items-center justify-center text-white animate-fadeIn">
                    <CheckCircle2 className="w-11 h-11 mb-2" />
                    <p className="text-sm font-semibold">QR Code Verified</p>
                  </div>
                )}
              </div>
            )}

            <p className="text-meta mt-4">
              Hold your camera steady over the front desk standee.
            </p>
          </div>
        )}

        {/* Manual Code Mode */}
        {mode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-5 text-left">
            <div>
              <label className="ui-label text-center">
                6-Digit Clinic Security Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full h-14 px-4 rounded-xl border border-[#d2d2d7] bg-white text-center text-2xl font-bold tracking-[0.25em] text-[#1d1d1f] focus:outline-none focus:ring-[3px] focus:ring-[#0066cc]/15 focus:border-[#0066cc] transition-all"
                autoFocus
              />
              <p className="text-meta mt-2 text-center">
                Printed directly beneath the QR code on the desk standee.
              </p>
            </div>

            <AppleButton
              type="submit"
              variant="primary"
              size="lg"
              disabled={manualCode.trim().length !== 6}
              className="w-full"
            >
              <span>Confirm Arrival</span>
              <ArrowRight className="w-4 h-4" />
            </AppleButton>
          </form>
        )}
      </div>
    </div>
  );
};
