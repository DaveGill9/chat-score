import { SearchDocument } from "src/modules/shared/services/search.service";

export type DocumentChunk = SearchDocument & {
  userId: string;
  documentId: string;
  documentFileName: string;
  documentPageCount: number;
  documentNodeCount: number;
  documentTokenCount: number;
  documentSummary: string;
  nodeIndex: number;
  nodeSectionHeading: string;
  nodeContent: string;
  nodeTokenCount: number;
  nodePageNumber: number;
}