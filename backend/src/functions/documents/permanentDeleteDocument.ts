/**
 * permanentDeleteDocument.ts — DELETE /documents/{id}/permanent
 * Permanently removes DynamoDB record + S3 object + revokes all shares.
 * Authorization: owner only
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser, extractIpAddress, extractUserAgent } from '../../middleware/auth.js';
import { requireDocumentOwner } from '../../middleware/authorization.js';
import { getPathParam } from '../../middleware/validation.js';
import { getDocument, permanentDeleteDocument } from '../../services/dynamodb/documentRepository.js';
import { listSharesByDocument, revokeShare } from '../../services/dynamodb/shareRepository.js';
import { deleteS3Object } from '../../services/s3/presignedUrlService.js';
import { incrementStat } from '../../services/dynamodb/statsRepository.js';
import { logAuditEvent } from '../../services/audit/auditService.js';
import { noContentResponse } from '../../utils/response.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const ip = extractIpAddress(event);
    const ua = extractUserAgent(event);
    const documentId = getPathParam(event, 'id');

    const document = await getDocument(documentId);
    requireDocumentOwner(document, user.userId);

    // 1. Revoke all active shares (don't orphan share records)
    const shares = await listSharesByDocument(documentId);
    await Promise.all(
      shares
        .filter((s) => s.status === 'ACTIVE')
        .map((s) => revokeShare(s.shareId))
    );

    // 2. Delete from DynamoDB
    await permanentDeleteDocument(documentId);

    // 3. Delete from S3
    await deleteS3Object(document.s3Key);

    // 4. Update stats counters
    incrementStat('totalDocuments', -1);
    incrementStat('totalStorage', -document.fileSize);

    logAuditEvent({
      userId: user.userId,
      action: 'PERMANENT_DELETE',
      resourceType: 'DOCUMENT',
      resourceId: documentId,
      status: 'SUCCESS',
      ipAddress: ip,
      userAgent: ua,
      metadata: { filename: document.filename, fileSize: document.fileSize },
    });

    return noContentResponse();
  }
);
