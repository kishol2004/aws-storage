/** aiAnalysis.ts — AI-generated analysis model */

export type AIAnalysisStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export type DocumentCategory =
  | 'Academic'
  | 'Financial'
  | 'Legal'
  | 'Personal'
  | 'Business'
  | 'Technical'
  | 'Other';

export interface ExtractedEntities {
  people: string[];
  organizations: string[];
  locations: string[];
  dates: string[];
  amounts: string[];
}

export interface AIAnalysisEntity {
  analysisId: string;
  documentId: string;
  userId: string;          // Owner of the document
  modelId: string;         // Bedrock model ID used

  // AI-generated content — clearly marked
  shortSummary: string;
  detailedSummary: string;
  category: DocumentCategory;
  keywords: string[];
  entities: ExtractedEntities;

  status: AIAnalysisStatus;
  createdAt: string;
  updatedAt: string;
  failureReason?: string;  // Safe error only, no internals
}
