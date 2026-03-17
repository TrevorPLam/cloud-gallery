// AI-META-BEGIN
// AI-META: Live Photo storage optimization with compression and caching strategies
// OWNERSHIP: client/lib/live-photo (Live Photo storage)
// ENTRYPOINTS: Imported by LivePhotoProcessor and photo upload pipeline
// DEPENDENCIES: expo-file-system, expo-image-manipulator, AsyncStorage
// DANGER: File system operations and storage management; handle disk space carefully
// CHANGE-SAFETY: Safe to add new compression strategies; risky to change cache logic
// TESTS: Test compression ratios, cache eviction, storage cleanup
// AI-META-END

import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LivePhotoStorageConfig {
  maxCacheSizeMB: number;
  compressionQuality: number;
  enableVideoCompression: boolean;
  cacheEvictionPolicy: 'lru' | 'fifo' | 'size';
}

export interface LivePhotoCacheEntry {
  id: string;
  stillUri: string;
  videoUri: string;
  compressedVideoUri?: string;
  createdAt: number;
  lastAccessed: number;
  sizeBytes: number;
  format: 'apple' | 'android';
}

export interface StorageStats {
  usedBytes: number;
  availableBytes: number;
  cachedItems: number;
  totalSavedBytes: number;
}

/**
 * Live Photo Storage Manager
 * 
 * Handles optimized storage of Live Photos with compression,
 * caching, and intelligent storage management.
 */
export class LivePhotoStorage {
  private static readonly CACHE_KEY = 'live_photo_cache';
  private static readonly DEFAULT_CONFIG: LivePhotoStorageConfig = {
    maxCacheSizeMB: 500,
    compressionQuality: 0.8,
    enableVideoCompression: true,
    cacheEvictionPolicy: 'lru',
  };

  private config: LivePhotoStorageConfig;
  private cache: Map<string, LivePhotoCacheEntry> = new Map();

  constructor(config: Partial<LivePhotoStorageConfig> = {}) {
    this.config = { ...LivePhotoStorage.DEFAULT_CONFIG, ...config };
    this.loadCache();
  }

  /**
   * Store a Live Photo with optimization
   */
  async storeLivePhoto(
    photoId: string,
    stillUri: string,
    videoUri: string,
    format: 'apple' | 'android'
  ): Promise<string[]> {
    try {
      const startTime = Date.now();
      
      // Optimize still image
      const optimizedStillUri = await this.optimizeStillImage(stillUri, photoId);
      
      // Optimize motion video
      const optimizedVideoUri = await this.optimizeMotionVideo(videoUri, photoId, format);
      
      // Calculate total size
      const stillInfo = await FileSystem.getInfoAsync(optimizedStillUri);
      const videoInfo = await FileSystem.getInfoAsync(optimizedVideoUri);
      const totalSize = (stillInfo.size || 0) + (videoInfo.size || 0);
      
      // Create cache entry
      const cacheEntry: LivePhotoCacheEntry = {
        id: photoId,
        stillUri: optimizedStillUri,
        videoUri: optimizedVideoUri,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        sizeBytes: totalSize,
        format,
      };

      // Add to cache
      this.cache.set(photoId, cacheEntry);
      await this.saveCache();
      
      // Ensure cache doesn't exceed limits
      await this.enforceCacheLimits();
      
      console.log(`Live Photo stored in ${Date.now() - startTime}ms, size: ${totalSize} bytes`);
      
      return [optimizedStillUri, optimizedVideoUri];
    } catch (error) {
      console.error('Failed to store Live Photo:', error);
      throw error;
    }
  }

  /**
   * Retrieve cached Live Photo
   */
  async getLivePhoto(photoId: string): Promise<LivePhotoCacheEntry | null> {
    const entry = this.cache.get(photoId);
    
    if (!entry) {
      return null;
    }

    // Update last accessed time
    entry.lastAccessed = Date.now();
    await this.saveCache();
    
    // Verify files still exist
    const stillExists = await this.fileExists(entry.stillUri);
    const videoExists = await this.fileExists(entry.videoUri);
    
    if (!stillExists || !videoExists) {
      // Remove invalid entry
      this.cache.delete(photoId);
      await this.saveCache();
      return null;
    }

    return entry;
  }

  /**
   * Remove Live Photo from cache
   */
  async removeLivePhoto(photoId: string): Promise<void> {
    const entry = this.cache.get(photoId);
    
    if (!entry) {
      return;
    }

    // Delete files
    await this.safeDeleteFile(entry.stillUri);
    await this.safeDeleteFile(entry.videoUri);
    
    if (entry.compressedVideoUri) {
      await this.safeDeleteFile(entry.compressedVideoUri);
    }

    // Remove from cache
    this.cache.delete(photoId);
    await this.saveCache();
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    let totalSize = 0;
    let cachedItems = 0;

    for (const entry of this.cache.values()) {
      totalSize += entry.sizeBytes;
      cachedItems++;
    }

    const freeSpace = await this.getFreeSpace();

    return {
      usedBytes: totalSize,
      availableBytes: freeSpace,
      cachedItems,
      totalSavedBytes: this.calculateSavedBytes(),
    };
  }

  /**
   * Clear all cached Live Photos
   */
  async clearCache(): Promise<void> {
    for (const entry of this.cache.values()) {
      await this.safeDeleteFile(entry.stillUri);
      await this.safeDeleteFile(entry.videoUri);
      if (entry.compressedVideoUri) {
        await this.safeDeleteFile(entry.compressedVideoUri);
      }
    }

    this.cache.clear();
    await this.saveCache();
  }

  /**
   * Optimize still image for storage
   */
  private async optimizeStillImage(imageUri: string, photoId: string): Promise<string> {
    try {
      // Get image info
      const imageInfo = await FileSystem.getInfoAsync(imageUri);
      const originalSize = imageInfo.size || 0;

      // If image is already small enough, just copy it
      if (originalSize < 1024 * 1024) { // Less than 1MB
        return imageUri;
      }

      // Resize and compress
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            resize: {
              width: 1920, // Max width for Live Photos
              height: 1920, // Max height
            },
          },
        ],
        {
          compress: this.config.compressionQuality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      const optimizedUri = `${FileSystem.cacheDirectory}live_still_${photoId}.jpg`;
      await FileSystem.moveAsync({
        from: result.uri,
        to: optimizedUri,
      });

      const optimizedInfo = await FileSystem.getInfoAsync(optimizedUri);
      const savings = originalSize - (optimizedInfo.size || 0);
      
      console.log(`Still image optimized: saved ${savings} bytes (${((savings / originalSize) * 100).toFixed(1)}%)`);
      
      return optimizedUri;
    } catch (error) {
      console.error('Failed to optimize still image:', error);
      return imageUri; // Fallback to original
    }
  }

  /**
   * Optimize motion video for storage
   */
  private async optimizeMotionVideo(videoUri: string, photoId: string, format: 'apple' | 'android'): Promise<string> {
    try {
      if (!this.config.enableVideoCompression) {
        return videoUri;
      }

      const videoInfo = await FileSystem.getInfoAsync(videoUri);
      const originalSize = videoInfo.size || 0;

      // For now, just copy the video
      // In a production app, you would use video compression libraries
      const optimizedUri = `${FileSystem.cacheDirectory}live_video_${photoId}.mp4`;
      await FileSystem.copyAsync({
        from: videoUri,
        to: optimizedUri,
      });

      console.log(`Motion video stored: ${originalSize} bytes`);
      
      return optimizedUri;
    } catch (error) {
      console.error('Failed to optimize motion video:', error);
      return videoUri; // Fallback to original
    }
  }

  /**
   * Enforce cache size limits
   */
  private async enforceCacheLimits(): Promise<void> {
    const maxSizeBytes = this.config.maxCacheSizeMB * 1024 * 1024;
    let currentSize = 0;

    // Calculate current size
    for (const entry of this.cache.values()) {
      currentSize += entry.sizeBytes;
    }

    if (currentSize <= maxSizeBytes) {
      return;
    }

    // Sort entries based on eviction policy
    const entries = Array.from(this.cache.values());
    
    switch (this.config.cacheEvictionPolicy) {
      case 'lru':
        entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
        break;
      case 'fifo':
        entries.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'size':
        entries.sort((a, b) => b.sizeBytes - a.sizeBytes);
        break;
    }

    // Remove entries until under limit
    const targetSize = maxSizeBytes * 0.8; // Remove 20% buffer
    let removedSize = 0;

    for (const entry of entries) {
      if (currentSize - removedSize <= targetSize) {
        break;
      }

      await this.removeLivePhoto(entry.id);
      removedSize += entry.sizeBytes;
    }

    console.log(`Cache eviction: removed ${(removedSize / 1024 / 1024).toFixed(1)}MB`);
  }

  /**
   * Load cache from storage
   */
  private async loadCache(): Promise<void> {
    try {
      const cachedData = await AsyncStorage.getItem(LivePhotoStorage.CACHE_KEY);
      
      if (cachedData) {
        const entries = JSON.parse(cachedData) as LivePhotoCacheEntry[];
        this.cache = new Map(entries.map(entry => [entry.id, entry]));
      }
    } catch (error) {
      console.error('Failed to load Live Photo cache:', error);
      this.cache = new Map();
    }
  }

  /**
   * Save cache to storage
   */
  private async saveCache(): Promise<void> {
    try {
      const entries = Array.from(this.cache.values());
      await AsyncStorage.setItem(LivePhotoStorage.CACHE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('Failed to save Live Photo cache:', error);
    }
  }

  /**
   * Safely delete a file
   */
  private async safeDeleteFile(uri: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(uri);
    } catch (error) {
      console.warn(`Failed to delete file ${uri}:`, error);
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(uri: string): Promise<boolean> {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available free space
   */
  private async getFreeSpace(): Promise<number> {
    try {
      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      return freeSpace;
    } catch (error) {
      console.warn('Failed to get free space:', error);
      return 1024 * 1024 * 1024; // 1GB fallback
    }
  }

  /**
   * Calculate total saved bytes from optimization
   */
  private calculateSavedBytes(): number {
    // This would track compression savings over time
    // For now, return a placeholder
    return 0;
  }

  /**
   * Cleanup old or invalid cache entries
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    const entriesToRemove: string[] = [];

    for (const [id, entry] of this.cache.entries()) {
      const age = now - entry.lastAccessed;
      
      if (age > maxAge) {
        entriesToRemove.push(id);
      }
    }

    for (const id of entriesToRemove) {
      await this.removeLivePhoto(id);
    }

    console.log(`Cleanup: removed ${entriesToRemove.length} old cache entries`);
  }
}

// Global storage instance
export const livePhotoStorage = new LivePhotoStorage();
