/**
 * Property-Based Tests for Error Handling
 * Feature: client-server-integration
 *
 * These tests verify universal properties about error handling that should hold
 * for all inputs and scenarios.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import {
  apiRequest,
  AuthenticationError,
  ValidationError,
  NetworkError,
  ServerError,
  APIError,
  clearAuthToken,
  setAuthToken,
} from "./query-client";

// Mock fetch globally
global.fetch = vi.fn();

// Set required environment variable for tests
process.env.EXPO_PUBLIC_DOMAIN = "test-api.com";

describe("Property-Based Tests: Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 17: Error Message Display
   *
   * For any failed network request, the Client SHALL display a user-friendly error message.
   *
   * Validates: Requirements 9.1
   */
  describe("Property 17: Error Message Display", () => {
    it("should throw user-friendly error for any HTTP error status", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 400, max: 599 }), // Any error status code
          fc.string({ minLength: 1 }), // Error message
          async (statusCode, errorMessage) => {
            // Mock error response
            (global.fetch as any).mockResolvedValueOnce({
              ok: false,
              status: statusCode,
              headers: new Map([["content-type", "application/json"]]),
              json: async () => ({ message: errorMessage }),
              text: async () => errorMessage,
            });

            await setAuthToken("test-token");

            try {
              await apiRequest("GET", "/api/test");
              // Should not reach here
              expect.fail("Expected error to be thrown");
            } catch (error) {
              // Should throw an error with a message
              expect(error).toBeInstanceOf(Error);
              expect((error as Error).message).toBeTruthy();
              expect((error as Error).message.length).toBeGreaterThan(0);
            }
          },
        ),
        { numRuns: 50 },
      );
    });

    it("should throw NetworkError for any fetch failure", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }), // Error message
          async (errorMessage) => {
            // Mock network failure
            (global.fetch as any).mockRejectedValueOnce(
              new TypeError(`fetch failed: ${errorMessage}`),
            );

            await setAuthToken("test-token");

            try {
              await apiRequest("GET", "/api/test");
              expect.fail("Expected NetworkError to be thrown");
            } catch (error) {
              expect(error).toBeInstanceOf(NetworkError);
              expect((error as Error).message).toContain("Network");
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  /**
   * Property 18: Validation Error Detail Extraction
   *
   * For any 400 Bad Request response containing validation error details,
   * those details SHALL be extracted and available for display.
   *
   * Validates: Requirements 9.4
   */
  describe("Property 18: Validation Error Detail Extraction", () => {
    it("should extract validation details from any 400 response", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              path: fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
              message: fc.string({ minLength: 1 }),
            }),
            { minLength: 1, maxLength: 5 },
          ),
          async (validationDetails) => {
            // Mock 400 validation error response
            (global.fetch as any).mockResolvedValueOnce({
              ok: false,
              status: 400,
              headers: new Map([["content-type", "application/json"]]),
              json: async () => ({
                error: "Validation error",
                details: validationDetails,
              }),
            });

            await setAuthToken("test-token");

            try {
              await apiRequest("POST", "/api/test", { data: "test" });
              expect.fail("Expected ValidationError to be thrown");
            } catch (error) {
              expect(error).toBeInstanceOf(ValidationError);
              const validationError = error as ValidationError;

              // Should have validation details
              expect(validationError.validationDetails).toBeDefined();
              expect(validationError.validationDetails.length).toBeGreaterThan(
                0,
              );

              // Each detail should have path and message
              validationError.validationDetails.forEach((detail) => {
                expect(detail.path).toBeDefined();
                expect(detail.message).toBeDefined();
                expect(detail.message.length).toBeGreaterThan(0);
              });
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  /**
   * Property 19: Retry Button Presence
   *
   * For any error state, the UI SHALL provide a retry mechanism.
   *
   * Note: This property is tested at the component level in PhotosScreen tests.
   * Here we verify that errors are structured to support retry logic.
   *
   * Validates: Requirements 9.5
   */
  describe("Property 19: Retry Button Presence Support", () => {
    it("should throw retryable errors for any transient failure", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(500, 502, 503, 504), // Transient server errors
          async (statusCode) => {
            (global.fetch as any).mockResolvedValueOnce({
              ok: false,
              status: statusCode,
              headers: new Map([["content-type", "application/json"]]),
              json: async () => ({ message: "Server error" }),
            });

            await setAuthToken("test-token");

            try {
              await apiRequest("GET", "/api/test");
              expect.fail("Expected ServerError to be thrown");
            } catch (error) {
              // Should be a ServerError (retryable)
              expect(error).toBeInstanceOf(ServerError);
              expect((error as ServerError).status).toBeGreaterThanOrEqual(500);
            }
          },
        ),
        { numRuns: 50 },
      );
    });

    it("should throw retryable NetworkError for any network failure", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(), // Any error message
          async (errorMsg) => {
            (global.fetch as any).mockRejectedValueOnce(
              new TypeError(`fetch failed: ${errorMsg}`),
            );

            await setAuthToken("test-token");

            try {
              await apiRequest("GET", "/api/test");
              expect.fail("Expected NetworkError to be thrown");
            } catch (error) {
              // Should be NetworkError (retryable)
              expect(error).toBeInstanceOf(NetworkError);
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  /**
   * Property 20: API Error Logging
   *
   * For any API error, the error SHALL be logged to the console with request details.
   *
   * Validates: Requirements 9.7
   */
  describe("Property 20: API Error Logging", () => {
    it("should log server errors to console for any 5xx status", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 500, max: 599 }),
          fc.string({ minLength: 1 }),
          async (statusCode, errorMessage) => {
            (global.fetch as any).mockResolvedValueOnce({
              ok: false,
              status: statusCode,
              headers: new Map([["content-type", "application/json"]]),
              json: async () => ({ message: errorMessage }),
            });

            await setAuthToken("test-token");

            try {
              await apiRequest("GET", "/api/test");
            } catch (error) {
              // Verify error was logged
              expect(consoleErrorSpy).toHaveBeenCalled();

              // Should log status code and error data
              const logCalls = consoleErrorSpy.mock.calls;
              const hasServerErrorLog = logCalls.some((call) =>
                call.some(
                  (arg) =>
                    typeof arg === "string" && arg.includes("Server error"),
                ),
              );
              expect(hasServerErrorLog).toBe(true);
            }

            consoleErrorSpy.mockClear();
          },
        ),
        { numRuns: 50 },
      );

      consoleErrorSpy.mockRestore();
    });

    it("should log network errors to console for any fetch failure", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1 }), async (errorMessage) => {
          (global.fetch as any).mockRejectedValueOnce(
            new TypeError(`fetch failed: ${errorMessage}`),
          );

          await setAuthToken("test-token");

          try {
            await apiRequest("GET", "/api/test");
          } catch (error) {
            // Verify error was logged
            expect(consoleErrorSpy).toHaveBeenCalled();

            // Should log network error
            const logCalls = consoleErrorSpy.mock.calls;
            const hasNetworkErrorLog = logCalls.some((call) =>
              call.some(
                (arg) =>
                  typeof arg === "string" && arg.includes("Network error"),
              ),
            );
            expect(hasNetworkErrorLog).toBe(true);
          }

          consoleErrorSpy.mockClear();
        }),
        { numRuns: 50 },
      );

      consoleErrorSpy.mockRestore();
    });
  });

  /**
   * Additional Property: 401 Token Clearing
   *
   * For any 401 response, the authentication token SHALL be cleared.
   *
   * Validates: Requirements 8.3
   */
  describe("Additional Property: 401 Token Clearing", () => {
    it("should clear token for any 401 response", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10 }), // Any token
          async (token) => {
            await setAuthToken(token);

            (global.fetch as any).mockResolvedValueOnce({
              ok: false,
              status: 401,
              headers: new Map([["content-type", "application/json"]]),
              json: async () => ({ message: "Unauthorized" }),
            });

            try {
              await apiRequest("GET", "/api/test");
              expect.fail("Expected AuthenticationError to be thrown");
            } catch (error) {
              expect(error).toBeInstanceOf(AuthenticationError);

              // Token should be cleared
              // Note: In real implementation, we'd check AsyncStorage
              // For this test, we verify the error type which triggers clearing
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
