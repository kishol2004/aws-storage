/**
 * auditRepository.ts — DynamoDB audit log data access layer
 *
 * Table design:
 *   PK: userId  SK: timestamp#eventId
 *   GSI: timestamp-index (PK: timestamp) — for admin cross-user queries
 */
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from './client.js';
import { config } from '../../config/environment.js';
import type { AuditLogEntity } from '../../models/auditLog.js';
import {
  buildPaginatedResult,
  decodeCursor,
  type PaginatedResult,
} from '../../utils/pagination.js';

const TABLE = () => config.auditTable;

export async function createAuditEvent(event: AuditLogEntity): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE(),
      Item: {
        ...event,
        // Composite sort key for efficient time-ordered queries per user
        sk: `${event.timestamp}#${event.eventId}`,
      },
    })
  );
}

export async function listUserAuditEvents(
  userId: string,
  options: { limit?: number; cursor?: string; from?: string; to?: string } = {}
): Promise<PaginatedResult<AuditLogEntity>> {
  const { limit = 20, cursor, from, to } = options;
  const exclusiveStartKey = cursor ? decodeCursor(cursor) : undefined;

  let keyCondition = 'userId = :userId';
  const values: Record<string, unknown> = { ':userId': userId };

  if (from && to) {
    keyCondition += ' AND sk BETWEEN :from AND :to';
    values[':from'] = from;
    values[':to'] = `${to}~`; // ~ sorts after Z in ASCII
  } else if (from) {
    keyCondition += ' AND sk >= :from';
    values[':from'] = from;
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: values,
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false, // newest first
    })
  );

  return buildPaginatedResult(
    (result.Items ?? []) as AuditLogEntity[],
    result.LastEvaluatedKey as Record<string, unknown> | undefined
  );
}

/** Admin: query audit logs across all users using the timestamp GSI */
export async function listAllAuditEvents(
  options: { limit?: number; cursor?: string; from?: string; to?: string } = {}
): Promise<PaginatedResult<AuditLogEntity>> {
  const { limit = 50, cursor, from, to } = options;
  const exclusiveStartKey = cursor ? decodeCursor(cursor) : undefined;

  // Use a date partition to query the GSI efficiently
  const dateKey = from
    ? from.substring(0, 10)
    : new Date().toISOString().substring(0, 10); // YYYY-MM-DD

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'date-timestamp-index',
      KeyConditionExpression: '#date = :date',
      ExpressionAttributeNames: { '#date': 'date' },
      ExpressionAttributeValues: { ':date': dateKey },
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false,
    })
  );

  return buildPaginatedResult(
    (result.Items ?? []) as AuditLogEntity[],
    result.LastEvaluatedKey as Record<string, unknown> | undefined
  );
}
