/** folderSchemas.ts — Zod schemas for folder endpoints */
import { z } from 'zod';

export const CreateFolderSchema = z
  .object({
    folderName: z.string().min(1).max(100).trim(),
    parentFolderId: z.string().optional(),
  })
  .strict();

export type CreateFolderInput = z.infer<typeof CreateFolderSchema>;

export const UpdateFolderSchema = z
  .object({
    folderName: z.string().min(1).max(100).trim(),
  })
  .strict();

export type UpdateFolderInput = z.infer<typeof UpdateFolderSchema>;

export const MoveDocumentSchema = z
  .object({
    documentId: z.string().min(1),
    targetFolderId: z.string().min(1),
  })
  .strict();

export type MoveDocumentInput = z.infer<typeof MoveDocumentSchema>;
