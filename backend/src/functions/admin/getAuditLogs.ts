/** getAuditLogs.ts — GET /admin/audit-logs  (ADMIN only) */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/authorization.js';
import { validateQueryParams } from '../../middleware/validation.js';
import { z } from 'zod';
import { listAllAuditEvents } from '../../services/dynamodb/auditRepository.js';
import { successResponse } from '../../utils/response.js';

const QuerySchema = z.object({
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 50)).pipe(z.number().min(1).max(100)),
  cursor: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  date: z.string().optional(),
});

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    requireAdmin(user);

    const query = validateQueryParams(event, QuerySchema);
    const result = await listAllAuditEvents({
      limit: query.limit,
      cursor: query.cursor,
      from: query.from ?? query.date,
      to: query.to,
    });

    return successResponse(result);
  }
);
