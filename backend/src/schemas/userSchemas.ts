/** userSchemas.ts — Zod schemas for user / admin endpoints */
import { z } from 'zod';

export const AdminUpdateUserSchema = z
  .object({
    status: z.enum(['ACTIVE', 'DISABLED']),
  })
  .strict();

export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserSchema>;

export const AdminListUsersQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(60)),
  paginationToken: z.string().optional(),
  search: z.string().max(200).optional(),
});

export type AdminListUsersQuery = z.infer<typeof AdminListUsersQuerySchema>;
