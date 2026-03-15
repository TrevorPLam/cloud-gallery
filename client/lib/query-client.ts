// AI-META-BEGIN
// AI-META: React Query client config with custom fetch wrapper for API requests
// OWNERSHIP: client/lib (API layer)
// ENTRYPOINTS: Imported by App root for QueryClientProvider
// DEPENDENCIES: @tanstack/react-query, @react-native-async-storage/async-storage, fetch API
// DANGER: EXPO_PUBLIC_DOMAIN required; 401 handling clears token; credentials include
// CHANGE-SAFETY: Risky - API requests depend on this; test error handling; env var critical
// TESTS: Test API calls, verify 401 handling, check error responses, validate credentials, JWT token management
// AI-META-END

import { QueryClient, QueryFunction } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Storage key for JWT token
const AUTH_TOKEN_KEY = "@auth_token";

/**
 * AI-NOTE: Gets base URL from env var; throws if missing to fail fast in dev.
 * HTTPS enforced for all API calls.
 */
export function getApiUrl(): string {
  let host = process.env.EXPO_PUBLIC_DOMAIN;

  if (!host) {
    throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  }

  let url = new URL(`https://${host}`);

  return url.href;
}

// ═══════════════════════════════════════════════════════════
// JWT TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════

/**
 * Get authentication token from storage
 * @returns Promise<string | null>
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error("Failed to get auth token:", error);
    return null;
  }
}

/**
 * Set authentication token in storage
 * @param token - JWT token from login
 */
export async function setAuthToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch (error) {
    console.error("Failed to set auth token:", error);
    throw error;
  }
}

/**
 * Clear authentication token (logout)
 */
export async function clearAuthToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error("Failed to clear auth token:", error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// API ERROR TYPES
// ═══════════════════════════════════════════════════════════

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "APIError";
  }
}

export class AuthenticationError extends APIError {
  constructor(
    message: string = "Authentication required. Please log in again.",
  ) {
    super(message, 401);
    this.name = "AuthenticationError";
  }
}

export class ValidationError extends APIError {
  constructor(
    message: string,
    public validationDetails: Array<{ path: string[]; message: string }>,
  ) {
    super(message, 400, validationDetails);
    this.name = "ValidationError";
  }
}

export class NetworkError extends Error {
  constructor(
    message: string = "Network request failed. Please check your connection.",
  ) {
    super(message);
    this.name = "NetworkError";
  }
}

export class ServerError extends APIError {
  constructor(message: string = "Server error. Please try again later.") {
    super(message, 500);
    this.name = "ServerError";
  }
}

// ═══════════════════════════════════════════════════════════
// API REQUEST HELPER
// ═══════════════════════════════════════════════════════════

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const contentType = res.headers.get("content-type");
    let errorData: any;

    // Try to parse JSON error response
    if (contentType?.includes("application/json")) {
      try {
        errorData = await res.json();
      } catch {
        errorData = { message: res.statusText };
      }
    } else {
      const text = await res.text();
      errorData = { message: text || res.statusText };
    }

    // Handle specific error types
    if (res.status === 401) {
      throw new AuthenticationError(errorData.message);
    }

    if (res.status === 400 && errorData.details) {
      throw new ValidationError(
        errorData.error || errorData.message || "Validation failed",
        errorData.details,
      );
    }

    if (res.status >= 500) {
      console.error("Server error:", res.status, errorData);
      throw new ServerError(
        `${res.status}: ${errorData.message || "Server error"}`,
      );
    }

    // Generic API error
    throw new APIError(
      errorData.message || `Request failed with status ${res.status}`,
      res.status,
      errorData,
    );
  }
}

/**
 * Make authenticated API request
 * @param method - HTTP method (GET, POST, PUT, DELETE)
 * @param endpoint - API endpoint (e.g., '/api/photos')
 * @param body - Request body (optional)
 * @returns Promise<Response>
 * @throws AuthenticationError if 401
 * @throws ValidationError if 400 with validation details
 * @throws ServerError if 500+
 * @throws NetworkError if network failure
 * @throws APIError for other HTTP errors
 */
export async function apiRequest(
  method: "GET" | "POST" | "PUT" | "DELETE",
  endpoint: string,
  body?: unknown | undefined,
): Promise<Response> {
  try {
    const baseUrl = getApiUrl();
    const url = new URL(endpoint, baseUrl);

    // Get authentication token from storage
    const token = await getAuthToken();

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add Authorization header if token exists
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Make request
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });

    // Handle 401 Unauthorized - clear token and throw
    if (res.status === 401) {
      await clearAuthToken();
      throw new AuthenticationError();
    }

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof APIError || error instanceof NetworkError) {
      throw error;
    }

    // Handle network errors (fetch failures)
    if (error instanceof TypeError && error.message.includes("fetch")) {
      console.error("Network error:", error);
      throw new NetworkError();
    }

    // Log and re-throw unexpected errors
    console.error("Unexpected API error:", error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// REACT QUERY CONFIGURATION
// ═══════════════════════════════════════════════════════════

type UnauthorizedBehavior = "returnNull" | "throw";

// AI-NOTE: Query function factory allows configurable 401 handling per query;
// credentials: "include" sends cookies for auth
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    // Get authentication token
    const token = await getAuthToken();

    // Build headers
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      await clearAuthToken();
      return null;
    }

    // Handle 401 for "throw" behavior
    if (res.status === 401) {
      await clearAuthToken();
      throw new Error("Authentication required. Please log in again.");
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * React Query client with optimized caching strategy for client-server integration
 *
 * Configuration:
 * - staleTime: 5 minutes (data considered fresh for 5 min)
 * - cacheTime: 30 minutes (cached data kept for 30 min)
 * - refetchOnWindowFocus: true (sync on app foreground)
 * - refetchOnReconnect: true (sync on network restore)
 * - retry: 3 attempts with exponential backoff
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
      refetchOnWindowFocus: true, // Sync on app foreground
      refetchOnReconnect: true, // Sync on network restore
      retry: 3, // Retry failed requests 3 times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      retry: 1, // Retry mutations once
    },
  },
});
