/** updateFolder.ts — PATCH /folders/{id} */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser, extractIpAddress, extractUserAgent } from '../../middleware/auth.js';
import { validateBody, getPathParam } from '../../middleware/validation.js';
import { UpdateFolderSchema } from '../../schemas/folderSchemas.js';
import { validateFolderOwnership, updateFolder } from '../../services/dynamodb/folderRepository.js';
import { logAuditEvent } from '../../services/audit/auditService.js';
import { successResponse } from '../../utils/response.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const ip = extractIpAddress(event);
    const ua = extractUserAgent(event);
    const folderId = getPathParam(event, 'id');
    const body = validateBody(event, UpdateFolderSchema);

    await validateFolderOwnership(folderId, user.userId);
    const updated = await updateFolder(folderId, { folderName: body.folderName });

    logAuditEvent({
      userId: user.userId,
      action: 'FOLDER_UPDATE',
      resourceType: 'FOLDER',
      resourceId: folderId,
      status: 'SUCCESS',
      ipAddress: ip,
      userAgent: ua,
    });

    return successResponse(updated);
  }
);
