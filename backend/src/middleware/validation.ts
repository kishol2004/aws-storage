/**
 * validation.ts — Request input validation middleware using Zod
 */
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { z } from 'zod';
import { ValidationError } from '../utils/errors.js';

/**
 * Parse and validate the JSON request body against a Zod schema.
 * Returns strongly-typed validated data.
 * Throws ValidationError with a safe message on failure.
 */
export function validateBody<T extends z.ZodTypeAny>(
  event: APIGatewayProxyEvent,
  schema: T
): z.infer<T> {
  if (!event.body) {
    throw new ValidationError('Request body is required.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(event.body);
  } catch {
    throw new ValidationError('Request body must be valid JSON.');
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const firstError = result.error.errors[0];
    const field = firstError?.path.join('.') ?? 'input';
    const message = firstError?.message ?? 'Invalid input.';
    throw new ValidationError(`Validation failed for "${field}": ${message}`);
  }

  return result.data as z.infer<T>;
}

/**
 * Parse and validate query string parameters against a Zod schema.
 */
export function validateQueryParams<T extends z.ZodTypeAny>(
  event: APIGatewayProxyEvent,
  schema: T
): z.infer<T> {
  const params = event.queryStringParameters ?? {};
  const result = schema.safeParse(params);
  if (!result.success) {
    const firstError = result.error.errors[0];
    const field = firstError?.path.join('.') ?? 'query parameter';
    const message = firstError?.message ?? 'Invalid query parameter.';
    throw new ValidationError(
      `Invalid query parameter "${field}": ${message}`
    );
  }
  return result.data as z.infer<T>;
}

/**
 * Extract and validate a path parameter.
 */
export function getPathParam(
  event: APIGatewayProxyEvent,
  paramName: string
): string {
  const value = event.pathParameters?.[paramName];
  if (!value) {
    throw new ValidationError(`Missing path parameter: ${paramName}`);
  }
  return decodeURIComponent(value);
}
