/**
 * bedrockService.ts — Amazon Bedrock AI analysis service
 *
 * SECURITY RULES:
 * - Never send another user's document to Bedrock
 * - Validate document ownership before calling this service
 * - Limit prompt size (extracted text truncated to 8,000 chars)
 * - Sanitize extracted text before inserting into prompt
 * - Never log document contents
 * - Never place secrets or credentials in prompts
 * - Validate all Bedrock output with Zod before storing
 * - If output is invalid → processingStatus = FAILED (never store malformed data)
 * - All AI output is clearly marked as AI-generated
 */
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { z } from 'zod';
import { config } from '../../config/environment.js';
import { AIProcessingError } from '../../utils/errors.js';
import type { AIAnalysisEntity, DocumentCategory } from '../../models/aiAnalysis.js';
import { truncateForPrompt } from '../textract/textractService.js';

const bedrockClient = new BedrockRuntimeClient({
  region: config.bedrockRegion,
});

// ─── Zod schema for Bedrock output validation ─────────────────────────────────

const VALID_CATEGORIES = [
  'Academic',
  'Financial',
  'Legal',
  'Personal',
  'Business',
  'Technical',
  'Other',
] as const;

const BedrockOutputSchema = z.object({
  shortSummary: z.string().min(1).max(500),
  detailedSummary: z.string().min(1).max(3000),
  category: z.enum(VALID_CATEGORIES),
  keywords: z.array(z.string().max(50)).min(0).max(20),
  entities: z.object({
    people: z.array(z.string().max(100)).max(20),
    organizations: z.array(z.string().max(100)).max(20),
    locations: z.array(z.string().max(100)).max(20),
    dates: z.array(z.string().max(50)).max(20),
    amounts: z.array(z.string().max(50)).max(20),
  }),
});

type BedrockOutput = z.infer<typeof BedrockOutputSchema>;

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildAnalysisPrompt(extractedText: string, filename: string): string {
  // Sanitize: remove potential prompt injection patterns
  const sanitizedText = extractedText
    .replace(/```/g, "'''")           // Prevent code block injection
    .replace(/<\/?[a-z]+>/gi, ' ')   // Strip HTML tags
    .trim();

  const truncated = truncateForPrompt(sanitizedText, 8_000);

  return `You are a document analysis assistant. Analyze the following document content and provide a structured JSON response.

Document filename: ${filename}

Document content:
---
${truncated}
---

Respond ONLY with a valid JSON object in this exact format. Do not include any text before or after the JSON:
{
  "shortSummary": "<A concise 1-2 sentence summary of the document>",
  "detailedSummary": "<A detailed 3-5 paragraph summary covering key points>",
  "category": "<ONE of: Academic, Financial, Legal, Personal, Business, Technical, Other>",
  "keywords": ["<keyword1>", "<keyword2>", "..."],
  "entities": {
    "people": ["<person name>", "..."],
    "organizations": ["<org name>", "..."],
    "locations": ["<location>", "..."],
    "dates": ["<date>", "..."],
    "amounts": ["<monetary or numeric amount>", "..."]
  }
}

Rules:
- Use only information explicitly present in the document
- Do NOT invent, guess, or assume information not present
- If a field has no relevant data, use an empty array [] or a brief note
- Return ONLY valid JSON, nothing else`;
}

// ─── Bedrock invocation ───────────────────────────────────────────────────────

export async function analyzeDocument(
  extractedText: string,
  filename: string,
  documentId: string
): Promise<BedrockOutput> {
  if (!extractedText || extractedText.trim().length < 10) {
    throw new AIProcessingError(
      'Insufficient text content for AI analysis.'
    );
  }

  const prompt = buildAnalysisPrompt(extractedText, filename);

  // Claude Messages API format
  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2048,
    temperature: 0.1, // Low temperature for structured, consistent output
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  let rawResponse: string;

  try {
    const response = await bedrockClient.send(
      new InvokeModelCommand({
        modelId: config.bedrockModelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      })
    );

    rawResponse = new TextDecoder().decode(response.body);
  } catch (err) {
    // Log error without document contents
    console.error(
      JSON.stringify({
        level: 'ERROR',
        message: 'Bedrock invocation failed',
        documentId,
        modelId: config.bedrockModelId,
        errorType: err instanceof Error ? err.constructor.name : 'Unknown',
      })
    );
    throw new AIProcessingError(
      'AI analysis service is temporarily unavailable.'
    );
  }

  // Parse Bedrock response wrapper
  let bedrockResult: { content?: Array<{ text?: string }> };
  try {
    bedrockResult = JSON.parse(rawResponse) as typeof bedrockResult;
  } catch {
    throw new AIProcessingError('AI service returned an unparseable response.');
  }

  const textContent = bedrockResult.content?.[0]?.text;
  if (!textContent) {
    throw new AIProcessingError('AI service returned an empty response.');
  }

  // Extract JSON from response (model may wrap with text despite instructions)
  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new AIProcessingError(
      'AI service did not return structured JSON output.'
    );
  }

  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(jsonMatch[0]);
  } catch {
    throw new AIProcessingError('AI service returned malformed JSON.');
  }

  // Validate with Zod — if invalid, we FAIL, not store bad data
  const validation = BedrockOutputSchema.safeParse(parsedOutput);
  if (!validation.success) {
    console.warn(
      JSON.stringify({
        level: 'WARN',
        message: 'Bedrock output failed Zod validation',
        documentId,
        zodErrors: validation.error.errors.map((e) => e.message),
      })
    );
    throw new AIProcessingError(
      'AI analysis output did not meet the required format.'
    );
  }

  return validation.data;
}
