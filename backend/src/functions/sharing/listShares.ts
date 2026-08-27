/** listShares.ts — GET /documents/{id}/shares  (owner only) */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser } from '../../middleware/auth.js';
import { requireDocumentOwner } from '../../middleware/authorization.js';
import { getPathParam } from '../../middleware/validation.js';
import { getDocument } from '../../services/dynamodb/documentRepository.js';
import { listSharesByDocument } from '../../services/dynamodb/shareRepository.js';
import { successResponse } from '../../utils/response.js';
import { NotFoundError } from '../../utils/errors.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const documentId = getPathParam(event, 'id');

    const document = await getDocument(documentId);
    if (document.deletedAt) throw new NotFoundError('Document');
    requireDocumentOwner(document, user.userId);

    const shares = await listSharesByDocument(documentId);
    return successResponse({ shares, count: shares.length });
  }
);
