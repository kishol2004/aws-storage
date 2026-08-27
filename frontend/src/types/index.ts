export interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
}

export type ProcessingStatus = 'UPLOADING' | 'PROCESSING' | 'TEXT_EXTRACTION' | 'AI_ANALYSIS' | 'COMPLETED' | 'FAILED';

export interface Document {
  documentId: string;
  ownerId: string;
  folderId: string | null;
  filename: string;
  originalFilename?: string;
  s3Key: string;
  fileType?: string;
  mimeType?: string;
  fileSize?: number;
  size?: number;
  status: ProcessingStatus;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  category?: string;
  tags?: string[];
  summary?: string;
  detailedSummary?: string;
  entities?: {
    people?: string[];
    organizations?: string[];
    locations?: string[];
    dates?: string[];
    amounts?: string[];
  };
  keywords?: string[];
}

export interface Folder {
  folderId: string;
  folderName: string;
  parentFolderId: string;
  ownerId: string;
  createdAt: string;
}

export interface Share {
  shareId: string;
  documentId: string;
  ownerId: string;
  recipientEmail: string;
  permission: 'VIEW' | 'DOWNLOAD' | 'EDIT';
  expiresAt?: number;
  createdAt: string;
}

export interface AuditLog {
  eventId: string;
  userId: string;
  action: string;
  resourceId: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'SUCCESS' | 'FAILED';
  metadata?: Record<string, any>;
}

export interface AppNotification {
  notificationId: string;
  userId: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  read: boolean;
  createdAt: string;
}
