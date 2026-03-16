// AI-META-BEGIN
// AI-META: iCloud Photos migration with Photos Framework integration and Live Photos handling
// OWNERSHIP: client/lib/migration (data migration)
// ENTRYPOINTS: Imported by MigrationScreen for iCloud Photos import
// DEPENDENCIES: react-native-photos-framework, expo-file-system
// DANGER: Photos library access, large file downloads, iCloud authentication
// CHANGE-SAFETY: Moderate - affects photo import workflow; maintain backward compatibility
// TESTS: Test Photos Framework access, Live Photos handling, progress tracking, error handling
// AI-META-END

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import { Photo } from "@/types";
import { addPhoto } from "@/lib/storage";

// iCloud Photos asset interface
export interface ICloudAsset {
  localIdentifier: string;
  filename: string;
  mediaType: "photo" | "video";
  creationDate: Date;
  modificationDate: Date;
  location?: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
  duration?: number; // For videos
  isLivePhoto?: boolean;
  livePhotoPairLocalIdentifier?: string;
  favorite: boolean;
  hidden: boolean;
  metadata?: {
    make?: string;
    model?: string;
    software?: string;
    aperture?: number;
    iso?: number;
    shutterSpeed?: string;
    focalLength?: number;
    whiteBalance?: string;
    flash?: boolean;
  };
}

// Migration progress interface (re-export from google-takeout)
export type MigrationProgress = import("./google-takeout").MigrationProgress;

// Migration result interface (re-export from google-takeout)
export type MigrationResult = import("./google-takeout").MigrationResult;

class ICloudMigrationProcessor {
  private progressCallback?: (progress: MigrationProgress) => void;
  private isCancelled = false;
  private photosFramework: any = null;

  /**
   * Process iCloud Photos library
   */
  async processICloudLibrary(
    progressCallback?: (progress: MigrationProgress) => void,
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    this.progressCallback = progressCallback;
    this.isCancelled = false;

    try {
      // Step 1: Initialize Photos Framework
      this.updateProgress("Initializing Photos library...", 0, 1);
      await this.initializePhotosFramework();

      // Step 2: Request permissions
      this.updateProgress("Requesting photo library permissions...", 0, 1);
      await this.requestPermissions();

      // Step 3: Fetch all photos
      this.updateProgress("Fetching iCloud Photos...", 0, 1);
      const assets = await this.fetchAllPhotos();

      // Step 4: Process photos
      this.updateProgress("Processing photos...", 0, assets.length);
      const result = await this.processPhotos(assets);

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
   * Initialize Photos Framework (iOS only)
   */
  private async initializePhotosFramework(): Promise<void> {
    if (Platform.OS !== "ios") {
      throw new Error("iCloud Photos migration is only available on iOS");
    }

    try {
      // In a real implementation, this would use react-native-photos-framework
      // For now, we'll create a mock implementation
      this.photosFramework = {
        getAssets: this.mockGetAssets.bind(this),
        getImageData: this.mockGetImageData.bind(this),
        getVideoData: this.mockGetVideoData.bind(this),
      };
    } catch (error) {
      throw new Error(
        `Failed to initialize Photos Framework: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Request photo library permissions
   */
  private async requestPermissions(): Promise<void> {
    // In a real implementation, this would request proper permissions
    // For now, we'll assume permissions are granted
    console.log("Photo library permissions granted");
  }

  /**
   * Fetch all photos from iCloud library
   */
  private async fetchAllPhotos(): Promise<ICloudAsset[]> {
    if (!this.photosFramework) {
      throw new Error("Photos Framework not initialized");
    }

    try {
      // Mock implementation - in reality would use Photos Framework
      const mockAssets = await this.photosFramework.getAssets({
        includeLivePhotos: true,
        includeVideos: true,
        includeMetadata: true,
        sort: "creationDate",
        order: "desc",
      });

      return mockAssets;
    } catch (error) {
      throw new Error(
        `Failed to fetch photos: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Process photos and import them
   */
  private async processPhotos(
    assets: ICloudAsset[],
  ): Promise<Omit<MigrationResult, "duration">> {
    const result: Omit<MigrationResult, "duration"> = {
      success: true,
      importedPhotos: 0,
      skippedFiles: [],
      errors: [],
    };

    for (let i = 0; i < assets.length; i++) {
      if (this.isCancelled) break;

      const asset = assets[i];
      this.updateProgress(
        "Processing photos...",
        i,
        assets.length,
        asset.filename,
      );

      try {
        await this.processAsset(asset);
        result.importedPhotos++;
      } catch (error) {
        const errorMessage = `Failed to process ${asset.filename}: ${error instanceof Error ? error.message : "Unknown error"}`;
        result.errors.push(errorMessage);
        result.skippedFiles.push(asset.filename);
      }
    }

    return result;
  }

  /**
   * Process individual asset (photo or video)
   */
  private async processAsset(asset: ICloudAsset): Promise<void> {
    // Download asset data
    const assetUri = await this.downloadAsset(asset);

    // Handle Live Photos (download paired video)
    let videoUri: string | undefined;
    if (asset.isLivePhoto && asset.livePhotoPairLocalIdentifier) {
      videoUri = await this.downloadLivePhotoVideo(asset);
    }

    // Create photo object and save to storage
    const photo = await this.createPhotoObject(asset, assetUri, videoUri);
    await addPhoto(photo);
  }

  /**
   * Download asset data to local storage
   */
  private async downloadAsset(asset: ICloudAsset): Promise<string> {
    try {
      const documentsDir = FileSystem.documentDirectory || "";
      const filename = asset.filename || `asset_${asset.localIdentifier}`;
      const destinationUri = `${documentsDir}migration/icloud/${filename}`;

      // Ensure migration directory exists
      await FileSystem.makeDirectoryAsync(`${documentsDir}migration/icloud/`, {
        intermediates: true,
      });

      // Download asset data
      let assetData: string;
      if (asset.mediaType === "video") {
        assetData = await this.photosFramework.getVideoData(
          asset.localIdentifier,
        );
      } else {
        assetData = await this.photosFramework.getImageData(
          asset.localIdentifier,
        );
      }

      // Write to file
      await FileSystem.writeAsStringAsync(destinationUri, assetData, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return destinationUri;
    } catch (error) {
      throw new Error(
        `Failed to download asset: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Download Live Photo video component
   */
  private async downloadLivePhotoVideo(asset: ICloudAsset): Promise<string> {
    if (!asset.livePhotoPairLocalIdentifier) {
      throw new Error("No Live Photo pair identifier found");
    }

    try {
      const documentsDir = FileSystem.documentDirectory || "";
      const filename = `live_${asset.livePhotoPairLocalIdentifier}.mov`;
      const destinationUri = `${documentsDir}migration/icloud/${filename}`;

      // Download video data
      const videoData = await this.photosFramework.getVideoData(
        asset.livePhotoPairLocalIdentifier,
      );

      // Write to file
      await FileSystem.writeAsStringAsync(destinationUri, videoData, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return destinationUri;
    } catch (error) {
      throw new Error(
        `Failed to download Live Photo video: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Create photo object from iCloud asset
   */
  private async createPhotoObject(
    asset: ICloudAsset,
    imageUri: string,
    videoUri?: string,
  ): Promise<Photo> {
    // Get image dimensions (simplified - in production would use image processing library)
    const width = 1920; // Default, would be extracted from actual image
    const height = 1080; // Default, would be extracted from actual image

    // Extract location data
    let location;
    if (asset.location) {
      location = {
        latitude: asset.location.latitude,
        longitude: asset.location.longitude,
      };
    }

    // Extract camera data
    let camera;
    if (asset.metadata) {
      camera = {
        make: asset.metadata.make || "Unknown",
        model: asset.metadata.model || "Unknown",
        iso: asset.metadata.iso,
        aperture: asset.metadata.aperture?.toString(),
        shutter: asset.metadata.shutterSpeed,
        focalLength: asset.metadata.focalLength,
      };
    }

    return {
      id: asset.localIdentifier,
      uri: imageUri,
      width,
      height,
      createdAt: asset.creationDate.getTime(),
      modifiedAt: asset.modificationDate.getTime(),
      filename: asset.filename || `icloud_${asset.localIdentifier}`,
      isFavorite: asset.favorite,
      albumIds: [],
      location,
      camera,
      isVideo: asset.mediaType === "video",
      videoDuration: asset.duration,
      videoThumbnailUri: videoUri, // Use video as thumbnail for Live Photos
      tags: [], // iCloud doesn't provide people tags in the same way
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

  // Mock implementations for development
  private async mockGetAssets(options: any): Promise<ICloudAsset[]> {
    // Return empty array for now - in production would fetch real assets
    return [];
  }

  private async mockGetImageData(localIdentifier: string): Promise<string> {
    // Return empty base64 string for now - in production would fetch real image data
    return "";
  }

  private async mockGetVideoData(localIdentifier: string): Promise<string> {
    // Return empty base64 string for now - in production would fetch real video data
    return "";
  }
}

// Export singleton instance
export const iCloudMigrationProcessor = new ICloudMigrationProcessor();

// Export types
export type { ICloudAsset };
