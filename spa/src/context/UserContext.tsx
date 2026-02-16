import { createContext, useContext } from "react";
import type { User } from "../types/User";

export type UserState = User | undefined | null;

export interface UserContextType {
    user: UserState;
    setUser: (user: UserState) => void;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUserContext = (): UserContextType => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUserContext must be used within a UserProvider');
    }
    return context;
};