import OpenAI, { toFile } from 'openai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encoding_for_model, Tiktoken, TiktokenModel } from 'tiktoken';
import { EventLogsService, LogGroup, LogLevel } from 'src/modules/event-logs';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { RetryService } from './retry.service';
import {
  ResponseCreateParamsStreaming,
  ResponseInput,
  ResponseInputImage,
  ResponseUsage,
  Tool,
} from 'openai/resources/responses/responses.js';
import { ImagesResponse } from 'openai/resources/images.js';
import { CreateEmbeddingResponse, EmbeddingCreateParams } from 'openai/resources/embeddings.js';
import axios from 'axios';

export interface OpenAIStreamingResponse {
  type: 'status' | 'text' | 'image' | 'partial_image' | 'usage' | 'finish' | 'file';
  filename?: string;
  text?: string;
  usage?: ResponseUsage;
}

type OpenAIModel = 'gpt-4.1' | 'gpt-4.1-mini' | 'text-embedding-3-large';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateJSONParams {
  model?: OpenAIModel;
  prompt: string;
  base64Images?: string[];
  outputSchema: z.ZodType;
  temperature?: number;
  systemPrompt?: string;
}

export interface GenerateStreamParams {
  model?: OpenAIModel;
  temperature?: number;
  systemPrompt?: string;
  history?: Message[];
  userPrompt: string;
  base64Images?: string[];
  tools?: ExecuteTool[];
}

export type ExecuteTool = Tool & { execute?: (args: Record<string, string>) => Promise<string> };

export interface ToolCall {
  id?: string;
  name: string;
  arguments: string;
  call_id: string;
  response?: string;
}

type Usage = ResponseUsage | CreateEmbeddingResponse.Usage | ImagesResponse.Usage | undefined;

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly embeddingModel: OpenAIModel = 'text-embedding-3-large';
  private readonly embeddingDimensions: number = 1536;
  private tokenizers: Map<OpenAIModel, Tiktoken> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly eventLogsService: EventLogsService,
    private readonly retryService: RetryService,
  ) {
    this.apiKey = this.configService.get<string>('OPENAI_KEY', '');
    this.endpoint = this.configService.get<string>('OPENAI_ENDPOINT', '');

    if (!this.apiKey) {
      this.logger.warn('OpenAI configuration is incomplete');
    }
  }

  getTokenizerForModel(model: OpenAIModel): Tiktoken {
    if (!this.tokenizers.has(model)) {
      this.tokenizers.set(model, encoding_for_model(model as TiktokenModel));
    }
    return this.tokenizers.get(model) as Tiktoken;
  }

  private createOpenAIClient(): OpenAI {
    if (!this.endpoint) {
      // use openai.com
      return new OpenAI({
        apiKey: this.apiKey,
      });
    }

    return new OpenAI({
      apiKey: this.apiKey,
      baseURL: `${this.endpoint}/openai/v1`,
    });
  }

  async generateEmbeddings(input: string[]): Promise<number[][]> {
    const client = this.createOpenAIClient();

    const requestOptions: EmbeddingCreateParams = {
      model: this.embeddingModel,
      encoding_format: 'float',
      dimensions: this.embeddingDimensions,
      input,
    };

    const response = await this.retryService.retry<CreateEmbeddingResponse>(async () => {
      return await client.embeddings.create(requestOptions);
    }, 'generate-embeddings');

    this.logRequest('generate-embeddings', this.embeddingModel, input, '<redacted>', response.usage);

    return response.data.map(item => item.embedding);
  }

  async generateJSON<T>(params: GenerateJSONParams): Promise<T> {
    const {
      model = 'gpt-4.1',
      prompt,
      base64Images = [],
      outputSchema,
      temperature = 0,
      systemPrompt = "Follow the user's instructions and extract the required information from the user's prompt.",
    } = params;

    const input: ResponseInput = [
      { role: 'system', content: this.sanitisePrompt(systemPrompt) },
      { role: 'user', content: this.sanitisePrompt(prompt) },
    ];
    if (base64Images.length > 0) {
      // validate the base64 images
      let finalImages = base64Images.map(image => {
        if (!image.startsWith('data:image')) {
          if (image.startsWith('iVBORw0KGgo')) {
            return `data:image/png;base64,${image}`;
          } else {
            return `data:image/jpeg;base64,${image}`;
          }
        }
        return image;
      });

      const images: ResponseInputImage[] = finalImages.map(image_url => {
        return {
          type: 'input_image',
          image_url,
          detail: 'auto',
        };
      });
      input.push({
        role: 'user',
        content: images,
      });
    }

    const text = {
      format: zodTextFormat(outputSchema, 'output'),
    };
    const client = this.createOpenAIClient();

    const { output, usage } = 
      await this.retryService.retry<{ output: T; usage: ResponseUsage | undefined }>(async () => {
        const { output_parsed, usage } = await client.responses.parse({ model, input, text, temperature });
        return {
          output: output_parsed as T,
          usage,
        };
      }, 'generate-json');

    const message = `generateJSON: ${prompt.substring(0, 50)}`;
    this.logRequest(message, model, input, output, usage);

    return output;
  }

  async *generateStream(params: GenerateStreamParams, abortSignal?: AbortSignal): AsyncGenerator<OpenAIStreamingResponse> {
    const {
      model = 'gpt-4.1',
      systemPrompt = '',
      userPrompt = '',
      history = [],
      base64Images = [],
      tools = [],
      temperature = 0,
    } = params;

    if (systemPrompt === '' && userPrompt === '') {
      throw new Error('System prompt and user prompt cannot both be empty');
    }

    const client = this.createOpenAIClient();

    const requestOptions: ResponseCreateParamsStreaming = {
      model,
      temperature,
      input: [],
      tools: [...tools.map(({ execute, ...tool }) => tool)], // eslint-disable-line @typescript-eslint/no-unused-vars
      stream: true,
    };

    // input
    const input: ResponseInput = [];
    if (systemPrompt) {
      input.push({ role: 'system', content: this.sanitisePrompt(systemPrompt) });
    }
    if (history.length > 0) {
      input.push(...history.map(message => ({ role: message.role, content: message.content })));
    }
    if (userPrompt) {
      input.push({ role: 'user', content: this.sanitisePrompt(userPrompt) });
    }
    if (base64Images.length > 0) {
      const images: ResponseInputImage[] = base64Images.map(image_url => {
        return {
          type: 'input_image',
          image_url,
          detail: 'auto',
        };
      });
      input.push({ role: 'user', content: images });
    }

    // execute llm loop
    let loopCounter = 0;
    let output: string = '';
    let logUsage: ResponseUsage | undefined = undefined;
    while (true) {
      const toolCalls: ToolCall[] = [];

      if (++loopCounter > 10) {
        yield { type: 'finish', text: 'Loop limit reached' };
        break;
      }

      const streamResponse = await this.retryService.retry(
        async () => client.responses.create({ ...requestOptions, input }, { signal: abortSignal }),
        'generate-stream',
      );

      for await (const chunk of streamResponse) {
        
        // #region text response

        if (chunk.type === 'response.output_text.delta' && chunk.delta != null) {
          const text = chunk.delta;
          output += text;
          yield { type: 'text', text };
        }

        // #endregion

        // #region usage

        if ('response' in chunk && chunk.response?.usage != null) {
          const usage = chunk.response.usage as ResponseUsage;
          if (!logUsage) logUsage = { ...usage };
          else {
            logUsage.input_tokens += usage.input_tokens;
            logUsage.output_tokens += usage.output_tokens;
            logUsage.input_tokens_details.cached_tokens += usage.input_tokens_details?.cached_tokens ?? 0;
          }
          yield { type: 'usage', usage };
        }

        // #endregion

        // #region code interpreter

        // container files for code_interpreter
        // Hack: chunk.type === "response.output_text.annotation.added" throws an error
        const chunkType = chunk.type as string;
        if (chunkType === "response.output_text.annotation.added" && "annotation" in chunk && chunk.annotation != null) {
          const annotation = chunk.annotation as unknown as { container_id: string; file_id: string; filename: string };
          const buffer = await this.downloadContainerFile(annotation?.container_id, annotation?.file_id);
          yield { type: 'file', filename: annotation?.filename, text: buffer.toString('base64') };
        }
        if (chunk.type === "response.code_interpreter_call_code.done") {
          if (output.length !== 0 && !output.endsWith('\n\n')) output += '\n\n';
          output += `\`\`\`code\n${chunk.code}\n\`\`\`\n\n`;
          yield { type: 'text', text: output };
        }

        // #endregion

        // #region image

        if (chunk.type === "response.image_generation_call.partial_image") {
          const image = chunk.partial_image_b64;
          yield { type: 'partial_image', text: image };
        }

        if (chunk.type === "response.output_item.done" && chunk.item?.type === 'image_generation_call') {
          if (chunk.item.result) {
            yield { type: 'image', text: chunk.item.result };
          }
          else {
            yield { type: 'status', text: 'Image generation failed' };
          }
        }

        // #endregion

        // tool response
        if (chunk.type === 'response.output_item.added') {
          switch (chunk.item?.type) {
            case 'web_search_call':
              yield { type: 'status', text: 'Searching web...' };
              break;

            case 'image_generation_call':
              yield { type: 'status', text: 'Generating image...' };
              break;

            case 'code_interpreter_call':
              yield { type: 'status', text: 'Executing code...' };
              break;

            case 'function_call':
              toolCalls.push({
                id: chunk.item.id,
                name: chunk.item.name,
                arguments: chunk.item.arguments || '',
                call_id: chunk.item.call_id,
                response: '',
              });
              break;
          }
        }
        if (chunk.type === 'response.function_call_arguments.delta') {
          const toolCall = toolCalls.find(toolCall => toolCall.id === chunk.item_id);
          if (toolCall && 'delta' in chunk) toolCall.arguments += chunk.delta;
        }

        // maintain input for next request
        if (chunk.type === 'response.output_item.done' && chunk.item?.type !== 'message') {
          input.push(chunk.item);
        }
      }

      // execute tools in parallel and add responses to input
      await Promise.all(
        toolCalls.map(async toolCall => {
          const customTool = tools.find(t => t.type === 'function' && t.name === toolCall.name);
          let output: string;
          if (!customTool) {
            output = 'Tool not found';
          } else {
            try {
              output = await customTool.execute?.(JSON.parse(toolCall.arguments)) ?? 'Tool not found';
            } catch (error) {
              output = `Error executing tool: ${error.message}`;
            }
          }

          // handle images
          if (output.startsWith('data:image/png;base64,')) {
            input.push(
              {
                type: 'function_call_output',
                call_id: toolCall.call_id,
                output: 'Image is available in the context',
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'input_image',
                    image_url: output,
                    detail: 'auto',
                  },
                ],
              },
            );
          } else {
            input.push({
              type: 'function_call_output',
              call_id: toolCall.call_id,
              output,
            });
          }
        }),
      );

      // done
      if (toolCalls.length === 0) break;
    }

    // yield final response
    yield { type: 'finish' };

    // log
    const message = `generateStream: ${(userPrompt || systemPrompt).substring(0, 50)}`;
    this.logRequest(message, model, input, output, logUsage);
  }

  async generateImage(prompt: string, size: '1024x1024' | '1024x1792' | '1792x1024'): Promise<Buffer> {

    const client = this.createOpenAIClient();

    const result = await client.images.generate({
      model: 'gpt-image-1.5',
      prompt,
      response_format: "b64_json",
      size,
    });

    const base64 = result.data?.[0]?.b64_json;
    if (!base64) {
      throw new Error('No image generated');
    }

    this.logRequest('generate-image', 'gpt-image-1.5', { prompt, size }, base64, result.usage);
    return Buffer.from(base64, "base64");
  }

  private logRequest(message: string, model: string, input: unknown, output: unknown, usage: Usage): void {

    // usage
    let inputTokens = 0, outputTokens = 0, cachedTokens = 0;
    if (usage) {
      if ('input_tokens' in usage && 'output_tokens' in usage) {
        inputTokens = usage.input_tokens;
        outputTokens = usage.output_tokens;
        if ('input_tokens_details' in usage && 'cached_tokens' in usage.input_tokens_details) {
          cachedTokens = usage.input_tokens_details.cached_tokens;
        }
      }
      else if ('prompt_tokens' in usage) {
        inputTokens = usage.prompt_tokens;
      }
    }
    
    // create log
    this.eventLogsService.createOne({
      group: LogGroup.OPENAI,
      level: LogLevel.INFO,
      message,
      properties: {
        model,
        input,
        output,
        usage: {
          inputTokens,
          outputTokens,
          cachedTokens,
        },
      },
    }).catch(error => {
      this.logger.error(`Error logging trace: ${error.message}`);
      this.eventLogsService.createOne({
        group: LogGroup.OPENAI,
        level: LogLevel.INFO,
        message,
        properties: {
          model,
          input: '<redacted_too_long>',
          output,
          usage: {
            inputTokens,
            outputTokens,
            cachedTokens,
          },
        },
      })
    });
  }

  private sanitisePrompt(prompt: string): string {
    return prompt.trim().replace(/\n{3,}/g, '\n\n');
  }

  async createContainer(name: string): Promise<string> {
    const client = this.createOpenAIClient();
    const response = await client.containers.create({ name });
    return response.id;
  }

  async uploadContainerFile(containerId: string, buffer: Buffer, filename: string): Promise<string> {
    const client = this.createOpenAIClient();
    const file = await toFile(buffer, filename);
    const response = await client.containers.files.create(containerId, {
      file,
      file_id: filename,
    });
    return response.path;
  }

  private async downloadContainerFile(containerId: string, fileId: string) {
    const url = `https://api.openai.com/v1/containers/${containerId}/files/${fileId}/content`;

    const waitForFile = async () => {
      const maxRetries = 10;
      const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

      for (let i = 0; i < maxRetries; i++) {
        try {
          const response = await axios.get(url, {
            responseType: 'arraybuffer', // ensures raw binary data
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
          });
          return Buffer.from(response.data);
        } catch (err) {
          if (err.status === 404) {
            await delay(500);
          } else {
            throw err;
          }
        }
      }
      throw new Error(`File ${fileId} not found after ${maxRetries} retries`);
    };

    return await waitForFile();
  }
}
