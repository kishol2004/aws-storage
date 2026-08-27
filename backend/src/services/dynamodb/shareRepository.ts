/**
 * shareRepository.ts — DynamoDB share data access layer
 */
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from './client.js';
import { config } from '../../config/environment.js';
import type { ShareEntity } from '../../models/share.js';
import { NotFoundError } from '../../utils/errors.js';
import {
  buildPaginatedResult,
  decodeCursor,
  type PaginatedResult,
} from '../../utils/pagination.js';

const TABLE = () => config.sharesTable;

export async function createShare(share: ShareEntity): Promise<ShareEntity> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE(),
      Item: share,
      ConditionExpression: 'attribute_not_exists(shareId)',
    })
  );
  return share;
}

export async function getShare(shareId: string): Promise<ShareEntity> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE(), Key: { shareId } })
  );
  if (!result.Item) throw new NotFoundError('Share');
  return result.Item as ShareEntity;
}

export async function listSharesByDocument(
  documentId: string
): Promise<ShareEntity[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'documentId-index',
      KeyConditionExpression: 'documentId = :documentId',
      ExpressionAttributeValues: { ':documentId': documentId },
    })
  );
  return (result.Items ?? []) as ShareEntity[];
}

export async function listSharesByRecipient(
  userId: string,
  options: { limit?: number; cursor?: string } = {}
): Promise<PaginatedResult<ShareEntity>> {
  const { limit = 20, cursor } = options;
  const exclusiveStartKey = cursor ? decodeCursor(cursor) : undefined;

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'sharedWithUserId-status-index',
      KeyConditionExpression:
        'sharedWithUserId = :userId AND #status = :status',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':status': 'ACTIVE',
      },
      ExpressionAttributeNames: { '#status': 'status' },
      // Filter out expired shares
      FilterExpression:
        'attribute_not_exists(expiresAt) OR expiresAt > :now',
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false,
    })
  );

  // Inject current time for expiry filter
  const now = new Date().toISOString();
  const items = ((result.Items ?? []) as ShareEntity[]).filter(
    (s) => !s.expiresAt || s.expiresAt > now
  );

  return buildPaginatedResult(
    items,
    result.LastEvaluatedKey as Record<string, unknown> | undefined
  );
}

/**
 * Find an active, non-expired share for a specific user + document combination.
 */
export async function getActiveShare(
  documentId: string,
  userId: string
): Promise<ShareEntity | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'documentId-index',
      KeyConditionExpression: 'documentId = :documentId',
      FilterExpression:
        'sharedWithUserId = :userId AND #status = :active',
      ExpressionAttributeValues: {
        ':documentId': documentId,
        ':userId': userId,
        ':active': 'ACTIVE',
      },
      ExpressionAttributeNames: { '#status': 'status' },
    })
  );

  const now = new Date().toISOString();
  const share = ((result.Items ?? []) as ShareEntity[]).find(
    (s) => !s.expiresAt || s.expiresAt > now
  );

  return share ?? null;
}

export async function updateShare(
  shareId: string,
  fields: { permission?: string; status?: string }
): Promise<ShareEntity> {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE(),
      Key: { shareId },
      UpdateExpression:
        'SET #perm = :perm, #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#perm': 'permission',
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':perm': fields.permission,
        ':status': fields.status,
        ':updatedAt': new Date().toISOString(),
      },
      ConditionExpression: 'attribute_exists(shareId)',
      ReturnValues: 'ALL_NEW',
    })
  );
  return result.Attributes as ShareEntity;
}

export async function revokeShare(shareId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE(),
      Key: { shareId },
      UpdateExpression: 'SET #status = :revoked, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':revoked': 'REVOKED',
        ':updatedAt': new Date().toISOString(),
      },
      ConditionExpression: 'attribute_exists(shareId)',
    })
  );
}

/** Check for a duplicate active share before creating a new one */
export async function findExistingShare(
  documentId: string,
  recipientUserId: string
): Promise<ShareEntity | null> {
  return getActiveShare(documentId, recipientUserId);
}
