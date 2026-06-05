# ChatQA SPA

React + Vite frontend for managing test sets, monitoring background jobs, reviewing result sets, browsing event logs, and editing reusable AI personalities.

## Overview

The SPA is the operator interface for ChatQA. It is built around the current backend workflow:

- upload test spreadsheets
- convert raw spreadsheets into test format with AI
- start asynchronous test runs
- watch job progress in real time
- inspect result sets and AI-generated evaluations
- browse event logs
- manage reusable personalities used when generating inputs

The app uses React 19, TypeScript, React Router, MSAL authentication, and a small set of custom hooks/providers for user state, jobs state, theming, and toasts.

## Current Pages

- `/` - dashboard for test-set upload, conversion, preview, run history, and quick actions
- `/results/:resultSetId` - result detail view with row-by-row browsing, evaluation modal, and download actions
- `/logs` - searchable event log list
- `/logs/:id` - log detail view
- `/personalities` - searchable CRUD screen for reusable AI personalities

If authentication is enabled and the user is not signed in, the app shows a Microsoft login screen instead of the routed UI.

## Main Features

### Dashboard

The dashboard is the primary workflow screen.

- uploads files directly to `POST /tests/upload`
- opens a convert dialog that sends raw spreadsheets to `POST /tests/convert`
- lists stored test sets and recent runs
- supports search, sorting, preview, rename, delete, and run actions
- refreshes automatically when background jobs complete

Accepted file formats:

- `csv`
- `xls`
- `xlsx`

Test-set previews show the parsed rows, including any extra columns stored as additional context.

### Jobs Sidebar

The left navigation includes a live jobs panel.

- initial job data is loaded from `GET /jobs`
- live updates come from `GET /jobs/stream` via `EventSource`
- job cards show queue/running/completed/failed state plus detail text from the API

This is SSE-based, not WebSocket-based.

### Result Review

The result detail page:

- loads a result set from `GET /results/sets/:resultSetId`
- displays rows in a carousel-style review UI
- fetches the saved evaluation summary from `GET /results/sets/:resultSetId/evaluation`
- supports download as CSV, XLSX, or printable PDF

The evaluation modal renders the sections currently returned by the API:

- `summary`
- `whatWentWell`
- `whatWentWrong`
- `patterns`
- `suggestions`

### Logs

The logs area is a searchable event-log browser backed by `/event-logs`.

- keyword search
- infinite scrolling / paged loading
- detail page for a single log entry
- level and group badges pulled from API data

### Personalities

The personalities page manages reusable prompt instructions for AI-generated test inputs.

- create, edit, delete
- search by keyword
- fields: `name`, optional `description`, and `instructions`

The UI notes that these instructions are layered on top of the existing OpenAI system prompt.

## Authentication

By default the SPA expects Microsoft authentication to be enabled.

- MSAL is configured with `VITE_MSAL_CLIENT_ID` and `VITE_MSAL_TENANT_ID`
- login uses `loginPopup()`
- API requests acquire an access token and attach `Authorization: Bearer <token>`
- a `401` response triggers logout via MSAL
- the frontend initializes the current user through `GET /auth/init`

There is also a local bypass mode:

- set `VITE_DISABLE_AUTH=true` to skip the login gate and token injection

That is useful for local development when the API is running without auth requirements.

## Environment Variables

The Vite config reads env vars from the repo root with `envDir: '../'`.

### Required

- `VITE_API_URL` - base URL for the backend API
- `VITE_MSAL_CLIENT_ID` - Microsoft app/client ID
- `VITE_MSAL_TENANT_ID` - Microsoft tenant ID

### Optional

- `VITE_PORT` - dev and preview server port, default `5174`
- `VITE_DISABLE_AUTH` - when set to `true`, disables the login requirement and token injection

Example:

```env
VITE_API_URL=http://localhost:3000
VITE_MSAL_CLIENT_ID=your-client-id
VITE_MSAL_TENANT_ID=your-tenant-id
VITE_PORT=5174
VITE_DISABLE_AUTH=false
```

## Running Locally

From the `spa` directory:

```bash
npm install
npm run dev
```

By default the dev server runs on `http://localhost:5174` because the project uses a strict explicit port in `vite.config.ts`.

Make sure the backend API is running and that `VITE_API_URL` points to it.

Useful scripts:

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Build and PWA Behavior

The project uses `vite-plugin-pwa`.

- a service worker is registered on startup
- the app can notify the user when a newer version is available
- update checks run periodically after registration
- when the user accepts an update, the waiting service worker is activated and the page reloads

Production builds are created with:

```bash
npm run build
```

This runs TypeScript project builds and then Vite production bundling.

## Tech Stack

### Core

- React 19
- TypeScript
- Vite 7
- React Router 7
- SCSS modules

### Key Libraries

- `@azure/msal-browser` for authentication
- `axios` for API requests
- `framer-motion` for transitions and animated detail panels
- `date-fns` for date formatting
- `vite-plugin-pwa` for service worker and update flow
- `embla-carousel-react`, `react-markdown`, and remark plugins for result review

## Project Structure

```text
spa/
  src/
    components/
      button/
      chip/
      feedback/
      icon/
      input/
      layout/
      loading/
      navigation/
      popover/
      toast/
    context/
      JobsContext.tsx
      JobsProvider.tsx
      UserContext.tsx
      UserProvider.tsx
    hooks/
    pages/
      dashboard/
      error/
      login/
      logs/
      personalities/
      results/
    router/
      routes.tsx
    services/
      api-client.ts
      auth-service.ts
      msal-config.ts
      theme-service.ts
      toast-service.tsx
    styles/
    utils/
    App.tsx
    main.tsx
  public/
  vite.config.ts
  package.json
```

## App Architecture

### Providers

- `UserProvider` initializes the signed-in user and exposes auth state
- `JobsProvider` loads recent jobs and subscribes to the jobs SSE stream
- the router is mounted once in `main.tsx` and renders `App` plus global popover/toast containers

### App Shell

- `App.tsx` applies theme and PWA update hooks
- when auth is enabled, it blocks on user initialization and shows the login page when unauthenticated
- the main shell renders navigation, routed content, and a shared popover container

### Data Access

- `api-client.ts` centralizes the API base URL and auth header injection
- `useFetchRequest` and `usePagedRequest` wrap common request/loading patterns
- dashboard and admin pages optimistically update local state after successful mutations

## Notes

- The README in this folder is intentionally scoped to the current app, not older chat/document functionality.
- If you change routes, required env vars, or the dashboard workflow, update this file alongside the code.
