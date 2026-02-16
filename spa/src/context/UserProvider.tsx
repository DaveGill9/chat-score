import { useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types/User';
import { initAccount } from '../services/auth-service';
import { UserContext, type UserState } from './UserContext';

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserState>(undefined);

  useEffect(() => {
    initAccount()
      .then((user: User | null) => setUser(user))
      .catch((error: Error) => console.error('Failed to initialize user:', error));
  }, [setUser]);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};