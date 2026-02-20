import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Express } from 'express';
import { TestSet } from '../entities/test-set.entity';
import { TestCase } from '../entities/test-case.entity';
import { TestRun } from '../entities/test-run.entity';
import { Result } from '../entities/result.entity';
import type { TestRow } from '../types/test.types';
import { ParserService } from './parser.service';
import { BotClientService } from './bot-client.service';
import { ScoreService } from './score.service';

@Injectable()
export class TestsService {
  constructor(
    @InjectModel(TestSet.name) private readonly testSetModel: Model<TestSet>,
    @InjectModel(TestCase.name) private readonly testCaseModel: Model<TestCase>,
    @InjectModel(TestRun.name) private readonly testRunModel: Model<TestRun>,
    @InjectModel(Result.name) private readonly resultModel: Model<Result>,
    private readonly parserService: ParserService,
    private readonly botClientService: BotClientService,
    private readonly scoreService: ScoreService,
  ) {}

  async uploadTestSet(file: Express.Multer.File, meta: { name?: string; project?: string }) {
    const rows = this.parserService.parseTestRowsBuffer(file.buffer, file.originalname);

    const setName = meta.name?.trim() || file.originalname;
    const createdSet = await this.testSetModel.create({
      name: setName,
      filename: file.originalname,
      project: meta.project?.trim() || undefined,
    });

    const cases = rows.map((row: TestRow, index) => {
      const { id, input, expected, actual, score, reasoning, ...extras } = row;
      return {
        testSetId: String(createdSet._id),
        id: String(id || index + 1),
        input: String(input),
        expected: String(expected),
        additionalContext: extras,
      };
    });

    if (cases.length > 0) {
      await this.testCaseModel.insertMany(cases);
    }

    return {
      testSetId: createdSet._id,
      name: createdSet.name,
      filename: createdSet.filename,
      project: createdSet.project ?? null,
      testCaseCount: cases.length,
    };
  }

  async listTestSets(filter?: { keywords?: string; offset?: number; limit?: number }) {
    const keywords = filter?.keywords?.trim();
    const offset = Math.max(0, filter?.offset ?? 0);
    const limit = Math.max(1, Math.min(500, filter?.limit ?? 200));

    const query = keywords
      ? {
          $or: [
            { name: { $regex: keywords, $options: 'i' } },
            { filename: { $regex: keywords, $options: 'i' } },
            { project: { $regex: keywords, $options: 'i' } },
          ],
        }
      : {};

    const sets = await this.testSetModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const setIds = sets.map((set) => set._id);
    const setIdStrings = setIds.map((id) => String(id));
    const counts = setIds.length
      ? await this.testCaseModel.aggregate<{ _id: unknown; testCaseCount: number }>([
          {
            $match: {
              $or: [{ testSetId: { $in: setIdStrings } }, { testSetId: { $in: setIds as unknown[] } }],
            },
          },
          { $group: { _id: '$testSetId', testCaseCount: { $sum: 1 } } },
        ])
      : [];

    const countBySetId = new Map(counts.map((item) => [String(item._id), item.testCaseCount]));

    return sets.map((set) => ({
      ...set,
      testCaseCount: countBySetId.get(String(set._id)) ?? 0,
    }));
  }

  async getTestSet(testSetId: string) {
    const set = await this.testSetModel.findById(testSetId).lean();
    if (!set) {
      throw new NotFoundException('Test set not found');
    }

    const cases = await this.testCaseModel
      .find({ testSetId: { $in: [String(set._id), set._id as unknown] } })
      .sort({ createdAt: 1 })
      .lean();

    return {
      ...set,
      testCaseCount: cases.length,
      cases,
    };
  }

  async runTestSet(testSetId: string) {
    const set = await this.testSetModel.findById(testSetId).lean();
    if (!set) {
      throw new NotFoundException('Test set not found');
    }

    const cases = await this.testCaseModel
      .find({ testSetId: { $in: [String(set._id), set._id as unknown] } })
      .sort({ createdAt: 1 })
      .lean();

    if (cases.length === 0) {
      throw new BadRequestException('No test cases found in this test set');
    }

    const run = await this.testRunModel.create({
      testSetId: set._id,
      status: 'running',
    });

    let successCount = 0;
    let failedCount = 0;

    try {
      for (const testCase of cases) {
        const row = this.toTestRow(testCase);
        try {
          const chat = await this.botClientService.callEndpoint(row);
          const actual = chat.answer;
          const score = await this.scoreService.score(row.input, row.expected, actual);

          await this.resultModel.create({
            testRunId: run._id,
            testCaseId: testCase._id,
            actual,
            score: score.score,
            reasoning: score.reasoning,
          });
          successCount++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await this.resultModel.create({
            testRunId: run._id,
            testCaseId: testCase._id,
            actual: '',
            score: 0,
            reasoning: `ERROR: ${message}`,
          });
          failedCount++;
        }
      }

      await this.testRunModel.updateOne(
        { _id: run._id },
        { status: 'completed', completedAt: new Date() },
      );
    } catch (error) {
      await this.testRunModel.updateOne(
        { _id: run._id },
        { status: 'failed', completedAt: new Date() },
      );
      throw error;
    }

    return {
      testRunId: run._id,
      testSetId: set._id,
      status: 'completed',
      total: cases.length,
      successCount,
      failedCount,
    };
  }

  async listRunsForSet(testSetId: string) {
    const runs = await this.testRunModel
      .find({ testSetId })
      .sort({ createdAt: -1 })
      .lean();
    return runs;
  }

  async getRun(testRunId: string) {
    const run = await this.testRunModel.findById(testRunId).lean();
    if (!run) {
      throw new NotFoundException('Test run not found');
    }
    return run;
  }

  async getRunRows(testRunId: string): Promise<TestRow[]> {
    const run = await this.testRunModel.findById(testRunId).lean();
    if (!run) {
      throw new NotFoundException('Test run not found');
    }

    const cases = await this.testCaseModel
      .find({ testSetId: { $in: [String(run.testSetId), run.testSetId as unknown] } })
      .sort({ createdAt: 1 })
      .lean();

    const results = await this.resultModel
      .find({ testRunId: run._id })
      .lean();

    const resultByCaseId = new Map<string, Result>(
      results.map(result => [String(result.testCaseId), result]),
    );

    return cases.map((testCase) => {
      const baseRow = this.toTestRow(testCase);
      const result = resultByCaseId.get(String(testCase._id));
      return {
        ...baseRow,
        actual: result?.actual ?? '',
        score: result?.score ?? 0,
        reasoning: result?.reasoning ?? '',
      };
    });
  }

  buildRowsFile(rows: TestRow[], format: 'csv' | 'xlsx') {
    if (format === 'xlsx') {
      return this.parserService.toXlsxBuffer(rows, 'Results');
    }
    return this.parserService.toCsvBuffer(rows);
  }

  private toTestRow(testCase: TestCase): TestRow {
    const extras =
      testCase.additionalContext && typeof testCase.additionalContext === 'object'
        ? testCase.additionalContext
        : {};

    return {
      id: String(testCase.id),
      input: String(testCase.input),
      expected: String(testCase.expected),
      ...(extras as Record<string, unknown>),
    };
  }
}
