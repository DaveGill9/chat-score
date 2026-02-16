import { createContext, useContext } from "react";
import { type Socket } from "socket.io-client";

export interface SocketContextValue {
    socket: Socket | null;
    isConnected: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
    emit: <T = unknown>(event: string, data?: T) => void;
    on: <T = unknown>(event: string, callback: (data: T) => void) => () => void;
    off: (event: string, callback?: (...args: unknown[]) => void) => void;
}

export const SocketContext = createContext<SocketContextValue | null>(null);

export const useSocketContext = (): SocketContextValue => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocketContext must be used within a SocketProvider');
    }
    return context;
};