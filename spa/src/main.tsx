import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { UserProvider } from './context/UserProvider.tsx'
import { SocketProvider } from './context/SocketProvider.tsx'
import ErrorPage from './pages/error/ErrorPage.tsx'
import { routes } from './router/routes.tsx'
import { PopoverContainer } from './components/popover/PopoverPortal.tsx'
import { ToastContainer } from './components/toast/Toast.tsx'
import App from './App.tsx'
import './styles/index.scss'

const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <ErrorPage />,
    element: (
      <>
        <App />
        <PopoverContainer />
        <ToastContainer />
      </>
    ),
    children: routes,
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UserProvider>
      <SocketProvider>
        <RouterProvider router={router} />
      </SocketProvider>
    </UserProvider>
  </StrictMode>,
)
