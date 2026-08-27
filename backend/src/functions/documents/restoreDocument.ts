/**
 * restoreDocument.ts — POST /documents/{id}/restore
 * Authorization: owner only
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser, extractIpAddress, extractUserAgent } from '../../middleware/auth.js';
import { requireDocumentOwner } from '../../middleware/authorization.js';
import { getPathParam } from '../../middleware/validation.js';
import { getDocument, updateDocument } from '../../services/dynamodb/documentRepository.js';
import { logAuditEvent } from '../../services/audit/auditService.js';
import { successResponse } from '../../utils/response.js';
import { ValidationError } from '../../utils/errors.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const ip = extractIpAddress(event);
    const ua = extractUserAgent(event);
    const documentId = getPathParam(event, 'id');

    const document = await getDocument(documentId);

    if (!document.deletedAt) {
      throw new ValidationError('Document is not in the trash.');
    }

    requireDocumentOwner(document, user.userId);

    const updated = await updateDocument(documentId, {
      deletedAt: null as unknown as undefined,
    });

    const { s3Key: _s3Key, ...safeDoc } = updated;

    logAuditEvent({
      userId: user.userId,
      action: 'RESTORE',
      resourceType: 'DOCUMENT',
      resourceId: documentId,
      status: 'SUCCESS',
      ipAddress: ip,
      userAgent: ua,
    });

    return successResponse(safeDoc);
  }
);
