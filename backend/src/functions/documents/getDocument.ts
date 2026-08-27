/**
 * getDocument.ts — GET /documents/{id}
 *
 * Authorization: owner OR active share (any permission level)
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser, extractIpAddress, extractUserAgent } from '../../middleware/auth.js';
import { requireDocumentAccess } from '../../middleware/authorization.js';
import { getPathParam } from '../../middleware/validation.js';
import { getDocument } from '../../services/dynamodb/documentRepository.js';
import { getActiveShare } from '../../services/dynamodb/shareRepository.js';
import { getAnalysisByDocument } from '../../services/dynamodb/aiAnalysisRepository.js';
import { logAuditEvent } from '../../services/audit/auditService.js';
import { successResponse } from '../../utils/response.js';
import { NotFoundError } from '../../utils/errors.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const ip = extractIpAddress(event);
    const ua = extractUserAgent(event);
    const documentId = getPathParam(event, 'id');

    // Retrieve document
    const document = await getDocument(documentId);

    // Deleted documents not accessible via this endpoint
    if (document.deletedAt) {
      throw new NotFoundError('Document');
    }

    // Authorization: owner OR active share (VIEW+)
    const activeShare = document.ownerId !== user.userId
      ? await getActiveShare(documentId, user.userId)
      : null;

    requireDocumentAccess(document, user.userId, activeShare, 'VIEW');

    // Fetch AI analysis if available
    const analysis = await getAnalysisByDocument(documentId);

    // Omit internal s3Key from response
    const { s3Key: _s3Key, ...safeDocument } = document;

    logAuditEvent({
      userId: user.userId,
      action: 'VIEW',
      resourceType: 'DOCUMENT',
      resourceId: documentId,
      status: 'SUCCESS',
      ipAddress: ip,
      userAgent: ua,
    });

    return successResponse({
      document: safeDocument,
      analysis: analysis ?? null,
    });
  }
);
