/** getUsers.ts — GET /admin/users  (ADMIN only) */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/authorization.js';
import { validateQueryParams } from '../../middleware/validation.js';
import { AdminListUsersQuerySchema } from '../../schemas/userSchemas.js';
import { listAllUsers } from '../../services/cognito/userService.js';
import { successResponse } from '../../utils/response.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    requireAdmin(user); // Role verified from Cognito groups, NOT request body

    const query = validateQueryParams(event, AdminListUsersQuerySchema);
    const result = await listAllUsers({
      limit: query.limit,
      paginationToken: query.paginationToken,
    });

    return successResponse(result);
  }
);
