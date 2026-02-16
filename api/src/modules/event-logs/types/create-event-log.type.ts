import { z } from 'zod';
import { LogLevel } from '../enums/log-level.enum';
import { LogGroup } from '../enums/log-group.enum';

// Zod schema for creating an event log
export const CreateEventLogSchema = z.object({
  level: z.enum(Object.values(LogLevel) as [string, ...string[]]),
  group: z.enum(Object.values(LogGroup) as [string, ...string[]]),
  message: z.string().trim().min(1),
  stackTrace: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

// Export the type from the Zod schema
export type CreateEventLog = z.infer<typeof CreateEventLogSchema>;
