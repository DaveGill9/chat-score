import { Global, Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './sockets.service';
import { UsersModule } from '../users/users.module';
import { ChatsModule } from '../chats/chats.module';

@Global()
@Module({
    imports: [
      UsersModule,
      ChatsModule,
    ],
    controllers: [ ],
    providers: [ 
      SocketGateway, 
      SocketService,
    ],
    exports: [SocketService],
  })
export class SocketModule {}
