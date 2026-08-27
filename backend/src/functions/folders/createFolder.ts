/** createFolder.ts — POST /folders */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser, extractIpAddress, extractUserAgent } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validation.js';
import { CreateFolderSchema } from '../../schemas/folderSchemas.js';
import { createFolder } from '../../services/dynamodb/folderRepository.js';
import { logAuditEvent } from '../../services/audit/auditService.js';
import { createdResponse } from '../../utils/response.js';
import { generateId } from '../../utils/ids.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const ip = extractIpAddress(event);
    const ua = extractUserAgent(event);
    const body = validateBody(event, CreateFolderSchema);

    const now = new Date().toISOString();
    const folder = await createFolder({
      folderId: generateId(),
      folderName: body.folderName,
      parentFolderId: body.parentFolderId ?? 'root',
      ownerId: user.userId,
      createdAt: now,
      updatedAt: now,
    });

    logAuditEvent({
      userId: user.userId,
      action: 'FOLDER_CREATE',
      resourceType: 'FOLDER',
      resourceId: folder.folderId,
      status: 'SUCCESS',
      ipAddress: ip,
      userAgent: ua,
      metadata: { folderName: folder.folderName },
    });

    return createdResponse(folder);
  }
);
