// AI-META-BEGIN
// AI-META: Comprehensive test suite for Google Takeout migration processor
// OWNERSHIP: client/lib/migration (data migration testing)
// ENTRYPOINTS: Imported by test runners for migration functionality validation
// DEPENDENCIES: Vitest, expo-file-system mocking, react-native-zip-archive mocking
// DANGER: File system operations mocking, complex async operations testing
// CHANGE-SAFETY: High - critical migration functionality; maintain test coverage
// TESTS: ZIP parsing, metadata restoration, duplicate detection, E2EE integration, error handling
// AI-META-END

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import { unzip } from "react-native-zip-archive";
import * as Exify from "@lodev09/react-native-exify";
import { encryptAndUpload } from "@/lib/upload-encrypted";
import { getPhotosByPerceptualHash } from "@/lib/storage";
import { googleTakeoutProcessor, GoogleTakeoutMetadata } from "./google-takeout";
import { pHash } from "@stabilityprotocol.com/phash";

// Mock all external dependencies
vi.mock("expo-file-system");
vi.mock("expo-document-picker");
vi.mock("react-native-zip-archive");
vi.mock("@lodev09/react-native-exify");
vi.mock("@/lib/upload-encrypted");
vi.mock("@/lib/storage");
vi.mock("@stabilityprotocol.com/phash");

// Mock implementations
const mockFileSystem = vi.mocked(FilesAPI);
const mockDocumentPicker = vi.mocked(DocumentPicker);
const mockUnzip = vi.mocked(unzip);
const mockExify = vi.mocked(Exify);
const mockEncryptAndUpload = vi.mocked(encryptAndUpload);
const mockGetPhotosByPerceptualHash = vi.mocked(getPhotosByPerceptualHash);
const mockPHash = vi.mocked(pHash);

describe("GoogleTakeoutProcessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    mockFileSystem.cacheDirectory = "/cache/";
    mockFileSystem.documentDirectory = "/documents/";
    
    mockFileSystem.makeDirectoryAsync = vi.fn().mockResolvedValue(undefined);
    mockFileSystem.readDirectoryAsync = vi.fn().mockResolvedValue([]);
    mockFileSystem.getInfoAsync = vi.fn().mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 1024,
    });
    mockFileSystem.copyAsync = vi.fn().mockResolvedValue(undefined);
    mockFileSystem.deleteAsync = vi.fn().mockResolvedValue(undefined);
    mockFileSystem.readAsAsStringAsync = vi.fn().mockResolvedValue("{}");
    
    mockDocumentPicker.getDocumentAsync = vi.fn().mockResolvedValue({
      canceled: false,
      assets: [{ uri: "/mock/zip/file.zip" }],
    });
    
    mockUnzip.mockResolvedValue(undefined);
    mockExify.write = vi.fn().mockResolvedValue(undefined);
    
    mockEncryptAndUpload.mockResolvedValue({
      success: true,
      file: {
        id: "test-file-id",
        uri: "/uploaded/file.jpg",
      },
    });
    
    mockGetPhotosByPerceptualHash.mockResolvedValue([]);
    mockPHash.mockResolvedValue("test-hash");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("processTakeoutArchive", () => {
    it("should successfully process a valid ZIP archive", async () => {
      // Setup mock files in ZIP
      mockFileSystem.readDirectoryAsync
        .mockResolvedValueOnce(["photo1.jpg", "photo1.jpg.json", "photo2.jpg"])
        .mockResolvedValueOnce(["photo1.jpg", "photo1.jpg.json", "photo2.jpg"]);

      // Setup mock metadata
      const mockMetadata: GoogleTakeoutMetadata = {
        title: "photo1.jpg",
        description: "Test photo",
        photoTakenTime: {
          timestamp: "1640995200",
          formatted: "Jan 1, 2022, 12:00:00 PM UTC",
        },
        geoData: {
          latitude: 37.7749,
          longitude: -122.4194,
          altitude: 100,
          latitudeSpan: 0.0,
          longitudeSpan: 0.0,
        },
        favorited: true,
      };

      mockFileSystem.readAsAsStringAsync
        .mockResolvedValueOnce(JSON.stringify(mockMetadata))
        .mockResolvedValueOnce("mock-image-data");

      const progressCallback = vi.fn();
      const result = await googleTakeoutProcessor.processTakeoutArchive(progressCallback);

      expect(result.success).toBe(true);
      expect(result.importedPhotos).toBe(2);
      expect(mockEncryptAndUpload).toHaveBeenCalledTimes(2);
      expect(progressCallback).toHaveBeenCalled();
    });

    it("should handle file selection cancellation", async () => {
      mockDocumentPicker.getDocumentAsync.mockResolvedValue({
        canceled: true,
        assets: [],
      });

      const progressCallback = vi.fn();
      const result = await googleTakeoutProcessor.processTakeoutArchive(progressCallback);

      expect(result.success).toBe(false);
      expect(result.errors).toContain("No file selected");
    });

    it("should detect and skip duplicate photos", async () => {
      // Setup duplicate detection
      mockGetPhotosByPerceptualHash.mockResolvedValue([{
        id: "existing-photo",
        uri: "/existing/photo.jpg",
      } as any]);

      mockFileSystem.readDirectoryAsync.mockResolvedValue(["photo1.jpg"]);

      const progressCallback = vi.fn();
      const result = await googleTakeoutProcessor.processTakeoutArchive(progressCallback);

      expect(result.success).toBe(true);
      expect(result.importedPhotos).toBe(0);
      expect(result.skippedFiles).toContain("photo1.jpg (duplicate)");
    });

    it("should handle ZIP extraction errors", async () => {
      mockUnzip.mockRejectedValue(new Error("ZIP extraction failed"));

      const progressCallback = vi.fn();
      const result = await googleTakeoutProcessor.processTakeoutArchive(progressCallback);

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Failed to extract archive: ZIP extraction failed");
    });

    it("should handle upload errors gracefully", async () => {
      mockFileSystem.readDirectoryAsync.mockResolvedValue(["photo1.jpg"]);
      mockEncryptAndUpload.mockResolvedValue({
        success: false,
        error: "Upload failed",
      });

      const progressCallback = vi.fn();
      const result = await googleTakeoutProcessor.processTakeoutArchive(progressCallback);

      expect(result.success).toBe(true); // Overall process succeeds
      expect(result.importedPhotos).toBe(0);
      expect(result.skippedFiles).toContain("photo1.jpg");
      expect(result.errors).toContain("Failed to process photo1.jpg: Upload failed");
    });
  });

  describe("metadata handling", () => {
    it("should correctly parse Google Takeout metadata", async () => {
      const metadata: GoogleTakeoutMetadata = {
        title: "test-photo.jpg",
        description: "Beautiful sunset",
        photoTakenTime: {
          timestamp: "1640995200",
          formatted: "Jan 1, 2022, 12:00:00 PM UTC",
        },
        geoData: {
          latitude: 37.7749,
          longitude: -122.4194,
          altitude: 100,
          latitudeSpan: 0.0,
          longitudeSpan: 0.0,
        },
        favorited: true,
        people: [{ name: "John Doe" }],
        googlePhotosOrigin: {
          mobileUpload: {
            deviceType: "ANDROID_PHONE",
          },
        },
      };

      mockFileSystem.readDirectoryAsync.mockResolvedValue(["test-photo.jpg"]);
      mockFileSystem.readAsAsStringAsync.mockResolvedValue(JSON.stringify(metadata));

      const progressCallback = vi.fn();
      await googleTakeoutProcessor.processTakeoutArchive(progressCallback);

      // Verify EXIF restoration was called with correct data
      expect(mockExify.write).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          DateTimeOriginal: "2022-01-01 12:00:00",
          GPSLatitude: 37.7749,
          GPSLongitude: -122.4194,
          GPSAltitude: 100,
          ImageDescription: "Beautiful sunset",
          Make: "ANDROID_PHONE",
        })
      );
    });

    it("should handle missing metadata gracefully", async () => {
      mockFileSystem.readDirectoryAsync.mockResolvedValue(["photo1.jpg"]);
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 1024,
        modificationTime: 1640995200,
      });

      const progressCallback = vi.fn();
      const result = await googleTakeoutProcessor.processTakeoutArchive(progressCallback);

      expect(result.success).toBe(true);
      expect(result.importedPhotos).toBe(1);
      expect(mockExify.write).not.toHaveBeenCalled();
    });

    it("should handle truncated metadata filenames", async () => {
      // Test Google's filename truncation behavior
      const longFilename = "very-long-filename-that-gets-truncated-by-google-takeout-when-it-exceeds-46-characters.jpg";
      const truncatedMetadata = `${longFilename.substring(0, 40)}.supplemental-metadat.json`;

      mockFileSystem.readDirectoryAsync.mockResolvedValue([longFilename, truncatedMetadata]);
      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: false, isDirectory: false })
        .mockResolvedValueOnce({ exists: true, isDirectory: false });

      const metadata = { title: longFilename };
      mockFileSystem.readAsAsStringAsync.mockResolvedValue(JSON.stringify(metadata));

      const progressCallback = vi.fn();
      const result = await googleTakeoutProcessor.processTakeoutArchive(progressCallback);

      expect(result.success).toBe(true);
      expect(result.importedPhotos).toBe(1);
    });
  });

  describe("perceptual hashing", () => {
    it("should generate perceptual hashes for duplicate detection", async () => {
      mockFileSystem.readDirectoryAsync.mockResolvedValue(["photo1.jpg"]);
      mockFileSystem.readAsAsStringAsync.mockResolvedValue("mock-image-data");

      const progressCallback = vi.fn();
      await googleTakeoutProcessor.processTakeoutArchive(progressCallback);

      expect(mockPHash).toHaveBeenCalledWith("mock-image-data");
      expect(mockGetPhotosByPerceptualHash).toHaveBeenCalledWith("test-hash");
    });

    it("should fallback to simple hash on pHash failure", async () => {
      mockPHash.mockRejectedValue(new Error("pHash failed"));
      mockFileSystem.readDirectoryAsync.mockResolvedValue(["photo1.jpg"]);
      mockFileSystem.readAsAsStringAsync.mockResolvedValue("mock-image-data");

      const progressCallback = vi.fn();
      await googleTakeoutProcessor.processTakeoutArchive(progressCallback);

      expect(mockGetPhotosByPerceptualHash).toHaveBeenCalled();
      // Should use fallback hash
      expect(mockGetPhotosByPerceptualHash).toHaveBeenCalledWith(
        expect.stringMatching(/^[a-f0-9]{8}$/)
      );
    });
  });

  describe("cancellation", () => {
    it("should handle cancellation during processing", async () => {
      mockFileSystem.readDirectoryAsync.mockResolvedValue([
        "photo1.jpg",
        "photo2.jpg",
        "photo3.jpg",
      ]);

      const progressCallback = vi.fn();
      
      // Start processing and cancel after a short delay
      const processPromise = googleTakeoutProcessor.processTakeoutArchive(progressCallback);
      
      // Cancel after first photo processing starts
      setTimeout(() => {
        googleTakeoutProcessor.cancel();
      }, 100);

      const result = await processPromise;

      expect(result.success).toBe(true); // Partial success
      expect(result.importedPhotos).toBeLessThan(3);
    });

    it("should clean up temporary files on cancellation", async () => {
      mockFileSystem.readDirectoryAsync.mockResolvedValue(["photo1.jpg"]);
      
      const progressCallback = vi.fn();
      googleTakeoutProcessor.cancel();
      
      await googleTakeoutProcessor.processTakeoutArchive(progressCallback);

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining("takeout_extract_"),
        { idempotent: true }
      );
    });
  });

  describe("error handling", () => {
    it("should handle malformed JSON metadata", async () => {
      mockFileSystem.readDirectoryAsync.mockResolvedValue(["photo1.jpg", "photo1.jpg.json"]);
      mockFileSystem.readAsAsStringAsync
        .mockResolvedValueOnce("invalid-json")
        .mockResolvedValueOnce("mock-image-data");

      const progressCallback = vi.fn();
      const result = await googleTakeoutProcessor.processTakeoutArchive(progressCallback);

      expect(result.success).toBe(true);
      expect(result.importedPhotos).toBe(1);
      // Should continue processing despite JSON error
    });

    it("should handle file system permission errors", async () => {
      mockFileSystem.makeDirectoryAsync.mockRejectedValue(new Error("Permission denied"));

      const progressCallback = vi.fn();
      const result = await googleTakeoutProcessor.processTakeoutArchive(progressCallback);

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Failed to extract archive: Permission denied");
    });

    it("should handle EXIF writing errors", async () => {
      mockFileSystem.readDirectoryAsync.mockResolvedValue(["photo1.jpg"]);
      mockExify.write.mockRejectedValue(new Error("EXIF write failed"));

      const progressCallback = vi.fn();
      const result = await googleTakeoutProcessor.processTakeoutArchive(progressCallback);

      // Should continue despite EXIF errors
      expect(result.success).toBe(true);
      expect(result.importedPhotos).toBe(1);
    });
  });

  describe("progress tracking", () => {
    it("should provide accurate progress updates", async () => {
      const files = ["photo1.jpg", "photo2.jpg", "photo3.jpg"];
      mockFileSystem.readDirectoryAsync.mockResolvedValue(files);

      const progressCallback = vi.fn();
      await googleTakeoutProcessor.processTakeoutArchive(progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(files.length + 2); // +2 for extract and scan steps
      
      // Check final progress
      const finalCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1][0];
      expect(finalCall.processedFiles).toBe(files.length);
      expect(finalCall.totalFiles).toBe(files.length);
      expect(finalCall.percentage).toBe(100);
    });

    it("should update progress during individual file uploads", async () => {
      mockFileSystem.readDirectoryAsync.mockResolvedValue(["photo1.jpg"]);
      
      // Mock upload with progress
      let uploadProgressCallback: (progress: number) => void;
      mockEncryptAndUpload.mockImplementation(async (uri, metadata, onProgress) => {
        uploadProgressCallback = onProgress!;
        return { success: true, file: { id: "test", uri } };
      });

      const progressCallback = vi.fn();
      await googleTakeoutProcessor.processTakeoutArchive(progressCallback);

      expect(uploadProgressCallback).toBeDefined();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStep: expect.stringContaining("Uploading"),
        })
      );
    });
  });
});
