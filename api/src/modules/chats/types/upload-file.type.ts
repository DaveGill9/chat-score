import { z } from 'zod';

// Zod schema for uploading a file
export const UploadFileSchema = z.object({
  key: z.string().trim().min(1).max(255),
});

// Export the DTO type from the Zod schema
export type UploadFile = z.infer<typeof UploadFileSchema>;
