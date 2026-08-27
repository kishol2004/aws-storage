/**
 * notificationRepository.ts — DynamoDB notification data access layer
 *
 * Table design:
 *   PK: userId  SK: createdAt#notificationId
 */
import {
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from './client.js';
import { config } from '../../config/environment.js';
import type { NotificationEntity } from '../../models/notification.js';

const TABLE = () => config.notificationsTable;

export async function createNotification(
  notification: NotificationEntity
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE(),
      Item: {
        ...notification,
        sk: `${notification.createdAt}#${notification.notificationId}`,
      },
    })
  );
}

export async function listNotifications(
  userId: string,
  limit = 30
): Promise<NotificationEntity[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      Limit: limit,
      ScanIndexForward: false, // newest first
    })
  );
  return (result.Items ?? []) as NotificationEntity[];
}

export async function markNotificationRead(
  notificationId: string,
  userId: string,
  sk: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE(),
      Key: { userId, sk },
      UpdateExpression: 'SET #read = :true',
      ExpressionAttributeNames: { '#read': 'read' },
      ExpressionAttributeValues: {
        ':true': true,
        ':notifId': notificationId,
      },
      ConditionExpression:
        'attribute_exists(userId) AND notificationId = :notifId',
    })
  );
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  // List unread, then batch update
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: '#read = :false',
      ExpressionAttributeNames: { '#read': 'read' },
      ExpressionAttributeValues: { ':userId': userId, ':false': false },
      Limit: 100,
    })
  );

  const items = result.Items ?? [];
  await Promise.all(
    items.map((item) =>
      docClient.send(
        new UpdateCommand({
          TableName: TABLE(),
          Key: { userId: item['userId'], sk: item['sk'] },
          UpdateExpression: 'SET #read = :true',
          ExpressionAttributeNames: { '#read': 'read' },
          ExpressionAttributeValues: { ':true': true },
        })
      )
    )
  );
}
