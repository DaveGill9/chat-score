import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from 'src/types/base-entity.type';

export type ChatDocument = HydratedDocument<Chat>;

@Schema({ 
  timestamps: true, 
  collection: 'chats'
})
export class Chat extends BaseEntity {

  @Prop({ 
    required: true,
    trim: true,
    maxlength: 100
  })
  userId: string;

  @Prop({ 
    required: true,
    trim: true,
    maxlength: 200
  })
  title: string;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);

// Compound indexes for common query patterns
ChatSchema.index({ userId: 1 });
ChatSchema.index({ createdAt: -1 });
ChatSchema.index({ updatedAt: -1 });

// Text index for title search
ChatSchema.index({ title: 'text' });

