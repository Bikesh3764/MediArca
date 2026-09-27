import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'mediarca-vault';
export const R2_PUBLIC_URL = (
  process.env.R2_PUBLIC_URL || 'https://pub-a590817d9f404eb889f6482b025ea9ad.r2.dev'
).replace(/\/$/, '');

export const isR2Configured = (): boolean => {
  return Boolean(R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ACCOUNT_ID);
};

let _r2Client: S3Client | null = null;
export const getR2Client = (): S3Client => {
  if (!_r2Client) {
    _r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _r2Client;
};

/**
 * Upload a file buffer to Cloudflare R2 Bucket and return its permanent public CDN URL.
 */
export const uploadToR2 = async (
  fileBuffer: Buffer,
  key: string,
  contentType: string
): Promise<string> => {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 credentials are not configured in environment variables');
  }

  const cleanKey = key.replace(/^\/+/, '');
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: cleanKey,
    Body: fileBuffer,
    ContentType: contentType,
  });

  const client = getR2Client();
  await client.send(command);
  return `${R2_PUBLIC_URL}/${cleanKey}`;
};

/**
 * Delete an object from Cloudflare R2 Bucket.
 */
export const deleteFromR2 = async (keyOrUrl: string): Promise<void> => {
  if (!isR2Configured()) return;

  try {
    let key = keyOrUrl;
    if (keyOrUrl.startsWith('http')) {
      const parsed = new URL(keyOrUrl);
      key = parsed.pathname.replace(/^\/+/, '');
    }

    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const client = getR2Client();
    await client.send(command);
  } catch (err) {
    console.warn('Warning: Could not delete object from R2:', err);
  }
};
