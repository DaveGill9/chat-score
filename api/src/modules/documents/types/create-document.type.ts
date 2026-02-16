import { z } from 'zod';

export const CreateDocumentSchema = z.object({
  _id: z.string().trim().max(100).min(1),
  fileName: z.string().trim().max(200).min(1),
});

export type CreateDocument = z.infer<typeof CreateDocumentSchema>;

