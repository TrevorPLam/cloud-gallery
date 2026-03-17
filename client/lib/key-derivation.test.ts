// Comprehensive test suite for zero-knowledge key management system.
// Tests Argon2id derivation, hierarchical keys, secure storage, and biometrics.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  deriveKeyWithContext,
  deriveMasterKey,
  deriveSpecializedKey,
  generateDerivationSalt,
  checkBiometricAvailability,
  authenticateWithBiometrics,
  storeMasterKey,
  retrieveMasterKey,
  clearAllKeys,
  createAndStoreMasterKey,
  verifyMasterKey,
  isValidKey,
  KeyType,
  ARGON2ID_CONFIG,
  MASTER_KEY_SALT,
  FILE_KEY_CONTEXT,
} from "./key-derivation";
import {
  KeyHierarchy,
  keyHierarchy,
  getFileEncryptionKey,
} from "./key-hierarchy";
import { BiometricAuthManager, biometricAuth } from "./biometric-auth";

// Mock expo modules
vi.mock("expo-secure-store", () => ({
  default: {
    getItemAsync: vi.fn(),
    setItemAsync: vi.fn(),
    deleteItemAsync: vi.fn(),
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "when_unlocked_this_device_only",
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "after_first_unlock_this_device_only",
    WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: "when_passcode_set_this_device_only",
  },
}));

vi.mock("expo-local-authentication", () => ({
  default: {
    hasHardwareAsync: vi.fn(),
    isEnrolledAsync: vi.fn(),
    supportedAuthenticationTypesAsync: vi.fn(),
    authenticateAsync: vi.fn(),
    AuthenticationType: {
      FINGERPRINT: 1,
      FACIAL_RECOGNITION: 2,
      IRIS: 3,
    },
  },
}));

vi.mock("@s77rt/react-native-sodium", () => ({
  default: {
    sodium_init: vi.fn(() => 0),
    randombytes_buf: vi.fn(),
    crypto_aead_xchacha20poly1305_ietf_encrypt: vi.fn(() => 0),
    crypto_aead_xchacha20poly1305_ietf_decrypt: vi.fn(() => 0),
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
  subtle: {
    timingSafeEqual: vi.fn((a, b) => {
      return Buffer.from(a).equals(Buffer.from(b));
    }),
  },
};

// Setup global crypto mock
Object.defineProperty(global, "crypto", {
  value: mockCrypto,
  writable: true,
});

describe("Key Derivation", () => {
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
      const key = await deriveKeyWithContext(
        testPassword,
        testSalt,
        testContext,
      );
      expect(key).toMatch(/^[0-9a-fA-F]{64}$/); // 32 bytes = 64 hex chars
    });

    it("should derive different keys for different contexts", async () => {
      const key1 = await deriveKeyWithContext(
        testPassword,
        testSalt,
        "context1",
      );
      const key2 = await deriveKeyWithContext(
        testPassword,
        testSalt,
        "context2",
      );
      expect(key1).not.toBe(key2);
    });

    it("should derive same key for same inputs", async () => {
      const key1 = await deriveKeyWithContext(
        testPassword,
        testSalt,
        testContext,
      );
      const key2 = await deriveKeyWithContext(
        testPassword,
        testSalt,
        testContext,
      );
      expect(key1).toBe(key2);
    });

    it("should validate salt length", async () => {
      await expect(
        deriveKeyWithContext(testPassword, "short", testContext),
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
    const masterKey =
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    it("should derive file key", async () => {
      const result = await deriveSpecializedKey(
        masterKey,
        KeyType.FILE,
        "file123",
      );

      expect(result.key).toMatch(/^[0-9a-fA-F]{64}$/);
      expect(result.context).toBe(`${FILE_KEY_CONTEXT}:file123`);
    });

    it("should derive sharing key", async () => {
      const result = await deriveSpecializedKey(
        masterKey,
        KeyType.SHARING,
        "share123",
      );

      expect(result.key).toMatch(/^[0-9a-fA-F]{64}$/);
      expect(result.context).toContain("sharing");
    });

    it("should derive device key", async () => {
      const result = await deriveSpecializedKey(
        masterKey,
        KeyType.DEVICE,
        "device123",
      );

      expect(result.key).toMatch(/^[0-9a-fA-F]{64}$/);
      expect(result.context).toContain("device");
    });

    it("should derive different keys for same master key", async () => {
      const fileKey = await deriveSpecializedKey(
        masterKey,
        KeyType.FILE,
        "file123",
      );
      const sharingKey = await deriveSpecializedKey(
        masterKey,
        KeyType.SHARING,
        "share123",
      );
      expect(fileKey.key).not.toBe(sharingKey.key);
    });

    it("should validate master key format", async () => {
      await expect(
        deriveSpecializedKey("invalid-key", KeyType.FILE),
      ).rejects.toThrow("Invalid master key format");
    });
  });

  describe("isValidKey", () => {
    it("should validate correct key format", () => {
      const validKey =
        "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      expect(isValidKey(validKey)).toBe(true);
    });

    it("should reject invalid key length", () => {
      const shortKey = "abcdef1234567890";
      expect(isValidKey(shortKey)).toBe(false);
    });

    it("should reject non-hex characters", () => {
      const invalidKey =
        "ghijklmnopqrstuvwxyz1234567890abcdef1234567890abcdef1234567890";
      expect(isValidKey(invalidKey)).toBe(false);
    });
  });
});

describe("Key Hierarchy", () => {
  const mockMasterKey =
    "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

  beforeEach(() => {
    vi.clearAllMocks();
    keyHierarchy.clearCache();
  });

  describe("getFileKey", () => {
    it("should derive and cache file key", async () => {
      // Mock master key retrieval
      vi.spyOn(keyHierarchy, "getMasterKey").mockResolvedValue(mockMasterKey);

      const key1 = await keyHierarchy.getFileKey("file123");
      const key2 = await keyHierarchy.getFileKey("file123"); // Should use cache

      expect(key1).toMatch(/^[0-9a-fA-F]{64}$/);
      expect(key1).toBe(key2); // Should be same from cache
      expect(keyHierarchy.getMasterKey).toHaveBeenCalledTimes(1);
    });

    it("should derive different keys for different files", async () => {
      vi.spyOn(keyHierarchy, "getMasterKey").mockResolvedValue(mockMasterKey);

      const key1 = await keyHierarchy.getFileKey("file1");
      const key2 = await keyHierarchy.getFileKey("file2");

      expect(key1).not.toBe(key2);
    });

    it("should throw error when master key unavailable", async () => {
      vi.spyOn(keyHierarchy, "getMasterKey").mockResolvedValue(null);

      await expect(keyHierarchy.getFileKey("file123")).rejects.toThrow(
        "Master key required for file key derivation",
      );
    });
  });

  describe("getSharingKey", () => {
    it("should derive and cache sharing key", async () => {
      vi.spyOn(keyHierarchy, "getMasterKey").mockResolvedValue(mockMasterKey);

      const key1 = await keyHierarchy.getSharingKey("share123");
      const key2 = await keyHierarchy.getSharingKey("share123");

      expect(key1).toMatch(/^[0-9a-fA-F]{64}$/);
      expect(key1).toBe(key2);
    });
  });

  describe("getDeviceKey", () => {
    it("should derive and cache device key", async () => {
      vi.spyOn(keyHierarchy, "getMasterKey").mockResolvedValue(mockMasterKey);

      const key1 = await keyHierarchy.getDeviceKey("device123");
      const key2 = await keyHierarchy.getDeviceKey("device123");

      expect(key1).toMatch(/^[0-9a-fA-F]{64}$/);
      expect(key1).toBe(key2);
    });
  });

  describe("cache management", () => {
    it("should track cache statistics", async () => {
      vi.spyOn(keyHierarchy, "getMasterKey").mockResolvedValue(mockMasterKey);

      await keyHierarchy.getFileKey("file1");
      await keyHierarchy.getSharingKey("share1");
      await keyHierarchy.getDeviceKey("device1");

      const stats = keyHierarchy.getCacheStats();
      expect(stats.fileKeysCount).toBe(1);
      expect(stats.sharingKeysCount).toBe(1);
      expect(stats.deviceKeysCount).toBe(1);
    });

    it("should invalidate specific keys", async () => {
      vi.spyOn(keyHierarchy, "getMasterKey").mockResolvedValue(mockMasterKey);

      const key1 = await keyHierarchy.getFileKey("file1");
      keyHierarchy.invalidateKey(KeyType.FILE, "file1");

      const key2 = await keyHierarchy.getFileKey("file1");

      expect(key1).not.toBe(key2); // Should be re-derived
    });
  });
});

describe("Biometric Authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    biometricAuth.resetAttempts();
  });

  describe("BiometricAuthManager", () => {
    it("should get enrollment status", async () => {
      const mockLocalAuth = await import("expo-local-authentication");
      vi.mocked(mockLocalAuth.default.hasHardwareAsync).mockResolvedValue(true);
      vi.mocked(mockLocalAuth.default.isEnrolledAsync).mockResolvedValue(true);
      vi.mocked(
        mockLocalAuth.default.supportedAuthenticationTypesAsync,
      ).mockResolvedValue([
        mockLocalAuth.default.AuthenticationType.FACIAL_RECOGNITION,
      ]);

      const status = await biometricAuth.getEnrollmentStatus();

      expect(status.hasHardware).toBe(true);
      expect(status.isEnrolled).toBe(true);
      expect(status.supportedTypes).toContain("Face ID");
    });

    it("should authenticate successfully", async () => {
      const mockLocalAuth = await import("expo-local-authentication");
      vi.mocked(mockLocalAuth.default.hasHardwareAsync).mockResolvedValue(true);
      vi.mocked(mockLocalAuth.default.isEnrolledAsync).mockResolvedValue(true);
      vi.mocked(mockLocalAuth.default.authenticateAsync).mockResolvedValue({
        success: true,
      });

      const result = await biometricAuth.authenticate();

      expect(result.success).toBe(true);
      expect(result.authenticated).toBe(true);
    });

    it("should handle authentication failure", async () => {
      const mockLocalAuth = await import("expo-local-authentication");
      vi.mocked(mockLocalAuth.default.hasHardwareAsync).mockResolvedValue(true);
      vi.mocked(mockLocalAuth.default.isEnrolledAsync).mockResolvedValue(true);
      vi.mocked(mockLocalAuth.default.authenticateAsync).mockResolvedValue({
        success: false,
        error: "Authentication failed",
      });

      const result = await biometricAuth.authenticate();

      expect(result.success).toBe(false);
      expect(result.authenticated).toBe(false);
      expect(result.error).toBe("Authentication failed");
    });

    it("should enforce rate limiting", async () => {
      const mockLocalAuth = await import("expo-local-authentication");
      vi.mocked(mockLocalAuth.default.hasHardwareAsync).mockResolvedValue(true);
      vi.mocked(mockLocalAuth.default.isEnrolledAsync).mockResolvedValue(true);
      vi.mocked(mockLocalAuth.default.authenticateAsync).mockResolvedValue({
        success: false,
        error: "Authentication failed",
      });

      // Fail authentication multiple times
      for (let i = 0; i < 3; i++) {
        await biometricAuth.authenticate();
      }

      // Should be rate limited
      const result = await biometricAuth.authenticate();
      expect(result.errorCode).toBe("RATE_LIMITED");
    });
  });

  describe("convenience functions", () => {
    it("should perform quick biometric auth", async () => {
      const mockLocalAuth = await import("expo-local-authentication");
      vi.mocked(mockLocalAuth.default.hasHardwareAsync).mockResolvedValue(true);
      vi.mocked(mockLocalAuth.default.isEnrolledAsync).mockResolvedValue(true);
      vi.mocked(mockLocalAuth.default.authenticateAsync).mockResolvedValue({
        success: true,
      });

      const { quickBiometricAuth } = await import("./biometric-auth");
      const result = await quickBiometricAuth("Test authentication");

      expect(result.success).toBe(true);
    });

    it("should check biometric support", async () => {
      const mockLocalAuth = await import("expo-local-authentication");
      vi.mocked(mockLocalAuth.default.hasHardwareAsync).mockResolvedValue(true);
      vi.mocked(mockLocalAuth.default.isEnrolledAsync).mockResolvedValue(true);
      vi.mocked(
        mockLocalAuth.default.supportedAuthenticationTypesAsync,
      ).mockResolvedValue([
        mockLocalAuth.default.AuthenticationType.FINGERPRINT,
      ]);

      const { checkBiometricSupport } = await import("./biometric-auth");
      const support = await checkBiometricSupport();

      expect(support.available).toBe(true);
      expect(support.enrolled).toBe(true);
      expect(support.types).toContain("Fingerprint");
    });
  });
});

describe("Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    keyHierarchy.clearCache();
  });

  describe("end-to-end key flow", () => {
    it("should create master key and derive specialized keys", async () => {
      const mockSecureStore = await import("expo-secure-store");
      vi.mocked(mockSecureStore.default.setItemAsync).mockResolvedValue();
      vi.mocked(mockSecureStore.default.getItemAsync).mockResolvedValue(null);

      // Create master key
      const masterKey = await createAndStoreMasterKey("test-password-123");
      expect(masterKey).toMatch(/^[0-9a-fA-F]{64}$/);

      // Mock retrieval for subsequent operations
      vi.mocked(mockSecureStore.default.getItemAsync).mockResolvedValue(
        masterKey,
      );

      // Derive specialized keys
      const fileKey = await getFileEncryptionKey("file123");
      const sharingKey = await keyHierarchy.getSharingKey("share123");
      const deviceKey = await keyHierarchy.getDeviceKey("device123");

      expect(fileKey).toMatch(/^[0-9a-fA-F]{64}$/);
      expect(sharingKey).toMatch(/^[0-9a-fA-F]{64}$/);
      expect(deviceKey).toMatch(/^[0-9a-fA-F]{64}$/);

      // All keys should be different
      expect(fileKey).not.toBe(sharingKey);
      expect(sharingKey).not.toBe(deviceKey);
      expect(deviceKey).not.toBe(masterKey);
    });

    it("should verify master key with correct password", async () => {
      const mockSecureStore = await import("expo-secure-store");
      vi.mocked(mockSecureStore.default.setItemAsync).mockResolvedValue();

      const password = "test-password-123";
      const masterKey = await createAndStoreMasterKey(password);

      vi.mocked(mockSecureStore.default.getItemAsync)
        .mockResolvedValueOnce("test-salt") // salt
        .mockResolvedValueOnce(masterKey); // key

      const isValid = await verifyMasterKey(password);
      expect(isValid).toBe(true);
    });

    it("should reject master key with incorrect password", async () => {
      const mockSecureStore = await import("expo-secure-store");
      vi.mocked(mockSecureStore.default.setItemAsync).mockResolvedValue();

      const masterKey = await createAndStoreMasterKey("correct-password");

      vi.mocked(mockSecureStore.default.getItemAsync)
        .mockResolvedValueOnce("test-salt") // salt
        .mockResolvedValueOnce(masterKey); // key

      const isValid = await verifyMasterKey("wrong-password");
      expect(isValid).toBe(false);
    });
  });

  describe("biometric-protected key access", () => {
    it("should authenticate with biometrics for key access", async () => {
      const mockSecureStore = await import("expo-secure-store");
      const mockLocalAuth = await import("expo-local-authentication");

      vi.mocked(mockSecureStore.default.getItemAsync).mockResolvedValue(
        "mock-master-key",
      );
      vi.mocked(mockLocalAuth.default.hasHardwareAsync).mockResolvedValue(true);
      vi.mocked(mockLocalAuth.default.isEnrolledAsync).mockResolvedValue(true);
      vi.mocked(mockLocalAuth.default.authenticateAsync).mockResolvedValue({
        success: true,
      });

      const key = await retrieveMasterKey(true);
      expect(key).toBe("mock-master-key");
    });

    it("should fallback to password when biometrics fail", async () => {
      const mockSecureStore = await import("expo-secure-store");
      const mockLocalAuth = await import("expo-local-authentication");

      vi.mocked(mockSecureStore.default.getItemAsync)
        .mockResolvedValueOnce("false") // biometric enrollment
        .mockResolvedValueOnce("mock-master-key"); // actual key
      vi.mocked(mockLocalAuth.default.hasHardwareAsync).mockResolvedValue(true);
      vi.mocked(mockLocalAuth.default.isEnrolledAsync).mockResolvedValue(true);
      vi.mocked(mockLocalAuth.default.authenticateAsync).mockResolvedValue({
        success: false,
        error: "Biometric failed",
      });

      const key = await retrieveMasterKey(false); // Don't require biometrics
      expect(key).toBe("mock-master-key");
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
    const masterKey =
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    const fileKey1 = await deriveSpecializedKey(
      masterKey,
      KeyType.FILE,
      "file1",
    );
    const fileKey2 = await deriveSpecializedKey(
      masterKey,
      KeyType.FILE,
      "file2",
    );
    const sharingKey = await deriveSpecializedKey(
      masterKey,
      KeyType.SHARING,
      "file1",
    );

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
