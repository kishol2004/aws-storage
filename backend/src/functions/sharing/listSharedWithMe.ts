/** listSharedWithMe.ts — GET /shared-with-me */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser } from '../../middleware/auth.js';
import { validateQueryParams } from '../../middleware/validation.js';
import { z } from 'zod';
import { listSharesByRecipient } from '../../services/dynamodb/shareRepository.js';
import { getDocumentOrNull } from '../../services/dynamodb/documentRepository.js';
import { successResponse } from '../../utils/response.js';

const QuerySchema = z.object({
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 20)).pipe(z.number().min(1).max(100)),
  cursor: z.string().optional(),
});

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const { limit, cursor } = validateQueryParams(event, QuerySchema);

    const sharesResult = await listSharesByRecipient(user.userId, { limit, cursor });

    // Enrich with document metadata (exclude s3Key)
    const items = await Promise.all(
      sharesResult.items.map(async (share) => {
        const doc = await getDocumentOrNull(share.documentId);
        if (!doc || doc.deletedAt) return null;
        const { s3Key: _s3Key, ...safeDoc } = doc;
        return { share, document: safeDoc };
      })
    );

    const filteredItems = items.filter(Boolean);

    return successResponse({
      items: filteredItems,
      count: filteredItems.length,
      nextCursor: sharesResult.nextCursor,
    });
  }
);
