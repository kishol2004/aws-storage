/** searchDocuments.ts — GET /search */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser } from '../../middleware/auth.js';
import { validateQueryParams } from '../../middleware/validation.js';
import { SearchQuerySchema } from '../../schemas/searchSchemas.js';
import { searchUserDocuments } from '../../services/search/searchService.js';
import { successResponse } from '../../utils/response.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const query = validateQueryParams(event, SearchQuerySchema);

    const result = await searchUserDocuments(user.userId, query.q, {
      limit: query.limit,
      cursor: query.cursor,
      fileType: query.fileType,
      category: query.category,
      folderId: query.folderId,
    });

    // Strip internal s3Key from all results
    const safeItems = result.items.map(({ s3Key: _s3Key, ...doc }) => doc);

    return successResponse({
      ...result,
      items: safeItems,
    });
  }
);
