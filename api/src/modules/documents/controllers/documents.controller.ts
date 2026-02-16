import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { DocumentsService } from '../services/documents.service';
import { ZodValidationPipe } from 'src/pipes/zod-validation.pipe';
import { Document } from '../entities/document.entity';
import { CurrentUser } from 'src/modules/users/decorators/current-user.decorator';
import { User } from 'src/modules/users/entities/user.entity';
import { type FindDocumentsFilter, FindDocumentsFilterSchema } from '../types/find-documents-filter.type';
import { type CreateDocument, CreateDocumentSchema } from '../types/create-document.type';
import { type IdParam, IdParamSchema } from 'src/types/id-param.type';
import { type GetUploadData, GetUploadDataSchema } from '../types/get-upload-data.type';
import { DocumentStatus } from '../enums/document-status.enum';
import { QueueService } from '../services/queue.service';
import { type FindChunkFilter, FindChunkFilterSchema } from '../types/find-chunk-filter';
import { type CitationPreview } from '../types/citation-preview.type';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly queueService: QueueService,
  ) {}

  @Get('citation')
  async getCitationPreview(
    @Query(new ZodValidationPipe(FindChunkFilterSchema)) filter: FindChunkFilter,
  ): Promise<CitationPreview> {

    // find the chunk
    const chunk = await this.documentsService.getChunk(filter.id);
    if (!chunk) {
      throw new NotFoundException("Chunk not found");
    }

    // find the document
    const document = await this.documentsService.findOne<Document>(chunk.documentId);
    if (!document) {
      throw new NotFoundException("Document not found");
    }

    // create a signed url for the page preview
    const previewUrl = await this.documentsService.getPagePreviewUrl(document._id, filter.pageNumber);

    // create a signed url for the document
    const downloadUrl = await this.documentsService.getDownloadSignedUrl(document._id, document.fileName);

    return { 
      _id: document._id,
      fileName: document.fileName,
      pageNumber: filter.pageNumber,
      title: chunk.nodeSectionHeading,
      content: chunk.nodeContent,
      previewUrl,
      downloadUrl
    };
  }
  
  @Post()
  async createDocument(
    @Body(new ZodValidationPipe(CreateDocumentSchema)) createDocumentDto: CreateDocument,
    @CurrentUser() currentUser: User,
  ): Promise<Document> {
    const document = await this.documentsService.create({
      ...createDocumentDto,
      userId: currentUser._id,
      status: DocumentStatus.PENDING,
    });
    this.queueService.processQueue();
    return document;
  }

  @Get()
  async findMany(
    @Query(new ZodValidationPipe(FindDocumentsFilterSchema)) filter: FindDocumentsFilter,
  ): Promise<Document[]> {
    return await this.documentsService.findMany<Document>(filter);
  }

  @Get(':id')
  async findOne(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParam,
  ): Promise<Document & { signedUrl: string }> {
    const document = await this.documentsService.findOne<Document>(params.id);
    if (!document) {
      throw new NotFoundException("Document not found");
    }
    // add a signed url to the document
    const signedUrl = await this.documentsService.getDownloadSignedUrl(document._id, document.fileName);
    return { ...document, signedUrl };
  }

  @Delete(':id')
  async deleteDocument(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParam,
  ): Promise<{ success: boolean }> {
    const document = await this.documentsService.findOne<Document>(params.id);
    if (!document) {
      throw new NotFoundException("Document not found");
    }

    const deleted = await this.documentsService.delete(params.id);
    if (!deleted) {
      throw new NotFoundException("Document not found");
    }
    return { success: true };
  }

  @Post(':id/upload-data')
  async getUploadData(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(GetUploadDataSchema)) body: GetUploadData,
  ): Promise<{ signedUrl: string }> { 
    const signedUrl = await this.documentsService.getUploadSignedUrl(params.id, body.fileName);    
    return { signedUrl };
  }
}

