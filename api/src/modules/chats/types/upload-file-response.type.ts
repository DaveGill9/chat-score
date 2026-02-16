import { z } from 'zod';

// Zod schema for uploading a file response
export const UploadFileResponseSchema = z.object({
  key: z.string().trim().min(1).max(255),
  objectKey: z.string().trim().min(1).max(255),
});

// Export the DTO type from the Zod schema
export type UploadFileResponse = z.infer<typeof UploadFileResponseSchema>;
