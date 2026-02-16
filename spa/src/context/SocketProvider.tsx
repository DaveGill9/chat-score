import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { toast } from '../services/toast-service';
import { acquireAccessToken } from '../services/auth-service';
import { SocketContext, type SocketContextValue  } from './SocketContext';

interface SocketProviderProps {
  children: ReactNode;
}

const options = {
  autoConnect: false,
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  withCredentials: true,
};

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Map<string, Set<(...args: unknown[]) => void>>>(new Map());

  const url = import.meta.env.VITE_API_URL;

  const connect = useCallback(async () => {
    // Disconnect existing socket if any
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    try {
      // Get access token using centralized auth service
      const accessToken = await acquireAccessToken();

      // Create new socket with auth
      const newSocket = io(url, {
        ...options,
        auth: {
          accessToken,
        },
      });

      // Set up connection handlers
      newSocket.on('connect', () => {
        setIsConnected(true);
      });

      newSocket.on('disconnect', () => {
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
      });

      // Handle forbidden resource errors
      newSocket.on('exception', (payload: { message: string; cause?: { data: unknown; pattern: string } }) => {
        if (payload.message === 'Forbidden resource' && payload.cause) {
          // Reconnect and retry the emit
          const handleReconnect = () => {
            if (newSocket.connected && payload.cause) {
              newSocket.emit(payload.cause.pattern, payload.cause.data);
              newSocket.off('connect', handleReconnect);
            }
          };
          newSocket.once('connect', handleReconnect);
          connect();
        }
      });

      socketRef.current = newSocket;
      setSocket(newSocket);
      newSocket.connect();
    } catch (error) {
      console.error('Failed to connect socket:', error);
      toast.error('Could not connect to socket - please refresh the page');
    }
  }, [url]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      // Clean up all listeners
      listenersRef.current.forEach((callbacks, event) => {
        callbacks.forEach((callback) => {
          socketRef.current?.off(event, callback);
        });
      });
      listenersRef.current.clear();

      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
  }, []);

  const emit = useCallback(<T = unknown,>(event: string, data?: T) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn(`Cannot emit '${event}': socket not connected`);
    }
  }, []);

  const on = useCallback(<T = unknown,>(event: string, callback: (data: T) => void) => {
    if (!socketRef.current) {
      console.warn(`Cannot listen to '${event}': socket not initialized`);
      return () => {};
    }

    // Store callback for cleanup
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)?.add(callback as (...args: unknown[]) => void);

    // Add listener
    socketRef.current.on(event, callback as (...args: unknown[]) => void);

    // Return cleanup function
    return () => {
      socketRef.current?.off(event, callback as (...args: unknown[]) => void);
      listenersRef.current.get(event)?.delete(callback as (...args: unknown[]) => void);
    };
  }, []);

  const off = useCallback((event: string, callback?: (...args: unknown[]) => void) => {
    if (!socketRef.current) return;

    if (callback) {
      socketRef.current.off(event, callback);
      listenersRef.current.get(event)?.delete(callback);
    } else {
      // Remove all listeners for this event
      const callbacks = listenersRef.current.get(event);
      if (callbacks) {
        callbacks.forEach((cb) => {
          socketRef.current?.off(event, cb);
        });
        listenersRef.current.delete(event);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const value: SocketContextValue = {
    socket,
    isConnected,
    connect,
    disconnect,
    emit,
    on,
    off,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}


