/** updateShare.ts — PATCH /shares/{id} */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser, extractIpAddress, extractUserAgent } from '../../middleware/auth.js';
import { requireShareOwner } from '../../middleware/authorization.js';
import { validateBody, getPathParam } from '../../middleware/validation.js';
import { UpdateShareSchema } from '../../schemas/sharingSchemas.js';
import { getShare, updateShare } from '../../services/dynamodb/shareRepository.js';
import { logAuditEvent } from '../../services/audit/auditService.js';
import { successResponse } from '../../utils/response.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const ip = extractIpAddress(event);
    const ua = extractUserAgent(event);
    const shareId = getPathParam(event, 'id');
    const body = validateBody(event, UpdateShareSchema);

    const share = await getShare(shareId);
    requireShareOwner(share, user.userId);

    const updated = await updateShare(shareId, {
      permission: body.permission,
      status: 'ACTIVE',
    });

    logAuditEvent({
      userId: user.userId,
      action: 'PERMISSION_CHANGED',
      resourceType: 'SHARE',
      resourceId: shareId,
      status: 'SUCCESS',
      ipAddress: ip,
      userAgent: ua,
      metadata: { permission: body.permission, documentId: share.documentId },
    });

    return successResponse(updated);
  }
);
