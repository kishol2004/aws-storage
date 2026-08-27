/**
 * folderRepository.ts — DynamoDB folder data access layer
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
import type { FolderEntity } from '../../models/folder.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';

const TABLE = () => config.foldersTable;

export async function createFolder(folder: FolderEntity): Promise<FolderEntity> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE(),
      Item: folder,
      ConditionExpression: 'attribute_not_exists(folderId)',
    })
  );
  return folder;
}

export async function getFolder(folderId: string): Promise<FolderEntity> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE(), Key: { folderId } })
  );
  if (!result.Item) throw new NotFoundError('Folder');
  return result.Item as FolderEntity;
}

export async function getFolderOrNull(folderId: string): Promise<FolderEntity | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE(), Key: { folderId } })
  );
  return result.Item ? (result.Item as FolderEntity) : null;
}

export async function listFolders(ownerId: string): Promise<FolderEntity[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'ownerId-index',
      KeyConditionExpression: 'ownerId = :ownerId',
      ExpressionAttributeValues: { ':ownerId': ownerId },
    })
  );
  return (result.Items ?? []) as FolderEntity[];
}

export async function updateFolder(
  folderId: string,
  fields: { folderName?: string }
): Promise<FolderEntity> {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE(),
      Key: { folderId },
      UpdateExpression: 'SET folderName = :name, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':name': fields.folderName,
        ':updatedAt': new Date().toISOString(),
      },
      ConditionExpression: 'attribute_exists(folderId)',
      ReturnValues: 'ALL_NEW',
    })
  );
  return result.Attributes as FolderEntity;
}

export async function deleteFolder(folderId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({ TableName: TABLE(), Key: { folderId } })
  );
}

export async function validateFolderOwnership(
  folderId: string,
  userId: string
): Promise<FolderEntity> {
  const folder = await getFolder(folderId);
  if (folder.ownerId !== userId) {
    // Return 404 to avoid leaking existence of other users' folders
    throw new NotFoundError('Folder');
  }
  return folder;
}
