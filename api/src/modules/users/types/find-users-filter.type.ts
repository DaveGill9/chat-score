import { z } from 'zod';

export const FindUsersFilterSchema = z.object({
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  keywords: z.string().trim().max(100).optional(),
});

export type FindUsersFilter = z.infer<typeof FindUsersFilterSchema>;