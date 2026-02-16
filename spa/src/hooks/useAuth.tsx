import { useState, useCallback } from 'react';
import type { User } from '../types/User';
import { useUserContext } from '../context/UserContext';
import { logoutAccount, loginAccount } from '../services/auth-service';

export const useAuth = () => {
  const { user, setUser } = useUserContext();
  const [working, setWorking] = useState(false);

  const login = useCallback(async (): Promise<User | null> => {
    setWorking(true);
    try {
      const user = await loginAccount();
      setUser(user);
      return user;
    }
    catch (error) {
      console.error('Failed to login:', error);
      return null;
    }
    finally {
      setWorking(false);
    }
  }, [setUser]);

  const logout = useCallback(async (): Promise<void> => {
    setWorking(true);
    try {
      await logoutAccount();
      setUser(null);
    } finally {
      setWorking(false);
    }
  }, [setUser]);

  return {
    user,
    working,
    login,
    logout,
  };
};

