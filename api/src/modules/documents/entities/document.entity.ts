import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from 'src/types/base-entity.type';
import { DocumentStatus } from '../enums/document-status.enum';

export type DocumentDocument = HydratedDocument<Document>;

@Schema({
  timestamps: true,
  collection: 'documents',
})
export class Document extends BaseEntity {
  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
  })
  userId: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 200,
  })
  fileName: string;

  @Prop({
    default: 0,
  })
  pageCount: number;

  @Prop({
    trim: true,
    maxlength: 2500,
  })
  summary: string;

  @Prop({
    required: true,
    default: 0,
  })
  tokenCount: number;

  @Prop({
    type: String,
    enum: DocumentStatus,
    default: DocumentStatus.PENDING,
    required: true,
  })
  status: DocumentStatus;
}

export const DocumentSchema = SchemaFactory.createForClass(Document);

// Compound indexes for common query patterns
DocumentSchema.index({ userId: 1 });
DocumentSchema.index({ createdAt: -1 });
DocumentSchema.index({ updatedAt: -1 });
DocumentSchema.index({ status: 1 });

// Text index for title search
DocumentSchema.index({ fileName: 'text', summary: 'text' });
