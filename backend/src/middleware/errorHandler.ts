/**
 * errorHandler.ts — Centralised Lambda error handling wrapper
 *
 * SECURITY: Never exposes stack traces, AWS request IDs, or internal errors.
 * All unknown errors are logged internally and return a generic 500 to the client.
 */
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from 'aws-lambda';
import { isAppError } from '../utils/errors.js';
import { errorResponse } from '../utils/response.js';

type LambdaHandler = (
  event: APIGatewayProxyEvent
) => Promise<APIGatewayProxyResult>;

/**
 * Higher-order function that wraps a Lambda handler with:
 * - Centralised error catching
 * - Safe error response mapping
 * - Structured logging (never logs credentials or document contents)
 */
export function withErrorHandler(handler: LambdaHandler): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin':
            process.env['FRONTEND_ORIGIN'] ?? 'http://localhost:5173',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type,Authorization,X-Requested-With',
        },
        body: '',
      };
    }

    try {
      return await handler(event);
    } catch (error: unknown) {
      if (isAppError(error) && error.isOperational) {
        // Known operational error — log at WARN, return safe response
        console.warn(
          JSON.stringify({
            level: 'WARN',
            code: error.code,
            message: error.message,
            statusCode: error.statusCode,
            requestId: event.requestContext?.requestId,
          })
        );
        return errorResponse(error.message, error.code, error.statusCode);
      }

      // Unknown/unexpected error — log details internally, return generic 500
      console.error(
        JSON.stringify({
          level: 'ERROR',
          message: 'Unhandled internal error',
          // Only log the error message, never the full stack in production
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          requestId: event.requestContext?.requestId,
          path: event.resource,
          httpMethod: event.httpMethod,
        })
      );

      return errorResponse(
        'An internal error occurred. Please try again later.',
        'INTERNAL_ERROR',
        500
      );
    }
  };
}
