import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { TestScore } from '../types/test.types';

@Injectable()
export class ScoreService {
  private readonly model: string;
  private readonly client: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('OPENAI_API_KEY');
    this.model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
    this.client = new OpenAI({ apiKey });
  }

  async score(input: string, expected: string, actual: string): Promise<TestScore> {
    const prompt = `
You are grading a chatbot response.

Input:
${input}

Expected:
${expected}

Actual:
${actual}

Return JSON ONLY:
{
  "score": number,     // 0 to 1
  "reasoning": string // max 2 sentences
}

Scoring guide:
- 1.0 = fully correct
- 0.7 = mostly correct
- 0.4 = partially correct
- 0.0 = incorrect
`;

    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = resp.choices[0].message.content;
    if (!content) throw new Error('Score returned empty response');

    let parsed: { score?: number; reasoning?: string };
    try {
      parsed = JSON.parse(content) as { score?: number; reasoning?: string };
    } catch {
      throw new Error(`Score did not return valid JSON:\n${content}`);
    }

    return {
      score: Math.max(0, Math.min(1, parsed.score ?? 0)),
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
  }
}
