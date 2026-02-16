import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ChatStreamService } from './services/chat-stream.service';
import { ChatsService } from './services/chats.service';
import { ChatMessageService } from './services/chat-message.service';
import { Chat, ChatSchema } from './entities/chat.entity';
import { ChatMessage, ChatMessageSchema } from './entities/chat-message.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { EventLogsModule } from '../event-logs/event-logs.module';
import { SharedModule } from '../shared/shared.module';
import { ChatsController } from './controllers/chats.controller';
  
@Module({   
  imports: [
    MongooseModule.forFeature([
        { name: Chat.name, schema: ChatSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema }
    ]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
    EventLogsModule,
    SharedModule,
  ],
  controllers: [
    ChatsController,    
  ],
  providers: [
    ChatsService,
    ChatMessageService,
    ChatStreamService,
  ],
  exports: [
    ChatsService, 
    ChatMessageService,
    ChatStreamService
  ]
})
export class ChatsModule {}
