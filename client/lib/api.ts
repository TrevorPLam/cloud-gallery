// AI-META-BEGIN
// AI-META: API client for server communication with authentication and error handling
// OWNERSHIP: client/lib (API communication)
// ENTRYPOINTS: Imported by screens and services for server communication
// DEPENDENCIES: axios, react-query, AsyncStorage for token management
// DANGER: Network requests; authentication token exposure; error handling complexity
// CHANGE-SAFETY: Moderate - API changes affect entire app; maintain backward compatibility
// TESTS: Test API calls, error handling, token refresh, network failures
// AI-META-END

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

// Create axios instance with default configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem("@auth_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Error getting auth token:", error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      try {
        await AsyncStorage.removeItem("@auth_token");
        // Navigate to login screen - this would need to be handled by the app
        console.log("Auth token removed due to 401 error");
      } catch (removeError) {
        console.error("Error removing auth token:", removeError);
      }
    }

    return Promise.reject(error);
  },
);

// Wrapper methods for common HTTP methods
export const api = {
  get: <T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> => {
    return apiClient.get(url, config);
  },

  post: <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> => {
    return apiClient.post(url, data, config);
  },

  put: <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> => {
    return apiClient.put(url, data, config);
  },

  patch: <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> => {
    return apiClient.patch(url, data, config);
  },

  delete: <T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> => {
    return apiClient.delete(url, config);
  },
};

// Export the configured axios instance for direct use if needed
export { apiClient };

// Export types for API responses
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
}
