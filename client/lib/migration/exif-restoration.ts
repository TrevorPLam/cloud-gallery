// AI-META-BEGIN
// AI-META: EXIF metadata restoration service with ExifTool integration for migration workflows
// OWNERSHIP: client/lib/migration (metadata processing)
// ENTRYPOINTS: Imported by migration processors for EXIF restoration
// DEPENDENCIES: @lodev09/react-native-exify, expo-file-system
// DANGER: File system operations, metadata manipulation, large file processing
// CHANGE-SAFETY: Low - internal service; affects migration quality
// TESTS: Test EXIF reading/writing, metadata mapping, error handling, validation
// AI-META-END

import * as Exify from "@lodev09/react-native-exify";
import * as FileSystem from "expo-file-system";

// EXIF tag mapping interface
export interface ExifTagMapping {
  [exifTag: string]: string | number | boolean | undefined;
}

// Standard EXIF tags for validation (kept for reference)
const STANDARD_EXIF_TAGS = [
  "DateTimeOriginal",
  "GPSLatitude",
  "GPSLongitude",
  "GPSAltitude",
  "ImageDescription",
  "Make",
  "Model",
  "Software",
  "ExifImageWidth",
  "ExifImageHeight",
  "Orientation",
  "Flash",
  "ISO",
  "ExposureTime",
  "FNumber",
  "FocalLength",
];

class ExifRestorationService {
  /**
   * Restore EXIF metadata from Google Takeout JSON
   */
  async restoreFromGoogleTakeout(
    imageUri: string,
    googleMetadata: import("./google-takeout").GoogleTakeoutMetadata,
  ): Promise<boolean> {
    try {
      const exifTags = this.mapGoogleToExif(googleMetadata);

      if (Object.keys(exifTags).length === 0) {
        console.log("No EXIF data to restore");
        return false;
      }

      // Write EXIF data
      await Exify.write(imageUri, exifTags);

      console.log("EXIF metadata restored successfully");
      return true;
    } catch (error) {
      console.error("Failed to restore EXIF metadata:", error);
      return false;
    }
  }

  /**
   * Restore EXIF metadata from iCloud asset data
   */
  async restoreFromICloudAsset(
    imageUri: string,
    iCloudAsset: import("./icloud-migration").ICloudAsset,
  ): Promise<boolean> {
    try {
      const exifTags = this.mapICloudToExif(iCloudAsset);

      if (Object.keys(exifTags).length === 0) {
        console.log("No EXIF data to restore");
        return false;
      }

      // Write EXIF data
      await Exify.write(imageUri, exifTags);

      console.log("EXIF metadata restored successfully");
      return true;
    } catch (error) {
      console.error("Failed to restore EXIF metadata:", error);
      return false;
    }
  }

  /**
   * Read existing EXIF metadata from image
   */
  async readExifMetadata(imageUri: string): Promise<Exify.ExifTags | null> {
    try {
      const tags = await Exify.read(imageUri);
      return tags;
    } catch (error) {
      console.error("Failed to read EXIF metadata:", error);
      return null;
    }
  }

  /**
   * Validate EXIF metadata integrity
   */
  async validateExifMetadata(imageUri: string): Promise<{
    isValid: boolean;
    missingTags: string[];
    errors: string[];
  }> {
    try {
      const tags = await this.readExifMetadata(imageUri);
      const result = {
        isValid: true,
        missingTags: [] as string[],
        errors: [] as string[],
      };

      if (!tags) {
        result.isValid = false;
        result.errors.push("Unable to read EXIF metadata");
        return result;
      }

      // Check for critical tags
      const criticalTags = ["DateTimeOriginal"];
      for (const tag of criticalTags) {
        if (!tags[tag as keyof Exify.ExifTags]) {
          result.missingTags.push(tag);
        }
      }

      // Validate GPS data if present
      if (tags.GPSLatitude && tags.GPSLongitude) {
        const lat = Number(tags.GPSLatitude);
        const lon = Number(tags.GPSLongitude);

        if (
          isNaN(lat) ||
          isNaN(lon) ||
          lat < -90 ||
          lat > 90 ||
          lon < -180 ||
          lon > 180
        ) {
          result.errors.push("Invalid GPS coordinates");
          result.isValid = false;
        }
      }

      // Validate date format
      if (tags.DateTimeOriginal) {
        const dateStr = String(tags.DateTimeOriginal);
        const dateRegex = /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/;
        if (!dateRegex.test(dateStr)) {
          result.errors.push("Invalid DateTimeOriginal format");
          result.isValid = false;
        }
      }

      return result;
    } catch (error) {
      return {
        isValid: false,
        missingTags: [],
        errors: [
          error instanceof Error ? error.message : "Unknown validation error",
        ],
      };
    }
  }

  /**
   * Backup existing EXIF metadata before modification
   */
  async backupExifMetadata(imageUri: string): Promise<string | null> {
    try {
      const tags = await this.readExifMetadata(imageUri);

      if (!tags) {
        return null;
      }

      // Create backup file
      const documentsDir = FileSystem.documentDirectory || "";
      const filename = `exif_backup_${Date.now()}.json`;
      const backupUri = `${documentsDir}migration/backups/${filename}`;

      // Ensure backup directory exists
      await FileSystem.makeDirectoryAsync(`${documentsDir}migration/backups/`, {
        intermediates: true,
      });

      // Write backup
      await FileSystem.writeAsStringAsync(
        backupUri,
        JSON.stringify(tags, null, 2),
      );

      console.log("EXIF metadata backed up to:", backupUri);
      return backupUri;
    } catch (error) {
      console.error("Failed to backup EXIF metadata:", error);
      return null;
    }
  }

  /**
   * Restore EXIF metadata from backup
   */
  async restoreFromBackup(
    imageUri: string,
    backupUri: string,
  ): Promise<boolean> {
    try {
      const backupContent = await FileSystem.readAsStringAsync(backupUri);
      const tags = JSON.parse(backupContent) as ExifTagMapping;

      await Exify.write(imageUri, tags);

      console.log("EXIF metadata restored from backup");
      return true;
    } catch (error) {
      console.error("Failed to restore EXIF from backup:", error);
      return false;
    }
  }

  /**
   * Map Google Takeout metadata to EXIF tags
   */
  private mapGoogleToExif(
    googleMetadata: import("./google-takeout").GoogleTakeoutMetadata,
  ): ExifTagMapping {
    const exifTags: ExifTagMapping = {};

    // Map date/time
    if (googleMetadata.photoTakenTime?.timestamp) {
      const timestamp = parseInt(googleMetadata.photoTakenTime.timestamp, 10);
      const date = new Date(timestamp * 1000);
      exifTags.DateTimeOriginal = this.formatExifDate(date);
    }

    // Map GPS data
    if (googleMetadata.geoData?.latitude && googleMetadata.geoData?.longitude) {
      exifTags.GPSLatitude = googleMetadata.geoData.latitude;
      exifTags.GPSLongitude = googleMetadata.geoData.longitude;

      if (googleMetadata.geoData.altitude) {
        exifTags.GPSAltitude = googleMetadata.geoData.altitude;
      }
    }

    // Map description
    if (googleMetadata.description) {
      exifTags.ImageDescription = googleMetadata.description;
    }

    // Map title
    if (googleMetadata.title) {
      exifTags.DocumentName = googleMetadata.title;
    }

    // Map device info
    if (googleMetadata.googlePhotosOrigin?.mobileUpload?.deviceType) {
      exifTags.Make = googleMetadata.googlePhotosOrigin.mobileUpload.deviceType;
    }

    return exifTags;
  }

  /**
   * Map iCloud asset metadata to EXIF tags
   */
  private mapICloudToExif(
    iCloudAsset: import("./icloud-migration").ICloudAsset,
  ): ExifTagMapping {
    const exifTags: ExifTagMapping = {};

    // Map date/time
    exifTags.DateTimeOriginal = this.formatExifDate(iCloudAsset.creationDate);
    exifTags.DateTime = this.formatExifDate(iCloudAsset.modificationDate);

    // Map GPS data
    if (iCloudAsset.location) {
      exifTags.GPSLatitude = iCloudAsset.location.latitude;
      exifTags.GPSLongitude = iCloudAsset.location.longitude;

      if (iCloudAsset.location.altitude) {
        exifTags.GPSAltitude = iCloudAsset.location.altitude;
      }
    }

    // Map camera metadata
    if (iCloudAsset.metadata) {
      if (iCloudAsset.metadata.make) {
        exifTags.Make = iCloudAsset.metadata.make;
      }
      if (iCloudAsset.metadata.model) {
        exifTags.Model = iCloudAsset.metadata.model;
      }
      if (iCloudAsset.metadata.software) {
        exifTags.Software = iCloudAsset.metadata.software;
      }
      if (iCloudAsset.metadata.aperture) {
        exifTags.FNumber = iCloudAsset.metadata.aperture;
      }
      if (iCloudAsset.metadata.iso) {
        exifTags.ISO = iCloudAsset.metadata.iso;
      }
      if (iCloudAsset.metadata.shutterSpeed) {
        exifTags.ExposureTime = iCloudAsset.metadata.shutterSpeed;
      }
      if (iCloudAsset.metadata.focalLength) {
        exifTags.FocalLength = iCloudAsset.metadata.focalLength;
      }
      if (iCloudAsset.metadata.flash !== undefined) {
        exifTags.Flash = iCloudAsset.metadata.flash ? 1 : 0;
      }
    }

    return exifTags;
  }

  /**
   * Format date for EXIF standard (YYYY:MM:DD HH:MM:SS)
   */
  private formatExifDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Clean up old backup files
   */
  async cleanupOldBackups(
    maxAge: number = 7 * 24 * 60 * 60 * 1000,
  ): Promise<void> {
    try {
      const documentsDir = FileSystem.documentDirectory || "";
      const backupDir = `${documentsDir}migration/backups/`;

      const files = await FileSystem.readDirectoryAsync(backupDir);
      const now = Date.now();

      for (const file of files) {
        if (!file.startsWith("exif_backup_")) continue;

        const filePath = `${backupDir}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);

        if (fileInfo.exists && fileInfo.modificationTime) {
          const age = now - fileInfo.modificationTime * 1000;
          if (age > maxAge) {
            await FileSystem.deleteAsync(filePath, { idempotent: true });
            console.log("Cleaned up old backup:", file);
          }
        }
      }
    } catch (error) {
      console.error("Failed to cleanup old backups:", error);
    }
  }
}

// Export singleton instance
export const exifRestorationService = new ExifRestorationService();

// Export types and utilities
export type { ExifTagMapping };
