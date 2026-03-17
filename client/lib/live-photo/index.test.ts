// AI-META-BEGIN
// AI-META: Live Photo functionality tests
// OWNERSHIP: client/lib/live-photo (Live Photo tests)
// ENTRYPOINTS: Run by test suite to validate Live Photo functionality
// DEPENDENCIES: Vitest, live-photo modules, mock data
// DANGER: File system operations and async testing
// CHANGE-SAFETY: Safe to add new tests; risky to change test data
// TESTS: Test Live Photo detection, processing, playback, and storage
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LivePhotoProcessor } from './processor';
import { livePhotoStorage } from './storage';
import { LivePhotoUtils } from './index';

// Mock expo-file-system
vi.mock('expo-file-system', () => ({
  getInfoAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
  deleteAsync: vi.fn(),
  copyAsync: vi.fn(),
  moveAsync: vi.fn(),
  getFreeDiskStorageAsync: vi.fn(),
  cacheDirectory: '/cache/',
}));

// Mock expo-image-manipulator
vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: vi.fn(),
  SaveFormat: {
    JPEG: 'jpeg',
  },
}));

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

describe('LivePhotoUtils', () => {
  it('should identify Live Photos correctly', () => {
    const livePhoto = { isLivePhoto: true };
    const regularPhoto = { isLivePhoto: false };
    const undefinedPhoto = undefined;

    expect(LivePhotoUtils.isLivePhoto(livePhoto)).toBe(true);
    expect(LivePhotoUtils.isLivePhoto(regularPhoto)).toBe(false);
    expect(LivePhotoUtils.isLivePhoto(undefinedPhoto)).toBe(false);
  });

  it('should get Live Photo format correctly', () => {
    const applePhoto = { livePhotoFormat: 'apple' };
    const androidPhoto = { livePhotoFormat: 'android' };
    const noFormatPhoto = {};

    expect(LivePhotoUtils.getFormat(applePhoto)).toBe('apple');
    expect(LivePhotoUtils.getFormat(androidPhoto)).toBe('android');
    expect(LivePhotoUtils.getFormat(noFormatPhoto)).toBe(null);
  });

  it('should format duration correctly', () => {
    expect(LivePhotoUtils.formatDuration(3000)).toBe('0:03');
    expect(LivePhotoUtils.formatDuration(65000)).toBe('1:05');
    expect(LivePhotoUtils.formatDuration(0)).toBe('0:00');
    expect(LivePhotoUtils.formatDuration(undefined)).toBe('0:00');
  });

  it('should format file size correctly', () => {
    expect(LivePhotoUtils.formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(LivePhotoUtils.formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    expect(LivePhotoUtils.formatFileSize(0)).toBe('0 MB');
    expect(LivePhotoUtils.formatFileSize(undefined)).toBe('0 MB');
  });

  it('should get presentation timestamp in seconds', () => {
    const photo = { livePresentationTimestampUs: 1500000 }; // 1.5 seconds
    expect(LivePhotoUtils.getPresentationTimestampSeconds(photo)).toBe(1.5);
    
    const noTimestampPhoto = {};
    expect(LivePhotoUtils.getPresentationTimestampSeconds(noTimestampPhoto)).toBe(null);
  });

  it('should get video URI correctly', () => {
    const photo = { liveVideoUri: '/path/to/video.mp4' };
    const noVideoPhoto = {};
    
    expect(LivePhotoUtils.getVideoUri(photo)).toBe('/path/to/video.mp4');
    expect(LivePhotoUtils.getVideoUri(noVideoPhoto)).toBe(null);
  });
});

describe('LivePhotoProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect non-Live Photo correctly', async () => {
    const mockTags = {
      xmp: {},
      exif: {},
    };

    vi.doMock('exifreader', () => ({
      load: vi.fn().mockResolvedValue(mockTags),
    }));

    const result = await LivePhotoProcessor.detectLivePhoto('/fake/path.jpg');
    
    expect(result.isLivePhoto).toBe(false);
    expect(result.format).toBe(null);
  });

  it('should detect Android Motion Photo', async () => {
    const mockTags = {
      xmp: {
        '?xml': {
          'Camera:MotionPhoto': '1',
          'Camera:MotionPhotoVersion': '1',
          'Camera:MotionPhotoPresentationTimestampUs': '1500000',
          'Container:Directory': JSON.stringify([
            {
              Item: {
                Mime: 'image/jpeg',
                Length: 1024000,
                Semantic: 'Primary',
              },
              SecondaryItem: {
                Mime: 'video/mp4',
                Length: 3072000,
                Semantic: 'Motion',
              },
            },
          ]),
        },
      },
    };

    vi.doMock('exifreader', () => ({
      load: vi.fn().mockResolvedValue(mockTags),
    }));

    const result = await LivePhotoProcessor.detectLivePhoto('/fake/path.jpg');
    
    expect(result.isLivePhoto).toBe(true);
    expect(result.format).toBe('android');
    expect(result.presentationTimestampUs).toBe(1500000);
    expect(result.containerItems).toHaveLength(2);
  });

  it('should handle detection errors gracefully', async () => {
    vi.doMock('exifreader', () => ({
      load: vi.fn().mockRejectedValue(new Error('Read error')),
    }));

    const result = await LivePhotoProcessor.detectLivePhoto('/fake/path.jpg');
    
    expect(result.isLivePhoto).toBe(false);
    expect(result.format).toBe(null);
  });

  it('should return null for non-Live Photo processing', async () => {
    vi.doMock('exifreader', () => ({
      load: vi.fn().mockResolvedValue({ xmp: {} }),
    }));

    const result = await LivePhotoProcessor.processLivePhoto('/fake/path.jpg');
    
    expect(result).toBe(null);
  });
});

describe('LivePhotoStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await livePhotoStorage.clearCache();
  });

  it('should store and retrieve Live Photos', async () => {
    const photoId = 'test-photo-123';
    const stillUri = '/cache/still.jpg';
    const videoUri = '/cache/video.mp4';
    const format = 'apple' as const;

    // Mock file system operations
    const { getInfoAsync } = await import('expo-file-system');
    vi.mocked(getInfoAsync).mockResolvedValue({
      exists: true,
      size: 1024000,
      uri: stillUri,
    });

    const result = await livePhotoStorage.storeLivePhoto(photoId, stillUri, videoUri, format);
    
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('still');
    expect(result[1]).toContain('video');

    const retrieved = await livePhotoStorage.getLivePhoto(photoId);
    expect(retrieved).toBeTruthy();
    expect(retrieved?.id).toBe(photoId);
    expect(retrieved?.format).toBe(format);
  });

  it('should handle cache misses', async () => {
    const result = await livePhotoStorage.getLivePhoto('non-existent');
    expect(result).toBe(null);
  });

  it('should remove Live Photos from cache', async () => {
    const photoId = 'test-photo-456';
    const stillUri = '/cache/still.jpg';
    const videoUri = '/cache/video.mp4';
    const format = 'android' as const;

    // Mock file system operations
    const { getInfoAsync, deleteAsync } = await import('expo-file-system');
    vi.mocked(getInfoAsync).mockResolvedValue({
      exists: true,
      size: 512000,
      uri: stillUri,
    });
    vi.mocked(deleteAsync).mockResolvedValue(undefined);

    await livePhotoStorage.storeLivePhoto(photoId, stillUri, videoUri, format);
    
    const beforeRemoval = await livePhotoStorage.getLivePhoto(photoId);
    expect(beforeRemoval).toBeTruthy();

    await livePhotoStorage.removeLivePhoto(photoId);
    
    const afterRemoval = await livePhotoStorage.getLivePhoto(photoId);
    expect(afterRemoval).toBe(null);
  });

  it('should provide storage statistics', async () => {
    const stats = await livePhotoStorage.getStorageStats();
    
    expect(stats).toHaveProperty('usedBytes');
    expect(stats).toHaveProperty('availableBytes');
    expect(stats).toHaveProperty('cachedItems');
    expect(stats).toHaveProperty('totalSavedBytes');
    expect(typeof stats.usedBytes).toBe('number');
    expect(typeof stats.cachedItems).toBe('number');
  });

  it('should clear cache completely', async () => {
    const photoId = 'test-photo-789';
    const stillUri = '/cache/still.jpg';
    const videoUri = '/cache/video.mp4';
    const format = 'apple' as const;

    // Mock file system operations
    const { getInfoAsync, deleteAsync } = await import('expo-file-system');
    vi.mocked(getInfoAsync).mockResolvedValue({
      exists: true,
      size: 2048000,
      uri: stillUri,
    });
    vi.mocked(deleteAsync).mockResolvedValue(undefined);

    await livePhotoStorage.storeLivePhoto(photoId, stillUri, videoUri, format);
    
    let stats = await livePhotoStorage.getStorageStats();
    expect(stats.cachedItems).toBeGreaterThan(0);

    await livePhotoStorage.clearCache();
    
    stats = await livePhotoStorage.getStorageStats();
    expect(stats.cachedItems).toBe(0);
  });
});
