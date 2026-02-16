import { z } from 'zod';

// Zod schema for creating a chat
export const CreateChatFeedbackSchema = z.object({
  chatId: z.string().trim().max(100).min(1),
  messageId: z.string().trim().max(100).min(1),
  sentiment: z.enum(['good', 'bad']).optional(),
  comments: z.string().trim().max(1000).optional(),
});

// Export the DTO type from the Zod schema
export type CreateChatFeedback = z.infer<typeof CreateChatFeedbackSchema>;
