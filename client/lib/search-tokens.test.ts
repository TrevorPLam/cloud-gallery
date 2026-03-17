// Comprehensive test suite for Search Tokens functionality
// Tests token generation, validation, and management

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initializeTokenManager,
  generateExactMatchToken,
  generatePrefixToken,
  generateBooleanToken,
  validateToken,
  revokeToken,
  createTokenizedRequest,
  verifyTokenizedRequest,
  cleanupExpiredTokens,
  getTokenManagerStats,
  exportTokenManager,
  importTokenManager,
  TokenManager,
  SearchOperator,
  TOKEN_EXPIRY_DEFAULT,
  TOKEN_CACHE_SIZE,
} from "./search-tokens";
import { initializeSSE, generateSSEKey } from "./encrypted-search";

describe("Search Tokens", () => {
  let tokenManager: TokenManager;
  let sseKey: string;

  beforeEach(async () => {
    await initializeSSE();
    sseKey = generateSSEKey();
    tokenManager = await initializeTokenManager(sseKey);
  });

  afterEach(() => {
    // Clean up expired tokens
    cleanupExpiredTokens(tokenManager);
  });

  describe("Token Manager Initialization", () => {
    it("should initialize token manager successfully", async () => {
      const manager = await initializeTokenManager(sseKey);

      expect(manager.activeTokens.size).toBe(0);
      expect(manager.revokedTokens.size).toBe(0);
      expect(manager.tokenCache.size).toBe(0);
      expect(manager.sseKey).toBe(sseKey);
      expect(manager.defaultExpiry).toBe(TOKEN_EXPIRY_DEFAULT);
    });

    it("should accept custom expiry time", async () => {
      const customExpiry = 7200000; // 2 hours
      const manager = await initializeTokenManager(sseKey, customExpiry);

      expect(manager.defaultExpiry).toBe(customExpiry);
    });
  });

  describe("Exact Match Tokens", () => {
    it("should generate exact match tokens", async () => {
      const query = "beach vacation";
      const token = await generateExactMatchToken(tokenManager, query);

      expect(token.tokenId).toBeTypeOf("string");
      expect(token.tokenId.length).toBe(32); // 16 bytes * 2 (hex)
      expect(token.encryptedQuery).toBeTypeOf("string");
      expect(token.queryType).toBe("exact");
      expect(token.timestamp).toBeGreaterThan(0);
      expect(token.expiresAt).toBeGreaterThan(token.timestamp);
    });

    it("should cache generated tokens", async () => {
      const query = "sunset photography";
      await generateExactMatchToken(tokenManager, query);

      expect(tokenManager.activeTokens.size).toBe(1);
      expect(tokenManager.tokenCache.size).toBe(1);
    });

    it("should reject empty queries", async () => {
      await expect(generateExactMatchToken(tokenManager, "")).rejects.toThrow(
        "Query cannot be empty",
      );

      await expect(
        generateExactMatchToken(tokenManager, "   "),
      ).rejects.toThrow("Query cannot be empty");
    });

    it("should reject queries that are too long", async () => {
      const longQuery = "a".repeat(501); // Exceeds MAX_QUERY_LENGTH

      await expect(
        generateExactMatchToken(tokenManager, longQuery),
      ).rejects.toThrow("exceeds maximum length");
    });

    it("should generate different tokens for different queries", async () => {
      const token1 = await generateExactMatchToken(tokenManager, "beach");
      const token2 = await generateExactMatchToken(tokenManager, "mountain");

      expect(token1.tokenId).not.toBe(token2.tokenId);
      expect(token1.encryptedQuery).not.toBe(token2.encryptedQuery);
    });

    it("should generate same encrypted query for same input", async () => {
      const query = "family portrait";
      const token1 = await generateExactMatchToken(tokenManager, query);
      const token2 = await generateExactMatchToken(tokenManager, query);

      expect(token1.encryptedQuery).toBe(token2.encryptedQuery);
      expect(token1.tokenId).not.toBe(token2.tokenId); // Different token IDs
    });
  });

  describe("Prefix Tokens", () => {
    it("should generate prefix tokens", async () => {
      const prefix = "beach";
      const token = await generatePrefixToken(tokenManager, prefix);

      expect(token.tokenId).toBeTypeOf("string");
      expect(token.encryptedQuery).toBeTypeOf("string");
      expect(token.queryType).toBe("prefix");
      expect(token.timestamp).toBeGreaterThan(0);
      expect(token.expiresAt).toBeGreaterThan(token.timestamp);
    });

    it("should handle prefix tokens correctly", async () => {
      const prefix = "photo";
      const token = await generatePrefixToken(tokenManager, prefix);

      expect(token.queryType).toBe("prefix");
      // Encrypted query should contain the prefix with wildcard
      expect(token.encryptedQuery.length).toBeGreaterThan(0);
    });

    it("should reject empty prefixes", async () => {
      await expect(generatePrefixToken(tokenManager, "")).rejects.toThrow(
        "Prefix cannot be empty",
      );
    });

    it("should generate different encrypted queries for different prefixes", async () => {
      const token1 = await generatePrefixToken(tokenManager, "beach");
      const token2 = await generatePrefixToken(tokenManager, "mountain");

      expect(token1.encryptedQuery).not.toBe(token2.encryptedQuery);
    });
  });

  describe("Boolean Tokens", () => {
    it("should generate boolean tokens with AND operator", async () => {
      const terms = ["beach", "sunset"];
      const operators = [SearchOperator.AND];
      const token = await generateBooleanToken(tokenManager, terms, operators);

      expect(token.tokenId).toBeTypeOf("string");
      expect(token.encryptedQuery).toBeTypeOf("string");
      expect(token.queryType).toBe("boolean");
      expect(token.operators).toEqual([SearchOperator.AND]);
    });

    it("should generate boolean tokens with OR operator", async () => {
      const terms = ["vacation", "travel"];
      const operators = [SearchOperator.OR];
      const token = await generateBooleanToken(tokenManager, terms, operators);

      expect(token.operators).toEqual([SearchOperator.OR]);
    });

    it("should generate boolean tokens with NOT operator", async () => {
      const terms = ["beach", "crowded"];
      const operators = [SearchOperator.NOT];
      const token = await generateBooleanToken(tokenManager, terms, operators);

      expect(token.operators).toEqual([SearchOperator.NOT]);
    });

    it("should handle multiple operators", async () => {
      const terms = ["beach", "sunset", "family"];
      const operators = [SearchOperator.AND, SearchOperator.OR];
      const token = await generateBooleanToken(tokenManager, terms, operators);

      expect(token.operators).toEqual([SearchOperator.AND, SearchOperator.OR]);
    });

    it("should reject invalid term/operator combinations", async () => {
      // Too few operators
      await expect(
        generateBooleanToken(tokenManager, ["beach", "sunset"], []),
      ).rejects.toThrow("Number of operators must be one less");

      // Too many operators
      await expect(
        generateBooleanToken(
          tokenManager,
          ["beach", "sunset"],
          [SearchOperator.AND, SearchOperator.OR],
        ),
      ).rejects.toThrow("Number of operators must be one less");

      // No terms
      await expect(generateBooleanToken(tokenManager, [], [])).rejects.toThrow(
        "At least one term is required",
      );

      // Too many terms
      const manyTerms = Array(11).fill("term");
      const manyOperators = Array(10).fill(SearchOperator.AND);
      await expect(
        generateBooleanToken(tokenManager, manyTerms, manyOperators),
      ).rejects.toThrow("Maximum 10 terms allowed");
    });

    it("should reject empty terms in boolean queries", async () => {
      await expect(
        generateBooleanToken(tokenManager, ["beach", ""], [SearchOperator.AND]),
      ).rejects.toThrow("All terms must be non-empty");
    });
  });

  describe("Token Validation", () => {
    beforeEach(async () => {
      // Add some test tokens
      await generateExactMatchToken(tokenManager, "test1");
      await generatePrefixToken(tokenManager, "test2");
      await generateBooleanToken(
        tokenManager,
        ["test3", "test4"],
        [SearchOperator.OR],
      );
    });

    it("should validate active tokens", () => {
      const tokenId = Array.from(tokenManager.activeTokens.keys())[0];
      const validation = validateToken(tokenManager, tokenId);

      expect(validation.isValid).toBe(true);
      expect(validation.tokenId).toBe(tokenId);
      expect(validation.isExpired).toBe(false);
      expect(validation.timeRemaining).toBeGreaterThan(0);
    });

    it("should invalidate expired tokens", async () => {
      // Create token with very short expiry
      const shortExpiry = 1; // 1 millisecond
      const token = await generateExactMatchToken(
        tokenManager,
        "test",
        shortExpiry,
      );

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const validation = validateToken(tokenManager, token.tokenId);

      expect(validation.isValid).toBe(false);
      expect(validation.isExpired).toBe(true);
      expect(validation.timeRemaining).toBeLessThanOrEqual(0);
    });

    it("should invalidate non-existent tokens", () => {
      const validation = validateToken(tokenManager, "nonexistent-token");

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe("Token not found");
    });

    it("should invalidate revoked tokens", async () => {
      const tokenId = Array.from(tokenManager.activeTokens.keys())[0];

      revokeToken(tokenManager, tokenId);

      const validation = validateToken(tokenManager, tokenId);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe("Token has been revoked");
    });
  });

  describe("Token Revocation", () => {
    beforeEach(async () => {
      await generateExactMatchToken(tokenManager, "test");
    });

    it("should revoke tokens successfully", () => {
      const tokenId = Array.from(tokenManager.activeTokens.keys())[0];
      const initialActiveCount = tokenManager.activeTokens.size;

      revokeToken(tokenManager, tokenId);

      expect(tokenManager.activeTokens.size).toBe(initialActiveCount - 1);
      expect(tokenManager.revokedTokens.has(tokenId)).toBe(true);
      expect(tokenManager.tokenCache.has(tokenId)).toBe(false);
    });

    it("should handle revocation of non-existent tokens", () => {
      expect(() => {
        revokeToken(tokenManager, "nonexistent-token");
      }).not.toThrow();
    });

    it("should prevent reuse of revoked tokens", () => {
      const tokenId = Array.from(tokenManager.activeTokens.keys())[0];

      revokeToken(tokenManager, tokenId);

      const validation = validateToken(tokenManager, tokenId);
      expect(validation.isValid).toBe(false);
    });
  });

  describe("Tokenized Requests", () => {
    beforeEach(async () => {
      await generateExactMatchToken(tokenManager, "test query");
    });

    it("should create tokenized requests", async () => {
      const token = Array.from(tokenManager.activeTokens.values())[0].token;
      const request = createTokenizedRequest(tokenManager, token);

      expect(request.token).toBe(token);
      expect(request.encryptedQuery).toBe(token.encryptedQuery);
      expect(request.requestMetadata.userAgent).toBeTypeOf("string");
      expect(request.requestMetadata.timestamp).toBeGreaterThan(0);
      expect(request.requestMetadata.requestId).toBeTypeOf("string");
    });

    it("should reject invalid tokens in requests", async () => {
      const expiredToken = await generateExactMatchToken(
        tokenManager,
        "test",
        1,
      );

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(() => {
        createTokenizedRequest(tokenManager, expiredToken);
      }).toThrow("Invalid token");
    });

    it("should update token usage statistics", async () => {
      const token = Array.from(tokenManager.activeTokens.values())[0].token;
      const cacheEntry = Array.from(tokenManager.activeTokens.values())[0];
      const initialUseCount = cacheEntry.useCount;

      createTokenizedRequest(tokenManager, token);

      const updatedCacheEntry = tokenManager.activeTokens.get(token.tokenId);
      expect(updatedCacheEntry?.useCount).toBe(initialUseCount + 1);
    });

    it("should accept custom request metadata", async () => {
      const token = Array.from(tokenManager.activeTokens.values())[0].token;
      const customMetadata = {
        userAgent: "CustomAgent/1.0",
        requestId: "custom-request-id",
      };

      const request = createTokenizedRequest(
        tokenManager,
        token,
        customMetadata,
      );

      expect(request.requestMetadata.userAgent).toBe("CustomAgent/1.0");
      expect(request.requestMetadata.requestId).toBe("custom-request-id");
    });
  });

  describe("Token Verification", () => {
    it("should verify valid tokenized requests", async () => {
      const token = await generateExactMatchToken(tokenManager, "test");
      const request = createTokenizedRequest(tokenManager, token);

      const verification = await verifyTokenizedRequest(request, sseKey);

      expect(verification.isValid).toBe(true);
      expect(verification.tokenId).toBe(token.tokenId);
      expect(verification.queryType).toBe(token.queryType);
    });

    it("should reject expired requests", async () => {
      const token = await generateExactMatchToken(tokenManager, "test", 1);
      const request = createTokenizedRequest(tokenManager, token);

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const verification = await verifyTokenizedRequest(request, sseKey);

      expect(verification.isValid).toBe(false);
      expect(verification.error).toBe("Token has expired");
    });

    it("should reject requests with tampered data", async () => {
      const token = await generateExactMatchToken(tokenManager, "test");
      const request = createTokenizedRequest(tokenManager, token);

      // Tamper with the encrypted query
      request.encryptedQuery = "tampered-data";

      const verification = await verifyTokenizedRequest(request, sseKey);

      expect(verification.isValid).toBe(false);
      expect(verification.error).toBe("Token integrity verification failed");
    });
  });

  describe("Token Cleanup", () => {
    beforeEach(async () => {
      // Add tokens with different expiry times
      await generateExactMatchToken(
        tokenManager,
        "long-lived",
        TOKEN_EXPIRY_DEFAULT,
      );
      await generateExactMatchToken(tokenManager, "short-lived", 1);
    });

    it("should clean up expired tokens", async () => {
      const initialCount = tokenManager.activeTokens.size;

      // Wait for short-lived token to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const cleanedCount = cleanupExpiredTokens(tokenManager);

      expect(cleanedCount).toBe(1);
      expect(tokenManager.activeTokens.size).toBe(initialCount - 1);
    });

    it("should return zero when no expired tokens", () => {
      const cleanedCount = cleanupExpiredTokens(tokenManager);

      expect(cleanedCount).toBe(0);
    });
  });

  describe("Token Manager Statistics", () => {
    beforeEach(async () => {
      // Add test tokens
      await generateExactMatchToken(tokenManager, "test1");
      await generatePrefixToken(tokenManager, "test2");

      // Use one token multiple times
      const token = Array.from(tokenManager.activeTokens.values())[0].token;
      createTokenizedRequest(tokenManager, token);
      createTokenizedRequest(tokenManager, token);
    });

    it("should calculate accurate statistics", () => {
      const stats = getTokenManagerStats(tokenManager);

      expect(stats.activeTokens).toBe(2);
      expect(stats.revokedTokens).toBe(0);
      expect(stats.cachedTokens).toBe(2);
      expect(stats.averageUseCount).toBeGreaterThanOrEqual(1);
      expect(stats.oldestTokenAge).toBeGreaterThanOrEqual(0);
      expect(stats.newestTokenAge).toBeGreaterThanOrEqual(0);
    });

    it("should update statistics after token revocation", () => {
      const tokenId = Array.from(tokenManager.activeTokens.keys())[0];

      revokeToken(tokenManager, tokenId);

      const stats = getTokenManagerStats(tokenManager);

      expect(stats.activeTokens).toBe(1);
      expect(stats.revokedTokens).toBe(1);
    });
  });

  describe("Token Manager Persistence", () => {
    beforeEach(async () => {
      // Add test data
      await generateExactMatchToken(tokenManager, "test1");
      await generatePrefixToken(tokenManager, "test2");
    });

    it("should export token manager state", () => {
      const exported = exportTokenManager(tokenManager);

      expect(exported).toBeTypeOf("string");
      expect(() => JSON.parse(exported)).not.toThrow();

      const parsed = JSON.parse(exported);
      expect(parsed.activeTokens).toBeDefined();
      expect(parsed.revokedTokens).toBeDefined();
      expect(parsed.tokenCache).toBeDefined();
      expect(parsed.defaultExpiry).toBeDefined();
      // SSE key should not be exported
      expect(parsed.sseKey).toBeUndefined();
    });

    it("should import token manager state", () => {
      const exported = exportTokenManager(tokenManager);
      const imported = importTokenManager(exported, sseKey);

      expect(imported.activeTokens.size).toBe(tokenManager.activeTokens.size);
      expect(imported.revokedTokens.size).toBe(tokenManager.revokedTokens.size);
      expect(imported.defaultExpiry).toBe(tokenManager.defaultExpiry);
      expect(imported.sseKey).toBe(sseKey);
    });

    it("should clean up expired tokens during import", async () => {
      // Add short-lived token
      await generateExactMatchToken(tokenManager, "short-lived", 1);

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const exported = exportTokenManager(tokenManager);
      const imported = importTokenManager(exported, sseKey);

      // Expired tokens should be cleaned up
      const stats = getTokenManagerStats(imported);
      expect(stats.activeTokens).toBeLessThan(tokenManager.activeTokens.size);
    });

    it("should handle invalid export data", () => {
      expect(() => {
        importTokenManager("invalid json", sseKey);
      }).toThrow();

      expect(() => {
        importTokenManager('{"invalid": "structure"}', sseKey);
      }).toThrow();
    });
  });

  describe("Cache Management", () => {
    it("should limit cache size", async () => {
      // Fill cache beyond limit
      for (let i = 0; i < TOKEN_CACHE_SIZE + 10; i++) {
        await generateExactMatchToken(tokenManager, `test${i}`);
      }

      expect(tokenManager.activeTokens.size).toBeLessThanOrEqual(
        TOKEN_CACHE_SIZE,
      );
      expect(tokenManager.tokenCache.size).toBeLessThanOrEqual(
        TOKEN_CACHE_SIZE,
      );
    });

    it("should remove oldest tokens when cache is full", async () => {
      // Fill cache to capacity
      for (let i = 0; i < TOKEN_CACHE_SIZE; i++) {
        await generateExactMatchToken(tokenManager, `test${i}`);
      }

      const firstTokenId = Array.from(tokenManager.activeTokens.keys())[0];

      // Add one more token to trigger eviction
      await generateExactMatchToken(tokenManager, "new-token");

      expect(tokenManager.activeTokens.has(firstTokenId)).toBe(false);
      expect(tokenManager.activeTokens.size).toBe(TOKEN_CACHE_SIZE);
    });
  });

  describe("Performance Tests", () => {
    it("should handle large number of tokens efficiently", async () => {
      const startTime = Date.now();

      // Generate many tokens
      for (let i = 0; i < 100; i++) {
        await generateExactMatchToken(tokenManager, `test${i}`);
      }

      const generationTime = Date.now() - startTime;

      expect(tokenManager.activeTokens.size).toBe(100);
      expect(generationTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Test validation performance
      const validationStartTime = Date.now();

      for (const tokenId of tokenManager.activeTokens.keys()) {
        validateToken(tokenManager, tokenId);
      }

      const validationTime = Date.now() - validationStartTime;
      expect(validationTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should handle concurrent token operations", async () => {
      const promises: Promise<any>[] = [];

      // Generate tokens concurrently
      for (let i = 0; i < 50; i++) {
        promises.push(generateExactMatchToken(tokenManager, `concurrent${i}`));
      }

      await Promise.all(promises);

      expect(tokenManager.activeTokens.size).toBe(50);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long queries", async () => {
      const longQuery = "a".repeat(500);

      expect(async () => {
        await generateExactMatchToken(tokenManager, longQuery);
      }).rejects.toThrow();
    });

    it("should handle special characters in queries", async () => {
      const specialQueries = [
        "test@example.com",
        "photo_2024-01-15",
        "bébé photos",
        "🌅 sunset",
        "search with spaces",
      ];

      for (const query of specialQueries) {
        expect(async () => {
          await generateExactMatchToken(tokenManager, query);
        }).resolves.not.toThrow();
      }
    });

    it("should handle unicode characters in boolean queries", async () => {
      const terms = ["bébé", "familia"];
      const operators = [SearchOperator.OR];

      expect(async () => {
        await generateBooleanToken(tokenManager, terms, operators);
      }).resolves.not.toThrow();
    });

    it("should handle empty token manager", () => {
      const emptyManager = tokenManager;
      const stats = getTokenManagerStats(emptyManager);

      expect(stats.activeTokens).toBe(0);
      expect(stats.revokedTokens).toBe(0);
      expect(stats.cachedTokens).toBe(0);
      expect(stats.averageUseCount).toBe(0);
    });
  });
});
