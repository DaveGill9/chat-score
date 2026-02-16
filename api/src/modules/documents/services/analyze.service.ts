import { Injectable, Logger } from "@nestjs/common";
import { DocumentFigureOutput, DocumentParagraphOutput, DocumentTableCellOutput, DocumentTableOutput } from "@azure-rest/ai-document-intelligence";
import { BoundingRegionOutput, DocumentSpanOutput } from "@azure-rest/ai-document-intelligence";
import { AnalyzeResult, DocumentIntelligenceService } from "src/modules/shared/services/document-intelligence.service";
import { StorageService } from "src/modules/shared/services/storage.service";
import { EventLogsService } from "src/modules/event-logs/services/event-logs.service";
import { LogLevel } from "src/modules/event-logs/enums/log-level.enum";
import { LogGroup } from "src/modules/event-logs/enums/log-group.enum";
import { z } from "zod";
import { OpenAIService } from "src/modules/shared/services/openai.service";
import { generateId } from "src/utils/nanoid";
import { Document } from "src/modules/documents/entities/document.entity";

interface SpanInterval {
    start: number;
    end: number;
}

interface Dimensions {
    width: number;
    height: number;
}

interface ProcessedFigure extends DocumentFigureOutput {
    pageNumber: number;
    process: boolean;
    isSmall: boolean;
    isHeader: boolean;
    isFooter: boolean;
    dimensionsPixels?: {
        width: number;
        height: number;
    };
    positionPercentage?: {
        topPercent: number;
        bottomPercent: number;
    };
    boundingBoxPixels?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    description?: string;
    keywords?: string[];
    classification?: string;
    ocrText?: string;
}

export interface DocumentNode {
    id: string;
    index: number; 
    sectionHeading: string; 
    content: string;
    pageNumber: number; 
    tokens: number;
    leafNodes: DocumentElement[];
    embedding?: number[];
}

interface DocumentElement {
    role: string;
    pageNumber: number;
    content: string;
    html?: string;
    figureId?: string;
    boundingRegions?: BoundingRegionOutput[];
    spans?: DocumentSpanOutput[];
    tokens?: number;
}

export interface DocumentEmbedding {
    id: string;
    text: string;
    embedding: number[];
}

const FigureDescriptionSchema = z.object({
    description: z.string(),
    keywords: z.array(z.string()),
    classification: z.string(),
    ocrText: z.string()
});

type FigureDescription = z.infer<typeof FigureDescriptionSchema>;

@Injectable()
export class AnalyzeService {
    private readonly logger = new Logger(AnalyzeService.name);

    constructor(        
        private readonly storageService: StorageService, 
        private readonly documentIntelligenceService: DocumentIntelligenceService, 
        private readonly eventLogsService: EventLogsService,
        private readonly openAIService: OpenAIService
    ) {}

    public async process(document: Document, fileBuffer: Buffer): Promise<DocumentNode[]> {
        const runner = new AnalyzeRunner(
            document._id, 
            document.fileName, 
            fileBuffer, 
            this.storageService, 
            this.documentIntelligenceService, 
            this.eventLogsService,
            this.openAIService,
            this.logger);
        return await runner.run();
    }

}

export class AnalyzeRunner {

    private analyzeResult: AnalyzeResult;

    constructor(
        private readonly documentId: string, 
        private readonly fileName: string,
        private readonly fileBuffer: Buffer,
        private readonly storageService: StorageService, 
        private readonly documentIntelligenceService: DocumentIntelligenceService, 
        private readonly eventLogsService: EventLogsService,
        private readonly openAIService: OpenAIService,
        private readonly logger: Logger
    ) { }

    // #region Helper Methods

    private async log(message: string, level: LogLevel = LogLevel.INFO): Promise<void> {
        this.logger.log(`${this.fileName} - ${message}`);
        await this.eventLogsService.createOne({
            level,
            group: LogGroup.DOCUMENTS,
            message: `${this.fileName} - ${message}`,
            properties: { 
                documentId: this.documentId
            }
        });
    }

    private async getCachedResponse<T>(fileName: string): Promise<T | null> {
        const objectKey = `${this.documentId}/working/${fileName}`;
        const cachedResponse = await this.storageService.downloadBlob(objectKey, 'documents');
        if (cachedResponse) {
            return JSON.parse(cachedResponse.toString()) as T;
        }
        return null;
    }

    private async setCachedResponse<T>(fileName: string, response: T): Promise<void> {
        const objectKey = `${this.documentId}/working/${fileName}`;
        const responseBuffer = Buffer.from(JSON.stringify(response));
        await this.storageService.uploadBlob(responseBuffer, objectKey, 'documents');
    }

    // #endregion

    public async run(): Promise<DocumentNode[]> {
        // extract document and download figures with document intelligence
        this.analyzeResult = await this.analyzeDocument();
        
        // review figures from document intelligence
        const figures = await this.reviewFigures();
        this.analyzeResult.figures = (this.analyzeResult.figures ?? []).map(f => {
            const content = figures.find(figure => figure.id === f.id)?.description || '';
            return {
                ...f,
                caption: {
                    content,
                    spans: [{
                        offset: 0,
                        length: content.length
                    }]
                }
            }
        });

        // generate the nodes array
        let nodes = await this.getNodes();
        nodes = await this.splitNodesIfRequired(nodes);

        // generate node embeddings
        nodes = await this.generateEmbeddings(nodes);

        // return the nodes array
        return nodes;
    }

    // #region Document Analysis

    private async analyzeDocument(): Promise<AnalyzeResult> {
        // check if the analyze result is already cached
        const fileName = 'analyze-result.json';
        const cachedResponse = await this.getCachedResponse<AnalyzeResult>(fileName);
        if (cachedResponse) {
            return cachedResponse;
        }

        // if not, analyze the document with document intelligence
        const analyzeResult = await this.documentIntelligenceService.extract(this.fileBuffer);

        // extract figures (these are only available for 24 hours after analysis)
        const figures = analyzeResult.figures ?? [];
        for (const figure of figures) {
            try {
                const figureBuffer = await this.documentIntelligenceService.downloadFigure(figure, analyzeResult.resultId);
                const figureBlobName = `${this.documentId}/figures/${figure.id}.png`;
                await this.storageService.uploadBlob(figureBuffer!, figureBlobName, 'documents');
            } catch (error) {
                this.log(`Error downloading figure: ${error.message}`, LogLevel.ERROR);
            }
        }

        // upload the analyze result to azure storage
        await this.setCachedResponse(fileName, analyzeResult);

        return analyzeResult;
    }

    // #endregion

    // #region Figures

    private readonly HEADER_THRESHOLD = 0.20; // Top 20%
    private readonly FOOTER_THRESHOLD = 0.80; // Bottom 80% (i.e., bottom 20%)
    private readonly MIN_SIZE_THRESHOLD_1 = { width: 450, height: 100 }; // Less than 450px width AND less than 100px height
    private readonly MIN_SIZE_THRESHOLD_2 = { width: 270, height: 270 }; // Less than 270px x 270px

    private async reviewFigures(): Promise<ProcessedFigure[]> {
        const figures = this.analyzeResult.figures ?? [];

        // check if the figures are already cached
        const fileName = 'figures.json';
        const cachedResponse = await this.getCachedResponse<ProcessedFigure[]>(fileName);
        if (cachedResponse) {
            return cachedResponse;
        }

        if (figures.length === 0)
            return [];

        try {

            // log start
            await this.log(`Starting figure review`);

            // get page dimensions
            const pageDimensions = this.getPageDimensions();

            // review figures: determine if they should be processed, create a description for each figure
            const processedFigures: ProcessedFigure[] = [];
            for (const figure of figures) {
                const processedFigure = await this.processSingleFigure(figure, pageDimensions);
                processedFigures.push(processedFigure);
            }

            // upload processed figures json to azure storage
            await this.setCachedResponse(fileName, processedFigures);

            // add to log
            const processCount = processedFigures.filter(f => f.process).length;
            await this.log(`Described ${processCount}/${figures.length} figures`);

            return processedFigures;

        } 
        catch (error) {
            await this.log(`Error reviewing figures: ${error.message}`, LogLevel.ERROR);
            throw error;
        }
    }

    private getPageDimensions(): Map<number, Dimensions> {
        const pageDimensions = new Map<number, Dimensions>();
       
        const pages = this.analyzeResult.pages ?? [];
        for (const page of pages) {
            // Page dimensions are typically in points, we'll need to convert or estimate
            // For now, we'll use standard letter size as default and adjust based on content
            let pageWidth = 612; // Standard letter width in points
            let pageHeight = 792; // Standard letter height in points

            // Try to infer dimensions from page content if available
            if (page.width && page.height) {
                pageWidth = page.width;
                pageHeight = page.height;
            }

            pageDimensions.set(page.pageNumber, {
                width: pageWidth,
                height: pageHeight
            });
        }

        return pageDimensions;
    }

    private async processSingleFigure(
        figure: DocumentFigureOutput,
        pageDimensions: Map<number, Dimensions>
    ): Promise<ProcessedFigure> {

        // Initialize processed figure with original data
        const processedFigure: ProcessedFigure = {
            ...figure,
            process: true, // Default to true, will be set based on filtering logic
            isSmall: false,
            isHeader: false,
            isFooter: false,
            pageNumber: 0
        };

        try {
            // download figure from azure storage
            const blobName = `${this.documentId}/figures/${figure.id}.png`;
            const figureBuffer = await this.storageService.downloadBlob(blobName, 'documents');
            if (!figureBuffer) {
                throw new Error('Failed to download figure from storage');
            }

            // Get figure file dimensions
            const dimensions = await this.getImageDimensions(figureBuffer);
            processedFigure.dimensionsPixels = dimensions;

            // Check size thresholds
            const isSmall = this.checkIfSmall(dimensions);
            processedFigure.isSmall = isSmall;

            // Process bounding box and position if available
            if (figure.boundingRegions && figure.boundingRegions.length > 0) {
                const boundingRegion = figure.boundingRegions[0]; // Use first bounding region
                const pageNum = boundingRegion.pageNumber;
                const pageDim = pageDimensions.get(pageNum);

                if (pageDim) {
                    // Convert polygon coordinates to bounding box
                    const boundingBox = this.polygonToBoundingBox(boundingRegion.polygon);
                    processedFigure.boundingBoxPixels = boundingBox;

                    // Calculate position percentages
                    const positionPercentage = this.calculatePositionPercentage(boundingBox, pageDim);
                    processedFigure.positionPercentage = positionPercentage;

                    // Check header/footer flags
                    processedFigure.isHeader = positionPercentage.topPercent <= this.HEADER_THRESHOLD;
                    processedFigure.isFooter = positionPercentage.bottomPercent >= this.FOOTER_THRESHOLD;

                    // get the page number
                    processedFigure.pageNumber = pageNum;
                }
            }

            // Apply filtering logic
            processedFigure.process = this.shouldProcessFigure(processedFigure);

            // describe figure
            if (processedFigure.process) {

                // get page preview
                const pageBlobName = `${this.documentId}/previews/${processedFigure.pageNumber}.jpg`;
                const pageBuffer = await this.storageService.downloadBlob(pageBlobName, 'documents');
                const pageBase64 = pageBuffer?.toString('base64');

                const figureBase64 = figureBuffer?.toString('base64');

                const images = [figureBase64, pageBase64].filter(base64 => base64 !== undefined);

                const figureDescription = await this.describeFigure(images);                
                processedFigure.description = figureDescription?.description;
                processedFigure.keywords = figureDescription?.keywords;
                processedFigure.classification = figureDescription?.classification;
                processedFigure.ocrText = figureDescription?.ocrText;
            }

        } 
        catch {
            // If we can't process the figure, default to not processing it
            processedFigure.process = false;
        }

        return processedFigure;
    }

    private async getImageDimensions(buffer: Buffer): Promise<Dimensions> {
        try {
            // PNG signature check
            if (buffer.length < 24 || !buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
                throw new Error('Invalid PNG file');
            }

            // IHDR chunk starts at byte 8, dimensions at bytes 16-23
            const width = buffer.readUInt32BE(16);
            const height = buffer.readUInt32BE(20);

            return { width, height };

        } catch {
            return { width: 0, height: 0 };
        }
    }

    private async describeFigure(base64Images: string[]): Promise<FigureDescription> {

        const systemPrompt = `
### Instructions

You are given two images:
- The **first image** is a figure (e.g. photo, graph, table, diagram, etc.) extracted from a document.
- The **second image** is the full page the figure was extracted from.

Your task is to generate a structured summary of the figure. Use the full page image for additional context, such as figure captions, section headings, or surrounding explanatory text.

3. **Classification**  
   Classify the figure using **one** of the following values:
   - *photo*: Real-world photographic image.
   - *graph*: Data visualisation with axes (e.g. line graph, scatter plot).
   - *table*: Structured data in rows and columns.
   - *diagram*: Schematic or illustrative drawing (e.g. flowchart, circuit, anatomy).
   - *chart*: High-level visualisation like pie or bar charts (not time-series).
   - *image*: Generic image not easily classifiable as any of the above.
   - *figure*: Catch-all if none of the above clearly apply.

   ⚠ Use *figure* **only** as a fallback when the image doesn't clearly belong to any other category.

4. **OCR Text**  
   Extract all text **visible within the figure itself**, not the surrounding page.  
   If no text is present in the figure, return an empty string.

5. **Spelling and Grammar**  
   Use **Australian English** throughout.   
        `.trim();
        
        try {
            const response = await this.openAIService.generateJSON<FigureDescription>({
                systemPrompt,
                prompt: 'Describe the figure',
                base64Images,
                outputSchema: FigureDescriptionSchema
            });
            return response;
        }
        catch (error) {
            throw new Error(`Error describing figure: ${error.message}`);
        }
    }

    private checkIfSmall(dimensions: { width: number; height: number }): boolean {
        const condition1 = dimensions.width < this.MIN_SIZE_THRESHOLD_1.width &&
            dimensions.height < this.MIN_SIZE_THRESHOLD_1.height;

        const condition2 = dimensions.width < this.MIN_SIZE_THRESHOLD_2.width &&
            dimensions.height < this.MIN_SIZE_THRESHOLD_2.height;

        return condition1 || condition2;
    }

    private polygonToBoundingBox(polygon: number[]): { x: number; y: number;  width: number; height: number; } {
        // Polygon is an array of coordinates [x1, y1, x2, y2, x3, y3, x4, y4]
        // Find min/max to create bounding box
        const xCoords: number[] = [];
        const yCoords: number[] = [];

        for (let i = 0; i < polygon.length; i += 2) {
            xCoords.push(polygon[i]);
            yCoords.push(polygon[i + 1]);
        }

        const minX = Math.min(...xCoords);
        const maxX = Math.max(...xCoords);
        const minY = Math.min(...yCoords);
        const maxY = Math.max(...yCoords);

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    private calculatePositionPercentage(
        boundingBox: { x: number; y: number; width: number; height: number },
        pageDimensions: Dimensions
    ): { topPercent: number; bottomPercent: number } {
        const topPercent = boundingBox.y / pageDimensions.height;
        const bottomPercent = (boundingBox.y + boundingBox.height) / pageDimensions.height;

        return { topPercent, bottomPercent };
    }

    private shouldProcessFigure(figure: ProcessedFigure): boolean {
        // Only check if the figure is too small
        // If not small, process it regardless of header/footer position

        if (figure.isSmall)
            return false;

        return true;
    }

    // #endregion

    // #region Document Synthesis

    private async getNodes(): Promise<DocumentNode[]> {

        const { tables = [], figures = [], paragraphs = [] } = this.analyzeResult;

        // 1) Build & merge all table-span intervals for efficient overlap detection
        let spans: SpanInterval[] = tables
            .flatMap(tbl => tbl.spans || [])
            .map(s => ({ start: s.offset, end: s.offset + s.length }));

        spans.sort((a, b) => a.start - b.start);

        // Merge overlapping intervals
        const merged: SpanInterval[] = [];
        for (const interval of spans) {
            const last = merged[merged.length - 1];
            if (!last || interval.start > last.end) {
                merged.push({ ...interval });
            } else {
                last.end = Math.max(last.end, interval.end);
            }
        }

        // 2) Filter paragraphs that don't overlap with any table span
        const parasOutsideTables: DocumentParagraphOutput[] = paragraphs.filter(el =>
            !((el.spans || []).some(span => this.hasOverlap(span.offset, span.length, merged)))
        );

        // 5) Pre-group each table's cells by row index for efficient processing
        const cellGroups = new WeakMap<DocumentTableOutput, Map<number, DocumentTableCellOutput[]>>();
        for (const tbl of tables) {
            const rowMap = new Map<number, DocumentTableCellOutput[]>();
            for (const cell of tbl.cells) {
                if (!rowMap.has(cell.rowIndex)) {
                    rowMap.set(cell.rowIndex, []);
                }
                rowMap.get(cell.rowIndex)!.push(cell);
            }
            cellGroups.set(tbl, rowMap);
        }

        // 3) Build the full elements list
        const elements: DocumentElement[] = [
            ...parasOutsideTables.map(el => ({
                role: el.role || "paragraph",
                pageNumber: el.boundingRegions?.[0]?.pageNumber || 1,
                content: el.content,
                boundingRegions: el.boundingRegions,
                spans: el.spans
            })),
            ...tables.map(tbl => ({
                role: "table",
                pageNumber: tbl.boundingRegions?.[0]?.pageNumber || 1,
                content: this.tableToText(tbl, cellGroups),
                html: this.tableToHtml(tbl, cellGroups),
                boundingRegions: tbl.boundingRegions,
                spans: tbl.spans
            })),
            ...figures.map(f => ({
                role: "figure",
                pageNumber: f.boundingRegions?.[0]?.pageNumber || 1,
                content: f.caption?.content || '',
                figureId: f.id,
                boundingRegions: f.boundingRegions,
                spans: f.spans
            })),
        ];

        // 4) Single sort by page & Y position
        elements.sort((a, b) => {
            const getPage = (x: DocumentElement) => x.boundingRegions?.[0]?.pageNumber ?? 0;
            const getY = (x: DocumentElement) => x.boundingRegions?.[0]?.polygon?.[1] ?? 0;

            const pA = getPage(a), pB = getPage(b);
            if (pA !== pB) return pA - pB;
            return getY(a) - getY(b);
        });

        // 7) Filter out unwanted elements
        const final = elements.filter(el =>
            !["pageFooter", "pageNumber", "pageHeader"].includes(el.role)
        );

        // return final elements
        return this.groupSections(final)
    }

    // Binary search style overlap detection
    private hasOverlap(offset: number, length: number, mergedIntervals: SpanInterval[]): boolean {
        let lo = 0, hi = mergedIntervals.length - 1;
        const targetEnd = offset + length;

        while (lo <= hi) {
            const mid = (lo + hi) >>> 1;
            const interval = mergedIntervals[mid];

            if (interval.end <= offset) {
                lo = mid + 1;
            } else if (interval.start >= targetEnd) {
                hi = mid - 1;
            } else {
                return true; // overlap found!
            }
        }
        return false;
    }

    // Convert table to text using pre-grouped cells
    private tableToText(table: DocumentTableOutput, cellGroups: WeakMap<DocumentTableOutput, Map<number, DocumentTableCellOutput[]>>): string {
        const rows: string[] = [];
        const byRow = cellGroups.get(table);

        if (!byRow) return '';

        for (let i = 0; i < table.rowCount; i++) {
            const cells = (byRow.get(i) || []).sort((a, b) => a.columnIndex - b.columnIndex);
            rows.push(cells.map(c => c.content.trim()).join(" | "));
        }

        return rows.join("\n");
    }

    // Convert table to HTML using pre-grouped cells
    private tableToHtml(table: DocumentTableOutput, cellGroups: WeakMap<DocumentTableOutput, Map<number, DocumentTableCellOutput[]>>): string {
        let html = "<table>";
        const byRow = cellGroups.get(table);

        if (!byRow) return "<table></table>";

        for (let i = 0; i < table.rowCount; i++) {
            html += "<tr>";
            const cells = (byRow.get(i) || []).sort((a, b) => a.columnIndex - b.columnIndex);

            for (const cell of cells) {
                const tag = (cell.kind === "columnHeader" || cell.kind === "rowHeader") ? "th" : "td";
                let spanAttrs = "";
                if (cell.columnSpan && cell.columnSpan > 1) {
                    spanAttrs += ` colspan="${cell.columnSpan}"`;
                }
                if (cell.rowSpan && cell.rowSpan > 1) {
                    spanAttrs += ` rowspan="${cell.rowSpan}"`;
                }
                html += `<${tag}${spanAttrs}>${this.escapeHtml(cell.content)}</${tag}>`;
            }
            html += "</tr>";
        }

        return html + "</table>";
    }

    // Escape HTML characters
    private escapeHtml(unsafe: string): string {
        return unsafe.replace(/[&<>"']/g, ch =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[ch] || ch
        );
    }

    // Generate document nodes from elements
    public groupSections(leafNodes: DocumentElement[]): DocumentNode[] {
        const groupedSections: DocumentNode[] = [];
        let currentSection: DocumentNode | null = null;
        let lastRole: string | null = null;
        let makingHeading: boolean = false;
        let nodeIndex: number = 0;

        // Helper function to create a section
        const createSection = (node: DocumentElement, nodeIndex: number): DocumentNode => {
            return {
                id: generateId(),
                index: nodeIndex,
                pageNumber: node.pageNumber,
                sectionHeading: '',
                content: '',
                tokens: 0,
                leafNodes: [],
            };
        };

        leafNodes.forEach(node => {
            if (node.role === 'sectionHeading' || node.role === 'title') {
                // If we were making content (not a heading), push the current section before starting a new one
                if (!makingHeading && currentSection) {
                    groupedSections.push(currentSection);
                    currentSection = null;
                }

                makingHeading = true;

                if (!currentSection || (lastRole !== 'sectionHeading' && lastRole !== 'title')) {
                    // Start a new section if there isn't an active section or the last node was not a heading or title
                    currentSection = createSection(node, nodeIndex);
                    nodeIndex++;
                    // Set the sectionHeading to the current heading's content
                    currentSection.sectionHeading = node.content;
                } else if (currentSection) {
                    // Concatenate headings for consecutive 'sectionHeading' or 'title'
                    currentSection.sectionHeading += " | " + node.content;
                }
            } else {
                // Handle non-heading nodes (paragraphs, tables, figures, etc.)
                if (!currentSection) {
                    currentSection = createSection(node, nodeIndex++);
                }
                
                makingHeading = false;
                // Add the current node to the section content
                if (node.role === 'figure' && node.figureId) {
                    // Add image markdown for figures
                    const imageMarkdown = `![${node.content}](/${this.documentId}/figures/${node.figureId}.png)`;
                    node.content = imageMarkdown;
                }

                currentSection.content += node.content + " ";
                const tokens = this.openAIService.getTokenizerForModel('gpt-4.1').encode(node.content).length;

                currentSection.tokens += tokens;
                currentSection.leafNodes.push({ ...node, tokens });
            }

            // Keep track of the last role
            lastRole = node.role;
        });

        // Add the last section if it exists
        if (currentSection) {
            groupedSections.push(currentSection);
        }

        return groupedSections;
    }

    // #endregion

    // #region Document Embeddings

    private async splitNodesIfRequired(nodes: DocumentNode[]): Promise<DocumentNode[]> {
        if (nodes.length === 0) {
            return [];
        }

        const MAX_TOKENS_PER_INPUT = 8_192;
        const badNodes = nodes.filter(node => node.tokens > MAX_TOKENS_PER_INPUT);
        if (badNodes.length === 0) {
            return nodes;
        }

        // create a new nodes array with the good nodes
        const goodNodes = nodes.filter(node => node.tokens <= MAX_TOKENS_PER_INPUT);

        // split the bad nodes into smaller nodes
        const tokenizer = this.openAIService.getTokenizerForModel('text-embedding-3-large');
        const OVERLAP_TOKENS = 100;
        
        for (const node of badNodes) {
            // loop through the node content and split it into smaller nodes with an overlap 
            let encodedContent = tokenizer.encode(node.content);
            let offset = 0;
            while (offset < encodedContent.length) {
                const endOffset = Math.min(offset + MAX_TOKENS_PER_INPUT, encodedContent.length);
                const chunk = encodedContent.slice(offset, endOffset);
                
                if (chunk.length === 0) {
                    break;
                }

                const decoded = tokenizer.decode(chunk);
                // Convert to string if needed (tiktoken decode returns Uint8Array, but TypeScript types may vary)
                const chunkText = typeof decoded === 'string' ? decoded : new TextDecoder().decode(decoded);
                const chunkTokens = chunk.length;
                
                // Create new node with updated properties
                // Keep the same index to maintain ordering - split nodes should appear in the same position
                const splitNode: DocumentNode = {
                    ...node,
                    content: chunkText,
                    tokens: chunkTokens,
                };
                
                goodNodes.push(splitNode);

                // Calculate next offset with overlap, ensuring we always advance
                const advanceAmount = Math.max(1, chunk.length - OVERLAP_TOKENS);
                offset += advanceAmount;
                
                // Safety check to prevent infinite loops
                if (advanceAmount <= 0) {
                    break;
                }
            }
        }

        return goodNodes;
    }

    private async generateEmbeddings(nodes: DocumentNode[]): Promise<DocumentNode[]> {     
        if (nodes.length === 0) {
            return [];
        }

        // check if the embeddings are already cached
        const fileName = 'embeddings-nodes.json';
        const cachedResponse = await this.getCachedResponse<DocumentNode[]>(fileName);
        if (cachedResponse) {
            return cachedResponse;
        }

        const updatedNodes: DocumentNode[] = [];
        // Create a copy to avoid mutating the input array
        const remainingNodes = [...nodes];

        // generate the embeddings
        const MAX_INPUTS_PER_BATCH = 2_048;
        const MAX_TOKENS_PER_BATCH = 300_000; // Fixed typo: was 300_00 (30,000)

        while (remainingNodes.length > 0) {
            const batch: DocumentNode[] = [];
            let batchTokens = 0;

            while (remainingNodes.length > 0) {
                const nextNode = remainingNodes[0];
                
                // Check if adding this node would exceed token limit
                const tokensWithNext = batchTokens + nextNode.tokens;
                if (tokensWithNext > MAX_TOKENS_PER_BATCH) {
                    // If batch is empty and single node exceeds limit, process it anyway
                    // (it should have been split by splitNodesIfRequired, but handle gracefully)
                    if (batch.length === 0) {
                        this.logger.warn(
                            `Node with ${nextNode.tokens} tokens exceeds MAX_TOKENS_PER_BATCH (${MAX_TOKENS_PER_BATCH}). ` +
                            `Processing anyway. Consider splitting this node.`
                        );
                        batch.push(remainingNodes.shift()!);
                    }
                    break;
                }

                // Check if adding this node would exceed input count limit
                if (batch.length >= MAX_INPUTS_PER_BATCH) {
                    break;
                }

                // Add node to batch
                const node = remainingNodes.shift()!;
                batch.push(node);
                batchTokens += node.tokens;
            }

            // Process batch if it has nodes
            if (batch.length > 0) {
                try {
                    // generate the embeddings for the batch
                    const embeddings = await this.openAIService.generateEmbeddings(batch.map(node => node.content));
                    embeddings.forEach((embedding, idx) => {
                        batch[idx].embedding = embedding;
                        updatedNodes.push(batch[idx]);
                    });
                } catch (error) {
                    this.logger.error(`Error generating embeddings for batch: ${error.message}`, error.stack);
                    throw error;
                }
            }
        }

        // upload the embeddings to azure storage
        await this.setCachedResponse(fileName, updatedNodes);

        // return the updated nodes
        return updatedNodes;
    }

    // #endregion

}