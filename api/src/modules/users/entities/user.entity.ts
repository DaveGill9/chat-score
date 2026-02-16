import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from '../enums/roles.enum';
import { BaseEntity } from '../../../types/base-entity.type';

export type UserDocument = HydratedDocument<User>;

@Schema({ 
  timestamps: true, 
  collection: 'users'
})
export class User extends BaseEntity {

  @Prop({ 
    trim: true,
    maxlength: 255
  })
  email: string;

  @Prop({ 
    trim: true,
    maxlength: 100
  })
  displayName: string;

  @Prop({ 
    type: [String],
    enum: Object.values(Role),
    default: [Role.USER]
  })
  roles: Role[];
}

export const UserSchema = SchemaFactory.createForClass(User);

// Compound indexes for common query patterns
UserSchema.index({ email: 1 });
UserSchema.index({ displayName: 1 });
UserSchema.index({ createdAt: -1 });

// Text index for search
UserSchema.index({ email: 'text', displayName: 'text' });