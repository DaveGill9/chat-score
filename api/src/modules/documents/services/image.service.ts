import { Injectable } from "@nestjs/common";
import { OpenAIService } from "src/modules/shared/services/openai.service";
import z from "zod";

export const ImageDescriptionSchema = z.object({
    description: z.string(),
    keywords: z.array(z.string()),
    classification: z.string(),
    ocrText: z.string()
});

export type ImageDescription = z.infer<typeof ImageDescriptionSchema>;

interface NodeContent {
    content: string;
    tokenCount: number;
}

@Injectable()
export class ImageService {

    constructor(
        private readonly openAIService: OpenAIService,
    ) { }
    
    async createNodeContent(imageDescription: ImageDescription, filePath: string): Promise<NodeContent> {
        const content = `
# Image
![Image](${filePath})

### Image Description
${imageDescription.description}

### Keywords
${imageDescription.keywords.join(', ')}

### Classification
${imageDescription.classification}

### OCR Text
${imageDescription.ocrText}
        `;

        const tokenCount = this.openAIService.getTokenizerForModel('gpt-4.1').encode(content).length;
        return { content, tokenCount };
    }

    async createEmbeddings(input: string): Promise<number[]> {
        const embeddings = await this.openAIService.generateEmbeddings([input]);
        return embeddings[0];
    }

    async describe(buffer: Buffer): Promise<ImageDescription> {

        const systemPrompt = `
### Instructions

You are given an image from a document library.

3. **Classification**  
   Classify the figure using **one** of the following values:
   - *photo*: Real-world photographic image.
   - *graph*: Data visualisation with axes (e.g. line graph, scatter plot).
   - *table*: Structured data in rows and columns.
   - *diagram*: Schematic or illustrative drawing (e.g. flowchart, circuit, anatomy).
   - *chart*: High-level visualisation like pie or bar charts (not time-series).
   - *image*: Generic image not easily classifiable as any of the above.
   - *figure*: Catch-all if none of the above clearly apply.

Use *figure* **only** as a fallback when the image doesn't clearly belong to any other category.

4. **OCR Text**  
   Extract all text **visible within the figure itself**, not the surrounding page.  
   If no text is present in the figure, return an empty string.

5. **Spelling and Grammar**  
   Use **Australian English** throughout.   
        `.trim();

        const prompt = "Describe the image";

        const base64Images = [ buffer.toString('base64') ];
        
        try {
            const response = await this.openAIService.generateJSON<ImageDescription>({
                systemPrompt,
                prompt,
                base64Images,
                outputSchema: ImageDescriptionSchema
            });
            
            return response;
        }
        catch (error) {
            throw new Error(`Error describing figure: ${error.message}`);
        }
    }
}