import { z } from 'zod';
import { LogLevel } from '../enums/log-level.enum';
import { LogGroup } from '../enums/log-group.enum';
import { Projection } from 'src/types/projection.type';

// Zod schema for creating an event log
export const ListEventLogSchema = z.object({
  _id: z.string().trim().min(1).max(24),
  group: z.enum(Object.values(LogGroup) as [string, ...string[]]),
  level: z.enum(Object.values(LogLevel) as [string, ...string[]]),
  message: z.string().trim().min(1),
  createdAt: z.date(),
});

// Export the type from the Zod schema
export type ListEventLog = z.infer<typeof ListEventLogSchema>;

// Projection for listing event logs
export const ListEventLogProjection: Projection = {
  _id: 1,
  group: 1,
  level: 1,
  message: 1,
  createdAt: 1,
};