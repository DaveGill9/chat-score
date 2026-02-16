import { z } from 'zod';

// Zod schema for updating a chat
export const UpdateChatSchema = z.object({
  title: z.string().trim().max(200).min(1).optional(),
  uploads: z.array(z.string().trim().max(100).min(1)).optional(),
});

// Export the DTO type from the Zod schema
export type UpdateChat = z.infer<typeof UpdateChatSchema>;
