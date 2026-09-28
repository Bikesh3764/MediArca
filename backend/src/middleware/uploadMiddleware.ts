import multer from 'multer';
import path from 'path';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const ALLOWED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

export const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/jpg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
};

/**
 * Validates magic bytes (file signature) against the declared MIME type
 */
export const validateMagicBytes = (buffer: Buffer, mime: string): boolean => {
  if (!buffer || buffer.length < 4) return false;

  const normalizedMime = (mime || '').toLowerCase();

  // PDF: %PDF- (0x25, 0x50, 0x44, 0x46)
  if (normalizedMime === 'application/pdf') {
    return (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    );
  }

  // JPEG: FF D8 FF
  if (normalizedMime === 'image/jpeg' || normalizedMime === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: 89 50 4E 47
  if (normalizedMime === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }

  // WebP: RIFF ... WEBP (0x52 0x49 0x46 0x46 ... 0x57 0x45 0x42 0x50)
  if (normalizedMime === 'image/webp') {
    if (buffer.length < 12) return false;
    const isRiff =
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46;
    const isWebp =
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50;
    return isRiff && isWebp;
  }

  return false;
};

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const mime = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();

  const allowedExtsForMime = MIME_TO_EXTENSIONS[mime];

  // Must satisfy BOTH allowed MIME and matching allowed extension (Finding #27)
  if (ALLOWED_MIME_TYPES.includes(mime) && ALLOWED_FILE_EXTENSIONS.includes(ext) && allowedExtsForMime?.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type or extension mismatch. Only PDF, JPG, PNG, and WebP files are allowed.'));
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB strict limit
  fileFilter,
});
