import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat, ChatDocument } from '../entities/chat.entity';
import { Projection } from 'src/types/projection.type';
import { CreateChat } from '../types/create-chat.type';
import { FindChatsFilter } from '../types/find-chats-filter.type';
import { UpdateChat } from '../types/update-chat.type';
import { DocumentIntelligenceService } from 'src/modules/shared/services/document-intelligence.service';
import { StorageService } from 'src/modules/shared/services/storage.service';
import { OpenAIService } from 'src/modules/shared/services/openai.service';
import z from 'zod';

@Injectable()
export class ChatsService {

    constructor(
        @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
        private readonly documentIntelligenceService: DocumentIntelligenceService,
        private readonly azureStorageService: StorageService,
        private readonly openaiService: OpenAIService,
    ) { }

    async create(data: CreateChat): Promise<Chat> {
        const chat = new this.chatModel(data);
        return await chat.save();
    }

    async update<T>(_id: string, data: UpdateChat, select?: Projection): Promise<T | null> {
        const filter = { _id: { $eq: _id } };
        const options = { new: true, select: select || {} };
        return await this.chatModel.findOneAndUpdate(filter, data, options).lean<T>();
    }

    async findOne<T>(_id: string, select?: Projection): Promise<T | null> {
        const filter = { _id: { $eq: _id } };
        return await this.chatModel.findOne(filter).select(select || {}).lean<T>();
    }

    async findMany<T>(filter: FindChatsFilter, select?: Projection): Promise<T[]> {
        const criteria: Record<string, unknown> = {};

        if (filter.userId) {
            criteria.userId = filter.userId;
        }

        if (filter.keywords) {
            criteria.$text = { $search: filter.keywords };
        }

        return await this.chatModel
            .find(criteria)
            .select(select || {})
            .sort({ updatedAt: -1 })
            .skip(filter.offset || 0)
            .limit(filter.limit || 50)
            .lean<T[]>();
    }

    async exists(chatId: string, userId: string): Promise<boolean> {
        const criteria = { _id: { $eq: chatId }, userId: { $eq: userId } };
        const chat = await this.chatModel.exists(criteria).lean();
        return !!chat?._id;
    }

    async uploadFile(file: Express.Multer.File, key: string): Promise<string> {

        // Generate a unique filename
        const objectKey = `${key}/${file.originalname}`;

        // images
        if (file.mimetype.startsWith('image/')) {
            // describe the image
            const output = z.object({
                description: z.string(),
                text: z.string(),
            });
            const systemPrompt = "Provide a detailed description of the image and extract any text in the image. Use Australian English.";
            const response = await this.openaiService.generateJSON<z.infer<typeof output>>({
                systemPrompt,
                prompt: "",
                base64Images: [file.buffer.toString('base64')],
                outputSchema: output
            });
            let content = response.description;
            if (response.text) {
                content += `\n\n# Extracted Text\n\n${response.text}`;
            }

            // upload the original 
            await this.azureStorageService.uploadBlob(file.buffer, objectKey + '.original', 'uploads');

            // upload the transformed content
            await this.azureStorageService.uploadBlob(Buffer.from(content), objectKey, 'uploads');

            // return the object key
            return objectKey;
        }

        // plain text
        if (file.mimetype === 'text/plain' || file.mimetype === 'text/csv') {
            // upload the original 
            await this.azureStorageService.uploadBlob(file.buffer, objectKey, 'uploads');

            // return the object key
            return objectKey;
        }

        // extract the content with document intelligence        
        const response = await this.documentIntelligenceService.extract(file.buffer);
        const paragraphs = response.paragraphs ?? [];
        const tables = response.tables ?? [];

        let responseText = '';
        for (const paragraph of paragraphs) {

            const table = tables.find(table => table.spans.some(span => span.offset === paragraph.spans[0].offset));
            const overlap = tables.some(table => table.spans.some(span => span.offset <= paragraph.spans[0].offset && span.offset + span.length >= paragraph.spans[0].offset + paragraph.spans[0].length));
            if (table) {
                // Group cells by row index
                const rows: string[][] = [];
                for (let i = 0; i < table.rowCount; i++) {
                    rows[i] = new Array(table.columnCount).fill('');
                }

                // Populate cells based on their row and column indices
                for (const cell of table.cells) {
                    rows[cell.rowIndex][cell.columnIndex] = cell.content;
                }

                // Generate markdown table
                for (let i = 0; i < rows.length; i++) {
                    responseText += `| ${rows[i].join(' | ')} |\n`;
                    // Add separator row after header row
                    if (i === 0) {
                        responseText += `| ${rows[i].map(() => '---').join(' | ')} |\n`;
                    }
                }
            }
            else if (overlap) {
                continue;
            }
            else if (paragraph.role === 'sectionHeading') {
                responseText += `\n# ${paragraph.content}\n\n`;
            }
            else {
                responseText += `${paragraph.content}\n`;
            }
        }

        const content = responseText.trim();
        if (!content) {
            throw new Error("No content found in file");
        }

        const tokens = this.openaiService.getTokenizerForModel('text-embedding-3-large').encode(content);
        if (tokens.length > 50_000) {
            throw new Error("File content is too long");
        }

        // upload the original 
        await this.azureStorageService.uploadBlob(file.buffer, objectKey + '.original', 'uploads');

        // upload the transformed content
        await this.azureStorageService.uploadBlob(Buffer.from(content), objectKey, 'uploads');

        // return the object key
        return objectKey;
    }
}
