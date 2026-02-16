import { Prop } from '@nestjs/mongoose';
import { generateId } from '../utils/nanoid';

export class BaseEntity {
    @Prop({ required: true, default: () => generateId() })
    _id: string;

    // Timestamps added automatically by MongoDB when timestamps: true
    createdAt?: Date;
    updatedAt?: Date;
};