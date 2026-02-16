import { OpenAIService } from "src/modules/shared/services/openai.service";
import { StorageService } from "src/modules/shared/services/storage.service";
import { DocumentNode } from "./analyze.service";
import { z } from "zod";
import { Injectable } from "@nestjs/common";

@Injectable()
export class SummaryService {
    
    constructor(
        private readonly storageService: StorageService,
        private readonly openAIService: OpenAIService
    ) {}

    async generate(documentId: string, nodes: DocumentNode[]): Promise<string> {
        const objectKey = `${documentId}/working/summary.txt`;
        const cachedResponse = await this.storageService.downloadBlob(objectKey, 'documents');
        if (cachedResponse) {
            return cachedResponse.toString();
        }

        // if not, generate the summary
        const summary = await this.generateSummaryRecursive(nodes);

        // upload the summary to azure storage
        const responseBuffer = Buffer.from(summary);
        await this.storageService.uploadBlob(responseBuffer, objectKey, 'documents');

        return summary;
    }

    private async generateSummaryRecursive(elements: DocumentNode[]): Promise<string> {

        // create batches
        const MAX_TOKENS_PER_BATCH = 100_000;
        const descriptions: string[] = [""];
        const remainingElements: DocumentNode[] = [...elements];
        let batchTokens = 0;
        while (remainingElements.length > 0) {
            const nextElement = remainingElements[0];
            if (batchTokens + nextElement.tokens > MAX_TOKENS_PER_BATCH) {
                descriptions.push("");
                batchTokens = 0;
            }
            descriptions[descriptions.length - 1] += nextElement.content + "\n\n";
            batchTokens += nextElement.tokens;
            remainingElements.shift();
        }

        // Process all parts recursively to create a comprehensive summary
        let longSummary: string = "";
        if (descriptions.length > 0) {
            longSummary = await this.processDescriptions(descriptions);
        }

        return longSummary;
    }

    private async processDescriptions(descriptions: string[]): Promise<string> {
        // No parts - return empty string
        if (descriptions.length === 0) {
            return "";
        }

        // Single part - summarize directly
        if (descriptions.length === 1) {
            return await this.gptSummary(descriptions[0]);
        }

        // Multiple parts - process recursively
        let currentSummary = await this.gptSummary(descriptions[0]);

        for (let i = 1; i < descriptions.length; i++) {
            const nextPart = descriptions[i];
            currentSummary = await this.combineSummaryWithContent(currentSummary, nextPart);
        }

        return currentSummary;
    }

    private async combineSummaryWithContent(previousSummary: string, newContent: string): Promise<string> {  
        
        const outputSchema = z.object({
            summary: z.string()
        });        

        const systemPrompt = `
## Summary Combination

You are tasked with creating a comprehensive summary by combining a previous summary with new content. 
Your goal is to create a unified summary that captures the key points from both the previous summary and the new content.
The final summary should be clear, accurate, and no longer than a paragraph. Always use Australian English spelling.

## Output

Please create a comprehensive summary that combines both the previous summary and the new content.
        `;

        const prompt = `
## Previous Summary

${previousSummary}

## New Content

${newContent}
        `;

        try {
            const result = await this.openAIService.generateJSON<z.infer<typeof outputSchema>>({
                systemPrompt,
                prompt,
                outputSchema
            });
            return result?.summary || previousSummary;
        }
        catch (error) {
            throw new Error(`Error combining summary with content: ${error.message}`);
        }
    }

    private async gptSummary(text: string): Promise<string> {    
        
        const outputSchema = z.object({
            summary: z.string()
        });      

        const systemPrompt = `
## Summary

Please read the following document and provide a concise summary. 
Highlight the main points, key findings, and any significant details. 
The summary should be clear, accurate, and no longer than a paragraph. 
Always use Australian English spelling.
        `;

        const prompt = `
## Document

${text}
        `;

        try {
            const result = await this.openAIService.generateJSON<z.infer<typeof outputSchema>>({
                systemPrompt,
                prompt,
                outputSchema
            });
            return result?.summary || "";
        }
        catch (error) {
            throw new Error(`Error generating summary: ${error.message}`);
        }
    }
}