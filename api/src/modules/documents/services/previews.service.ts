import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosError } from "axios";
import { LogLevel } from "src/modules/event-logs/enums/log-level.enum";
import { Document } from "src/modules/documents/entities/document.entity";
import { StorageService } from "src/modules/shared/services/storage.service";
import { LogGroup } from "src/modules/event-logs/enums/log-group.enum";
import { EventLogsService } from "src/modules/event-logs/services/event-logs.service";

@Injectable()
export class PreviewsService {
    private readonly logger = new Logger(PreviewsService.name);

    private readonly functionUrl: string;
    private readonly storageAccountName: string;
    private readonly storageAccountContainer: string;

    constructor(
        private readonly eventLogsService: EventLogsService,
        private readonly storageService: StorageService,
        private readonly configService: ConfigService,
    ) {
        this.functionUrl = this.configService.get('PDF_PREVIEW_URL', '');
        this.storageAccountName = this.configService.get('STORAGE_ACCOUNT_NAME', '');
        this.storageAccountContainer = this.configService.get('STORAGE_ACCOUNT_CONTAINER', 'documents');

        if (!this.functionUrl || !this.storageAccountName || !this.storageAccountContainer) {
            this.logger.warn('PreviewsService is not configured correctly');
        }
    }

    public async generate(document: Document): Promise<PreviewsResult> {

        // ignore if the function url is not set
        if (!this.functionUrl) {
            return {
                conversion_id: '',
                pdf_filename: document.fileName,
                export_format: 'jpg',
                total_pages: 0,
                pages: []
            };
        }

        // only generate previews for PDFs
        if (!document.fileName.toLowerCase().endsWith('.pdf')) {
            return {
                conversion_id: '',
                pdf_filename: document.fileName,
                export_format: 'jpg',
                total_pages: 0,
                pages: []
            };
        }

        const objectKey = `${document._id}/working/previews.json`;

        // check if result already exists
        const cachedResponse = await this.storageService.downloadBlob(objectKey, 'documents');
        if (cachedResponse) {
            return JSON.parse(cachedResponse.toString()) as PreviewsResult;
        }

        // generate previews
        try {

            // Log the start of preview generation
            await this.eventLogsService.createOne({
                level: LogLevel.INFO,
                group: LogGroup.DOCUMENTS,
                message: `${document.fileName} - starting preview generation`,
                properties: { 
                    documentId: document._id
                }
            });

            // generate previews
            const result = await this.generatePreviews(document);

            // Save the result to blob storage
            await this.storageService.uploadBlob(
                Buffer.from(JSON.stringify(result, null, 2)),
                objectKey,
                'documents'
            );

            // Log successful completion
            await this.eventLogsService.createOne({
                level: LogLevel.INFO,
                group: LogGroup.DOCUMENTS,
                message: `${document.fileName} - generated ${result.total_pages} previews`,
                properties: { 
                    documentId: document._id
                }
            });

            return result;
        }
        catch (error) {
            await this.eventLogsService.createOne({
                level: LogLevel.ERROR,
                group: LogGroup.DOCUMENTS,
                message: error.message,
                stackTrace: error.stack,
                properties: { 
                    documentId: document._id
                }
            });
            throw error;
        }
    }

    private async generatePreviews(document: Document): Promise<PreviewsResult> {
        // Prepare the request payload for the Azure function
        const requestPayload = {
            path: `${document._id}`,
            pdf_filename: document.fileName,
            storage_account_name: this.storageAccountName,
            storage_account_container: this.storageAccountContainer,
            export_format: 'jpg'
        };

        let statusUrl: string = '';
        const maxRetries = 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {

                // Call the Azure function to start the conversion
                const response = await axios.post(this.functionUrl, requestPayload, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000 // 30 second timeout
                });

                if (response.status !== 202) {
                    throw new Error(`Azure function returned status ${response.status}: ${response.statusText}`);
                }

                // Get the status URL from the response
                statusUrl = response.headers['location'] || response.data?.statusQueryGetUri;
                if (!statusUrl) {
                    throw new Error('No status URL received from Azure function');
                }

                // Success - break out of retry loop
                break;

            } catch (error) {
                
                // Enhanced error logging with more context
                const errorMessage = error.response?.data ? 
                    `HTTP ${error.response.status}: ${error.response.statusText} - ${JSON.stringify(error.response.data)}` : 
                    error.message;

                await this.eventLogsService.createOne({
                    level: LogLevel.ERROR,
                    group: LogGroup.DOCUMENTS,
                    message: `${document.fileName} - Azure function call failed (${attempt}/${maxRetries}): ${errorMessage}`,
                    stackTrace: error.stack,
                    properties: {
                        step: 'generatePreviews',
                        documentId: document._id,
                        functionUrl: this.functionUrl,
                        requestPayload: JSON.stringify(requestPayload),
                        errorCode: error.code,
                        errorStatus: error.response?.status,
                        errorStatusText: error.response?.statusText,
                        errorData: error.response?.data ? JSON.stringify(error.response.data) : undefined,
                        attempt,
                        maxRetries
                    }
                });
                
                // Check if this is a retryable error
                const isRetryable = this.isRetryableError(error);
                
                if (!isRetryable || attempt === maxRetries) {
                    // Not retryable or max retries reached - throw the error
                    throw error;
                }

                // Wait before retrying (exponential backoff)
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // If we get here, we should have a statusUrl
        if (!statusUrl) {
            throw new Error('Failed to get status URL after all retry attempts');
        }

        // Poll for completion
        return await this.pollForCompletion(statusUrl);

    }

    private async pollForCompletion(statusUrl: string): Promise<PreviewsResult> {
        const maxAttempts = 99; // approx 400 minutes
        let pollInterval = 5000;
        let customStatus = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {

            // implement exponential backoff
            pollInterval = Math.min(pollInterval * 1.2, 300_000); // max 5 minutes

            try {
                const response = await axios.get(statusUrl, {
                    timeout: 10000 // 10 second timeout
                });

                const status = response.data;
                customStatus = status.customStatus;

                // Check if completed
                if (status.runtimeStatus === 'Completed') {
                    return status.output as PreviewsResult;
                }

                // Check if failed
                if (status.runtimeStatus === 'Failed') {
                    const error = status.output || 'Unknown error';
                    throw new Error(`Azure function failed: ${error}`);
                }

                // Check if terminated
                if (status.runtimeStatus === 'Terminated') {
                    throw new Error('Azure function was terminated');
                }

                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, pollInterval));

            }
            catch (error) {
                
                await this.eventLogsService.createOne({
                    level: LogLevel.ERROR,
                    group: LogGroup.DOCUMENTS,
                    message: `Preview generation polling failed (${attempt}/${maxAttempts}): ${error.message}`,
                    stackTrace: error.stack,
                    properties: {
                        attempt,
                        maxAttempts
                    }
                });

                throw error;
            }
        }

        throw new Error(`Preview generation timed out after ${maxAttempts} polling attempts: ${customStatus}`);
    }

    private isRetryableError(error: unknown): boolean {

        const axiosError = error as AxiosError;
        const status = axiosError.response?.status ?? 0;

        // Network errors (timeout, connection issues)
        if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ECONNRESET' || axiosError.code === 'ENOTFOUND') {
            return true;
        }

        // HTTP 5xx errors (server errors) - retryable
        if (status >= 500 && status < 600) {
            return true;
        }

        // HTTP 429 (Too Many Requests) - retryable
        if (status === 429) {
            return true;
        }

        // HTTP 408 (Request Timeout) - retryable
        if (status === 408) {
            return true;
        }

        // HTTP 4xx errors (client errors) - generally not retryable
        if (status >= 400 && status < 500) {
            return false;
        }

        // Default to not retryable for unknown errors
        return false;
    }
}

// Interfaces

export interface PreviewsResult {
    conversion_id: string;
    pdf_filename: string;
    export_format: string;
    total_pages: number;
    pages: PreviewPage[];
}

export interface PreviewPage {
    page_number: number;
    width: number;
    height: number;
    format: string;
    url: string;
}