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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white rounded-[24px] border border-[#e5e5ea] shadow-2xl overflow-hidden p-6 text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.05] transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center mx-auto mb-3">
            <Camera className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold text-[#1d1d1f] tracking-tight">
            Scan Clinic QR Standee
          </h2>
          <p className="text-xs text-[#86868b] mt-1 max-w-xs mx-auto">
            Point your camera at the physical QR standee at the reception desk to verify your arrival.
          </p>
        </div>

        {/* Tab Toggle: Camera vs Code */}
        <div className="flex rounded-full bg-[#f5f5f7] p-1 border border-[#e5e5ea] mb-5">
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
              mode === 'camera'
                ? 'bg-white text-[#1d1d1f] shadow-xs'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            Camera Scanner
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
              mode === 'manual'
                ? 'bg-white text-[#1d1d1f] shadow-xs'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            Enter 6-Digit Code
          </button>
        </div>

        {/* Camera View Mode */}
        {mode === 'camera' && (
          <div>
            {cameraError ? (
              <div className="my-6 p-6 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-3" />
                <p className="text-xs text-[#1d1d1f] font-medium mb-2">Camera Unavailable</p>
                <p className="text-[11px] text-[#555558] mb-4 leading-relaxed">{cameraError}</p>
                <AppleButton
                  variant="primary"
                  size="sm"
                  onClick={() => setMode('manual')}
                  className="w-full"
                >
                  Enter Desk Code Manually
                </AppleButton>
              </div>
            ) : (
              <div className="relative w-full aspect-square max-w-[300px] mx-auto rounded-2xl overflow-hidden bg-black border border-[#e5e5ea] shadow-inner flex items-center justify-center">
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
                    {/* Laser scan line animation */}
                    <div className="w-full h-0.5 bg-[#0066cc] shadow-[0_0_8px_#0066cc] absolute top-0 left-0 animate-pulse transition-all" />
                  </div>
                </div>

                {scannedFeedback && (
                  <div className="absolute inset-0 bg-emerald-600/90 backdrop-blur-xs flex flex-col items-center justify-center text-white animate-fadeIn">
                    <CheckCircle2 className="w-12 h-12 mb-2 animate-bounce" />
                    <p className="text-sm font-semibold">QR Code Verified!</p>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-[#86868b] mt-4">
              Hold your camera steady over the front desk standee.
            </p>
          </div>
        )}

        {/* Manual Code Mode */}
        {mode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-4 my-2 text-left">
            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
                6-Digit Clinic Security Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 123456"
                className="w-full px-4 py-3 rounded-xl border border-[#e5e5ea] text-center text-lg font-bold tracking-widest text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
                autoFocus
              />
              <p className="text-[11px] text-[#86868b] mt-1 text-center">
                The 6-digit code printed directly beneath the QR code on the desk standee.
              </p>
            </div>

            <AppleButton
              type="submit"
              variant="primary"
              disabled={manualCode.trim().length !== 6}
              className="w-full flex items-center justify-center gap-2 mt-4"
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
