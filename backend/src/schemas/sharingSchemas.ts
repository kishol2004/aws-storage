/** sharingSchemas.ts — Zod schemas for sharing endpoints */
import { z } from 'zod';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ShareDocumentSchema = z
  .object({
    recipientEmail: z
      .string()
      .regex(EMAIL_RE, 'Invalid email address')
      .max(254)
      .toLowerCase(),
    permission: z.enum(['VIEW', 'DOWNLOAD', 'EDIT']),
    expiresAt: z
      .number()
      .int()
      .positive()
      .optional(), // Unix timestamp in seconds
  })
  .strict();

export type ShareDocumentInput = z.infer<typeof ShareDocumentSchema>;

export const UpdateShareSchema = z
  .object({
    permission: z.enum(['VIEW', 'DOWNLOAD', 'EDIT']),
  })
  .strict();

export type UpdateShareInput = z.infer<typeof UpdateShareSchema>;
