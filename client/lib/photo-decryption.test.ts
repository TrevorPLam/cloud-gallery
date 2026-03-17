// Comprehensive tests for photo decryption functionality
// Tests the complete download-decrypt-display cycle

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  downloadAndDecryptPhoto,
  isPhotoEncrypted,
  getOriginalFileExtension,
  generateDecryptedPhotoUri,
  cleanupDecryptedPhotos,
  batchDownloadAndDecryptPhotos,
  validateDecryptedPhoto,
  DecryptionMetadata,
  EncryptedPhotoInfo,
} from "./photo-decryption";
import { retrieveMasterKey } from "./key-derivation";
import { decryptData } from "./encryption";
import * as FileSystem from "expo-file-system";

// Mock dependencies
vi.mock("./key-derivation");
vi.mock("./encryption");
vi.mock("expo-file-system");

const mockRetrieveMasterKey = vi.mocked(retrieveMasterKey);
const mockDecryptData = vi.mocked(decryptData);
const mockFileSystem = vi.mocked(FileSystem);

describe("photo-decryption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("downloadAndDecryptPhoto", () => {
    const mockEncryptedPhoto: EncryptedPhotoInfo = {
      id: "test-photo-id",
      uri: "https://example.com/encrypted-photo.jpg",
      encrypted: true,
      encryptionMetadata: {
        iv: "181818181818181818181818181818181818181818181818",
        authTag: "0202020202020202020202020202020202020202",
        algorithm: "XChaCha20-Poly1305",
        encryptedAt: "2024-01-01T00:00:00.000Z",
      },
      originalMimeType: "image/jpeg",
    };

    const mockDestinationUri = "file://cache/decrypted_test-photo-id.jpg";

    it("should successfully download and decrypt an encrypted photo", async () => {
      // Setup mocks
      mockRetrieveMasterKey.mockResolvedValue("mock-master-key-hex");
      mockFileSystem.downloadAsync.mockResolvedValue({
        uri: "file://cache/temp.encrypted",
        status: 200,
        headers: {},
      });
      mockFileSystem.readAsStringAsync.mockResolvedValue("dGVzdCBkYXRh"); // base64 "test data"
      mockFileSystem.writeAsStringAsync.mockResolvedValue();
      mockFileSystem.deleteAsync.mockResolvedValue();

      // Mock decryption
      const decryptedBytes = new Uint8Array([116, 101, 115, 116, 32, 100, 97, 116, 97]); // "test data"
      mockDecryptData.mockReturnValue(decryptedBytes);

      const result = await downloadAndDecryptPhoto(mockEncryptedPhoto, mockDestinationUri);

      expect(result).toBe(mockDestinationUri);
      expect(mockRetrieveMasterKey).toHaveBeenCalledWith(false);
      expect(mockFileSystem.downloadAsync).toHaveBeenCalledWith(
        mockEncryptedPhoto.uri,
        expect.stringContaining(".encrypted")
      );
      expect(mockFileSystem.readAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining(".encrypted"),
        { encoding: FileSystem.EncodingType.Base64 }
      );
      expect(mockDecryptData).toHaveBeenCalled();
      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        mockDestinationUri,
        expect.any(String),
        { encoding: FileSystem.EncodingType.Base64 }
      );
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining(".encrypted"),
        { idempotent: true }
      );
    });

    it("should handle unencrypted photos by direct download", async () => {
      const unencryptedPhoto: EncryptedPhotoInfo = {
        ...mockEncryptedPhoto,
        encrypted: false,
        encryptionMetadata: undefined,
      };

      mockFileSystem.downloadAsync.mockResolvedValue({
        uri: mockDestinationUri,
        status: 200,
        headers: {},
      });

      const result = await downloadAndDecryptPhoto(unencryptedPhoto, mockDestinationUri);

      expect(result).toBe(mockDestinationUri);
      expect(mockRetrieveMasterKey).not.toHaveBeenCalled();
      expect(mockDecryptData).not.toHaveBeenCalled();
      expect(mockFileSystem.downloadAsync).toHaveBeenCalledWith(
        unencryptedPhoto.uri,
        mockDestinationUri
      );
    });

    it("should fail when encryption key is not available", async () => {
      mockRetrieveMasterKey.mockResolvedValue(null);

      await expect(
        downloadAndDecryptPhoto(mockEncryptedPhoto, mockDestinationUri)
      ).rejects.toThrow("Encryption key not available");
    });

    it("should fail when encryption metadata is missing", async () => {
      const photoWithoutMetadata: EncryptedPhotoInfo = {
        ...mockEncryptedPhoto,
        encrypted: true,
        encryptionMetadata: undefined,
      };

      await expect(
        downloadAndDecryptPhoto(photoWithoutMetadata, mockDestinationUri)
      ).rejects.toThrow("Missing encryption metadata");
    });

    it("should handle download failures", async () => {
      mockRetrieveMasterKey.mockResolvedValue("mock-master-key-hex");
      mockFileSystem.downloadAsync.mockResolvedValue({
        uri: "",
        status: 500,
        headers: {},
      });

      await expect(
        downloadAndDecryptPhoto(mockEncryptedPhoto, mockDestinationUri)
      ).rejects.toThrow("Download failed with status: 500");
    });

    it("should clean up temporary files on error", async () => {
      mockRetrieveMasterKey.mockResolvedValue("mock-master-key-hex");
      mockFileSystem.downloadAsync.mockRejectedValue(new Error("Download failed"));
      mockFileSystem.deleteAsync.mockResolvedValue();

      await expect(
        downloadAndDecryptPhoto(mockEncryptedPhoto, mockDestinationUri)
      ).rejects.toThrow("Download failed");

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining(".encrypted"),
        { idempotent: true }
      );
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        mockDestinationUri,
        { idempotent: true }
      );
    });

    it("should call progress callback", async () => {
      const progressCallback = vi.fn();
      mockRetrieveMasterKey.mockResolvedValue("mock-master-key-hex");
      mockFileSystem.downloadAsync.mockResolvedValue({
        uri: "file://cache/temp.encrypted",
        status: 200,
        headers: {},
      });
      mockFileSystem.readAsStringAsync.mockResolvedValue("dGVzdA==");
      mockDecryptData.mockReturnValue(new Uint8Array([116, 101, 115, 116])); // "test"
      mockFileSystem.writeAsStringAsync.mockResolvedValue();
      mockFileSystem.deleteAsync.mockResolvedValue();

      await downloadAndDecryptPhoto(mockEncryptedPhoto, mockDestinationUri, progressCallback);

      expect(progressCallback).toHaveBeenCalledWith(10);
      expect(progressCallback).toHaveBeenCalledWith(20);
      expect(progressCallback).toHaveBeenCalledWith(40);
      expect(progressCallback).toHaveBeenCalledWith(60);
      expect(progressCallback).toHaveBeenCalledWith(80);
      expect(progressCallback).toHaveBeenCalledWith(90);
      expect(progressCallback).toHaveBeenCalledWith(100);
    });
  });

  describe("isPhotoEncrypted", () => {
    it("should return true for encrypted photos", () => {
      const encryptedPhoto = {
        encrypted: true,
        encryptionMetadata: { iv: "test", authTag: "test", algorithm: "XChaCha20-Poly1305", encryptedAt: "2024-01-01T00:00:00.000Z" },
      };

      expect(isPhotoEncrypted(encryptedPhoto)).toBe(true);
    });

    it("should return false for unencrypted photos", () => {
      const unencryptedPhoto = {
        encrypted: false,
        encryptionMetadata: undefined,
      };

      expect(isPhotoEncrypted(unencryptedPhoto)).toBe(false);
    });

    it("should return false when encrypted flag is missing", () => {
      const photoWithoutFlag = {
        encryptionMetadata: { iv: "test", authTag: "test", algorithm: "XChaCha20-Poly1305", encryptedAt: "2024-01-01T00:00:00.000Z" },
      };

      expect(isPhotoEncrypted(photoWithoutFlag)).toBe(false);
    });

    it("should return false when encryption metadata is missing", () => {
      const photoWithoutMetadata = {
        encrypted: true,
        encryptionMetadata: undefined,
      };

      expect(isPhotoEncrypted(photoWithoutMetadata)).toBe(false);
    });
  });

  describe("getOriginalFileExtension", () => {
    it("should map MIME types to extensions", () => {
      const testCases = [
        { mimeType: "image/jpeg", expected: ".jpg" },
        { mimeType: "image/png", expected: ".png" },
        { mimeType: "image/gif", expected: ".gif" },
        { mimeType: "image/webp", expected: ".webp" },
        { mimeType: "image/heic", expected: ".heic" },
        { mimeType: "image/heif", expected: ".heif" },
      ];

      testCases.forEach(({ mimeType, expected }) => {
        const photo = { originalMimeType: mimeType };
        expect(getOriginalFileExtension(photo)).toBe(expected);
      });
    });

    it("should fallback to filename extension", () => {
      const photo = {
        filename: "test-photo.JPG",
        originalMimeType: "unknown/type",
      };

      expect(getOriginalFileExtension(photo)).toBe(".JPG");
    });

    it("should return default extension when no information is available", () => {
      const photo = {};

      expect(getOriginalFileExtension(photo)).toBe(".jpg");
    });
  });

  describe("generateDecryptedPhotoUri", () => {
    it("should generate correct URI format", () => {
      const photoId = "test-photo-123";
      const extension = ".jpg";

      mockFileSystem.cacheDirectory = "file://cache/";

      const result = generateDecryptedPhotoUri(photoId, extension);

      expect(result).toBe("file://cache/decrypted_test-photo-123.jpg");
    });

    it("should use document directory when cache directory is not available", () => {
      const photoId = "test-photo-123";
      const extension = ".png";

      mockFileSystem.cacheDirectory = undefined;
      mockFileSystem.documentDirectory = "file://documents/";

      const result = generateDecryptedPhotoUri(photoId, extension);

      expect(result).toBe("file://documents/decrypted_test-photo-123.png");
    });
  });

  describe("cleanupDecryptedPhotos", () => {
    it("should clean up old decrypted photos", async () => {
      const mockFiles = [
        "decrypted_photo1.jpg",
        "decrypted_photo2.png",
        "other_file.txt",
        "not_decrypted.jpg",
      ];

      const oldTime = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      const recentTime = Date.now() - 30 * 60 * 1000; // 30 minutes ago

      mockFileSystem.cacheDirectory = "file://cache/";
      mockFileSystem.readDirectoryAsync.mockResolvedValue(mockFiles);
      mockFileSystem.getInfoAsync.mockImplementation((uri) => {
        const filename = uri.split("/").pop();
        if (filename.startsWith("decrypted_")) {
          return Promise.resolve({
            exists: true,
            modificationTime: filename === "decrypted_photo1.jpg" ? oldTime / 1000 : recentTime / 1000,
          });
        }
        return Promise.resolve({ exists: false });
      });
      mockFileSystem.deleteAsync.mockResolvedValue();

      await cleanupDecryptedPhotos(60 * 60 * 1000); // 1 hour max age

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        "file://cache/decrypted_photo1.jpg",
        { idempotent: true }
      );
      expect(mockFileSystem.deleteAsync).not.toHaveBeenCalledWith(
        "file://cache/decrypted_photo2.png",
        expect.any(Object)
      );
    });

    it("should handle file system errors gracefully", async () => {
      mockFileSystem.cacheDirectory = "file://cache/";
      mockFileSystem.readDirectoryAsync.mockRejectedValue(new Error("File system error"));

      // Should not throw
      await expect(cleanupDecryptedPhotos()).resolves.toBeUndefined();
    });
  });

  describe("batchDownloadAndDecryptPhotos", () => {
    const mockPhotos: EncryptedPhotoInfo[] = [
      {
        id: "photo1",
        uri: "https://example.com/photo1.jpg",
        encrypted: true,
        encryptionMetadata: {
          iv: "iv1",
          authTag: "tag1",
          algorithm: "XChaCha20-Poly1305",
          encryptedAt: "2024-01-01T00:00:00.000Z",
        },
      },
      {
        id: "photo2",
        uri: "https://example.com/photo2.jpg",
        encrypted: false,
      },
    ];

    it("should process multiple photos", async () => {
      const overallProgress = vi.fn();
      const photoProgress = vi.fn();

      // Mock successful processing
      mockRetrieveMasterKey.mockResolvedValue("mock-key");
      mockFileSystem.downloadAsync.mockResolvedValue({
        uri: "file://cache/decrypted_photo1.jpg",
        status: 200,
        headers: {},
      });
      mockFileSystem.readAsStringAsync.mockResolvedValue("dGVzdA==");
      mockDecryptData.mockReturnValue(new Uint8Array([116, 101, 115, 116]));
      mockFileSystem.writeAsStringAsync.mockResolvedValue();
      mockFileSystem.deleteAsync.mockResolvedValue();

      const results = await batchDownloadAndDecryptPhotos(
        mockPhotos,
        overallProgress,
        photoProgress
      );

      expect(results).toHaveLength(2);
      expect(overallProgress).toHaveBeenCalledWith(0, "photo1");
      expect(overallProgress).toHaveBeenCalledWith(50, "photo2");
      expect(overallProgress).toHaveBeenCalledWith(100, "completed");
    });

    it("should continue processing even if individual photos fail", async () => {
      const overallProgress = vi.fn();

      // Mock first photo success, second photo failure
      mockRetrieveMasterKey.mockResolvedValue("mock-key");
      mockFileSystem.downloadAsync
        .mockResolvedValueOnce({
          uri: "file://cache/decrypted_photo1.jpg",
          status: 200,
          headers: {},
        })
        .mockRejectedValueOnce(new Error("Download failed"));

      mockFileSystem.readAsStringAsync.mockResolvedValue("dGVzdA==");
      mockDecryptData.mockReturnValue(new Uint8Array([116, 101, 115, 116]));
      mockFileSystem.writeAsStringAsync.mockResolvedValue();
      mockFileSystem.deleteAsync.mockResolvedValue();

      const results = await batchDownloadAndDecryptPhotos(mockPhotos, overallProgress);

      expect(results).toHaveLength(1); // Only one photo succeeded
    });
  });

  describe("validateDecryptedPhoto", () => {
    it("should validate existing photo", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: 1024,
      });

      const result = await validateDecryptedPhoto("file://cache/photo.jpg", {
        size: 1000,
      });

      expect(result).toBe(true);
    });

    it("should reject non-existing photo", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: false,
      });

      const result = await validateDecryptedPhoto("file://cache/photo.jpg", {});

      expect(result).toBe(false);
    });

    it("should warn about size mismatches but still return true", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: 1500, // 50% larger than expected
      });

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation();

      const result = await validateDecryptedPhoto("file://cache/photo.jpg", {
        size: 1000,
      });

      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("size mismatch")
      );

      consoleSpy.mockRestore();
    });

    it("should handle validation errors", async () => {
      mockFileSystem.getInfoAsync.mockRejectedValue(new Error("File system error"));

      const result = await validateDecryptedPhoto("file://cache/photo.jpg", {});

      expect(result).toBe(false);
    });
  });
});

// Integration tests for complete decryption workflow
describe("photo decryption integration", () => {
  it("should complete full download-decrypt-validate cycle", async () => {
    const masterKey = "mock-master-key-hex-32-chars-long";
    const encryptedPhoto: EncryptedPhotoInfo = {
      id: "test-photo",
      uri: "https://example.com/encrypted.jpg",
      encrypted: true,
      encryptionMetadata: {
        iv: "181818181818181818181818181818181818181818181818",
        authTag: "0202020202020202020202020202020202020202",
        algorithm: "XChaCha20-Poly1305",
        encryptedAt: "2024-01-01T00:00:00.000Z",
      },
      originalMimeType: "image/jpeg",
    };

    const destinationUri = "file://cache/decrypted_test-photo.jpg";
    const originalData = "test photo content";
    const decryptedBytes = Uint8Array.from(originalData, (c) => c.charCodeAt(0));

    // Setup mocks
    mockRetrieveMasterKey.mockResolvedValue(masterKey);
    mockFileSystem.downloadAsync.mockResolvedValue({
      uri: "file://cache/temp.encrypted",
      status: 200,
      headers: {},
    });
    mockFileSystem.readAsStringAsync.mockResolvedValue(btoa(originalData));
    mockDecryptData.mockReturnValue(decryptedBytes);
    mockFileSystem.writeAsStringAsync.mockResolvedValue();
    mockFileSystem.deleteAsync.mockResolvedValue();
    mockFileSystem.getInfoAsync.mockResolvedValue({
      exists: true,
      size: originalData.length,
    });

    // Test download and decrypt
    const result = await downloadAndDecryptPhoto(encryptedPhoto, destinationUri);
    expect(result).toBe(destinationUri);

    // Test validation
    const isValid = await validateDecryptedPhoto(destinationUri, {
      size: originalData.length,
    });
    expect(isValid).toBe(true);

    // Verify the complete workflow
    expect(mockRetrieveMasterKey).toHaveBeenCalledWith(false);
    expect(mockFileSystem.downloadAsync).toHaveBeenCalled();
    expect(mockFileSystem.readAsStringAsync).toHaveBeenCalled();
    expect(mockDecryptData).toHaveBeenCalled();
    expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalled();
  });
});
