// AI-META-BEGIN
// AI-META: Comprehensive tests for Google Takeout migration processing pipeline
// OWNERSHIP: client/lib/migration (testing)
// ENTRYPOINTS: Test runner execution
// DEPENDENCIES: Vitest, mock implementations, test utilities
// DANGER: Test file system operations, large file processing simulation
// CHANGE-SAFETY: Low - test file only; maintain test coverage
// TESTS: Unit tests for all migration functions, integration tests, error scenarios
// AI-META-END

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { googleTakeoutProcessor } from "./google-takeout";
import type {
  GoogleTakeoutMetadata,
  MigrationProgress,
} from "./google-takeout";

// Mock dependencies
vi.mock("expo-document-picker");
vi.mock("expo-file-system");
vi.mock("react-native-zip-archive");
vi.mock("@lodev09/react-native-exify");
vi.mock("@/lib/storage");

// Mock implementations
const mockDocumentPicker = vi.importMock("expo-document-picker");
const mockFileSystem = vi.importMock("expo-file-system");
const mockZipArchive = vi.importMock("react-native-zip-archive");
const mockExify = vi.importMock("@lodev09/react-native-exify");
const mockStorage = vi.importMock("@/lib/storage");

describe("Google Takeout Migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock implementations
    mockFileSystem.FileSystem.cacheDirectory = "/cache/";
    mockFileSystem.FileSystem.documentDirectory = "/documents/";
    mockFileSystem.FileSystem.makeDirectoryAsync = vi
      .fn()
      .mockResolvedValue(undefined);
    mockFileSystem.FileSystem.readDirectoryAsync = vi
      .fn()
      .mockResolvedValue([]);
    mockFileSystem.FileSystem.getInfoAsync = vi.fn().mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 1024,
      modificationTime: Date.now() / 1000,
    });
    mockFileSystem.FileSystem.copyAsync = vi.fn().mockResolvedValue(undefined);
    mockFileSystem.FileSystem.deleteAsync = vi
      .fn()
      .mockResolvedValue(undefined);
    mockFileSystem.FileSystem.writeAsStringAsync = vi
      .fn()
      .mockResolvedValue(undefined);
    mockFileSystem.FileSystem.readAsStringAsync = vi
      .fn()
      .mockResolvedValue("{}");

    mockZipArchive.unzip = vi.fn().mockResolvedValue(undefined);
    mockExify.Exify.write = vi.fn().mockResolvedValue({});
    mockStorage.addPhoto = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("File Selection", () => {
    it("should select a valid ZIP file", async () => {
      const mockFile = {
        uri: "/cache/takeout.zip",
        name: "takeout.zip",
        size: 1024 * 1024 * 100, // 100MB
      };

      mockDocumentPicker.getDocumentAsync = vi.fn().mockResolvedValue({
        canceled: false,
        assets: [mockFile],
      });

      // Test file selection through the processor
      const result = await googleTakeoutProcessor.processTakeoutArchive();

      expect(mockDocumentPicker.getDocumentAsync).toHaveBeenCalledWith({
        type: ["application/zip", "application/x-zip-compressed"],
        copyToCacheDirectory: true,
        multiple: false,
      });
    });

    it("should handle cancelled file selection", async () => {
      mockDocumentPicker.getDocumentAsync = vi.fn().mockResolvedValue({
        canceled: true,
        assets: [],
      });

      const result = await googleTakeoutProcessor.processTakeoutArchive();

      expect(result.success).toBe(false);
      expect(result.errors).toContain("No file selected");
    });

    it("should handle file selection errors", async () => {
      mockDocumentPicker.getDocumentAsync = vi
        .fn()
        .mockRejectedValue(new Error("Permission denied"));

      const result = await googleTakeoutProcessor.processTakeoutArchive();

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Failed to select file: Permission denied",
      );
    });
  });

  describe("ZIP Extraction", () => {
    it("should extract ZIP archive successfully", async () => {
      const mockFile = {
        uri: "/cache/takeout.zip",
        name: "takeout.zip",
      };

      mockDocumentPicker.getDocumentAsync = vi.fn().mockResolvedValue({
        canceled: false,
        assets: [mockFile],
      });

      mockFileSystem.readDirectoryAsync = vi
        .fn()
        .mockResolvedValueOnce(["Photos/", "metadata.json"]) // Root directory
        .mockResolvedValueOnce(["IMG_001.jpg", "IMG_001.jpg.json"]); // Photos directory

      const result = await googleTakeoutProcessor.processTakeoutArchive();

      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        expect.stringContaining("takeout_extract_"),
        { intermediates: true },
      );
      expect(mockZipArchive.unzip).toHaveBeenCalledWith(
        mockFile.uri,
        expect.stringContaining("takeout_extract_"),
      );
    });

    it("should handle ZIP extraction errors", async () => {
      const mockFile = {
        uri: "/cache/takeout.zip",
        name: "takeout.zip",
      };

      mockDocumentPicker.getDocumentAsync = vi.fn().mockResolvedValue({
        canceled: false,
        assets: [mockFile],
      });

      mockZipArchive.unzip = vi
        .fn()
        .mockRejectedValue(new Error("Corrupted ZIP file"));

      const result = await googleTakeoutProcessor.processTakeoutArchive();

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Failed to extract archive: Corrupted ZIP file",
      );
    });
  });

  describe("Photo Scanning", () => {
    it("should find photos and metadata files", async () => {
      const mockFile = {
        uri: "/cache/takeout.zip",
        name: "takeout.zip",
      };

      mockDocumentPicker.getDocumentAsync = vi.fn().mockResolvedValue({
        canceled: false,
        assets: [mockFile],
      });

      // Mock directory structure
      mockFileSystem.readDirectoryAsync = vi
        .fn()
        .mockResolvedValueOnce(["Photos From 2023/"]) // Root directory
        .mockResolvedValueOnce([
          "IMG_001.jpg",
          "IMG_001.jpg.json",
          "IMG_002.jpg",
        ]); // Photos directory

      // Mock metadata file content
      const mockMetadata: GoogleTakeoutMetadata = {
        title: "IMG_001.jpg",
        description: "Test photo",
        photoTakenTime: {
          timestamp: "1692113136",
          formatted: "Aug 15, 2023, 2:25:36 PM UTC",
        },
        geoData: {
          latitude: 36.778259,
          longitude: -119.417931,
          altitude: 15.0,
          latitudeSpan: 0.0,
          longitudeSpan: 0.0,
        },
        favorited: true,
      };

      mockFileSystem.readAsStringAsync = vi
        .fn()
        .mockResolvedValue(JSON.stringify(mockMetadata));

      const result = await googleTakeoutProcessor.processTakeoutArchive();

      expect(mockFileSystem.readDirectoryAsync).toHaveBeenCalledTimes(2);
      expect(mockFileSystem.readAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining("IMG_001.jpg.json"),
      );
    });

    it("should handle truncated metadata filenames", async () => {
      const mockFile = {
        uri: "/cache/takeout.zip",
        name: "takeout.zip",
      };

      mockDocumentPicker.getDocumentAsync = vi.fn().mockResolvedValue({
        canceled: false,
        assets: [mockFile],
      });

      // Mock directory with long filename
      const longFilename = "2023-08-15-beach-sunset-panorama-with-family.jpg";
      mockFileSystem.readDirectoryAsync = vi
        .fn()
        .mockResolvedValueOnce(["Photos From 2023/"]) // Root directory
        .mockResolvedValueOnce([
          longFilename,
          `${longFilename}.supplemental-metadat.json`,
        ]); // Truncated metadata

      const mockMetadata: GoogleTakeoutMetadata = {
        title: longFilename,
        photoTakenTime: {
          timestamp: "1692113136",
          formatted: "Aug 15, 2023, 2:25:36 PM UTC",
        },
      };

      mockFileSystem.readAsStringAsync = vi
        .fn()
        .mockResolvedValue(JSON.stringify(mockMetadata));

      const result = await googleTakeoutProcessor.processTakeoutArchive();

      expect(mockFileSystem.readAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining("supplemental-metadat.json"),
      );
    });
  });

  describe("Metadata Processing", () => {
    it("should convert Google Takeout metadata to EXIF tags", async () => {
      const mockFile = {
        uri: "/cache/takeout.zip",
        name: "takeout.zip",
      };

      mockDocumentPicker.getDocumentAsync = vi.fn().mockResolvedValue({
        canceled: false,
        assets: [mockFile],
      });

      mockFileSystem.readDirectoryAsync = vi
        .fn()
        .mockResolvedValueOnce(["Photos/"])
        .mockResolvedValueOnce(["IMG_001.jpg", "IMG_001.jpg.json"]);

      const mockMetadata: GoogleTakeoutMetadata = {
        title: "IMG_001.jpg",
        description: "Beach sunset with family",
        photoTakenTime: {
          timestamp: "1692113136",
          formatted: "Aug 15, 2023, 2:25:36 PM UTC",
        },
        geoData: {
          latitude: 36.778259,
          longitude: -119.417931,
          altitude: 15.0,
          latitudeSpan: 0.0,
          longitudeSpan: 0.0,
        },
        favorited: true,
        googlePhotosOrigin: {
          mobileUpload: {
            deviceType: "ANDROID_PHONE",
          },
        },
      };

      mockFileSystem.readAsStringAsync = vi
        .fn()
        .mockResolvedValue(JSON.stringify(mockMetadata));

      const result = await googleTakeoutProcessor.processTakeoutArchive();

      expect(mockExify.Exify.write).toHaveBeenCalledWith(
        expect.stringContaining("IMG_001.jpg"),
        expect.objectContaining({
          DateTimeOriginal: expect.stringMatching(
            /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/,
          ),
          GPSLatitude: 36.778259,
          GPSLongitude: -119.417931,
          GPSAltitude: 15.0,
          ImageDescription: "Beach sunset with family",
          Make: "ANDROID_PHONE",
        }),
      );
    });

    it("should handle missing metadata gracefully", async () => {
      const mockFile = {
        uri: "/cache/takeout.zip",
        name: "takeout.zip",
      };

      mockDocumentPicker.getDocumentAsync = vi.fn().mockResolvedValue({
        canceled: false,
        assets: [mockFile],
      });

      mockFileSystem.readDirectoryAsync = vi
        .fn()
        .mockResolvedValueOnce(["Photos/"])
        .mockResolvedValueOnce(["IMG_001.jpg"]); // No metadata file

      const result = await googleTakeoutProcessor.processTakeoutArchive();

      expect(mockExify.Exify.write).not.toHaveBeenCalled();
      expect(mockStorage.addPhoto).toHaveBeenCalled();
    });
  });

  describe("Progress Tracking", () => {
    it("should report progress during migration", async () => {
      const mockFile = {
        uri: "/cache/takeout.zip",
        name: "takeout.zip",
      };

      mockDocumentPicker.getDocumentAsync = vi.fn().mockResolvedValue({
        canceled: false,
        assets: [mockFile],
      });

      const progressUpdates: MigrationProgress[] = [];
      const progressCallback = vi.fn().mockImplementation((progress) => {
        progressUpdates.push(progress);
      });

      mockFileSystem.readDirectoryAsync = vi
        .fn()
        .mockResolvedValueOnce(["Photos/"])
        .mockResolvedValueOnce(["IMG_001.jpg", "IMG_001.jpg.json"]);

      await googleTakeoutProcessor.processTakeoutArchive(progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(5); // Select, Extract, Scan, Process, Cleanup
      expect(progressUpdates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            currentStep: expect.any(String),
            processedFiles: expect.any(Number),
            totalFiles: expect.any(Number),
            percentage: expect.any(Number),
          }),
        ]),
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle file system errors during photo processing", async () => {
      const mockFile = {
        uri: "/cache/takeout.zip",
        name: "takeout.zip",
      };

      mockDocumentPicker.getDocumentAsync = vi.fn().mockResolvedValue({
        canceled: false,
        assets: [mockFile],
      });

      mockFileSystem.readDirectoryAsync = vi
        .fn()
        .mockResolvedValueOnce(["Photos/"])
        .mockResolvedValueOnce(["IMG_001.jpg", "IMG_001.jpg.json"]);

      // Mock file copy error
      mockFileSystem.copyAsync = vi
        .fn()
        .mockRejectedValue(new Error("Disk full"));

      const result = await googleTakeoutProcessor.processTakeoutArchive();

      expect(result.success).toBe(true); // Partial success
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Failed to process");
      expect(result.skippedFiles).toHaveLength(1);
    });

    it("should handle EXIF writing errors gracefully", async () => {
      const mockFile = {
        uri: "/cache/takeout.zip",
        name: "takeout.zip",
      };

      mockDocumentPicker.getDocumentAsync = vi.fn().mockResolvedValue({
        canceled: false,
        assets: [mockFile],
      });

      mockFileSystem.readDirectoryAsync = vi
        .fn()
        .mockResolvedValueOnce(["Photos/"])
        .mockResolvedValueOnce(["IMG_001.jpg", "IMG_001.jpg.json"]);

      const mockMetadata: GoogleTakeoutMetadata = {
        title: "IMG_001.jpg",
        photoTakenTime: {
          timestamp: "1692113136",
          formatted: "Aug 15, 2023, 2:25:36 PM UTC",
        },
      };

      mockFileSystem.readAsStringAsync = vi
        .fn()
        .mockResolvedValue(JSON.stringify(mockMetadata));
      mockExify.Exify.write = vi
        .fn()
        .mockRejectedValue(new Error("EXIF write failed"));

      const result = await googleTakeoutProcessor.processTakeoutArchive();

      // Should still succeed even if EXIF restoration fails
      expect(result.success).toBe(true);
      expect(result.importedPhotos).toBe(1);
    });
  });

  describe("Cancellation", () => {
    it("should cancel migration process", async () => {
      const mockFile = {
        uri: "/cache/takeout.zip",
        name: "takeout.zip",
      };

      mockDocumentPicker.getDocumentAsync = vi.fn().mockResolvedValue({
        canceled: false,
        assets: [mockFile],
      });

      // Simulate cancellation during processing
      let resolveProcessing: (value: any) => void;
      const processingPromise = new Promise((resolve) => {
        resolveProcessing = resolve;
      });

      mockFileSystem.readDirectoryAsync = vi
        .fn()
        .mockResolvedValueOnce(["Photos/"])
        .mockImplementationOnce(() => {
          // Cancel after directory listing
          setTimeout(() => {
            googleTakeoutProcessor.cancel();
            resolveProcessing(undefined);
          }, 10);
          return Promise.resolve(["IMG_001.jpg", "IMG_001.jpg.json"]);
        });

      const result = await googleTakeoutProcessor.processTakeoutArchive();

      expect(result.importedPhotos).toBe(0);
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe("Cleanup", () => {
    it("should cleanup temporary files after successful migration", async () => {
      const mockFile = {
        uri: "/cache/takeout.zip",
        name: "takeout.zip",
      };

      mockDocumentPicker.getDocumentAsync = vi.fn().mockResolvedValue({
        canceled: false,
        assets: [mockFile],
      });

      mockFileSystem.readDirectoryAsync = vi
        .fn()
        .mockResolvedValueOnce(["Photos/"])
        .mockResolvedValueOnce(["IMG_001.jpg", "IMG_001.jpg.json"]);

      await googleTakeoutProcessor.processTakeoutArchive();

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining("takeout_extract_"),
        { idempotent: true },
      );
    });

    it("should cleanup even if cleanup fails", async () => {
      const mockFile = {
        uri: "/cache/takeout.zip",
        name: "takeout.zip",
      };

      mockDocumentPicker.getDocumentAsync = vi.fn().mockResolvedValue({
        canceled: false,
        assets: [mockFile],
      });

      mockFileSystem.readDirectoryAsync = vi
        .fn()
        .mockResolvedValueOnce(["Photos/"])
        .mockResolvedValueOnce(["IMG_001.jpg", "IMG_001.jpg.json"]);

      mockFileSystem.deleteAsync = vi
        .fn()
        .mockRejectedValue(new Error("Permission denied"));

      const result = await googleTakeoutProcessor.processTakeoutArchive();

      // Should still succeed even if cleanup fails
      expect(result.success).toBe(true);
      expect(result.importedPhotos).toBe(1);
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete migration workflow", async () => {
      const mockFile = {
        uri: "/cache/takeout.zip",
        name: "takeout.zip",
      };

      mockDocumentPicker.getDocumentAsync = vi.fn().mockResolvedValue({
        canceled: false,
        assets: [mockFile],
      });

      // Mock complete directory structure
      mockFileSystem.readDirectoryAsync = vi
        .fn()
        .mockResolvedValueOnce(["Photos From 2023/", "Videos/"]) // Root
        .mockResolvedValueOnce([
          "IMG_001.jpg",
          "IMG_001.jpg.json",
          "IMG_002.jpg",
        ]) // Photos 2023
        .mockResolvedValueOnce(["VID_001.mp4"]); // Videos

      const mockMetadata: GoogleTakeoutMetadata = {
        title: "IMG_001.jpg",
        description: "Family vacation photo",
        photoTakenTime: {
          timestamp: "1692113136",
          formatted: "Aug 15, 2023, 2:25:36 PM UTC",
        },
        geoData: {
          latitude: 36.778259,
          longitude: -119.417931,
          altitude: 15.0,
          latitudeSpan: 0.0,
          longitudeSpan: 0.0,
        },
        favorited: true,
        people: [{ name: "John Doe" }, { name: "Jane Doe" }],
      };

      mockFileSystem.readAsStringAsync = vi
        .fn()
        .mockResolvedValue(JSON.stringify(mockMetadata));

      const result = await googleTakeoutProcessor.processTakeoutArchive();

      expect(result.success).toBe(true);
      expect(result.importedPhotos).toBe(3); // 2 photos + 1 video
      expect(result.errors).toHaveLength(0);
      expect(mockStorage.addPhoto).toHaveBeenCalledTimes(3);
      expect(mockExify.Exify.write).toHaveBeenCalledTimes(2); // Only for files with metadata
    });
  });
});
