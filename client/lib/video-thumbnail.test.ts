// AI-META-BEGIN
// AI-META: Comprehensive test suite for video thumbnail generation utility
// OWNERSHIP: client/lib/video-thumbnail.test.ts
// ENTRYPOINTS: Test coverage for video-thumbnail.ts utility functions
// DEPENDENCIES: Vitest, expo-video mocks, test utilities
// DANGER: Video thumbnail generation tests require proper mocking of expo-video APIs
// CHANGE-SAFETY: Safe to add new test cases; risky to change existing test expectations
// TESTS: Test thumbnail generation, video detection, duration retrieval, error handling
// AI-META-END

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  generateVideoThumbnail, 
  generateVideoThumbnails, 
  isVideoFile, 
  getVideoDuration 
} from './video-thumbnail';

// Mock expo-video
vi.mock('expo-video', () => ({
  Video: {
    createVideoPlayer: vi.fn(),
  },
}));

describe('video-thumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isVideoFile', () => {
    it('should identify video files by URI extension', () => {
      expect(isVideoFile('video.mp4')).toBe(true);
      expect(isVideoFile('movie.MOV')).toBe(true);
      expect(isVideoFile('clip.avi')).toBe(true);
      expect(isVideoFile('test.mkv')).toBe(true);
      expect(isVideoFile('sample.webm')).toBe(true);
      expect(isVideoFile('video.m4v')).toBe(true);
      expect(isVideoFile('recording.3gp')).toBe(true);
    });

    it('should identify video files by MIME type', () => {
      expect(isVideoFile('file.mp4', 'video/mp4')).toBe(true);
      expect(isVideoFile('file.mov', 'video/quicktime')).toBe(true);
      expect(isVideoFile('file.avi', 'video/x-msvideo')).toBe(true);
    });

    it('should reject non-video files', () => {
      expect(isVideoFile('photo.jpg')).toBe(false);
      expect(isVideoFile('image.png')).toBe(false);
      expect(isVideoFile('document.pdf')).toBe(false);
      expect(isVideoFile('audio.mp3')).toBe(false);
    });

    it('should prioritize MIME type over file extension', () => {
      expect(isVideoFile('video.jpg', 'video/mp4')).toBe(true);
      expect(isVideoFile('photo.mp4', 'image/jpeg')).toBe(false);
    });
  });

  describe('generateVideoThumbnail', () => {
    const mockVideoUri = 'file://test-video.mp4';
    
    it('should generate a thumbnail successfully', async () => {
      const mockPlayer = {
        generateThumbnailsAsync: vi.fn().mockResolvedValue([
          { uri: 'file://thumbnail.jpg', width: 320, height: 240 }
        ]),
      };
      
      const { Video } = await import('expo-video');
      vi.mocked(Video.createVideoPlayer).mockResolvedValue(mockPlayer);

      const result = await generateVideoThumbnail(mockVideoUri);

      expect(Video.createVideoPlayer).toHaveBeenCalledWith(mockVideoUri);
      expect(mockPlayer.generateThumbnailsAsync).toHaveBeenCalledWith([1], {
        width: 320,
        height: 240,
        quality: 0.8,
      });
      expect(result).toBe('file://thumbnail.jpg');
    });

    it('should use custom time parameter', async () => {
      const mockPlayer = {
        generateThumbnailsAsync: vi.fn().mockResolvedValue([
          { uri: 'file://thumbnail.jpg', width: 320, height: 240 }
        ]),
      };
      
      const { Video } = await import('expo-video');
      vi.mocked(Video.createVideoPlayer).mockResolvedValue(mockPlayer);

      await generateVideoThumbnail(mockVideoUri, 5);

      expect(mockPlayer.generateThumbnailsAsync).toHaveBeenCalledWith([5], {
        width: 320,
        height: 240,
        quality: 0.8,
      });
    });

    it('should throw error when no thumbnail is generated', async () => {
      const mockPlayer = {
        generateThumbnailsAsync: vi.fn().mockResolvedValue([]),
      };
      
      const { Video } = await import('expo-video');
      vi.mocked(Video.createVideoPlayer).mockResolvedValue(mockPlayer);

      await expect(generateVideoThumbnail(mockVideoUri)).rejects.toThrow('No thumbnail generated');
    });

    it('should handle player creation errors', async () => {
      const { Video } = await import('expo-video');
      vi.mocked(Video.createVideoPlayer).mockRejectedValue(new Error('Video not found'));

      await expect(generateVideoThumbnail(mockVideoUri)).rejects.toThrow('Video thumbnail generation failed: Video not found');
    });

    it('should handle thumbnail generation errors', async () => {
      const mockPlayer = {
        generateThumbnailsAsync: vi.fn().mockRejectedValue(new Error('Invalid video format')),
      };
      
      const { Video } = await import('expo-video');
      vi.mocked(Video.createVideoPlayer).mockResolvedValue(mockPlayer);

      await expect(generateVideoThumbnail(mockVideoUri)).rejects.toThrow('Video thumbnail generation failed: Invalid video format');
    });
  });

  describe('generateVideoThumbnails', () => {
    const mockVideoUri = 'file://test-video.mp4';
    
    it('should generate multiple thumbnails at different times', async () => {
      const mockPlayer = {
        generateThumbnailsAsync: vi.fn().mockResolvedValue([
          { uri: 'file://thumb1.jpg', width: 320, height: 240 },
          { uri: 'file://thumb2.jpg', width: 320, height: 240 },
          { uri: 'file://thumb3.jpg', width: 320, height: 240 },
        ]),
      };
      
      const { Video } = await import('expo-video');
      vi.mocked(Video.createVideoPlayer).mockResolvedValue(mockPlayer);

      const times = [1, 5, 10];
      const result = await generateVideoThumbnails(mockVideoUri, times);

      expect(mockPlayer.generateThumbnailsAsync).toHaveBeenCalledWith(times, {
        width: 320,
        height: 240,
        quality: 0.8,
      });
      expect(result).toEqual(['file://thumb1.jpg', 'file://thumb2.jpg', 'file://thumb3.jpg']);
    });

    it('should use custom options', async () => {
      const mockPlayer = {
        generateThumbnailsAsync: vi.fn().mockResolvedValue([
          { uri: 'file://thumb.jpg', width: 640, height: 480 }
        ]),
      };
      
      const { Video } = await import('expo-video');
      vi.mocked(Video.createVideoPlayer).mockResolvedValue(mockPlayer);

      const options = {
        width: 640,
        height: 480,
        quality: 0.9,
      };

      await generateVideoThumbnails(mockVideoUri, [1], options);

      expect(mockPlayer.generateThumbnailsAsync).toHaveBeenCalledWith([1], options);
    });

    it('should use default options when none provided', async () => {
      const mockPlayer = {
        generateThumbnailsAsync: vi.fn().mockResolvedValue([
          { uri: 'file://thumb.jpg', width: 320, height: 240 }
        ]),
      };
      
      const { Video } = await import('expo-video');
      vi.mocked(Video.createVideoPlayer).mockResolvedValue(mockPlayer);

      await generateVideoThumbnails(mockVideoUri, [1]);

      expect(mockPlayer.generateThumbnailsAsync).toHaveBeenCalledWith([1], {
        width: 320,
        height: 240,
        quality: 0.8,
      });
    });
  });

  describe('getVideoDuration', () => {
    const mockVideoUri = 'file://test-video.mp4';
    
    it('should get video duration successfully', async () => {
      const mockPlayer = {
        duration: 120,
      };
      
      const { Video } = await import('expo-video');
      vi.mocked(Video.createVideoPlayer).mockResolvedValue(mockPlayer);

      const result = await getVideoDuration(mockVideoUri);

      expect(Video.createVideoPlayer).toHaveBeenCalledWith(mockVideoUri);
      expect(result).toBe(120);
    });

    it('should handle timeout when duration is not available', async () => {
      const mockPlayer = {
        duration: 0, // Simulate video not loaded yet
      };
      
      const { Video } = await import('expo-video');
      vi.mocked(Video.createVideoPlayer).mockResolvedValue(mockPlayer);

      // Mock setTimeout to avoid actual delay in tests
      vi.useFakeTimers();

      const promise = getVideoDuration(mockVideoUri);
      
      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(10000);

      await expect(promise).rejects.toThrow('Failed to get video duration: Timeout getting video duration');
      
      vi.useRealTimers();
    });

    it('should handle player creation errors', async () => {
      const { Video } = await import('expo-video');
      vi.mocked(Video.createVideoPlayer).mockRejectedValue(new Error('Corrupted video file'));

      await expect(getVideoDuration(mockVideoUri)).rejects.toThrow('Failed to get video duration: Corrupted video file');
    });
  });
});
