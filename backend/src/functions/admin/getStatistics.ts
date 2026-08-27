/** getStatistics.ts — GET /admin/statistics  (ADMIN only) */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/authorization.js';
import { getSystemStats } from '../../services/dynamodb/statsRepository.js';
import { successResponse } from '../../utils/response.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    requireAdmin(user);

    const stats = await getSystemStats();
    return successResponse(stats);
  }
);
