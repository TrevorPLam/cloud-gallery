// Comprehensive test suite for Encrypted Search functionality
// Tests deterministic encryption, frequency protection, and security properties

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initializeSSE,
  generateSSEKey,
  encryptSearchTerm,
  decryptSearchTerm,
  isValidSSEKey,
  secureWipeSSE,
  SearchTokenType,
  SSE_KEYBYTES,
  MIN_QUERY_LENGTH,
  MAX_QUERY_LENGTH,
} from "./encrypted-search";

describe("Encrypted Search", () => {
  let sseKey: string;

  beforeEach(async () => {
    await initializeSSE();
    sseKey = generateSSEKey();
  });

  afterEach(() => {
    // Clean up sensitive data
    if (sseKey) {
      secureWipeSSE(sseKey);
    }
  });

  describe("SSE Initialization", () => {
    it("should initialize SSE system successfully", async () => {
      await expect(initializeSSE()).resolves.not.toThrow();
    });

    it("should generate valid SSE keys", () => {
      const key = generateSSEKey();
      expect(key).toBeTypeOf("string");
      expect(key.length).toBe(SSE_KEYBYTES * 2); // hex string
      expect(isValidSSEKey(key)).toBe(true);
    });

    it("should validate SSE key format", () => {
      expect(isValidSSEKey(sseKey)).toBe(true);
      expect(isValidSSEKey("invalid")).toBe(false);
      expect(isValidSSEKey("")).toBe(false);
      expect(isValidSSEKey("ab12")).toBe(false); // Too short
    });
  });

  describe("Deterministic Encryption", () => {
    it("should encrypt search terms deterministically", () => {
      const term = "beach vacation";
      const encrypted1 = encryptSearchTerm(term, sseKey);
      const encrypted2 = encryptSearchTerm(term, sseKey);

      // Same term should produce same encrypted value
      expect(encrypted1.encryptedTerm).toBe(encrypted2.encryptedTerm);
      expect(encrypted1.termHash).toBe(encrypted2.termHash);
      expect(encrypted1.tokenType).toBe(SearchTokenType.EXACT);
    });

    it("should encrypt different terms to different values", () => {
      const term1 = "beach vacation";
      const term2 = "mountain hiking";
      const encrypted1 = encryptSearchTerm(term1, sseKey);
      const encrypted2 = encryptSearchTerm(term2, sseKey);

      expect(encrypted1.encryptedTerm).not.toBe(encrypted2.encryptedTerm);
      expect(encrypted1.termHash).not.toBe(encrypted2.termHash);
    });

    it("should normalize terms case-insensitively", () => {
      const term1 = "Beach Vacation";
      const term2 = "beach vacation";
      const term3 = "BEACH VACATION";

      const encrypted1 = encryptSearchTerm(term1, sseKey);
      const encrypted2 = encryptSearchTerm(term2, sseKey);
      const encrypted3 = encryptSearchTerm(term3, sseKey);

      expect(encrypted1.encryptedTerm).toBe(encrypted2.encryptedTerm);
      expect(encrypted2.encryptedTerm).toBe(encrypted3.encryptedTerm);
    });

    it("should trim whitespace from terms", () => {
      const term1 = "beach vacation";
      const term2 = "  beach vacation  ";
      const term3 = "\tbeach vacation\n";

      const encrypted1 = encryptSearchTerm(term1, sseKey);
      const encrypted2 = encryptSearchTerm(term2, sseKey);
      const encrypted3 = encryptSearchTerm(term3, sseKey);

      expect(encrypted1.encryptedTerm).toBe(encrypted2.encryptedTerm);
      expect(encrypted2.encryptedTerm).toBe(encrypted3.encryptedTerm);
    });
  });

  describe("Decryption", () => {
    it("should decrypt terms correctly", () => {
      const originalTerm = "sunset photography";
      const encrypted = encryptSearchTerm(originalTerm, sseKey);
      const decrypted = decryptSearchTerm(encrypted, sseKey);

      expect(decrypted).toBe(originalTerm.toLowerCase());
    });

    it("should fail decryption with wrong key", () => {
      const originalTerm = "family portrait";
      const encrypted = encryptSearchTerm(originalTerm, sseKey);
      const wrongKey = generateSSEKey();

      expect(() => {
        decryptSearchTerm(encrypted, wrongKey);
      }).toThrow();
    });

    it("should verify term integrity during decryption", () => {
      const originalTerm = "birthday party";
      const encrypted = encryptSearchTerm(originalTerm, sseKey);

      // Tamper with the encrypted data
      const tamperedEncrypted = {
        ...encrypted,
        termHash: "invalidhash1234567890abcdef",
      };

      expect(() => {
        decryptSearchTerm(tamperedEncrypted, sseKey);
      }).toThrow("integrity verification failed");
    });
  });

  describe("Frequency Analysis Protection", () => {
    it("should apply padding buckets for frequency protection", () => {
      const term = "test";
      const encrypted = encryptSearchTerm(term, sseKey);

      expect(encrypted.bucketSize).toBeGreaterThan(0);
      expect([8, 16, 32, 64, 128, 256]).toContain(encrypted.bucketSize);
    });

    it("should generate blinding factors for additional privacy", () => {
      const term = "privacy test";
      const encrypted = encryptSearchTerm(term, sseKey);

      expect(encrypted.blindingFactor).toBeTypeOf("string");
      expect(encrypted.blindingFactor.length).toBeGreaterThan(0);
    });

    it("should use different bucket sizes for same term", () => {
      const term = "frequency test";
      const encrypted1 = encryptSearchTerm(term, sseKey);
      const encrypted2 = encryptSearchTerm(term, sseKey);

      // Same encrypted term but potentially different bucket sizes
      expect(encrypted1.encryptedTerm).toBe(encrypted2.encryptedTerm);
      // Bucket sizes might differ due to random selection
      expect([8, 16, 32, 64, 128, 256]).toContain(encrypted1.bucketSize);
      expect([8, 16, 32, 64, 128, 256]).toContain(encrypted2.bucketSize);
    });
  });

  describe("Input Validation", () => {
    it("should reject empty queries", () => {
      expect(() => {
        encryptSearchTerm("", sseKey);
      }).toThrow("Search term must be");

      expect(() => {
        encryptSearchTerm("   ", sseKey);
      }).toThrow("Search term must be");
    });

    it("should reject queries that are too short", () => {
      expect(() => {
        encryptSearchTerm("", sseKey);
      }).toThrow();

      if (MIN_QUERY_LENGTH > 0) {
        expect(() => {
          encryptSearchTerm("a".repeat(MIN_QUERY_LENGTH - 1), sseKey);
        }).toThrow();
      }
    });

    it("should reject queries that are too long", () => {
      expect(() => {
        encryptSearchTerm("a".repeat(MAX_QUERY_LENGTH + 1), sseKey);
      }).toThrow("exceeds maximum length");
    });

    it("should reject invalid SSE keys", () => {
      const term = "test";

      expect(() => {
        encryptSearchTerm(term, "");
      }).toThrow("Invalid SSE key");

      expect(() => {
        encryptSearchTerm(term, "invalid");
      }).toThrow("Invalid SSE key");

      expect(() => {
        encryptSearchTerm(term, "ab12");
      }).toThrow("Invalid SSE key");
    });
  });

  describe("Token Types", () => {
    it("should support different token types", () => {
      const term = "test";

      const exactToken = encryptSearchTerm(term, sseKey, SearchTokenType.EXACT);
      const prefixToken = encryptSearchTerm(
        term,
        sseKey,
        SearchTokenType.PREFIX,
      );
      const rangeToken = encryptSearchTerm(term, sseKey, SearchTokenType.RANGE);
      const booleanToken = encryptSearchTerm(
        term,
        sseKey,
        SearchTokenType.BOOLEAN,
      );

      expect(exactToken.tokenType).toBe(SearchTokenType.EXACT);
      expect(prefixToken.tokenType).toBe(SearchTokenType.PREFIX);
      expect(rangeToken.tokenType).toBe(SearchTokenType.RANGE);
      expect(booleanToken.tokenType).toBe(SearchTokenType.BOOLEAN);

      // Different token types should produce different encrypted values
      expect(exactToken.encryptedTerm).not.toBe(prefixToken.encryptedTerm);
      expect(prefixToken.encryptedTerm).not.toBe(rangeToken.encryptedTerm);
      expect(rangeToken.encryptedTerm).not.toBe(booleanToken.encryptedTerm);
    });
  });

  describe("Security Properties", () => {
    it("should produce unique term hashes", () => {
      const terms = ["term1", "term2", "term3"];
      const hashes = new Set<string>();

      for (const term of terms) {
        const encrypted = encryptSearchTerm(term, sseKey);
        hashes.add(encrypted.termHash);
      }

      expect(hashes.size).toBe(terms.length);
    });

    it("should maintain term hash consistency", () => {
      const term = "consistency test";
      const encrypted1 = encryptSearchTerm(term, sseKey);
      const encrypted2 = encryptSearchTerm(term, sseKey);

      expect(encrypted1.termHash).toBe(encrypted2.termHash);
      expect(encrypted1.termHash.length).toBe(64); // SHA-256 hex length
    });

    it("should handle special characters in terms", () => {
      const specialTerms = [
        "test@example.com",
        "photo_2024-01-15",
        "beach@sunset!",
        "mountain#hiking",
        "family&friends",
      ];

      for (const term of specialTerms) {
        expect(() => {
          const encrypted = encryptSearchTerm(term, sseKey);
          const decrypted = decryptSearchTerm(encrypted, sseKey);
          expect(decrypted).toBe(term.toLowerCase());
        }).not.toThrow();
      }
    });

    it("should handle unicode characters in terms", () => {
      const unicodeTerms = [
        "bébé photos",
        "familia feliz",
        "写真アルバム",
        "семейные фото",
        "🌅 sunset",
      ];

      for (const term of unicodeTerms) {
        expect(() => {
          const encrypted = encryptSearchTerm(term, sseKey);
          const decrypted = decryptSearchTerm(encrypted, sseKey);
          expect(decrypted).toBe(term.toLowerCase());
        }).not.toThrow();
      }
    });
  });

  describe("Performance", () => {
    it("should encrypt terms efficiently", () => {
      const term = "performance test";
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        encryptSearchTerm(term, sseKey);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete 100 encryptions in reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it("should decrypt terms efficiently", () => {
      const term = "decryption test";
      const encrypted = encryptSearchTerm(term, sseKey);
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        decryptSearchTerm(encrypted, sseKey);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete 100 decryptions in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });

  describe("Edge Cases", () => {
    it("should handle maximum length terms", () => {
      const maxTerm = "a".repeat(MAX_QUERY_LENGTH);

      expect(() => {
        const encrypted = encryptSearchTerm(maxTerm, sseKey);
        const decrypted = decryptSearchTerm(encrypted, sseKey);
        expect(decrypted).toBe(maxTerm);
      }).not.toThrow();
    });

    it("should handle minimum length terms", () => {
      const minTerm = "a".repeat(MIN_QUERY_LENGTH);

      expect(() => {
        const encrypted = encryptSearchTerm(minTerm, sseKey);
        const decrypted = decryptSearchTerm(encrypted, sseKey);
        expect(decrypted).toBe(minTerm);
      }).not.toThrow();
    });

    it("should handle terms with only whitespace", () => {
      expect(() => {
        encryptSearchTerm("   ", sseKey);
      }).toThrow();
    });

    it("should handle null/undefined inputs gracefully", () => {
      expect(() => {
        encryptSearchTerm(null as any, sseKey);
      }).toThrow();

      expect(() => {
        encryptSearchTerm(undefined as any, sseKey);
      }).toThrow();
    });
  });

  describe("Memory Management", () => {
    it("should provide secure wipe functionality", () => {
      const sensitiveData = "sensitive search term";
      const buffer = new ArrayBuffer(100);
      const view = new Uint8Array(buffer);
      view.fill(65); // Fill with 'A'

      expect(view[0]).toBe(65);

      secureWipeSSE(view);

      expect(view[0]).toBe(0);
    });

    it("should handle secure wipe of different data types", () => {
      expect(() => {
        secureWipeSSE(new Uint8Array([1, 2, 3]));
        secureWipeSSE(new ArrayBuffer(10));
        secureWipeSSE("string data"); // Should not throw
      }).not.toThrow();
    });
  });

  describe("Cryptographic Properties", () => {
    it("should produce encrypted terms of expected length", () => {
      const term = "length test";
      const encrypted = encryptSearchTerm(term, sseKey);

      // Encrypted term should be base64 encoded
      expect(encrypted.encryptedTerm).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);

      // Should be reasonably long (nonce + ciphertext + padding)
      expect(encrypted.encryptedTerm.length).toBeGreaterThan(20);
    });

    it("should maintain deterministic properties across different keys", () => {
      const term = "deterministic test";
      const key1 = generateSSEKey();
      const key2 = generateSSEKey();

      const encrypted1 = encryptSearchTerm(term, key1);
      const encrypted2 = encryptSearchTerm(term, key1);
      const encrypted3 = encryptSearchTerm(term, key2);

      // Same key = same encrypted value
      expect(encrypted1.encryptedTerm).toBe(encrypted2.encryptedTerm);

      // Different keys = different encrypted values
      expect(encrypted1.encryptedTerm).not.toBe(encrypted3.encryptedTerm);

      // Clean up
      secureWipeSSE(key1);
      secureWipeSSE(key2);
    });
  });
});
