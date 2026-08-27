/** getAnalysis.ts — GET /documents/{id}/ai-analysis */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser } from '../../middleware/auth.js';
import { requireDocumentAccess } from '../../middleware/authorization.js';
import { getPathParam } from '../../middleware/validation.js';
import { getDocument } from '../../services/dynamodb/documentRepository.js';
import { getActiveShare } from '../../services/dynamodb/shareRepository.js';
import { getAnalysisByDocument } from '../../services/dynamodb/aiAnalysisRepository.js';
import { successResponse } from '../../utils/response.js';
import { NotFoundError } from '../../utils/errors.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const documentId = getPathParam(event, 'id');

    const document = await getDocument(documentId);
    if (document.deletedAt) throw new NotFoundError('Document');

    const activeShare = document.ownerId !== user.userId
      ? await getActiveShare(documentId, user.userId)
      : null;

    requireDocumentAccess(document, user.userId, activeShare, 'VIEW');

    const analysis = await getAnalysisByDocument(documentId);

    if (!analysis) {
      return successResponse({
        analysis: null,
        processingStatus: document.processingStatus,
        message:
          document.processingStatus === 'COMPLETED'
            ? 'No AI analysis available for this document.'
            : `AI analysis is ${document.processingStatus?.toLowerCase() ?? 'pending'}.`,
      });
    }

    return successResponse({ analysis });
  }
);
