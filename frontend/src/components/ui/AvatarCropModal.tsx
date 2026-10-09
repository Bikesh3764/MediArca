import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, X, Check, Move, Maximize2, User } from 'lucide-react';

interface AvatarCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropComplete: (croppedFile: File) => void;
  aspectRatio?: number;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
}) => {
  const [selectedRatio, setSelectedRatio] = useState<'1:1' | '4:3'>('1:1');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [processing, setProcessing] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 400);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Box dimensions on screen based on selected aspect ratio, adaptively scaled for mobile screens
  const availWidth = Math.max(240, Math.min(320, viewportWidth - 64));
  const boxWidth = selectedRatio === '1:1' ? availWidth : Math.min(340, availWidth + 20);
  const boxHeight = selectedRatio === '1:1' ? boxWidth : Math.round(boxWidth * 0.75);

  // On image load, detect dimensions and choose smart default aspect ratio
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setImgDimensions({ width: naturalWidth, height: naturalHeight });
      const diffRatio = Math.abs(naturalWidth - naturalHeight) / Math.max(naturalWidth, naturalHeight);
      setSelectedRatio(diffRatio < 0.2 ? '1:1' : '4:3');
    }
  };

  // Pre-load and measure image immediately upon open to guarantee dimensions
  useEffect(() => {
    if (isOpen && imageSrc) {
      queueMicrotask(() => {
        setProcessing(false);
      });
      const testImg = new Image();
      testImg.onload = () => {
        const w = testImg.naturalWidth || 800;
        const h = testImg.naturalHeight || 800;
        setImgDimensions({ width: w, height: h });
        const diffRatio = Math.abs(w - h) / Math.max(w, h);
        setSelectedRatio(diffRatio < 0.2 ? '1:1' : '4:3');
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      };
      testImg.src = imageSrc;
      if (testImg.complete && testImg.naturalWidth > 0) {
        testImg.onload(new Event('load') as any);
      }
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

  // Fit entire photo shortcut: 100% fit inside frame with zero cutoffs
  const handleFitEntirePhoto = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Focus face shortcut
  const handleFocusFace = () => {
    setZoom(1.35);
    setOffset({ x: 0, y: 0 });
  };

  // Perform mathematically exact offscreen canvas crop
  const handleCropAndSave = useCallback(async () => {
    if (!imageSrc) return;
    setProcessing(true);

    try {
      let naturalW = imgDimensions.width;
      let naturalH = imgDimensions.height;
      let img: HTMLImageElement | null = imageRef.current;

      if (!img || naturalW === 0 || naturalH === 0) {
        img = new Image();
        await new Promise<void>((resolve) => {
          img!.onload = () => resolve();
          img!.onerror = () => resolve();
          img!.src = imageSrc;
          if (img!.complete && img!.naturalWidth > 0) resolve();
        });
        naturalW = img.naturalWidth || 800;
        naturalH = img.naturalHeight || 800;
      }

      const C_w = containerRef.current?.clientWidth || boxWidth;
      const C_h = containerRef.current?.clientHeight || boxHeight;

      // High-resolution export canvas (800x800 for 1:1 or 800x600 for 4:3)
      const targetWidth = 800;
      const targetHeight = selectedRatio === '1:1' ? 800 : 600;

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not initialize canvas context');
      }

      // Pure white canvas background for seamless blending
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // Multiplier from on-screen preview box to canvas
      const multiplier = targetWidth / C_w;

      // Fit scale calculation (matches on-screen display exactly)
      const fitScale = Math.min(C_w / naturalW, C_h / naturalH);
      const renderedW = naturalW * fitScale * zoom;
      const renderedH = naturalH * fitScale * zoom;

      // Center of box
      const centerX = C_w / 2;
      const centerY = C_h / 2;

      // Image top-left on screen
      const imgScreenX = centerX - renderedW / 2 + offset.x;
      const imgScreenY = centerY - renderedH / 2 + offset.y;

      // Map coordinates to target canvas
      const drawCanvasX = imgScreenX * multiplier;
      const drawCanvasY = imgScreenY * multiplier;
      const drawCanvasW = renderedW * multiplier;
      const drawCanvasH = renderedH * multiplier;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(
        img,
        0,
        0,
        naturalW,
        naturalH,
        drawCanvasX,
        drawCanvasY,
        drawCanvasW,
        drawCanvasH
      );

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setProcessing(false);
            return;
          }
          const croppedFile = new File([blob], 'doctor-avatar-framed.jpg', {
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
  }, [boxHeight, boxWidth, imageSrc, imgDimensions, offset, onCropComplete, selectedRatio, zoom]);

  if (!isOpen || !imageSrc) return null;

  // Calculate rendered width and height in the on-screen container
  const fitScale = imgDimensions.width > 0
    ? Math.min(boxWidth / imgDimensions.width, boxHeight / imgDimensions.height)
    : 1;
  const currentRenderedW = imgDimensions.width * fitScale * zoom;
  const currentRenderedH = imgDimensions.height * fitScale * zoom;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-[460px] bg-white rounded-[28px] border border-[#e5e5ea] shadow-[0_24px_64px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col max-h-[94vh] p-6 sm:p-7">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
            Adjust Profile Photo
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport & Cropping Area */}
        <div className="flex flex-col items-center select-none overflow-y-auto">
          {/* Aspect Ratio Switcher */}
          <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl flex gap-1 select-none w-full mb-4">
            <button
              type="button"
              onClick={() => {
                setSelectedRatio('1:1');
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
              className={`flex-1 py-2 text-xs rounded-lg transition-all duration-150 cursor-pointer text-center ${
                selectedRatio === '1:1'
                  ? 'bg-white text-[#1d1d1f] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_1px_rgba(0,0,0,0.04)] border border-black/5'
                  : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
              }`}
            >
              1:1 Square
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedRatio('4:3');
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
              className={`flex-1 py-2 text-xs rounded-lg transition-all duration-150 cursor-pointer text-center ${
                selectedRatio === '4:3'
                  ? 'bg-white text-[#1d1d1f] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_1px_rgba(0,0,0,0.04)] border border-black/5'
                  : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
              }`}
            >
              4:3 Portrait
            </button>
          </div>

          {/* Interactive Frame Box */}
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              width: `${boxWidth}px`,
              height: `${boxHeight}px`,
              maxWidth: '100%',
            }}
            className="relative rounded-2xl overflow-hidden bg-[#f5f5f7] border border-[#d2d2d7] cursor-grab active:cursor-grabbing touch-none flex items-center justify-center mx-auto"
          >
            {/* Guide overlay */}
            <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-3">
              <div className="flex justify-between items-center text-[11px] font-medium text-[#1d1d1f] bg-white/90 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-black/5 w-fit">
                <span className="flex items-center gap-1">
                  <Move className="w-3 h-3 text-[#0066cc]" /> Drag to reposition
                </span>
              </div>
              <div className="flex justify-center">
                <div
                  style={{
                    width: selectedRatio === '1:1' ? '240px' : '200px',
                    height: selectedRatio === '1:1' ? '240px' : '200px',
                  }}
                  className="rounded-full border border-dashed border-[#0066cc]/40 pointer-events-none"
                />
              </div>
              <div />
            </div>

            {/* Target Image with interactive pan and zoom */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop Preview"
              onLoad={handleImageLoad}
              style={{
                width: imgDimensions.width > 0 ? `${currentRenderedW}px` : 'auto',
                height: imgDimensions.height > 0 ? `${currentRenderedH}px` : 'auto',
                transform: `translate(${offset.x}px, ${offset.y}px)`,
                transition: isDragging ? 'none' : 'transform 0.08s ease-out',
              }}
              className="max-w-none pointer-events-none select-none origin-center"
              draggable={false}
            />
          </div>

          {/* Quick Fit Shortcuts */}
          <div className="flex items-center gap-2 mt-4">
            <button
              type="button"
              onClick={handleFitEntirePhoto}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5 text-[#0066cc]" />
              Fit Photo
            </button>
            <button
              type="button"
              onClick={handleFocusFace}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-[#0066cc]" />
              Center Face
            </button>
            <button
              type="button"
              onClick={handleFitEntirePhoto}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-[#0066cc] hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          {/* Zoom Slider */}
          <div className="w-full mt-4">
            <div className="flex items-center gap-3">
              <ZoomOut className="w-4 h-4 text-[#86868b] shrink-0" />
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#e5e5ea] rounded-full appearance-none accent-[#0066cc] cursor-pointer"
              />
              <ZoomIn className="w-4 h-4 text-[#86868b] shrink-0" />
              <span className="text-xs font-medium text-[#1d1d1f] w-11 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-5 mt-5 border-t border-[#e5e5ea] flex items-center gap-2.5">
          <button
            type="button"
            disabled={processing}
            onClick={onClose}
            className="flex-1 h-11 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e5e5ea] text-[#1d1d1f] text-sm font-medium transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={handleCropAndSave}
            className="flex-1 h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-medium transition-all duration-150 shadow-[0_2px_8px_rgba(0,102,204,0.2),0_1px_2px_rgba(0,0,0,0.06)] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <Check className="w-4 h-4" />
            <span>{processing ? 'Saving...' : 'Save Photo'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

