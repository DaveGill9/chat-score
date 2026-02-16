import {
  type Configuration,
  PublicClientApplication,
  type IPublicClientApplication,
} from '@azure/msal-browser';

const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MSAL_TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

export const msalInstance: IPublicClientApplication =
  new PublicClientApplication(msalConfig);

// Initialize MSAL and export promise
export const msalInitialized = msalInstance.initialize().catch((error) => {
  console.error('Failed to initialize MSAL:', error);
  throw error;
});
