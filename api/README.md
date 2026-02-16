# API Documentation

NestJS-based REST API with WebSocket support for document processing, chat functionality, and user management.

## Table of Contents

- [API Endpoints](#api-endpoints)
- [WebSocket Events](#websocket-events)
- [Services](#services)
- [Utils](#utils)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [How to Run](#how-to-run)

## API Endpoints

### Health

**GET** `/`  
**GET** `/healthz`  
Returns health status and API version.

**Response:**
```json
{
  "status": "OK",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**GET** `/favicon.ico`  
Returns SVG favicon.

**GET** `/robots.txt`  
Returns robots.txt file (disallows all crawlers).

**GET** `/sitemap.xml`  
Returns empty sitemap XML.

---

### Chats

**POST** `/chats/upload`  
Upload a file (PDF or DOCX) for chat context.  
**Requires:** Authentication  
**Body:** `multipart/form-data` with `file` and `key` fields  
**Response:** `{ key: string, objectKey: string }`

**GET** `/chats/history`  
Fetch chat history for the authenticated user.  
**Requires:** Authentication  
**Query Parameters:** Filter options (see `FindChatsFilter`)  
**Response:** `ListChat[]`

**GET** `/chats/:chatId/messages`  
Get messages for a specific chat.  
**Requires:** Authentication  
**Path Parameters:** `chatId`  
**Query Parameters:** Filter options (see `FindChatMessagesFilter`)  
**Response:** `ChatMessage[]`

**POST** `/chats/:chatId/feedback`  
Add feedback (sentiment and comments) to a chat message.  
**Requires:** Authentication  
**Path Parameters:** `chatId`  
**Body:** `{ messageId: string, sentiment: 'good' | 'bad', comments?: string }`  
**Response:** `ChatMessage`

---

### Documents

**POST** `/documents`  
Create a new document record.  
**Requires:** Authentication  
**Body:** `{ fileName: string }`  
**Response:** `Document`

**GET** `/documents`  
List documents with optional filtering.  
**Query Parameters:** Filter options (see `FindDocumentsFilter`)  
**Response:** `Document[]`

**GET** `/documents/:id`  
Get a specific document with signed download URL.  
**Path Parameters:** `id`  
**Response:** `Document & { signedUrl: string }`

**DELETE** `/documents/:id`  
Delete a document.  
**Path Parameters:** `id`  
**Response:** `{ success: boolean }`

**POST** `/documents/:id/upload-data`  
Get signed upload URL for a document.  
**Path Parameters:** `id`  
**Body:** `{ fileName: string }`  
**Response:** `{ signedUrl: string }`

**GET** `/documents/citation`  
Get citation preview for a document chunk.  
**Query Parameters:** Filter options (see `FindChunkFilter`)  
**Response:** `CitationPreview`

**GET** `/documents/sharepoint/health`  
Health check for SharePoint integration.  
**Response:** `{ status: string }`

**GET** `/documents/sharepoint/sync`  
Trigger manual synchronization of documents from SharePoint.  
**Response:** `{ message: string }`  
**Note:** This endpoint triggers an async sync operation and returns immediately.

---

### Event Logs

**POST** `/event-logs`  
Create a single event log entry.  
**Body:** `CreateEventLog`  
**Response:** `EventLog`

**POST** `/event-logs/bulk`  
Create multiple event log entries.  
**Body:** `CreateEventLog[]`  
**Response:** `EventLog[]`

**GET** `/event-logs`  
Query event logs with filtering.  
**Query Parameters:** Filter options (see `FindEventLogsFilter`)  
**Response:** `ListEventLog[]`

**GET** `/event-logs/:id`  
Get a specific event log by ID.  
**Path Parameters:** `id`  
**Response:** `EventLog | null`

---

### Users

**GET** `/users`  
List users with optional filtering.  
**Query Parameters:** Filter options (see `FindUsersFilter`)  
**Response:** `User[]`

**GET** `/users/:id`  
Get a specific user by ID.  
**Path Parameters:** `id`  
**Response:** `User | null`

---

### Auth

**GET** `/auth/init`  
Create or retrieve current authenticated user.  
**Requires:** Authentication (optional - returns null if not authenticated)  
**Response:** `User | null`

---

## WebSocket Events

The API uses Socket.IO for real-time communication. Clients must authenticate by providing an `accessToken` in the handshake auth.

### Connection

**Authentication:** Include `accessToken` in the handshake auth object.

**Rooms:** Upon successful authentication, clients are automatically joined to a room matching their user ID (`user._id`).

### Events

**`ping`**  
**Requires:** Authentication  
**Response:** `'👍'`  
Simple health check endpoint.

**`chat`**  
**Requires:** Authentication, USER or ADMINISTRATOR role  
**Payload:** `CreateChatMessage`  
**Response:** `SocketResponse`  
Initiates a chat stream processing request. Emits responses to the user's room.

---

## Services

### Document Intelligence Service

Located at `api/src/modules/shared/services/document-intelligence.service.ts`

Service for extracting text and figures from documents using Azure Document Intelligence.

**Key Methods:**
- `extract(buffer: Buffer)` - Extracts text and layout from a document buffer
- `downloadFigure(figure: DocumentFigureOutput, resultId: string)` - Downloads extracted figures/images

**Features:**
- Uses Azure Document Intelligence prebuilt-layout model
- Supports figure extraction
- Automatic polling for long-running operations

---

### Email Service

Located at `api/src/modules/shared/services/email.service.ts`

Service for sending emails via Azure Communication Services.

**Key Methods:**
- `sendEmail(subject: string, html: string, recipients: EmailAddress | EmailAddress[], attachments?: Attachment[])` - Sends an email with optional attachments

**Features:**
- HTML email support
- Multiple recipients support
- Attachment support (base64 encoded)
- Uses Azure Communication Services Email API

---

### Error Handler Service

Located at `api/src/modules/shared/services/error-handler.service.ts`

Service for centralized error handling and logging.

**Features:**
- Handles unhandled promise rejections
- Handles uncaught exceptions
- Graceful shutdown handling (SIGTERM, SIGINT)
- Logs all errors to EventLogsService
- Includes application version in error logs

---

### OpenAI Service

Located at `api/src/modules/shared/services/openai.service.ts`

Service for interacting with Azure OpenAI, including embeddings, streaming responses, and JSON generation.

**Key Methods:**
- `generateEmbeddings(input: string[])` - Generates embeddings using text-embedding-3-large model
- `generateJSON<T>(params: GenerateJSONParams)` - Generates structured JSON output with Zod schema validation
- `generateStream(params: GenerateStreamParams)` - Generates streaming text responses with tool support
- `getTokenizerForModel(model: OpenAIModel)` - Gets tokenizer for token counting

**Features:**
- Azure OpenAI integration
- Streaming responses with tool calling support
- Vision support (base64 images)
- Structured output with Zod schemas
- Token counting with tiktoken
- Automatic retry with exponential backoff

---

### Retry Service

Located at `api/src/modules/shared/services/retry.service.ts`

Utility service for retrying failed operations with exponential backoff.

**Key Methods:**
- `retry<T>(fn: () => Promise<T>, tag: string, maxAttempts: number)` - Retries an async operation

**Features:**
- Exponential backoff with jitter
- Rate limit handling (429 status codes)
- Configurable max attempts (default: 3)
- Tagged logging for debugging

---

### Search Service

Located at `api/src/modules/shared/services/search.service.ts`

Service for interacting with Azure Cognitive Search.

**Key Methods:**
- `upsert<T>(documents: T[])` - Upserts documents to the search index (max 1000 per batch)
- `remove<T>(filters: Record<string, unknown>)` - Removes documents matching filters
- `hybridSearch<T>(keywordQuery: string, embedding: number[], filters?, offset?, limit?, searchFields?)` - Performs hybrid (keyword + vector) search
- `textSearch<T>(keywordQuery: string, filters?, offset?, limit?, searchFields?)` - Performs text-only search

**Features:**
- Hybrid search (semantic + vector search)
- OData filter support
- Automatic query sanitization
- Semantic search with extractive answers and captions
- Retry logic for resilient operations

---

### Storage Service

Located at `api/src/modules/shared/services/storage.service.ts`

Service for interacting with Azure Blob Storage.

**Key Methods:**
- `uploadBlob(file: Buffer, blobName: string, containerName?: StorageContainer)` - Uploads a blob
- `downloadBlob(blobName: string, containerName?: StorageContainer)` - Downloads a blob
- `streamBlob(blobName: string, containerName?: StorageContainer)` - Streams a blob
- `deleteBlob(blobName: string, containerName?: StorageContainer)` - Deletes a blob
- `generateSignedUrl(blobName: string, containerName?: StorageContainer, permission?: StoragePermissions, expiryMinutes?: number)` - Generates SAS signed URL

**Containers:**
- `documents` - Document storage (default)
- `uploads` - Temporary upload storage

**Permissions:**
- `r` - Read
- `w` - Write
- `rw` - Read + Write
- `tw` - Tag + Write
- `d` - Delete

---

### SharePoint Service

Located at `api/src/modules/documents/services/sharepoint.service.ts`

Service for synchronizing documents from Microsoft SharePoint document libraries using Microsoft Graph API.

**Key Methods:**
- `syncDocuments()` - Synchronizes documents from SharePoint library (runs daily via CRON)
- `healthCheck()` - Returns health status of SharePoint integration
- `getAllLibraryItems(library: SharePointLibrary, siteId: string)` - Retrieves all items from a SharePoint library
- `downloadBlob(siteId: string, driveId: string, itemId: string)` - Downloads a file from SharePoint

**Features:**
- Automatic daily synchronization via CRON job (midnight)
- Manual sync trigger via API endpoint
- Microsoft Graph API integration with app-only authentication
- Handles document additions and deletions
- Automatic document processing queue trigger for new documents
- Supports nested folder structures
- Combines list item metadata with drive item file information

**Authentication:**
- Uses Azure AD app-only authentication (client credentials flow)
- Requires `SHAREPOINT_CLIENT_ID`, `SHAREPOINT_CLIENT_SECRET`, and `SHAREPOINT_TENANT_ID`

**Sync Behavior:**
- Compares SharePoint library items with local documents
- Creates new documents for items found in SharePoint but not locally
- Deletes local documents that no longer exist in SharePoint
- Downloads files from SharePoint to Azure Blob Storage
- Automatically triggers document processing queue for new documents

---

## Utils

### get-app-version

Located at `api/src/utils/get-app-version.ts`

Utility function that reads the version from `package.json` by traversing up the directory tree.

**Usage:**
```typescript
import { getAppVersion } from './utils/get-app-version';
const version = getAppVersion(); // Returns version string from package.json
```

---

### get-mime-type

Located at `api/src/utils/get-mime-type.ts`

Utility function that returns MIME type based on file extension.

**Supported Types:**
- Images: jpg, jpeg, png, gif, svg
- Documents: pdf, doc, docx, xls, xlsx, ppt, pptx
- Audio: mp3, wav, flac
- Video: mp4, webm, ogg

**Usage:**
```typescript
import { getMimeType } from './utils/get-mime-type';
const mime = getMimeType('document.pdf'); // Returns 'application/pdf'
```

---

### nanoid

Located at `api/src/utils/nanoid.ts`

Utility functions for generating unique IDs.

**Exports:**
- `generateId()` - Custom alphabet nanoid generator (URL-safe, 21 characters)
- `nanoid()` - Default nanoid export

**Usage:**
```typescript
import { generateId, nanoid } from './utils/nanoid';
const id1 = generateId(); // Custom alphabet
const id2 = nanoid(); // Default nanoid
```

---

### string.utils

Located at `api/src/utils/string.utils.ts`

Collection of string manipulation utilities.

**Functions:**
- `stripHTML(input: string)` - Removes HTML tags
- `removeControlChars(input: string)` - Removes control characters
- `normaliseWhitespace(input: string)` - Normalizes whitespace
- `truncateLength(input: string, maxLength)` - Truncates to max length (default: 1000)
- `stripMarkdown(input: string)` - Removes markdown syntax
- `sanitizeInput(input: string)` - Comprehensive sanitization combining all above

**Usage:**
```typescript
import { sanitizeInput, stripHTML } from './utils/string.utils';
const clean = sanitizeInput(dirtyInput);
```

---

## Database Schema

The API uses MongoDB with Mongoose. All entities extend `BaseEntity` which includes:
- `_id: string` - Unique identifier
- `createdAt?: Date` - Creation timestamp (auto-generated)
- `updatedAt?: Date` - Update timestamp (auto-generated)

### Chats Collection

**Schema:** `Chat`  
**Collection:** `chats`

**Fields:**
- `userId: string` (required, maxlength: 100)
- `title: string` (required, maxlength: 200)

**Indexes:**
- `userId` (ascending)
- `createdAt` (descending)
- `title` (text index)

---

### Chat Messages Collection

**Schema:** `ChatMessage`  
**Collection:** `chat_messages`

**Fields:**
- `chatId: string` (required, maxlength: 100)
- `role: ChatMessageRole` (required, enum: 'user' | 'assistant')
- `content: string` (trimmed)
- `sentiment: 'good' | 'bad' | null` (optional)
- `comments: string` (optional, maxlength: 1000, default: '')
- `uploads: string[]` (optional, default: [])
- `status: ChatMessageStatus | null` (required, enum: 'pending' | 'working' | 'done' | 'error', default: null)

**Indexes:**
- `chatId` (ascending)
- `createdAt` (descending)
- `chatId + createdAt` (compound)
- `role + createdAt` (compound)
- `content` (text index)

---

### Documents Collection

**Schema:** `Document`  
**Collection:** `documents`

**Fields:**
- `userId: string` (required, maxlength: 100)
- `fileName: string` (required, maxlength: 200)
- `pageCount: number` (default: 0)
- `summary: string` (optional, maxlength: 1000)
- `tokenCount: number` (required, default: 0)
- `status: DocumentStatus` (required, enum: 'pending' | 'processing' | 'completed' | 'failed', default: 'pending')

**Indexes:**
- `userId` (ascending)
- `createdAt` (descending)
- `status` (ascending)
- `fileName + summary` (text index)

---

### Event Logs Collection

**Schema:** `EventLog`  
**Collection:** `event_logs`

**Fields:**
- `group: LogGroup` (required, enum values, default: 'general')
- `level: LogLevel` (required, enum values, default: 'info')
- `message: string` (required, maxlength: 1000)
- `stackTrace?: string` (optional, maxlength: 5000)
- `properties: Record<string, unknown>` (optional, default: {})

**Indexes:**
- `createdAt` (descending)
- `level + createdAt` (compound)
- `group + createdAt` (compound)
- `message + stackTrace` (text index)
- `createdAt` (TTL index, expires after 30 days)

---

### Users Collection

**Schema:** `User`  
**Collection:** `users`

**Fields:**
- `email: string` (optional, maxlength: 255)
- `displayName: string` (optional, maxlength: 100)
- `roles: Role[]` (optional, enum values, default: ['user'])

**Indexes:**
- `email` (ascending)
- `displayName` (ascending)
- `createdAt` (descending)
- `email + displayName` (text index)

---

## Environment Variables

All environment variables are loaded via `ConfigService` from `.env` file located at `../.env` (relative to the `api` directory).

### Required Variables

**MongoDB:**
- `MONGODB_URI` - MongoDB connection string (e.g., `mongodb://localhost:27017/database`)

**Azure OpenAI:**
- `OPENAI_KEY` - Azure OpenAI API key
- `OPENAI_ENDPOINT` - Azure OpenAI endpoint URL

**Azure Document Intelligence:**
- `DOCUMENT_INTELLIGENCE_ENDPOINT` - Document Intelligence endpoint URL
- `DOCUMENT_INTELLIGENCE_KEY` - Document Intelligence API key

**Azure Search:**
- `SEARCH_ENDPOINT` - Azure Cognitive Search endpoint URL
- `SEARCH_KEY` - Azure Cognitive Search API key

**Azure Storage:**
- `STORAGE_ACCOUNT_NAME` - Storage account name
- `STORAGE_ACCOUNT_KEY` - Storage account access key

**Azure Email (Communication Services):**
- `EMAIL_CONNECTION_STRING` - Azure Communication Services connection string
- `EMAIL_DEFAULT_SENDER` - Default sender email address

**Authentication (MSAL):**
- `MSAL_AUDIENCE` - Microsoft identity platform application audience/client ID

**SharePoint Integration:**
- `SHAREPOINT_CLIENT_ID` - Azure AD application (client) ID for SharePoint access
- `SHAREPOINT_CLIENT_SECRET` - Azure AD application client secret
- `SHAREPOINT_TENANT_ID` - Azure AD tenant ID
- `SHAREPOINT_LIBRARY_URL` - Full URL to the SharePoint document library to sync (e.g., `https://tenant.sharepoint.com/sites/SiteName/Shared Documents`)

### Optional Variables

- `PORT` - Server port (default: `3000`)
- `APP_VERSION` - Application version (auto-populated from `package.json` if not set)
- `SEARCH_INDEX_NAME` - Azure Cognitive Search index name (default: `'nodes_index'`)

### Example .env File

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/myapp

# Azure OpenAI
OPENAI_KEY=your-openai-key
OPENAI_ENDPOINT=https://your-resource.openai.azure.com

# Azure Document Intelligence
DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com
DOCUMENT_INTELLIGENCE_KEY=your-document-intelligence-key

# Azure Search
SEARCH_ENDPOINT=https://your-resource.search.windows.net
SEARCH_KEY=your-search-key
SEARCH_INDEX_NAME=nodes_index

# Azure Storage
STORAGE_ACCOUNT_NAME=yourstorageaccount
STORAGE_ACCOUNT_KEY=your-storage-key

# Azure Email
EMAIL_CONNECTION_STRING=endpoint=https://your-resource.communication.azure.com/;accesskey=your-key
EMAIL_DEFAULT_SENDER=DoNotReply@yourdomain.com

# Authentication
MSAL_AUDIENCE=your-client-id-guid

# SharePoint Integration
SHAREPOINT_CLIENT_ID=your-sharepoint-client-id
SHAREPOINT_CLIENT_SECRET=your-sharepoint-client-secret
SHAREPOINT_TENANT_ID=your-tenant-id
SHAREPOINT_LIBRARY_URL=https://tenant.sharepoint.com/sites/SiteName/Shared Documents

# Optional
PORT=3000
```

---

## How to Run

### Prerequisites

- Node.js (v18 or higher recommended)
- MongoDB instance
- Azure services configured (OpenAI, Storage, Search, Document Intelligence, Email)
- `.env` file configured with all required variables

### Installation

```bash
cd api
npm install
```

### Development

```bash
npm run start:dev
```

Starts the application in watch mode with hot reload. The API will be available at `http://localhost:3000` (or the port specified in `PORT` env variable).

### Debug Mode

```bash
npm run start:debug
```

Starts the application in debug mode with watch enabled. Use with VS Code debugger or Chrome DevTools.

### Production Build

```bash
npm run build
npm run start:prod
```

Builds the TypeScript code and runs the compiled JavaScript.

### Other Commands

```bash
# Format code
npm run format

# Lint code
npm run lint

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e
```

### API Features

- **Rate Limiting:** 10 requests per 60 seconds per IP
- **Compression:** Responses are compressed (gzip) for requests > 1KB
- **Security:** Helmet.js security headers enabled
- **CORS:** Managed at infrastructure level (not in application)
- **Error Handling:** Global exception filter logs all errors to EventLogs
- **Authentication:** JWT-based authentication via Microsoft Identity Platform (MSAL)
- **Validation:** Request validation using Zod schemas

### Application Structure

```
api/
├── src/
│   ├── modules/          # Feature modules (chats, documents, users, etc.)
│   │   └── shared/       # Shared services (OpenAI, Storage, Search, etc.)
│   ├── utils/            # Utility functions
│   ├── pipes/            # Validation pipes
│   ├── types/            # Shared TypeScript types
│   ├── app.module.ts     # Root module
│   └── main.ts           # Application entry point
├── dist/                 # Compiled JavaScript (generated)
└── package.json
```



