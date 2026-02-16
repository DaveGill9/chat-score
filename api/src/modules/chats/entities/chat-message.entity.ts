import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ChatMessageRole } from '../enums/chat-message-role.enum';
import { ChatMessageSentiment } from '../enums/chat-message-sentiment.enum';
import { BaseEntity } from 'src/types/base-entity.type';
import { ChatMessageStatus } from '../enums/chat-message-status.enum';

export type ChatMessageDocument = HydratedDocument<ChatMessage>;

@Schema({ 
  timestamps: true, 
  collection: 'chat_messages'
})
export class ChatMessage extends BaseEntity {

  @Prop({ 
    required: true,
    trim: true,
    maxlength: 100
  })
  chatId: string;

  @Prop({ 
    required: true,
    enum: Object.values(ChatMessageRole)
  })
  role: ChatMessageRole;

  @Prop({ 
    type: String,
  })
  content: string;

  @Prop({
    type: String,
    enum: Object.values(ChatMessageSentiment),
    default: null,
    required: false
  })
  sentiment: ChatMessageSentiment | null;

  @Prop({
    trim: true,
    maxlength: 1000,
    default: ''
  })
  comments: string;

  @Prop({
    type: [String],
    default: []
  })
  uploads: string[];

  @Prop({
    type: String,
    enum: Object.values(ChatMessageStatus),
    default: null,
    required: true
  })
  status: ChatMessageStatus | null;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

// Compound indexes for common query patterns
ChatMessageSchema.index({ chatId: 1 });
ChatMessageSchema.index({ createdAt: -1 });
ChatMessageSchema.index({ chatId: 1, createdAt: -1 });
ChatMessageSchema.index({ role: 1, createdAt: -1 });

// Text index for keyword search through message content
ChatMessageSchema.index({ content: 'text' });
