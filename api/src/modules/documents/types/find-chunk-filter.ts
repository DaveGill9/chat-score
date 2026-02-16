import { z } from 'zod';

export const FindChunkFilterSchema = z.object({
  id: z.string().trim().min(1),
  pageNumber: z.coerce.number().int().positive(),
});

export type FindChunkFilter = z.infer<typeof FindChunkFilterSchema>;

