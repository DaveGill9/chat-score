import { z } from 'zod';
import { ChatMessageStatus } from '../enums/chat-message-status.enum';

// Zod schema for updating a chat message
export const UpdateChatMessageSchema = z.object({
  content: z.string().trim().optional(),
  sentiment: z.enum(['good', 'bad']).optional(),
  comments: z.string().trim().max(1000).optional(),
  status: z.enum(Object.values(ChatMessageStatus) as [string, ...string[]]).optional(),
});

// Export the DTO type from the Zod schema
export type UpdateChatMessage = z.infer<typeof UpdateChatMessageSchema>;

