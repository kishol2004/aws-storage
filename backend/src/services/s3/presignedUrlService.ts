/**
 * presignedUrlService.ts — S3 presigned URL generation
 *
 * SECURITY:
 * - Never returns permanent S3 URLs
 * - Never returns public-read URLs
 * - Uses short-lived expiry (upload: 15 min, download: 5 min)
 * - Never returns AWS credentials
 * - All objects are in a private bucket with BlockPublicAccess enabled
 */
import {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import {
  getSignedUrl,
} from '@aws-sdk/s3-request-presigner';
import { s3Client } from './client.js';
import { config } from '../../config/environment.js';
import { StorageError } from '../../utils/errors.js';

const BUCKET = () => config.documentsBucket;

// ─── Upload ───────────────────────────────────────────────────────────────────

export interface PresignedUploadResult {
  uploadUrl: string;
  expiresIn: number;
}

/**
 * Generate a short-lived S3 presigned PUT URL for direct browser upload.
 * The browser uploads directly to S3 — the file never passes through Lambda.
 */
export async function generateUploadUrl(
  s3Key: string,
  contentType: string,
  contentLength: number
): Promise<PresignedUploadResult> {
  try {
    const expiresIn = config.uploadUrlExpirySeconds; // default 900s (15 min)

    const command = new PutObjectCommand({
      Bucket: BUCKET(),
      Key: s3Key,
      ContentType: contentType,
      ContentLength: contentLength,
      // Server-side encryption is enforced by bucket policy
      ServerSideEncryption: 'AES256',
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

    return { uploadUrl, expiresIn };
  } catch (err) {
    console.error(
      JSON.stringify({ level: 'ERROR', message: 'Failed to generate upload URL', s3Key })
    );
    throw new StorageError('Failed to generate upload URL.');
  }
}

// ─── Download ─────────────────────────────────────────────────────────────────

export interface PresignedDownloadResult {
  downloadUrl: string;
  expiresIn: number;
}

/**
 * Generate a short-lived S3 presigned GET URL for secure download.
 * Sets Content-Disposition to force file download with the original filename.
 */
export async function generateDownloadUrl(
  s3Key: string,
  originalFilename: string
): Promise<PresignedDownloadResult> {
  try {
    const expiresIn = config.downloadUrlExpirySeconds; // default 300s (5 min)

    const command = new GetObjectCommand({
      Bucket: BUCKET(),
      Key: s3Key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(originalFilename)}"`,
    });

    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn });

    return { downloadUrl, expiresIn };
  } catch (err) {
    console.error(
      JSON.stringify({ level: 'ERROR', message: 'Failed to generate download URL', s3Key })
    );
    throw new StorageError('Failed to generate download URL.');
  }
}

// ─── Object Operations ────────────────────────────────────────────────────────

export async function deleteS3Object(s3Key: string): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: BUCKET(), Key: s3Key })
    );
  } catch (err) {
    console.error(
      JSON.stringify({ level: 'ERROR', message: 'Failed to delete S3 object', s3Key })
    );
    throw new StorageError('Failed to delete file from storage.');
  }
}

export async function objectExists(s3Key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({ Bucket: BUCKET(), Key: s3Key })
    );
    return true;
  } catch {
    return false;
  }
}

export async function putTextObject(
  s3Key: string,
  content: string
): Promise<void> {
  const { PutObjectCommand: Put } = await import('@aws-sdk/client-s3');
  await s3Client.send(
    new Put({
      Bucket: BUCKET(),
      Key: s3Key,
      Body: content,
      ContentType: 'text/plain; charset=utf-8',
      ServerSideEncryption: 'AES256',
    })
  );
}

export async function getTextObject(s3Key: string): Promise<string> {
  const result = await s3Client.send(
    new GetObjectCommand({ Bucket: BUCKET(), Key: s3Key })
  );
  if (!result.Body) throw new StorageError('Empty object body.');
  return result.Body.transformToString('utf-8');
}
