/**
 * listDocuments.ts — GET /documents
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser } from '../../middleware/auth.js';
import { validateQueryParams } from '../../middleware/validation.js';
import { ListDocumentsQuerySchema } from '../../schemas/documentSchemas.js';
import { listDocuments } from '../../services/dynamodb/documentRepository.js';
import { successResponse } from '../../utils/response.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const query = validateQueryParams(event, ListDocumentsQuerySchema);

    const result = await listDocuments(user.userId, {
      limit: query.limit,
      cursor: query.cursor,
      folderId: query.folderId,
      fileType: query.fileType,
      isFavorite: query.isFavorite || undefined,
      deleted: query.deleted,
    });

    return successResponse(result);
  }
);
