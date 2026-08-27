/**
 * deleteDocument.ts — DELETE /documents/{id}  (soft delete)
 * Authorization: owner only
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser, extractIpAddress, extractUserAgent } from '../../middleware/auth.js';
import { requireDocumentOwner } from '../../middleware/authorization.js';
import { getPathParam } from '../../middleware/validation.js';
import { getDocument, updateDocument } from '../../services/dynamodb/documentRepository.js';
import { logAuditEvent } from '../../services/audit/auditService.js';
import { noContentResponse } from '../../utils/response.js';
import { NotFoundError } from '../../utils/errors.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const ip = extractIpAddress(event);
    const ua = extractUserAgent(event);
    const documentId = getPathParam(event, 'id');

    const document = await getDocument(documentId);
    if (document.deletedAt) throw new NotFoundError('Document');

    requireDocumentOwner(document, user.userId);

    // Soft delete: set deletedAt timestamp
    await updateDocument(documentId, {
      deletedAt: new Date().toISOString(),
    });

    logAuditEvent({
      userId: user.userId,
      action: 'DELETE',
      resourceType: 'DOCUMENT',
      resourceId: documentId,
      status: 'SUCCESS',
      ipAddress: ip,
      userAgent: ua,
    });

    return noContentResponse();
  }
);
