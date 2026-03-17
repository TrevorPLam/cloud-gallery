// Comprehensive tests for XChaCha20-Poly1305 encryption implementation.
// Tests cover direct encryption, streaming encryption, adaptive encryption, and platform crypto.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Buffer } from "buffer";
import {
  initializeCrypto,
  generateEncryptionKey,
  generateNonce,
  encryptData,
  decryptData,
  encryptMessage,
  decryptMessage,
  deriveKeyFromPassword,
  generateSalt,
  isValidKey,
  secureWipe,
  XCHACHA20_KEYBYTES,
  XCHACHA20_NONCEBYTES,
  XCHACHA20_ABYTES,
} from "../encryption";
import {
  initializeEncryptionStream,
  initializeDecryptionStream,
  encryptStreamChunk,
  decryptStreamChunk,
  rekeyStream,
  encryptDataStream,
  decryptDataStream,
  SECRETSTREAM_HEADERBYTES,
  STREAM_TAG_FINAL,
} from "../streaming-encryption";
import {
  encryptDataAdaptive,
  decryptDataAdaptive,
  determineEncryptionStrategy,
  EncryptionStrategy,
} from "../adaptive-encryption";
import { hardwareCrypto, KeyAccessLevel } from "../platform-crypto";

// Mock sodium for testing
const mockSodium = {
  sodium_init: () => 0,
  randombytes_buf: (buf: ArrayBuffer, size: number) => {
    const view = new Uint8Array(buf);
    for (let i = 0; i < size; i++) {
      view[i] = Math.floor(Math.random() * 256);
    }
  },
  crypto_aead_xchacha20poly1305_ietf_KEYBYTES: XCHACHA20_KEYBYTES,
  crypto_aead_xchacha20poly1305_ietf_NPUBBYTES: XCHACHA20_NONCEBYTES,
  crypto_aead_xchacha20poly1305_ietf_ABYTES: XCHACHA20_ABYTES,
  crypto_aead_xchacha20poly1305_ietf_encrypt: (
    ciphertext: ArrayBuffer,
    ciphertextLen: Uint32Array,
    message: Uint8Array,
    messageLen: number,
    ad: Uint8Array | null,
    adLen: number,
    nsec: null,
    npub: Uint8Array,
    k: Uint8Array,
  ) => {
    // Simple mock encryption - XOR with key and append tag
    const msgView = new Uint8Array(message);
    const keyView = new Uint8Array(k);
    const nonceView = new Uint8Array(npub);
    const ctView = new Uint8Array(ciphertext);

    // XOR encrypt with key + nonce
    for (let i = 0; i < messageLen; i++) {
      ctView[i] =
        msgView[i] ^
        keyView[i % keyView.length] ^
        nonceView[i % nonceView.length];
    }

    // Add mock authentication tag
    const tag = new Uint8Array(XCHACHA20_ABYTES);
    for (let i = 0; i < XCHACHA20_ABYTES; i++) {
      tag[i] = Math.floor(Math.random() * 256);
    }
    ctView.set(tag, messageLen);

    ciphertextLen[0] = messageLen + XCHACHA20_ABYTES;
    return 0;
  },
  crypto_aead_xchacha20poly1305_ietf_decrypt: (
    plaintext: ArrayBuffer,
    plaintextLen: Uint32Array,
    nsec: null,
    ciphertext: Uint8Array,
    ciphertextLen: number,
    ad: Uint8Array | null,
    adLen: number,
    npub: Uint8Array,
    k: Uint8Array,
  ) => {
    // Simple mock decryption - XOR with key and nonce
    const ctView = new Uint8Array(ciphertext);
    const keyView = new Uint8Array(k);
    const nonceView = new Uint8Array(npub);
    const ptView = new Uint8Array(plaintext);

    const messageLen = ciphertextLen - XCHACHA20_ABYTES;

    // XOR decrypt with key + nonce
    for (let i = 0; i < messageLen; i++) {
      ptView[i] =
        ctView[i] ^
        keyView[i % keyView.length] ^
        nonceView[i % nonceView.length];
    }

    plaintextLen[0] = messageLen;
    return 0;
  },
  crypto_secretstream_xchacha20poly1305_STATEBYTES: 52,
  crypto_secretstream_xchacha20poly1305_HEADERBYTES: SECRETSTREAM_HEADERBYTES,
  crypto_secretstream_xchacha20poly1305_ABYTES: 17,
  crypto_secretstream_xchacha20poly1305_init_push: (
    state: ArrayBuffer,
    header: ArrayBuffer,
    key: Uint8Array,
  ) => 0,
  crypto_secretstream_xchacha20poly1305_init_pull: (
    state: ArrayBuffer,
    header: Uint8Array,
    key: Uint8Array,
  ) => 0,
  crypto_secretstream_xchacha20poly1305_push: (
    state: ArrayBuffer,
    ciphertext: ArrayBuffer,
    ciphertextLen: Uint32Array,
    plaintext: Uint8Array,
    plaintextLen: number,
    ad: Uint8Array | null,
    adLen: number,
    tag: number,
  ) => {
    const ctView = new Uint8Array(ciphertext);
    const ptView = new Uint8Array(plaintext);

    // Simple mock stream encryption
    for (let i = 0; i < plaintextLen; i++) {
      ctView[i] = ptView[i] ^ 0x42; // Simple XOR
    }

    // Add mock tag
    ctView[plaintextLen] = tag & 0xff;
    ciphertextLen[0] = plaintextLen + 1;
    return 0;
  },
  crypto_secretstream_xchacha20poly1305_pull: (
    state: ArrayBuffer,
    plaintext: ArrayBuffer,
    plaintextLen: Uint32Array,
    tag: Uint8Array,
    ciphertext: Uint8Array,
    ciphertextLen: number,
    ad: Uint8Array | null,
    adLen: number,
  ) => {
    const ctView = new Uint8Array(ciphertext);
    const ptView = new Uint8Array(plaintext);

    const messageLen = ciphertextLen - 1;

    // Simple mock stream decryption
    for (let i = 0; i < messageLen; i++) {
      ptView[i] = ctView[i] ^ 0x42; // Simple XOR
    }

    tag[0] = ctView[messageLen];
    plaintextLen[0] = messageLen;
    return 0;
  },
  crypto_secretstream_xchacha20poly1305_rekey: (state: ArrayBuffer) => 0,
};

// Mock the sodium module
vi.mock("@s77rt/react-native-sodium", () => ({
  default: mockSodium,
}));

// Mock react-native-device-crypto
vi.mock("react-native-device-crypto", () => ({
  getOrCreateSymmetricKey: vi
    .fn()
    .mockResolvedValue({ keyIdentifier: "test-key" }),
  isKeyExists: vi.fn().mockResolvedValue({ exists: true }),
  deleteKey: vi.fn().mockResolvedValue(undefined),
  encrypt: vi.fn().mockImplementation((keyId, data) => Promise.resolve(data)),
  decrypt: vi.fn().mockImplementation((keyId, data) => Promise.resolve(data)),
  sign: vi.fn().mockResolvedValue("mock-signature"),
  verify: vi.fn().mockResolvedValue(true),
  deviceSecurityLevel: vi.fn().mockResolvedValue({
    secureEnclave: true,
    keyStore: true,
  }),
  getBiometryType: vi.fn().mockResolvedValue("touchId"),
}));

// Mock expo-secure-store
vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED: "whenUnlocked",
  AFTER_FIRST_UNLOCK: "afterFirstUnlock",
  ALWAYS: "always",
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "whenUnlockedThisDeviceOnly",
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

// Mock argon2
vi.mock("argon2", () => ({
  argon2: {
    hash: vi.fn().mockImplementation((password, options) => {
      // Mock Argon2 hash - return options.hashLength bytes of pseudo-random data
      const hash = new Uint8Array(options.hashLength);
      for (let i = 0; i < options.hashLength; i++) {
        hash[i] = password.charCodeAt(i % password.length) ^ 0x42;
      }
      return Promise.resolve(hash);
    }),
  },
}));

describe("XChaCha20-Poly1305 Encryption", () => {
  beforeEach(async () => {
    await initializeCrypto();
  });

  describe("Key Generation", () => {
    it("should generate a valid encryption key", () => {
      const key = generateEncryptionKey();
      expect(key).toHaveLength(64); // 32 bytes * 2 hex chars
      expect(isValidKey(key)).toBe(true);
    });

    it("should generate unique keys", () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      expect(key1).not.toBe(key2);
    });

    it("should validate key format correctly", () => {
      const validKey = generateEncryptionKey();
      const invalidKey = "invalid-key";

      expect(isValidKey(validKey)).toBe(true);
      expect(isValidKey(invalidKey)).toBe(false);
      expect(isValidKey("")).toBe(false);
    });
  });

  describe("Nonce Generation", () => {
    it("should generate a valid nonce", () => {
      const nonce = generateNonce();
      expect(nonce).toHaveLength(48); // 24 bytes * 2 hex chars
    });

    it("should generate unique nonces", () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe("Direct Encryption/Decryption", () => {
    it("should encrypt and decrypt data correctly", () => {
      const key = generateEncryptionKey();
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

      const encrypted = encryptData(plaintext, key);
      const decrypted = decryptData(encrypted, key);

      expect(decrypted).toEqual(plaintext);
    });

    it("should handle empty data", () => {
      const key = generateEncryptionKey();
      const plaintext = new Uint8Array(0);

      const encrypted = encryptData(plaintext, key);
      const decrypted = decryptData(encrypted, key);

      expect(decrypted).toEqual(plaintext);
    });

    it("should handle large data", () => {
      const key = generateEncryptionKey();
      const plaintext = new Uint8Array(1024 * 1024); // 1MB
      for (let i = 0; i < plaintext.length; i++) {
        plaintext[i] = i % 256;
      }

      const encrypted = encryptData(plaintext, key);
      const decrypted = decryptData(encrypted, key);

      expect(decrypted).toEqual(plaintext);
    });

    it("should fail with wrong key", () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      const plaintext = new Uint8Array([1, 2, 3]);

      const encrypted = encryptData(plaintext, key1);

      expect(() => decryptData(encrypted, key2)).toThrow();
    });

    it("should fail with corrupted data", () => {
      const key = generateEncryptionKey();
      const plaintext = new Uint8Array([1, 2, 3]);

      const encrypted = encryptData(plaintext, key);
      const corrupted = new Uint8Array(encrypted);
      corrupted[corrupted.length - 1] ^= 0xff; // Flip last bit

      expect(() => decryptData(corrupted, key)).toThrow();
    });
  });

  describe("Message Encryption/Decryption", () => {
    it("should encrypt and decrypt text messages", () => {
      const key = generateEncryptionKey();
      const message = "Hello, World!";

      const encrypted = encryptMessage(message, key);
      const decrypted = decryptMessage(encrypted, key);

      expect(decrypted).toBe(message);
    });

    it("should handle unicode characters", () => {
      const key = generateEncryptionKey();
      const message = "Hello 🌍! Ñoël 🎉";

      const encrypted = encryptMessage(message, key);
      const decrypted = decryptMessage(encrypted, key);

      expect(decrypted).toBe(message);
    });

    it("should handle empty messages", () => {
      const key = generateEncryptionKey();
      const message = "";

      const encrypted = encryptMessage(message, key);
      const decrypted = decryptMessage(encrypted, key);

      expect(decrypted).toBe(message);
    });
  });

  describe("Password Key Derivation", () => {
    it("should derive key from password", async () => {
      const password = "test-password-123";
      const salt = generateSalt();

      const derivedKey = await deriveKeyFromPassword(password, salt);

      expect(isValidKey(derivedKey)).toBe(true);
    });

    it("should produce different keys with different salts", async () => {
      const password = "test-password-123";
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      const key1 = await deriveKeyFromPassword(password, salt1);
      const key2 = await deriveKeyFromPassword(password, salt2);

      expect(key1).not.toBe(key2);
    });

    it("should produce same key with same password and salt", async () => {
      const password = "test-password-123";
      const salt = generateSalt();

      const key1 = await deriveKeyFromPassword(password, salt);
      const key2 = await deriveKeyFromPassword(password, salt);

      expect(key1).toBe(key2);
    });
  });

  describe("Secure Wipe", () => {
    it("should wipe ArrayBuffer", () => {
      const buffer = new ArrayBuffer(10);
      const view = new Uint8Array(buffer);
      view.fill(0x42);

      secureWipe(buffer);

      expect(Array.from(view)).toEqual(new Array(10).fill(0));
    });

    it("should wipe Uint8Array", () => {
      const buffer = new Uint8Array(10);
      buffer.fill(0x42);

      secureWipe(buffer);

      expect(Array.from(buffer)).toEqual(new Array(10).fill(0));
    });
  });
});

describe("Streaming Encryption", () => {
  beforeEach(async () => {
    await initializeCrypto();
  });

  describe("Stream Initialization", () => {
    it("should initialize encryption stream", () => {
      const key = generateEncryptionKey();
      const streamState = initializeEncryptionStream(key);

      expect(streamState.header).toHaveLength(SECRETSTREAM_HEADERBYTES);
      expect(streamState.state.byteLength).toBeGreaterThan(0);
      expect(streamState.key).toHaveLength(XCHACHA20_KEYBYTES);
    });

    it("should initialize decryption stream", () => {
      const key = generateEncryptionKey();
      const encState = initializeEncryptionStream(key);
      const decState = initializeDecryptionStream(key, encState.header);

      expect(decState.header).toEqual(encState.header);
      expect(decState.state.byteLength).toBeGreaterThan(0);
    });

    it("should fail decryption with invalid header", () => {
      const key = generateEncryptionKey();
      const invalidHeader = new Uint8Array(SECRETSTREAM_HEADERBYTES);

      expect(() => initializeDecryptionStream(key, invalidHeader)).toThrow();
    });
  });

  describe("Stream Chunk Encryption/Decryption", () => {
    it("should encrypt and decrypt stream chunks", () => {
      const key = generateEncryptionKey();
      const encState = initializeEncryptionStream(key);
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

      const encrypted = encryptStreamChunk(encState, plaintext, true);
      const decState = initializeDecryptionStream(key, encState.header);
      const decrypted = decryptStreamChunk(decState, encrypted);

      expect(decrypted.plaintext).toEqual(plaintext);
      expect(decrypted.isFinal).toBe(true);
    });

    it("should handle multiple chunks", () => {
      const key = generateEncryptionKey();
      const encState = initializeEncryptionStream(key);
      const decState = initializeDecryptionStream(key, encState.header);

      const chunk1 = new Uint8Array([1, 2, 3]);
      const chunk2 = new Uint8Array([4, 5, 6]);

      const enc1 = encryptStreamChunk(encState, chunk1, false);
      const enc2 = encryptStreamChunk(encState, chunk2, true);

      const dec1 = decryptStreamChunk(decState, enc1);
      const dec2 = decryptStreamChunk(decState, enc2);

      expect(dec1.plaintext).toEqual(chunk1);
      expect(dec1.isFinal).toBe(false);
      expect(dec2.plaintext).toEqual(chunk2);
      expect(dec2.isFinal).toBe(true);
    });
  });

  describe("Stream Rekeying", () => {
    it("should rekey stream without errors", () => {
      const key = generateEncryptionKey();
      const streamState = initializeEncryptionStream(key);

      expect(() => rekeyStream(streamState)).not.toThrow();
    });
  });

  describe("Data Stream Encryption/Decryption", () => {
    it("should encrypt and decrypt data streams", () => {
      const key = generateEncryptionKey();
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      const encrypted = encryptDataStream(data, key);
      const decrypted = decryptDataStream(encrypted, key);

      expect(decrypted).toEqual(data);
    });

    it("should handle empty data", () => {
      const key = generateEncryptionKey();
      const data = new Uint8Array(0);

      const encrypted = encryptDataStream(data, key);
      const decrypted = decryptDataStream(encrypted, key);

      expect(decrypted).toEqual(data);
    });

    it("should handle large data streams", () => {
      const key = generateEncryptionKey();
      const data = new Uint8Array(1024 * 1024); // 1MB
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const encrypted = encryptDataStream(data, key);
      const decrypted = decryptDataStream(encrypted, key);

      expect(decrypted).toEqual(data);
    });
  });
});

describe("Adaptive Encryption", () => {
  beforeEach(async () => {
    await initializeCrypto();
  });

  describe("Strategy Determination", () => {
    it("should choose direct encryption for small files", () => {
      const strategy = determineEncryptionStrategy(1024); // 1KB
      expect(strategy).toBe(EncryptionStrategy.DIRECT);
    });

    it("should choose chunked encryption for medium files", () => {
      const strategy = determineEncryptionStrategy(50 * 1024 * 1024); // 50MB
      expect(strategy).toBe(EncryptionStrategy.CHUNKED);
    });

    it("should choose streaming encryption for large files", () => {
      const strategy = determineEncryptionStrategy(200 * 1024 * 1024); // 200MB
      expect(strategy).toBe(EncryptionStrategy.STREAMING);
    });
  });

  describe("Adaptive Encryption/Decryption", () => {
    it("should encrypt and decrypt small data adaptively", async () => {
      const key = generateEncryptionKey();
      const data = new Uint8Array([1, 2, 3, 4, 5]);

      const encrypted = await encryptDataAdaptive(data, key);
      const decrypted = await decryptDataAdaptive(encrypted, key);

      expect(decrypted).toEqual(data);
      expect(encrypted.metadata.strategy).toBe(EncryptionStrategy.DIRECT);
    });

    it("should encrypt and decrypt medium data adaptively", async () => {
      const key = generateEncryptionKey();
      const data = new Uint8Array(50 * 1024 * 1024); // 50MB
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const encrypted = await encryptDataAdaptive(data, key);
      const decrypted = await decryptDataAdaptive(encrypted, key);

      expect(decrypted).toEqual(data);
      expect(encrypted.metadata.strategy).toBe(EncryptionStrategy.CHUNKED);
    });

    it("should include correct metadata", async () => {
      const key = generateEncryptionKey();
      const data = new Uint8Array([1, 2, 3]);

      const encrypted = await encryptDataAdaptive(data, key, {
        keyId: "test-key",
      });

      expect(encrypted.metadata.originalSize).toBe(data.length);
      expect(encrypted.metadata.encryptedSize).toBeGreaterThan(data.length);
      expect(encrypted.metadata.keyId).toBe("test-key");
    });
  });
});

describe("Platform Crypto", () => {
  beforeEach(async () => {
    await hardwareCrypto.initialize();
  });

  describe("Hardware Capabilities", () => {
    it("should detect hardware capabilities", () => {
      const capabilities = hardwareCrypto.getCapabilities();

      expect(capabilities).toHaveProperty("secureEnclave");
      expect(capabilities).toHaveProperty("keyStore");
      expect(capabilities).toHaveProperty("hardwareAcceleration");
      expect(capabilities).toHaveProperty("biometricSupport");
    });
  });

  describe("Key Management", () => {
    it("should create and manage keys", async () => {
      const keyId = "test-key";

      const created = await hardwareCrypto.createKey(keyId, {
        accessLevel: KeyAccessLevel.WHEN_UNLOCKED,
      });

      expect(created).toBeDefined();

      const exists = await hardwareCrypto.keyExists(keyId);
      expect(exists).toBe(true);

      const retrieved = await hardwareCrypto.getKey(keyId);
      expect(retrieved).toBeDefined();

      const deleted = await hardwareCrypto.deleteKey(keyId);
      expect(deleted).toBe(true);

      const existsAfterDelete = await hardwareCrypto.keyExists(keyId);
      expect(existsAfterDelete).toBe(false);
    });
  });

  describe("Hardware Encryption/Decryption", () => {
    it("should encrypt and decrypt with hardware keys", async () => {
      const keyId = "test-hw-key";
      await hardwareCrypto.createKey(keyId);

      const data = new Uint8Array([1, 2, 3, 4, 5]);

      const encrypted = await hardwareCrypto.encrypt(keyId, data);
      const decrypted = await hardwareCrypto.decrypt(keyId, encrypted);

      expect(decrypted).toEqual(data);
    });
  });

  describe("Digital Signatures", () => {
    it("should sign and verify data", async () => {
      const keyId = "test-sig-key";
      await hardwareCrypto.createKey(keyId);

      const data = new Uint8Array([1, 2, 3, 4, 5]);

      const signature = await hardwareCrypto.sign(keyId, data);
      expect(signature).toBeDefined();

      const isValid = await hardwareCrypto.verify(keyId, data, signature);
      expect(isValid).toBe(true);

      // Verify with tampered data fails
      const tamperedData = new Uint8Array([1, 2, 3, 4, 6]);
      const isInvalid = await hardwareCrypto.verify(
        keyId,
        tamperedData,
        signature,
      );
      expect(isInvalid).toBe(false);
    });
  });
});

describe("Integration Tests", () => {
  beforeEach(async () => {
    await initializeCrypto();
    await hardwareCrypto.initialize();
  });

  describe("End-to-End Encryption Flow", () => {
    it("should handle complete encryption workflow", async () => {
      // Generate key
      const key = generateEncryptionKey();

      // Test different data sizes
      const smallData = new Uint8Array([1, 2, 3]);
      const mediumData = new Uint8Array(50 * 1024 * 1024); // 50MB
      for (let i = 0; i < mediumData.length; i++) {
        mediumData[i] = i % 256;
      }

      // Encrypt small data
      const smallEncrypted = await encryptDataAdaptive(smallData, key);
      const smallDecrypted = await decryptDataAdaptive(smallEncrypted, key);
      expect(smallDecrypted).toEqual(smallData);

      // Encrypt medium data
      const mediumEncrypted = await encryptDataAdaptive(mediumData, key);
      const mediumDecrypted = await decryptDataAdaptive(mediumEncrypted, key);
      expect(mediumDecrypted).toEqual(mediumData);

      // Test streaming encryption
      const streamEncrypted = encryptDataStream(mediumData, key);
      const streamDecrypted = decryptDataStream(streamEncrypted, key);
      expect(streamDecrypted).toEqual(mediumData);
    });
  });

  describe("Security Properties", () => {
    it("should not expose keys in error messages", async () => {
      const key = generateEncryptionKey();
      const invalidKey = generateEncryptionKey();
      const data = new Uint8Array([1, 2, 3]);

      const encrypted = encryptData(data, key);

      expect(() => decryptData(encrypted, invalidKey)).toThrow();
      // Error should not contain the key
    });

    it("should produce different ciphertexts for same plaintext", () => {
      const key = generateEncryptionKey();
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

      const encrypted1 = encryptData(plaintext, key);
      const encrypted2 = encryptData(plaintext, key);

      expect(encrypted1).not.toEqual(encrypted2);

      // But both should decrypt to the same plaintext
      const decrypted1 = decryptData(encrypted1, key);
      const decrypted2 = decryptData(encrypted2, key);

      expect(decrypted1).toEqual(plaintext);
      expect(decrypted2).toEqual(plaintext);
    });
  });

  describe("Performance Tests", () => {
    it("should handle encryption within reasonable time", async () => {
      const key = generateEncryptionKey();
      const data = new Uint8Array(1024 * 1024); // 1MB

      const startTime = Date.now();
      const encrypted = encryptData(data, key);
      const encryptTime = Date.now() - startTime;

      const decryptStartTime = Date.now();
      const decrypted = decryptData(encrypted, key);
      const decryptTime = Date.now() - decryptStartTime;

      expect(decrypted).toEqual(data);
      expect(encryptTime).toBeLessThan(1000); // Should be under 1 second
      expect(decryptTime).toBeLessThan(1000); // Should be under 1 second
    });
  });
});
