/**
 * updateDocument.ts — PATCH /documents/{id}
 * Authorization: owner OR EDIT share
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser, extractIpAddress, extractUserAgent } from '../../middleware/auth.js';
import { requireDocumentAccess } from '../../middleware/authorization.js';
import { validateBody, getPathParam } from '../../middleware/validation.js';
import { UpdateDocumentSchema } from '../../schemas/documentSchemas.js';
import { getDocument, updateDocument } from '../../services/dynamodb/documentRepository.js';
import { getActiveShare } from '../../services/dynamodb/shareRepository.js';
import { logAuditEvent } from '../../services/audit/auditService.js';
import { successResponse } from '../../utils/response.js';
import { NotFoundError } from '../../utils/errors.js';
import { sanitizeFilename } from '../../utils/ids.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const ip = extractIpAddress(event);
    const ua = extractUserAgent(event);
    const documentId = getPathParam(event, 'id');
    const body = validateBody(event, UpdateDocumentSchema);

    const document = await getDocument(documentId);
    if (document.deletedAt) throw new NotFoundError('Document');

    const activeShare = document.ownerId !== user.userId
      ? await getActiveShare(documentId, user.userId)
      : null;

    requireDocumentAccess(document, user.userId, activeShare, 'EDIT');

    const updates: Record<string, unknown> = {};
    let action: 'RENAME' | 'MOVE' = 'RENAME';

    if (body.filename) {
      updates['filename'] = sanitizeFilename(body.filename);
    }
    if (body.folderId !== undefined) {
      updates['folderId'] = body.folderId;
      action = 'MOVE';
    }
    if (body.tags !== undefined) updates['tags'] = body.tags;
    if (body.category !== undefined) updates['category'] = body.category;

    const updated = await updateDocument(documentId, updates);
    const { s3Key: _s3Key, ...safeDoc } = updated;

    logAuditEvent({
      userId: user.userId,
      action,
      resourceType: 'DOCUMENT',
      resourceId: documentId,
      status: 'SUCCESS',
      ipAddress: ip,
      userAgent: ua,
      metadata: { documentId },
    });

    return successResponse(safeDoc);
  }
);
