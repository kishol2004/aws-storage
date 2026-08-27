/** searchSchemas.ts — Zod schemas for search endpoints */
import { z } from 'zod';

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200).trim(),
  fileType: z.string().max(20).optional(),
  category: z.string().max(50).optional(),
  folderId: z.string().optional(),
  from: z.string().optional(), // ISO date string
  to: z.string().optional(),   // ISO date string
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  cursor: z.string().optional(),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
