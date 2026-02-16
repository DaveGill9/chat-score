import { z } from 'zod';
import { Projection } from 'src/types/projection.type';

// Zod schema for listing chats
export const ListChatSchema = z.object({
  _id: z.string().trim().max(100).min(1),
  title: z.string().trim().max(200).min(1),
  createdAt: z.date().optional(),
});

// Export the DTO type from the Zod schema
export type ListChat = z.infer<typeof ListChatSchema>;

// Projection for listing chats
export const ListChatProjection: Projection = {
  _id: 1,
  title: 1,
  createdAt: 1,
};
