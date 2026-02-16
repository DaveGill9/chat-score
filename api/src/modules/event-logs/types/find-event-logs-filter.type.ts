import { z } from 'zod';
import { LogGroup } from '../enums/log-group.enum';
import { LogLevel } from '../enums/log-level.enum';

// Zod schema for finding event logs with filters
export const FindEventLogsFilterSchema = z.object({
  level: z.enum(Object.values(LogLevel) as [string, ...string[]]).optional(),
  group: z.enum(Object.values(LogGroup) as [string, ...string[]]).optional(),
  keywords: z.string().trim().optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

// Export the type from the Zod schema
export type FindEventLogsFilter = z.infer<typeof FindEventLogsFilterSchema>;
