/**
 * deleteFolder.ts — DELETE /folders/{id}
 * Documents inside are moved to root ('root') rather than orphaned.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser, extractIpAddress, extractUserAgent } from '../../middleware/auth.js';
import { getPathParam } from '../../middleware/validation.js';
import { validateFolderOwnership, deleteFolder } from '../../services/dynamodb/folderRepository.js';
import { listDocuments, updateDocument } from '../../services/dynamodb/documentRepository.js';
import { logAuditEvent } from '../../services/audit/auditService.js';
import { noContentResponse } from '../../utils/response.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const ip = extractIpAddress(event);
    const ua = extractUserAgent(event);
    const folderId = getPathParam(event, 'id');

    await validateFolderOwnership(folderId, user.userId);

    // Move all documents in this folder to root (prevents orphaning)
    const docsResult = await listDocuments(user.userId, { folderId, limit: 1000 });
    await Promise.all(
      docsResult.items.map((doc) =>
        updateDocument(doc.documentId, { folderId: 'root' })
      )
    );

    // Delete the folder
    await deleteFolder(folderId);

    logAuditEvent({
      userId: user.userId,
      action: 'FOLDER_DELETE',
      resourceType: 'FOLDER',
      resourceId: folderId,
      status: 'SUCCESS',
      ipAddress: ip,
      userAgent: ua,
      metadata: { documentsRelocated: docsResult.items.length },
    });

    return noContentResponse();
  }
);
