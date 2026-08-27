/**
 * fileValidation.ts
 * Validates file metadata before generating presigned upload URLs.
 * NOTE: This validates metadata only — not actual file byte content.
 * Real byte-level validation occurs in the processing Lambda after upload.
 */
import { z } from 'zod';
import { FileValidationError, FileTooLargeError } from './errors.js';
import { config } from '../config/environment.js';

// ─── Allowed file types ───────────────────────────────────────────────────────

export const ALLOWED_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'txt',
  'png',
  'jpg',
  'jpeg',
] as const;

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

export const ALLOWED_MIME_TYPES: Record<AllowedExtension, string[]> = {
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  txt: ['text/plain'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
};

// Flat set of all allowed MIME types
const ALLOWED_MIME_SET = new Set(
  Object.values(ALLOWED_MIME_TYPES).flat()
);

// Blocked extensions — executable and script files
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js', 'ts',
  'py', 'rb', 'php', 'asp', 'aspx', 'jsp', 'jar', 'war',
  'dll', 'so', 'dylib', 'app', 'dmg', 'iso', 'msi', 'deb',
  'rpm', 'apk', 'ipa', 'scr', 'com', 'pif',
]);

// Suspicious filename patterns
const SUSPICIOUS_PATTERNS = [
  /\.\./,               // Path traversal
  /^\.+$/,              // Only dots
  /[\x00-\x1f]/,       // Control characters
  /[<>:"|?*]/,          // Invalid filename chars
  /^\s+|\s+$/,          // Leading/trailing whitespace
];

// ─── Zod schema for upload request validation ─────────────────────────────────

export const FileMetadataSchema = z.object({
  filename: z
    .string()
    .min(1, 'Filename is required')
    .max(255, 'Filename is too long')
    .trim(),
  mimeType: z
    .string()
    .min(1, 'MIME type is required')
    .max(100, 'MIME type is too long')
    .trim(),
  fileSize: z
    .number()
    .int('File size must be an integer')
    .positive('File size must be positive'),
  folderId: z.string().optional(),
});

export type FileMetadata = z.infer<typeof FileMetadataSchema>;

// ─── Validation function ──────────────────────────────────────────────────────

export function validateFileMetadata(metadata: FileMetadata): void {
  const { filename, mimeType, fileSize } = metadata;

  // 1. Check for suspicious filename patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(filename)) {
      throw new FileValidationError(
        'The filename contains invalid or suspicious characters.'
      );
    }
  }

  // 2. Extract and validate extension
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    throw new FileValidationError('The file must have an extension.');
  }

  const extension = filename.substring(lastDot + 1).toLowerCase();

  // 3. Block dangerous extensions
  if (BLOCKED_EXTENSIONS.has(extension)) {
    throw new FileValidationError(
      `Files with the .${extension} extension are not allowed.`
    );
  }

  // 4. Check allowed extensions
  if (!ALLOWED_EXTENSIONS.includes(extension as AllowedExtension)) {
    throw new FileValidationError(
      `File type .${extension} is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.`
    );
  }

  // 5. Validate MIME type
  if (!ALLOWED_MIME_SET.has(mimeType)) {
    throw new FileValidationError(
      `MIME type "${mimeType}" is not allowed.`
    );
  }

  // 6. Cross-check extension vs MIME type
  const allowedMimesForExt =
    ALLOWED_MIME_TYPES[extension as AllowedExtension] ?? [];
  if (!allowedMimesForExt.includes(mimeType)) {
    throw new FileValidationError(
      `MIME type "${mimeType}" does not match the expected type for .${extension} files.`
    );
  }

  // 7. Validate file size
  const maxBytes = config.maxFileSizeMb * 1024 * 1024;
  if (fileSize > maxBytes) {
    throw new FileTooLargeError(config.maxFileSizeMb);
  }

  if (fileSize === 0) {
    throw new FileValidationError('File cannot be empty.');
  }
}

/**
 * Determine whether a file type requires Textract asynchronous processing.
 * PDF → async job; images → sync DetectDocumentText.
 */
export function requiresAsyncTextract(extension: string): boolean {
  return extension.toLowerCase() === 'pdf';
}

/**
 * Determine if the file type is extractable by Textract.
 */
export function isTextractSupported(extension: string): boolean {
  const supported = new Set(['pdf', 'png', 'jpg', 'jpeg']);
  return supported.has(extension.toLowerCase());
}
