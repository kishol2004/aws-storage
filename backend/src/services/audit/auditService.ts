/**
 * auditService.ts — Application-level audit logging service
 *
 * SECURITY: This service NEVER logs:
 * - Passwords or password hashes
 * - JWT tokens or session tokens
 * - AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY
 * - Full document contents
 * - PII beyond what's needed for audit purposes
 *
 * Uses fire-and-forget pattern — audit logging does NOT block the main operation.
 * A failed audit log write does not fail the business operation.
 */
import { createAuditEvent } from '../dynamodb/auditRepository.js';
import { generateId } from '../../utils/ids.js';
import type {
  AuditAction,
  AuditResourceType,
  AuditStatus,
} from '../../models/auditLog.js';

// Sensitive keys that must NEVER appear in audit metadata
const FORBIDDEN_METADATA_KEYS = new Set([
  'password',
  'token',
  'jwt',
  'accessKey',
  'secretKey',
  'awsSecretAccessKey',
  'awsAccessKeyId',
  'authorization',
  'credentials',
  'content',
  'body',
  'extractedText',
]);

function sanitizeMetadata(
  metadata: Record<string, unknown>
): Record<string, string | number | boolean> {
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    // Skip forbidden keys (case-insensitive)
    if (FORBIDDEN_METADATA_KEYS.has(key.toLowerCase())) continue;
    // Only include primitives
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      // Truncate long strings
      safe[key] =
        typeof value === 'string' && value.length > 500
          ? value.substring(0, 500)
          : value;
    }
  }
  return safe;
}

export interface LogEventParams {
  userId: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  status: AuditStatus;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit event. Fire-and-forget — errors are logged but not re-thrown.
 */
export function logAuditEvent(params: LogEventParams): void {
  const {
    userId,
    action,
    resourceType,
    resourceId,
    status,
    ipAddress,
    userAgent,
    metadata,
  } = params;

  const now = new Date().toISOString();
  const eventId = generateId('evt');

  const event = {
    eventId,
    userId,
    action,
    resourceType,
    resourceId,
    timestamp: now,
    date: now.substring(0, 10), // YYYY-MM-DD for GSI partition
    status,
    ipAddress: ipAddress ?? 'unknown',
    userAgent: userAgent
      ? userAgent.substring(0, 200)
      : 'unknown',
    metadata: metadata ? sanitizeMetadata(metadata) : undefined,
  };

  // Structured log for CloudWatch (never includes document contents)
  console.log(
    JSON.stringify({
      level: 'AUDIT',
      action,
      userId,
      resourceId,
      resourceType,
      status,
      timestamp: now,
    })
  );

  // Fire-and-forget DynamoDB write
  createAuditEvent(event).catch((err) => {
    console.error(
      JSON.stringify({
        level: 'ERROR',
        message: 'Failed to persist audit event',
        action,
        userId,
        errorMessage: err instanceof Error ? err.message : 'Unknown',
      })
    );
  });
}
