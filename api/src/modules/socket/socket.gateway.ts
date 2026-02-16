import { UseGuards } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { SocketsGuard } from '../users/guards/sockets.guard';
import { Socket, Server } from 'socket.io';
import { SocketService } from './sockets.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/enums/roles.enum';
import { ZodError } from 'zod';
import { SocketResponse } from './types/socket-response.type';
import { Roles } from '../users/decorators/roles-decorator';
import { type CreateChatMessage } from '../chats/types/create-chat-message.type';
import { ChatStreamService } from '../chats/services/chat-stream.service';
import { AuthService } from '../users/services/auth.service';

type SocketClient = Socket & { data: { user: User } };

@WebSocketGateway({ cors: { origin: "*" }})
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {

  @WebSocketServer() io: Server;

  constructor(
    private socketService: SocketService, 
    private authService: AuthService,
    private chatStreamService: ChatStreamService,
  ) { }

  afterInit(): void { 
    this.socketService.socket = this.io;
  }

  async handleConnection(client: SocketClient): Promise<void> {
    // find & validate auth token
    const accessToken = client.handshake.auth?.accessToken || '';
    const user = await this.authService.getUserFromToken(accessToken);
    
    // invalid user, disconnect
    if (!user) {
      client.disconnect();
      return;
    }

    // join room
    client.join(user._id);
  }

  async handleDisconnect(client: SocketClient): Promise<void> {
    // find & validate auth token
    const accessToken = client.handshake.auth?.accessToken || '';
    const user = await this.authService.getUserFromToken(accessToken);
    
    // leave rooms if user is valid
    if (user) {
      client.leave(user._id);
    }
  }

  @UseGuards(SocketsGuard)
  @SubscribeMessage("ping")
  async handlePing(): Promise<string> {
    return '👍';
  }

  @UseGuards(SocketsGuard)
  @Roles([Role.USER, Role.ADMINISTRATOR])
  @SubscribeMessage("chat")
  async handleChat(client: SocketClient, payload: CreateChatMessage) {      
    const user: User = client.data.user;
    try {
      const runner = await this.chatStreamService.process(user, payload);
      runner.emitter.on('text-delta', (text) => {
        client.to(user._id).emit('text-delta', { chatId: payload.chatId, text });
      });
      runner.emitter.on('status', (status) => {
        client.to(user._id).emit('status', { chatId: payload.chatId, status });
      });
      runner.emitter.on('chat-title', (title) => {
        client.to(user._id).emit('chat-title', { chatId: payload.chatId, title });
      });
      client.on('close', () => {
        runner.emitter.removeAllListeners();
        runner.abort();
      });
      return this.successResponse();
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  private successResponse(): SocketResponse {
    return {
      status: "ok",
      timestamp: Date.now()
    };
  }

  private errorResponse(error: unknown): SocketResponse {
    if (error instanceof ZodError) {
      return {
        status: "validation_error",
        message: error.message,
        issues: error.issues.map(issue => issue.message),
        timestamp: Date.now()
      };
    }
    if (error instanceof Error) {
      return {
        status: "error",
        message: error.message,
        timestamp: Date.now()
      };
    }
    return {
      status: "error",
      message: 'Unknown error',
      timestamp: Date.now()
    };
  }
}