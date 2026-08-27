/**
 * downloadDocument.ts — GET /documents/{id}/download
 *
 * Returns a short-lived presigned S3 GET URL.
 * Authorization: owner OR DOWNLOAD/EDIT share
 * Never returns permanent URLs or AWS credentials.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser, extractIpAddress, extractUserAgent } from '../../middleware/auth.js';
import { requireDocumentAccess } from '../../middleware/authorization.js';
import { getPathParam } from '../../middleware/validation.js';
import { getDocument } from '../../services/dynamodb/documentRepository.js';
import { getActiveShare } from '../../services/dynamodb/shareRepository.js';
import { generateDownloadUrl } from '../../services/s3/presignedUrlService.js';
import { logAuditEvent } from '../../services/audit/auditService.js';
import { successResponse } from '../../utils/response.js';
import { NotFoundError } from '../../utils/errors.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const ip = extractIpAddress(event);
    const ua = extractUserAgent(event);
    const documentId = getPathParam(event, 'id');

    const document = await getDocument(documentId);
    if (document.deletedAt) throw new NotFoundError('Document');

    const activeShare = document.ownerId !== user.userId
      ? await getActiveShare(documentId, user.userId)
      : null;

    // Requires at minimum DOWNLOAD permission
    requireDocumentAccess(document, user.userId, activeShare, 'DOWNLOAD');

    // Generate short-lived presigned GET URL (5 minutes)
    const { downloadUrl, expiresIn } = await generateDownloadUrl(
      document.s3Key,
      document.originalFilename
    );

    logAuditEvent({
      userId: user.userId,
      action: 'DOWNLOAD',
      resourceType: 'DOCUMENT',
      resourceId: documentId,
      status: 'SUCCESS',
      ipAddress: ip,
      userAgent: ua,
      metadata: { documentId, filename: document.filename },
    });

    return successResponse({ downloadUrl, expiresIn, filename: document.originalFilename });
  }
);
