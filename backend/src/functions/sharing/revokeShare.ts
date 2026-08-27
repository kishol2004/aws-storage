/** revokeShare.ts — DELETE /shares/{id} */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser, extractIpAddress, extractUserAgent } from '../../middleware/auth.js';
import { requireShareOwner } from '../../middleware/authorization.js';
import { getPathParam } from '../../middleware/validation.js';
import { getShare, revokeShare } from '../../services/dynamodb/shareRepository.js';
import { getDocumentOrNull } from '../../services/dynamodb/documentRepository.js';
import { notifyShareRevoked } from '../../services/notifications/notificationService.js';
import { logAuditEvent } from '../../services/audit/auditService.js';
import { noContentResponse } from '../../utils/response.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const ip = extractIpAddress(event);
    const ua = extractUserAgent(event);
    const shareId = getPathParam(event, 'id');

    const share = await getShare(shareId);
    requireShareOwner(share, user.userId);

    await revokeShare(shareId);

    // Notify recipient their access has been revoked
    const document = await getDocumentOrNull(share.documentId);
    if (document) {
      notifyShareRevoked(
        share.sharedWithUserId,
        document.filename,
        share.documentId
      );
    }

    logAuditEvent({
      userId: user.userId,
      action: 'SHARE_REVOKED',
      resourceType: 'SHARE',
      resourceId: shareId,
      status: 'SUCCESS',
      ipAddress: ip,
      userAgent: ua,
      metadata: { documentId: share.documentId },
    });

    return noContentResponse();
  }
);
