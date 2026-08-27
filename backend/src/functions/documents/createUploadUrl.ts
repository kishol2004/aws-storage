/**
 * createUploadUrl.ts — POST /documents/upload-url
 *
 * Generates a secure S3 presigned PUT URL for direct browser upload.
 * The file never passes through Lambda.
 *
 * Security steps:
 * 1. Authenticate user from Cognito JWT
 * 2. Validate + sanitize all input with Zod
 * 3. Validate file type, MIME type, size
 * 4. Generate UUID document ID
 * 5. Build safe S3 key (path traversal safe)
 * 6. Create DynamoDB record (UPLOADING status)
 * 7. Generate short-lived presigned PUT URL
 * 8. Log audit event
 * 9. Return URL (never returns credentials)
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser, extractIpAddress, extractUserAgent } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validation.js';
import { checkRateLimit, RATE_LIMITS } from '../../middleware/rateLimit.js';
import { CreateUploadUrlSchema } from '../../schemas/documentSchemas.js';
import { validateFileMetadata } from '../../utils/fileValidation.js';
import { generateId, buildS3Key, sanitizeFilename } from '../../utils/ids.js';
import { generateUploadUrl } from '../../services/s3/presignedUrlService.js';
import { createDocument } from '../../services/dynamodb/documentRepository.js';
import { validateFolderOwnership } from '../../services/dynamodb/folderRepository.js';
import { incrementStat } from '../../services/dynamodb/statsRepository.js';
import { logAuditEvent } from '../../services/audit/auditService.js';
import { successResponse } from '../../utils/response.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    // 1. Authenticate
    const user = extractCognitoUser(event);
    const ip = extractIpAddress(event);
    const ua = extractUserAgent(event);

    // 2. Rate limit upload URL generation
    await checkRateLimit({
      userId: user.userId,
      action: 'uploadUrl',
      ...RATE_LIMITS.uploadUrl,
    });

    // 3. Validate input
    const body = validateBody(event, CreateUploadUrlSchema);
    const { filename, mimeType, fileSize, folderId } = body;

    // 4. Validate file metadata
    validateFileMetadata({ filename, mimeType, fileSize, folderId });

    // 5. Validate folder ownership if provided
    const resolvedFolderId = folderId ?? 'root';
    if (folderId && folderId !== 'root') {
      await validateFolderOwnership(folderId, user.userId);
    }

    // 6. Generate document ID and S3 key
    const documentId = generateId();
    const safeFilename = sanitizeFilename(filename);
    const s3Key = buildS3Key(user.userId, resolvedFolderId, documentId, filename);
    const extension = filename.split('.').pop()?.toLowerCase() ?? '';

    // 7. Create DynamoDB metadata record
    const now = new Date().toISOString();
    const document = await createDocument({
      documentId,
      ownerId: user.userId,
      folderId: resolvedFolderId,
      filename: safeFilename,
      originalFilename: filename,
      s3Key,
      fileType: extension,
      mimeType,
      fileSize,
      status: 'ACTIVE',
      processingStatus: 'UPLOADING',
      isFavorite: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    // 8. Generate presigned PUT URL
    const { uploadUrl, expiresIn } = await generateUploadUrl(
      s3Key,
      mimeType,
      fileSize
    );

    // 9. Update stats counter
    incrementStat('totalDocuments', 1);
    incrementStat('totalStorage', fileSize);

    // 10. Audit log
    logAuditEvent({
      userId: user.userId,
      action: 'UPLOAD',
      resourceType: 'DOCUMENT',
      resourceId: documentId,
      status: 'SUCCESS',
      ipAddress: ip,
      userAgent: ua,
      metadata: { documentId, filename: safeFilename, fileSize, fileType: extension },
    });

    console.log(
      JSON.stringify({
        level: 'INFO',
        action: 'UPLOAD_URL_GENERATED',
        userId: user.userId,
        documentId,
        fileType: extension,
        fileSize,
        timestamp: now,
      })
    );

    return successResponse(
      { documentId, uploadUrl, expiresIn },
      201
    );
  }
);
