/**
 * favoriteDocument.ts — POST /documents/{id}/favorite  (toggle)
 * Authorization: owner only
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser } from '../../middleware/auth.js';
import { requireDocumentOwner } from '../../middleware/authorization.js';
import { getPathParam } from '../../middleware/validation.js';
import { getDocument, updateDocument } from '../../services/dynamodb/documentRepository.js';
import { logAuditEvent } from '../../services/audit/auditService.js';
import { successResponse } from '../../utils/response.js';
import { NotFoundError } from '../../utils/errors.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const documentId = getPathParam(event, 'id');

    const document = await getDocument(documentId);
    if (document.deletedAt) throw new NotFoundError('Document');

    requireDocumentOwner(document, user.userId);

    const newFavoriteState = !document.isFavorite;
    await updateDocument(documentId, { isFavorite: newFavoriteState });

    logAuditEvent({
      userId: user.userId,
      action: 'FAVORITE_TOGGLED',
      resourceType: 'DOCUMENT',
      resourceId: documentId,
      status: 'SUCCESS',
      metadata: { isFavorite: newFavoriteState },
    });

    return successResponse({ documentId, isFavorite: newFavoriteState });
  }
);
