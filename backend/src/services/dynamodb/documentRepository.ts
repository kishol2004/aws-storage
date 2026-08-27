/**
 * documentRepository.ts — DynamoDB document data access layer
 *
 * Access patterns (no table scans for normal operations):
 * - Get document by ID: GetItem on PK
 * - List user's documents: GSI ownerId-createdAt-index
 * - List by folder: GSI ownerId-folderId-index
 * - List deleted: GSI ownerId-status-index (status=DELETED)
 * - List favorites: GSI ownerId-isFavorite-index
 */
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from './client.js';
import { config } from '../../config/environment.js';
import type { DocumentEntity } from '../../models/document.js';
import { NotFoundError } from '../../utils/errors.js';
import {
  buildPaginatedResult,
  decodeCursor,
  type PaginatedResult,
} from '../../utils/pagination.js';

const TABLE = () => config.documentsTable;

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createDocument(doc: DocumentEntity): Promise<DocumentEntity> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE(),
      Item: doc,
      ConditionExpression: 'attribute_not_exists(documentId)',
    })
  );
  return doc;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getDocument(documentId: string): Promise<DocumentEntity> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE(),
      Key: { documentId },
    })
  );

  if (!result.Item) {
    throw new NotFoundError('Document');
  }

  return result.Item as DocumentEntity;
}

export async function getDocumentOrNull(
  documentId: string
): Promise<DocumentEntity | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE(),
      Key: { documentId },
    })
  );
  return result.Item ? (result.Item as DocumentEntity) : null;
}

// ─── List ─────────────────────────────────────────────────────────────────────

export interface ListDocumentsOptions {
  limit?: number;
  cursor?: string;
  folderId?: string;
  fileType?: string;
  isFavorite?: boolean;
  deleted?: boolean;
}

export async function listDocuments(
  ownerId: string,
  options: ListDocumentsOptions = {}
): Promise<PaginatedResult<DocumentEntity>> {
  const { limit = 20, cursor, folderId, fileType, isFavorite, deleted } =
    options;

  const exclusiveStartKey = cursor ? decodeCursor(cursor) : undefined;

  // Select GSI based on query type
  let indexName = 'ownerId-createdAt-index';
  let keyCondition = 'ownerId = :ownerId';
  const expressionValues: Record<string, unknown> = { ':ownerId': ownerId };
  const filterExpressions: string[] = [];

  if (deleted) {
    // Trash view: documents with deletedAt set
    indexName = 'ownerId-createdAt-index';
    filterExpressions.push('attribute_exists(deletedAt)');
  } else {
    // Normal view: exclude deleted
    filterExpressions.push('attribute_not_exists(deletedAt)');
  }

  if (folderId) {
    filterExpressions.push('folderId = :folderId');
    expressionValues[':folderId'] = folderId;
  }

  if (fileType) {
    filterExpressions.push('fileType = :fileType');
    expressionValues[':fileType'] = fileType;
  }

  if (isFavorite === true) {
    filterExpressions.push('isFavorite = :isFavorite');
    expressionValues[':isFavorite'] = true;
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: indexName,
      KeyConditionExpression: keyCondition,
      FilterExpression:
        filterExpressions.length > 0
          ? filterExpressions.join(' AND ')
          : undefined,
      ExpressionAttributeValues: expressionValues,
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false, // newest first
    })
  );

  const items = (result.Items ?? []) as DocumentEntity[];
  return buildPaginatedResult(
    items,
    result.LastEvaluatedKey as Record<string, unknown> | undefined
  );
}

// ─── Update ───────────────────────────────────────────────────────────────────

export interface UpdateDocumentFields {
  filename?: string;
  folderId?: string;
  tags?: string[];
  category?: string;
  isFavorite?: boolean;
  status?: string;
  deletedAt?: string;
  processingStatus?: string;
  processingStartedAt?: string;
  processingCompletedAt?: string;
  processingError?: string;
  extractedTextLocation?: string;
  summary?: string;
  updatedAt?: string;
}

export async function updateDocument(
  documentId: string,
  fields: UpdateDocumentFields
): Promise<DocumentEntity> {
  // Build dynamic update expression from non-undefined fields
  const setExpressions: string[] = [];
  const removeExpressions: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === null) {
      // Explicit null → remove attribute
      const placeholder = `#${key}`;
      names[placeholder] = key;
      removeExpressions.push(placeholder);
    } else if (value !== undefined) {
      const placeholder = `#${key}`;
      const valuePlaceholder = `:${key}`;
      names[placeholder] = key;
      values[valuePlaceholder] = value;
      setExpressions.push(`${placeholder} = ${valuePlaceholder}`);
    }
  }

  // Always update updatedAt
  if (!fields.updatedAt) {
    names['#updatedAt'] = 'updatedAt';
    values[':updatedAt'] = new Date().toISOString();
    setExpressions.push('#updatedAt = :updatedAt');
  }

  let updateExpression = '';
  if (setExpressions.length > 0) {
    updateExpression += `SET ${setExpressions.join(', ')}`;
  }
  if (removeExpressions.length > 0) {
    updateExpression += ` REMOVE ${removeExpressions.join(', ')}`;
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE(),
      Key: { documentId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: Object.keys(values).length > 0 ? values : undefined,
      ConditionExpression: 'attribute_exists(documentId)',
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes as DocumentEntity;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function permanentDeleteDocument(documentId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE(),
      Key: { documentId },
    })
  );
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchDocuments(
  ownerId: string,
  query: string,
  options: { limit?: number; cursor?: string } = {}
): Promise<PaginatedResult<DocumentEntity>> {
  const { limit = 20, cursor } = options;
  const exclusiveStartKey = cursor ? decodeCursor(cursor) : undefined;
  const lowerQuery = query.toLowerCase();

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'ownerId-createdAt-index',
      KeyConditionExpression: 'ownerId = :ownerId',
      FilterExpression:
        'attribute_not_exists(deletedAt) AND ' +
        '(contains(lowerFilename, :q) OR contains(#cat, :q) OR contains(#sum, :q))',
      ExpressionAttributeValues: {
        ':ownerId': ownerId,
        ':q': lowerQuery,
      },
      ExpressionAttributeNames: {
        '#cat': 'category',
        '#sum': 'summary',
      },
      Limit: limit * 3, // Over-fetch since filter reduces results
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false,
    })
  );

  const items = (result.Items ?? []) as DocumentEntity[];
  return buildPaginatedResult(
    items.slice(0, limit),
    result.LastEvaluatedKey as Record<string, unknown> | undefined
  );
}
