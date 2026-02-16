import { z } from 'zod';

// Zod schema for finding chats filter
export const FindChatsFilterSchema = z.object({
  userId: z.string().trim().max(100).optional(),
  keywords: z.string().trim().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// Export the DTO type from the Zod schema
export type FindChatsFilter = z.infer<typeof FindChatsFilterSchema>;