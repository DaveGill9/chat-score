import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { RetryService } from './retry.service';
import { SearchClient, AzureKeyCredential, SelectFields } from '@azure/search-documents';

export interface SearchDocument {
  id: string;
  embedding: number[];
}

export interface SearchResult<T extends SearchDocument = SearchDocument> {
  value: T[];
  count: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly indexName: string;

  constructor(
    private configService: ConfigService,
    private retryService: RetryService
  ) {
    this.endpoint = this.configService.get<string>('SEARCH_ENDPOINT') || '';
    this.apiKey = this.configService.get<string>('SEARCH_KEY') || '';
    this.indexName = this.configService.get<string>('SEARCH_INDEX_NAME') || 'nodes_index';

    if (!this.endpoint || !this.apiKey) {
      this.logger.warn('Azure Search configuration is incomplete');
    }
  }

  private getClient<T extends SearchDocument = SearchDocument>(): SearchClient<T> {
    return new SearchClient<T>(
      this.endpoint,
      this.indexName,
      new AzureKeyCredential(this.apiKey)
    );
  }

  // #region CRUD Operations

  async upsert<T extends SearchDocument = SearchDocument>(documents: T[]): Promise<number> {
    const client = this.getClient<T>();
    const batchSize = 1000;
    let upsertCount = 0;
    for (let i = 0; i < documents.length; i += batchSize) {
      const slice = documents.slice(i, i + batchSize);
      const result = await client.mergeOrUploadDocuments(slice);
      upsertCount += result.results.filter(r => r.succeeded).length;
    }
    return upsertCount;
  }

  async remove<T extends SearchDocument = SearchDocument>(filters: Record<string, unknown>): Promise<number> {
    const client = this.getClient<T>();
    const filterString = this.buildODataFilter(filters);
    if (!filterString) {
      throw new Error('No filters provided');
    }

    const ids: string[] = [];
    const keyField = 'id' as SelectFields<T>;

    const results = await client.search("", {
      filter: filterString,
      select: [keyField],
      includeTotalCount: false,
      top: 1000
    });

    for await (const r of results.results) {
      ids.push((r.document as T).id);
    }

    const batchSize = 1000;
    for (let i = 0; i < ids.length; i += batchSize) {
      const slice = ids.slice(i, i + batchSize);
      await client.deleteDocuments('id', slice);
    }

    return ids.length;
  }

  // #endregion

  // #region Search Operations

  async getDocument<T extends object = object>(id: string): Promise<T> {
    const url = `${this.endpoint}/indexes/${this.indexName}/docs/${id}?api-version=2024-07-01`;
    const headers = {
      'Content-Type': 'application/json',
      'api-key': this.apiKey,
    };
    return this.retryService.retry<T>(async () => {
      const response = await axios.get(url, { headers });
      return response.data as T;
    }, 'get-document');
  }

  async hybridSearch<T extends SearchDocument = SearchDocument>(
    keywordQuery: string,
    embedding: number[],
    filters?: Record<string, unknown>,
    offset: number = 0,
    limit: number = 10,
    searchFields?: string[]
  ): Promise<SearchResult<T>> {
    const url = `${this.endpoint}/indexes/${this.indexName}/docs/search?api-version=2024-07-01`;

    const filterString = this.buildODataFilter(filters);

    const body: Record<string, unknown> = {
      search: this.sanitiseQuery(keywordQuery),
      filter: filterString || "",
      vectorFilterMode: "postFilter",
      vectorQueries: [
        {
          kind: "vector",
          vector: embedding,
          k: limit,
          fields: "embedding",
          oversampling: limit * 2
        },
      ],
      count: true,
      skip: offset,
      top: limit,
      queryType: "semantic",
      semanticConfiguration: "default",
      answers: "extractive",
      captions: "extractive",
    };

    if (searchFields && searchFields.length > 0) {
      body.searchFields = searchFields.join(',');
    }

    const headers = {
      'Content-Type': 'application/json',
      'api-key': this.apiKey,
    };

    return this.retryService.retry<SearchResult<T>>(async () => {
      const response = await axios.post(url, body, { headers });  
      const count = response.data['@odata.count'] as number;  
      return {
        count,
        value: response.data.value as T[]
      }
    }, 'hybrid-search');
  }

  async textSearch<T extends SearchDocument = SearchDocument>(
    keywordQuery: string,
    filters?: Record<string, unknown>,
    offset: number = 0,
    limit: number = 10,
    searchFields?: string[],
  ): Promise<SearchResult<T>> {
    const url = `${this.endpoint}/indexes/${this.indexName}/docs/search?api-version=2024-07-01`;

    const filterString = this.buildODataFilter(filters);

    const body: Record<string, unknown> = {
      search: this.sanitiseQuery(keywordQuery),
      filter: filterString || "",
      count: true,
      skip: offset,
      top: limit,
      queryType: "full",
    };

    if (searchFields && searchFields.length > 0) {
      body.searchFields = searchFields.join(',');
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'api-key': this.apiKey,
    };

    return this.retryService.retry<SearchResult<T>>(async () => {
      const response = await axios.post(url, body, { headers });
      const count = response.data['@odata.count'] as number;
      return {
        count,
        value: response.data.value as T[]
      }
    }, 'text-search');
  }

  // #endregion

  // #region Helper Methods

  private sanitiseQuery(raw: string): string {
    if (!raw) return "";

    // Trim invisible and control characters
    let q = raw.trim().replace(/[\u0000-\u001F\u007F]+/g, ""); // eslint-disable-line no-control-regex

    // Replace smart quotes with normal ones
    q = q.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

    // Escape existing quotes if unbalanced
    const quoteCount = (q.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      // Unbalanced: remove stray quotes or close them
      if (q.startsWith('"') && !q.endsWith('"')) q += '"';
      else if (!q.startsWith('"') && q.endsWith('"')) q = `"${q}`;
      else q = q.replace(/"/g, ''); // remove broken ones
    }

    // Collapse repeated whitespace
    q = q.replace(/\s+/g, " ");

    // Optionally, escape remaining JSON specials
    q = q.replace(/[\\]/g, "\\\\").replace(/"/g, '\\"');

    return q;
  }  

  private buildODataFilter(filters?: Record<string, unknown>): string | null {
    if (!filters) return null;

    const escapeODataString = (value: string): string => value.replace(/'/g, "''");

    const eqClause = (field: string, value: unknown): string => {
      if (typeof value === 'boolean') {
        return `${field} eq ${value}`;
      }
      if (typeof value === 'number') {
        return `${field} eq ${value}`;
      }
      return `${field} eq '${escapeODataString(String(value))}'`;
    };

    const containsClause = (field: string, value: unknown): string => {
      if (typeof value === 'boolean') {
        return `${field}/any(c: c eq ${value})`;
      }
      if (typeof value === 'number') {
        return `${field}/any(c: c eq ${value})`;
      }
      return `${field}/any(c: c eq '${escapeODataString(String(value))}')`;
    };

    const flattened = this.flattenObject(filters);

    const clauses = Object.entries(flattened)
      .filter(([, v]) => v !== null && v !== undefined && (typeof v === 'boolean' || v !== ''))
      .map(([field, value]) => {
        // Special handling for document_collections field - use contains operation
        if (field === 'document_collections') {
          if (Array.isArray(value)) {
            if (value.length === 0) return null; // ignore empty arrays
            const orGroup = value.map(v => containsClause(field, v));
            return `(${orGroup.join(' or ')})`;
          }
          return containsClause(field, value);
        }

        // Default handling for other fields
        if (Array.isArray(value)) {
          if (value.length === 0) return null; // ignore empty arrays
          const orGroup = value.map(v => eqClause(field, v));
          // Parenthesise to keep correct precedence when combined with ANDs
          return `(${orGroup.join(' or ')})`;
        }
        return eqClause(field, value);
      })
      .filter((c): c is string => !!c);

    return clauses.length > 0 ? clauses.join(' and ') : '';
  }

  private flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
    const flattened: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        Object.assign(flattened, this.flattenObject(value as Record<string, unknown>, newKey));
      } else {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }

  // #endregion
}