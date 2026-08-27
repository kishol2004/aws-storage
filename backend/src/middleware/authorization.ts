/**
 * authorization.ts — Server-side authorization middleware
 *
 * SECURITY RULES:
 * - Authorization is ALWAYS enforced server-side inside Lambda.
 * - Frontend role/ownership checks are supplementary UX only, not security.
 * - Never trust ownerId, userId, role, or permission from the request body.
 * - Admin role is verified from Cognito groups, never from request payload.
 */
import type { CognitoUser } from './auth.js';
import type { DocumentEntity } from '../models/document.js';
import type { FolderEntity } from '../models/folder.js';
import type { ShareEntity, SharePermission } from '../models/share.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';
import { hasPermission } from '../models/share.js';

// ─── Role Checks ──────────────────────────────────────────────────────────────

/**
 * Require the authenticated user to have the ADMIN role.
 * Role is read from Cognito groups claim — never from request body.
 */
export function requireAdmin(user: CognitoUser): void {
  if (!user.groups.includes('ADMIN')) {
    // Return generic 403 — do not reveal admin endpoint existence
    throw new ForbiddenError(
      'You do not have permission to access this resource.'
    );
  }
}

// ─── Document Authorization ───────────────────────────────────────────────────

/**
 * Require the requesting user to be the document owner.
 */
export function requireDocumentOwner(
  document: DocumentEntity,
  userId: string
): void {
  if (document.ownerId !== userId) {
    throw new ForbiddenError(
      'You do not have permission to perform this action on this document.'
    );
  }
}

/**
 * Require the user to have document access:
 * - Either as the owner, OR
 * - Via an active, non-expired share with sufficient permission.
 *
 * @param document - The document being accessed
 * @param userId - The authenticated user's Cognito sub
 * @param activeShare - Active share record if one exists for this user+document
 * @param requiredPermission - Minimum required permission level
 */
export function requireDocumentAccess(
  document: DocumentEntity,
  userId: string,
  activeShare: ShareEntity | null,
  requiredPermission: SharePermission
): void {
  // Owner has full access
  if (document.ownerId === userId) {
    return;
  }

  // Check sharing
  if (!activeShare) {
    throw new ForbiddenError(
      'You do not have permission to access this document.'
    );
  }

  // Verify share is active and not expired
  if (activeShare.status !== 'ACTIVE') {
    throw new ForbiddenError('Your access to this document has been revoked.');
  }

  if (
    activeShare.expiresAt &&
    new Date(activeShare.expiresAt) < new Date()
  ) {
    throw new ForbiddenError('Your access to this document has expired.');
  }

  // Verify permission level is sufficient
  if (!hasPermission(activeShare.permission, requiredPermission)) {
    throw new ForbiddenError(
      `This action requires ${requiredPermission} permission on this document.`
    );
  }
}

// ─── Folder Authorization ─────────────────────────────────────────────────────

/**
 * Require the requesting user to own the folder.
 */
export function requireFolderOwner(
  folder: FolderEntity,
  userId: string
): void {
  if (folder.ownerId !== userId) {
    // Return 404 to avoid leaking existence of other users' folders
    throw new NotFoundError('Folder');
  }
}

// ─── Share Authorization ──────────────────────────────────────────────────────

/**
 * Require the requesting user to be the share owner (document owner who created the share).
 */
export function requireShareOwner(
  share: ShareEntity,
  userId: string
): void {
  if (share.ownerId !== userId) {
    throw new ForbiddenError(
      'Only the document owner can manage shares.'
    );
  }
}
