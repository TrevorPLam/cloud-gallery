import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getApiUrl,
  apiRequest,
  getQueryFn,
  queryClient,
} from "./query-client";

describe("getApiUrl", () => {
  const originalEnv = process.env.EXPO_PUBLIC_DOMAIN;

  afterEach(() => {
    if (originalEnv) {
      process.env.EXPO_PUBLIC_DOMAIN = originalEnv;
    } else {
      delete process.env.EXPO_PUBLIC_DOMAIN;
    }
  });

  it("should return URL with EXPO_PUBLIC_DOMAIN", () => {
    process.env.EXPO_PUBLIC_DOMAIN = "example.com";

    const url = getApiUrl();

    expect(url).toBe("https://example.com/");
  });

  it("should throw error when EXPO_PUBLIC_DOMAIN is not set", () => {
    delete process.env.EXPO_PUBLIC_DOMAIN;

    expect(() => getApiUrl()).toThrow("EXPO_PUBLIC_DOMAIN is not set");
  });

  it("should handle domain with port", () => {
    process.env.EXPO_PUBLIC_DOMAIN = "example.com:5000";

    const url = getApiUrl();

    expect(url).toBe("https://example.com:5000/");
  });

  it("should handle subdomain", () => {
    process.env.EXPO_PUBLIC_DOMAIN = "api.example.com";

    const url = getApiUrl();

    expect(url).toBe("https://api.example.com/");
  });

  it("should handle empty string as missing", () => {
    process.env.EXPO_PUBLIC_DOMAIN = "";

    expect(() => getApiUrl()).toThrow("EXPO_PUBLIC_DOMAIN is not set");
  });
});

describe("apiRequest", () => {
  const originalEnv = process.env.EXPO_PUBLIC_DOMAIN;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_DOMAIN = "api.example.com";
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.EXPO_PUBLIC_DOMAIN = originalEnv;
    } else {
      delete process.env.EXPO_PUBLIC_DOMAIN;
    }
  });

  it("should make GET request without data", async () => {
    const mockResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const response = await apiRequest("GET", "/api/test");

    expect(global.fetch).toHaveBeenCalledWith(
      new URL("/api/test", "https://api.example.com/"),
      {
        method: "GET",
        headers: {},
        body: undefined,
        credentials: "include",
      },
    );
    expect(response.ok).toBe(true);
  });

  it("should make POST request with data", async () => {
    const mockResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
    });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const data = { name: "test" };
    await apiRequest("POST", "/api/create", data);

    expect(global.fetch).toHaveBeenCalledWith(
      new URL("/api/create", "https://api.example.com/"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      },
    );
  });

  it("should throw error on 404", async () => {
    const mockResponse = new Response("Not found", { status: 404 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    await expect(apiRequest("GET", "/api/missing")).rejects.toThrow(
      "404: Not found",
    );
  });

  it("should throw error on 500", async () => {
    const mockResponse = new Response("Internal server error", {
      status: 500,
    });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    await expect(apiRequest("GET", "/api/error")).rejects.toThrow(
      "500: Internal server error",
    );
  });

  it("should throw error with status text when no body", async () => {
    const mockResponse = new Response(null, {
      status: 403,
      statusText: "Forbidden",
    });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    await expect(apiRequest("GET", "/api/forbidden")).rejects.toThrow(
      "403: Forbidden",
    );
  });

  it("should include credentials in request", async () => {
    const mockResponse = new Response(JSON.stringify({}), { status: 200 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    await apiRequest("GET", "/api/test");

    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    expect(fetchCall[1]?.credentials).toBe("include");
  });

  it("should handle PUT request", async () => {
    const mockResponse = new Response(JSON.stringify({}), { status: 200 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    await apiRequest("PUT", "/api/update", { id: 1 });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("should handle DELETE request", async () => {
    const mockResponse = new Response(JSON.stringify({}), { status: 200 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    await apiRequest("DELETE", "/api/delete/1");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("should handle 201 Created", async () => {
    const mockResponse = new Response(JSON.stringify({ id: 1 }), {
      status: 201,
    });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const response = await apiRequest("POST", "/api/create", { name: "test" });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(201);
  });

  it("should handle 204 No Content", async () => {
    const mockResponse = new Response(null, { status: 204 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const response = await apiRequest("DELETE", "/api/delete/1");

    expect(response.ok).toBe(true);
    expect(response.status).toBe(204);
  });

  it("should construct URL correctly with base path", async () => {
    const mockResponse = new Response(JSON.stringify({}), { status: 200 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    await apiRequest("GET", "/api/users/123");

    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    expect(fetchCall[0].toString()).toBe("https://api.example.com/api/users/123");
  });
});

describe("getQueryFn", () => {
  const originalEnv = process.env.EXPO_PUBLIC_DOMAIN;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_DOMAIN = "api.example.com";
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.EXPO_PUBLIC_DOMAIN = originalEnv;
    } else {
      delete process.env.EXPO_PUBLIC_DOMAIN;
    }
  });

  it("should fetch data successfully", async () => {
    const mockData = { id: 1, name: "test" };
    const mockResponse = new Response(JSON.stringify(mockData), {
      status: 200,
    });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const queryFn = getQueryFn({ on401: "throw" });
    const result = await queryFn({ queryKey: ["/api/test"] } as any);

    expect(result).toEqual(mockData);
  });

  it("should throw on 401 when on401 is throw", async () => {
    const mockResponse = new Response("Unauthorized", { status: 401 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const queryFn = getQueryFn({ on401: "throw" });

    await expect(
      queryFn({ queryKey: ["/api/protected"] } as any),
    ).rejects.toThrow("401: Unauthorized");
  });

  it("should return null on 401 when on401 is returnNull", async () => {
    const mockResponse = new Response("Unauthorized", { status: 401 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const queryFn = getQueryFn({ on401: "returnNull" });
    const result = await queryFn({ queryKey: ["/api/protected"] } as any);

    expect(result).toBe(null);
  });

  it("should include credentials in fetch", async () => {
    const mockResponse = new Response(JSON.stringify({}), { status: 200 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const queryFn = getQueryFn({ on401: "throw" });
    await queryFn({ queryKey: ["/api/test"] } as any);

    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    expect(fetchCall[1]?.credentials).toBe("include");
  });

  it("should construct URL from queryKey", async () => {
    const mockResponse = new Response(JSON.stringify({}), { status: 200 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const queryFn = getQueryFn({ on401: "throw" });
    await queryFn({ queryKey: ["/api/users/123"] } as any);

    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    expect(fetchCall[0].toString()).toBe(
      "https://api.example.com/api/users/123",
    );
  });

  it("should throw on non-401 errors even with returnNull", async () => {
    const mockResponse = new Response("Server error", { status: 500 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const queryFn = getQueryFn({ on401: "returnNull" });

    await expect(
      queryFn({ queryKey: ["/api/error"] } as any),
    ).rejects.toThrow("500: Server error");
  });

  it("should throw on 403 even with returnNull", async () => {
    const mockResponse = new Response("Forbidden", { status: 403 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const queryFn = getQueryFn({ on401: "returnNull" });

    await expect(
      queryFn({ queryKey: ["/api/forbidden"] } as any),
    ).rejects.toThrow("403: Forbidden");
  });

  it("should parse JSON response", async () => {
    const mockData = { items: [1, 2, 3], total: 3 };
    const mockResponse = new Response(JSON.stringify(mockData), {
      status: 200,
    });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const queryFn = getQueryFn({ on401: "throw" });
    const result = await queryFn({ queryKey: ["/api/items"] } as any);

    expect(result).toEqual(mockData);
  });
});

describe("queryClient", () => {
  it("should have default options configured", () => {
    expect(queryClient).toBeDefined();
    expect(queryClient.getDefaultOptions()).toBeDefined();
  });

  it("should have queries config", () => {
    const defaultOptions = queryClient.getDefaultOptions();
    expect(defaultOptions.queries).toBeDefined();
    expect(defaultOptions.queries?.refetchInterval).toBe(false);
    expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaultOptions.queries?.staleTime).toBe(Infinity);
    expect(defaultOptions.queries?.retry).toBe(false);
  });

  it("should have mutations config", () => {
    const defaultOptions = queryClient.getDefaultOptions();
    expect(defaultOptions.mutations).toBeDefined();
    expect(defaultOptions.mutations?.retry).toBe(false);
  });

  it("should have query function configured", () => {
    const defaultOptions = queryClient.getDefaultOptions();
    expect(defaultOptions.queries?.queryFn).toBeDefined();
    expect(typeof defaultOptions.queries?.queryFn).toBe("function");
  });
});
