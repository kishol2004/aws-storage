/**
 * aiAnalysisRepository.ts — DynamoDB AI analysis data access layer
 */
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from './client.js';
import { config } from '../../config/environment.js';
import type { AIAnalysisEntity } from '../../models/aiAnalysis.js';
import { NotFoundError } from '../../utils/errors.js';

const TABLE = () => config.aiAnalysisTable;

export async function createAnalysis(
  analysis: AIAnalysisEntity
): Promise<AIAnalysisEntity> {
  await docClient.send(
    new PutCommand({ TableName: TABLE(), Item: analysis })
  );
  return analysis;
}

export async function getAnalysisByDocument(
  documentId: string
): Promise<AIAnalysisEntity | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'documentId-index',
      KeyConditionExpression: 'documentId = :documentId',
      ExpressionAttributeValues: { ':documentId': documentId },
      Limit: 1,
      ScanIndexForward: false, // latest first
    })
  );
  const item = result.Items?.[0];
  return item ? (item as AIAnalysisEntity) : null;
}

export async function updateAnalysis(
  analysisId: string,
  fields: Partial<AIAnalysisEntity>
): Promise<void> {
  const updates = Object.entries(fields).filter(
    ([, v]) => v !== undefined
  );
  if (updates.length === 0) return;

  const setExpr = updates.map(([k]) => `#${k} = :${k}`).join(', ');
  const names = Object.fromEntries(updates.map(([k]) => [`#${k}`, k]));
  const values = Object.fromEntries(
    updates.map(([k, v]) => [`:${k}`, v])
  );

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE(),
      Key: { analysisId },
      UpdateExpression: `SET ${setExpr}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}
