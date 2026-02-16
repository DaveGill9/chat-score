import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { msalInstance } from './msal-config';
import { acquireAccessToken } from './auth-service';

const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add MSAL token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const accessToken = await acquireAccessToken();
      if (config.headers) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    } catch (error) {
      console.error('Failed to acquire token for API request:', error);
      // You might want to redirect to login or handle this differently
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - clear account and redirect to login
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        msalInstance.logout({ account: accounts[0] });
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

