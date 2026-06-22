import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../users';

type MockChatbotRequest = {
  message?: unknown;
  threadId?: unknown;
  [key: string]: unknown;
};

@Controller('demo')
@Public()
export class DemoController {
  @Post('mock-chatbot')
  @HttpCode(HttpStatus.OK)
  reply(@Body() body: MockChatbotRequest = {}) {
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const incomingThreadId = typeof body.threadId === 'string' ? body.threadId.trim() : '';
    const threadId = incomingThreadId || `mock-thread-${Date.now()}`;
    const context = Object.fromEntries(
      Object.entries(body).filter(([key]) => key !== 'message' && key !== 'threadId'),
    );

    return {
      answer: this.buildAnswer(message, context),
      threadId,
    };
  }

  private buildAnswer(message: string, context: Record<string, unknown>) {
    const safeMessage = message || 'Hello from ChatQA';
    const contextKeys = Object.keys(context);
    const contextSummary =
      contextKeys.length > 0 ? ` Context received: ${contextKeys.join(', ')}.` : '';

    return `Mock response for "${safeMessage}".${contextSummary}`;
  }
}
