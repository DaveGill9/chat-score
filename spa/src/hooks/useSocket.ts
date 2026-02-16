import { useEffect } from 'react';
import { useSocketContext } from '../context/SocketContext';

/**
 * Hook to interact with the socket connection
 * 
 * @example
 * ```tsx
 * const { socket, isConnected, emit, on } = useSocket();
 * 
 * useEffect(() => {
 *   const unsubscribe = on('message', (data) => {
 *     console.log('Received:', data);
 *   });
 *   return unsubscribe;
 * }, [on]);
 * ```
 */
export const useSocket = () => {
  const { socket, isConnected, connect, disconnect, emit, on, off } = useSocketContext();

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
      // Note: We don't disconnect here because the provider manages the lifecycle
      // This allows the socket to persist across component unmounts
    };
  }, [connect]);

  return {
    socket,
    isConnected,
    connect,
    disconnect,
    emit,
    on,
    off,
  };
};
