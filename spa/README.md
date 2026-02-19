# ChatQA - Single Page Application (SPA)

A modern React-based single page application built with Vite, TypeScript, and SCSS. This SPA provides the user interface for the ChatQA platform, featuring AI-powered chat, document management, and real-time updates via WebSocket.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [Build & Deployment](#build--deployment)
- [Key Components](#key-components)
- [Configuration](#configuration)
- [Architecture](#architecture)

## 🎯 Overview

The SPA is a production-ready React application that serves as the frontend for the ChatQA platform. It provides a responsive, accessible interface for users to interact with AI-powered chat, manage documents, and view system logs.

### Key Capabilities

- **AI-Powered Chat Interface**: Real-time streaming chat with document-grounded responses
- **Document Library**: Upload, view, and manage documents with preview capabilities
- **Real-time Updates**: WebSocket-based live updates for chat messages and document status
- **Rich Markdown Rendering**: Custom components for citations, galleries, diagrams, and more
- **Authentication**: Microsoft Identity Platform (MSAL) integration
- **Progressive Web App**: PWA support with offline capabilities
- **Theme Support**: Light/dark theme with system preference detection

## ✨ Features

### Core Features

- ✅ **Chat Interface**
  - Streaming message responses
  - Message history and persistence
  - Citation previews with document references
  - Feedback collection (sentiment analysis)
  - Upload support for chat context

- ✅ **Document Management**
  - Document library with filtering
  - Document detail views with preview
  - Image preview for image files (JPG, PNG, GIF, SVG)
  - Document deletion with confirmation
  - Direct file download via signed URLs
  - Upload and processing status tracking
  - Document metadata display

- ✅ **Event Logs Viewer**
  - Filterable log entries by level, group, and date
  - Detailed log view with stack traces
  - Real-time log updates

- ✅ **Rich Markdown Components**
  - Citations with document links
  - Image galleries with lightbox
  - Image components with loading states and error handling
  - Mermaid diagram rendering
  - Document lists with summaries
  - Custom table styling
  - Error message display

- ✅ **Real-time Communication**
  - WebSocket connection management
  - Automatic reconnection handling
  - Connection state indicators
  - Live document status updates

- ✅ **User Experience**
  - Responsive design (mobile, tablet, desktop)
  - Loading states and error handling
  - Toast notifications
  - Modal dialogs and popovers
  - Keyboard navigation support
  - PWA with offline support

## 🛠️ Tech Stack

### Core Technologies

- **Framework**: React 19.x
- **Build Tool**: Vite 7.x
- **Language**: TypeScript 5.x
- **Styling**: SCSS Modules
- **Routing**: React Router 7.x
- **State Management**: React Context API + Custom Hooks

### Key Libraries

- **Authentication**: `@azure/msal-browser` - Microsoft Identity Platform integration
- **HTTP Client**: `axios` - API communication
- **WebSocket**: `socket.io-client` - Real-time communication
- **Markdown**: `react-markdown` with `remark-gfm` and `remark-breaks`
- **Diagrams**: `mermaid` - Diagram rendering
- **JSON Parsing**: `incomplete-json-parser` - Parsing incomplete JSON from streaming responses
- **Animations**: `framer-motion` - Smooth transitions
- **Date Handling**: `date-fns` - Date formatting and manipulation
- **PWA**: `vite-plugin-pwa` - Progressive Web App support

### Development Tools

- **React Compiler**: Enabled for optimized rendering
- **ESLint**: Code linting with TypeScript support
- **TypeScript**: Strict type checking (no `any` types)

## 📁 Project Structure

```
spa/
├── src/
│   ├── components/          # Reusable React components
│   │   ├── button/          # Button component
│   │   ├── chip/            # Chip/badge component
│   │   ├── feedback/        # Loading and feedback components
│   │   ├── form/            # Form components
│   │   ├── icon/            # Icon components (Icon, IconButton, IconLabel)
│   │   ├── input/           # Input components (Input, Select, Textarea)
│   │   ├── layout/          # Layout components (Page, AnimatedOutlet, PopoverPage)
│   │   ├── markdown/        # Custom markdown components
│   │   │   ├── Citation.tsx
│   │   │   ├── DocumentList.tsx
│   │   │   ├── Error.tsx
│   │   │   ├── Gallery.tsx
│   │   │   ├── Image.tsx
│   │   │   ├── Mermaid.tsx
│   │   │   └── Table.tsx
│   │   ├── navigation/      # Navigation components
│   │   ├── popover/         # Popover, Modal, Tooltip, Alert
│   │   └── toast/           # Toast notification component
│   │
│   ├── pages/               # Page components
│   │   ├── chat/            # Chat interface page
│   │   ├── documents/       # Document library and detail pages
│   │   ├── error/           # Error page
│   │   ├── login/           # Login page
│   │   └── logs/            # Event logs viewer pages
│   │
│   ├── context/             # React Context providers
│   │   ├── SocketContext.tsx
│   │   ├── SocketProvider.tsx
│   │   ├── UserContext.tsx
│   │   └── UserProvider.tsx
│   │
│   ├── hooks/               # Custom React hooks
│   │   ├── useAppUpdate.tsx
│   │   ├── useAuth.tsx
│   │   ├── useEscHandler.ts
│   │   ├── useEventBus.tsx
│   │   ├── useFetchRequest.tsx
│   │   ├── useMarkdownComponents.tsx
│   │   ├── useOnce.tsx
│   │   ├── usePagedRequest.tsx
│   │   ├── useSocket.ts
│   │   └── useTheme.tsx
│   │
│   ├── services/            # Service modules
│   │   ├── api-client.ts    # Axios-based API client
│   │   ├── auth-service.ts  # Authentication service
│   │   ├── event-bus.ts     # Event bus for component communication
│   │   ├── msal-config.ts   # MSAL configuration
│   │   ├── theme-service.ts # Theme management
│   │   └── toast-service.tsx # Toast notification service
│   │
│   ├── router/              # Routing configuration
│   │   └── routes.tsx
│   │
│   ├── types/               # TypeScript type definitions
│   │   ├── Chat.ts
│   │   ├── ChatMessage.ts
│   │   ├── Document.ts
│   │   ├── EventLog.ts
│   │   ├── EventMap.ts
│   │   └── User.ts
│   │
│   ├── utils/               # Utility functions
│   │   ├── add-search-params.ts
│   │   ├── class-list.ts
│   │   ├── index.ts
│   │   ├── nanoid.ts
│   │   ├── string-utils.ts
│   │   └── time-of-day-greeting.ts
│   │
│   ├── styles/              # Global styles
│   │   ├── index.scss       # Main stylesheet
│   │   ├── mixins.scss      # SCSS mixins
│   │   ├── reset.scss       # CSS reset
│   │   └── theme.scss       # Theme variables
│   │
│   ├── App.tsx              # Root component
│   └── main.tsx             # Application entry point
│
├── public/                  # Static assets
│   └── logo.svg
│
├── index.html               # HTML template
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Dependencies and scripts
```

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18 or higher
- **npm**: v9 or higher (or compatible package manager)
- **API Server**: The backend API must be running (see `../api/README.md`)

### Installation

1. **Navigate to the SPA directory:**
   ```bash
   cd spa
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   
   Create a `.env` file in the project root (or use the one in the parent directory):
   ```env
   VITE_API_URL=http://localhost:3000
   VITE_MSAL_CLIENT_ID=your-azure-ad-app-client-id
   VITE_MSAL_TENANT_ID=your-azure-ad-tenant-id
   ```
   
   > **Note**: The SPA reads environment variables from the parent directory (configured in `vite.config.ts` via `envDir: '../'`).

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Access the application:**
   
   Open your browser to `http://localhost:5173` (or the port shown in the terminal).

## 💻 Development

### Available Scripts

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Lint code
npm run lint
```

### Development Server

The development server runs on `http://localhost:5173` by default. It includes:
- **Hot Module Replacement (HMR)**: Instant updates on file changes
- **Fast Refresh**: React component state preservation
- **Source Maps**: For debugging

### Code Style

- **TypeScript**: Strict mode enabled, no `any` types allowed
- **Linting**: ESLint with TypeScript and React rules
- **Formatting**: Prettier (if configured)
- **Component Structure**: Functional components with hooks
- **Styling**: SCSS Modules for component-scoped styles

### Key Development Patterns

1. **Component Structure**: Each component has its own directory with `.tsx` and `.module.scss` files
2. **Type Safety**: All components and functions are strictly typed (no `any` types)
3. **Custom Hooks**: Reusable logic extracted into custom hooks
4. **Context API**: Global state managed via React Context
5. **Service Layer**: API calls abstracted into service modules
6. **Streaming JSON Parsing**: Uses `incomplete-json-parser` for parsing partial JSON from streaming chat responses

### React Compiler

The React Compiler is enabled in this project. It automatically optimizes React components for better performance. See the [React Compiler documentation](https://react.dev/learn/react-compiler) for more information.

> **Note**: The React Compiler may impact Vite dev & build performance, but provides runtime optimizations.

## 🏗️ Build & Deployment

### Production Build

```bash
npm run build
```

This command:
- Compiles TypeScript
- Bundles and minifies assets
- Generates optimized production build in `dist/` directory
- Creates service worker for PWA support

### Preview Production Build

```bash
npm run preview
```

Starts a local server to preview the production build before deployment.

### Deployment

The SPA is designed to be deployed to **Azure Static Web Apps**. The build output in the `dist/` directory can be deployed using:

- **Azure Static Web Apps CLI**
- **GitHub Actions** (configured in `.github/workflows`)
- **Azure Portal** (manual upload)
- **VS Code Azure Extension**

### Environment Variables for Production

Ensure the following environment variables are set in your deployment environment:

- `VITE_API_URL` - Backend API URL
- `VITE_MSAL_CLIENT_ID` - Azure AD application client ID
- `VITE_MSAL_TENANT_ID` - Azure AD tenant ID

> **Note**: Vite requires environment variables to be prefixed with `VITE_` to be exposed to the client bundle.

## 🧩 Key Components

### Pages

- **ChatPage**: Main chat interface with message history and streaming responses
- **DocumentsPage**: Document library with filtering and search
- **DocumentDetailPage**: Individual document view with preview, image support, delete, and download
- **LogsPage**: Event logs viewer with filtering
- **LogDetailPage**: Detailed log entry view
- **LoginPage**: Microsoft authentication page
- **ErrorPage**: Error boundary page

### Custom Markdown Components

- **Citation**: Displays document citations with links
- **DocumentList**: Renders lists of documents with summaries
- **Gallery**: Image gallery with lightbox functionality
- **Image**: Image component with loading states and error handling
- **Mermaid**: Renders Mermaid diagrams
- **Table**: Custom styled tables
- **Error**: Error message display

### Layout Components

- **Navigation**: Main navigation bar with user menu
- **Page**: Standard page wrapper with consistent styling
- **AnimatedOutlet**: Router outlet with page transitions
- **PopoverPage**: Page component for popover content

### Services

- **api-client**: Axios-based HTTP client with authentication
- **auth-service**: MSAL authentication wrapper
- **event-bus**: Event emitter for component communication
- **toast-service**: Toast notification management
- **theme-service**: Theme switching and persistence

## ⚙️ Configuration

### Vite Configuration

The `vite.config.ts` file configures:

- **React Plugin**: With React Compiler support
- **PWA Plugin**: Progressive Web App configuration
- **Environment Directory**: Reads `.env` from parent directory

### MSAL Configuration

MSAL (Microsoft Authentication Library) is configured in `src/services/msal-config.ts`. Configuration includes:

- Client ID
- Tenant ID
- Redirect URI
- Scopes

### API Client Configuration

The API client (`src/services/api-client.ts`) is configured with:

- Base URL from `VITE_API_URL` environment variable
- Authentication token injection
- Request/response interceptors
- Error handling

### Theme Configuration

Themes are defined in `src/styles/theme.scss` and managed via `theme-service.ts`. Supports:

- Light theme
- Dark theme
- System preference detection
- Theme persistence

## 🏛️ Architecture

### Application Flow

1. **Initialization**:
   - App loads → Checks authentication → Shows login or main app

2. **Authentication**:
   - User logs in via MSAL → Token stored → API calls authenticated

3. **Data Fetching**:
   - Components use hooks (`useFetchRequest`, `usePagedRequest`) → API calls via `api-client` → State updated

4. **Real-time Updates**:
   - WebSocket connection established → Events received → UI updated via context

5. **Routing**:
   - React Router handles navigation → Page components render → Animated transitions
   - Nested routes for document details accessible from both chat and documents pages
   - Route keys used for animation stability during navigation

### State Management

- **Global State**: React Context (User, Socket)
- **Local State**: React hooks (`useState`, `useReducer`)
- **Server State**: Custom hooks with API integration
- **Event Communication**: Event bus for cross-component communication

### Component Communication

- **Props**: Parent to child
- **Context**: Global state sharing
- **Event Bus**: Cross-component events
- **Custom Hooks**: Shared logic

### Styling Architecture

- **SCSS Modules**: Component-scoped styles
- **Global Styles**: Shared styles in `styles/` directory
- **Theme Variables**: CSS custom properties for theming
- **Mixins**: Reusable SCSS patterns

## 📚 Additional Resources

- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vite.dev/)
- [React Router Documentation](https://reactrouter.com/)
- [MSAL Browser Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-browser)
- [Socket.IO Client Documentation](https://socket.io/docs/v4/client-api/)

## 🤝 Contributing

When contributing to the SPA:

1. Follow TypeScript strict mode (no `any` types)
2. Use SCSS Modules for component styles
3. Write reusable components and hooks
4. Maintain consistent code style
5. Test components in isolation when possible
6. Update documentation for new features

## 📝 License

Proprietary - See `package.json` for license information.

---

**Need Help?** Check the main project README (`../README.md`) or the API documentation (`../api/README.md`).
