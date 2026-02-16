import { z } from 'zod';

export const FindDocumentsFilterSchema = z.object({
  userId: z.string().trim().max(100).optional(),
  keywords: z.string().trim().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type FindDocumentsFilter = z.infer<typeof FindDocumentsFilterSchema>;

