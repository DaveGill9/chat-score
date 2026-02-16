import type { Chat } from './Chat';

/**
 * Event map defining all available events and their payload types
 * Extend this interface to add new events
 * 
 * @example
 * ```typescript
 * declare module '../types/events' {
 *   interface EventMap {
 *     'article:created': ArticleEntity;
 *     'article:updated': ArticleEntity;
 *     'article:deleted': { id: string };
 *   }
 * }
 * ```
 */
export interface EventMap {
  // Chat events
  'chat:updated': Chat;
  
  // Generic data change events
  'data:changed': { type: string; id?: string };

  // Document events
  'document-deleted': { documentId: string };
}

