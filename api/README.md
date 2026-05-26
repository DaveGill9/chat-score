# ChatQA API

NestJS API for uploading and managing evaluation test sets, running chatbot evaluations, tracking background jobs, and administering users, personalities, and event logs.

## Overview

This service is the backend for the ChatQA project. It provides:

- health and readiness endpoints
- spreadsheet upload and conversion for test data
- asynchronous test-set execution against an external chatbot
- result retrieval, evaluation summaries, and file downloads
- basic admin-style CRUD for personalities, users, and event logs

The application uses MongoDB via Mongoose, Zod-based request validation, and bearer-token authentication backed by Microsoft identity tokens.

## Current Modules

- `health` - root status routes and common static responses such as `favicon.ico`
- `tests` - upload test sets, convert raw spreadsheets, list stored sets, and trigger runs
- `results` - list result sets, inspect a result set, retrieve its evaluation, and download exports
- `jobs` - in-memory job tracking plus an SSE stream for live progress
- `personalities` - CRUD for saved prompting personalities
- `users` - user lookup endpoints and auth bootstrap
- `event-logs` - create and query application event logs
- `parse` - shared CSV/XLS/XLSX parsing and export helpers

## Authentication

Authentication is enforced globally unless a route is marked public.

- Send `Authorization: Bearer <token>` for protected routes.
- Tokens are validated against Microsoft OpenID metadata.
- `MSAL_AUDIENCE` must match the token audience.
- `GET /auth/init` is public, but if a valid token is present it will create the user record on first access and return the current user.

Note: admin role mapping is currently hardcoded in `src/modules/users/services/auth.service.ts` via the `groupRoles` object. If Entra group IDs change, update that mapping in code.

## Public Routes

These endpoints are currently public:

- `GET /`
- `GET /healthz`
- `GET /favicon.ico`
- `GET /robots.txt`
- `GET /sitemap.xml`
- `GET /auth/init`
- all `tests` routes
- all `results` routes
- all `jobs` routes

Everything else requires a bearer token.

## API Routes

### Health

- `GET /` and `GET /healthz`
  Returns:

  ```json
  {
    "status": "OK",
    "version": "1",
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
  ```

- `GET /favicon.ico` returns an SVG favicon.
- `GET /robots.txt` returns `User-agent: *` and `Disallow: *`.
- `GET /sitemap.xml` returns an empty sitemap document.

### Tests

The test pipeline accepts spreadsheet uploads in `csv`, `xls`, or `xlsx` format.

- `POST /tests/upload`
  Stores a spreadsheet that is already in test format.
  Expects `multipart/form-data` with:
  - `file`
  - optional `name`
  - optional `project`

  Required columns in the spreadsheet:
  - `id`
  - `input`
  - `expected`

- `POST /tests/convert`
  Accepts a raw spreadsheet, converts it into test rows with OpenAI, stores the new test set, and returns a background `jobId`.
  Expects `multipart/form-data` with:
  - `file`
  - optional `name`
  - optional `project`
  - optional `prompt`

- `GET /tests/sets`
  Lists saved test sets.
  Query params:
  - `keywords`
  - `offset`
  - `limit`

- `GET /tests/sets/:testSetId`
  Returns the test set plus its stored test cases.

- `PATCH /tests/sets/:testSetId`
  Renames a test set.
  Body:

  ```json
  {
    "name": "New test set name"
  }
  ```

- `DELETE /tests/sets/:testSetId`
  Deletes the test set and its related results.

- `POST /tests/sets/:testSetId/run`
  Starts an asynchronous evaluation run for every case in the set.
  Returns metadata including a `jobId`, `resultSetId`, and the number of queued cases.

### Results

- `GET /results/sets`
  Lists result sets.
  Query params:
  - `keywords`
  - `setId`
  - `format` as `csv` or `xlsx`
  - `offset`
  - `limit`

- `GET /results/sets/:resultSetId`
  Returns the result set plus all stored result cases.

- `GET /results/sets/:resultSetId/evaluation`
  Returns the saved AI evaluation summary for the result set.

- `GET /results/sets/:resultSetId/download?format=xlsx`
  Downloads the result rows as `xlsx` or `csv`.

### Jobs

Jobs are kept in memory and are mainly used for long-running conversion and test-run workflows.

- `GET /jobs`
  Returns recent jobs.

- `GET /jobs/stream`
  Server-Sent Events stream of job updates.

  The response content type is `text/event-stream`, so this is suitable for a live progress UI.

### Personalities

Protected CRUD for saved prompting presets.

- `GET /personalities`
- `GET /personalities/:id`
- `POST /personalities`
- `PATCH /personalities/:id`
- `DELETE /personalities/:id`

Create/update payload fields:

- `name` - required on create, max 100 chars
- `description` - optional, max 255 chars
- `instructions` - required on create, max 4000 chars

### Users

Protected read-only user lookup.

- `GET /users`
- `GET /users/:id`

### Auth

- `GET /auth/init`
  If no valid token is provided, returns `null`.
  If a valid token is provided, returns the current user and creates the record if it does not already exist.

### Event Logs

Protected logging endpoints.

- `POST /event-logs`
- `POST /event-logs/bulk`
- `GET /event-logs`
- `GET /event-logs/:id`

## Data Model Summary

Main MongoDB collections used by this API:

- `test-sets` - uploaded test-set metadata such as name, original filename, and project
- `test-cases` - individual test cases linked to a test set
- `result-sets` - an execution record for a test run
- `result-cases` - one row of output per executed test case
- `evaluations` - AI-generated summaries for result sets
- `personalities` - reusable instruction presets
- `users` - authenticated users and their roles
- `event_logs` - application log records

All entities inherit shared base fields such as `_id`, `createdAt`, and `updatedAt`.

## Environment Variables

Environment variables are loaded from the repo root `.env` file via `envFilePath: '../.env'`.

### Required

- `MONGODB_URI` - MongoDB connection string
- `MSAL_AUDIENCE` - expected audience/client ID for incoming bearer tokens
- `OPENAI_API_KEY` - API key used for spreadsheet conversion, scoring, follow-up generation, and result evaluation
- `CHATBOT_URL` - target chatbot endpoint used during test execution
- `EVAL_API_KEY` - API key sent to the chatbot service

### Optional

- `PORT` - HTTP port, default `3000`
- `NODE_ENV` - when not `production`, local CORS is enabled
- `OPENAI_MODEL` - defaults to `gpt-4o-mini`
- `CHATBOT_FIELD` - request field name for chatbot input, default `message`
- `CHATBOT_ANSWER_FIELD` - response field name for chatbot output, default `answer`
- `CHATBOT_THREAD_ID_FIELD` - response field for a thread identifier, default `threadId`
- `CHATBOT_MAX_FOLLOWUP_TURNS` - max follow-up loop count, default `2`
- `CHATBOT_DELAY_MS` - wait time between chatbot calls, default `5000`
- `CHATBOT_RESPONSE_SEPARATOR` - separator used when concatenating responses, default `\n---\n`

`APP_VERSION` is injected automatically from `package.json` during config loading.

## Running Locally

From the `api` directory:

```bash
npm install
npm run start:dev
```

By default the API listens on `http://localhost:3000`.

In local development, CORS is enabled for:

- `http://localhost:5173`
- `http://localhost:5174`

Useful scripts:

```bash
npm run build
npm run start:prod
npm run start:debug
npm run lint
npm run test
npm run test:cov
npm run test:e2e
```

## Runtime Behavior

- rate limiting is enabled globally at `10` requests per `60` seconds
- gzip compression is enabled for responses larger than `1 KB`
- SSE responses are excluded from compression
- Helmet security headers are enabled
- request validation is handled with `ZodValidationPipe`
- HTTP errors are routed through a global exception filter

## Project Structure

```text
api/
  src/
    app.module.ts
    main.ts
    modules/
      health/
      jobs/
      parse/
      personalities/
      results/
      tests/
      users/
      event-logs/
    pipes/
    types/
    utils/
  package.json
```
