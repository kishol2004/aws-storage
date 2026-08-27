/**
 * rateLimit.ts — Application-level rate limiting guard
 *
 * NOTE: Primary rate limiting is enforced via:
 *   1. API Gateway Usage Plans (throttle: 100 rps burst, 50 rps steady)
 *   2. AWS WAF rules (configured in CDK MonitoringStack)
 *
 * This module provides an additional DynamoDB-backed counter for
 * extremely sensitive operations (AI processing triggers, upload URL generation)
 * as a defence-in-depth measure.
 *
 * IMPORTANT: Lambda in-memory counters are NOT production-grade rate limiters
 * because Lambda instances are ephemeral and parallel. This uses DynamoDB
 * atomic counters for reliable cross-instance counting.
 */
import {
  DynamoDBClient,
  UpdateItemCommand,
  ConditionalCheckFailedException,
} from '@aws-sdk/client-dynamodb';
import { RateLimitError } from '../utils/errors.js';
import { config } from '../config/environment.js';

const dynamo = new DynamoDBClient({ region: config.region });

interface RateLimitOptions {
  userId: string;
  action: string;
  windowSeconds: number;
  maxRequests: number;
}

/**
 * Check rate limit for a sensitive operation using DynamoDB atomic counter.
 * Uses a time-window key that expires automatically via TTL.
 *
 * @throws RateLimitError if the user exceeds the allowed request rate
 */
export async function checkRateLimit(opts: RateLimitOptions): Promise<void> {
  const { userId, action, windowSeconds, maxRequests } = opts;

  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `ratelimit#${userId}#${action}#${windowStart}`;
  const ttl = Math.floor(Date.now() / 1000) + windowSeconds * 2;

  try {
    await dynamo.send(
      new UpdateItemCommand({
        TableName: config.statsTable,
        Key: { statKey: { S: key } },
        UpdateExpression:
          'SET #cnt = if_not_exists(#cnt, :zero) + :one, #ttl = if_not_exists(#ttl, :ttl)',
        ConditionExpression: '#cnt < :max OR attribute_not_exists(#cnt)',
        ExpressionAttributeNames: {
          '#cnt': 'count',
          '#ttl': 'ttl',
        },
        ExpressionAttributeValues: {
          ':zero': { N: '0' },
          ':one': { N: '1' },
          ':max': { N: String(maxRequests) },
          ':ttl': { N: String(ttl) },
        },
      })
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      throw new RateLimitError();
    }
    // On DynamoDB error, fail open (log but don't block the user)
    console.warn(
      JSON.stringify({
        level: 'WARN',
        message: 'Rate limit check failed — failing open',
        userId,
        action,
      })
    );
  }
}

// Pre-configured limits for sensitive operations
export const RATE_LIMITS = {
  uploadUrl: { windowSeconds: 60, maxRequests: 20 },
  aiProcessing: { windowSeconds: 3600, maxRequests: 10 },
  shareDocument: { windowSeconds: 60, maxRequests: 30 },
} as const;
