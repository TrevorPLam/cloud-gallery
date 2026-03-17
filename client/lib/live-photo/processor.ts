// AI-META-BEGIN
// AI-META: Live Photo format detection and processing service
// OWNERSHIP: client/lib/live-photo (Live Photo processing)
// ENTRYPOINTS: Imported by LivePhotoViewer and photo upload pipeline
// DEPENDENCIES: ExifReader, expo-file-system, expo-image-manipulator
// DANGER: File system operations and binary data parsing; handle errors gracefully
// CHANGE-SAFETY: Safe to add new formats; risky to change existing detection logic
// TESTS: Test with various Live Photo formats, verify metadata extraction accuracy
// AI-META-END

import * as ExifReader from 'exifreader';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

export interface LivePhotoMetadata {
  isLivePhoto: boolean;
  format: 'apple' | 'android' | null;
  assetIdentifier?: string;
  presentationTimestampUs?: number;
  videoDuration?: number;
  videoOffset?: number;
  containerItems?: ContainerItem[];
}

export interface ContainerItem {
  mime: string;
  length: number;
  semantic: string;
}

export interface ProcessedLivePhoto {
  stillImageUri: string;
  videoUri: string;
  metadata: LivePhotoMetadata;
}

/**
 * Live Photo Processor
 * 
 * Handles detection and processing of Apple Live Photos and Android Motion Photos.
 * Uses XMP metadata parsing to identify Live Photo formats and extract motion video.
 */
export class LivePhotoProcessor {
  /**
   * Detect if a file is a Live Photo by analyzing XMP metadata
   */
  static async detectLivePhoto(fileUri: string): Promise<LivePhotoMetadata> {
    try {
      // Read file metadata using ExifReader
      const tags = await ExifReader.load(fileUri);
      
      return this.parseXmpMetadata(tags);
    } catch (error) {
      console.warn('Failed to read metadata for Live Photo detection:', error);
      return { isLivePhoto: false, format: null };
    }
  }

  /**
   * Parse XMP metadata to determine Live Photo format and extract relevant data
   */
  private static parseXmpMetadata(tags: any): LivePhotoMetadata {
    const xmpTags = tags.xmp?.['?xml'] || {};
    
    // Check for Android Motion Photo format
    const cameraMotionPhoto = this.getXmpValue(xmpTags, 'Camera:MotionPhoto');
    const cameraMotionPhotoVersion = this.getXmpValue(xmpTags, 'Camera:MotionPhotoVersion');
    const cameraPresentationTimestamp = this.getXmpValue(xmpTags, 'Camera:MotionPhotoPresentationTimestampUs');
    
    if (cameraMotionPhoto === '1' && cameraMotionPhotoVersion === '1') {
      // Android Motion Photo detected
      const containerItems = this.parseContainerMetadata(xmpTags);
      const videoItem = containerItems.find(item => item.mime?.startsWith('video/'));
      
      return {
        isLivePhoto: true,
        format: 'android',
        presentationTimestampUs: cameraPresentationTimestamp ? parseInt(cameraPresentationTimestamp) : undefined,
        videoDuration: videoItem ? this.estimateVideoDuration(videoItem.length) : undefined,
        containerItems,
      };
    }
    
    // Check for Apple Live Photo format
    const appleMakerNote = this.getXmpValue(tags, 'MakerApple');
    if (appleMakerNote) {
      const assetIdentifier = this.extractAppleAssetIdentifier(appleMakerNote);
      if (assetIdentifier) {
        return {
          isLivePhoto: true,
          format: 'apple',
          assetIdentifier,
        };
      }
    }
    
    return { isLivePhoto: false, format: null };
  }

  /**
   * Extract motion video from Motion Photo file (Android format)
   */
  static async extractMotionVideo(fileUri: string, metadata: LivePhotoMetadata): Promise<string | null> {
    if (!metadata.isLivePhoto || metadata.format !== 'android') {
      return null;
    }

    try {
      // Read the file as binary data
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      // For Android Motion Photos, the video is appended to the image
      // We need to extract it based on container metadata
      const videoData = await this.extractVideoFromContainer(fileUri, metadata);
      
      if (videoData) {
        // Save extracted video to temporary file
        const videoUri = `${FileSystem.cacheDirectory}live_video_${Date.now()}.mp4`;
        await FileSystem.writeAsStringAsync(videoUri, videoData, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        return videoUri;
      }
    } catch (error) {
      console.error('Failed to extract motion video:', error);
    }

    return null;
  }

  /**
   * Process a Live Photo file and extract still image and video components
   */
  static async processLivePhoto(fileUri: string): Promise<ProcessedLivePhoto | null> {
    const metadata = await this.detectLivePhoto(fileUri);
    
    if (!metadata.isLivePhoto) {
      return null;
    }

    try {
      let stillImageUri = fileUri;
      let videoUri: string | null = null;

      if (metadata.format === 'android') {
        // For Android Motion Photos, extract video component
        videoUri = await this.extractMotionVideo(fileUri, metadata);
      } else if (metadata.format === 'apple') {
        // For Apple Live Photos, look for companion video file
        videoUri = await this.findAppleLiveVideo(fileUri, metadata);
      }

      if (!videoUri) {
        throw new Error('Could not extract or find motion video');
      }

      return {
        stillImageUri,
        videoUri,
        metadata,
      };
    } catch (error) {
      console.error('Failed to process Live Photo:', error);
      return null;
    }
  }

  /**
   * Find companion video file for Apple Live Photos
   */
  private static async findAppleLivePhoto(imageUri: string, metadata: LivePhotoMetadata): Promise<string | null> {
    if (!metadata.assetIdentifier) {
      return null;
    }

    try {
      // Apple Live Photos are stored as separate files with matching asset identifiers
      // Look for .MOV file with same base name and identifier
      const imageInfo = await FileSystem.getInfoAsync(imageUri);
      const dirUri = imageUri.substring(0, imageUri.lastIndexOf('/'));
      const baseName = imageUri.substring(imageUri.lastIndexOf('/') + 1, imageUri.lastIndexOf('.'));
      
      // Try common Apple Live Photo naming patterns
      const possibleVideoNames = [
        `${baseName}.MOV`,
        `${baseName}.mov`,
        `${baseName}_live.MOV`,
        `${baseName}_live.mov`,
      ];

      for (const videoName of possibleVideoNames) {
        const videoUri = `${dirUri}/${videoName}`;
        const videoInfo = await FileSystem.getInfoAsync(videoUri);
        
        if (videoInfo.exists) {
          // Verify this is the correct video by checking metadata
          const videoMetadata = await this.detectLivePhoto(videoUri);
          if (videoMetadata.assetIdentifier === metadata.assetIdentifier) {
            return videoUri;
          }
        }
      }
    } catch (error) {
      console.error('Failed to find Apple Live Photo video:', error);
    }

    return null;
  }

  /**
   * Extract video data from Android Motion Photo container
   */
  private static async extractVideoFromContainer(fileUri: string, metadata: LivePhotoMetadata): Promise<string | null> {
    if (!metadata.containerItems) {
      return null;
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      const fileContent = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Find video item in container
      const videoItem = metadata.containerItems.find(item => item.mime?.startsWith('video/'));
      if (!videoItem) {
        return null;
      }

      // Calculate video offset (after primary image)
      let offset = 0;
      for (const item of metadata.containerItems) {
        if (item === videoItem) break;
        offset += item.length;
      }

      // Extract video data
      const binaryData = this.base64ToUint8Array(fileContent);
      const videoData = binaryData.slice(offset, offset + videoItem.length);
      
      return this.uint8ArrayToBase64(videoData);
    } catch (error) {
      console.error('Failed to extract video from container:', error);
      return null;
    }
  }

  /**
   * Parse container metadata from XMP
   */
  private static parseContainerMetadata(xmpTags: any): ContainerItem[] {
    const directory = this.getXmpValue(xmpTags, 'Container:Directory');
    if (!directory) {
      return [];
    }

    try {
      // Parse container directory structure
      const items: ContainerItem[] = [];
      const parsed = JSON.parse(directory);
      
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          items.push({
            mime: item.Item?.Mime,
            length: item.Item?.Length || 0,
            semantic: item.Item?.Semantic,
          });
        }
      }
      
      return items;
    } catch (error) {
      console.error('Failed to parse container metadata:', error);
      return [];
    }
  }

  /**
   * Extract Apple asset identifier from maker note
   */
  private static extractAppleAssetIdentifier(makerNote: string): string | null {
    // Apple Live Photos use asset identifier in maker notes
    // Look for pattern with key 17 (asset identifier)
    try {
      if (typeof makerNote === 'string') {
        const match = makerNote.match(/17[:\s]+([a-f0-9]+)/i);
        return match ? match[1] : null;
      }
    } catch (error) {
      console.error('Failed to extract Apple asset identifier:', error);
    }
    return null;
  }

  /**
   * Helper to get XMP value safely
   */
  private static getXmpValue(xmpTags: any, key: string): string | null {
    const keys = key.split(':');
    let current = xmpTags;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return null;
      }
    }
    
    return typeof current === 'string' ? current : null;
  }

  /**
   * Estimate video duration based on file size
   */
  private static estimateVideoDuration(fileSizeBytes: number): number {
    // Rough estimation: ~1MB per second for typical Live Photo videos
    return Math.round(fileSizeBytes / (1024 * 1024));
  }

  /**
   * Convert base64 to Uint8Array
   */
  private static base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Convert Uint8Array to base64
   */
  private static uint8ArrayToBase64(bytes: Uint8Array): string {
    let binaryString = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    return btoa(binaryString);
  }

  /**
   * Clean up temporary files
   */
  static async cleanup(tempVideoUri?: string): Promise<void> {
    if (tempVideoUri) {
      try {
        await FileSystem.deleteAsync(tempVideoUri);
      } catch (error) {
        console.warn('Failed to cleanup temporary file:', error);
      }
    }
  }
}
