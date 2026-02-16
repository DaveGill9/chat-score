import { z } from 'zod';

// Zod schema for creating a chat
export const CreateChatSchema = z.object({
  _id: z.string().trim().max(100).min(1),
  userId: z.string().trim().max(100).min(1),
  title: z.string().trim().max(200).min(1),
});

// Export the DTO type from the Zod schema
export type CreateChat = z.infer<typeof CreateChatSchema>;
