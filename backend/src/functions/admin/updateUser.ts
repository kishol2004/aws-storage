/** updateUser.ts — PATCH /admin/users/{id}  (ADMIN only) */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser, extractIpAddress, extractUserAgent } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/authorization.js';
import { validateBody, getPathParam } from '../../middleware/validation.js';
import { AdminUpdateUserSchema } from '../../schemas/userSchemas.js';
import { setUserStatus } from '../../services/cognito/userService.js';
import { logAuditEvent } from '../../services/audit/auditService.js';
import { successResponse } from '../../utils/response.js';
import { ValidationError } from '../../utils/errors.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const ip = extractIpAddress(event);
    const ua = extractUserAgent(event);
    requireAdmin(user);

    const targetUserId = getPathParam(event, 'id');
    const body = validateBody(event, AdminUpdateUserSchema);

    // Prevent admins from disabling themselves
    if (targetUserId === user.userId && body.status === 'DISABLED') {
      throw new ValidationError('You cannot disable your own account.');
    }

    await setUserStatus(targetUserId, body.status);

    logAuditEvent({
      userId: user.userId,
      action: 'ADMIN_ACTION',
      resourceType: 'USER',
      resourceId: targetUserId,
      status: 'SUCCESS',
      ipAddress: ip,
      userAgent: ua,
      metadata: { action: `SET_STATUS_${body.status}`, targetUserId },
    });

    return successResponse({ userId: targetUserId, status: body.status });
  }
);
