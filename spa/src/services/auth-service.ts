import type { User } from '../types/User';
import apiClient from './api-client';
import { msalInstance, msalInitialized } from './msal-config';
import type { AccountInfo, PopupRequest } from '@azure/msal-browser';

/**
 * Get the API scope for authentication
 * @returns The API scope string
 */
export const getApiScope = (): string => {
  const clientId = import.meta.env.VITE_MSAL_CLIENT_ID;
  return `api://${clientId}/user_profile`;
};

/**
 * Get the currently authenticated account
 * @returns The authenticated account or null if none exists
 */
export const getAuthenticatedAccount = async (): Promise<AccountInfo | null> => {
  await msalInitialized;
  const accounts = msalInstance.getAllAccounts();
  return accounts.length > 0 ? accounts[0] : null;
};

/**
 * Acquire an access token for the API scope
 * Attempts silent acquisition first, then falls back to popup if needed
 * @returns The access token
 * @throws Error if no account is authenticated or token acquisition fails
 */
export const acquireAccessToken = async (): Promise<string> => {
  await msalInitialized;
  
  const account = await getAuthenticatedAccount();
  if (!account) {
    throw new Error('No authenticated account found');
  }

  try {
    // Try silent token acquisition first
    const response = await msalInstance.acquireTokenSilent({
      scopes: [getApiScope()],
      account,
    });
    return response.accessToken;
  } catch {
    // If silent token acquisition fails, try interactive popup
    try {
      const response = await msalInstance.acquireTokenPopup({
        scopes: [getApiScope()],
        account,
      });
      return response.accessToken;
    } catch (popupError) {
      console.error('Failed to acquire token:', popupError);
      throw new Error('Failed to acquire access token');
    }
  }
};

/**
 * Initialize the user account
 * @returns The user account or null if no account is authenticated
 */
export const initAccount = async (): Promise<User | null> => {
  // Ensure MSAL is initialized before checking accounts
  await msalInitialized;
  
  const accounts = msalInstance.getAllAccounts();
  
  if (accounts.length === 0) {
    return null;
  }
  
  try {
    const { data } = await apiClient.get<User>('/auth/init');
    return data;
  } catch (error) {
    console.error('Failed to initialize user:', error);
    return null;
  }
};

export const loginAccount = async (): Promise<User | null> => {
    await msalInitialized;

    const loginRequest: PopupRequest = {
      scopes: ['User.Read'],
    };

    try {
      const response = await msalInstance.loginPopup(loginRequest);      
      if (response.account) {
        return initAccount();
      }      
      return null;
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes(':'))
        throw new Error(errorMessage.split(':')[1].trim());
      throw new Error(errorMessage);
    }
  }

  export const logoutAccount = async (): Promise<void> => {
    await msalInstance.logoutPopup();
  }

