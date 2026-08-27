/**
 * documentSchemas.ts — Zod validation schemas for document endpoints
 */
import { z } from 'zod';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const uuidString = () =>
  z.string().regex(UUID_RE, 'Invalid ID format');

// ─── Upload URL Request ───────────────────────────────────────────────────────

export const CreateUploadUrlSchema = z.object({
  filename: z.string().min(1).max(255).trim(),
  mimeType: z.string().min(1).max(100).trim(),
  fileSize: z.number().int().positive().max(200 * 1024 * 1024), // 200MB hard max
  folderId: z.string().optional(),
});

export type CreateUploadUrlInput = z.infer<typeof CreateUploadUrlSchema>;

// ─── Update Document ──────────────────────────────────────────────────────────

export const UpdateDocumentSchema = z
  .object({
    filename: z.string().min(1).max(255).trim().optional(),
    folderId: z.string().optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    category: z.string().max(50).optional(),
  })
  .strict(); // Reject unexpected fields

export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;

// ─── List Documents Query ─────────────────────────────────────────────────────

export const ListDocumentsQuerySchema = z.object({
  folderId: z.string().optional(),
  fileType: z.string().optional(),
  isFavorite: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  deleted: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  cursor: z.string().optional(),
});

export type ListDocumentsQuery = z.infer<typeof ListDocumentsQuerySchema>;

// ─── Document ID path parameter ───────────────────────────────────────────────

export const DocumentIdParamSchema = z.object({
  id: z.string().min(1).max(100),
});
