/**
 * Document & Image Optimizer Utility
 * Handles dimension calculation, compression metrics, size formatting,
 * and upload threshold validation for MediArca Vault.
 */

export const MAX_VAULT_FILE_SIZE = 1 * 1024 * 1024; // 1 MB (1,048,576 bytes)
export const DEFAULT_MAX_IMAGE_DIMENSION = 1920; // 1920px preserves sharp clinical text and handwriting
export const DEFAULT_IMAGE_QUALITY = 0.80; // Optimal balance: ~85% size reduction with crystal-clear legibility

export interface ScaledDimensions {
  width: number;
  height: number;
  scaled: boolean;
  scaleRatio: number;
}

export interface DocumentValidationResult {
  valid: boolean;
  error: string | null;
  requiresClientCompression: boolean;
  fileType: 'image' | 'pdf' | 'unsupported';
  formattedSize: string;
}

export interface CompressionEstimate {
  estimatedBytes: number;
  reductionPercentage: number;
  fitsWithin1MB: boolean;
  formattedOriginalSize: string;
  formattedEstimatedSize: string;
}

/**
 * Format raw byte size into human-readable representation
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val < 10 && i > 0 ? val.toFixed(2) : val.toFixed(1)} ${sizes[i]}`;
}

export const DEFAULT_AVATAR_IMAGE_DIMENSION = 512; // 512px max for crisp profile avatars

/**
 * Check if filename or mime type corresponds to a supported image
 */
export function isImageFile(identifier: string, secondaryIdentifier?: string): boolean {
  const check = (str?: string) => {
    if (!str) return false;
    const lower = str.toLowerCase();
    return (
      lower.startsWith('image/') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.bmp') ||
      lower.endsWith('.heic')
    );
  };
  return check(identifier) || check(secondaryIdentifier);
}

/**
 * Check if filename or mime type corresponds to a PDF
 */
export function isPdfFile(identifier: string, secondaryIdentifier?: string): boolean {
  const check = (str?: string) => {
    if (!str) return false;
    const lower = str.toLowerCase();
    return lower === 'application/pdf' || lower.endsWith('.pdf');
  };
  return check(identifier) || check(secondaryIdentifier);
}

/**
 * Calculate scaled dimensions while strictly preserving aspect ratio.
 * Downscales images exceeding maxDimension (e.g. 4032x3024 smartphone photos down to 1920x1440).
 */
export function calculateScaledDimensions(
  width: number,
  height: number,
  maxDimension: number = DEFAULT_MAX_IMAGE_DIMENSION
): ScaledDimensions {
  if (width <= 0 || height <= 0) {
    return { width: Math.max(1, width), height: Math.max(1, height), scaled: false, scaleRatio: 1.0 };
  }

  if (width <= maxDimension && height <= maxDimension) {
    return { width, height, scaled: false, scaleRatio: 1.0 };
  }

  let targetWidth = width;
  let targetHeight = height;

  if (width >= height) {
    targetWidth = maxDimension;
    targetHeight = Math.max(1, Math.round((height * maxDimension) / width));
  } else {
    targetHeight = maxDimension;
    targetWidth = Math.max(1, Math.round((width * maxDimension) / height));
  }

  const scaleRatio = targetWidth / width;

  return {
    width: targetWidth,
    height: targetHeight,
    scaled: true,
    scaleRatio: Math.round(scaleRatio * 1000) / 1000,
  };
}

/**
 * Estimate compressed image byte size after canvas downscaling and JPEG/WebP compression.
 * High-res smartphone images (3MB - 10MB) typically drop to 150KB - 300KB (~85-95% reduction).
 */
export function estimateCompressedImageSize(
  originalBytes: number,
  originalWidth: number,
  originalHeight: number,
  maxDimension: number = DEFAULT_MAX_IMAGE_DIMENSION,
  quality: number = DEFAULT_IMAGE_QUALITY
): CompressionEstimate {
  const scaled = calculateScaledDimensions(originalWidth, originalHeight, maxDimension);
  
  // Pixel area reduction factor
  const originalPixels = originalWidth * originalHeight;
  const scaledPixels = scaled.width * scaled.height;
  const pixelRatio = originalPixels > 0 ? scaledPixels / originalPixels : 1.0;

  // Typical JPEG compressed byte efficiency: ~0.15 - 0.25 bytes per pixel at 0.80 quality
  const estimatedFromPixels = Math.round(scaledPixels * 0.18 * (quality / 0.8));
  
  // Or scaled from original bytes with quality and dimension scaling factor
  const estimatedFromBytes = Math.round(originalBytes * pixelRatio * 0.45 * quality);

  // Take conservative realistic estimate (clamped to realistic bounds: min 60KB, max 350KB for 1920px @ 0.80)
  let estimatedBytes = Math.min(estimatedFromPixels, estimatedFromBytes);
  if (scaled.scaled) {
    estimatedBytes = Math.max(80 * 1024, Math.min(estimatedBytes, 320 * 1024));
  } else {
    estimatedBytes = Math.min(originalBytes, Math.max(40 * 1024, Math.round(originalBytes * 0.5 * quality)));
  }

  const reductionPercentage = Math.max(0, Math.round(((originalBytes - estimatedBytes) / originalBytes) * 100));

  return {
    estimatedBytes,
    reductionPercentage,
    fitsWithin1MB: estimatedBytes <= MAX_VAULT_FILE_SIZE,
    formattedOriginalSize: formatFileSize(originalBytes),
    formattedEstimatedSize: formatFileSize(estimatedBytes),
  };
}

/**
 * Validates document before or after client-side compression.
 * Clarifies why uncompressed 5MB photos are accepted (via client compression) while large PDFs require guidance.
 */
export function validateVaultDocument(
  file: { name: string; size: number; mimetype?: string },
  isPostCompression: boolean = false
): DocumentValidationResult {
  const isImg = isImageFile(file.mimetype || '', file.name);
  const isPdf = isPdfFile(file.mimetype || '', file.name);
  const fileType = isImg ? 'image' : isPdf ? 'pdf' : 'unsupported';
  const formattedSize = formatFileSize(file.size);

  if (fileType === 'unsupported') {
    return {
      valid: false,
      error: 'Invalid file type. Only PDF, JPG, PNG, and WebP are accepted in the Medical Records Vault.',
      requiresClientCompression: false,
      fileType,
      formattedSize,
    };
  }

  // If already compressed or PDF
  if (isPostCompression || !isImg) {
    if (file.size > MAX_VAULT_FILE_SIZE) {
      const errorMsg = isPdf
        ? `PDF file size (${formattedSize}) exceeds the 1 MB limit. Please compress your PDF or upload photo scans of the document pages for automatic instant optimization.`
        : `File size (${formattedSize}) exceeds 1 MB limit. Please upload a document under 1 MB.`;
      return {
        valid: false,
        error: errorMsg,
        requiresClientCompression: false,
        fileType,
        formattedSize,
      };
    }
    return {
      valid: true,
      error: null,
      requiresClientCompression: false,
      fileType,
      formattedSize,
    };
  }

  // Pre-compression image check:
  // If an image is selected that is > 1MB, client compression will optimize it!
  const requiresClientCompression = file.size > MAX_VAULT_FILE_SIZE;

  return {
    valid: true, // It is valid because client-side compression will optimize it before upload
    error: null,
    requiresClientCompression,
    fileType,
    formattedSize,
  };
}
