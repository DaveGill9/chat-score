import {  Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../entities/user.entity';
import { FindUsersFilter } from '../types/find-users-filter.type';
import { Projection } from 'src/types/projection.type';
import { CreateUser } from '../types/create-user.type';

@Injectable()
export class UsersService {

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) { }

  async createOne(data: CreateUser): Promise<User> {
    const user = new this.userModel(data);
    return await user.save();
  }

  async findOne<T>(id: string, select?: Projection): Promise<T | null> {
    const filter = { _id: { $eq: id }};
    return await this.userModel.findOne(filter).select(select || {}).lean<T>();
  }

  async findMany<T>(filter: FindUsersFilter, select?: Projection): Promise<T[]> {
    const criteria: Record<string, unknown> = {};
    
    if (filter.keywords) {
      criteria.$text = { $search: filter.keywords };
    }

    return await this.userModel
      .find(criteria)
      .select(select || {})
      .sort({ displayName: 1 })
      .skip(filter.offset || 0)
      .limit(filter.limit || 50)
      .lean<T[]>();
  }
}
