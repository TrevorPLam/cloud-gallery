// Core functionality tests for zero-knowledge key management system.
// Tests Argon2id derivation and hierarchical keys without expo dependencies.

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  deriveKeyWithContext,
  deriveMasterKey,
  deriveSpecializedKey,
  generateDerivationSalt,
  isValidKey,
  KeyType,
  ARGON2ID_CONFIG,
  MASTER_KEY_SALT,
  FILE_KEY_CONTEXT,
} from "./key-derivation";

// Mock argon2 for testing
vi.mock("argon2", () => ({
  argon2: {
    hash: vi.fn(async (password: string, options: any) => {
      // Simple mock that returns deterministic hash based on inputs
      const input = password + JSON.stringify(options.salt) + options.associatedData;
      const hash = Buffer.from(input).toString('hex').padEnd(64, '0').slice(0, 64);
      return Buffer.from(hash, 'hex');
    }),
  },
}));

// Mock crypto for Node.js environment
const mockCrypto = {
  getRandomValues: vi.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
};

Object.defineProperty(global, "crypto", {
  value: mockCrypto,
  writable: true,
});

describe("Key Derivation Core", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateDerivationSalt", () => {
    it("should generate a 16-byte salt", () => {
      const salt = generateDerivationSalt();
      expect(salt).toMatch(/^[0-9a-fA-F]{32}$/); // 16 bytes = 32 hex chars
    });

    it("should generate unique salts", () => {
      const salt1 = generateDerivationSalt();
      const salt2 = generateDerivationSalt();
      expect(salt1).not.toBe(salt2);
    });
  });

  describe("deriveKeyWithContext", () => {
    const testPassword = "test-password-123";
    const testSalt = "abcdef1234567890abcdef1234567890"; // 16 bytes
    const testContext = "test-context";

    it("should derive a key with correct length", async () => {
      const key = await deriveKeyWithContext(testPassword, testSalt, testContext);
      expect(key).toMatch(/^[0-9a-fA-F]{64}$/); // 32 bytes = 64 hex chars
    });

    it("should derive different keys for different contexts", async () => {
      const key1 = await deriveKeyWithContext(testPassword, testSalt, "context1");
      const key2 = await deriveKeyWithContext(testPassword, testSalt, "context2");
      expect(key1).not.toBe(key2);
    });

    it("should derive same key for same inputs", async () => {
      const key1 = await deriveKeyWithContext(testPassword, testSalt, testContext);
      const key2 = await deriveKeyWithContext(testPassword, testSalt, testContext);
      expect(key1).toBe(key2);
    });

    it("should validate salt length", async () => {
      await expect(
        deriveKeyWithContext(testPassword, "short", testContext)
      ).rejects.toThrow("Salt must be 16 bytes");
    });
  });

  describe("deriveMasterKey", () => {
    const testPassword = "master-password-123";

    it("should derive master key with generated salt", async () => {
      const result = await deriveMasterKey(testPassword);
      
      expect(result.key).toMatch(/^[0-9a-fA-F]{64}$/);
      expect(result.salt).toMatch(/^[0-9a-fA-F]{32}$/);
      expect(result.context).toBe(MASTER_KEY_SALT);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it("should use provided salt", async () => {
      const salt = generateDerivationSalt();
      const result = await deriveMasterKey(testPassword, salt);
      
      expect(result.salt).toBe(salt);
    });

    it("should derive different keys for different passwords", async () => {
      const result1 = await deriveMasterKey("password1");
      const result2 = await deriveMasterKey("password2");
      expect(result1.key).not.toBe(result2.key);
    });
  });

  describe("deriveSpecializedKey", () => {
    const masterKey = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    it("should derive file key", async () => {
      const result = await deriveSpecializedKey(masterKey, KeyType.FILE, "file123");
      
      expect(result.key).toMatch(/^[0-9a-fA-F]{64}$/);
      expect(result.context).toBe(`${FILE_KEY_CONTEXT}:file123`);
    });

    it("should derive sharing key", async () => {
      const result = await deriveSpecializedKey(masterKey, KeyType.SHARING, "share123");
      
      expect(result.key).toMatch(/^[0-9a-fA-F]{64}$/);
      expect(result.context).toContain("sharing");
    });

    it("should derive device key", async () => {
      const result = await deriveSpecializedKey(masterKey, KeyType.DEVICE, "device123");
      
      expect(result.key).toMatch(/^[0-9a-fA-F]{64}$/);
      expect(result.context).toContain("device");
    });

    it("should derive different keys for same master key", async () => {
      const fileKey = await deriveSpecializedKey(masterKey, KeyType.FILE, "file123");
      const sharingKey = await deriveSpecializedKey(masterKey, KeyType.SHARING, "share123");
      expect(fileKey.key).not.toBe(sharingKey.key);
    });

    it("should validate master key format", async () => {
      await expect(
        deriveSpecializedKey("invalid-key", KeyType.FILE)
      ).rejects.toThrow("Invalid master key format");
    });
  });

  describe("isValidKey", () => {
    it("should validate correct key format", () => {
      const validKey = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      expect(isValidKey(validKey)).toBe(true);
    });

    it("should reject invalid key length", () => {
      const shortKey = "abcdef1234567890";
      expect(isValidKey(shortKey)).toBe(false);
    });

    it("should reject non-hex characters", () => {
      const invalidKey = "ghijklmnopqrstuvwxyz1234567890abcdef1234567890abcdef1234567890";
      expect(isValidKey(invalidKey)).toBe(false);
    });
  });
});

describe("Security Properties", () => {
  it("should use OWASP-compliant Argon2id parameters", () => {
    expect(ARGON2ID_CONFIG.memoryCost).toBe(64 * 1024); // 64MB
    expect(ARGON2ID_CONFIG.timeCost).toBe(3); // 3 iterations
    expect(ARGON2ID_CONFIG.parallelism).toBe(2); // 2 threads
    expect(ARGON2ID_CONFIG.type).toBe("argon2id");
  });

  it("should ensure key separation between contexts", async () => {
    const masterKey = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    
    const fileKey1 = await deriveSpecializedKey(masterKey, KeyType.FILE, "file1");
    const fileKey2 = await deriveSpecializedKey(masterKey, KeyType.FILE, "file2");
    const sharingKey = await deriveSpecializedKey(masterKey, KeyType.SHARING, "file1");
    
    // All should be different despite some having same identifiers
    expect(fileKey1.key).not.toBe(fileKey2.key);
    expect(fileKey1.key).not.toBe(sharingKey.key);
    expect(fileKey2.key).not.toBe(sharingKey.key);
  });

  it("should handle edge cases gracefully", async () => {
    // Empty password
    await expect(deriveMasterKey("")).rejects.toThrow();

    // Very long password
    const longPassword = "a".repeat(1000);
    const result = await deriveMasterKey(longPassword);
    expect(result.key).toMatch(/^[0-9a-fA-F]{64}$/);

    // Special characters in password
    const specialPassword = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
    const specialResult = await deriveMasterKey(specialPassword);
    expect(specialResult.key).toMatch(/^[0-9a-fA-F]{64}$/);
  });
});

describe("Key Hierarchy Integration", () => {
  const mockMasterKey = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

  it("should maintain key hierarchy consistency", async () => {
    // Derive keys from same master key
    const fileKey1 = await deriveSpecializedKey(mockMasterKey, KeyType.FILE, "file1");
    const fileKey1Again = await deriveSpecializedKey(mockMasterKey, KeyType.FILE, "file1");
    const fileKey2 = await deriveSpecializedKey(mockMasterKey, KeyType.FILE, "file2");
    
    // Same inputs should produce same keys
    expect(fileKey1.key).toBe(fileKey1Again.key);
    
    // Different identifiers should produce different keys
    expect(fileKey1.key).not.toBe(fileKey2.key);
  });

  it("should provide proper domain separation", async () => {
    const fileKey = await deriveSpecializedKey(mockMasterKey, KeyType.FILE, "same-id");
    const sharingKey = await deriveSpecializedKey(mockMasterKey, KeyType.SHARING, "same-id");
    const deviceKey = await deriveSpecializedKey(mockMasterKey, KeyType.DEVICE, "same-id");
    
    // Even with same identifier, different key types should produce different keys
    expect(fileKey.key).not.toBe(sharingKey.key);
    expect(sharingKey.key).not.toBe(deviceKey.key);
    expect(deviceKey.key).not.toBe(fileKey.key);
  });
});
