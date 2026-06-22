# ChatQA

ChatQA is a full-stack QA harness for testing chatbot behavior at scale.

It lets you upload spreadsheet-based test sets, run them against a chatbot HTTP endpoint, score each response with an LLM, and review the results in a web dashboard. The app is designed for prompt tuning, regression testing, and identifying recurring failure patterns across many conversations.

## What the Project Does

ChatQA follows a simple workflow:

1. Upload a CSV or Excel file containing chatbot test cases.
2. Optionally convert an arbitrary spreadsheet into the canonical test format with AI.
3. Run the test set against a target chatbot endpoint.
4. Score each actual response against the expected response.
5. Review run-level summaries, failure patterns, and suggestions for improvement.

This repository is a monorepo containing:

- `api/src/modules/demo/`: Public demo endpoints for local testing workflows.
- `api/`: NestJS backend for uploads, test execution, scoring, evaluations, personalities, jobs, logs, and auth.
- `spa/`: React frontend for managing test sets and viewing results.

## Core Features

- Upload test sets from `.csv`, `.xlsx`, or `.xls`.
- Accept canonical test rows with required `id`, `input`, and `expected` fields.
- Preserve extra spreadsheet columns and pass them through to the chatbot endpoint as request context.
- Convert arbitrary spreadsheets into the canonical test format using OpenAI.
- Manage reusable chatbot personalities/configurations through the API.
- Run test sets asynchronously with live job progress via server-sent events.
- Support follow-up turns when the chatbot asks clarifying questions.
- Score each result from `0.0` to `1.0` with short reasoning.
- Generate run-level AI summaries covering what went well, what went wrong, patterns, and suggestions.
- Browse historical runs and download result sets.
- View application event logs in the UI.
- Support Microsoft auth, with optional auth bypass for local development.

## How It Works

```text
Spreadsheet test set
        |
        v
Upload or AI convert to canonical format
        |
        v
API runs each test case against configured chatbot endpoint
        |
        v
OpenAI scores actual vs expected output
        |
        v
Result set + evaluation summary stored in MongoDB
        |
        v
SPA shows test sets, runs, evaluations, logs, and job progress
```

### Canonical Test Format

Each test row must include:

- `id`
- `input`
- `expected`

Any additional columns are retained and sent to the chatbot endpoint alongside the input. That makes it possible to include project identifiers, metadata, user profile fields, or other request context in the source spreadsheet.

Example:

```csv
id,input,expected,project,region
1,What are your support hours?,Support is available Monday to Friday 9am to 5pm,helpdesk,AU
2,Reset my password,Instructions for resetting a password,helpdesk,AU
```

## Tech Stack

### Backend

- NestJS
- TypeScript
- MongoDB with Mongoose
- OpenAI API for conversion, scoring, and run evaluation

### Frontend

- React
- Vite
- TypeScript
- React Router
- SCSS modules

### Optional Auth

- Microsoft Identity Platform via MSAL

## Project Structure

```text
chatqa/
|-- api/                         # NestJS API
|   |-- src/modules/personalities/
|   |-- src/modules/tests/       # Upload, convert, run test sets
|   |-- src/modules/results/     # Stored runs and evaluations
|   |-- src/modules/jobs/        # Background job progress + SSE stream
|   |-- src/modules/event-logs/  # Structured app event logs
|   |-- src/modules/users/       # Auth + user records
|   |-- src/modules/parse/       # Spreadsheet parsing utilities
|   `-- src/modules/health/
|-- spa/                         # React dashboard
|   |-- src/pages/dashboard/     # Test sets and run controls
|   |-- src/pages/results/       # Result details and evaluation summary
|   `-- src/pages/logs/          # Event log viewer
`-- README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- MongoDB
- An OpenAI API key
- A chatbot HTTP endpoint to evaluate

### Install Dependencies

```bash
cd api
npm install

cd ../spa
npm install
```

### Configure Environment

The repo uses a shared root `.env` file. The API reads `../.env`, and the SPA uses the repo root as its `envDir`.

Minimal local setup:

```env
MONGODB_URI=mongodb://localhost:27017/chatqa

CHATBOT_URL=http://localhost:3000/demo/mock-chatbot
EVAL_API_KEY=your-chatbot-api-key

OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4o-mini

VITE_API_URL=http://localhost:3000
VITE_DISABLE_AUTH=true
VITE_PORT=5174
```

If you want Microsoft auth enabled locally, also set:

```env
VITE_MSAL_CLIENT_ID=
VITE_MSAL_TENANT_ID=
MSAL_AUDIENCE=
```

### Start the App

Start the API and SPA in separate terminals.

API:

```bash
cd api
npm run start:dev
```

SPA:

```bash
cd spa
npm run dev
```

Default local URLs:

- SPA: `http://localhost:5174`
- API: `http://localhost:3000`
- Health check: `http://localhost:3000/healthz`
- Demo chatbot endpoint: `POST http://localhost:3000/demo/mock-chatbot`

In development, the API enables CORS for `http://localhost:5173` and `http://localhost:5174`.

If you're using `nvm-windows`, make sure the shell you use to start the app can access the active Node installation.

## Environment Variables

All variables live in the root `.env`.

### Required for Core Workflow

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `CHATBOT_URL` | Target chatbot HTTP endpoint |
| `EVAL_API_KEY` | API key sent to the chatbot as `X-API-Key` |
| `OPENAI_API_KEY` | Used for format conversion, scoring, and run evaluation |
| `VITE_API_URL` | Base URL for the SPA to call the API |

### Common Optional Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model used for conversion, scoring, and evaluation |
| `CHATBOT_FIELD` | `message` | Request field used for chatbot input |
| `CHATBOT_ANSWER_FIELD` | `answer` | Response field containing the chatbot reply |
| `CHATBOT_THREAD_ID_FIELD` | `threadId` | Response/request field used to continue follow-up turns |
| `CHATBOT_MAX_FOLLOWUP_TURNS` | `2` | Maximum follow-up turns per test case |
| `CHATBOT_DELAY_MS` | `5000` | Delay between follow-up calls |
| `CHATBOT_RESPONSE_SEPARATOR` | `\n---\n` | Separator used when combining multi-turn responses |
| `APP_VERSION` | derived from package version | Version returned by health endpoints and startup logs |
| `PORT` | `3000` | API port |
| `NODE_ENV` | `development` | Runtime environment |
| `VITE_PORT` | `5174` | SPA dev and preview port |
| `VITE_DISABLE_AUTH` | `false` | Skip login in the SPA for local development |

## Local Mock Chatbot

For demos and local testing, the API includes a public mock chatbot endpoint that follows the same basic contract as the target bot integration.

Endpoint:

```text
POST /demo/mock-chatbot
```

Example request:

```json
{
  "message": "What are your support hours?",
  "threadId": "thread-123",
  "project": "helpdesk",
  "region": "AU"
}
```

Example response:

```json
{
  "answer": "Mock response for \"What are your support hours?\". Context received: project, region.",
  "threadId": "thread-123"
}
```

If `threadId` is omitted, the endpoint generates one automatically. Extra fields are ignored by the mock response logic, but they are detected so you can verify that ChatQA is sending spreadsheet context through to the chatbot layer.

### Auth Variables

Only needed when running with Microsoft auth enabled:

| Variable | Purpose |
| --- | --- |
| `VITE_MSAL_CLIENT_ID` | SPA app registration client ID |
| `VITE_MSAL_TENANT_ID` | Microsoft tenant ID |
| `MSAL_AUDIENCE` | Expected audience for API token validation |

## Main API Endpoints

### Test Sets

- `POST /tests/upload`
- `POST /tests/convert`
- `GET /tests/sets`
- `GET /tests/sets/:testSetId`
- `PATCH /tests/sets/:testSetId`
- `DELETE /tests/sets/:testSetId`
- `POST /tests/sets/:testSetId/run`

### Results

- `GET /results/sets`
- `GET /results/sets/:resultSetId`
- `GET /results/sets/:resultSetId/evaluation`
- `GET /results/sets/:resultSetId/download?format=csv|xlsx`

### Personalities

- `GET /personalities`
- `GET /personalities/:id`
- `POST /personalities`
- `PATCH /personalities/:id`
- `DELETE /personalities/:id`

### Event Logs

- `GET /event-logs`
- `GET /event-logs/:id`
- `POST /event-logs`
- `POST /event-logs/bulk`

### Auth and Users

- `GET /auth/init`
- `GET /users`
- `GET /users/:id`

### Jobs and Health

- `GET /jobs`
- `GET /jobs/stream`
- `GET /`
- `GET /healthz`
- `POST /demo/mock-chatbot`

## Development Notes

- The dashboard is the main entry point and focuses on uploading test sets, running tests, and reviewing results.
- The backend also exposes CRUD endpoints for personalities plus lightweight auth and user endpoints.
- Result evaluations are generated after a run completes and summarize both strengths and recurring failures.
- Jobs are long-running and surfaced live to the SPA through SSE.
- Event logs are available in the UI for troubleshooting failures and unexpected behavior.

## Scripts

### API

```bash
cd api
npm run start:dev
npm run build
npm run test
npm run lint
```

### SPA

```bash
cd spa
npm run dev
npm run build
npm run lint
```

## License

Proprietary.
