import DocumentIntelligence, {
    DocumentIntelligenceClient,
    isUnexpected,
    getLongRunningPoller,
    AnalyzeResultOutput,
    DocumentFigureOutput,
    AnalyzeOperationOutput,
} from '@azure-rest/ai-document-intelligence';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AnalyzeResult = AnalyzeResultOutput & { resultId: string };

@Injectable()
export class DocumentIntelligenceService {
    private logger = new Logger(DocumentIntelligenceService.name);
    private documentIntelligenceEndpoint: string;
    private documentIntelligenceApiKey: string;
    private client: DocumentIntelligenceClient;
    private modelId: string = "prebuilt-layout";
    private apiVersion: string = "2024-11-30";

    constructor(private configService: ConfigService) {
        this.documentIntelligenceEndpoint = this.configService.get<string>('DOCUMENT_INTELLIGENCE_ENDPOINT', '');
        this.documentIntelligenceApiKey = this.configService.get<string>('DOCUMENT_INTELLIGENCE_KEY', '');

        if (!this.documentIntelligenceEndpoint || !this.documentIntelligenceApiKey) {
            this.logger.warn('Azure Document Intelligence configuration is incomplete');
        }
        this.client = DocumentIntelligence(this.documentIntelligenceEndpoint, { key: this.documentIntelligenceApiKey });
    }

    public async extract(buffer: Buffer): Promise<AnalyzeResult> {
        try {
            this.logger.log(`Analysing document: ${Math.round(buffer.length / 1024)} KB`);

            // Submit the document for analysis with figures output
            const initialResponse = await this.client
                .path("/documentModels/{modelId}:analyze", this.modelId)
                .post({
                    queryParameters: {
                        output: ["figures"],
                        "api-version": this.apiVersion
                    },
                    contentType: "application/octet-stream",
                    body: buffer,
                });

            if (isUnexpected(initialResponse)) {
                throw new Error(
                    `Analysis failed: ${JSON.stringify(initialResponse.body.error)}`
                );
            }

            // Get resultId from operation-location header
            const operationLocation = initialResponse.headers["operation-location"];
            let resultId = operationLocation.split("/").pop();
            resultId = resultId?.split("?")[0];
            if (!resultId) {
                throw new Error("No resultId found in the response.");
            }

            // Poll for the result
            const poller = getLongRunningPoller(this.client, initialResponse);
            const resultResponse = await poller.pollUntilDone();

            const responseBody = resultResponse.body as AnalyzeOperationOutput;
            if (!responseBody.analyzeResult) {
                throw new Error("No analyzeResult found in the response.");
            }

            // Done
            return {
                ...responseBody.analyzeResult,
                resultId
            };

        } catch (error) {
            this.logger.error("Error extracting document:", error);
            throw error;
        }
    }

    public async downloadFigure(figure: DocumentFigureOutput, resultId: string): Promise<Buffer | null> {
        try {
            const figureId = figure.id;
            if (!figureId) {
                throw new Error("No figureId found in the figure.");
            }

            const figureResponse = await this.client
                .path(
                    "/documentModels/{modelId}/analyzeResults/{resultId}/figures/{figureId}",
                    this.modelId,
                    resultId,
                    figureId
                )
                .get({
                    queryParameters: { "api-version": this.apiVersion },
                })
                .asNodeStream();

            if (!figureResponse.body) {
                throw new Error("No figure response found in the response.");
            }

            return await this.streamToBuffer(figureResponse.body);
        } catch (error) {
            this.logger.error(`Error downloading figure ${figure.id}:`, error);
            return null;
        }
    }

    private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
        const chunks: Buffer[] = [];

        return new Promise<Buffer>((resolve, reject) => {
            stream.on('data', (chunk: Buffer | string) => {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });

            stream.on('end', () => {
                resolve(Buffer.concat(chunks));
            });

            stream.on('error', (err) => {
                reject(err);
            });
        });
    }

}