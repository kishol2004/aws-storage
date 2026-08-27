/**
 * authBypass.test.ts — Security tests verifying auth enforcement
 * These tests verify that Lambda functions extract identity from Cognito claims,
 * NEVER from the request body.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { extractCognitoUser } from '../../src/middleware/auth.js';
import type { APIGatewayProxyEvent } from 'aws-lambda';

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/',
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    body: null,
    isBase64Encoded: false,
    resource: '/',
    requestContext: {
      accountId: '123456789012',
      apiId: 'test',
      authorizer: {},
      httpMethod: 'GET',
      identity: { sourceIp: '1.2.3.4', userAgent: 'test' } as any,
      path: '/',
      protocol: 'HTTP/1.1',
      requestId: 'req-1',
      requestTimeEpoch: Date.now(),
      resourceId: 'test',
      resourcePath: '/',
      stage: 'dev',
    } as any,
    ...overrides,
  };
}

describe('Auth Middleware Security', () => {
  it('throws UnauthorizedError when no claims present', () => {
    const event = makeEvent();
    expect(() => extractCognitoUser(event)).toThrow();
  });

  it('throws UnauthorizedError when authorizer claims are empty', () => {
    const event = makeEvent({
      requestContext: {
        ...makeEvent().requestContext,
        authorizer: { claims: {} },
      } as any,
    });
    expect(() => extractCognitoUser(event)).toThrow();
  });

  it('extracts userId from sub claim (never from body)', () => {
    const event = makeEvent({
      requestContext: {
        ...makeEvent().requestContext,
        authorizer: {
          claims: {
            sub: 'real-user-id-from-cognito',
            email: 'user@example.com',
            'cognito:groups': 'USER',
          },
        },
      } as any,
      body: JSON.stringify({ userId: 'attacker-injected-id' }), // Should be IGNORED
    });

    const user = extractCognitoUser(event);
    expect(user.userId).toBe('real-user-id-from-cognito');
    expect(user.userId).not.toBe('attacker-injected-id');
  });

  it('reads groups from cognito:groups claim', () => {
    const event = makeEvent({
      requestContext: {
        ...makeEvent().requestContext,
        authorizer: {
          claims: {
            sub: 'user-id',
            email: 'admin@example.com',
            'cognito:groups': 'ADMIN',
          },
        },
      } as any,
    });

    const user = extractCognitoUser(event);
    expect(user.groups).toContain('ADMIN');
  });

  it('never trusts role from request body', () => {
    const event = makeEvent({
      requestContext: {
        ...makeEvent().requestContext,
        authorizer: {
          claims: {
            sub: 'normal-user',
            email: 'user@example.com',
            'cognito:groups': 'USER', // Normal user in Cognito
          },
        },
      } as any,
      body: JSON.stringify({ role: 'ADMIN' }), // Attacker claims to be admin — IGNORED
    });

    const user = extractCognitoUser(event);
    expect(user.groups).not.toContain('ADMIN');
    expect(user.groups).toContain('USER');
  });
});
