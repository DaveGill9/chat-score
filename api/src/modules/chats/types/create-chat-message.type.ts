import { z } from 'zod';
import { ChatMessageRole } from '../enums/chat-message-role.enum';
import { ChatMessageStatus } from '../enums/chat-message-status.enum';

// Zod schema for creating a chat message
export const CreateChatMessageSchema = z.object({
  _id: z.string().trim().max(100).min(1),
  chatId: z.string().trim().max(100).min(1),
  role: z.enum(Object.values(ChatMessageRole) as [string, ...string[]]),
  content: z.string().trim().min(1),
  uploads: z.array(z.string().trim().max(100).min(1)).optional(),
  status: z.enum(Object.values(ChatMessageStatus) as [string, ...string[]]).optional(),
});

// Export the DTO type from the Zod schema
export type CreateChatMessage = z.infer<typeof CreateChatMessageSchema>;
