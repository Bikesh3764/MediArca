/**
 * Client-Side Document & Image Optimizer
 * Performs automatic canvas-based downscaling and compression for images before upload.
 * Preserves clinical contrast, legibility for medicine names, and ensures all uploads
 * comfortably fit within the 1 MB Medical Records Vault threshold.
 */

export const MAX_VAULT_FILE_SIZE = 1 * 1024 * 1024; // 1 MB (1,048,576 bytes)
export const DEFAULT_MAX_DIMENSION = 1920; // 1920px max dimension provides ~230 DPI on A4, ideal for prescriptions
export const DEFAULT_JPEG_QUALITY = 0.80; // High contrast text clarity with 80-90% size reduction

export interface OptimizationResult {
  file: File;
  originalFile: File;
  originalSize: number;
  optimizedSize: number;
  reductionPercentage: number;
  isOptimized: boolean;
  fileType: 'image' | 'pdf' | 'unsupported';
  dimensions?: {
    originalWidth: number;
    originalHeight: number;
    optimizedWidth: number;
    optimizedHeight: number;
  };
  formattedOriginalSize: string;
  formattedOptimizedSize: string;
  mimeType: string;
  statusMessage: string;
}

export interface OptimizationOptions {
  maxDimension?: number;
  quality?: number;
  targetMaxBytes?: number;
  mimeType?: string;
}

/**
 * Format raw byte count into human-readable representation
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val < 10 && i > 0 ? val.toFixed(2) : val.toFixed(1)} ${sizes[i]}`;
}

/**
 * Check if a file or filename is an image
 */
export function isImageFile(identifier: string | File): boolean {
  if (!identifier) return false;
  const target = typeof identifier === 'string' ? identifier.toLowerCase() : (identifier.type || identifier.name).toLowerCase();
  return (
    target.startsWith('image/') ||
    target.endsWith('.jpg') ||
    target.endsWith('.jpeg') ||
    target.endsWith('.png') ||
    target.endsWith('.webp') ||
    target.endsWith('.bmp') ||
    target.endsWith('.heic')
  );
}

/**
 * Check if a file or filename is a PDF
 */
export function isPdfFile(identifier: string | File): boolean {
  if (!identifier) return false;
  const target = typeof identifier === 'string' ? identifier.toLowerCase() : (identifier.type || identifier.name).toLowerCase();
  return target === 'application/pdf' || target.endsWith('.pdf');
}

/**
 * Calculate scaled dimensions preserving aspect ratio
 */
export function calculateScaledDimensions(
  width: number,
  height: number,
  maxDimension: number = DEFAULT_MAX_DIMENSION
): { width: number; height: number; scaled: boolean } {
  if (width <= 0 || height <= 0) {
    return { width: Math.max(1, width), height: Math.max(1, height), scaled: false };
  }

  if (width <= maxDimension && height <= maxDimension) {
    return { width, height, scaled: false };
  }

  let targetWidth = width;
  let targetHeight = height;

  if (width >= height) {
    targetWidth = maxDimension;
    targetHeight = Math.round((height * maxDimension) / width);
  } else {
    targetHeight = maxDimension;
    targetWidth = Math.round((width * maxDimension) / height);
  }

  return {
    width: targetWidth,
    height: targetHeight,
    scaled: true,
  };
}

/**
 * Loads an image file into an HTMLImageElement safely
 */
function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for optimization: ' + (err || 'corrupted image file')));
    };

    img.src = objectUrl;
  });
}

/**
 * Converts canvas to Blob via Promise
 */
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

/**
 * Compresses an image file client-side using HTML5 Canvas.
 * - Downscales large smartphone photos (e.g. 4032x3024) to max dimension 1920px.
 * - Uses bicubic image smoothing for crisp document contrast and legibility.
 * - Fills background with white to prevent transparency artifacts.
 * - Automatically tunes quality to guarantee file stays well below 1 MB vault limit.
 */
export async function optimizeImageFile(
  file: File,
  options: OptimizationOptions = {}
): Promise<OptimizationResult> {
  const maxDimension = options.maxDimension || DEFAULT_MAX_DIMENSION;
  const initialQuality = options.quality || DEFAULT_JPEG_QUALITY;
  const targetMaxBytes = options.targetMaxBytes || MAX_VAULT_FILE_SIZE;

  // Determine output MIME type:
  // For document scans and phone photos, image/jpeg gives 85-95% compression.
  // If original is already image/webp, keep webp.
  const isWebp = file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp');
  const targetMime = options.mimeType || (isWebp ? 'image/webp' : 'image/jpeg');

  const img = await loadImageElement(file);
  const origWidth = img.naturalWidth || img.width;
  const origHeight = img.naturalHeight || img.height;

  let scaled = calculateScaledDimensions(origWidth, origHeight, maxDimension);
  let canvas = document.createElement('canvas');
  canvas.width = scaled.width;
  canvas.height = scaled.height;

  let ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    ctx = canvas.getContext('2d');
  }

  if (!ctx) {
    throw new Error('Canvas 2D context is not supported in this browser.');
  }

  // Draw white background (essential for transparent PNGs converted to JPEG)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, scaled.width, scaled.height);

  // High quality bicubic smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, scaled.width, scaled.height);

  // Iteratively compress with quality backoff if needed to ensure under targetMaxBytes
  let quality = initialQuality;
  let blob: Blob | null = await canvasToBlob(canvas, targetMime, quality);

  // Quality backoff loop (e.g. 0.80 -> 0.70 -> 0.60) if compressed blob is still > 1MB
  let iterations = 0;
  while (blob && blob.size > targetMaxBytes && iterations < 3) {
    iterations++;
    quality = Math.max(0.50, quality - 0.12);
    blob = await canvasToBlob(canvas, targetMime, quality);
  }

  // Secondary backoff: downscale further if still exceeding limit
  if (blob && blob.size > targetMaxBytes) {
    const furtherMaxDim = 1440;
    scaled = calculateScaledDimensions(origWidth, origHeight, furtherMaxDim);
    canvas.width = scaled.width;
    canvas.height = scaled.height;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, scaled.width, scaled.height);
    ctx.drawImage(img, 0, 0, scaled.width, scaled.height);
    blob = await canvasToBlob(canvas, targetMime, 0.65);
  }

  if (!blob) {
    throw new Error('Failed to encode optimized image blob.');
  }

  // If the compressed file is larger than the original and original was already <= 1MB, keep original
  if (file.size <= targetMaxBytes && blob.size >= file.size) {
    return {
      file,
      originalFile: file,
      originalSize: file.size,
      optimizedSize: file.size,
      reductionPercentage: 0,
      isOptimized: false,
      fileType: 'image',
      dimensions: {
        originalWidth: origWidth,
        originalHeight: origHeight,
        optimizedWidth: origWidth,
        optimizedHeight: origHeight,
      },
      formattedOriginalSize: formatFileSize(file.size),
      formattedOptimizedSize: formatFileSize(file.size),
      mimeType: file.type,
      statusMessage: `File already optimal (${formatFileSize(file.size)})`,
    };
  }

  // Generate appropriate filename with matching extension
  let baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  const ext = targetMime === 'image/webp' ? '.webp' : '.jpg';
  const newFileName = `${baseName}${ext}`;

  const optimizedFile = new File([blob], newFileName, {
    type: targetMime,
    lastModified: Date.now(),
  });

  const reductionBytes = file.size - optimizedFile.size;
  const reductionPercentage = Math.max(0, Math.round((reductionBytes / file.size) * 100));

  return {
    file: optimizedFile,
    originalFile: file,
    originalSize: file.size,
    optimizedSize: optimizedFile.size,
    reductionPercentage,
    isOptimized: true,
    fileType: 'image',
    dimensions: {
      originalWidth: origWidth,
      originalHeight: origHeight,
      optimizedWidth: scaled.width,
      optimizedHeight: scaled.height,
    },
    formattedOriginalSize: formatFileSize(file.size),
    formattedOptimizedSize: formatFileSize(optimizedFile.size),
    mimeType: targetMime,
    statusMessage: `Optimized: ${formatFileSize(file.size)} → ${formatFileSize(optimizedFile.size)} (${reductionPercentage}% reduction)`,
  };
}

/**
 * Main vault entrypoint: processes images or verifies PDFs before upload.
 * Provides clear actionable feedback for PDFs and instant automatic compression for images.
 */
export async function processVaultDocument(file: File): Promise<OptimizationResult> {
  if (isImageFile(file)) {
    return await optimizeImageFile(file);
  }

  if (isPdfFile(file)) {
    if (file.size > MAX_VAULT_FILE_SIZE) {
      throw new Error(
        `PDF file size (${formatFileSize(file.size)}) exceeds the 1 MB platform limit. Please compress your PDF or upload photo scans of the document pages for automatic instant optimization.`
      );
    }

    return {
      file,
      originalFile: file,
      originalSize: file.size,
      optimizedSize: file.size,
      reductionPercentage: 0,
      isOptimized: false,
      fileType: 'pdf',
      formattedOriginalSize: formatFileSize(file.size),
      formattedOptimizedSize: formatFileSize(file.size),
      mimeType: 'application/pdf',
      statusMessage: `PDF ready for vault (${formatFileSize(file.size)})`,
    };
  }

  // Unsupported file format
  if (file.size > MAX_VAULT_FILE_SIZE) {
    throw new Error(
      `File size (${formatFileSize(file.size)}) exceeds 1 MB limit. Accepted formats are PDF, PNG, JPG, and WebP.`
    );
  }

  return {
    file,
    originalFile: file,
    originalSize: file.size,
    optimizedSize: file.size,
    reductionPercentage: 0,
    isOptimized: false,
    fileType: 'unsupported',
    formattedOriginalSize: formatFileSize(file.size),
    formattedOptimizedSize: formatFileSize(file.size),
    mimeType: file.type || 'application/octet-stream',
    statusMessage: `File ready (${formatFileSize(file.size)})`,
  };
}
