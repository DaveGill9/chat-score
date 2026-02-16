import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ZodValidationPipe } from 'src/pipes/zod-validation.pipe';
import { EventLogsService } from '../services/event-logs.service';
import { type FindEventLogsFilter, FindEventLogsFilterSchema } from '../types/find-event-logs-filter.type';
import { type CreateEventLog, CreateEventLogSchema } from '../types/create-event-log.type';
import { EventLog } from '../entities/event-log.entity';
import { ListEventLog, ListEventLogProjection } from '../types/list-event-log.type';
import { type IdParam, IdParamSchema } from 'src/types/id-param.type';

@Controller('event-logs')
export class EventLogsController {
  constructor(private readonly eventLogsService: EventLogsService) {}

  @Post()
  async createOne(@Body(new ZodValidationPipe(CreateEventLogSchema)) payload: CreateEventLog): Promise<EventLog> {
    return await this.eventLogsService.createOne(payload);
  }

  @Post('bulk')
  async createMany(@Body(new ZodValidationPipe(CreateEventLogSchema)) payload: CreateEventLog[]): Promise<EventLog[]> {
    return await this.eventLogsService.createMany(payload);
  }

  @Get(':id')
  async findOne(@Param(new ZodValidationPipe(IdParamSchema)) params: IdParam): Promise<EventLog | null> {
    return await this.eventLogsService.findOne<EventLog>(params.id);
  }

  @Get()
  async findMany(@Query(new ZodValidationPipe(FindEventLogsFilterSchema)) filter: FindEventLogsFilter): Promise<ListEventLog[]> {
    return await this.eventLogsService.findMany<ListEventLog>(filter, ListEventLogProjection);
  }
}
