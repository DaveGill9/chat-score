import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Document, DocumentDocument } from '../entities/document.entity';
import { Projection } from 'src/types/projection.type';
import { CreateDocument } from '../types/create-document.type';
import { FindDocumentsFilter } from '../types/find-documents-filter.type';
import { StorageService } from 'src/modules/shared/services/storage.service';
import { DocumentStatus } from '../enums/document-status.enum';
import { SearchService } from 'src/modules/shared/services/search.service';
import { DocumentChunk } from '../types/document-chunk.type';

@Injectable()
export class DocumentsService {

    constructor(
        @InjectModel(Document.name) private documentModel: Model<DocumentDocument>,
        private readonly storageService: StorageService,
        private readonly searchService: SearchService,
    ) { }

    async create(data: CreateDocument & { userId: string, status?: DocumentStatus }): Promise<Document> {
        const document = new this.documentModel(data);
        return await document.save();
    }

    async delete(_id: string): Promise<boolean> {
        // check if the document exists
        const document = await this.findOne<Document>(_id);
        if (!document) {
            return false;
        }

        // delete the file from the storage 
        await this.storageService.deleteFolder(`${document._id}`, 'documents');

        // delete from search
        await this.searchService.remove({ documentId: document._id });

        // delete from db
        const result = await this.documentModel.deleteOne({ _id: { $eq: _id } });
        return result.deletedCount > 0;
    }

    async findOne<T>(_id: string, select?: Projection): Promise<T | null> {
        const filter = { _id: { $eq: _id } };
        return await this.documentModel.findOne(filter).select(select || {}).lean<T>();
    }

    async findMany<T>(filter: FindDocumentsFilter, select?: Projection): Promise<T[]> {
        const criteria: Record<string, unknown> = {};

        if (filter.userId) {
            criteria.userId = filter.userId;
        }

        if (filter.keywords) {
            criteria.$text = { $search: filter.keywords };
        }

        return await this.documentModel
            .find(criteria)
            .select(select || {})
            .sort({ updatedAt: -1 })
            .skip(filter.offset || 0)
            .limit(filter.limit || 50)
            .lean<T[]>();
    }

    async getDownloadSignedUrl(id: string, fileName: string): Promise<string> {
        return this.storageService.generateSignedUrl(`${id}/${fileName}`, 'documents', 'r', 15);
    }

    async getUploadSignedUrl(id: string, fileName: string): Promise<string> {
        return this.storageService.generateSignedUrl(`${id}/${fileName}`, 'documents', 'w', 15);
    }

    async getPagePreviewUrl(id: string, pageNumber: number): Promise<string> {
        return this.storageService.generateSignedUrl(`${id}/previews/${pageNumber}.png`, 'documents', 'r', 15);
    }

    async getChunk(id: string): Promise<DocumentChunk> {
        try { 
            return await this.searchService.getDocument<DocumentChunk>(id);
        }
        catch (error) {
            if (error.status === 404) {
                throw new NotFoundException("Chunk not found");
            }
            throw error;
        }
    }
}

