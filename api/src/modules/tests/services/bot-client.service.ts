import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TestRow } from '../types/test.types';

export type ChatResponse = {
  answer: string;
  threadId?: string;
};

@Injectable()
export class BotClientService {
  private readonly endpointUrl: string;
  private readonly apiKey: string;
  private readonly inputField: string;
  private readonly answerField: string;
  private readonly threadIdField: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.endpointUrl = this.configService.getOrThrow<string>('CHATBOT_URL');
    this.apiKey = this.configService.getOrThrow<string>('EVAL_API_KEY');
    this.inputField = this.configService.get<string>('CHATBOT_FIELD', 'message');
    this.answerField = this.configService.get<string>('CHATBOT_ANSWER_FIELD', 'answer');
    this.threadIdField = this.configService.get<string>('CHATBOT_THREAD_ID_FIELD', 'threadId');
    this.timeoutMs = this.getPositiveIntConfig('CHATBOT_TIMEOUT_MS', 60000);
  }

  getExtras(row: TestRow): Record<string, unknown> {
    return this.getRequestContext(row);
  }

  getRequestContext(row: TestRow): Record<string, unknown> {
    const { id, input, expected, actual, score, reasoning, ...extras } = row;
    return extras;
  }

  async callEndpoint(row: TestRow): Promise<ChatResponse> {
    return this.post(this.buildRequestBody(row.input, this.getRequestContext(row)));
  }

  async sendFollowup(
    message: string,
    threadId: string | undefined,
    extras: Record<string, unknown>,
  ): Promise<ChatResponse> {
    return this.post(this.buildRequestBody(message, extras, threadId));
  }

  private buildRequestBody(
    message: string,
    extras: Record<string, unknown>,
    threadId?: string,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      ...extras,
      [this.inputField]: message,
    };
    if (threadId) {
      body[this.threadIdField] = threadId;
    }
    return body;
  }

  private getPositiveIntConfig(key: string, fallback: number): number {
    const value = parseInt(String(this.configService.get(key) ?? fallback), 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private parseResponse(text: string): ChatResponse {
    try {
      const json = JSON.parse(text);
      const answer =
        json?.[this.answerField] ??
        json?.answer ??
        json?.output ??
        json?.message;
      const threadId = json?.[this.threadIdField] ?? json?.threadId;
      return {
        answer: typeof answer === 'string' ? answer : JSON.stringify(json),
        threadId: typeof threadId === 'string' ? threadId : undefined,
      };
    } catch {
      return { answer: text };
    }
  }

  private async post(body: Record<string, unknown>): Promise<ChatResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Chatbot endpoint returned ${res.status}: ${text}`);
      }
      return this.parseResponse(text);
    } finally {
      clearTimeout(timeout);
    }
  }
}
