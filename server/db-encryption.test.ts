// Database encryption tests for Cloud Gallery

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encryptField,
  decryptField,
  isEncrypted,
  encryptSensitiveFields,
  decryptSensitiveFields,
  generateDatabaseEncryptionKey,
  validateEncryptionConfig,
} from "./db-encryption";

describe("Database Encryption", () => {
  beforeEach(() => {
    // Set test environment variables
    process.env.DB_ENCRYPTION_KEY = "test-encryption-key-32-chars-long";
    process.env.DB_ENCRYPTION_SALT = "test-salt-16-chars";
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.DB_ENCRYPTION_KEY;
    delete process.env.DB_ENCRYPTION_SALT;
  });

  describe("encryptField and decryptField", () => {
    it("should encrypt and decrypt text correctly", () => {
      const plaintext = "sensitive-user-data-123";
      const encrypted = encryptField(plaintext);
      const decrypted = decryptField(encrypted);

      expect(encrypted).not.toBe(plaintext);
      expect(decrypted).toBe(plaintext);
    });

    it("should handle empty strings", () => {
      const plaintext = "";
      const encrypted = encryptField(plaintext);
      const decrypted = decryptField(encrypted);

      expect(encrypted).toBe("");
      expect(decrypted).toBe("");
    });

    it("should handle null/undefined values", () => {
      expect(encryptField(null as any)).toBe(null);
      expect(encryptField(undefined as any)).toBe(undefined);
      expect(decryptField(null as any)).toBe(null);
      expect(decryptField(undefined as any)).toBe(undefined);
    });

    it("should produce different encrypted values for same input", () => {
      const plaintext = "same-input";
      const encrypted1 = encryptField(plaintext);
      const encrypted2 = encryptField(plaintext);

      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same value
      expect(decryptField(encrypted1)).toBe(plaintext);
      expect(decryptField(encrypted2)).toBe(plaintext);
    });

    it("should handle special characters and emojis", () => {
      const plaintext = "🔐 secret data with émojis & spëcial chars!@#$%";
      const encrypted = encryptField(plaintext);
      const decrypted = decryptField(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should return unencrypted data if not properly formatted", () => {
      const notEncrypted = "plain-text-data";
      const result = decryptField(notEncrypted);

      expect(result).toBe(notEncrypted);
    });
  });

  describe("isEncrypted", () => {
    it("should correctly identify encrypted data", () => {
      const plaintext = "test-data";
      const encrypted = encryptField(plaintext);

      expect(isEncrypted(encrypted)).toBe(true);
      expect(isEncrypted(plaintext)).toBe(false);
    });

    it("should handle malformed JSON gracefully", () => {
      const malformedJson = '{"iv": "123", "data": "abc"'; // Missing tag and closing brace
      expect(isEncrypted(malformedJson)).toBe(false);
    });

    it("should handle empty and null values", () => {
      expect(isEncrypted("")).toBe(false);
      expect(isEncrypted(null as any)).toBe(false);
      expect(isEncrypted(undefined as any)).toBe(false);
    });
  });

  describe("encryptSensitiveFields and decryptSensitiveFields", () => {
    it("should encrypt specified fields in an object", () => {
      const data = {
        username: "testuser",
        password: "secret123",
        email: "test@example.com",
      };

      const sensitiveFields = ["password"] as const;
      const encrypted = encryptSensitiveFields(data, sensitiveFields);

      expect(encrypted.username).toBe("testuser");
      expect(encrypted.email).toBe("test@example.com");
      expect(encrypted.password).not.toBe("secret123");
      expect(isEncrypted(encrypted.password)).toBe(true);
    });

    it("should decrypt specified fields in an object", () => {
      const data = {
        username: "testuser",
        password: "secret123",
        email: "test@example.com",
      };

      const sensitiveFields = ["password"] as const;
      const encrypted = encryptSensitiveFields(data, sensitiveFields);
      const decrypted = decryptSensitiveFields(encrypted, sensitiveFields);

      expect(decrypted.username).toBe("testuser");
      expect(decrypted.email).toBe("test@example.com");
      expect(decrypted.password).toBe("secret123");
    });

    it("should handle multiple sensitive fields", () => {
      const data = {
        username: "testuser",
        password: "secret123",
        apiKey: "api-key-456",
        email: "test@example.com",
      };

      const sensitiveFields = ["password", "apiKey"] as const;
      const encrypted = encryptSensitiveFields(data, sensitiveFields);
      const decrypted = decryptSensitiveFields(encrypted, sensitiveFields);

      expect(encrypted.username).toBe("testuser");
      expect(encrypted.email).toBe("test@example.com");
      expect(isEncrypted(encrypted.password)).toBe(true);
      expect(isEncrypted(encrypted.apiKey)).toBe(true);

      expect(decrypted.password).toBe("secret123");
      expect(decrypted.apiKey).toBe("api-key-456");
    });

    it("should handle non-string fields gracefully", () => {
      const data = {
        username: "testuser",
        password: "secret123",
        age: 25,
        active: true,
      };

      const sensitiveFields = ["password", "age", "active"] as const;
      const encrypted = encryptSensitiveFields(data, sensitiveFields);

      expect(encrypted.age).toBe(25);
      expect(encrypted.active).toBe(true);
      expect(isEncrypted(encrypted.password)).toBe(true);
    });
  });

  describe("generateDatabaseEncryptionKey", () => {
    it("should generate a secure random key", () => {
      const key = generateDatabaseEncryptionKey();

      expect(key).toMatch(/^[a-f0-9]{128}$/); // 64 bytes = 128 hex chars
      expect(key.length).toBe(128);
    });

    it("should generate different keys each time", () => {
      const key1 = generateDatabaseEncryptionKey();
      const key2 = generateDatabaseEncryptionKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe("validateEncryptionConfig", () => {
    it("should validate proper configuration", () => {
      process.env.DB_ENCRYPTION_KEY = "proper-secure-key-32-chars-long";
      process.env.DB_ENCRYPTION_SALT = "proper-salt-16-chars";

      const validation = validateEncryptionConfig();

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toHaveLength(0);
    });

    it("should warn about missing encryption key", () => {
      delete process.env.DB_ENCRYPTION_KEY;
      process.env.DB_ENCRYPTION_SALT = "proper-salt-16-chars";

      const validation = validateEncryptionConfig();

      expect(validation.isValid).toBe(false);
      expect(
        validation.warnings.some((w) =>
          w.includes("DB_ENCRYPTION_KEY not set"),
        ),
      ).toBe(true);
    });

    it("should warn about missing salt", () => {
      process.env.DB_ENCRYPTION_KEY = "proper-secure-key-32-chars-long";
      delete process.env.DB_ENCRYPTION_SALT;

      const validation = validateEncryptionConfig();

      expect(validation.isValid).toBe(false);
      expect(
        validation.warnings.some((w) =>
          w.includes("DB_ENCRYPTION_SALT not set"),
        ),
      ).toBe(true);
    });

    it("should warn about default values", () => {
      process.env.DB_ENCRYPTION_KEY = "default-key-change-in-production";
      process.env.DB_ENCRYPTION_SALT = "default-salt-change-in-production";

      const validation = validateEncryptionConfig();

      expect(validation.isValid).toBe(false);
      expect(
        validation.warnings.some((w) => w.includes("default encryption key")),
      ).toBe(true);
    });
  });

  describe("Encryption Security", () => {
    it("should use AES-256-GCM with proper key length", () => {
      const plaintext = "test-data";
      const encrypted = encryptField(plaintext);
      const parsed = JSON.parse(encrypted);

      // Check structure
      expect(parsed).toHaveProperty("iv");
      expect(parsed).toHaveProperty("data");
      expect(parsed).toHaveProperty("tag");

      // IV should be 16 bytes (32 hex chars)
      expect(parsed.iv).toMatch(/^[a-f0-9]{32}$/);

      // Tag should be 16 bytes (32 hex chars)
      expect(parsed.tag).toMatch(/^[a-f0-9]{32}$/);
    });

    it("should fail decryption with wrong key", () => {
      const plaintext = "secret-data";

      // Encrypt with one key
      process.env.DB_ENCRYPTION_KEY = "first-key-32-chars-long";
      const encrypted = encryptField(plaintext);

      // Try to decrypt with different key
      process.env.DB_ENCRYPTION_KEY = "different-key-32-chars-long";

      expect(() => {
        decryptField(encrypted);
      }).toThrow("Failed to decrypt field data");
    });
  });
});
