import { z } from 'zod';

// Zod schema for socket response
export const SocketResponseSchema = z.object({
  status: z.enum(['ok', 'error', 'validation_error']),
  message: z.string().optional(),
  issues: z.array(z.string()).optional(),
  timestamp: z.number(),
});

// Export the type from the Zod schema
export type SocketResponse = z.infer<typeof SocketResponseSchema>;