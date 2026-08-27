/**
 * auth.ts — Cognito JWT claim extraction middleware
 *
 * API Gateway with Cognito Authorizer automatically validates the JWT and
 * injects claims into requestContext.authorizer.claims.
 * We NEVER trust the request body for identity — always use Cognito claims.
 */
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { UnauthorizedError } from '../utils/errors.js';

export interface CognitoUser {
  userId: string;         // Cognito sub — primary identity
  email: string;
  groups: string[];       // cognito:groups
  name?: string;
}

/**
 * Extract the authenticated Cognito user from the API Gateway request context.
 * Throws UnauthorizedError if the user is not authenticated.
 *
 * SECURITY: This function only reads from requestContext.authorizer.claims,
 * which is populated by API Gateway after JWT validation.
 * It NEVER reads from event.body, queryStringParameters, or pathParameters.
 */
export function extractCognitoUser(event: APIGatewayProxyEvent): CognitoUser {
  const claims = event.requestContext?.authorizer?.claims as
    | Record<string, string>
    | undefined;

  if (!claims) {
    throw new UnauthorizedError(
      'Authentication required. Please log in and try again.'
    );
  }

  const sub = claims['sub'];
  const email = claims['email'];

  if (!sub || !email) {
    throw new UnauthorizedError('Invalid authentication token.');
  }

  const groupsClaim = claims['cognito:groups'] ?? '';
  const groups = groupsClaim
    ? groupsClaim.split(',').map((g) => g.trim())
    : [];

  return {
    userId: sub,
    email,
    groups,
    name: claims['name'],
  };
}

/**
 * Extract caller IP from request context.
 * Used for audit logging only — never for access control.
 */
export function extractIpAddress(event: APIGatewayProxyEvent): string {
  return (
    event.requestContext?.identity?.sourceIp ??
    event.headers?.['X-Forwarded-For']?.split(',')[0]?.trim() ??
    'unknown'
  );
}

/**
 * Extract User-Agent for audit logging.
 */
export function extractUserAgent(event: APIGatewayProxyEvent): string {
  return (
    event.requestContext?.identity?.userAgent ??
    event.headers?.['User-Agent'] ??
    'unknown'
  );
}
