/**
 * textractService.ts — Amazon Textract text extraction service
 *
 * Strategy:
 * - Images (PNG, JPG): Synchronous DetectDocumentText
 * - PDFs: Asynchronous StartDocumentTextDetection → poll / SNS notification
 *
 * Extracted text is stored in S3 (not DynamoDB) when > threshold size.
 */
import {
  TextractClient,
  DetectDocumentTextCommand,
  StartDocumentTextDetectionCommand,
  GetDocumentTextDetectionCommand,
  type Block,
} from '@aws-sdk/client-textract';
import { config } from '../../config/environment.js';
import { AIProcessingError } from '../../utils/errors.js';
import {
  putTextObject,
  getTextObject,
} from '../s3/presignedUrlService.js';

const textractClient = new TextractClient({ region: config.region });

const MAX_INLINE_TEXT_CHARS = 50_000; // Store in S3 if larger
const MAX_POLLING_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 5_000;

// ─── Text extraction from Textract blocks ────────────────────────────────────

function extractTextFromBlocks(blocks: Block[]): string {
  return blocks
    .filter((b) => b.BlockType === 'LINE' && b.Text)
    .map((b) => b.Text!)
    .join('\n')
    .trim();
}

// ─── Synchronous (images) ─────────────────────────────────────────────────────

export async function extractTextSync(s3Key: string): Promise<string> {
  const result = await textractClient.send(
    new DetectDocumentTextCommand({
      Document: {
        S3Object: {
          Bucket: config.documentsBucket,
          Name: s3Key,
        },
      },
    })
  );

  return extractTextFromBlocks(result.Blocks ?? []);
}

// ─── Asynchronous (PDF) ───────────────────────────────────────────────────────

export async function startTextExtractionAsync(
  s3Key: string
): Promise<string> {
  const startResult = await textractClient.send(
    new StartDocumentTextDetectionCommand({
      DocumentLocation: {
        S3Object: {
          Bucket: config.documentsBucket,
          Name: s3Key,
        },
      },
    })
  );

  const jobId = startResult.JobId;
  if (!jobId) {
    throw new AIProcessingError('Failed to start Textract job.');
  }

  return jobId;
}

export async function pollTextExtractionResult(jobId: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_POLLING_ATTEMPTS; attempt++) {
    const result = await textractClient.send(
      new GetDocumentTextDetectionCommand({ JobId: jobId })
    );

    const status = result.JobStatus;

    if (status === 'SUCCEEDED') {
      const allBlocks: Block[] = result.Blocks ?? [];

      // Handle pagination of Textract results
      let nextToken = result.NextToken;
      while (nextToken) {
        const nextPage = await textractClient.send(
          new GetDocumentTextDetectionCommand({ JobId: jobId, NextToken: nextToken })
        );
        allBlocks.push(...(nextPage.Blocks ?? []));
        nextToken = nextPage.NextToken;
      }

      return extractTextFromBlocks(allBlocks);
    }

    if (status === 'FAILED') {
      throw new AIProcessingError(
        'Textract text extraction failed. The document may be unsupported or corrupt.'
      );
    }

    // SUBMITTED or IN_PROGRESS → keep polling
    await sleep(POLL_INTERVAL_MS);
  }

  throw new AIProcessingError(
    'Textract job timed out. The document may be too large.'
  );
}

// ─── Store and retrieve extracted text ───────────────────────────────────────

/**
 * Store extracted text, choosing S3 vs inline based on size.
 * Returns the S3 key if stored externally, or null if inline.
 */
export async function storeExtractedText(
  documentId: string,
  text: string
): Promise<string> {
  const s3Key = `extracted-text/${documentId}.txt`;
  await putTextObject(s3Key, text);
  return s3Key;
}

export async function fetchExtractedText(s3Key: string): Promise<string> {
  return getTextObject(s3Key);
}

/**
 * Truncate extracted text for use in AI prompts.
 * Prevents oversized prompts and limits token usage.
 */
export function truncateForPrompt(text: string, maxChars: number = 8_000): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars) + '\n[... content truncated for processing ...]';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
