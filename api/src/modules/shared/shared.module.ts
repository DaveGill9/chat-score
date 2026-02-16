import { Module } from '@nestjs/common';
import { DocumentIntelligenceService } from 'src/modules/shared/services/document-intelligence.service';
import { SearchService } from 'src/modules/shared/services/search.service';
import { StorageService } from 'src/modules/shared/services/storage.service';
import { OpenAIService } from 'src/modules/shared/services/openai.service';
import { RetryService } from 'src/modules/shared/services/retry.service';
import { EventLogsModule } from '../event-logs/event-logs.module';

@Module({
  imports: [
    EventLogsModule,
  ],
  providers: [
    DocumentIntelligenceService,
    SearchService,
    StorageService,
    OpenAIService,
    RetryService,
  ],
  exports: [
    DocumentIntelligenceService,
    SearchService,
    StorageService,
    OpenAIService,
    RetryService,
  ],
})
export class SharedModule {}

