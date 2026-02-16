import { z } from 'zod';

// Zod schema for finding chat messages filter
export const FindChatMessagesFilterSchema = z.object({
    userId: z.string().trim().min(1).max(21).optional(),
    offset: z.coerce.number().int().min(0).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.enum(['asc', 'desc']).optional(),
});

// Export the DTO type from the Zod schema
export type FindChatMessagesFilter = z.infer<typeof FindChatMessagesFilterSchema>;
