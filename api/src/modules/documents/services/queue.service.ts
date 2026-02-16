import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Document, DocumentDocument } from '../entities/document.entity';
import { DocumentStatus } from '../enums/document-status.enum';
import { StorageService } from 'src/modules/shared/services/storage.service';
import { SearchService } from 'src/modules/shared/services/search.service';
import { SocketService } from 'src/modules/socket/sockets.service';
import { EventLogsService } from 'src/modules/event-logs/services/event-logs.service';
import { LogGroup } from 'src/modules/event-logs/enums/log-group.enum';
import { LogLevel } from 'src/modules/event-logs/enums/log-level.enum';
import { AnalyzeService } from './analyze.service';
import { DocumentChunk } from '../types/document-chunk.type';
import { PreviewsService } from './previews.service';
import { SummaryService } from './summary.service';
import { ImageService } from './image.service';
import { generateId } from 'src/utils/nanoid';
import { classifyFile, FileClass } from '../enums/file-class.enum';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);
  private isProcessing = false;

  constructor(
    @InjectModel(Document.name) private documentModel: Model<DocumentDocument>,
    private readonly storageService: StorageService,
    private readonly searchService: SearchService,
    private readonly socketService: SocketService,
    private readonly eventLogsService: EventLogsService,
    private readonly analyzeService: AnalyzeService,
    private readonly previewsService: PreviewsService,
    private readonly summaryService: SummaryService,
    private readonly imageService: ImageService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.init();
  }

  async init(): Promise<void> {
    this.logger.log('Initializing queue service...');

    // 1. Reset any documents with status "processing" to "pending"
    const result = await this.documentModel.updateMany(
      { status: DocumentStatus.PROCESSING },
      { status: DocumentStatus.PENDING },
    );

    if (result.modifiedCount > 0) {
      await this.eventLogsService.createOne({
        level: LogLevel.INFO,
        group: LogGroup.DOCUMENTS,
        message: `Reset ${result.modifiedCount} document(s) from processing to pending status`,
      });
    }

    // 2. Start the queue (non-blocking - don't await to allow startup to complete)
    this.processQueue().catch(error => {
      this.logger.error(`Error processing queue: ${error.message}`, error.stack);
    });
  }

  async processQueue(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    try {
      await this.processDocuments();
    } finally {
      this.isProcessing = false;
    }
  }

  private async processDocuments(): Promise<void> {
    const remainingDocs = await this.documentModel.countDocuments({ status: DocumentStatus.PENDING });
    this.logger.log(`Beginning processing queue with ${remainingDocs} pending documents`);
    let nextDoc = await this.documentModel.findOneAndUpdate(
      { status: DocumentStatus.PENDING },
      { status: DocumentStatus.PROCESSING },
      { new: true },
    );

    while (nextDoc) {
      this.logger.log(`Beginning document processing for ${nextDoc.fileName} (_id: ${nextDoc._id})`);
      await this.processNextDocument(nextDoc);
      nextDoc = await this.documentModel.findOneAndUpdate(
        { status: DocumentStatus.PENDING },
        { status: DocumentStatus.PROCESSING },
        { new: true },
      );
    }

    this.logger.log(`Document processing queue completed!`);
  }

  private async processNextDocument(document: DocumentDocument): Promise<void> {
    this.logger.log(`${document.fileName} - processing document`);
    await this.eventLogsService.createOne({
      level: LogLevel.INFO,
      group: LogGroup.DOCUMENTS,
      message: `${document.fileName} - processing document`,
      properties: { documentId: document._id },
    });

    try {
      // Emit processing status
      this.emitDocumentUpdate(document.userId, document._id, DocumentStatus.PROCESSING);

      // Download from storage
      const objectKey = `${document._id}/${document.fileName}`;
      const fileBuffer = await this.storageService.downloadBlob(objectKey, 'documents');
      if (!fileBuffer) {
        throw new Error('Failed to download file from storage');
      }

      // Select a pipeline based on the file extension
      const fileClass = classifyFile(document.fileName);
      switch (fileClass) {
        case FileClass.TextBased:
          await this.processTextBasedDocument(document, fileBuffer);
          break;
        case FileClass.Image:
          await this.processImageDocument(document, fileBuffer);
          break;
        default:
          document.status = DocumentStatus.NOT_SUPPORTED;
          await document.save();
          this.emitDocumentUpdate(document.userId, document._id, DocumentStatus.NOT_SUPPORTED);
          break;
      }
      
      // Log event: document processing completed
      await this.eventLogsService.createOne({
        level: LogLevel.INFO,
        group: LogGroup.DOCUMENTS,
        message: `${document.fileName} - document processing completed`,
        properties: { documentId: document._id },
      });
    } catch (error) {
      // Get error message and stack trace
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stackTrace = error instanceof Error ? error.stack : undefined;
      const message = `${document.fileName} - document processing failed: ${errorMessage}`;
      this.logger.error(message);

      // Update status to failed
      document.status = DocumentStatus.FAILED;
      await document.save();
      this.emitDocumentUpdate(document.userId, document._id, DocumentStatus.FAILED);

      // Log event: document processing failed
      await this.eventLogsService.createOne({
        level: LogLevel.ERROR,
        group: LogGroup.DOCUMENTS,
        message,
        stackTrace,
        properties: {
          documentId: document._id,
        },
      });
    }
  }

  private async processTextBasedDocument(document: DocumentDocument, fileBuffer: Buffer): Promise<void> {
    // 1. Generate previews
    await this.previewsService.generate(document);

    // 2. Extract with document intelligence
    const nodes = await this.analyzeService.process(document, fileBuffer);

    // 3. Generate a summary
    const summary = await this.summaryService.generate(document._id, nodes);

    // 4. Calculate the page count and token count
    const pageCount = nodes[nodes.length - 1]?.pageNumber || 0;
    const tokenCount = nodes.reduce((acc, node) => acc + node.tokens, 0);

    // 5. Upsert the nodes to AI Search
    const chunks: DocumentChunk[] = nodes.map(node => ({
      id: node.id,
      embedding: node.embedding || [],
      documentId: document._id,
      documentFileName: document.fileName,
      documentPageCount: pageCount,
      documentNodeCount: nodes.length,
      documentTokenCount: tokenCount,
      documentSummary: summary,
      nodeIndex: node.index,
      nodeSectionHeading: node.sectionHeading,
      nodeContent: node.content,
      nodeTokenCount: node.tokens,
      nodePageNumber: node.pageNumber,
      userId: document.userId,
    }));
    await this.searchService.upsert<DocumentChunk>(chunks);

    // 6. Update the database
    document.summary = summary;
    document.pageCount = pageCount;
    document.tokenCount = tokenCount;
    document.status = DocumentStatus.READY;
    await document.save();
    this.emitDocumentUpdate(document.userId, document._id, DocumentStatus.READY);
  }

  private async processImageDocument(document: DocumentDocument, fileBuffer: Buffer): Promise<void> {
    // 1. Describe the image
    const imageDescription = await this.imageService.describe(fileBuffer);
    const summary = imageDescription.description;

    // 2. Generate the node content
    const { content, tokenCount } = await this.imageService.createNodeContent(
      imageDescription,
      `${document._id}/${document.fileName}`,
    );

    // 3. Create embeddings for the node content
    const embedding = await this.imageService.createEmbeddings(content);

    // 4. Upsert the nodes to AI Search
    const chunks: DocumentChunk[] = [
      {
        id: generateId(),
        embedding,
        documentId: document._id,
        documentFileName: document.fileName,
        documentPageCount: 1,
        documentNodeCount: 1,
        documentTokenCount: tokenCount,
        documentSummary: summary,
        nodeIndex: 1,
        nodeSectionHeading: '',
        nodeContent: content,
        nodeTokenCount: tokenCount,
        nodePageNumber: 1,
        userId: document.userId,
      },
    ];
    await this.searchService.upsert<DocumentChunk>(chunks);

    // 5. Update the database
    document.summary = summary;
    document.tokenCount = tokenCount;
    document.pageCount = 1;
    document.status = DocumentStatus.READY;
    await document.save();
    this.emitDocumentUpdate(document.userId, document._id, DocumentStatus.READY);
  }

  // emit the document update to the socket
  private emitDocumentUpdate(userId: string, documentId: string, status: DocumentStatus): void {
    if (this.socketService.socket) {
      this.socketService.socket.to(userId).emit('document-update', {
        documentId,
        status,
      });
    }
  }
}
