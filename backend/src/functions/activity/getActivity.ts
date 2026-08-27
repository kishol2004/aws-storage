/** getActivity.ts — GET /activity */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser } from '../../middleware/auth.js';
import { validateQueryParams } from '../../middleware/validation.js';
import { z } from 'zod';
import { listUserAuditEvents } from '../../services/dynamodb/auditRepository.js';
import { successResponse } from '../../utils/response.js';

const QuerySchema = z.object({
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 30)).pipe(z.number().min(1).max(100)),
  cursor: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const query = validateQueryParams(event, QuerySchema);

    const result = await listUserAuditEvents(user.userId, {
      limit: query.limit,
      cursor: query.cursor,
      from: query.from,
      to: query.to,
    });

    return successResponse(result);
  }
);
