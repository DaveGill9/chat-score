import { 
    BlobItem,
    BlobSASSignatureValues, 
    BlobServiceClient, 
    BlockBlobClient,
    ContainerClient,
    ContainerSASPermissions, 
    SASProtocol, 
    StorageSharedKeyCredential, 
    generateBlobSASQueryParameters 
} from '@azure/storage-blob';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getMimeType } from 'src/utils/get-mime-type';

export type StoragePermissions = 'r' | 'rw' | 'tw' | 'w' | 'd';
export type StorageContainer = 'documents' | 'uploads';

@Injectable()
export class StorageService {
    private readonly logger = new Logger(StorageService.name);

    private storageAccountName: string;
    private storageAccountKey: string;
    private sharedKeyCredential: StorageSharedKeyCredential;
    public storageEndpoint: string;
    private readonly defaultContainer: StorageContainer = 'documents';

    constructor(
        private configService: ConfigService,
    ) {
        this.storageAccountName = this.configService.get<string>('STORAGE_ACCOUNT_NAME', '');
        this.storageAccountKey = this.configService.get<string>('STORAGE_ACCOUNT_KEY', '');
        this.storageEndpoint = `https://${this.storageAccountName}.blob.core.windows.net`;

        if (!this.storageAccountName || !this.storageAccountKey) {
            this.logger.warn('Azure Storage configuration is incomplete');
        }

        this.sharedKeyCredential = new StorageSharedKeyCredential(this.storageAccountName, this.storageAccountKey);
    }

    async uploadBlob(
        file: Buffer, 
        blobName: string, 
        containerName: StorageContainer = this.defaultContainer, 
    ): Promise<void> {
        const uploadUrl = this.generateSignedUrl(blobName, containerName, 'tw');
        const blockBlobClient = new BlockBlobClient(uploadUrl);
        await blockBlobClient.uploadData(file);
    }

    async downloadBlob(
        blobName: string, 
        containerName: StorageContainer = this.defaultContainer
    ): Promise<Buffer | null> {
        try {
            const downloadUrl = this.generateSignedUrl(blobName, containerName, 'r', 5);
            const response = await fetch(downloadUrl);
            if (response.status !== 200)
                return null;
            return Buffer.from(await response.arrayBuffer());
        }
        catch {
            return null;
        }
    }

    async streamBlob(
        blobName: string,
        containerName: StorageContainer = this.defaultContainer
    ): Promise<{ stream: NodeJS.ReadableStream; contentLength: number; contentType: string }> {
        try {
            const blobServiceClient = new BlobServiceClient(
                this.storageEndpoint,
                this.sharedKeyCredential
            );
            const containerClient = blobServiceClient.getContainerClient(containerName);
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);

            // Get blob properties to retrieve content length and type
            const properties = await blockBlobClient.getProperties();

            // Download the blob as a stream
            const downloadResponse = await blockBlobClient.download();

            if (!downloadResponse.readableStreamBody) {
                throw new Error('Failed to get readable stream from blob');
            }

            // content type is the filename extension
            const contentType = getMimeType(blobName) || 'application/octet-stream';

            return {
                stream: downloadResponse.readableStreamBody as NodeJS.ReadableStream,
                contentLength: properties.contentLength || 0,
                contentType
            };
        } catch (error) {
            this.logger.error(`Failed to download blob stream: ${blobName}`, error);
            throw error;
        }
    }

    async deleteBlob(
        blobName: string, 
        containerName: StorageContainer = this.defaultContainer
    ): Promise<void> {
        const deleteUrl = this.generateSignedUrl(blobName, containerName, 'd');
        const blockBlobClient = new BlockBlobClient(deleteUrl);
        await blockBlobClient.delete();
    }

    async listBlobs(
        directoryName: string,
        containerName: StorageContainer = this.defaultContainer
    ): Promise<BlobItem[]> {
        // Ensure the prefix ends with a '/' for correct filtering
        const prefix = directoryName.endsWith('/') ? directoryName : `${directoryName}/`;
    
        const blobServiceClient = new BlobServiceClient(
            this.storageEndpoint,
            this.sharedKeyCredential
        );
        const containerClient: ContainerClient = blobServiceClient.getContainerClient(containerName);
        const blobs: BlobItem[] = [];
    
        const iterator = containerClient.listBlobsFlat({ prefix }).byPage();        
        for await (const page of iterator) {
            if (page.segment.blobItems) {
                blobs.push(...page.segment.blobItems);
            }
        }
    
        return blobs;
    }

    async deleteFolder(
        directoryName: string,
        containerName: StorageContainer = this.defaultContainer
    ): Promise<void> {
        const blobs = await this.listBlobs(directoryName, containerName);
        for (const blob of blobs) {
            await this.deleteBlob(blob.name, containerName);
        }
    }

    generateSignedUrl(
        blobName: string, 
        containerName: StorageContainer = this.defaultContainer,  
        permission: StoragePermissions = 'r',
        expiryMinutes: number = 15
    ): string {
        const token = this.generateSasToken(permission, containerName, decodeURIComponent(blobName), expiryMinutes);
        return `${this.storageEndpoint}/${containerName}/${blobName}?${token}`;
    }

    private generateSasToken(
        permission: string,
        containerName: StorageContainer = this.defaultContainer,
        blobName: string = "",
        expiryMinutes: number = 15
    ): string {
        const now = new Date();
        const expiry = new Date(now);
        expiry.setMinutes(now.getMinutes() + expiryMinutes);

        const options: BlobSASSignatureValues = {
            containerName,
            permissions: ContainerSASPermissions.parse(permission),
            startsOn: now,
            expiresOn: expiry,
            protocol: SASProtocol.Https,
            blobName
        }

        const token = generateBlobSASQueryParameters(options, this.sharedKeyCredential);
        return token.toString();
    }
}