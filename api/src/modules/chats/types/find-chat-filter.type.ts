import { z } from 'zod';

// Zod schema for finding a chat
export const FindChatFilterSchema = z.object({
  chatId: z.string().trim().min(21).max(21),
});

// Export the DTO type from the Zod schema
export type FindChatFilter = z.infer<typeof FindChatFilterSchema>;