/**
 * api.ts — Axios API client with Cognito token injection
 *
 * SECURITY:
 * - Authorization token is always fetched fresh from the Cognito SDK
 *   (SDK auto-refreshes expired tokens)
 * - Never reads raw tokens from localStorage manually
 * - Never exposes the token in URLs or logs
 * - Redirects to /login on 401 (expired/invalid token)
 */
import axios from 'axios';
import { getIdToken, isCognitoConfigured } from './cognito';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || '/api';

export const IS_API_CONFIGURED = !!BASE_URL;

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// ─── Request interceptor: inject Cognito ID token ─────────────────────────────
api.interceptors.request.use(async (config) => {
  if (!isCognitoConfigured) return config; // Demo mode — no auth header

  const token = await getIdToken(); // SDK auto-refreshes if expired
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: handle auth errors ─────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token invalid or expired past refresh window → force re-login
      window.location.href = '/login';
    }
    return Promise.reject(error as Error);
  }
);

// ─── Documents API ────────────────────────────────────────────────────────────

export const documentsApi = {
  list: (params?: {
    folderId?: string;
    fileType?: string;
    isFavorite?: boolean;
    deleted?: boolean;
    limit?: number;
    cursor?: string;
  }) => api.get('/documents', { params }),

  getUploadUrl: (filename: string, mimeType: string, fileSize: number, folderId?: string, mode?: 'rename' | 'replace') =>
    api.post('/documents/upload-url', { filename, mimeType, fileSize, folderId, mode }),

  checkDuplicates: (filenames: string[], folderId?: string) =>
    api.post('/documents/check-duplicates', { filenames, folderId }),

  get: (documentId: string) => api.get(`/documents/${documentId}`),

  update: (documentId: string, fields: {
    filename?: string;
    folderId?: string;
    tags?: string[];
    category?: string;
  }) => api.patch(`/documents/${documentId}`, fields),

  softDelete: (documentId: string) => api.delete(`/documents/${documentId}`),

  restore: (documentId: string) => api.post(`/documents/${documentId}/restore`),

  permanentDelete: (documentId: string) =>
    api.delete(`/documents/${documentId}/permanent`),

  download: (documentId: string) => api.get(`/documents/${documentId}/download`),

  toggleFavorite: (documentId: string) =>
    api.post(`/documents/${documentId}/favorite`),

  getAnalysis: (documentId: string) =>
    api.get(`/documents/${documentId}/ai-analysis`),

  share: (
    documentId: string,
    recipientEmail: string,
    permission: 'VIEW' | 'DOWNLOAD' | 'EDIT',
    expiresAt?: number
  ) =>
    api.post(`/documents/${documentId}/share`, {
      recipientEmail,
      permission,
      expiresAt,
    }),

  listShares: (documentId: string) =>
    api.get(`/documents/${documentId}/shares`),
};

// ─── Folders API ──────────────────────────────────────────────────────────────

export const foldersApi = {
  list: () => api.get('/folders'),

  create: (folderName: string, parentFolderId?: string) =>
    api.post('/folders', { folderName, parentFolderId }),

  update: (folderId: string, folderName: string) =>
    api.patch(`/folders/${folderId}`, { folderName }),

  delete: (folderId: string) => api.delete(`/folders/${folderId}`),
};

// ─── Sharing API ──────────────────────────────────────────────────────────────

export const sharesApi = {
  sharedWithMe: (params?: { limit?: number; cursor?: string }) =>
    api.get('/shared-with-me', { params }),

  updateShare: (shareId: string, permission: 'VIEW' | 'DOWNLOAD' | 'EDIT') =>
    api.patch(`/shares/${shareId}`, { permission }),

  revokeShare: (shareId: string) => api.delete(`/shares/${shareId}`),
};

// ─── Search API ───────────────────────────────────────────────────────────────

export const searchApi = {
  search: (params: {
    q: string;
    fileType?: string;
    category?: string;
    folderId?: string;
    limit?: number;
    cursor?: string;
  }) => api.get('/search', { params }),
};

// ─── Dashboard API ────────────────────────────────────────────────────────────

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
};

// ─── Activity API ─────────────────────────────────────────────────────────────

export const activityApi = {
  list: (params?: { limit?: number; cursor?: string; from?: string; to?: string }) =>
    api.get('/activity', { params }),
};

// ─── Notifications API ────────────────────────────────────────────────────────

export const notificationsApi = {
  list: () => api.get('/notifications'),

  markRead: (notificationId: string) =>
    api.patch(`/notifications/${notificationId}`),

  markAllRead: () => api.patch('/notifications/all'),
};

// ─── Admin API ────────────────────────────────────────────────────────────────

export const adminApi = {
  getUsers: (params?: { limit?: number; paginationToken?: string; search?: string }) =>
    api.get('/admin/users', { params }),

  updateUser: (userId: string, status: 'ACTIVE' | 'DISABLED') =>
    api.patch(`/admin/users/${userId}`, { status }),

  getStatistics: () => api.get('/admin/statistics'),

  getAuditLogs: (params?: { limit?: number; cursor?: string; from?: string; to?: string }) =>
    api.get('/admin/audit-logs', { params }),
};
