/**
 * pagination.ts
 * DynamoDB cursor-based pagination helpers.
 * Uses Base64-encoded LastEvaluatedKey as the cursor token.
 */
import { z } from 'zod';
import { ValidationError } from './errors.js';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const PaginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : DEFAULT_PAGE_SIZE))
    .pipe(
      z.number().int().min(1).max(MAX_PAGE_SIZE)
    ),
  cursor: z.string().optional(),
});

export type PaginationParams = z.infer<typeof PaginationSchema>;

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  count: number;
}

/**
 * Encode a DynamoDB LastEvaluatedKey into a URL-safe cursor token.
 */
export function encodeCursor(
  lastEvaluatedKey: Record<string, unknown>
): string {
  return Buffer.from(JSON.stringify(lastEvaluatedKey), 'utf-8').toString(
    'base64url'
  );
}

/**
 * Decode a cursor token back into a DynamoDB ExclusiveStartKey.
 */
export function decodeCursor(
  cursor: string
): Record<string, unknown> {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new ValidationError('Invalid pagination cursor.');
  }
}

/**
 * Build a paginated result from DynamoDB query output.
 */
export function buildPaginatedResult<T>(
  items: T[],
  lastEvaluatedKey?: Record<string, unknown>
): PaginatedResult<T> {
  return {
    items,
    count: items.length,
    nextCursor: lastEvaluatedKey
      ? encodeCursor(lastEvaluatedKey)
      : undefined,
  };
}

/**
 * Parse pagination query parameters from Lambda event.
 */
export function parsePaginationParams(
  queryParams: Record<string, string | undefined> | null | undefined
): PaginationParams {
  const raw = {
    limit: queryParams?.['limit'],
    cursor: queryParams?.['cursor'],
  };
  const result = PaginationSchema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError('Invalid pagination parameters.');
  }
  return result.data;
}
