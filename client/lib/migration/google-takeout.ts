// AI-META-BEGIN
// AI-META: Google Takeout migration processing pipeline with ZIP extraction and metadata restoration
// OWNERSHIP: client/lib/migration (data migration)
// ENTRYPOINTS: Imported by MigrationScreen for Google Photos import
// DEPENDENCIES: expo-document-picker, react-native-zip-archive, @lodev09/react-native-exify
// DANGER: File system operations, large file processing, metadata manipulation
// CHANGE-SAFETY: Moderate - affects photo import workflow; maintain backward compatibility
// TESTS: Test ZIP extraction, JSON parsing, EXIF writing, error handling, progress tracking
// AI-META-END

import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { unzip } from "react-native-zip-archive";
import * as Exify from "@lodev09/react-native-exify";
import { Photo } from "@/types";
import { addPhoto } from "@/lib/storage";

// Google Takeout JSON metadata interface
export interface GoogleTakeoutMetadata {
  title: string;
  description?: string;
  photoTakenTime: {
    timestamp: string;
    formatted: string;
  };
  geoData?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    latitudeSpan: number;
    longitudeSpan: number;
  };
  geoDataExif?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    latitudeSpan: number;
    longitudeSpan: number;
  };
  favorited?: boolean;
  googlePhotosOrigin?: {
    mobileUpload?: {
      deviceType: string;
    };
    photosUpload?: {
      deviceFolder?: {
        deviceFolder: string;
      };
    };
  };
  people?: {
    name: string;
  }[];
}

// Migration progress interface
export interface MigrationProgress {
  currentStep: string;
  currentFile?: string;
  processedFiles: number;
  totalFiles: number;
  percentage: number;
  errors: string[];
}

// Migration result interface
export interface MigrationResult {
  success: boolean;
  importedPhotos: number;
  skippedFiles: string[];
  errors: string[];
  duration: number;
}

// File processing queue item
interface ProcessingItem {
  imagePath: string;
  metadataPath?: string;
  metadata?: GoogleTakeoutMetadata;
}

class GoogleTakeoutProcessor {
  private progressCallback?: (progress: MigrationProgress) => void;
  private isCancelled = false;
  private processingQueue: ProcessingItem[] = [];

  /**
   * Process Google Takeout ZIP archive
   */
  async processTakeoutArchive(
    progressCallback?: (progress: MigrationProgress) => void,
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    this.progressCallback = progressCallback;
    this.isCancelled = false;
    this.processingQueue = [];

    try {
      // Step 1: Select ZIP file
      this.updateProgress("Selecting Google Takeout archive...", 0, 1);
      const zipFile = await this.selectZipFile();

      if (!zipFile) {
        throw new Error("No file selected");
      }

      // Step 2: Extract ZIP archive
      this.updateProgress("Extracting archive...", 0, 1);
      const extractPath = await this.extractZipArchive(zipFile.uri);

      // Step 3: Scan for photos and metadata
      this.updateProgress("Scanning for photos...", 0, 1);
      await this.scanForPhotos(extractPath);

      // Step 4: Process photos with metadata
      this.updateProgress(
        "Processing photos...",
        0,
        this.processingQueue.length,
      );
      const result = await this.processPhotos();

      // Step 5: Cleanup
      await this.cleanup(extractPath);

      return {
        ...result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        importedPhotos: 0,
        skippedFiles: [],
        errors: [error instanceof Error ? error.message : "Unknown error"],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Cancel the migration process
   */
  cancel(): void {
    this.isCancelled = true;
  }

  /**
   * Select ZIP file using document picker
   */
  private async selectZipFile(): Promise<DocumentPicker.DocumentPickerAsset | null> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/zip", "application/x-zip-compressed"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      return result.assets[0];
    } catch (error) {
      throw new Error(
        `Failed to select file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Extract ZIP archive to temporary directory
   */
  private async extractZipArchive(zipUri: string): Promise<string> {
    try {
      const cacheDir = FileSystem.cacheDirectory || "";
      const extractDir = `${cacheDir}takeout_extract_${Date.now()}/`;

      // Ensure extract directory exists
      await FileSystem.makeDirectoryAsync(extractDir, { intermediates: true });

      // Extract ZIP archive
      await unzip(zipUri, extractDir);

      return extractDir;
    } catch (error) {
      throw new Error(
        `Failed to extract archive: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Scan extracted directory for photos and metadata files
   */
  private async scanForPhotos(extractPath: string): Promise<void> {
    try {
      const files = await FileSystem.readDirectoryAsync(extractPath);
      const photoExtensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".heic",
        ".mov",
        ".mp4",
      ];

      for (const file of files) {
        if (this.isCancelled) break;

        const filePath = `${extractPath}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);

        if (fileInfo.isDirectory) {
          // Recursively scan subdirectories
          await this.scanForPhotos(`${filePath}/`);
        } else if (
          photoExtensions.some((ext) => file.toLowerCase().endsWith(ext))
        ) {
          // Found a photo/video file
          const item: ProcessingItem = { imagePath: filePath };

          // Look for corresponding metadata file
          const metadataFile = await this.findMetadataFile(extractPath, file);
          if (metadataFile) {
            item.metadataPath = metadataFile.path;
            item.metadata = metadataFile.metadata;
          }

          this.processingQueue.push(item);
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to scan for photos: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Find metadata file for a given photo
   */
  private async findMetadataFile(
    extractPath: string,
    photoFilename: string,
  ): Promise<{ path: string; metadata: GoogleTakeoutMetadata } | null> {
    const baseName = photoFilename.replace(/\.[^/.]+$/, "");

    // Try different metadata file naming patterns
    const metadataPatterns = [
      `${baseName}.json`,
      `${baseName}.supplemental-metadata.json`,
      // Handle truncated filenames (Google truncates at 46 chars)
      ...this.generateTruncatedPatterns(baseName),
    ];

    for (const pattern of metadataPatterns) {
      try {
        const metadataPath = `${extractPath}${pattern}`;
        const fileInfo = await FileSystem.getInfoAsync(metadataPath);

        if (fileInfo.exists && !fileInfo.isDirectory) {
          const content = await FileSystem.readAsStringAsync(metadataPath);
          const metadata = JSON.parse(content) as GoogleTakeoutMetadata;
          return { path: metadataPath, metadata };
        }
      } catch {
        // Continue to next pattern
      }
    }

    return null;
  }

  /**
   * Generate truncated filename patterns for Google Takeout metadata files
   */
  private generateTruncatedPatterns(baseName: string): string[] {
    const patterns: string[] = [];
    const suffix = ".supplemental-metadata.json";

    // Generate patterns with various truncation points
    for (let i = baseName.length; i > Math.max(0, baseName.length - 20); i--) {
      const truncated = baseName.substring(0, i);
      patterns.push(`${truncated}${suffix}`);
    }

    return patterns;
  }

  /**
   * Process photos and import them with metadata
   */
  private async processPhotos(): Promise<Omit<MigrationResult, "duration">> {
    const result: Omit<MigrationResult, "duration"> = {
      success: true,
      importedPhotos: 0,
      skippedFiles: [],
      errors: [],
    };

    for (let i = 0; i < this.processingQueue.length; i++) {
      if (this.isCancelled) break;

      const item = this.processingQueue[i];
      this.updateProgress(
        "Processing photos...",
        i,
        this.processingQueue.length,
        item.imagePath.split("/").pop(),
      );

      try {
        await this.processPhoto(item);
        result.importedPhotos++;
      } catch (error) {
        const errorMessage = `Failed to process ${item.imagePath}: ${error instanceof Error ? error.message : "Unknown error"}`;
        result.errors.push(errorMessage);
        result.skippedFiles.push(item.imagePath);
      }
    }

    return result;
  }

  /**
   * Process individual photo with metadata restoration
   */
  private async processPhoto(item: ProcessingItem): Promise<void> {
    // Copy photo to app's document directory
    const photoUri = await this.copyPhotoToDocuments(item.imagePath);

    // Restore EXIF metadata if available
    if (item.metadata) {
      await this.restoreExifMetadata(photoUri, item.metadata);
    }

    // Create photo object and save to storage
    const photo = await this.createPhotoObject(photoUri, item.metadata);
    await addPhoto(photo);
  }

  /**
   * Copy photo to app's document directory
   */
  private async copyPhotoToDocuments(imagePath: string): Promise<string> {
    const documentsDir = FileSystem.documentDirectory || "";
    const filename = imagePath.split("/").pop() || `photo_${Date.now()}`;
    const destinationUri = `${documentsDir}migration/${filename}`;

    // Ensure migration directory exists
    await FileSystem.makeDirectoryAsync(`${documentsDir}migration/`, {
      intermediates: true,
    });

    // Copy file
    await FileSystem.copyAsync({
      from: imagePath,
      to: destinationUri,
    });

    return destinationUri;
  }

  /**
   * Restore EXIF metadata from Google Takeout JSON
   */
  private async restoreExifMetadata(
    photoUri: string,
    metadata: GoogleTakeoutMetadata,
  ): Promise<void> {
    try {
      const exifTags: any = {};

      // Convert timestamp to EXIF date format
      if (metadata.photoTakenTime?.timestamp) {
        const timestamp = parseInt(metadata.photoTakenTime.timestamp, 10);
        const date = new Date(timestamp * 1000);
        exifTags.DateTimeOriginal = date
          .toISOString()
          .replace(/T/, " ")
          .replace(/\..+/, "");
      }

      // Add GPS data
      if (metadata.geoData?.latitude && metadata.geoData?.longitude) {
        exifTags.GPSLatitude = metadata.geoData.latitude;
        exifTags.GPSLongitude = metadata.geoData.longitude;
        exifTags.GPSAltitude = metadata.geoData.altitude || 0;
      }

      // Add description
      if (metadata.description) {
        exifTags.ImageDescription = metadata.description;
      }

      // Add camera info
      if (metadata.googlePhotosOrigin?.mobileUpload?.deviceType) {
        exifTags.Make = metadata.googlePhotosOrigin.mobileUpload.deviceType;
      }

      // Write EXIF data
      if (Object.keys(exifTags).length > 0) {
        await Exify.write(photoUri, exifTags);
      }
    } catch (error) {
      // Don't fail the entire process if EXIF restoration fails
      console.warn("Failed to restore EXIF metadata:", error);
    }
  }

  /**
   * Create photo object from file and metadata
   */
  private async createPhotoObject(
    photoUri: string,
    metadata?: GoogleTakeoutMetadata,
  ): Promise<Photo> {
    const filename = photoUri.split("/").pop() || `photo_${Date.now()}`;
    const fileInfo = await FileSystem.getInfoAsync(photoUri);

    // Get image dimensions (simplified - in production would use image processing library)
    const width = 1920; // Default, would be extracted from actual image
    const height = 1080; // Default, would be extracted from actual image

    // Extract creation time from metadata or file info
    let createdAt = Date.now();
    if (metadata?.photoTakenTime?.timestamp) {
      createdAt = parseInt(metadata.photoTakenTime.timestamp, 10) * 1000;
    } else if (fileInfo.modificationTime) {
      createdAt = new Date(fileInfo.modificationTime * 1000).getTime();
    }

    // Extract location data
    let location;
    if (metadata?.geoData?.latitude && metadata?.geoData?.longitude) {
      location = {
        latitude: metadata.geoData.latitude,
        longitude: metadata.geoData.longitude,
      };
    }

    // Extract camera data
    let camera;
    if (metadata?.googlePhotosOrigin?.mobileUpload?.deviceType) {
      camera = {
        make: metadata.googlePhotosOrigin.mobileUpload.deviceType,
        model: "Unknown",
      };
    }

    return {
      id: Date.now().toString(),
      uri: photoUri,
      width,
      height,
      createdAt,
      modifiedAt: Date.now(),
      filename,
      isFavorite: metadata?.favorited || false,
      albumIds: [],
      location,
      camera,
      tags: metadata?.people?.map((p) => p.name) || [],
      notes: metadata?.description,
    };
  }

  /**
   * Update progress callback
   */
  private updateProgress(
    currentStep: string,
    processedFiles: number,
    totalFiles: number,
    currentFile?: string,
  ): void {
    if (this.progressCallback) {
      const percentage =
        totalFiles > 0 ? (processedFiles / totalFiles) * 100 : 0;
      this.progressCallback({
        currentStep,
        currentFile,
        processedFiles,
        totalFiles,
        percentage,
        errors: [],
      });
    }
  }

  /**
   * Cleanup temporary files
   */
  private async cleanup(extractPath: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(extractPath, { idempotent: true });
    } catch (error) {
      console.warn("Failed to cleanup temporary files:", error);
    }
  }
}

// Export singleton instance
export const googleTakeoutProcessor = new GoogleTakeoutProcessor();

// Export types and utilities
export type { GoogleTakeoutMetadata, MigrationProgress, MigrationResult };
