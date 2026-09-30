import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, X, Check, Move } from 'lucide-react';
import { AppleButton } from './AppleButton';

interface AvatarCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropComplete: (croppedFile: File) => void;
  aspectRatio?: number; // width / height, defaults to 4/3 (1.333) matching doctor cards
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
  aspectRatio = 4 / 3,
}) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Reset controls when a new image is loaded
  useEffect(() => {
    if (isOpen && imageSrc) {
      queueMicrotask(() => {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
        setImageLoaded(false);
        setProcessing(false);
      });
    }
  }, [isOpen, imageSrc]);

  // Pointer drag handling for panning/centering the face
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setDragStart({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Perform offscreen canvas crop
  const handleCropAndSave = useCallback(async () => {
    if (!imageRef.current || !containerRef.current) return;
    setProcessing(true);

    try {
      const img = imageRef.current;
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();

      // Desired output resolution (high quality for cards and retina displays)
      const targetWidth = 800;
      const targetHeight = Math.round(targetWidth / aspectRatio);

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not initialize canvas context');
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // Determine scale factor between on-screen container and target canvas
      const scaleToCanvas = targetWidth / containerRect.width;

      // Current displayed dimensions of the image inside the container
      const displayedWidth = img.clientWidth * zoom;
      const displayedHeight = img.clientHeight * zoom;

      // Center of container
      const containerCenterX = containerRect.width / 2;
      const containerCenterY = containerRect.height / 2;

      // Position on the container
      const drawXOnContainer = containerCenterX - displayedWidth / 2 + offset.x;
      const drawYOnContainer = containerCenterY - displayedHeight / 2 + offset.y;

      // Map to target canvas coordinates
      const drawXOnCanvas = drawXOnContainer * scaleToCanvas;
      const drawYOnCanvas = drawYOnContainer * scaleToCanvas;
      const drawWidthOnCanvas = displayedWidth * scaleToCanvas;
      const drawHeightOnCanvas = displayedHeight * scaleToCanvas;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(
        img,
        0,
        0,
        img.naturalWidth,
        img.naturalHeight,
        drawXOnCanvas,
        drawYOnCanvas,
        drawWidthOnCanvas,
        drawHeightOnCanvas
      );

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setProcessing(false);
            return;
          }
          const croppedFile = new File([blob], 'doctor-avatar-cropped.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          onCropComplete(croppedFile);
        },
        'image/jpeg',
        0.92
      );
    } catch (err) {
      console.error('Failed to crop image:', err);
      setProcessing(false);
    }
  }, [aspectRatio, offset, onCropComplete, zoom]);

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-[26px] sm:rounded-[30px] border border-[#e5e5ea] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#f0f0f2] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#1d1d1f] tracking-tight">Adjust Profile Headshot</h3>
            <p className="text-xs text-[#86868b] mt-0.5">Drag to center your face and use the zoom slider</p>
          </div>
          <button
            onClick={onClose}
            disabled={processing}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport & Cropping Area */}
        <div className="p-6 bg-[#fbfbfd] flex flex-col items-center select-none">
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ aspectRatio: `${aspectRatio}` }}
            className="relative w-full max-w-sm rounded-[22px] overflow-hidden bg-black/5 border-2 border-[#0088e8] shadow-inner cursor-grab active:cursor-grabbing touch-none flex items-center justify-center"
          >
            {/* Guide overlay */}
            <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-3 border border-white/40 rounded-[20px]">
              <div className="flex justify-between text-[10px] font-mono font-medium text-white/90 bg-black/30 backdrop-blur-xs px-2 py-0.5 rounded-full w-fit">
                <span className="flex items-center gap-1">
                  <Move className="w-3 h-3" /> Drag to frame face
                </span>
              </div>
              <div className="flex justify-center">
                {/* Oval face placement guide */}
                <div className="w-36 h-44 rounded-full border border-dashed border-white/50 pointer-events-none" />
              </div>
              <div className="text-right text-[10px] text-white/80 bg-black/30 backdrop-blur-xs px-2 py-0.5 rounded-full w-fit self-end">
                Card Fit
              </div>
            </div>

            {/* Target Image with interactive pan and zoom */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop Preview"
              onLoad={() => setImageLoaded(true)}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
              className="max-w-none pointer-events-none origin-center"
              draggable={false}
            />
          </div>

          {/* Micro-controls: Zoom Slider & Reset */}
          <div className="w-full max-w-sm mt-5 space-y-3">
            <div className="flex items-center gap-3">
              <ZoomOut className="w-4 h-4 text-[#86868b] shrink-0" />
              <input
                type="range"
                min="0.6"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#e5e5ea] rounded-full appearance-none accent-[#0088e8] cursor-pointer"
              />
              <ZoomIn className="w-4 h-4 text-[#86868b] shrink-0" />
              <span className="text-xs font-mono font-medium text-[#1d1d1f] w-12 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-[#86868b]">
              <span>Center your face within the oval</span>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 font-medium text-[#0088e8] hover:text-[#0077cc] transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Frame
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-[#f0f0f2] flex items-center justify-end gap-3">
          <AppleButton
            variant="secondary"
            size="sm"
            disabled={processing}
            onClick={onClose}
            className="text-xs px-4"
          >
            Cancel
          </AppleButton>
          <AppleButton
            variant="primary"
            size="sm"
            disabled={!imageLoaded || processing}
            onClick={handleCropAndSave}
            className="text-xs px-5 bg-[#0088e8] hover:bg-[#0077cc] text-white flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{processing ? 'Applying Crop...' : 'Apply & Save Headshot'}</span>
          </AppleButton>
        </div>
      </div>
    </div>
  );
};
