import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, Res, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import type { Express, Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatsService } from '../services/chats.service';
import { ZodValidationPipe } from 'src/pipes/zod-validation.pipe';
import { ChatMessage } from '../entities/chat-message.entity';
import { CurrentUser } from 'src/modules/users/decorators/current-user.decorator';
import { User } from 'src/modules/users/entities/user.entity';
import { type FindChatsFilter, FindChatsFilterSchema } from '../types/find-chats-filter.type';
import { type UploadFile, UploadFileSchema } from '../types/upload-file.type';
import { type ListChat, ListChatProjection } from '../types/list-chat.type';
import { type UploadFileResponse } from '../types/upload-file-response.type';
import { type FindChatMessagesFilter, FindChatMessagesFilterSchema } from '../types/find-chat-messages-filter.type';
import { type CreateChatFeedback, CreateChatFeedbackSchema } from '../types/create-chat-feedback.type';
import { type FindChatFilter, FindChatFilterSchema } from '../types/find-chat-filter.type';
import { ChatMessageService } from '../services/chat-message.service';
import { Chat } from '../entities/chat.entity';
import { StorageService } from 'src/modules/shared/services/storage.service';
import { type CreateChatMessage, CreateChatMessageSchema } from '../types/create-chat-message.type';
import { ChatStreamService } from '../services/chat-stream.service';

@Controller('chats')
export class ChatsController {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly chatMessageService: ChatMessageService,
    private readonly azureStorageService: StorageService,
    private readonly chatStreamService: ChatStreamService,
  ) { }

  @Post('send')
  async sendMessage(
    @Body(new ZodValidationPipe(CreateChatMessageSchema)) createChatDto: CreateChatMessage,
    @CurrentUser() currentUser: User,
    @Res() res: Response,
    @Req() req: Request
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let closed = false;

    const safeWrite = (data: string): void => {
      if (!closed && !res.writableEnded) {
        res.write(data);
      }
    };

    try {
      const runner = await this.chatStreamService.process(currentUser, createChatDto);

      runner.emitter.on('text-delta', (text) => {
        safeWrite(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
      });

      runner.emitter.on('status', (status) => {
        safeWrite(`data: ${JSON.stringify({ type: 'status', status })}\n\n`);
      });

      runner.emitter.on('chat-title', (title) => {
        safeWrite(`data: ${JSON.stringify({ type: 'title', title })}\n\n`);
      });

      runner.emitter.on('end', () => {
        if (!closed && !res.writableEnded) {
          closed = true;
          res.end();
        }
      });

      req.on('close', () => {
        closed = true;
        runner.emitter.removeAllListeners();
        runner.abort();
      });

      res.on('error', () => {
        closed = true;
        runner.emitter.removeAllListeners();
        runner.abort();
      });
    } catch (err) {
      if (!closed && !res.writableEnded) {
        const message = err instanceof Error ? err.message : 'Stream failed';
        res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
        res.end();
      }
    }
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body(new ZodValidationPipe(UploadFileSchema)) body: UploadFile
  ): Promise<UploadFileResponse> {
    const fileExtension = (file.originalname.split('.').pop() || '').trim().toLowerCase();
    if (!['pdf', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'txt', 'csv'].includes(fileExtension)) {
      throw new BadRequestException('Only images, plain text or CSV files, PDFs and DOCX files are supported');
    }
    const objectKey = await this.chatsService.uploadFile(file, body.key);
    return { key: body.key, objectKey };
  }

  @Get('history')
  async fetchHistory(
    @Query(new ZodValidationPipe(FindChatsFilterSchema)) filter: FindChatsFilter,
    @CurrentUser() currentUser: User,
  ): Promise<ListChat[]> {
    filter.userId = currentUser._id;
    return await this.chatsService.findMany<ListChat>(filter, ListChatProjection);
  }

  @Get(':chatId/messages')
  async findChatMessages(
    @Param(new ZodValidationPipe(FindChatFilterSchema)) chatFilter: FindChatFilter,
    @Query(new ZodValidationPipe(FindChatMessagesFilterSchema)) chatMessagesFilter: FindChatMessagesFilter,
    @CurrentUser() currentUser: User
  ): Promise<ChatMessage[]> {
    const chat = await this.chatsService.findOne<Chat>(chatFilter.chatId);
    if (!chat || chat.userId !== currentUser._id) {
      return [];
    }
    const messages = await this.chatMessageService.findMany<ChatMessage>(chatFilter.chatId, chatMessagesFilter);

    // replace images with signed urls
    const baseUrl = this.azureStorageService.storageEndpoint;
    const escapedBaseUrl = baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escapedBaseUrl}/documents/([^?")\\s]+)(?:\\?[^")\\s]*)?`, 'g');
    messages.forEach(message => {
      if (message.content && typeof message.content === 'string') {
        message.content = message.content.replace(regex, (_, blobName) => {
          return this.azureStorageService.generateSignedUrl(blobName, 'documents');
        });
      }
    });
    // reverse sort order to support pagination
    return messages.reverse();
  }

  @Post(':chatId/feedback')
  async addFeedback(
    @Param(new ZodValidationPipe(FindChatFilterSchema)) chatFilter: FindChatFilter,
    @Body(new ZodValidationPipe(CreateChatFeedbackSchema)) createFeedbackDto: CreateChatFeedback,
    @CurrentUser() currentUser: User
  ): Promise<ChatMessage> {
    const exists = await this.chatsService.exists(chatFilter.chatId, currentUser._id);
    if (!exists) {
      throw new NotFoundException("Chat not found");
    }

    const updatedMessage = await this.chatMessageService.update(createFeedbackDto.messageId, {
      sentiment: createFeedbackDto.sentiment,
      comments: createFeedbackDto.comments,
    });

    if (!updatedMessage) {
      throw new NotFoundException("Chat message not found");
    }

    return updatedMessage;
  }
}
