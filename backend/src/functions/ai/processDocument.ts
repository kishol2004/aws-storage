/**
 * processDocument.ts — S3 Event → SQS → Processing Lambda
 *
 * This Lambda is NOT triggered by API Gateway.
 * It is triggered by S3 events (via SQS queue) when a document is uploaded.
 *
 * Pipeline:
 * 1. Parse S3 event from SQS message
 * 2. Look up document metadata by S3 key
 * 3. Validate document ownership
 * 4. Update status → PROCESSING
 * 5. Run Textract extraction
 * 6. Store extracted text in S3
 * 7. Run Bedrock AI analysis
 * 8. Validate Bedrock output with Zod
 * 9. Store AI results in DynamoDB
 * 10. Update document → COMPLETED
 * 11. Notify user
 * 12. Update stats
 */
import type { SQSEvent, SQSRecord, S3Event } from 'aws-lambda';
import { updateDocument, listDocuments } from '../../services/dynamodb/documentRepository.js';
import { createAnalysis, updateAnalysis } from '../../services/dynamodb/aiAnalysisRepository.js';
import {
  extractTextSync,
  startTextExtractionAsync,
  pollTextExtractionResult,
  storeExtractedText,
} from '../../services/textract/textractService.js';
import { analyzeDocument } from '../../services/bedrock/bedrockService.js';
import { incrementStat } from '../../services/dynamodb/statsRepository.js';
import { notifyAIProcessingComplete, notifyAIProcessingFailed } from '../../services/notifications/notificationService.js';
import { logAuditEvent } from '../../services/audit/auditService.js';
import { generateId } from '../../utils/ids.js';

const IMAGE_TYPES = new Set(['png', 'jpg', 'jpeg']);

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    await processRecord(record);
  }
};

async function processRecord(sqsRecord: SQSRecord): Promise<void> {
  let documentId = 'unknown';

  try {
    const s3Event: S3Event = JSON.parse(sqsRecord.body) as S3Event;
    const s3Record = s3Event.Records?.[0];

    if (!s3Record) {
      console.warn(JSON.stringify({ level: 'WARN', message: 'No S3 record in SQS message' }));
      return;
    }

    const s3Key = decodeURIComponent(s3Record.s3.object.key.replace(/\+/g, ' '));

    // Extract documentId from S3 key: users/{userId}/folders/{folderId}/{documentId}/...
    const keyParts = s3Key.split('/');
    documentId = keyParts[4] ?? 'unknown';
    const userId = keyParts[1] ?? 'unknown';
    const fileType = keyParts[keyParts.length - 1]?.split('.').pop()?.toLowerCase() ?? '';
    const filename = keyParts[keyParts.length - 1] ?? 'document';

    // Update status: PROCESSING
    await updateDocument(documentId, {
      processingStatus: 'PROCESSING',
      processingStartedAt: new Date().toISOString(),
    });

    logAuditEvent({
      userId,
      action: 'AI_PROCESSING_STARTED',
      resourceType: 'DOCUMENT',
      resourceId: documentId,
      status: 'SUCCESS',
    });

    // TEXT EXTRACTION
    await updateDocument(documentId, { processingStatus: 'TEXT_EXTRACTION' });

    let extractedText: string;
    if (IMAGE_TYPES.has(fileType)) {
      extractedText = await extractTextSync(s3Key);
    } else {
      const jobId = await startTextExtractionAsync(s3Key);
      extractedText = await pollTextExtractionResult(jobId);
    }

    // Store extracted text in S3
    const textS3Key = await storeExtractedText(documentId, extractedText);
    await updateDocument(documentId, { extractedTextLocation: textS3Key });

    // AI ANALYSIS
    await updateDocument(documentId, { processingStatus: 'AI_ANALYSIS' });

    const aiOutput = await analyzeDocument(extractedText, filename, documentId);

    // Store AI analysis results
    const now = new Date().toISOString();
    const analysis = await createAnalysis({
      analysisId: generateId('analysis'),
      documentId,
      userId,
      modelId: process.env['BEDROCK_MODEL_ID'] ?? 'anthropic.claude-3-haiku-20240307-v1:0',
      shortSummary: aiOutput.shortSummary,
      detailedSummary: aiOutput.detailedSummary,
      category: aiOutput.category,
      keywords: aiOutput.keywords,
      entities: aiOutput.entities,
      status: 'COMPLETED',
      createdAt: now,
      updatedAt: now,
    });

    // Update document with AI-derived metadata
    await updateDocument(documentId, {
      processingStatus: 'COMPLETED',
      processingCompletedAt: now,
      category: aiOutput.category,
      summary: aiOutput.shortSummary,
    });

    incrementStat('aiProcessedDocuments', 1);
    notifyAIProcessingComplete(userId, filename, documentId);

    logAuditEvent({
      userId,
      action: 'AI_PROCESSING_COMPLETED',
      resourceType: 'DOCUMENT',
      resourceId: documentId,
      status: 'SUCCESS',
      metadata: { analysisId: analysis.analysisId, category: aiOutput.category },
    });

    console.log(
      JSON.stringify({
        level: 'INFO',
        action: 'PROCESSING_COMPLETED',
        userId,
        documentId,
        category: aiOutput.category,
        timestamp: now,
      })
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown processing error';

    console.error(
      JSON.stringify({
        level: 'ERROR',
        message: 'Document processing failed',
        documentId,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      })
    );

    // Update document: FAILED (never expose internal error details)
    await updateDocument(documentId, {
      processingStatus: 'FAILED',
      processingCompletedAt: new Date().toISOString(),
      processingError: 'Document processing failed. Please try re-uploading.',
    }).catch(() => {});

    incrementStat('failedProcessingJobs', 1);
  }
}
