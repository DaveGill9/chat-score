import { Module } from '@nestjs/common';
import { DocumentsService } from './services/documents.service';
import { Document, DocumentSchema } from './entities/document.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentsController } from './controllers/documents.controller';
import { EventLogsModule } from '../event-logs/event-logs.module';
import { QueueService } from './services/queue.service';
import { SharedModule } from '../shared/shared.module';
import { SocketModule } from '../socket/socket.module';
import { AnalyzeService } from './services/analyze.service';
import { PreviewsService } from './services/previews.service';
import { SummaryService } from './services/summary.service';
import { ImageService } from './services/image.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Document.name, schema: DocumentSchema }
    ]),
    EventLogsModule,
    SocketModule,
    SharedModule,
  ],
  controllers: [
    DocumentsController,    
  ],
  providers: [
    AnalyzeService,
    DocumentsService,
    ImageService,
    PreviewsService,
    SummaryService,
    QueueService,
  ],
  exports: [DocumentsService]
})
export class DocumentsModule {}

