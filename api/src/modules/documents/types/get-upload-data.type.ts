import { z } from 'zod';

export const GetUploadDataSchema = z.object({
  fileName: z.string().trim().min(1),
});

export type GetUploadData = z.infer<typeof GetUploadDataSchema>;

