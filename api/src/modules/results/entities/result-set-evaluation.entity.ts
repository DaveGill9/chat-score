import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from 'src/types/base-entity.type';

export type ResultSetEvaluationDocument = HydratedDocument<ResultSetEvaluation>;

@Schema({
  timestamps: true,
  collection: 'evaluations',
})
export class ResultSetEvaluation extends BaseEntity {
  @Prop({ required: true, index: true })
  resultSetId: string;

  @Prop({ trim: true })
  summary?: string;

  @Prop()
  whatWentWell?: string[];

  @Prop()
  whatWentWrong?: string[];

  @Prop()
  patterns?: string[];

  @Prop()
  suggestions?: string[];

  @Prop()
  promptChanges?: string[];

  @Prop({ type: Object })
  raw?: Record<string, unknown>;
}

export const ResultSetEvaluationSchema =
  SchemaFactory.createForClass(ResultSetEvaluation);

ResultSetEvaluationSchema.index({ resultSetId: 1 }, { unique: true });
