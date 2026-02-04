// Tests for encryption utilities

import { describe, it, expect, beforeEach } from "vitest";
import {
  deriveKey,
  encrypt,
  decrypt,
  encryptPhotoMetadata,
  decryptPhotoMetadata,
  generateMasterKey,
  isEncrypted,
  ENCRYPTION_CONFIG,
} from "./encryption";

describe("Encryption Utilities", () => {
  let testKey: Buffer;
  let masterKey: string;

  beforeEach(() => {
    testKey = Buffer.alloc(32, 0); // Test key
    masterKey = generateMasterKey();
  });

  describe("Key Derivation", () => {
    it("should derive consistent keys from same password and salt", async () => {
      const password = "test-password";
      const salt = Buffer.from("test-salt", "utf8");

      const key1 = await deriveKey(password, salt);
      const key2 = await deriveKey(password, salt);

      expect(key1).toEqual(key2);
      expect(key1.length).toBe(ENCRYPTION_CONFIG.KEY_LENGTH);
    });

    it("should derive different keys with different salts", async () => {
      const password = "test-password";
      const salt1 = Buffer.from("salt1", "utf8");
      const salt2 = Buffer.from("salt2", "utf8");

      const key1 = await deriveKey(password, salt1);
      const key2 = await deriveKey(password, salt2);

      expect(key1).not.toEqual(key2);
    });
  });

  describe("AES-256-GCM Encryption", () => {
    it("should encrypt and decrypt data correctly", () => {
      const plaintext = "This is a secret message";

      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertext for same plaintext", () => {
      const plaintext = "This is a secret message";

      const encrypted1 = encrypt(plaintext, testKey);
      const encrypted2 = encrypt(plaintext, testKey);

      // Should be different due to random IV
      expect(encrypted1.encrypted).not.toEqual(encrypted2.encrypted);
      expect(encrypted1.iv).not.toEqual(encrypted2.iv);
      expect(encrypted1.authTag).not.toEqual(encrypted2.authTag);
    });

    it("should fail to decrypt with wrong key", () => {
      const plaintext = "This is a secret message";
      const wrongKey = Buffer.alloc(32, 1); // Different key

      const encrypted = encrypt(plaintext, testKey);

      expect(() => {
        decrypt(encrypted, wrongKey);
      }).toThrow();
    });

    it("should fail to decrypt with tampered data", () => {
      const plaintext = "This is a secret message";

      const encrypted = encrypt(plaintext, testKey);
      const tampered = {
        ...encrypted,
        encrypted: encrypted.encrypted.slice(0, -1) + "0", // Change last character
      };

      expect(() => {
        decrypt(tampered, testKey);
      }).toThrow();
    });
  });

  describe("Photo Metadata Encryption", () => {
    it("should encrypt and decrypt photo metadata", async () => {
      const metadata = {
        id: "photo-123",
        filename: "vacation.jpg",
        location: {
          latitude: 40.7128,
          longitude: -74.006,
          city: "New York",
        },
        tags: ["vacation", "summer", "2024"],
        takenAt: "2024-07-15T14:30:00Z",
        camera: {
          make: "Canon",
          model: "EOS R5",
          settings: {
            iso: 400,
            aperture: "f/2.8",
            shutter: "1/250",
          },
        },
      };

      const encrypted = await encryptPhotoMetadata(metadata, masterKey);
      const decrypted = await decryptPhotoMetadata(encrypted, masterKey);

      expect(decrypted).toEqual(metadata);
    });

    it("should produce different encryption packages for same metadata", async () => {
      const metadata = { id: "photo-123" };

      const encrypted1 = await encryptPhotoMetadata(metadata, masterKey);
      const encrypted2 = await encryptPhotoMetadata(metadata, masterKey);

      // Should be different due to random salt and IV
      expect(encrypted1.salt).not.toEqual(encrypted2.salt);
      expect(encrypted1.iv).not.toEqual(encrypted2.iv);
      expect(encrypted1.encrypted).not.toEqual(encrypted2.encrypted);
    });

    it("should fail to decrypt with wrong master key", async () => {
      const metadata = { id: "photo-123" };
      const wrongMasterKey = generateMasterKey();

      const encrypted = await encryptPhotoMetadata(metadata, masterKey);

      await expect(
        decryptPhotoMetadata(encrypted, wrongMasterKey),
      ).rejects.toThrow();
    });

    it("should handle complex nested objects", async () => {
      const complexMetadata = {
        id: "photo-456",
        exif: {
          make: "Sony",
          model: "A7R IV",
          iso: [100, 200, 400, 800],
          lens: {
            name: "FE 24-70mm F2.8 GM",
            focalLength: 50,
            apertureRange: [2.8, 22],
          },
          gps: {
            coordinates: [37.7749, -122.4194],
            altitude: 100.5,
            precision: "high",
          },
        },
        processing: {
          software: ["Lightroom", "Photoshop"],
          filters: ["vibrance", "clarity", "contrast"],
          adjustments: {
            brightness: 1.1,
            contrast: 1.05,
            saturation: 1.2,
          },
        },
      };

      const encrypted = await encryptPhotoMetadata(complexMetadata, masterKey);
      const decrypted = await decryptPhotoMetadata(encrypted, masterKey);

      expect(decrypted).toEqual(complexMetadata);
    });
  });

  describe("Master Key Generation", () => {
    it("should generate unique master keys", () => {
      const key1 = generateMasterKey();
      const key2 = generateMasterKey();

      expect(key1).not.toEqual(key2);
      expect(key1.length).toBe(64); // 32 bytes * 2 hex chars
      expect(key2.length).toBe(64);
      expect(/^[a-f0-9]{64}$/.test(key1)).toBe(true);
      expect(/^[a-f0-9]{64}$/.test(key2)).toBe(true);
    });

    it("should generate valid hex strings", () => {
      const key = generateMasterKey();

      expect(() => {
        Buffer.from(key, "hex");
      }).not.toThrow();
    });
  });

  describe("Encryption Detection", () => {
    it("should identify encrypted data packages", () => {
      const encrypted = {
        encrypted: "abc123",
        iv: "def456",
        authTag: "ghi789",
        salt: "jkl012",
      };

      expect(isEncrypted(encrypted)).toBe(true);
    });

    it("should reject non-encrypted data", () => {
      expect(isEncrypted("plain text")).toBe(false);
      expect(isEncrypted({})).toBe(false);
      expect(isEncrypted({ encrypted: "abc" })).toBe(false);
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
    });
  });

  describe("Configuration Constants", () => {
    it("should have correct encryption configuration", () => {
      expect(ENCRYPTION_CONFIG.ALGORITHM).toBe("aes-256-gcm");
      expect(ENCRYPTION_CONFIG.KEY_LENGTH).toBe(32);
      expect(ENCRYPTION_CONFIG.IV_LENGTH).toBe(12);
      expect(ENCRYPTION_CONFIG.AUTH_TAG_LENGTH).toBe(16);
      expect(ENCRYPTION_CONFIG.SCRYPT_N).toBe(32768);
      expect(ENCRYPTION_CONFIG.SCRYPT_R).toBe(8);
      expect(ENCRYPTION_CONFIG.SCRYPT_P).toBe(1);
    });
  });
});
