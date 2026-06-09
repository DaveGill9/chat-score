import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import OpenAI from 'openai';
import type { TestRow } from 'src/types/row.types';
import { ResultSetEvaluation } from '../entities/result-set-evaluation.entity';

export type EvaluationResult = {
  summary: string;
  whatWentWell: string[];
  whatWentWrong: string[];
  patterns: string[];
  suggestions: string[];
  promptChanges: string[];
};

@Injectable()
export class EvaluateService {
  private readonly logger = new Logger(EvaluateService.name);
  private readonly model: string;
  private readonly client: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(ResultSetEvaluation.name)
    private readonly evaluationModel: Model<ResultSetEvaluation>,
  ) {
    const apiKey = this.configService.getOrThrow<string>('OPENAI_API_KEY');
    this.model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
    this.client = new OpenAI({ apiKey });
  }

  // Generate and persist a one-time AI summary for a result set.
  async evaluateResultSet(resultSetId: string, rows: TestRow[]): Promise<ResultSetEvaluation | null> {
    if (rows.length === 0) {
      this.logger.warn(`No rows to evaluate for result set ${resultSetId}`);
      return null;
    }

    const existing = await this.evaluationModel.findOne({ resultSetId }).lean();
    if (existing) {
      this.logger.debug(`Evaluation already exists for result set ${resultSetId}`);
      return existing as ResultSetEvaluation;
    }

    try {
      const evalResult = await this.runEvaluation(rows);
      const [doc] = await this.evaluationModel.create([
        {
          resultSetId,
          ...evalResult,
          raw: evalResult,
        },
      ]);
      return doc;
    } catch (error) {
      this.logger.error(`Evaluation failed for result set ${resultSetId}:`, error);
      throw error;
    }
  }

  async getEvaluation(resultSetId: string): Promise<ResultSetEvaluation | null> {
    return this.evaluationModel.findOne({ resultSetId }).lean();
  }

  // Sample the run, prompt the model, and normalize the JSON response.
  private async runEvaluation(rows: TestRow[]): Promise<EvaluationResult> {
    const sampleSize = Math.min(30, rows.length);
    const sample = rows.slice(0, sampleSize);
    const failedRows = rows.filter((r) => (r.score ?? 1) < 0.7);
    const failedSample = failedRows.slice(0, 15);

    const rowsPayload = sample
      .map(
        (r, i) =>
          `[Case ${i + 1}] Input: ${(r.input ?? '').slice(0, 200)}... | Expected: ${(r.expected ?? '').slice(0, 150)}... | Actual: ${(r.actual ?? '').slice(0, 200)}... | Score: ${r.score ?? 0} | Reasoning: ${(r.reasoning ?? '').slice(0, 100)}`,
      )
      .join('\n\n');

    const failedPayload =
      failedSample.length > 0
        ? failedSample
            .map(
              (r, i) =>
                `[Failed ${i + 1}] Input: ${(r.input ?? '').slice(0, 250)} | Expected: ${(r.expected ?? '').slice(0, 150)} | Actual: ${(r.actual ?? '').slice(0, 250)} | Reasoning: ${(r.reasoning ?? '').slice(0, 150)}`,
            )
            .join('\n\n')
        : 'N/A (no failures)';

    const passRate = rows.filter((r) => (r.score ?? 0) >= 0.7).length / rows.length;

    const prompt = `You are analyzing a QA test run for a chatbot. There are ${rows.length} test cases. Pass rate (score >= 0.7): ${(passRate * 100).toFixed(1)}%.

## Sample of all results (first ${sampleSize}):
${rowsPayload}

## Failed cases sample (first ${failedSample.length}):
${failedPayload}

Analyze the results and return a JSON object with these exact keys:
{
  "summary": "2-3 sentence executive summary of how the run performed",
  "whatWentWell": ["item1", "item2", ...],
  "whatWentWrong": ["item1", "item2", ...],
  "patterns": ["specific recurring patterns that were consistently wrong", ...],
  "suggestions": ["general actionable suggestions, such as reviewing knowledge base topic X or adding examples for edge case Y", ...],
  "promptChanges": ["specific chatbot prompt change, written as a concrete instruction or snippet to add/update", ...]
}

Be specific. Reference actual inputs/topics when you see patterns.
Keep "suggestions" focused on process, knowledge, and test-set improvements.
Keep "promptChanges" focused only on concrete changes to the chatbot's system or developer prompt that would address recurring failures.
Return ONLY valid JSON, no markdown.`;

    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = resp.choices[0]?.message?.content;
    if (!content) throw new Error('Evaluation returned empty response');

    let parsed: EvaluationResult;
    try {
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleaned) as EvaluationResult;
    } catch {
      throw new Error(`Evaluation did not return valid JSON:\n${content}`);
    }

    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      whatWentWell: Array.isArray(parsed.whatWentWell) ? parsed.whatWentWell : [],
      whatWentWrong: Array.isArray(parsed.whatWentWrong) ? parsed.whatWentWrong : [],
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      promptChanges: Array.isArray(parsed.promptChanges) ? parsed.promptChanges : [],
    };
  }
}
