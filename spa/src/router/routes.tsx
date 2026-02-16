import type { RouteObject } from 'react-router-dom';
import ChatPage from '../pages/chat/ChatPage.tsx';
import DocumentsPage from '../pages/documents/DocumentsPage.tsx';
import DocumentDetailPage from '../pages/documents/DocumentDetailPage.tsx';
import LogsPage from '../pages/logs/LogsPage.tsx';
import LogDetailPage from '../pages/logs/LogDetailPage.tsx';

// Important: The key is used to animate the outlet when the route changes.
// The key should be stable for children of the route so that the parent does not animate when the child changes.

const documentDetailRoute = {
  path: 'document/:id',
  element: <DocumentDetailPage key="document-detail" />
};

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <ChatPage key="chat" />
  },
  {
    path: '/chat/:chatId',
    element: <ChatPage key="chat" />,
    children: [ documentDetailRoute ]
  },
  {
    path: '/documents',
    element: <DocumentsPage key="documents-list" />,
    children: [ documentDetailRoute ]
  },
  {
    path: '/logs',
    element: <LogsPage key="logs-list" />,
    children: [
      {
        path: ':id',
        element: <LogDetailPage key="log-detail" />
      }
    ]
  }
];
