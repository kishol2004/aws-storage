/**
 * searchService.ts — Document search service
 *
 * SECURITY: All search results are filtered to only include documents the
 * authenticated user owns OR has an active share for.
 * Results from other users are NEVER returned regardless of query content.
 *
 * Extensibility note: The intelligentSearchAvailable flag is explicitly false
 * until a vector search backend (e.g. OpenSearch Serverless) is configured.
 * We NEVER pretend semantic search works when it doesn't.
 */
import { searchDocuments } from '../dynamodb/documentRepository.js';
import { listSharesByRecipient } from '../dynamodb/shareRepository.js';
import { getDocumentOrNull } from '../dynamodb/documentRepository.js';
import type { DocumentEntity } from '../../models/document.js';
import type { PaginatedResult } from '../../utils/pagination.js';

export const intelligentSearchAvailable = false;

export interface SearchOptions {
  limit?: number;
  cursor?: string;
  fileType?: string;
  category?: string;
  folderId?: string;
}

export interface SearchResult extends PaginatedResult<DocumentEntity> {
  intelligentSearchAvailable: boolean;
  query: string;
}

/**
 * Search documents the user can access:
 * 1. Their own documents matching the query
 * 2. Documents shared with them matching the query
 * 
 * Authorization filtering happens BEFORE returning results.
 */
export async function searchUserDocuments(
  userId: string,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const { limit = 20, cursor, fileType, category } = options;

  // 1. Search owned documents
  const ownedResults = await searchDocuments(userId, query, { limit, cursor });

  // 2. Find documents shared with the user
  const sharesResult = await listSharesByRecipient(userId, { limit: 100 });
  const sharedDocIds = new Set(sharesResult.items.map((s) => s.documentId));

  // Fetch shared document metadata and filter by query
  const sharedDocs: DocumentEntity[] = [];
  for (const docId of sharedDocIds) {
    const doc = await getDocumentOrNull(docId);
    if (!doc || doc.deletedAt) continue;

    const lowerQ = query.toLowerCase();
    const matches =
      doc.filename.toLowerCase().includes(lowerQ) ||
      doc.category?.toLowerCase().includes(lowerQ) ||
      doc.summary?.toLowerCase().includes(lowerQ) ||
      doc.tags?.some((t) => t.toLowerCase().includes(lowerQ));

    if (matches) sharedDocs.push(doc);
  }

  // 3. Merge and deduplicate by documentId
  const seen = new Set<string>();
  const merged: DocumentEntity[] = [];

  for (const doc of [...ownedResults.items, ...sharedDocs]) {
    if (!seen.has(doc.documentId)) {
      seen.add(doc.documentId);

      // Apply optional filters
      if (fileType && doc.fileType !== fileType) continue;
      if (category && doc.category !== category) continue;

      merged.push(doc);
    }
  }

  return {
    items: merged.slice(0, limit),
    count: merged.length,
    nextCursor: ownedResults.nextCursor,
    intelligentSearchAvailable,
    query,
  };
}
