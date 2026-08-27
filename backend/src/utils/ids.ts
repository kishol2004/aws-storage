/**
 * ids.ts
 * Secure ID generation and filename sanitization utilities.
 * Prevents path traversal attacks and ensures safe S3 object keys.
 */
import { v4 as uuidv4 } from 'uuid';

const PATH_TRAVERSAL_RE = /\.\./g;
const UNSAFE_CHARS_RE = /[^a-zA-Z0-9._\-]/g;
const LEADING_DOTS_RE = /^\.+/;
const MAX_FILENAME_LENGTH = 200;
const DEFAULT_FOLDER_ID = 'root';

/**
 * Generate a UUID-based ID with an optional prefix.
 * e.g. generateId('doc') → 'doc_3f2504e0-4f89-11d3-9a0c-0305e82c3301'
 */
export function generateId(prefix?: string): string {
  const id = uuidv4();
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Sanitize a user-provided filename.
 * - Removes path traversal sequences (../)
 * - Removes unsafe characters
 * - Strips leading dots
 * - Enforces max length
 * - Lowercases the extension
 */
export function sanitizeFilename(rawFilename: string): string {
  // Extract just the basename — ignore any directory component
  const basename = rawFilename.split(/[\\/]/).pop() ?? rawFilename;

  let safe = basename
    .replace(PATH_TRAVERSAL_RE, '')     // Remove ..
    .replace(UNSAFE_CHARS_RE, '_')       // Replace unsafe chars with underscore
    .replace(LEADING_DOTS_RE, '');       // Remove leading dots

  // Normalize extension to lowercase
  const dotIndex = safe.lastIndexOf('.');
  if (dotIndex !== -1) {
    safe =
      safe.substring(0, dotIndex) +
      safe.substring(dotIndex).toLowerCase();
  }

  // Enforce max length
  if (safe.length > MAX_FILENAME_LENGTH) {
    const ext = dotIndex !== -1 ? safe.substring(dotIndex) : '';
    const name = safe.substring(0, MAX_FILENAME_LENGTH - ext.length);
    safe = name + ext;
  }

  // Default if sanitization produced an empty string
  if (!safe || safe === '.') {
    safe = 'file';
  }

  return safe;
}

/**
 * Build a secure S3 object key.
 * Format: users/{userId}/folders/{folderId}/{documentId}/{sanitizedFilename}
 * - Never uses raw user input as part of the prefix path
 * - Validates each segment is safe
 */
export function buildS3Key(
  userId: string,
  folderId: string | undefined | null,
  documentId: string,
  rawFilename: string
): string {
  // Sanitize each path segment individually
  const safeUserId = sanitizePathSegment(userId);
  const safeFolderId = sanitizePathSegment(folderId ?? DEFAULT_FOLDER_ID);
  const safeDocumentId = sanitizePathSegment(documentId);
  const safeFilename = sanitizeFilename(rawFilename);

  return `users/${safeUserId}/folders/${safeFolderId}/${safeDocumentId}/${safeFilename}`;
}

/**
 * Sanitize a path segment (ID) — only allows alphanumeric, dash, underscore.
 */
function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9\-_]/g, '');
}

/**
 * Validate that a string looks like a valid UUID (v4 format).
 */
export function isValidUuid(id: string): boolean {
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return UUID_RE.test(id);
}

/**
 * Validate that a string looks like a prefixed ID (e.g. doc_uuid).
 */
export function isValidPrefixedId(id: string, prefix: string): boolean {
  const parts = id.split('_');
  if (parts.length < 2 || parts[0] !== prefix) return false;
  return isValidUuid(parts.slice(1).join('_'));
}
