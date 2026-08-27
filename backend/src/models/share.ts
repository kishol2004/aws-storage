/** share.ts — Document sharing model */

export type SharePermission = 'VIEW' | 'DOWNLOAD' | 'EDIT';
export type ShareStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface ShareEntity {
  shareId: string;
  documentId: string;
  ownerId: string;            // Document owner who initiated the share
  sharedWithUserId: string;   // Cognito sub of the recipient
  sharedWithEmail: string;    // For display only
  permission: SharePermission;
  status: ShareStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;         // ISO 8601; if absent, share does not expire
}

/** Hierarchical permission check: EDIT > DOWNLOAD > VIEW */
export const PERMISSION_HIERARCHY: Record<SharePermission, number> = {
  VIEW: 1,
  DOWNLOAD: 2,
  EDIT: 3,
};

export function hasPermission(
  userPermission: SharePermission,
  requiredPermission: SharePermission
): boolean {
  return (
    PERMISSION_HIERARCHY[userPermission] >=
    PERMISSION_HIERARCHY[requiredPermission]
  );
}
