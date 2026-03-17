// AI-META-BEGIN
// AI-META: Live Photo module exports and utilities
// OWNERSHIP: client/lib/live-photo (Live Photo module)
// ENTRYPOINTS: Central export point for all Live Photo functionality
// DEPENDENCIES: All live-photo submodules
// DANGER: Module exports; maintain API compatibility
// CHANGE-SAFETY: Safe to add new exports; risky to remove existing ones
// TESTS: Test module exports and integration points
// AI-META-END

// Core Live Photo functionality
export { LivePhotoProcessor } from './processor';
export type { LivePhotoMetadata, ProcessedLivePhoto, ContainerItem } from './processor';

// Playback engine
export { 
  useLivePhotoPlayback, 
  LivePhotoVideo, 
  LivePhotoStill 
} from './playback';
export type { 
  LivePhotoPlaybackOptions, 
  LivePhotoPlaybackState 
} from './playback';

// Storage management
export { LivePhotoStorage, livePhotoStorage } from './storage';
export type { 
  LivePhotoStorageConfig, 
  LivePhotoCacheEntry, 
  StorageStats 
} from './storage';

// Utility functions
export const LivePhotoUtils = {
  /**
   * Check if a photo object is a Live Photo
   */
  isLivePhoto(photo: any): boolean {
    return photo?.isLivePhoto === true;
  },

  /**
   * Get Live Photo format from photo object
   */
  getFormat(photo: any): 'apple' | 'android' | null {
    return photo?.livePhotoFormat || null;
  },

  /**
   * Get Live Photo video URI from photo object
   */
  getVideoUri(photo: any): string | null {
    return photo?.liveVideoUri || null;
  },

  /**
   * Get presentation timestamp in seconds
   */
  getPresentationTimestampSeconds(photo: any): number | null {
    const timestampUs = photo?.livePresentationTimestampUs;
    return timestampUs ? timestampUs / 1_000_000 : null;
  },

  /**
   * Format Live Photo duration for display
   */
  formatDuration(durationMs?: number): string {
    if (!durationMs) return '0:00';
    
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  },

  /**
   * Get Live Photo file size in human readable format
   */
  formatFileSize(bytes?: number): string {
    if (!bytes) return '0 MB';
    
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  },
};
