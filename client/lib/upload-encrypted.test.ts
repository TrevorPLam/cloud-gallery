// Comprehensive tests for encrypted upload functionality
// Tests the complete encrypt-upload-decrypt round trip

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  encryptAndUpload,
  isEncryptionAvailable,
  getFileInfo,
  validatePhotoMetadata,
  estimateEncryptedSize,
  formatFileSize,
  EncryptionMetadata,
  PhotoMetadata,
} from "./upload-encrypted";
import { retrieveMasterKey } from "./key-derivation";
import { encryptData } from "./encryption";
import * as FileSystem from "expo-file-system";
import { api } from "./api";

// Mock dependencies
vi.mock("./key-derivation");
vi.mock("./encryption");
vi.mock("expo-file-system");
vi.mock("./api");

const mockRetrieveMasterKey = vi.mocked(retrieveMasterKey);
const mockEncryptData = vi.mocked(encryptData);
const mockFileSystem = vi.mocked(FileSystem);
const mockApi = vi.mocked(api);

describe("upload-encrypted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("encryptAndUpload", () => {
    const mockPhotoUri = "file://test/photo.jpg";
    const mockMetadata: PhotoMetadata = {
      width: 1920,
      height: 1080,
      filename: "test-photo.jpg",
      mimeType: "image/jpeg",
      tags: ["test", "vacation"],
      notes: "Test photo",
    };

    it("should successfully encrypt and upload a photo", async () => {
      // Setup mocks
      mockRetrieveMasterKey.mockResolvedValue("mock-master-key-hex");
      mockFileSystem.readAsStringAsync.mockResolvedValue("dGVzdCBkYXRh"); // base64 "test data"
      mockEncryptData.mockReturnValue(
        new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
      );
      mockApi.post.mockResolvedValue({
        data: {
          file: {
            id: "test-file-id",
            originalName: "test-photo.jpg",
            sanitizedFilename: "test-file-id-test-photo.jpg",
            mimeType: "image/jpeg",
            extension: ".jpg",
            size: 1024,
            hash: "test-hash",
            uploadedAt: "2024-01-01T00:00:00.000Z",
            uploadedBy: "user-id",
            uri: "/uploads/test-file-id-test-photo.jpg",
          },
        },
      });

      const result = await encryptAndUpload(mockPhotoUri, mockMetadata);

      expect(result.success).toBe(true);
      expect(result.file).toBeDefined();
      expect(result.file?.encrypted).toBe(true);
      expect(result.file?.encryptionMetadata).toBeDefined();
      expect(mockRetrieveMasterKey).toHaveBeenCalledWith(false);
      expect(mockFileSystem.readAsStringAsync).toHaveBeenCalledWith(
        mockPhotoUri,
        { encoding: FileSystem.EncodingType.Base64 }
      );
      expect(mockEncryptData).toHaveBeenCalled();
      expect(mockApi.post).toHaveBeenCalledWith(
        "/api/upload/single",
        expect.any(FormData),
        expect.objectContaining({
          headers: { "Content-Type": "multipart/form-data" },
        })
      );
    });

    it("should fail when encryption key is not available", async () => {
      mockRetrieveMasterKey.mockResolvedValue(null);

      const result = await encryptAndUpload(mockPhotoUri, mockMetadata);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Encryption key not available");
      expect(mockFileSystem.readAsStringAsync).not.toHaveBeenCalled();
    });

    it("should handle file reading errors", async () => {
      mockRetrieveMasterKey.mockResolvedValue("mock-master-key-hex");
      mockFileSystem.readAsStringAsync.mockRejectedValue(
        new Error("File not found")
      );

      const result = await encryptAndUpload(mockPhotoUri, mockMetadata);

      expect(result.success).toBe(false);
      expect(result.error).toContain("File not found");
    });

    it("should handle API upload errors", async () => {
      mockRetrieveMasterKey.mockResolvedValue("mock-master-key-hex");
      mockFileSystem.readAsStringAsync.mockResolvedValue("dGVzdCBkYXRh");
      mockEncryptData.mockReturnValue(new Uint8Array([1, 2, 3, 4, 5]));
      mockApi.post.mockRejectedValue(new Error("Upload failed"));

      const result = await encryptAndUpload(mockPhotoUri, mockMetadata);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Upload failed");
    });

    it("should call progress callback", async () => {
      const progressCallback = vi.fn();
      mockRetrieveMasterKey.mockResolvedValue("mock-master-key-hex");
      mockFileSystem.readAsStringAsync.mockResolvedValue("dGVzdCBkYXRh");
      mockEncryptData.mockReturnValue(new Uint8Array([1, 2, 3, 4, 5]));
      mockApi.post.mockResolvedValue({
        data: {
          file: { id: "test", encrypted: true },
        },
      });

      await encryptAndUpload(mockPhotoUri, mockMetadata, progressCallback);

      expect(progressCallback).toHaveBeenCalledWith(10);
      expect(progressCallback).toHaveBeenCalledWith(20);
      expect(progressCallback).toHaveBeenCalledWith(30);
      expect(progressCallback).toHaveBeenCalledWith(40);
      expect(progressCallback).toHaveBeenCalledWith(50);
      expect(progressCallback).toHaveBeenCalledWith(60);
      expect(progressCallback).toHaveBeenCalledWith(100);
    });
  });

  describe("isEncryptionAvailable", () => {
    it("should return true when encryption key is available", async () => {
      mockRetrieveMasterKey.mockResolvedValue("mock-key");

      const result = await isEncryptionAvailable();

      expect(result).toBe(true);
      expect(mockRetrieveMasterKey).toHaveBeenCalledWith(false);
    });

    it("should return false when encryption key is not available", async () => {
      mockRetrieveMasterKey.mockResolvedValue(null);

      const result = await isEncryptionAvailable();

      expect(result).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      mockRetrieveMasterKey.mockRejectedValue(new Error("Key access failed"));

      const result = await isEncryptionAvailable();

      expect(result).toBe(false);
    });
  });

  describe("getFileInfo", () => {
    it("should return file information for existing file", async () => {
      const mockInfo = {
        size: 1024,
        exists: true,
        isDirectory: false,
      };
      mockFileSystem.getInfoAsync.mockResolvedValue(mockInfo);

      const result = await getFileInfo("file://test/photo.jpg");

      expect(result).toEqual(mockInfo);
      expect(mockFileSystem.getInfoAsync).toHaveBeenCalledWith("file://test/photo.jpg");
    });

    it("should return default info for non-existing file", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        size: 0,
        exists: false,
        isDirectory: false,
      });

      const result = await getFileInfo("file://test/nonexistent.jpg");

      expect(result.exists).toBe(false);
      expect(result.size).toBe(0);
    });

    it("should handle file system errors", async () => {
      mockFileSystem.getInfoAsync.mockRejectedValue(new Error("File system error"));

      const result = await getFileInfo("file://test/photo.jpg");

      expect(result).toEqual({
        size: 0,
        exists: false,
        isDirectory: false,
      });
    });
  });

  describe("validatePhotoMetadata", () => {
    it("should validate correct metadata", () => {
      const validMetadata: PhotoMetadata = {
        width: 1920,
        height: 1080,
        filename: "photo.jpg",
        mimeType: "image/jpeg",
        tags: ["test"],
        notes: "Test photo",
      };

      expect(validatePhotoMetadata(validMetadata)).toBe(true);
    });

    it("should reject metadata with missing required fields", () => {
      const invalidMetadata = {
        width: 1920,
        // missing height and filename
      } as PhotoMetadata;

      expect(validatePhotoMetadata(invalidMetadata)).toBe(false);
    });

    it("should reject metadata with invalid dimensions", () => {
      const invalidMetadata: PhotoMetadata = {
        width: -1,
        height: 1080,
        filename: "photo.jpg",
      };

      expect(validatePhotoMetadata(invalidMetadata)).toBe(false);
    });

    it("should reject metadata with too long filename", () => {
      const invalidMetadata: PhotoMetadata = {
        width: 1920,
        height: 1080,
        filename: "a".repeat(256), // Too long
      };

      expect(validatePhotoMetadata(invalidMetadata)).toBe(false);
    });

    it("should reject metadata with too many tags", () => {
      const invalidMetadata: PhotoMetadata = {
        width: 1920,
        height: 1080,
        filename: "photo.jpg",
        tags: Array(51).fill("tag"), // Too many tags
      };

      expect(validatePhotoMetadata(invalidMetadata)).toBe(false);
    });

    it("should reject metadata with too long notes", () => {
      const invalidMetadata: PhotoMetadata = {
        width: 1920,
        height: 1080,
        filename: "photo.jpg",
        notes: "a".repeat(1001), // Too long
      };

      expect(validatePhotoMetadata(invalidMetadata)).toBe(false);
    });
  });

  describe("estimateEncryptedSize", () => {
    it("should calculate encrypted size correctly", () => {
      const originalSize = 1000;
      const expectedSize = 1040; // original + 40 bytes for IV + authTag

      expect(estimateEncryptedSize(originalSize)).toBe(expectedSize);
    });

    it("should handle zero size", () => {
      expect(estimateEncryptedSize(0)).toBe(40);
    });

    it("should handle large files", () => {
      const largeSize = 10 * 1024 * 1024; // 10MB
      const expectedSize = largeSize + 40;

      expect(estimateEncryptedSize(largeSize)).toBe(expectedSize);
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes correctly", () => {
      expect(formatFileSize(0)).toBe("0 B");
      expect(formatFileSize(1024)).toBe("1 KB");
      expect(formatFileSize(1024 * 1024)).toBe("1 MB");
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
    });

    it("should format fractional sizes", () => {
      expect(formatFileSize(1536)).toBe("1.5 KB");
      expect(formatFileSize(1536 * 1024)).toBe("1.5 MB");
    });

    it("should handle large numbers", () => {
      const largeSize = 2.5 * 1024 * 1024 * 1024;
      expect(formatFileSize(largeSize)).toBe("2.5 GB");
    });
  });
});

// Integration tests for the complete encryption round-trip
describe("encryption round-trip integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete full encrypt-upload-decrypt cycle", async () => {
    // Setup mocks for the complete cycle
    const masterKey = "mock-master-key-hex-32-chars-long";
    const originalData = "test photo data";
    const originalBytes = Uint8Array.from(originalData, (c) => c.charCodeAt(0));
    const encryptedData = new Uint8Array([
      // Mock IV (24 bytes)
      ...Array(24).fill(1),
      // Mock ciphertext
      ...originalBytes.map((b, i) => b + 1),
      // Mock authTag (16 bytes)
      ...Array(16).fill(2),
    ]);

    mockRetrieveMasterKey.mockResolvedValue(masterKey);
    mockFileSystem.readAsStringAsync.mockResolvedValue(
      btoa(originalData) // Convert to base64
    );
    mockEncryptData.mockReturnValue(encryptedData);
    mockApi.post.mockResolvedValue({
      data: {
        file: {
          id: "test-file-id",
          originalName: "test-photo.jpg",
          sanitizedFilename: "test-file-id-test-photo.jpg",
          mimeType: "image/jpeg",
          extension: ".jpg",
          size: originalData.length,
          hash: "test-hash",
          uploadedAt: "2024-01-01T00:00:00.000Z",
          uploadedBy: "user-id",
          uri: "/uploads/test-file-id-test-photo.jpg",
          encrypted: true,
          encryptionMetadata: {
            iv: "181818181818181818181818181818181818181818181818",
            authTag: "0202020202020202020202020202020202020202",
            algorithm: "XChaCha20-Poly1305",
            encryptedAt: "2024-01-01T00:00:00.000Z",
          },
        },
      },
    });

    // Test encryption and upload
    const photoUri = "file://test/photo.jpg";
    const metadata: PhotoMetadata = {
      width: 1920,
      height: 1080,
      filename: "test-photo.jpg",
      mimeType: "image/jpeg",
    };

    const uploadResult = await encryptAndUpload(photoUri, metadata);

    expect(uploadResult.success).toBe(true);
    expect(uploadResult.file?.encrypted).toBe(true);
    expect(uploadResult.file?.encryptionMetadata).toBeDefined();

    // Verify the upload was called with correct FormData
    expect(mockApi.post).toHaveBeenCalledWith(
      "/api/upload/single",
      expect.any(FormData),
      expect.any(Object)
    );

    const formDataCall = mockApi.post.mock.calls[0][1] as FormData;
    expect(formDataCall.get("encrypted")).toBe("true");
    expect(formDataCall.get("iv")).toBe(
      "181818181818181818181818181818181818181818181818"
    );
    expect(formDataCall.get("authTag")).toBe(
      "0202020202020202020202020202020202020202"
    );
    expect(formDataCall.get("algorithm")).toBe("XChaCha20-Poly1305");

    // Verify metadata was included
    const metadataStr = formDataCall.get("metadata") as string;
    const parsedMetadata = JSON.parse(metadataStr);
    expect(parsedMetadata.encrypted).toBe(true);
    expect(parsedMetadata.encryptionMetadata).toBeDefined();
  });

  it("should handle encryption unavailability gracefully", async () => {
    mockRetrieveMasterKey.mockResolvedValue(null);

    const result = await encryptAndUpload("file://test/photo.jpg", {
      width: 1920,
      height: 1080,
      filename: "test.jpg",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Encryption key not available");
    expect(mockFileSystem.readAsStringAsync).not.toHaveBeenCalled();
    expect(mockApi.post).not.toHaveBeenCalled();
  });
});
