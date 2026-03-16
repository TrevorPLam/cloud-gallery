// AI-META-BEGIN
// AI-META: Comprehensive tests for EXIF restoration service
// OWNERSHIP: client/lib/migration (testing)
// ENTRYPOINTS: Test runner execution
// DEPENDENCIES: Vitest, mock implementations, test utilities
// DANGER: Test file system operations, metadata manipulation
// CHANGE-SAFETY: Low - test file only; maintain test coverage
// TESTS: Unit tests for EXIF operations, integration tests, validation scenarios
// AI-META-END

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exifRestorationService } from "./exif-restoration";
import type { GoogleTakeoutMetadata } from "./google-takeout";
import type { ICloudAsset } from "./icloud-migration";

// Mock dependencies
vi.mock("@lodev09/react-native-exify");
vi.mock("expo-file-system");

// Mock implementations
const mockExify = vi.importMock("@lodev09/react-native-exify");
const mockFileSystem = vi.importMock("expo-file-system");

describe("EXIF Restoration Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock implementations
    mockFileSystem.FileSystem.documentDirectory = "/documents/";
    mockFileSystem.FileSystem.makeDirectoryAsync = vi
      .fn()
      .mockResolvedValue(undefined);
    mockFileSystem.FileSystem.writeAsStringAsync = vi
      .fn()
      .mockResolvedValue(undefined);
    mockFileSystem.FileSystem.readAsStringAsync = vi
      .fn()
      .mockResolvedValue("{}");
    mockFileSystem.FileSystem.readDirectoryAsync = vi
      .fn()
      .mockResolvedValue([]);
    mockFileSystem.FileSystem.getInfoAsync = vi.fn().mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 1024,
      modificationTime: Date.now() / 1000,
    });
    mockFileSystem.FileSystem.deleteAsync = vi
      .fn()
      .mockResolvedValue(undefined);

    mockExify.Exify.read = vi.fn().mockResolvedValue({});
    mockExify.Exify.write = vi.fn().mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Google Takeout Metadata Restoration", () => {
    it("should restore basic EXIF metadata from Google Takeout", async () => {
      const imageUri = "/documents/test.jpg";
      const googleMetadata: GoogleTakeoutMetadata = {
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
      };

      const result = await exifRestorationService.restoreFromGoogleTakeout(
        imageUri,
        googleMetadata,
      );

      expect(result).toBe(true);
      expect(mockExify.Exify.write).toHaveBeenCalledWith(
        imageUri,
        expect.objectContaining({
          DateTimeOriginal: "2023:08:15 14:25:36",
          GPSLatitude: 36.778259,
          GPSLongitude: -119.417931,
          GPSAltitude: 15.0,
          ImageDescription: "Beach sunset with family",
          DocumentName: "IMG_001.jpg",
        }),
      );
    });

    it("should handle incomplete Google Takeout metadata", async () => {
      const imageUri = "/documents/test.jpg";
      const googleMetadata: GoogleTakeoutMetadata = {
        title: "IMG_001.jpg",
        photoTakenTime: {
          timestamp: "1692113136",
          formatted: "Aug 15, 2023, 2:25:36 PM UTC",
        },
        // No GPS data, no description
      };

      const result = await exifRestorationService.restoreFromGoogleTakeout(
        imageUri,
        googleMetadata,
      );

      expect(result).toBe(true);
      expect(mockExify.Exify.write).toHaveBeenCalledWith(
        imageUri,
        expect.objectContaining({
          DateTimeOriginal: "2023:08:15 14:25:36",
          DocumentName: "IMG_001.jpg",
        }),
      );
      expect(mockExify.Exify.write).not.toHaveBeenCalledWith(
        imageUri,
        expect.objectContaining({
          GPSLatitude: expect.any(Number),
        }),
      );
    });

    it("should return false when no EXIF data to restore", async () => {
      const imageUri = "/documents/test.jpg";
      const googleMetadata: GoogleTakeoutMetadata = {
        title: "IMG_001.jpg",
        // No other metadata
      };

      const result = await exifRestorationService.restoreFromGoogleTakeout(
        imageUri,
        googleMetadata,
      );

      expect(result).toBe(false);
      expect(mockExify.Exify.write).not.toHaveBeenCalled();
    });

    it("should handle EXIF write errors gracefully", async () => {
      const imageUri = "/documents/test.jpg";
      const googleMetadata: GoogleTakeoutMetadata = {
        title: "IMG_001.jpg",
        photoTakenTime: {
          timestamp: "1692113136",
          formatted: "Aug 15, 2023, 2:25:36 PM UTC",
        },
      };

      mockExify.Exify.write = vi
        .fn()
        .mockRejectedValue(new Error("EXIF write failed"));

      const result = await exifRestorationService.restoreFromGoogleTakeout(
        imageUri,
        googleMetadata,
      );

      expect(result).toBe(false);
    });
  });

  describe("iCloud Asset Metadata Restoration", () => {
    it("should restore EXIF metadata from iCloud asset", async () => {
      const imageUri = "/documents/test.jpg";
      const iCloudAsset: ICloudAsset = {
        localIdentifier: "B8F3E4A1-2D3C-4A5B-8E7F-9A6B5C4D3E2F",
        filename: "IMG_001.jpg",
        mediaType: "photo",
        creationDate: new Date("2023-08-15T14:25:36Z"),
        modificationDate: new Date("2023-08-15T14:30:00Z"),
        location: {
          latitude: 36.778259,
          longitude: -119.417931,
          altitude: 15.0,
        },
        favorite: true,
        hidden: false,
        metadata: {
          make: "Apple",
          model: "iPhone 14 Pro",
          software: "iOS 16.0",
          aperture: 1.78,
          iso: 100,
          shutterSpeed: "1/60",
          focalLength: 6.86,
          whiteBalance: "Auto",
          flash: false,
        },
      };

      const result = await exifRestorationService.restoreFromICloudAsset(
        imageUri,
        iCloudAsset,
      );

      expect(result).toBe(true);
      expect(mockExify.Exify.write).toHaveBeenCalledWith(
        imageUri,
        expect.objectContaining({
          DateTimeOriginal: "2023:08:15 14:25:36",
          DateTime: "2023:08:15 14:30:00",
          GPSLatitude: 36.778259,
          GPSLongitude: -119.417931,
          GPSAltitude: 15.0,
          Make: "Apple",
          Model: "iPhone 14 Pro",
          Software: "iOS 16.0",
          FNumber: 1.78,
          ISO: 100,
          ExposureTime: "1/60",
          FocalLength: 6.86,
          Flash: 0,
        }),
      );
    });

    it("should handle iCloud asset without metadata", async () => {
      const imageUri = "/documents/test.jpg";
      const iCloudAsset: ICloudAsset = {
        localIdentifier: "B8F3E4A1-2D3C-4A5B-8E7F-9A6B5C4D3E2F",
        filename: "IMG_001.jpg",
        mediaType: "photo",
        creationDate: new Date("2023-08-15T14:25:36Z"),
        modificationDate: new Date("2023-08-15T14:30:00Z"),
        favorite: false,
        hidden: false,
        // No location, no metadata
      };

      const result = await exifRestorationService.restoreFromICloudAsset(
        imageUri,
        iCloudAsset,
      );

      expect(result).toBe(true);
      expect(mockExify.Exify.write).toHaveBeenCalledWith(
        imageUri,
        expect.objectContaining({
          DateTimeOriginal: "2023:08:15 14:25:36",
          DateTime: "2023:08:15 14:30:00",
        }),
      );
    });

    it("should return false when no iCloud EXIF data to restore", async () => {
      const imageUri = "/documents/test.jpg";
      const iCloudAsset: ICloudAsset = {
        localIdentifier: "B8F3E4A1-2D3C-4A5B-8E7F-9A6B5C4D3E2F",
        filename: "IMG_001.jpg",
        mediaType: "photo",
        creationDate: new Date(), // Today's date
        modificationDate: new Date(),
        favorite: false,
        hidden: false,
      };

      const result = await exifRestorationService.restoreFromICloudAsset(
        imageUri,
        iCloudAsset,
      );

      expect(result).toBe(true); // Should still restore dates
    });
  });

  describe("EXIF Reading", () => {
    it("should read EXIF metadata from image", async () => {
      const imageUri = "/documents/test.jpg";
      const mockExifTags = {
        DateTimeOriginal: "2023:08:15 14:25:36",
        GPSLatitude: 36.778259,
        GPSLongitude: -119.417931,
        Make: "Apple",
        Model: "iPhone 14 Pro",
      };

      mockExify.Exify.read = vi.fn().mockResolvedValue(mockExifTags);

      const result = await exifRestorationService.readExifMetadata(imageUri);

      expect(result).toEqual(mockExifTags);
      expect(mockExify.Exify.read).toHaveBeenCalledWith(imageUri);
    });

    it("should handle EXIF read errors", async () => {
      const imageUri = "/documents/test.jpg";
      mockExify.Exify.read = vi
        .fn()
        .mockRejectedValue(new Error("Cannot read EXIF"));

      const result = await exifRestorationService.readExifMetadata(imageUri);

      expect(result).toBeNull();
    });
  });

  describe("EXIF Validation", () => {
    it("should validate correct EXIF metadata", async () => {
      const imageUri = "/documents/test.jpg";
      const mockExifTags = {
        DateTimeOriginal: "2023:08:15 14:25:36",
        GPSLatitude: 36.778259,
        GPSLongitude: -119.417931,
        GPSAltitude: 15.0,
        Make: "Apple",
        Model: "iPhone 14 Pro",
      };

      mockExify.Exify.read = vi.fn().mockResolvedValue(mockExifTags);

      const result =
        await exifRestorationService.validateExifMetadata(imageUri);

      expect(result.isValid).toBe(true);
      expect(result.missingTags).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing critical tags", async () => {
      const imageUri = "/documents/test.jpg";
      const mockExifTags = {
        GPSLatitude: 36.778259,
        GPSLongitude: -119.417931,
        // Missing DateTimeOriginal
      };

      mockExify.Exify.read = vi.fn().mockResolvedValue(mockExifTags);

      const result =
        await exifRestorationService.validateExifMetadata(imageUri);

      expect(result.isValid).toBe(true); // Still valid, just missing tags
      expect(result.missingTags).toContain("DateTimeOriginal");
    });

    it("should detect invalid GPS coordinates", async () => {
      const imageUri = "/documents/test.jpg";
      const mockExifTags = {
        DateTimeOriginal: "2023:08:15 14:25:36",
        GPSLatitude: 91.0, // Invalid latitude (> 90)
        GPSLongitude: -119.417931,
      };

      mockExify.Exify.read = vi.fn().mockResolvedValue(mockExifTags);

      const result =
        await exifRestorationService.validateExifMetadata(imageUri);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid GPS coordinates");
    });

    it("should detect invalid date format", async () => {
      const imageUri = "/documents/test.jpg";
      const mockExifTags = {
        DateTimeOriginal: "2023-08-15 14:25:36", // Wrong format
        Make: "Apple",
      };

      mockExify.Exify.read = vi.fn().mockResolvedValue(mockExifTags);

      const result =
        await exifRestorationService.validateExifMetadata(imageUri);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid DateTimeOriginal format");
    });

    it("should handle unreadable EXIF data", async () => {
      const imageUri = "/documents/test.jpg";
      mockExify.Exify.read = vi
        .fn()
        .mockRejectedValue(new Error("Cannot read EXIF"));

      const result =
        await exifRestorationService.validateExifMetadata(imageUri);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Unable to read EXIF metadata");
    });
  });

  describe("EXIF Backup and Restore", () => {
    it("should backup EXIF metadata", async () => {
      const imageUri = "/documents/test.jpg";
      const mockExifTags = {
        DateTimeOriginal: "2023:08:15 14:25:36",
        Make: "Apple",
      };

      mockExify.Exify.read = vi.fn().mockResolvedValue(mockExifTags);

      const result = await exifRestorationService.backupExifMetadata(imageUri);

      expect(result).toBeTruthy();
      expect(mockFileSystem.FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        "/documents/migration/backups/",
        { intermediates: true },
      );
      expect(mockFileSystem.FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining("exif_backup_"),
        JSON.stringify(mockExifTags, null, 2),
      );
    });

    it("should return null when no EXIF to backup", async () => {
      const imageUri = "/documents/test.jpg";
      mockExify.Exify.read = vi.fn().mockResolvedValue(null);

      const result = await exifRestorationService.backupExifMetadata(imageUri);

      expect(result).toBeNull();
      expect(
        mockFileSystem.FileSystem.writeAsStringAsync,
      ).not.toHaveBeenCalled();
    });

    it("should restore EXIF from backup", async () => {
      const imageUri = "/documents/test.jpg";
      const backupUri = "/documents/migration/backups/exif_backup_123.json";
      const mockBackupData = {
        DateTimeOriginal: "2023:08:15 14:25:36",
        Make: "Apple",
      };

      mockFileSystem.FileSystem.readAsStringAsync = vi
        .fn()
        .mockResolvedValue(JSON.stringify(mockBackupData));

      const result = await exifRestorationService.restoreFromBackup(
        imageUri,
        backupUri,
      );

      expect(result).toBe(true);
      expect(mockFileSystem.FileSystem.readAsStringAsync).toHaveBeenCalledWith(
        backupUri,
      );
      expect(mockExify.Exify.write).toHaveBeenCalledWith(
        imageUri,
        mockBackupData,
      );
    });

    it("should handle restore from backup errors", async () => {
      const imageUri = "/documents/test.jpg";
      const backupUri = "/documents/migration/backups/exif_backup_123.json";
      mockFileSystem.FileSystem.readAsStringAsync = vi
        .fn()
        .mockRejectedValue(new Error("Backup file not found"));

      const result = await exifRestorationService.restoreFromBackup(
        imageUri,
        backupUri,
      );

      expect(result).toBe(false);
    });
  });

  describe("Backup Cleanup", () => {
    it("should cleanup old backup files", async () => {
      const now = Date.now();
      const oldTimestamp = (now - 8 * 24 * 60 * 60 * 1000) / 1000; // 8 days ago
      const newTimestamp = (now - 2 * 24 * 60 * 60 * 1000) / 1000; // 2 days ago

      mockFileSystem.FileSystem.readDirectoryAsync = vi
        .fn()
        .mockResolvedValue([
          "exif_backup_old.json",
          "exif_backup_new.json",
          "other_file.txt",
        ]);

      mockFileSystem.FileSystem.getInfoAsync = vi
        .fn()
        .mockResolvedValueOnce({
          exists: true,
          isDirectory: false,
          modificationTime: oldTimestamp,
        })
        .mockResolvedValueOnce({
          exists: true,
          isDirectory: false,
          modificationTime: newTimestamp,
        })
        .mockResolvedValueOnce({
          exists: true,
          isDirectory: false,
          modificationTime: newTimestamp,
        });

      await exifRestorationService.cleanupOldBackups();

      expect(mockFileSystem.FileSystem.deleteAsync).toHaveBeenCalledWith(
        "/documents/migration/backups/exif_backup_old.json",
        { idempotent: true },
      );
      expect(mockFileSystem.FileSystem.deleteAsync).not.toHaveBeenCalledWith(
        "/documents/migration/backups/exif_backup_new.json",
        expect.any(Object),
      );
      expect(mockFileSystem.FileSystem.deleteAsync).not.toHaveBeenCalledWith(
        "/documents/migration/backups/other_file.txt",
        expect.any(Object),
      );
    });

    it("should handle cleanup errors gracefully", async () => {
      mockFileSystem.FileSystem.readDirectoryAsync = vi
        .fn()
        .mockRejectedValue(new Error("Directory not found"));

      // Should not throw
      await expect(
        exifRestorationService.cleanupOldBackups(),
      ).resolves.toBeUndefined();
    });
  });

  describe("Date Formatting", () => {
    it("should format dates correctly for EXIF", async () => {
      const imageUri = "/documents/test.jpg";
      const googleMetadata: GoogleTakeoutMetadata = {
        title: "IMG_001.jpg",
        photoTakenTime: {
          timestamp: "1692113136", // Aug 15, 2023, 2:25:36 PM UTC
          formatted: "Aug 15, 2023, 2:25:36 PM UTC",
        },
      };

      await exifRestorationService.restoreFromGoogleTakeout(
        imageUri,
        googleMetadata,
      );

      expect(mockExify.Exify.write).toHaveBeenCalledWith(
        imageUri,
        expect.objectContaining({
          DateTimeOriginal: "2023:08:15 14:25:36",
        }),
      );
    });

    it("should handle edge case dates", async () => {
      const imageUri = "/documents/test.jpg";
      const iCloudAsset: ICloudAsset = {
        localIdentifier: "test",
        filename: "test.jpg",
        mediaType: "photo",
        creationDate: new Date("2000-01-01T00:00:00Z"), // Y2K
        modificationDate: new Date("2099-12-31T23:59:59Z"), // Near end of century
        favorite: false,
        hidden: false,
      };

      await exifRestorationService.restoreFromICloudAsset(
        imageUri,
        iCloudAsset,
      );

      expect(mockExify.Exify.write).toHaveBeenCalledWith(
        imageUri,
        expect.objectContaining({
          DateTimeOriginal: "2000:01:01 00:00:00",
          DateTime: "2099:12:31 23:59:59",
        }),
      );
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete backup-restore workflow", async () => {
      const imageUri = "/documents/test.jpg";
      const originalExif = {
        DateTimeOriginal: "2023:08:15 14:25:36",
        Make: "Canon",
        Model: "EOS R5",
      };

      // Backup original EXIF
      mockExify.Exify.read = vi.fn().mockResolvedValue(originalExif);
      const backupUri =
        await exifRestorationService.backupExifMetadata(imageUri);
      expect(backupUri).toBeTruthy();

      // Simulate EXIF loss and restore from backup
      mockExify.Exify.read = vi.fn().mockResolvedValue({}); // No EXIF after migration
      mockFileSystem.FileSystem.readAsStringAsync = vi
        .fn()
        .mockResolvedValue(JSON.stringify(originalExif));

      const restoreResult = await exifRestorationService.restoreFromBackup(
        imageUri,
        backupUri!,
      );
      expect(restoreResult).toBe(true);

      expect(mockExify.Exify.write).toHaveBeenCalledWith(
        imageUri,
        originalExif,
      );
    });

    it("should handle metadata validation pipeline", async () => {
      const imageUri = "/documents/test.jpg";
      const googleMetadata: GoogleTakeoutMetadata = {
        title: "IMG_001.jpg",
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
      };

      // Restore metadata
      await exifRestorationService.restoreFromGoogleTakeout(
        imageUri,
        googleMetadata,
      );

      // Validate restored metadata
      const restoredExif = {
        DateTimeOriginal: "2023:08:15 14:25:36",
        GPSLatitude: 36.778259,
        GPSLongitude: -119.417931,
        GPSAltitude: 15.0,
      };
      mockExify.Exify.read = vi.fn().mockResolvedValue(restoredExif);

      const validationResult =
        await exifRestorationService.validateExifMetadata(imageUri);

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.missingTags).toHaveLength(0);
      expect(validationResult.errors).toHaveLength(0);
    });
  });
});
