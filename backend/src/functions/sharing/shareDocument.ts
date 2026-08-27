/**
 * shareDocument.ts — POST /documents/{id}/share
 *
 * Authorization flow:
 * 1. Caller must be document owner
 * 2. Recipient must exist in Cognito
 * 3. Prevent self-sharing
 * 4. Prevent duplicate active shares (update permission instead)
 * 5. Create share record with sanitized inputs
 * 6. Notify recipient
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser, extractIpAddress, extractUserAgent } from '../../middleware/auth.js';
import { requireDocumentOwner } from '../../middleware/authorization.js';
import { validateBody, getPathParam } from '../../middleware/validation.js';
import { checkRateLimit, RATE_LIMITS } from '../../middleware/rateLimit.js';
import { ShareDocumentSchema } from '../../schemas/sharingSchemas.js';
import { getDocument } from '../../services/dynamodb/documentRepository.js';
import { createShare, findExistingShare, updateShare } from '../../services/dynamodb/shareRepository.js';
import { getUserByEmail } from '../../services/cognito/userService.js';
import { incrementStat } from '../../services/dynamodb/statsRepository.js';
import { notifyShareReceived } from '../../services/notifications/notificationService.js';
import { logAuditEvent } from '../../services/audit/auditService.js';
import { successResponse } from '../../utils/response.js';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { generateId } from '../../utils/ids.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const ip = extractIpAddress(event);
    const ua = extractUserAgent(event);
    const documentId = getPathParam(event, 'id');

    await checkRateLimit({
      userId: user.userId,
      action: 'shareDocument',
      ...RATE_LIMITS.shareDocument,
    });

    const body = validateBody(event, ShareDocumentSchema);
    const { recipientEmail, permission, expiresAt } = body;

    // Prevent self-sharing
    if (recipientEmail.toLowerCase() === user.email.toLowerCase()) {
      throw new ValidationError('You cannot share a document with yourself.');
    }

    // Get document and verify ownership
    const document = await getDocument(documentId);
    if (document.deletedAt) throw new NotFoundError('Document');
    requireDocumentOwner(document, user.userId);

    // Verify recipient exists in Cognito
    const recipient = await getUserByEmail(recipientEmail);
    if (!recipient) {
      throw new NotFoundError(
        `No user found with email "${recipientEmail}". Only registered users can receive shares.`
      );
    }

    // Check for existing active share
    const existing = await findExistingShare(documentId, recipient.userId);
    if (existing) {
      // Update permission on existing share instead of creating duplicate
      await updateShare(existing.shareId, { permission, status: 'ACTIVE' });
      logAuditEvent({
        userId: user.userId,
        action: 'PERMISSION_CHANGED',
        resourceType: 'SHARE',
        resourceId: existing.shareId,
        status: 'SUCCESS',
        ipAddress: ip,
        userAgent: ua,
        metadata: { permission, recipientEmail, documentId },
      });
      return successResponse({ shareId: existing.shareId, updated: true });
    }

    // Create new share
    const now = new Date().toISOString();
    const share = await createShare({
      shareId: generateId('share'),
      documentId,
      ownerId: user.userId,
      sharedWithUserId: recipient.userId,
      sharedWithEmail: recipientEmail,
      permission,
      status: 'ACTIVE',
      expiresAt: expiresAt
        ? new Date(expiresAt * 1000).toISOString()
        : undefined,
      createdAt: now,
      updatedAt: now,
    });

    incrementStat('totalShares', 1);

    notifyShareReceived(
      recipient.userId,
      user.email,
      document.filename,
      permission,
      documentId
    );

    logAuditEvent({
      userId: user.userId,
      action: 'SHARE',
      resourceType: 'DOCUMENT',
      resourceId: documentId,
      status: 'SUCCESS',
      ipAddress: ip,
      userAgent: ua,
      metadata: { shareId: share.shareId, permission, documentId },
    });

    return successResponse(share, 201);
  }
);
