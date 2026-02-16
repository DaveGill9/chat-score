import { Module } from '@nestjs/common';
import { EventLogsService } from './services/event-logs.service';
import { EventLogsController } from './controllers/event-logs.controller';
import { EventLog, EventLogSchema } from './entities/event-log.entity'; 
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: EventLog.name, schema: EventLogSchema }] ),
  ],
  controllers: [EventLogsController],
  providers: [EventLogsService],
  exports: [EventLogsService],
})
export class EventLogsModule {}
