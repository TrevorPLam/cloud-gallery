// AI-META-BEGIN
// AI-META: React Query client config with custom fetch wrapper for API requests
// OWNERSHIP: client/lib (API layer)
// ENTRYPOINTS: Imported by App root for QueryClientProvider
// DEPENDENCIES: @tanstack/react-query, fetch API
// DANGER: EXPO_PUBLIC_DOMAIN required; 401 handling configurable; credentials include
// CHANGE-SAFETY: Risky - API requests depend on this; test error handling; env var critical
// TESTS: Test API calls, verify 401 handling, check error responses, validate credentials
// AI-META-END

import { QueryClient, QueryFunction } from "@tanstack/react-query";

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

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

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

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      // AI-NOTE: Infinity staleTime means data never auto-refetches; manual invalidation required
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
