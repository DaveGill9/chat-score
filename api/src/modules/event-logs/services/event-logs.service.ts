import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventLog, EventLogDocument } from '../entities/event-log.entity';
import { CreateEventLog } from '../types/create-event-log.type';
import { FindEventLogsFilter } from '../types/find-event-logs-filter.type';
import { Projection } from 'src/types/projection.type';

@Injectable()
export class EventLogsService {

  constructor(
    @InjectModel(EventLog.name) private eventLogModel: Model<EventLogDocument>
  ) {}

  async createOne(data: CreateEventLog): Promise<EventLog> {
    const eventLog = new this.eventLogModel(data);
    return await eventLog.save();
  }

  async createMany(data: CreateEventLog[]): Promise<EventLog[]> {
    const result = await this.eventLogModel.insertMany(data);
    return result.map(r => r.toObject() as EventLog);
  }

  async findOne<T>(_id: string, select?: Projection): Promise<T | null> {
    const filter = { _id: { $eq: _id } };
    return await this.eventLogModel.findOne(filter).select(select || {}).lean<T>();
  }

  async findMany<T>(filter: FindEventLogsFilter, select?: Projection): Promise<T[]> {
    const criteria: Record<string, unknown> = {};

    if (filter.level) {
      criteria.level = filter.level;
    }

    if (filter.group) {
      criteria.group = filter.group;
    }

    if (filter.keywords && filter.keywords.length > 0) {
      criteria.$text = { $search: filter.keywords };
    }

    return await this.eventLogModel
      .find(criteria)
      .select(select || {})
      .sort({ createdAt: -1 })
      .skip(filter.offset || 0)
      .limit(filter.limit || 50)
      .lean<T[]>();
  }
}