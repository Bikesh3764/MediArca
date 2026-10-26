import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';

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
  defaultClinicId: _defaultClinicId,
}) => {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedFeedback, setScannedFeedback] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const parseQrText = (text: string): { clinicId: string; code: string } | null => {
    try {
      const raw = String(text || '').trim();
      // 1. Try URL parameter parsing (e.g. ...#/clinic-checkin?clinicId=xxx&code=yyy or /check-in?clinicId=xxx&code=yyy)
      if (raw.includes('clinicId')) {
        let queryString = '';
        if (raw.includes('?')) {
          queryString = raw.slice(raw.indexOf('?') + 1);
        } else {
          queryString = raw;
        }
        const params = new URLSearchParams(queryString);
        const clinicId = params.get('clinicId');
        const code = params.get('code') || params.get('checkinCode') || '';
        if (clinicId) {
          return { clinicId, code };
        }
      }

      // 2. Try JSON parsing
      if (raw.startsWith('{') && raw.endsWith('}')) {
        const parsed = JSON.parse(raw);
        if (parsed.clinicId) {
          return {
            clinicId: parsed.clinicId,
            code: String(parsed.code || parsed.checkinCode || ''),
          };
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
      setScannedFeedback(false);
    }, 600);
  }, [scannedFeedback, onScanSuccess, onClose]);

  // Start Camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('This browser can’t use the camera.');
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
      let msg = 'Couldn’t open the camera. Allow camera access in your browser.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera is blocked. Allow it in your browser settings.';
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

  // Guarantee clean camera and scanner state whenever modal opens or closes, and lock background scroll
  useEffect(() => {
    queueMicrotask(() => {
      setScannedFeedback(false);
      setCameraError(null);
    });
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Frame scanning loop
  useEffect(() => {
    if (!isOpen || scannedFeedback) {
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
  }, [isOpen, scannedFeedback, startCamera, stopCamera, handleDetected]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setScannedFeedback(false);
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xl animate-fadeIn"
    >
      <div className="relative w-full max-w-[440px] bg-white rounded-2xl border border-[#e5e5ea]  overflow-hidden p-6 sm:p-7 text-center">
        {/* Close Button */}
        <button aria-label="Close"
          type="button"
          onClick={() => {
            setScannedFeedback(false);
            onClose();
          }}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <h2 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
            Scan QR Code
          </h2>
          <p className="text-xs text-[#86868b] mt-1 leading-relaxed">
            Scan the QR code at the front desk.
          </p>
        </div>

        {/* Camera Viewport or Error */}
        {cameraError ? (
          <div className="my-3 p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-[#86868b] mx-auto" />
            <div>
              <p className="text-sm font-semibold text-[#1d1d1f]">Allow camera</p>
              <p className="text-xs text-[#86868b] mt-1 leading-relaxed">{cameraError}</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-[#e5e5ea] text-left">
              <p className="text-[11px] text-[#48484a] leading-relaxed">
                Allow camera access to scan, or tell the front desk you’ve arrived.
              </p>
            </div>
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
              <div className="w-48 h-48 border-2 border-[#0066cc] rounded-xl relative ">
                <div className="w-full h-0.5 bg-[#0066cc] shadow-[0_0_8px_#0066cc] absolute top-0 left-0 animate-pulse transition-all" />
              </div>
            </div>

            {scannedFeedback && (
              <div className="absolute inset-0 bg-[#0066cc]/95 backdrop-blur-xs flex flex-col items-center justify-center text-white animate-fadeIn">
                <CheckCircle2 className="w-10 h-10 mb-2" />
                <p className="text-sm font-semibold">You’re checked in</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 pt-3 border-t border-[#f0f0f2]">
          <p className="text-[11px] text-[#86868b]">
            Point your camera at the QR code
          </p>
        </div>
      </div>
    </div>
  );
};
