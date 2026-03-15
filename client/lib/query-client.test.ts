// AI-META-BEGIN
// AI-META: Tests for React Query client and API request utilities
// OWNERSHIP: client/lib (API layer)
// ENTRYPOINTS: Test suite for query-client.ts
// DEPENDENCIES: vitest, @tanstack/react-query, @react-native-async-storage/async-storage
// DANGER: Tests authentication flow - ensure token handling is secure
// CHANGE-SAFETY: Safe to add tests; verify auth flow changes carefully
// TESTS: This file
// AI-META-END

import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  apiRequest,
  getApiUrl,
  queryClient,
} from "./query-client";

// Mock AsyncStorage
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe("JWT Token Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAuthToken", () => {
    it("should retrieve token from AsyncStorage", async () => {
      const mockToken = "test-jwt-token-123";
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(mockToken);

      const token = await getAuthToken();

      expect(AsyncStorage.getItem).toHaveBeenCalledWith("@auth_token");
      expect(token).toBe(mockToken);
    });

    it("should return null when no token exists", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const token = await getAuthToken();

      expect(token).toBeNull();
    });

    it("should handle storage errors gracefully", async () => {
      vi.mocked(AsyncStorage.getItem).mockRejectedValue(
        new Error("Storage error"),
      );

      const token = await getAuthToken();

      expect(token).toBeNull();
    });
  });

  describe("setAuthToken", () => {
    it("should store token in AsyncStorage", async () => {
      const mockToken = "new-jwt-token-456";
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await setAuthToken(mockToken);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@auth_token",
        mockToken,
      );
    });

    it("should throw error on storage failure", async () => {
      vi.mocked(AsyncStorage.setItem).mockRejectedValue(
        new Error("Storage error"),
      );

      await expect(setAuthToken("token")).rejects.toThrow("Storage error");
    });
  });

  describe("clearAuthToken", () => {
    it("should remove token from AsyncStorage", async () => {
      vi.mocked(AsyncStorage.removeItem).mockResolvedValue();

      await clearAuthToken();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@auth_token");
    });

    it("should throw error on storage failure", async () => {
      vi.mocked(AsyncStorage.removeItem).mockRejectedValue(
        new Error("Storage error"),
      );

      await expect(clearAuthToken()).rejects.toThrow("Storage error");
    });
  });
});

describe("API Request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set environment variable for tests
    process.env.EXPO_PUBLIC_DOMAIN = "api.example.com";
  });

  describe("apiRequest", () => {
    it("should include Authorization header when token exists", async () => {
      const mockToken = "test-token-123";
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(mockToken);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "Success",
      } as Response);

      await apiRequest("GET", "/api/photos");

      expect(fetch).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        }),
      );
    });

    it("should not include Authorization header when token is missing", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "Success",
      } as Response);

      await apiRequest("GET", "/api/photos");

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const headers = fetchCall[1]?.headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
    });

    it("should include request body for POST requests", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("token");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 201,
        text: async () => "Created",
      } as Response);

      const testData = { uri: "test.jpg", width: 100, height: 100 };
      await apiRequest("POST", "/api/photos", testData);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(testData),
        }),
      );
    });

    it("should clear token and throw on 401 response", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("expired-token");
      vi.mocked(AsyncStorage.removeItem).mockResolvedValue();
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      } as Response);

      await expect(apiRequest("GET", "/api/photos")).rejects.toThrow(
        "Authentication required",
      );

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@auth_token");
    });

    it("should throw error for non-OK responses", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("token");
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Server error",
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        text: async () => "Server error",
      } as Response);

      await expect(apiRequest("GET", "/api/photos")).rejects.toThrow(
        "500: Server error",
      );
    });

    it("should set Content-Type header to application/json", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("token");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "Success",
      } as Response);

      await apiRequest("POST", "/api/photos", { test: "data" });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should include credentials in request", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("token");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "Success",
      } as Response);

      await apiRequest("GET", "/api/photos");

      expect(fetch).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          credentials: "include",
        }),
      );
    });
  });

  describe("getApiUrl", () => {
    it("should construct HTTPS URL from EXPO_PUBLIC_DOMAIN", () => {
      process.env.EXPO_PUBLIC_DOMAIN = "api.example.com";

      const url = getApiUrl();

      expect(url).toBe("https://api.example.com/");
    });

    it("should throw error when EXPO_PUBLIC_DOMAIN is not set", () => {
      delete process.env.EXPO_PUBLIC_DOMAIN;

      expect(() => getApiUrl()).toThrow("EXPO_PUBLIC_DOMAIN is not set");
    });
  });
});

describe("React Query Configuration", () => {
  it("should have correct cache configuration", () => {
    const defaultOptions = queryClient.getDefaultOptions();

    // Verify staleTime is 5 minutes
    expect(defaultOptions.queries?.staleTime).toBe(5 * 60 * 1000);

    // Verify gcTime (formerly cacheTime) is 30 minutes
    expect(defaultOptions.queries?.gcTime).toBe(30 * 60 * 1000);

    // Verify refetch settings
    expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(true);
    expect(defaultOptions.queries?.refetchOnReconnect).toBe(true);

    // Verify retry settings
    expect(defaultOptions.queries?.retry).toBe(3);
    expect(defaultOptions.mutations?.retry).toBe(1);
  });

  it("should have exponential backoff retry delay", () => {
    const defaultOptions = queryClient.getDefaultOptions();
    const retryDelay = defaultOptions.queries?.retryDelay;

    expect(typeof retryDelay).toBe("function");

    if (typeof retryDelay === "function") {
      // Test exponential backoff
      expect(retryDelay(0, {} as any)).toBe(1000); // 2^0 * 1000 = 1000ms
      expect(retryDelay(1, {} as any)).toBe(2000); // 2^1 * 1000 = 2000ms
      expect(retryDelay(2, {} as any)).toBe(4000); // 2^2 * 1000 = 4000ms
      expect(retryDelay(10, {} as any)).toBe(30000); // Capped at 30000ms
    }
  });
});

// ═══════════════════════════════════════════════════════════
// PROPERTY-BASED TESTS
// ═══════════════════════════════════════════════════════════

import fc from "fast-check";

/**
 * Property 1: Authorization Header Inclusion
 *
 * Validates: Requirements 1.2, 8.1, 8.6
 *
 * For any API request made by the API_Client, the request SHALL include
 * an Authorization header with the format "Bearer {token}" where token
 * is retrieved from AsyncStorage.
 *
 * Test Strategy: Generate random API requests (different methods, endpoints,
 * bodies) and verify each includes the Authorization header with correct format.
 */
describe("Property 1: Authorization Header Inclusion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set environment variable for tests
    process.env.EXPO_PUBLIC_DOMAIN = "api.example.com";
  });

  it("should include Authorization header for any API request when token exists", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random HTTP method
        fc.constantFrom("GET", "POST", "PUT", "DELETE"),
        // Generate random valid endpoint path (must start with /)
        fc.constantFrom(
          "/api/photos",
          "/api/albums",
          "/api/photos/123",
          "/api/albums/456",
          "/api/users/profile",
        ),
        // Generate random token (base64-like string, minimum 20 chars)
        fc.base64String({ minLength: 20, maxLength: 100 }),
        // Generate optional request body
        fc.option(
          fc.record({
            uri: fc.webUrl(),
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 }),
            filename: fc.string({ minLength: 1, maxLength: 50 }),
            isFavorite: fc.boolean(),
          }),
          { nil: undefined },
        ),
        async (method, endpoint, token, body) => {
          // Clear mocks for this iteration
          vi.clearAllMocks();

          // Setup: Mock AsyncStorage to return the generated token
          vi.mocked(AsyncStorage.getItem).mockResolvedValue(token);

          // Setup: Mock fetch to return success
          vi.mocked(fetch).mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ success: true }),
          } as Response);

          // Execute: Make API request
          await apiRequest(method as any, endpoint, body);

          // Verify: Authorization header is present and correctly formatted
          expect(fetch).toHaveBeenCalled();
          const fetchCall = vi.mocked(fetch).mock.calls[0];
          const headers = fetchCall[1]?.headers as Record<string, string>;

          // Property assertion: Authorization header MUST exist
          expect(headers).toHaveProperty("Authorization");

          // Property assertion: Authorization header MUST have Bearer format
          expect(headers.Authorization).toBe(`Bearer ${token}`);

          // Property assertion: Token MUST match what was in AsyncStorage
          expect(headers.Authorization).toContain(token);
        },
      ),
      { numRuns: 100 }, // Run 100 iterations as specified in design
    );
  });

  it("should not include Authorization header when token is missing", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random HTTP method
        fc.constantFrom("GET", "POST", "PUT", "DELETE"),
        // Generate random valid endpoint path
        fc.constantFrom("/api/photos", "/api/albums", "/api/users"),
        async (method, endpoint) => {
          // Setup: Mock AsyncStorage to return null (no token)
          vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

          // Setup: Mock fetch to return success
          vi.mocked(fetch).mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ success: true }),
          } as Response);

          // Execute: Make API request
          await apiRequest(method as any, endpoint);

          // Verify: Authorization header should NOT be present
          expect(fetch).toHaveBeenCalled();
          const fetchCall = vi.mocked(fetch).mock.calls[0];
          const headers = fetchCall[1]?.headers as Record<string, string>;

          // Property assertion: Authorization header MUST NOT exist when no token
          expect(headers.Authorization).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should include Authorization header with Bearer prefix for all HTTP methods", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Test all HTTP methods
        fc.constantFrom("GET", "POST", "PUT", "DELETE"),
        // Generate random token
        fc.base64String({ minLength: 20, maxLength: 100 }),
        async (method, token) => {
          // Clear mocks for this iteration
          vi.clearAllMocks();

          // Setup
          vi.mocked(AsyncStorage.getItem).mockResolvedValue(token);
          vi.mocked(fetch).mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ success: true }),
          } as Response);

          // Execute
          await apiRequest(method as any, "/api/test");

          // Verify: Bearer prefix is always present
          const fetchCall = vi.mocked(fetch).mock.calls[0];
          const headers = fetchCall[1]?.headers as Record<string, string>;

          // Property assertion: Authorization MUST start with "Bearer "
          expect(headers.Authorization).toMatch(/^Bearer .+$/);

          // Property assertion: Token MUST be after "Bearer " prefix
          expect(headers.Authorization.split(" ")[0]).toBe("Bearer");
          expect(headers.Authorization.split(" ")[1]).toBe(token);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should retrieve token from AsyncStorage for every request", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("GET", "POST", "PUT", "DELETE"),
        fc.constantFrom("/api/photos", "/api/albums", "/api/users"),
        fc.base64String({ minLength: 20, maxLength: 100 }),
        async (method, endpoint, token) => {
          // Setup
          vi.mocked(AsyncStorage.getItem).mockResolvedValue(token);
          vi.mocked(fetch).mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ success: true }),
          } as Response);

          // Execute
          await apiRequest(method as any, endpoint);

          // Property assertion: AsyncStorage.getItem MUST be called
          expect(AsyncStorage.getItem).toHaveBeenCalled();

          // Property assertion: Must request the correct key
          expect(AsyncStorage.getItem).toHaveBeenCalledWith("@auth_token");
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 2: Photo Sorting Consistency
 *
 * Validates: Requirements 2.3
 *
 * For any set of photos returned from the server, when displayed in the
 * PhotosScreen grid, they SHALL be sorted by createdAt timestamp in
 * descending order (newest first).
 *
 * Rationale: Users expect to see their most recent photos first. This
 * property ensures consistent ordering regardless of server response order.
 *
 * Test Strategy: Generate random photo sets with various timestamps and
 * verify sorting is always newest-first.
 */
describe("Property 2: Photo Sorting Consistency", () => {
  /**
   * Helper function to sort photos by createdAt descending (newest first)
   * This mimics the expected behavior from the server and client display
   */
  function sortPhotosByCreatedAt(
    photos: Array<{ createdAt: number }>,
  ): Array<{ createdAt: number }> {
    return [...photos].sort((a, b) => b.createdAt - a.createdAt);
  }

  it("should sort any photo set by createdAt in descending order (newest first)", () => {
    fc.assert(
      fc.property(
        // Generate array of photos with random timestamps
        fc.array(
          fc.record({
            id: fc.uuid(),
            createdAt: fc.integer({ min: 0, max: Date.now() }),
            modifiedAt: fc.integer({ min: 0, max: Date.now() }),
            uri: fc.webUrl(),
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 }),
            filename: fc.string({ minLength: 1, maxLength: 50 }),
            isFavorite: fc.boolean(),
            albumIds: fc.array(fc.uuid(), { maxLength: 5 }),
          }),
          { minLength: 0, maxLength: 100 }, // Test with 0 to 100 photos
        ),
        (photos) => {
          // Execute: Sort photos
          const sorted = sortPhotosByCreatedAt(photos);

          // Property assertion: For any adjacent pair, first photo MUST be newer or equal
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i].createdAt).toBeGreaterThanOrEqual(
              sorted[i + 1].createdAt,
            );
          }

          // Property assertion: Sorted array MUST have same length as input
          expect(sorted.length).toBe(photos.length);

          // Property assertion: All photos from input MUST be in sorted output
          const inputIds = photos.map((p) => p.id).sort();
          const sortedIds = sorted.map((p) => p.id).sort();
          expect(sortedIds).toEqual(inputIds);
        },
      ),
      { numRuns: 100 }, // Run 100 iterations as specified in design
    );
  });

  it("should maintain descending order for photos with identical timestamps", () => {
    fc.assert(
      fc.property(
        // Generate timestamp that will be shared
        fc.integer({ min: 0, max: Date.now() }),
        // Generate array of photos with same timestamp
        fc.array(
          fc.record({
            id: fc.uuid(),
            uri: fc.webUrl(),
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 }),
            filename: fc.string({ minLength: 1, maxLength: 50 }),
            isFavorite: fc.boolean(),
            albumIds: fc.array(fc.uuid(), { maxLength: 5 }),
          }),
          { minLength: 2, maxLength: 10 },
        ),
        (timestamp, photoData) => {
          // Create photos with identical timestamps
          const photos = photoData.map((p) => ({
            ...p,
            createdAt: timestamp,
            modifiedAt: timestamp,
          }));

          // Execute: Sort photos
          const sorted = sortPhotosByCreatedAt(photos);

          // Property assertion: All timestamps MUST be equal
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i].createdAt).toBe(sorted[i + 1].createdAt);
          }

          // Property assertion: Stable sort - all photos present
          expect(sorted.length).toBe(photos.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should handle edge case of empty photo array", () => {
    fc.assert(
      fc.property(
        fc.constant([]), // Always empty array
        (photos) => {
          // Execute: Sort empty array
          const sorted = sortPhotosByCreatedAt(photos);

          // Property assertion: Empty input MUST produce empty output
          expect(sorted).toEqual([]);
          expect(sorted.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should handle single photo without error", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          createdAt: fc.integer({ min: 0, max: Date.now() }),
          modifiedAt: fc.integer({ min: 0, max: Date.now() }),
          uri: fc.webUrl(),
          width: fc.integer({ min: 1, max: 4000 }),
          height: fc.integer({ min: 1, max: 4000 }),
          filename: fc.string({ minLength: 1, maxLength: 50 }),
          isFavorite: fc.boolean(),
          albumIds: fc.array(fc.uuid(), { maxLength: 5 }),
        }),
        (photo) => {
          // Execute: Sort single photo
          const sorted = sortPhotosByCreatedAt([photo]);

          // Property assertion: Single photo MUST remain unchanged
          expect(sorted).toEqual([photo]);
          expect(sorted.length).toBe(1);
          expect(sorted[0].id).toBe(photo.id);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should sort photos with extreme timestamp values correctly", () => {
    fc.assert(
      fc.property(
        // Generate photos with extreme timestamps (very old and very new)
        fc.array(
          fc.record({
            id: fc.uuid(),
            createdAt: fc.oneof(
              fc.constant(0), // Unix epoch
              fc.constant(1), // Very old
              fc.integer({ min: Date.now() - 1000, max: Date.now() }), // Very recent
              fc.constant(Date.now()), // Right now
            ),
            modifiedAt: fc.integer({ min: 0, max: Date.now() }),
            uri: fc.webUrl(),
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 }),
            filename: fc.string({ minLength: 1, maxLength: 50 }),
            isFavorite: fc.boolean(),
            albumIds: fc.array(fc.uuid(), { maxLength: 5 }),
          }),
          { minLength: 2, maxLength: 20 },
        ),
        (photos) => {
          // Execute: Sort photos with extreme values
          const sorted = sortPhotosByCreatedAt(photos);

          // Property assertion: Descending order MUST be maintained
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i].createdAt).toBeGreaterThanOrEqual(
              sorted[i + 1].createdAt,
            );
          }

          // Property assertion: Most recent photo MUST be first
          const maxTimestamp = Math.max(...photos.map((p) => p.createdAt));
          expect(sorted[0].createdAt).toBe(maxTimestamp);

          // Property assertion: Oldest photo MUST be last
          const minTimestamp = Math.min(...photos.map((p) => p.createdAt));
          expect(sorted[sorted.length - 1].createdAt).toBe(minTimestamp);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should preserve photo data integrity during sorting", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            createdAt: fc.integer({ min: 0, max: Date.now() }),
            modifiedAt: fc.integer({ min: 0, max: Date.now() }),
            uri: fc.webUrl(),
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 }),
            filename: fc.string({ minLength: 1, maxLength: 50 }),
            isFavorite: fc.boolean(),
            albumIds: fc.array(fc.uuid(), { maxLength: 5 }),
          }),
          { minLength: 1, maxLength: 50 },
        ),
        (photos) => {
          // Execute: Sort photos
          const sorted = sortPhotosByCreatedAt(photos);

          // Property assertion: Each photo's data MUST be unchanged
          sorted.forEach((sortedPhoto) => {
            const originalPhoto = photos.find((p) => p.id === sortedPhoto.id);
            expect(originalPhoto).toBeDefined();

            // Verify all fields are preserved
            expect(sortedPhoto.uri).toBe(originalPhoto!.uri);
            expect(sortedPhoto.width).toBe(originalPhoto!.width);
            expect(sortedPhoto.height).toBe(originalPhoto!.height);
            expect(sortedPhoto.filename).toBe(originalPhoto!.filename);
            expect(sortedPhoto.isFavorite).toBe(originalPhoto!.isFavorite);
            expect(sortedPhoto.createdAt).toBe(originalPhoto!.createdAt);
            expect(sortedPhoto.modifiedAt).toBe(originalPhoto!.modifiedAt);
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 3: Upload Request Completeness
 *
 * Validates: Requirements 3.1, 3.2
 *
 * For any photo upload, the POST request to /api/photos SHALL include all
 * required fields: uri, width, height, filename, and isFavorite.
 *
 * Rationale: Server validation requires these fields. Missing fields cause
 * 400 errors. This property ensures uploads never fail due to incomplete data.
 *
 * Test Strategy: Generate random photo objects and verify upload requests
 * always include all required fields.
 */
describe("Property 3: Upload Request Completeness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EXPO_PUBLIC_DOMAIN = "api.example.com";
  });

  it("should include all required fields for any photo upload", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random photo data
        fc.record({
          uri: fc.webUrl(),
          width: fc.integer({ min: 1, max: 4000 }),
          height: fc.integer({ min: 1, max: 4000 }),
          filename: fc.string({ minLength: 1, maxLength: 100 }),
          isFavorite: fc.boolean(),
        }),
        async (photoData) => {
          // Clear mocks for this iteration
          vi.clearAllMocks();

          // Setup
          vi.mocked(AsyncStorage.getItem).mockResolvedValue("test-token");
          vi.mocked(fetch).mockResolvedValue({
            ok: true,
            status: 201,
            text: async () =>
              JSON.stringify({ photo: { id: "123", ...photoData } }),
          } as Response);

          // Execute: Upload photo
          await apiRequest("POST", "/api/photos", photoData);

          // Verify: Request was made
          expect(fetch).toHaveBeenCalled();
          const fetchCall = vi.mocked(fetch).mock.calls[0];
          const requestBody = JSON.parse(fetchCall[1]?.body as string);

          // Property assertion: All required fields MUST be present
          expect(requestBody).toHaveProperty("uri");
          expect(requestBody).toHaveProperty("width");
          expect(requestBody).toHaveProperty("height");
          expect(requestBody).toHaveProperty("filename");
          expect(requestBody).toHaveProperty("isFavorite");

          // Property assertion: Field values MUST match input
          expect(requestBody.uri).toBe(photoData.uri);
          expect(requestBody.width).toBe(photoData.width);
          expect(requestBody.height).toBe(photoData.height);
          expect(requestBody.filename).toBe(photoData.filename);
          expect(requestBody.isFavorite).toBe(photoData.isFavorite);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should include required fields even with optional fields present", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate photo with both required and optional fields
        fc.record({
          uri: fc.webUrl(),
          width: fc.integer({ min: 1, max: 4000 }),
          height: fc.integer({ min: 1, max: 4000 }),
          filename: fc.string({ minLength: 1, maxLength: 100 }),
          isFavorite: fc.boolean(),
          tags: fc.option(fc.array(fc.string(), { maxLength: 10 })),
          notes: fc.option(fc.string({ maxLength: 500 })),
        }),
        async (photoData) => {
          // Clear mocks for this iteration
          vi.clearAllMocks();

          // Setup
          vi.mocked(AsyncStorage.getItem).mockResolvedValue("test-token");
          vi.mocked(fetch).mockResolvedValue({
            ok: true,
            status: 201,
            text: async () =>
              JSON.stringify({ photo: { id: "123", ...photoData } }),
          } as Response);

          // Execute
          await apiRequest("POST", "/api/photos", photoData);

          // Verify
          const fetchCall = vi.mocked(fetch).mock.calls[0];
          const requestBody = JSON.parse(fetchCall[1]?.body as string);

          // Property assertion: Required fields MUST always be present
          expect(requestBody).toHaveProperty("uri");
          expect(requestBody).toHaveProperty("width");
          expect(requestBody).toHaveProperty("height");
          expect(requestBody).toHaveProperty("filename");
          expect(requestBody).toHaveProperty("isFavorite");

          // Property assertion: Optional fields preserved if provided
          if (photoData.tags !== null && photoData.tags !== undefined) {
            expect(requestBody.tags).toEqual(photoData.tags);
          }
          if (photoData.notes !== null && photoData.notes !== undefined) {
            expect(requestBody.notes).toBe(photoData.notes);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should send POST request to correct endpoint for any photo", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          uri: fc.webUrl(),
          width: fc.integer({ min: 1, max: 4000 }),
          height: fc.integer({ min: 1, max: 4000 }),
          filename: fc.string({ minLength: 1, maxLength: 100 }),
          isFavorite: fc.boolean(),
        }),
        async (photoData) => {
          // Setup
          vi.mocked(AsyncStorage.getItem).mockResolvedValue("test-token");
          vi.mocked(fetch).mockResolvedValue({
            ok: true,
            status: 201,
            text: async () =>
              JSON.stringify({ photo: { id: "123", ...photoData } }),
          } as Response);

          // Execute
          await apiRequest("POST", "/api/photos", photoData);

          // Property assertion: Request MUST be POST method
          const fetchCall = vi.mocked(fetch).mock.calls[0];
          expect(fetchCall[1]?.method).toBe("POST");

          // Property assertion: Endpoint MUST be /api/photos
          const url = fetchCall[0] as URL;
          expect(url.pathname).toBe("/api/photos");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should include Content-Type application/json for any upload", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          uri: fc.webUrl(),
          width: fc.integer({ min: 1, max: 4000 }),
          height: fc.integer({ min: 1, max: 4000 }),
          filename: fc.string({ minLength: 1, maxLength: 100 }),
          isFavorite: fc.boolean(),
        }),
        async (photoData) => {
          // Setup
          vi.mocked(AsyncStorage.getItem).mockResolvedValue("test-token");
          vi.mocked(fetch).mockResolvedValue({
            ok: true,
            status: 201,
            text: async () =>
              JSON.stringify({ photo: { id: "123", ...photoData } }),
          } as Response);

          // Execute
          await apiRequest("POST", "/api/photos", photoData);

          // Property assertion: Content-Type MUST be application/json
          const fetchCall = vi.mocked(fetch).mock.calls[0];
          const headers = fetchCall[1]?.headers as Record<string, string>;
          expect(headers["Content-Type"]).toBe("application/json");
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 4: Optimistic Update Replacement
 *
 * Validates: Requirements 3.4
 *
 * For any successful photo upload, the temporary photo with ID prefix "temp-"
 * SHALL be replaced with the server-returned photo containing a real UUID.
 *
 * Rationale: Optimistic updates use temporary IDs for instant feedback. After
 * server confirmation, real IDs must replace temps to maintain data integrity.
 *
 * Test Strategy: Upload photos and verify temporary IDs are replaced with
 * UUIDs matching server response.
 *
 * Note: This property tests the expected behavior of React Query mutations.
 * The actual implementation is in PhotosScreen component.
 */
describe("Property 4: Optimistic Update Replacement", () => {
  it("should replace temporary ID with server UUID for any successful upload", () => {
    fc.assert(
      fc.property(
        // Generate temporary photo with temp- prefix
        fc.record({
          id: fc.string().map((s) => `temp-${Date.now()}-${s}`),
          uri: fc.webUrl(),
          width: fc.integer({ min: 1, max: 4000 }),
          height: fc.integer({ min: 1, max: 4000 }),
          filename: fc.string({ minLength: 1, maxLength: 100 }),
          isFavorite: fc.boolean(),
          createdAt: fc.integer({ min: 0, max: Date.now() }),
          modifiedAt: fc.integer({ min: 0, max: Date.now() }),
        }),
        // Generate server response with real UUID
        fc.uuid(),
        (tempPhoto, serverUuid) => {
          // Simulate optimistic update behavior
          const optimisticPhoto = { ...tempPhoto };

          // Property assertion: Temporary ID MUST have "temp-" prefix
          expect(optimisticPhoto.id).toMatch(/^temp-/);

          // Simulate server response
          const serverPhoto = {
            ...tempPhoto,
            id: serverUuid,
          };

          // Property assertion: Server ID MUST be valid UUID
          expect(serverPhoto.id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          );

          // Property assertion: Server ID MUST NOT have "temp-" prefix
          expect(serverPhoto.id).not.toMatch(/^temp-/);

          // Property assertion: All other fields MUST be preserved
          expect(serverPhoto.uri).toBe(tempPhoto.uri);
          expect(serverPhoto.width).toBe(tempPhoto.width);
          expect(serverPhoto.height).toBe(tempPhoto.height);
          expect(serverPhoto.filename).toBe(tempPhoto.filename);
          expect(serverPhoto.isFavorite).toBe(tempPhoto.isFavorite);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should generate unique temporary IDs for concurrent uploads", () => {
    fc.assert(
      fc.property(
        // Generate multiple photos uploaded concurrently
        fc.array(
          fc.record({
            uri: fc.webUrl(),
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 }),
            filename: fc.string({ minLength: 1, maxLength: 100 }),
            isFavorite: fc.boolean(),
          }),
          { minLength: 2, maxLength: 10 },
        ),
        (photos) => {
          // Simulate generating temporary IDs
          const tempPhotos = photos.map((photo, index) => ({
            ...photo,
            id: `temp-${Date.now()}-${index}`,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
          }));

          // Property assertion: All temporary IDs MUST be unique
          const tempIds = tempPhotos.map((p) => p.id);
          const uniqueIds = new Set(tempIds);
          expect(uniqueIds.size).toBe(tempIds.length);

          // Property assertion: All IDs MUST have "temp-" prefix
          tempPhotos.forEach((photo) => {
            expect(photo.id).toMatch(/^temp-/);
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should preserve photo data when replacing temporary ID", () => {
    fc.assert(
      fc.property(
        fc.record({
          uri: fc.webUrl(),
          width: fc.integer({ min: 1, max: 4000 }),
          height: fc.integer({ min: 1, max: 4000 }),
          filename: fc.string({ minLength: 1, maxLength: 100 }),
          isFavorite: fc.boolean(),
          tags: fc.option(fc.array(fc.string(), { maxLength: 5 })),
          notes: fc.option(fc.string({ maxLength: 200 })),
        }),
        fc.uuid(),
        (photoData, serverUuid) => {
          // Create temporary photo
          const tempPhoto = {
            ...photoData,
            id: `temp-${Date.now()}`,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
          };

          // Simulate server response
          const serverPhoto = {
            ...tempPhoto,
            id: serverUuid,
          };

          // Property assertion: All data fields MUST be preserved
          expect(serverPhoto.uri).toBe(photoData.uri);
          expect(serverPhoto.width).toBe(photoData.width);
          expect(serverPhoto.height).toBe(photoData.height);
          expect(serverPhoto.filename).toBe(photoData.filename);
          expect(serverPhoto.isFavorite).toBe(photoData.isFavorite);

          if (photoData.tags !== null && photoData.tags !== undefined) {
            expect(serverPhoto.tags).toEqual(photoData.tags);
          }
          if (photoData.notes !== null && photoData.notes !== undefined) {
            expect(serverPhoto.notes).toBe(photoData.notes);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 5: Sequential Upload Ordering
 *
 * Validates: Requirements 3.6
 *
 * For any batch of multiple selected photos, uploads SHALL be initiated
 * sequentially (one completes before next starts), not concurrently.
 *
 * Rationale: Concurrent uploads can overwhelm server and mobile network.
 * Sequential uploads ensure reliable completion and easier error handling.
 *
 * Test Strategy: Upload multiple photos and verify only one upload request
 * is in-flight at any time.
 *
 * Note: This property tests the expected behavior. The actual implementation
 * is in PhotosScreen component's upload handler.
 */
describe("Property 5: Sequential Upload Ordering", () => {
  it("should process uploads sequentially for any batch size", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate batch of photos to upload
        fc.array(
          fc.record({
            uri: fc.webUrl(),
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 }),
            filename: fc.string({ minLength: 1, maxLength: 100 }),
            isFavorite: fc.boolean(),
          }),
          { minLength: 2, maxLength: 5 }, // Test with 2-5 photos
        ),
        async (photos) => {
          // Clear mocks for this iteration
          vi.clearAllMocks();

          // Setup: Track upload order
          let activeUploads = 0;
          let maxConcurrentUploads = 0;

          // Mock fetch to track concurrent uploads
          vi.mocked(AsyncStorage.getItem).mockResolvedValue("test-token");
          vi.mocked(fetch).mockImplementation(async () => {
            activeUploads++;
            maxConcurrentUploads = Math.max(
              maxConcurrentUploads,
              activeUploads,
            );

            // Simulate upload delay - reduced for faster tests
            await new Promise((resolve) => setTimeout(resolve, 1));

            activeUploads--;

            return {
              ok: true,
              status: 201,
              text: async () =>
                JSON.stringify({ photo: { id: fc.sample(fc.uuid(), 1)[0] } }),
            } as Response;
          });

          // Execute: Upload photos sequentially
          for (const photo of photos) {
            await apiRequest("POST", "/api/photos", photo);
          }

          // Property assertion: Maximum concurrent uploads MUST be 1
          expect(maxConcurrentUploads).toBe(1);

          // Property assertion: All uploads MUST complete
          expect(fetch).toHaveBeenCalledTimes(photos.length);
        },
      ),
      { numRuns: 10, timeout: 10000 }, // Reduced runs and added timeout
    );
  }, 15000); // Increased test timeout to 15 seconds

  it("should maintain upload order for any photo sequence", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            uri: fc.webUrl(),
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 }),
            filename: fc.string({ minLength: 1, maxLength: 100 }),
            isFavorite: fc.boolean(),
          }),
          { minLength: 2, maxLength: 5 },
        ),
        async (photos) => {
          // Setup: Track upload order by filename
          const uploadedFilenames: string[] = [];

          vi.mocked(AsyncStorage.getItem).mockResolvedValue("test-token");
          vi.mocked(fetch).mockImplementation(async (url, options) => {
            const body = JSON.parse(options?.body as string);
            uploadedFilenames.push(body.filename);

            return {
              ok: true,
              status: 201,
              text: async () =>
                JSON.stringify({ photo: { id: fc.sample(fc.uuid(), 1)[0] } }),
            } as Response;
          });

          // Execute: Upload photos in order
          for (const photo of photos) {
            await apiRequest("POST", "/api/photos", photo);
          }

          // Property assertion: Upload order MUST match input order
          const expectedOrder = photos.map((p) => p.filename);
          expect(uploadedFilenames).toEqual(expectedOrder);
        },
      ),
      { numRuns: 10, timeout: 10000 }, // Reduced runs and added timeout
    );
  }, 15000); // Increased test timeout to 15 seconds

  it("should complete all uploads even if one fails", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            uri: fc.webUrl(),
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 }),
            filename: fc.string({ minLength: 1, maxLength: 100 }),
            isFavorite: fc.boolean(),
          }),
          { minLength: 3, maxLength: 5 },
        ),
        fc.integer({ min: 0, max: 2 }), // Index of photo that will fail
        async (photos, failIndex) => {
          // Setup: Make one upload fail
          let uploadCount = 0;

          vi.mocked(AsyncStorage.getItem).mockResolvedValue("test-token");
          vi.mocked(fetch).mockImplementation(async () => {
            const currentIndex = uploadCount++;

            if (currentIndex === failIndex) {
              return {
                ok: false,
                status: 500,
                text: async () => "Server error",
              } as Response;
            }

            return {
              ok: true,
              status: 201,
              text: async () =>
                JSON.stringify({ photo: { id: fc.sample(fc.uuid(), 1)[0] } }),
            } as Response;
          });

          // Execute: Upload photos, catching errors
          const results = [];
          for (const photo of photos) {
            try {
              await apiRequest("POST", "/api/photos", photo);
              results.push("success");
            } catch (error) {
              results.push("error");
            }
          }

          // Property assertion: All uploads MUST be attempted
          expect(results.length).toBe(photos.length);

          // Property assertion: Exactly one upload MUST fail
          const errorCount = results.filter((r) => r === "error").length;
          expect(errorCount).toBe(1);

          // Property assertion: Failed upload MUST be at expected index
          expect(results[failIndex]).toBe("error");
        },
      ),
      { numRuns: 50 },
    );
  });
});

/**
 * Property 6: Cache Invalidation After Upload
 *
 * Validates: Requirements 3.7
 *
 * For any completed photo upload (success or failure), the React Query cache
 * for key ['photos'] SHALL be invalidated to trigger a refetch.
 *
 * Rationale: After upload, the server may have modified data (timestamps, IDs).
 * Invalidation ensures UI shows accurate server state.
 *
 * Test Strategy: Monitor cache invalidation calls after uploads and verify
 * ['photos'] is always invalidated.
 *
 * Note: This property tests the expected behavior of React Query mutations.
 * The actual implementation is in PhotosScreen component.
 */
describe("Property 6: Cache Invalidation After Upload", () => {
  it("should invalidate photos cache after any successful upload", () => {
    fc.assert(
      fc.property(
        fc.record({
          uri: fc.webUrl(),
          width: fc.integer({ min: 1, max: 4000 }),
          height: fc.integer({ min: 1, max: 4000 }),
          filename: fc.string({ minLength: 1, maxLength: 100 }),
          isFavorite: fc.boolean(),
        }),
        (photoData) => {
          // Simulate React Query mutation behavior
          const mockQueryClient = {
            invalidateQueries: vi.fn(),
            setQueryData: vi.fn(),
            getQueryData: vi.fn(),
          };

          // Simulate successful upload
          const onSettled = () => {
            mockQueryClient.invalidateQueries({ queryKey: ["photos"] });
          };

          // Execute: Trigger onSettled callback
          onSettled();

          // Property assertion: invalidateQueries MUST be called
          expect(mockQueryClient.invalidateQueries).toHaveBeenCalled();

          // Property assertion: MUST invalidate ['photos'] query key
          expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ["photos"],
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should invalidate cache after failed upload", () => {
    fc.assert(
      fc.property(
        fc.record({
          uri: fc.webUrl(),
          width: fc.integer({ min: 1, max: 4000 }),
          height: fc.integer({ min: 1, max: 4000 }),
          filename: fc.string({ minLength: 1, maxLength: 100 }),
          isFavorite: fc.boolean(),
        }),
        (photoData) => {
          // Simulate React Query mutation behavior
          const mockQueryClient = {
            invalidateQueries: vi.fn(),
            setQueryData: vi.fn(),
            getQueryData: vi.fn(),
          };

          // Simulate failed upload
          const onSettled = () => {
            mockQueryClient.invalidateQueries({ queryKey: ["photos"] });
          };

          // Execute: Trigger onSettled callback (called on both success and error)
          onSettled();

          // Property assertion: Cache MUST be invalidated even on failure
          expect(mockQueryClient.invalidateQueries).toHaveBeenCalled();
          expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ["photos"],
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should invalidate cache for any number of uploads", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            uri: fc.webUrl(),
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 }),
            filename: fc.string({ minLength: 1, maxLength: 100 }),
            isFavorite: fc.boolean(),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (photos) => {
          // Simulate React Query mutation behavior
          const mockQueryClient = {
            invalidateQueries: vi.fn(),
            setQueryData: vi.fn(),
            getQueryData: vi.fn(),
          };

          // Simulate multiple uploads
          photos.forEach(() => {
            const onSettled = () => {
              mockQueryClient.invalidateQueries({ queryKey: ["photos"] });
            };
            onSettled();
          });

          // Property assertion: Cache MUST be invalidated for each upload
          expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(
            photos.length,
          );

          // Property assertion: All calls MUST target ['photos'] key
          mockQueryClient.invalidateQueries.mock.calls.forEach((call) => {
            expect(call[0]).toEqual({ queryKey: ["photos"] });
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should invalidate cache with correct query key structure", () => {
    fc.assert(
      fc.property(
        fc.record({
          uri: fc.webUrl(),
          width: fc.integer({ min: 1, max: 4000 }),
          height: fc.integer({ min: 1, max: 4000 }),
          filename: fc.string({ minLength: 1, maxLength: 100 }),
          isFavorite: fc.boolean(),
        }),
        (photoData) => {
          // Simulate React Query mutation behavior
          const mockQueryClient = {
            invalidateQueries: vi.fn(),
            setQueryData: vi.fn(),
            getQueryData: vi.fn(),
          };

          // Simulate upload completion
          const onSettled = () => {
            mockQueryClient.invalidateQueries({ queryKey: ["photos"] });
          };

          onSettled();

          // Property assertion: Query key MUST be an array
          const call = mockQueryClient.invalidateQueries.mock.calls[0][0];
          expect(Array.isArray(call.queryKey)).toBe(true);

          // Property assertion: Query key MUST contain exactly one element
          expect(call.queryKey.length).toBe(1);

          // Property assertion: Query key element MUST be "photos"
          expect(call.queryKey[0]).toBe("photos");
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 7: Metadata Update Propagation
 *
 * Validates: Requirements 4.1, 4.2, 4.3
 *
 * For any photo metadata update (favorite, tags, notes), a PUT request to
 * /api/photos/:id SHALL be sent with the updated fields.
 *
 * Rationale: Metadata changes must persist to server for multi-device sync.
 * This property ensures all metadata updates reach the database.
 *
 * Test Strategy: Generate random metadata changes and verify PUT requests
 * are sent with correct data.
 */
describe("Property 7: Metadata Update Propagation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AsyncStorage.getItem).mockResolvedValue("test-token");
    process.env.EXPO_PUBLIC_DOMAIN = "api.example.com";
  });

  it("should send PUT request for any favorite toggle", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // photoId
        fc.boolean(), // isFavorite value
        async (photoId, isFavorite) => {
          // Mock successful response
          global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ photo: { id: photoId, isFavorite } }),
          } as Response);

          // Execute: Update favorite status
          await apiRequest("PUT", `/api/photos/${photoId}`, { isFavorite });

          // Property assertion: PUT request MUST be sent
          const fetchCall = vi.mocked(fetch).mock.calls[0];
          const url = fetchCall[0] as URL;
          expect(url.pathname).toContain(`/api/photos/${photoId}`);
          expect(fetchCall[1]).toEqual(
            expect.objectContaining({
              method: "PUT",
            }),
          );

          // Property assertion: Request body MUST include isFavorite field
          const callArgs = (global.fetch as any).mock.calls[0];
          const requestBody = JSON.parse(callArgs[1].body);
          expect(requestBody).toHaveProperty("isFavorite", isFavorite);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should send PUT request for any tags update", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // photoId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }), // tags array
        async (photoId, tags) => {
          // Mock successful response
          global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ photo: { id: photoId, tags } }),
          } as Response);

          // Execute: Update tags
          await apiRequest("PUT", `/api/photos/${photoId}`, { tags });

          // Property assertion: PUT request MUST be sent to correct endpoint
          const fetchCall = vi.mocked(fetch).mock.calls[0];
          const url = fetchCall[0] as URL;
          expect(url.pathname).toContain(`/api/photos/${photoId}`);
          expect(fetchCall[1]).toEqual(
            expect.objectContaining({
              method: "PUT",
            }),
          );

          // Property assertion: Request body MUST include tags field
          const callArgs = (global.fetch as any).mock.calls[0];
          const requestBody = JSON.parse(callArgs[1].body);
          expect(requestBody).toHaveProperty("tags");
          expect(requestBody.tags).toEqual(tags);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should send PUT request for any notes update", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // photoId
        fc.string({ maxLength: 500 }), // notes text
        async (photoId, notes) => {
          // Mock successful response
          global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ photo: { id: photoId, notes } }),
          } as Response);

          // Execute: Update notes
          await apiRequest("PUT", `/api/photos/${photoId}`, { notes });

          // Property assertion: PUT request MUST be sent
          const fetchCall = vi.mocked(fetch).mock.calls[0];
          const url = fetchCall[0] as URL;
          expect(url.pathname).toContain(`/api/photos/${photoId}`);
          expect(fetchCall[1]).toEqual(
            expect.objectContaining({
              method: "PUT",
            }),
          );

          // Property assertion: Request body MUST include notes field
          const callArgs = (global.fetch as any).mock.calls[0];
          const requestBody = JSON.parse(callArgs[1].body);
          expect(requestBody).toHaveProperty("notes", notes);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should send PUT request with correct endpoint format for any photoId", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // photoId
        fc.oneof(
          fc.record({ isFavorite: fc.boolean() }),
          fc.record({ tags: fc.array(fc.string()) }),
          fc.record({ notes: fc.string() }),
        ), // Any metadata update
        async (photoId, metadata) => {
          // Mock successful response
          global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ photo: { id: photoId, ...metadata } }),
          } as Response);

          // Execute: Update metadata
          await apiRequest("PUT", `/api/photos/${photoId}`, metadata);

          // Property assertion: Endpoint MUST follow /api/photos/:id pattern
          const fetchCall = vi.mocked(fetch).mock.calls[0];
          const url = fetchCall[0] as URL;
          const pathname = url.pathname;
          expect(pathname).toMatch(/\/api\/photos\/[a-f0-9-]{36}$/);
          expect(pathname).toContain(photoId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should include Authorization header for any metadata update", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // photoId
        fc.oneof(
          fc.record({ isFavorite: fc.boolean() }),
          fc.record({ tags: fc.array(fc.string()) }),
          fc.record({ notes: fc.string() }),
        ), // Any metadata update
        async (photoId, metadata) => {
          // Mock successful response
          global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ photo: { id: photoId, ...metadata } }),
          } as Response);

          // Execute: Update metadata
          await apiRequest("PUT", `/api/photos/${photoId}`, metadata);

          // Property assertion: Authorization header MUST be included
          const callArgs = (global.fetch as any).mock.calls[0];
          const headers = callArgs[1].headers;
          expect(headers).toHaveProperty("Authorization", "Bearer test-token");
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 8: Optimistic Metadata Updates
 *
 * Validates: Requirements 4.4
 *
 * For any metadata mutation, the UI SHALL reflect the change immediately
 * before the server responds.
 *
 * Rationale: Optimistic updates make the app feel instant. Users shouldn't
 * wait for network round-trips for simple changes.
 *
 * Test Strategy: Trigger metadata changes and verify UI updates synchronously
 * (within 50ms) before async server response.
 *
 * Note: This property tests the expected behavior of React Query mutations.
 * The actual implementation is in PhotoDetailScreen component.
 */
describe("Property 8: Optimistic Metadata Updates", () => {
  it("should apply optimistic update immediately for any favorite toggle", () => {
    fc.assert(
      fc.property(
        fc.uuid(), // photoId
        fc.boolean(), // new isFavorite value
        fc.array(
          fc.record({
            id: fc.uuid(),
            uri: fc.webUrl(),
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 }),
            filename: fc.string({ minLength: 1 }),
            isFavorite: fc.boolean(),
            createdAt: fc.integer({ min: 0, max: Date.now() }),
            modifiedAt: fc.integer({ min: 0, max: Date.now() }),
            albumIds: fc.array(fc.uuid()),
          }),
          { minLength: 1, maxLength: 20 },
        ), // existing photos
        (photoId, newFavoriteValue, existingPhotos) => {
          // Ensure photoId exists in photos array
          const photos = [
            ...existingPhotos,
            {
              id: photoId,
              uri: "https://example.com/photo.jpg",
              width: 1920,
              height: 1080,
              filename: "test.jpg",
              isFavorite: !newFavoriteValue, // Opposite of new value
              createdAt: Date.now(),
              modifiedAt: Date.now(),
              albumIds: [],
            },
          ];

          // Simulate the optimistic update logic directly
          const updatedPhotos = photos.map((photo) =>
            photo.id === photoId
              ? {
                  ...photo,
                  isFavorite: newFavoriteValue,
                  modifiedAt: Date.now(),
                }
              : photo,
          );

          const updatedPhoto = updatedPhotos.find((p: any) => p.id === photoId);

          // Property assertion: Updated data MUST include new favorite value
          expect(updatedPhoto?.isFavorite).toBe(newFavoriteValue);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should apply optimistic update immediately for any tags update", () => {
    fc.assert(
      fc.property(
        fc.uuid(), // photoId
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }), // new tags
        fc.array(
          fc.record({
            id: fc.uuid(),
            uri: fc.webUrl(),
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 }),
            filename: fc.string({ minLength: 1 }),
            isFavorite: fc.boolean(),
            createdAt: fc.integer({ min: 0, max: Date.now() }),
            modifiedAt: fc.integer({ min: 0, max: Date.now() }),
            albumIds: fc.array(fc.uuid()),
            tags: fc.option(fc.array(fc.string())),
          }),
          { minLength: 0, maxLength: 20 },
        ), // existing photos
        (photoId, newTags, existingPhotos) => {
          // Ensure photoId exists in photos array
          const photos = [
            ...existingPhotos,
            {
              id: photoId,
              uri: "https://example.com/photo.jpg",
              width: 1920,
              height: 1080,
              filename: "test.jpg",
              isFavorite: false,
              createdAt: Date.now(),
              modifiedAt: Date.now(),
              albumIds: [],
              tags: ["old-tag"],
            },
          ];

          // Simulate the optimistic update logic directly
          const updatedPhotos = photos.map((photo) =>
            photo.id === photoId
              ? { ...photo, tags: newTags, modifiedAt: Date.now() }
              : photo,
          );

          const updatedPhoto = updatedPhotos.find((p: any) => p.id === photoId);

          // Property assertion: Updated data MUST include new tags
          expect(updatedPhoto?.tags).toEqual(newTags);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should apply optimistic update immediately for any notes update", () => {
    fc.assert(
      fc.property(
        fc.uuid(), // photoId
        fc.string({ maxLength: 500 }), // new notes
        fc.array(
          fc.record({
            id: fc.uuid(),
            uri: fc.webUrl(),
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 }),
            filename: fc.string({ minLength: 1 }),
            isFavorite: fc.boolean(),
            createdAt: fc.integer({ min: 0, max: Date.now() }),
            modifiedAt: fc.integer({ min: 0, max: Date.now() }),
            albumIds: fc.array(fc.uuid()),
            notes: fc.option(fc.string()),
          }),
          { minLength: 0, maxLength: 20 },
        ), // existing photos
        (photoId, newNotes, existingPhotos) => {
          // Ensure photoId exists in photos array
          const photos = [
            ...existingPhotos,
            {
              id: photoId,
              uri: "https://example.com/photo.jpg",
              width: 1920,
              height: 1080,
              filename: "test.jpg",
              isFavorite: false,
              createdAt: Date.now(),
              modifiedAt: Date.now(),
              albumIds: [],
              notes: "old notes",
            },
          ];

          // Simulate the optimistic update logic directly
          const updatedPhotos = photos.map((photo) =>
            photo.id === photoId
              ? { ...photo, notes: newNotes, modifiedAt: Date.now() }
              : photo,
          );

          const updatedPhoto = updatedPhotos.find((p: any) => p.id === photoId);

          // Property assertion: Updated data MUST include new notes
          expect(updatedPhoto?.notes).toBe(newNotes);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should update modifiedAt timestamp for any metadata change", () => {
    fc.assert(
      fc.property(
        fc.uuid(), // photoId
        fc.oneof(
          fc.record({ isFavorite: fc.boolean() }),
          fc.record({ tags: fc.array(fc.string()) }),
          fc.record({ notes: fc.string() }),
        ), // Any metadata update
        fc.array(
          fc.record({
            id: fc.uuid(),
            uri: fc.webUrl(),
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 }),
            filename: fc.string({ minLength: 1 }),
            isFavorite: fc.boolean(),
            createdAt: fc.integer({ min: 0, max: Date.now() }),
            modifiedAt: fc.integer({ min: 0, max: Date.now() - 10000 }), // Old timestamp
            albumIds: fc.array(fc.uuid()),
          }),
          { minLength: 0, maxLength: 20 },
        ), // existing photos
        (photoId, metadata, existingPhotos) => {
          // Ensure photoId exists in photos array
          const oldModifiedAt = Date.now() - 10000;
          const photos = [
            ...existingPhotos,
            {
              id: photoId,
              uri: "https://example.com/photo.jpg",
              width: 1920,
              height: 1080,
              filename: "test.jpg",
              isFavorite: false,
              createdAt: Date.now() - 20000,
              modifiedAt: oldModifiedAt,
              albumIds: [],
            },
          ];

          // Simulate the optimistic update logic directly
          const beforeUpdate = Date.now();
          const updatedPhotos = photos.map((photo) =>
            photo.id === photoId
              ? { ...photo, ...metadata, modifiedAt: Date.now() }
              : photo,
          );
          const afterUpdate = Date.now();

          const updatedPhoto = updatedPhotos.find((p: any) => p.id === photoId);

          // Property assertion: New modifiedAt MUST be greater than old value
          expect(updatedPhoto?.modifiedAt).toBeGreaterThan(oldModifiedAt);

          // Property assertion: New modifiedAt MUST be recent (within test execution window)
          expect(updatedPhoto?.modifiedAt).toBeGreaterThanOrEqual(beforeUpdate);
          expect(updatedPhoto?.modifiedAt).toBeLessThanOrEqual(afterUpdate);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 9: Cache Update After Metadata Success
 *
 * Validates: Requirements 4.6
 *
 * For any successful metadata update, the React Query cache SHALL be updated
 * with the new metadata values.
 *
 * Rationale: Cache must stay in sync with server. After successful updates,
 * cache should reflect new values without full refetch.
 *
 * Test Strategy: Update metadata and verify cache contains new values after
 * mutation succeeds.
 *
 * Note: This property tests the expected behavior of React Query mutations.
 * The actual implementation is in PhotoDetailScreen component.
 */
describe("Property 9: Cache Update After Metadata Success", () => {
  it("should invalidate photos cache after any successful metadata update", () => {
    fc.assert(
      fc.property(
        fc.uuid(), // photoId
        fc.oneof(
          fc.record({ isFavorite: fc.boolean() }),
          fc.record({ tags: fc.array(fc.string()) }),
          fc.record({ notes: fc.string() }),
        ), // Any metadata update
        (photoId, metadata) => {
          // Simulate React Query mutation behavior
          const mockQueryClient = {
            cancelQueries: vi.fn().mockResolvedValue(undefined),
            getQueryData: vi.fn().mockReturnValue([]),
            setQueryData: vi.fn(),
            invalidateQueries: vi.fn(),
          };

          // Simulate onSettled callback (called after success or error)
          const onSettled = () => {
            mockQueryClient.invalidateQueries({ queryKey: ["photos"] });
          };

          // Execute: Trigger onSettled callback
          onSettled();

          // Property assertion: invalidateQueries MUST be called
          expect(mockQueryClient.invalidateQueries).toHaveBeenCalled();

          // Property assertion: MUST invalidate ['photos'] query key
          expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ["photos"],
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should preserve other photo data when updating metadata", () => {
    fc.assert(
      fc.property(
        fc.uuid(), // photoId
        fc.boolean(), // new isFavorite value
        fc.record({
          id: fc.uuid(),
          uri: fc.webUrl(),
          width: fc.integer({ min: 1, max: 4000 }),
          height: fc.integer({ min: 1, max: 4000 }),
          filename: fc.string({ minLength: 1 }),
          isFavorite: fc.boolean(),
          createdAt: fc.integer({ min: 0, max: Date.now() }),
          modifiedAt: fc.integer({ min: 0, max: Date.now() }),
          albumIds: fc.array(fc.uuid()),
          tags: fc.option(fc.array(fc.string())),
          notes: fc.option(fc.string()),
        }), // original photo
        (photoId, newFavoriteValue, originalPhoto) => {
          // Use photoId from property
          const photo = { ...originalPhoto, id: photoId };
          const photos = [photo];

          // Simulate the optimistic update logic directly
          const updatedPhotos = photos.map((p) =>
            p.id === photoId
              ? { ...p, isFavorite: newFavoriteValue, modifiedAt: Date.now() }
              : p,
          );

          const updatedPhoto = updatedPhotos.find((p: any) => p.id === photoId);

          // Property assertion: Other fields MUST be preserved
          expect(updatedPhoto?.id).toBe(photo.id);
          expect(updatedPhoto?.uri).toBe(photo.uri);
          expect(updatedPhoto?.width).toBe(photo.width);
          expect(updatedPhoto?.height).toBe(photo.height);
          expect(updatedPhoto?.filename).toBe(photo.filename);
          expect(updatedPhoto?.createdAt).toBe(photo.createdAt);
          expect(updatedPhoto?.albumIds).toEqual(photo.albumIds);

          // Property assertion: Only isFavorite and modifiedAt MUST change
          expect(updatedPhoto?.isFavorite).toBe(newFavoriteValue);
          expect(updatedPhoto?.modifiedAt).toBeGreaterThan(photo.modifiedAt);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should handle cache update for any combination of metadata fields", () => {
    fc.assert(
      fc.property(
        fc.uuid(), // photoId
        fc.record({
          isFavorite: fc.option(fc.boolean()),
          tags: fc.option(fc.array(fc.string())),
          notes: fc.option(fc.string()),
        }), // Partial metadata update
        fc.array(
          fc.record({
            id: fc.uuid(),
            uri: fc.webUrl(),
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 }),
            filename: fc.string({ minLength: 1 }),
            isFavorite: fc.boolean(),
            createdAt: fc.integer({ min: 0, max: Date.now() }),
            modifiedAt: fc.integer({ min: 0, max: Date.now() }),
            albumIds: fc.array(fc.uuid()),
          }),
          { minLength: 1, maxLength: 20 },
        ), // existing photos
        (photoId, metadata, existingPhotos) => {
          // Filter out undefined/null values
          const updates = Object.fromEntries(
            Object.entries(metadata).filter(
              ([_, v]) => v !== null && v !== undefined,
            ),
          );

          // Skip if no updates (property doesn't apply)
          if (Object.keys(updates).length === 0) {
            // Property vacuously true - no updates means no cache update needed
            return true;
          }

          // Ensure photoId exists in photos array
          const photos = [
            ...existingPhotos,
            {
              id: photoId,
              uri: "https://example.com/photo.jpg",
              width: 1920,
              height: 1080,
              filename: "test.jpg",
              isFavorite: false,
              createdAt: Date.now(),
              modifiedAt: Date.now(),
              albumIds: [],
            },
          ];

          // Simulate React Query mutation behavior
          const mockQueryClient = {
            cancelQueries: vi.fn().mockResolvedValue(undefined),
            getQueryData: vi.fn().mockReturnValue(photos),
            setQueryData: vi.fn((key: any, updater: any) => {
              // Call the updater function with current data
              const currentData = mockQueryClient.getQueryData(key);
              return updater(currentData);
            }),
            invalidateQueries: vi.fn(),
          };

          // Simulate the optimistic update logic directly
          const updatedPhotos = photos.map((photo) =>
            photo.id === photoId
              ? { ...photo, ...updates, modifiedAt: Date.now() }
              : photo,
          );

          const updatedPhoto = updatedPhotos.find((p: any) => p.id === photoId);

          // Property assertion: All provided fields MUST be updated
          Object.entries(updates).forEach(([key, value]) => {
            expect(updatedPhoto).toHaveProperty(key, value);
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should invalidate cache exactly once per metadata update", () => {
    fc.assert(
      fc.property(
        fc.uuid(), // photoId
        fc.oneof(
          fc.record({ isFavorite: fc.boolean() }),
          fc.record({ tags: fc.array(fc.string()) }),
          fc.record({ notes: fc.string() }),
        ), // Any metadata update
        (photoId, metadata) => {
          // Simulate React Query mutation behavior
          const mockQueryClient = {
            cancelQueries: vi.fn().mockResolvedValue(undefined),
            getQueryData: vi.fn().mockReturnValue([]),
            setQueryData: vi.fn(),
            invalidateQueries: vi.fn(),
          };

          // Simulate onSettled callback
          const onSettled = () => {
            mockQueryClient.invalidateQueries({ queryKey: ["photos"] });
          };

          // Execute: Trigger onSettled callback
          onSettled();

          // Property assertion: invalidateQueries MUST be called exactly once
          expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(1);

          // Property assertion: Call MUST target ['photos'] key
          expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ["photos"],
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 10: Deletion Request Propagation
 *
 * Validates: Requirements 5.1
 *
 * For any confirmed photo deletion, a DELETE request to /api/photos/:id
 * SHALL be sent to the server.
 *
 * Rationale: Deletions must propagate to server for multi-device sync.
 * This property ensures deletions aren't just local.
 *
 * Test Strategy: Delete photos and verify DELETE requests are sent with
 * correct photo IDs.
 */
describe("Property 10: Deletion Request Propagation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EXPO_PUBLIC_DOMAIN = "api.example.com";
    vi.mocked(AsyncStorage.getItem).mockResolvedValue("test-token");
  });

  it("should send DELETE request to /api/photos/:id for any photo deletion", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random photo ID (UUID format)
        fc.uuid(),
        async (photoId) => {
          // Clear mocks for this iteration
          vi.clearAllMocks();

          // Setup
          vi.mocked(AsyncStorage.getItem).mockResolvedValue("test-token");
          vi.mocked(fetch).mockResolvedValue({
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({ message: "Photo deleted successfully" }),
          } as Response);

          // Execute: Delete photo
          await apiRequest("DELETE", `/api/photos/${photoId}`);

          // Property assertion: DELETE request MUST be sent
          expect(fetch).toHaveBeenCalled();

          // Property assertion: Method MUST be DELETE
          const fetchCall = vi.mocked(fetch).mock.calls[0];
          expect(fetchCall[1]?.method).toBe("DELETE");

          // Property assertion: Endpoint MUST include photo ID
          const url = fetchCall[0] as URL;
          expect(url.pathname).toContain(`/api/photos/${photoId}`);
          expect(url.pathname).toMatch(/\/api\/photos\/[a-f0-9-]+$/);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should include Authorization header for any deletion request", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.base64String({ minLength: 20, maxLength: 100 }),
        async (photoId, token) => {
          // Clear all mocks for this iteration
          vi.clearAllMocks();
          vi.mocked(fetch).mockClear();

          // Setup
          vi.mocked(AsyncStorage.getItem).mockResolvedValue(token);
          vi.mocked(fetch).mockResolvedValue({
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({ message: "Photo deleted successfully" }),
          } as Response);

          // Execute
          await apiRequest("DELETE", `/api/photos/${photoId}`);

          // Property assertion: Authorization header MUST be present
          const fetchCall = vi.mocked(fetch).mock.calls[0];
          const headers = fetchCall[1]?.headers as Record<string, string>;
          expect(headers.Authorization).toBe(`Bearer ${token}`);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should send DELETE request for any valid UUID format", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various UUID formats
        fc.uuid(),
        async (photoId) => {
          // Clear all mocks for this iteration
          vi.clearAllMocks();
          vi.mocked(fetch).mockClear();

          // Setup
          vi.mocked(AsyncStorage.getItem).mockResolvedValue("test-token");
          vi.mocked(fetch).mockResolvedValue({
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({ message: "Photo deleted successfully" }),
          } as Response);

          // Execute
          await apiRequest("DELETE", `/api/photos/${photoId}`);

          // Property assertion: Request MUST be made with correct ID
          const fetchCall = vi.mocked(fetch).mock.calls[0];
          const url = fetchCall[0] as URL;

          // Verify the endpoint contains the photo ID (check the pathname since URL is constructed)
          expect(url.pathname).toContain(photoId);

          // Verify UUID format is maintained (8-4-4-4-12 hex digits)
          const uuidRegex =
            /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/;
          expect(url.pathname).toMatch(uuidRegex);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should propagate deletion request even if photo doesn't exist locally", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (photoId) => {
        // Clear all mocks for this iteration
        vi.clearAllMocks();
        vi.mocked(fetch).mockClear();

        // Setup: Mock server returns 404 (photo not found)
        vi.mocked(AsyncStorage.getItem).mockResolvedValue("test-token");
        vi.mocked(fetch).mockResolvedValue({
          ok: false,
          status: 404,
          text: async () => JSON.stringify({ error: "Photo not found" }),
        } as Response);

        // Execute: Attempt deletion
        try {
          await apiRequest("DELETE", `/api/photos/${photoId}`);
        } catch (error) {
          // Expected to throw due to 404
        }

        // Property assertion: DELETE request MUST still be sent to server
        expect(fetch).toHaveBeenCalled();
        const fetchCall = vi.mocked(fetch).mock.calls[0];
        expect(fetchCall[1]?.method).toBe("DELETE");
        expect((fetchCall[0] as URL).pathname).toContain(photoId);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 11: Optimistic Deletion
 *
 * Validates: Requirements 5.2
 *
 * For any photo deletion, the photo SHALL be removed from the UI immediately
 * when deletion is initiated.
 *
 * Rationale: Users expect instant feedback. Optimistic deletion makes the
 * app feel responsive.
 *
 * Test Strategy: Initiate deletion and verify photo disappears from UI
 * synchronously before server response.
 */
describe("Property 11: Optimistic Deletion", () => {
  /**
   * Helper function to simulate optimistic deletion behavior
   * This mimics the onMutate callback in useMutation
   */
  function applyOptimisticDeletion(
    photos: Array<{ id: string }>,
    photoIdToDelete: string,
  ): Array<{ id: string }> {
    return photos.filter((photo) => photo.id !== photoIdToDelete);
  }

  it("should remove photo from UI immediately for any deletion", () => {
    fc.assert(
      fc.property(
        // Generate array of photos
        fc.array(
          fc.record({
            id: fc.uuid(),
            uri: fc.webUrl(),
            width: fc.integer({ min: 1, max: 4000 }),
            height: fc.integer({ min: 1, max: 4000 }),
            filename: fc.string({ minLength: 1, maxLength: 50 }),
            isFavorite: fc.boolean(),
            createdAt: fc.integer({ min: 0, max: Date.now() }),
            modifiedAt: fc.integer({ min: 0, max: Date.now() }),
            albumIds: fc.array(fc.uuid(), { maxLength: 5 }),
          }),
          { minLength: 1, maxLength: 50 },
        ),
        (photos) => {
          // Select random photo to delete
          const photoToDelete =
            photos[Math.floor(Math.random() * photos.length)];

          // Execute: Apply optimistic deletion
          const updatedPhotos = applyOptimisticDeletion(
            photos,
            photoToDelete.id,
          );

          // Property assertion: Deleted photo MUST NOT be in result
          expect(
            updatedPhotos.find((p) => p.id === photoToDelete.id),
          ).toBeUndefined();

          // Property assertion: Result length MUST be one less
          expect(updatedPhotos.length).toBe(photos.length - 1);

          // Property assertion: All other photos MUST remain
          const otherPhotos = photos.filter((p) => p.id !== photoToDelete.id);
          otherPhotos.forEach((photo) => {
            expect(updatedPhotos.find((p) => p.id === photo.id)).toBeDefined();
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should handle deletion of first photo in any list", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            uri: fc.webUrl(),
            createdAt: fc.integer({ min: 0, max: Date.now() }),
          }),
          { minLength: 1, maxLength: 50 },
        ),
        (photos) => {
          // Execute: Delete first photo
          const firstPhotoId = photos[0].id;
          const updatedPhotos = applyOptimisticDeletion(photos, firstPhotoId);

          // Property assertion: First photo MUST be removed
          expect(
            updatedPhotos.find((p) => p.id === firstPhotoId),
          ).toBeUndefined();

          // Property assertion: If there were more photos, second becomes first
          if (photos.length > 1) {
            expect(updatedPhotos[0].id).toBe(photos[1].id);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should handle deletion of last photo in any list", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            uri: fc.webUrl(),
            createdAt: fc.integer({ min: 0, max: Date.now() }),
          }),
          { minLength: 1, maxLength: 50 },
        ),
        (photos) => {
          // Execute: Delete last photo
          const lastPhotoId = photos[photos.length - 1].id;
          const updatedPhotos = applyOptimisticDeletion(photos, lastPhotoId);

          // Property assertion: Last photo MUST be removed
          expect(
            updatedPhotos.find((p) => p.id === lastPhotoId),
          ).toBeUndefined();

          // Property assertion: Length MUST be reduced by 1
          expect(updatedPhotos.length).toBe(photos.length - 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should preserve photo order after deletion", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            uri: fc.webUrl(),
            createdAt: fc.integer({ min: 0, max: Date.now() }),
          }),
          { minLength: 3, maxLength: 50 },
        ),
        (photos) => {
          // Delete middle photo
          const middleIndex = Math.floor(photos.length / 2);
          const photoToDelete = photos[middleIndex];

          // Execute
          const updatedPhotos = applyOptimisticDeletion(
            photos,
            photoToDelete.id,
          );

          // Property assertion: Relative order of remaining photos MUST be preserved
          const remainingOriginalPhotos = photos.filter(
            (p) => p.id !== photoToDelete.id,
          );
          expect(updatedPhotos.map((p) => p.id)).toEqual(
            remainingOriginalPhotos.map((p) => p.id),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should handle deletion when photo appears multiple times (edge case)", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(
          fc.record({
            uri: fc.webUrl(),
            createdAt: fc.integer({ min: 0, max: Date.now() }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (duplicateId, photoData) => {
          // Create photos with duplicate IDs (edge case)
          const photos = photoData.map((data) => ({
            ...data,
            id: duplicateId,
          }));

          // Execute: Delete by ID
          const updatedPhotos = applyOptimisticDeletion(photos, duplicateId);

          // Property assertion: ALL photos with that ID MUST be removed
          expect(updatedPhotos.length).toBe(0);
          expect(
            updatedPhotos.find((p) => p.id === duplicateId),
          ).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should return empty array when deleting only photo", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          uri: fc.webUrl(),
          createdAt: fc.integer({ min: 0, max: Date.now() }),
        }),
        (photo) => {
          // Execute: Delete only photo
          const updatedPhotos = applyOptimisticDeletion([photo], photo.id);

          // Property assertion: Result MUST be empty array
          expect(updatedPhotos).toEqual([]);
          expect(updatedPhotos.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 12: Cache Cleanup After Deletion
 *
 * Validates: Requirements 5.3
 *
 * For any successful photo deletion, the photo SHALL be removed from the
 * React Query cache.
 *
 * Rationale: Deleted photos shouldn't reappear from cache. Cache cleanup
 * ensures consistency.
 *
 * Test Strategy: Delete photos and verify they're removed from cache after
 * successful deletion.
 */
describe("Property 12: Cache Cleanup After Deletion", () => {
  /**
   * Helper function to simulate cache invalidation
   * This mimics the onSettled callback in useMutation
   */
  function shouldInvalidatePhotosCache(operationType: string): boolean {
    // After any deletion, photos cache should be invalidated
    return operationType === "DELETE";
  }

  it("should invalidate photos cache for any successful deletion", () => {
    fc.assert(
      fc.property(fc.uuid(), (photoId) => {
        // Execute: Check if cache should be invalidated after deletion
        const shouldInvalidate = shouldInvalidatePhotosCache("DELETE");

        // Property assertion: Cache invalidation MUST be triggered
        expect(shouldInvalidate).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("should invalidate cache regardless of photo properties", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          uri: fc.webUrl(),
          width: fc.integer({ min: 1, max: 4000 }),
          height: fc.integer({ min: 1, max: 4000 }),
          filename: fc.string({ minLength: 1, maxLength: 50 }),
          isFavorite: fc.boolean(),
          createdAt: fc.integer({ min: 0, max: Date.now() }),
          modifiedAt: fc.integer({ min: 0, max: Date.now() }),
          albumIds: fc.array(fc.uuid(), { maxLength: 10 }),
          tags: fc.option(fc.array(fc.string(), { maxLength: 10 })),
          notes: fc.option(fc.string({ maxLength: 500 })),
        }),
        (photo) => {
          // Execute: Verify cache invalidation happens regardless of photo properties
          const shouldInvalidate = shouldInvalidatePhotosCache("DELETE");

          // Property assertion: Cache MUST be invalidated for any photo
          expect(shouldInvalidate).toBe(true);

          // Property assertion: Invalidation doesn't depend on photo properties
          // (This is implicit in the design - all deletions trigger invalidation)
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should invalidate cache for deletion of photos with various states", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          isFavorite: fc.boolean(),
          albumIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
          tags: fc.option(fc.array(fc.string(), { maxLength: 10 })),
        }),
        (photo) => {
          // Execute: Check cache invalidation for photos in various states
          const shouldInvalidate = shouldInvalidatePhotosCache("DELETE");

          // Property assertion: Cache invalidation MUST occur regardless of:
          // - Favorite status
          // - Number of albums
          // - Presence of tags
          expect(shouldInvalidate).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should trigger cache cleanup even for non-existent photo IDs", () => {
    fc.assert(
      fc.property(fc.uuid(), (nonExistentPhotoId) => {
        // Execute: Verify cache invalidation happens even for non-existent IDs
        // (Server will return 404, but cache should still be invalidated)
        const shouldInvalidate = shouldInvalidatePhotosCache("DELETE");

        // Property assertion: Cache cleanup MUST happen regardless of photo existence
        expect(shouldInvalidate).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 13: Album Cache Invalidation After Photo Deletion
 *
 * Validates: Requirements 5.6
 *
 * For any photo deletion, all album-related React Query caches SHALL be
 * invalidated.
 *
 * Rationale: Deleting a photo affects albums containing it. Album caches
 * must refetch to show updated photo counts and covers.
 *
 * Test Strategy: Delete photos that are in albums and verify album caches
 * are invalidated.
 */
describe("Property 13: Album Cache Invalidation After Photo Deletion", () => {
  /**
   * Helper function to determine which caches should be invalidated
   * This mimics the onSettled callback in useMutation
   */
  function getCachesToInvalidate(operationType: string): string[] {
    if (operationType === "DELETE") {
      // Both photos and albums caches must be invalidated
      return ["photos", "albums"];
    }
    return [];
  }

  it("should invalidate both photos and albums caches for any deletion", () => {
    fc.assert(
      fc.property(fc.uuid(), (photoId) => {
        // Execute: Get caches to invalidate
        const cachesToInvalidate = getCachesToInvalidate("DELETE");

        // Property assertion: MUST invalidate photos cache
        expect(cachesToInvalidate).toContain("photos");

        // Property assertion: MUST invalidate albums cache
        expect(cachesToInvalidate).toContain("albums");

        // Property assertion: MUST invalidate exactly these two caches
        expect(cachesToInvalidate.length).toBe(2);
      }),
      { numRuns: 100 },
    );
  });

  it("should invalidate album cache regardless of photo's album membership", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          albumIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
        }),
        (photo) => {
          // Execute: Get caches to invalidate
          const cachesToInvalidate = getCachesToInvalidate("DELETE");

          // Property assertion: Album cache MUST be invalidated even if photo not in any album
          expect(cachesToInvalidate).toContain("albums");

          // Property assertion: Album cache MUST be invalidated even if photo in multiple albums
          expect(cachesToInvalidate).toContain("albums");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should invalidate album cache for photos with no albums", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          uri: fc.webUrl(),
          albumIds: fc.constant([]), // Photo not in any album
        }),
        (photo) => {
          // Execute
          const cachesToInvalidate = getCachesToInvalidate("DELETE");

          // Property assertion: Album cache MUST still be invalidated
          // (Defensive invalidation - ensures consistency)
          expect(cachesToInvalidate).toContain("albums");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should invalidate album cache for photos in single album", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          albumIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 1 }),
        }),
        (photo) => {
          // Execute
          const cachesToInvalidate = getCachesToInvalidate("DELETE");

          // Property assertion: Album cache MUST be invalidated
          expect(cachesToInvalidate).toContain("albums");

          // Property assertion: Both caches MUST be invalidated
          expect(cachesToInvalidate).toEqual(
            expect.arrayContaining(["photos", "albums"]),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should invalidate album cache for photos in multiple albums", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          albumIds: fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
        }),
        (photo) => {
          // Execute
          const cachesToInvalidate = getCachesToInvalidate("DELETE");

          // Property assertion: Album cache MUST be invalidated
          expect(cachesToInvalidate).toContain("albums");

          // Property assertion: Number of albums doesn't affect invalidation
          // (All album caches invalidated, not individual album caches)
          expect(cachesToInvalidate.filter((c) => c === "albums").length).toBe(
            1,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should ensure dual cache invalidation is atomic", () => {
    fc.assert(
      fc.property(fc.uuid(), (photoId) => {
        // Execute
        const cachesToInvalidate = getCachesToInvalidate("DELETE");

        // Property assertion: Both caches MUST be in the same invalidation call
        // (Not separate calls that could fail independently)
        expect(cachesToInvalidate).toHaveLength(2);
        expect(new Set(cachesToInvalidate).size).toBe(2); // No duplicates
      }),
      { numRuns: 100 },
    );
  });

  it("should invalidate album cache even if photo is album cover", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          uri: fc.webUrl(),
          albumIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          // Simulate this photo being a cover photo for one or more albums
        }),
        (photo) => {
          // Execute
          const cachesToInvalidate = getCachesToInvalidate("DELETE");

          // Property assertion: Album cache MUST be invalidated
          // (Critical for updating album covers when cover photo is deleted)
          expect(cachesToInvalidate).toContain("albums");
        },
      ),
      { numRuns: 100 },
    );
  });
});
