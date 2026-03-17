// AI-META-BEGIN
// AI-META: Server-side Live Photo detection and processing service
// OWNERSHIP: server/services (Live Photo processing)
// ENTRYPOINTS: Imported by photo-routes for Live Photo detection during upload
// DEPENDENCIES: ExifReader, Node.js fs, file system operations
// DANGER: File system operations and binary data parsing
// CHANGE-SAFETY: Safe to add new formats; risky to change detection logic
// TESTS: Test with various Live Photo formats, verify metadata extraction
// AI-META-END

import * as ExifReader from 'exifreader';
import * as fs from 'fs';
import * as path from 'path';

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
  stillImagePath: string;
  videoPath: string;
  metadata: LivePhotoMetadata;
}

/**
 * Server-side Live Photo Processor
 * 
 * Handles detection and processing of Apple Live Photos and Android Motion Photos
 * on the server during photo upload.
 */
export class LivePhotoProcessor {
  /**
   * Detect if a file is a Live Photo by analyzing XMP metadata
   */
  static async detectLivePhoto(filePath: string): Promise<LivePhotoMetadata> {
    try {
      // Read file metadata using ExifReader
      const tags = await ExifReader.load(filePath);
      
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
   * Process a Live Photo file on the server side
   */
  static async processLivePhoto(filePath: string, uploadDir: string): Promise<ProcessedLivePhoto | null> {
    const metadata = await this.detectLivePhoto(filePath);
    
    if (!metadata.isLivePhoto) {
      return null;
    }

    try {
      let stillImagePath = filePath;
      let videoPath: string | null = null;

      if (metadata.format === 'android') {
        // For Android Motion Photos, extract video component
        videoPath = await this.extractMotionVideo(filePath, uploadDir, metadata);
      } else if (metadata.format === 'apple') {
        // For Apple Live Photos, look for companion video file
        videoPath = await this.findAppleLiveVideo(filePath, metadata);
      }

      if (!videoPath) {
        throw new Error('Could not extract or find motion video');
      }

      return {
        stillImagePath,
        videoPath,
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
  private static async findAppleLivePhoto(imagePath: string, metadata: LivePhotoMetadata): Promise<string | null> {
    if (!metadata.assetIdentifier) {
      return null;
    }

    try {
      // Apple Live Photos are stored as separate files with matching asset identifiers
      const dir = path.dirname(imagePath);
      const ext = path.extname(imagePath);
      const baseName = path.basename(imagePath, ext);
      
      // Try common Apple Live Photo naming patterns
      const possibleVideoNames = [
        `${baseName}.MOV`,
        `${baseName}.mov`,
        `${baseName}_live.MOV`,
        `${baseName}_live.mov`,
      ];

      for (const videoName of possibleVideoNames) {
        const videoPath = path.join(dir, videoName);
        
        if (fs.existsSync(videoPath)) {
          // Verify this is the correct video by checking metadata
          const videoMetadata = await this.detectLivePhoto(videoPath);
          if (videoMetadata.assetIdentifier === metadata.assetIdentifier) {
            return videoPath;
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
  private static async extractMotionVideo(filePath: string, uploadDir: string, metadata: LivePhotoMetadata): Promise<string | null> {
    if (!metadata.containerItems) {
      return null;
    }

    try {
      const fileBuffer = fs.readFileSync(filePath);
      
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
      const videoData = fileBuffer.slice(offset, offset + videoItem.length);
      
      // Save extracted video to file
      const baseName = path.basename(filePath, path.extname(filePath));
      const videoPath = path.join(uploadDir, `${baseName}_motion.mp4`);
      
      fs.writeFileSync(videoPath, videoData);
      
      return videoPath;
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
   * Clean up temporary files
   */
  static async cleanup(tempVideoPath?: string): Promise<void> {
    if (tempVideoPath && fs.existsSync(tempVideoPath)) {
      try {
        fs.unlinkSync(tempVideoPath);
      } catch (error) {
        console.warn('Failed to cleanup temporary file:', error);
      }
    }
  }
}

/**
 * Detect Live Photo metadata from uploaded file
 * This function can be called during photo upload to detect Live Photos
 */
export async function detectLivePhotoFromUpload(filePath: string): Promise<{
  isLivePhoto: boolean;
  format?: 'apple' | 'android';
  metadata?: LivePhotoMetadata;
}> {
  const metadata = await LivePhotoProcessor.detectLivePhoto(filePath);
  
  return {
    isLivePhoto: metadata.isLivePhoto,
    format: metadata.format || undefined,
    metadata: metadata.isLivePhoto ? metadata : undefined,
  };
}
