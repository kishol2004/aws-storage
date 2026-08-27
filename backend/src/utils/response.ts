/**
 * response.ts
 * Standardised API response helpers.
 * All Lambda handlers must return responses through these functions.
 */
import type { APIGatewayProxyResult } from 'aws-lambda';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorResponse {
  success: false;
  message: string;
  code: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
};

/**
 * Build CORS headers dynamically using the configured allowed origin.
 * Never returns Access-Control-Allow-Origin: * for authenticated APIs.
 */
function buildHeaders(origin?: string): Record<string, string> {
  const allowedOrigin = process.env['FRONTEND_ORIGIN'] ?? 'http://localhost:5173';
  return {
    ...CORS_HEADERS,
    'Access-Control-Allow-Origin': origin ?? allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type,Authorization,X-Requested-With',
  };
}

export function successResponse<T>(
  data: T,
  statusCode = 200,
  meta?: Record<string, unknown>
): APIGatewayProxyResult {
  const body: SuccessResponse<T> = {
    success: true,
    data,
    ...(meta ? { meta } : {}),
  };
  return {
    statusCode,
    headers: buildHeaders(),
    body: JSON.stringify(body),
  };
}

export function createdResponse<T>(data: T): APIGatewayProxyResult {
  return successResponse(data, 201);
}

export function noContentResponse(): APIGatewayProxyResult {
  return {
    statusCode: 204,
    headers: buildHeaders(),
    body: '',
  };
}

export function errorResponse(
  message: string,
  code: string,
  statusCode: number
): APIGatewayProxyResult {
  const body: ErrorResponse = {
    success: false,
    message,
    code,
  };
  return {
    statusCode,
    headers: buildHeaders(),
    body: JSON.stringify(body),
  };
}

/** OPTIONS preflight response */
export function preflightResponse(): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: buildHeaders(),
    body: '',
  };
}
