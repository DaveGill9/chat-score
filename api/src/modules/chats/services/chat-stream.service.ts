import { Injectable } from "@nestjs/common";
import { ChatMessage } from "../entities/chat-message.entity";
import { CreateChatMessage } from "../types/create-chat-message.type";
import { ChatsService } from "../services/chats.service";
import { Chat } from "../entities/chat.entity";
import { z } from 'zod';
import { OpenAIService, ExecuteTool } from "src/modules/shared/services/openai.service";
import { ChatMessageRole } from "../enums/chat-message-role.enum";
import { generateId } from "src/utils/nanoid";
import { format } from "date-fns";
import { StorageService } from "src/modules/shared/services/storage.service";
import { EventLogsService, LogGroup, LogLevel } from "src/modules/event-logs";
import { systemPromptTemplate } from "../prompts/system.prompt";
import { Liquid } from 'liquidjs';
import { User } from "src/modules/users/entities/user.entity";
import { ChatMessageService } from "./chat-message.service";
import { ChatMessageStatus } from "../enums/chat-message-status.enum";
import { SearchService } from "src/modules/shared/services/search.service";
import { DocumentChunk } from "src/modules/documents/types/document-chunk.type";
import { WebSearchTool, Tool } from "openai/resources/responses/responses.js";
import { EventEmitter } from "stream";

const liquid = new Liquid();
@Injectable()
export class ChatStreamService {

    constructor(
        private chatsService: ChatsService,
        private chatMessageService: ChatMessageService,
        private openaiService: OpenAIService,
        private azureStorageService: StorageService,
        private eventLogsService: EventLogsService,
        private searchService: SearchService,
    ) { }

    async process(
        user: User,
        payload: CreateChatMessage,
    ): Promise<ChatStreamRunner> {
        const runner = new ChatStreamRunner(
            this.chatsService, 
            this.chatMessageService, 
            this.openaiService, 
            this.azureStorageService, 
            this.eventLogsService,
            this.searchService
        );
        runner.process(user, payload);
        return runner;
    }
}

class ChatStreamRunner {

    private chatId: string;
    private user: User;
    private assistantMessage: ChatMessage;
    private readonly newChatTitle: string = "New conversation";
    public emitter: EventEmitter;
    private abortController: AbortController;

    constructor(
        private chatsService: ChatsService,
        private chatMessageService: ChatMessageService,
        private openaiService: OpenAIService,
        private azureStorageService: StorageService,
        private eventLogsService: EventLogsService,
        private searchService: SearchService,
    ) {
        this.emitter = new EventEmitter();
        this.abortController = new AbortController();
     }

     public abort(): void {
        this.abortController?.abort();
    }

    private async getChat(): Promise<Chat> {
        let chat = await this.chatsService.findOne<Chat>(this.chatId);
        if (!chat || chat.userId !== this.user._id) {
            chat = await this.chatsService.create({
                _id: this.chatId,
                userId: this.user._id,
                title: this.newChatTitle,
            });
        }
        return chat;
    }

    private async createChatTitle(userMessage: string, assistantMessage: string): Promise<string> {
        const outputSchema = z.object({
            title: z.string().min(1)
        });
        type OutputType = z.infer<typeof outputSchema>;
        const systemPrompt = `Create a short title (5 words max) for the following chat. No markdown formatting. Use Australian English spelling.`;
        const prompt = `# User message\n\n${userMessage}\n\n# Assistant response\n\n${assistantMessage}`;
        
        try {
            const result = await this.openaiService.generateJSON<OutputType>({ model: 'gpt-4.1-mini', systemPrompt, prompt, outputSchema });
            return result.title ?? "New conversation";
        }
        catch {
            return "New conversation";
        }
    }    

    // #region SSE

    private emit(event: 'chat-title' | 'feedback' | 'text-delta' | 'status', data: string) {
        this.emitter.emit(event, data);
    }

    // #endregion

    // #region Tools

    private viewImageTool: ExecuteTool = {
        type: "function",
        name: "view_image",
        description: "View an image that is embedded in the context",
        parameters: {
            type: "object",
            properties: {
                imagePath: {
                    type: "string",
                    "description": "The path of the image to view starting with a forward slash"
                }
            },
            required: [
                "imagePath"
            ],
            additionalProperties: false
        },
        strict: true,
        execute: async (args: Record<string, string>) => {
            this.emit("feedback", "Viewing image...");
            try {
                const content = await this.azureStorageService.downloadBlob(args.imagePath, 'documents');
                const base64 = content!.toString('base64');
                return `data:image/png;base64,${base64}`;
            }
            catch (error) {
                this.emit("feedback", `Error viewing image`);
                return `Error viewing image: ${error.message}`;
            }
        }
    }

    private findRelevantContextTool: ExecuteTool = {
        type: "function",
        name: "find_relevant_context",
        description: "Find the most relevant contextual passages from the knowledge base to answer a user's question or complete a task.",
        parameters: {
            type: "object",
            properties: {
                semanticQuery: {
                    type: "string",
                    "description": "The core natural language query to search the documents"
                },
                keywordQuery: {
                    type: "string",
                    "description": "The keyword query to search the documents"
                },
                fileName: {
                    type: "string",
                    "description": "Optional - the filename of the document to search, if known. If not known, leave blank."
                }
            },
            required: [
                "semanticQuery",
                "keywordQuery",
                "fileName"
            ],
            additionalProperties: false
        },
        strict: true,
        execute: async (args: Record<string, string>) => {
            this.emit("feedback", "Finding documents...");
            try {
                const filters: Record<string, unknown> = {};
                if (args.fileName) {
                    filters.documentFileName = args.fileName;
                }
                const embedding = await this.openaiService.generateEmbeddings([args.semanticQuery]);
                const results = await this.searchService.hybridSearch<DocumentChunk>(args.semanticQuery, embedding[0], filters, 0, 20);
                if (results.count === 0) {
                    return `No content found`;
                }

                const formatChunk = (chunk: DocumentChunk) => 
`<chunk id="${chunk.id}" documentId="${chunk.documentId}" fileName="${chunk.documentFileName}" pageNumber="${chunk.nodePageNumber}">
<![CDATA[
# ${chunk.nodeSectionHeading}

${chunk.nodeContent}
]]>
</chunk>`;
                const context = results.value.map(formatChunk).join("\n\n");

                // replace images with signed urls
                const contextWithSignedUrls = context.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, key) => {
                    const signedUrl = this.azureStorageService.generateSignedUrl(key.replace(/^\//, ''), 'documents');
                    return `![${alt}](${signedUrl})`;
                });
                return contextWithSignedUrls;
            }
            catch (error) {
                this.emit("feedback", `Error finding documents`);
                return `Error finding documents: ${error.message}`;
            }
        }
    }

    private getUploadContentTool: ExecuteTool = {
        type: "function",
        name: "read_uploaded_content",
        description: "Fetch the content of a specific uploaded file.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    "description": "The file path of the uploaded file"
                }
            },
            required: [
                "filePath"
            ],
            additionalProperties: false
        },
        strict: true,
        execute: async (args: Record<string, string>) => {
            const objectKey = args.filePath;
            const filename = objectKey.split("/").pop();
            this.emit("feedback", `Reading ${filename}...`);
            try {
                const content = await this.azureStorageService.downloadBlob(objectKey, 'uploads');
                return content?.toString('utf-8') ?? 'File not found';
            }
            catch (error) {
                this.assistantMessage.status = ChatMessageStatus.ERROR;
                this.emit("status", ChatMessageStatus.ERROR);
                this.emit("feedback", `Error reading ${filename}: ${error.message}`);
                return `Error reading ${filename}: ${error.message}`;
            }
        }
    }

    private webSearchTool: WebSearchTool = {
        type: 'web_search',
    }

    private imageGenerationTool: Tool.ImageGeneration = {
        type: 'image_generation',
    }

    private codeInterpreterTool: Tool.CodeInterpreter = {
        type: 'code_interpreter',
        container: { type: 'auto' },
    }

    // #endregion

    async process(
        user: User,
        payload: CreateChatMessage,
    ): Promise<void> {
        try {
        const { chatId, content, uploads } = payload;

        this.user = user;
        this.chatId = chatId;        

        // find or create chat for current user
        let chat = await this.getChat();

        // tools
        const tools = [
            this.getUploadContentTool, 
            this.findRelevantContextTool, 
            this.viewImageTool, 
            this.webSearchTool, 
            this.imageGenerationTool, 
            this.codeInterpreterTool
        ]; 

        const toolDefinition = (tool: ExecuteTool) => (
            { 
                name: 'name' in tool ? tool.name : tool.type, 
                description: 'description' in tool ? tool.description : 'Built-in tool' 
            });

        const uploadPath = (blobName: string) => {
            return {
                blobName,
                signedUrl: this.azureStorageService.generateSignedUrl(blobName, 'uploads'),
            }
        }

        // prompts - create before saving messages to ensure consistent history
        const currentDate = format(new Date(), 'd MMMM yyyy');
        const conversationHistory = await this.chatMessageService.findMany<ChatMessage>(this.chatId, {
            userId: this.user._id,
            sort: "asc",
        });
        const systemPrompt = await liquid.parseAndRender(systemPromptTemplate, {
            currentDate,
            uploads: uploads?.map(uploadPath),
            tools: tools.map(toolDefinition),
            conversationHistory
        });
        const userPrompt = content;

        // create user message
        await this.chatMessageService.create(payload);

        // create assistant message
        this.assistantMessage = await this.chatMessageService.create({
            _id: generateId(),
            chatId: this.chatId,
            role: ChatMessageRole.ASSISTANT,
            content: "",
            status: ChatMessageStatus.WORKING,
        });

        // emit chat update
        this.emit("feedback", "Working...");
        this.emit("chat-title", chat.title);

        // generate stream
 
        try {
            const stream = this.openaiService.generateStream({
                systemPrompt,
                userPrompt,
                tools,
                history: conversationHistory.map(message => ({ role: message.role, content: message.content })),
            }, this.abortController.signal);

            for await (const chunk of stream) {

                if (chunk.type === "status") {
                    this.emit("feedback", chunk.text ?? '');
                }

                if (chunk.type === "text") {
                    this.assistantMessage.content += chunk.text;
                    this.emit("text-delta", chunk.text ?? '');
                }

                if (chunk.type === "image") {
                    const base64 = chunk.text ?? '';
                    const imageBuffer = Buffer.from(base64, 'base64');
                    const imageName = generateId() + '.png';
                    await this.azureStorageService.uploadBlob(imageBuffer, imageName, 'uploads');
                    const signedUrl = this.azureStorageService.generateSignedUrl(imageName, 'uploads');   
                    
                    let imageContent = `![image](${signedUrl})\n\n`;
                    if (this.assistantMessage.content.length > 0) {
                        imageContent = "\n\n" + imageContent;
                    }
                    this.assistantMessage.content += imageContent;
                    this.emit("text-delta", imageContent);
                }

                if (chunk.type === "file") {
                    const base64 = chunk.text ?? '';
                    const mimeType = this.base64MimeType(base64);
                    const fileBuffer = Buffer.from(base64, 'base64');
                    const fileName = (chunk.filename ?? generateId());
                    const blobName = generateId() + '/' + fileName;
                    await this.azureStorageService.uploadBlob(fileBuffer, blobName, 'uploads');
                    const signedUrl = this.azureStorageService.generateSignedUrl(blobName, 'uploads');
                    
                    let fileContent = '';
                    if (mimeType.startsWith('image/')) {
                        fileContent = `![image](${signedUrl})\n\n`;
                    }
                    else {
                        fileContent = `![${fileName}](${signedUrl})\n\n`;
                    }
                    if (this.assistantMessage.content.length > 0) {
                        fileContent = "\n\n" + fileContent;
                    }
                    this.assistantMessage.content += fileContent;
                    this.emit("text-delta", fileContent);
                }
                
                if (chunk.type === "finish" && chunk.text === "content_filter") {
                    let errorContent = "```error\nError: Content policy violation - please try again with a different question\n```";
                    if (this.assistantMessage.content.length > 0) {
                        errorContent = "\n\n" + errorContent;
                    }
                    this.assistantMessage.content += errorContent;
                    this.emit("text-delta", errorContent);
                }
            }
            
            this.assistantMessage.status = ChatMessageStatus.DONE;
            this.emit("status", ChatMessageStatus.DONE);
        }
        catch (error) {
            const message = error.message ?? "Stream Response Error";
            await this.eventLogsService.createOne({
                group: LogGroup.OPENAI,
                level: LogLevel.ERROR,
                message,
                properties: {
                    systemPrompt,
                    userPrompt
                },
            });
            this.assistantMessage.status = ChatMessageStatus.ERROR;
            this.emit("status", ChatMessageStatus.ERROR);
            if (message.includes("content management policy")) {
                let errorContent = "```error\nContent policy violation - please try again with a different question\n```";
                if (this.assistantMessage.content.length > 0) {
                    errorContent = "\n\n" + errorContent;
                }
                this.assistantMessage.content += errorContent;
                this.emit("text-delta", errorContent);
            }
            else {
                let errorContent = "```error\nAn unknown error occurred - please try again\n```";
                if (this.assistantMessage.content.length > 0) {
                    errorContent = "\n\n" + errorContent;
                }
                this.assistantMessage.content += errorContent;
                this.emit("text-delta", errorContent);
            }
        }

        // update assistant message
        await this.chatMessageService.update(this.assistantMessage._id, { content: this.assistantMessage.content, status: this.assistantMessage.status });

        // create a title for the chat
        if (chat.title === this.newChatTitle) {
            const title = await this.createChatTitle(content, this.assistantMessage.content);
            await this.chatsService.update(this.chatId, { title });
            this.emit("chat-title", title);
        }
        } finally {
            this.emitter.emit('end');
        }
    }

    private base64MimeType(base64: string): string {        
        if (base64.startsWith('iVBORw0KGgo'))
            return "image/png";
        else if (base64.startsWith('/9j/4'))
            return "image/jpeg";
        else if (base64.startsWith('UklGRg'))
            return "image/webp";
        else if (base64.startsWith('R0lGODdh') || base64.startsWith('R0lGODlh'))
            return "image/gif";
        else
            return "application/octet-stream";
    }

}