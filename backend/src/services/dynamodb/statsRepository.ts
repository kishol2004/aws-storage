/**
 * statsRepository.ts — DynamoDB atomic counter service
 *
 * Uses DynamoDB ADD expressions for atomic, race-condition-safe counter updates.
 * Avoids expensive table scans for dashboard statistics.
 */
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from './client.js';
import { config } from '../../config/environment.js';

const TABLE = () => config.statsTable;

export type StatKey =
  | 'totalDocuments'
  | 'totalStorage'
  | 'totalShares'
  | 'aiProcessedDocuments'
  | 'failedProcessingJobs'
  | 'totalUsers';

/**
 * Atomically increment or decrement a stat counter.
 * Positive delta → increment. Negative delta → decrement.
 */
export async function incrementStat(
  key: StatKey,
  delta: number
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE(),
      Key: { statKey: key },
      UpdateExpression: 'ADD #val :delta',
      ExpressionAttributeNames: { '#val': 'value' },
      ExpressionAttributeValues: { ':delta': delta },
    })
  );
}

async function getStat(key: StatKey): Promise<number> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE(),
      Key: { statKey: key },
    })
  );
  return (result.Item?.['value'] as number) ?? 0;
}

export interface SystemStats {
  totalDocuments: number;
  totalStorage: number;         // Bytes
  totalShares: number;
  aiProcessedDocuments: number;
  failedProcessingJobs: number;
  totalUsers: number;
}

/**
 * Retrieve all system statistics. Uses GetItem (point reads), not scans.
 */
export async function getSystemStats(): Promise<SystemStats> {
  const [
    totalDocuments,
    totalStorage,
    totalShares,
    aiProcessedDocuments,
    failedProcessingJobs,
    totalUsers,
  ] = await Promise.all([
    getStat('totalDocuments'),
    getStat('totalStorage'),
    getStat('totalShares'),
    getStat('aiProcessedDocuments'),
    getStat('failedProcessingJobs'),
    getStat('totalUsers'),
  ]);

  return {
    totalDocuments,
    totalStorage,
    totalShares,
    aiProcessedDocuments,
    failedProcessingJobs,
    totalUsers,
  };
}
