export type Document = {
    _id: string;
    userId: string;
    fileName: string;
    pageCount: number;
    summary: string;
    tokenCount: number;
    status: string;
    updatedAt: Date;
    signedUrl: string;
}