/** auditLog.ts — Application-level audit log model */

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'VIEW'
  | 'SHARE'
  | 'PERMISSION_CHANGED'
  | 'SHARE_REVOKED'
  | 'RENAME'
  | 'MOVE'
  | 'DELETE'
  | 'RESTORE'
  | 'PERMANENT_DELETE'
  | 'AI_PROCESSING_STARTED'
  | 'AI_PROCESSING_COMPLETED'
  | 'AI_PROCESSING_FAILED'
  | 'ACCESS_DENIED'
  | 'ADMIN_ACTION'
  | 'FOLDER_CREATE'
  | 'FOLDER_UPDATE'
  | 'FOLDER_DELETE'
  | 'FAVORITE_TOGGLED';

export type AuditResourceType =
  | 'DOCUMENT'
  | 'FOLDER'
  | 'SHARE'
  | 'USER'
  | 'SYSTEM';

export type AuditStatus = 'SUCCESS' | 'FAILED';

export interface AuditLogEntity {
  eventId: string;
  userId: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  timestamp: string;       // ISO 8601
  status: AuditStatus;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, string | number | boolean>;
  // NOTE: metadata must NEVER include passwords, tokens, credentials, or document contents
}
