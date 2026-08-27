/**
 * document.ts — Document domain model
 */

export type ProcessingStatus =
  | 'UPLOADING'
  | 'PROCESSING'
  | 'TEXT_EXTRACTION'
  | 'AI_ANALYSIS'
  | 'COMPLETED'
  | 'FAILED';

export type DocumentStatus = 'ACTIVE' | 'DELETED';

export interface DocumentEntity {
  // Primary key
  documentId: string;

  // Ownership — always from Cognito, never from request body
  ownerId: string;

  // Organisation
  folderId: string;
  filename: string;
  originalFilename: string;

  // Storage
  s3Key: string;
  fileType: string;      // Extension e.g. pdf, docx
  mimeType: string;
  fileSize: number;      // Bytes

  // Lifecycle
  status: DocumentStatus;
  createdAt: string;     // ISO 8601
  updatedAt: string;
  deletedAt?: string;    // Set on soft delete; absent on active documents
  isFavorite: boolean;
  version: number;

  // AI-populated metadata (clearly labelled AI-generated)
  category?: string;
  tags?: string[];
  summary?: string;      // AI-generated short summary

  // Processing pipeline
  processingStatus: ProcessingStatus;
  processingStartedAt?: string;
  processingCompletedAt?: string;
  processingError?: string;  // Safe error message only, no internals

  // Textract output location (S3 key, not DynamoDB storage)
  extractedTextLocation?: string;
}

/** Public-facing document (omits internal S3 key from responses) */
export type DocumentResponse = Omit<DocumentEntity, 's3Key'>;
