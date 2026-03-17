// AI-META-BEGIN
// AI-META: Video thumbnail generation utility using expo-video built-in thumbnail generation
// OWNERSHIP: client/lib/video-thumbnail.ts
// ENTRYPOINTS: Used by upload pipeline and potentially server-side processing
// DEPENDENCIES: expo-video (useVideoPlayer, VideoView)
// DANGER: Video thumbnail generation can be memory intensive; requires proper error handling
// CHANGE-SAFETY: Safe to modify thumbnail generation logic; risky to change API signature
// TESTS: Test with various video formats, sizes, and error scenarios
// AI-META-END

import { Video } from 'expo-video';

/**
 * Generate a thumbnail from a video file at a specific time
 * @param videoUri - URI of the video file
 * @param timeInSeconds - Time position to capture thumbnail (default: 1 second)
 * @returns Promise<string> - URI of the generated thumbnail image
 */
export async function generateVideoThumbnail(
  videoUri: string, 
  timeInSeconds: number = 1
): Promise<string> {
  try {
    // Create a video player for thumbnail generation
    const player = await Video.createVideoPlayer(videoUri);
    
    // Generate thumbnail at the specified time
    const thumbnails = await player.generateThumbnailsAsync([timeInSeconds], {
      // Use a reasonable thumbnail size
      width: 320,
      height: 240,
      // High quality for better user experience
      quality: 0.8,
    });

    if (thumbnails.length === 0) {
      throw new Error('No thumbnail generated');
    }

    // Get the first (and only) thumbnail
    const thumbnail = thumbnails[0];
    
    // Return the thumbnail URI (VideoThumbnail can be used as Image source)
    return thumbnail.uri || thumbnail.toString();
  } catch (error) {
    console.error('Failed to generate video thumbnail:', error);
    throw new Error(`Video thumbnail generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate multiple thumbnails from a video (useful for preview grids)
 * @param videoUri - URI of the video file
 * @param times - Array of time positions in seconds
 * @param options - Thumbnail generation options
 * @returns Promise<string[]> - Array of thumbnail URIs
 */
export async function generateVideoThumbnails(
  videoUri: string,
  times: number[],
  options: {
    width?: number;
    height?: number;
    quality?: number;
  } = {}
): Promise<string[]> {
  try {
    const player = await Video.createVideoPlayer(videoUri);
    
    const thumbnails = await player.generateThumbnailsAsync(times, {
      width: options.width || 320,
      height: options.height || 240,
      quality: options.quality || 0.8,
    });

    return thumbnails.map(thumbnail => thumbnail.uri || thumbnail.toString());
  } catch (error) {
    console.error('Failed to generate video thumbnails:', error);
    throw new Error(`Video thumbnails generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if a file is likely a video based on URI and optional metadata
 * @param uri - File URI to check
 * @param mimeType - Optional MIME type
 * @returns boolean - True if the file is likely a video
 */
export function isVideoFile(uri: string, mimeType?: string): boolean {
  // Check MIME type if provided
  if (mimeType) {
    return mimeType.startsWith('video/');
  }
  
  // Check file extension
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.3gp'];
  const lowerUri = uri.toLowerCase();
  
  return videoExtensions.some(ext => lowerUri.endsWith(ext));
}

/**
 * Get video duration from a video file
 * @param videoUri - URI of the video file
 * @returns Promise<number> - Duration in seconds
 */
export async function getVideoDuration(videoUri: string): Promise<number> {
  try {
    const player = await Video.createVideoPlayer(videoUri);
    
    // Wait for player to load and get duration
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout getting video duration'));
      }, 10000); // 10 second timeout

      // Try to get duration (this might need to wait for the video to load)
      const checkDuration = () => {
        if (player.duration && player.duration > 0) {
          clearTimeout(timeout);
          resolve(player.duration);
        } else {
          // Check again after a short delay
          setTimeout(checkDuration, 100);
        }
      };

      checkDuration();
    });
  } catch (error) {
    console.error('Failed to get video duration:', error);
    throw new Error(`Failed to get video duration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
