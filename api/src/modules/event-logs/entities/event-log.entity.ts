
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { LogLevel } from '../enums/log-level.enum';
import { LogGroup } from '../enums/log-group.enum';
import { BaseEntity } from 'src/types/base-entity.type';

export type EventLogDocument = HydratedDocument<EventLog>;

@Schema({ 
  timestamps: true, 
  collection: 'event_logs'
})
export class EventLog extends BaseEntity {

  @Prop({ 
    required: true,
    enum: Object.values(LogGroup),
    default: LogGroup.GENERAL
  })
  group: LogGroup;

  @Prop({ 
    required: true,
    enum: Object.values(LogLevel),
    default: LogLevel.INFO
  })
  level: LogLevel;

  @Prop({ 
    required: true,
    trim: true,
    maxlength: 1000
  })
  message: string;

  @Prop({ 
    trim: true,
    maxlength: 5000
  })
  stackTrace?: string;

  @Prop({ 
    type: Object,
    default: {}
  })
  properties: Record<string, unknown>;
}

export const EventLogSchema = SchemaFactory.createForClass(EventLog);

// Compound indexes for common query patterns
EventLogSchema.index({ createdAt: -1 });
EventLogSchema.index({ level: 1, createdAt: -1 });
EventLogSchema.index({ group: 1, createdAt: -1 });

// Text index for message search
EventLogSchema.index({ message: 'text', stackTrace: 'text' });

// TTL index for automatic cleanup of old logs (30 days)
EventLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });
