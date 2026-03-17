// AI-META-BEGIN
// AI-META: Unit tests for image preprocessing utilities with comprehensive edge case coverage
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: imported by vitest test runner
// DEPENDENCIES: vitest, expo-image-manipulator (mocked)
// DANGER: Tests require proper mock setup for expo modules
// CHANGE-SAFETY: Add new test cases for additional preprocessing functions
// TESTS: Run with npm run test client/lib/ml/image-preprocessing.test.ts
// AI-META-END

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import {
  preprocessImageForModel,
  getImageMetadata,
  validateTensor,
  getTensorStats,
  batchPreprocessImages,
  MOBILENET_NORMALIZATION,
  MODEL_INPUT_SIZES,
} from './image-preprocessing';

// Mock expo modules
vi.mock('expo-image-manipulator');
vi.mock('expo-file-system');

describe('Image Preprocessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    vi.mocked(FileSystem.getInfoAsync).mockResolvedValue({
      exists: true,
      size: 1024,
      uri: 'file://test.jpg',
    } as any);

    vi.mocked(ImageManipulator.manipulateAsync).mockResolvedValue({
      uri: 'file://resized.jpg',
      width: 192,
      height: 192,
      base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // 1x1 transparent PNG
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('preprocessImageForModel', () => {
    it('should preprocess image to 192x192 with [-1,1] normalization', async () => {
      const result = await preprocessImageForModel('file://test.jpg', 192, '[-1,1]');

      expect(result).toEqual({
        tensor: expect.any(Float32Array),
        width: 192,
        height: 192,
        channels: 3,
        processingTime: expect.any(Number),
      });

      expect(result.tensor.length).toBe(192 * 192 * 3);
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        'file://test.jpg',
        [{ resize: { width: 192, height: 192 } }],
        {
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
          compress: 0.9,
        }
      );
    });

    it('should preprocess image with [0,1] normalization', async () => {
      const result = await preprocessImageForModel('file://test.jpg', 224, '[0,1]');

      expect(result.width).toBe(224);
      expect(result.height).toBe(224);
      expect(result.tensor.length).toBe(224 * 224 * 3);
    });

    it('should use default parameters when not specified', async () => {
      const result = await preprocessImageForModel('file://test.jpg');

      expect(result.width).toBe(MODEL_INPUT_SIZES.MOBILENET_V3_SMALL);
      expect(result.height).toBe(MODEL_INPUT_SIZES.MOBILENET_V3_SMALL);
    });

    it('should handle file not found error', async () => {
      vi.mocked(FileSystem.getInfoAsync).mockResolvedValue({
        exists: false,
        uri: 'file://nonexistent.jpg',
      } as any);

      await expect(preprocessImageForModel('file://nonexistent.jpg')).rejects.toThrow(
        'Image preprocessing failed: Image file does not exist'
      );
    });

    it('should handle image manipulation error', async () => {
      vi.mocked(ImageManipulator.manipulateAsync).mockRejectedValue(new Error('Manipulation failed'));

      await expect(preprocessImageForModel('file://test.jpg')).rejects.toThrow(
        'Image preprocessing failed: Manipulation failed'
      );
    });

    it('should handle missing base64 data', async () => {
      vi.mocked(ImageManipulator.manipulateAsync).mockResolvedValue({
        uri: 'file://resized.jpg',
        width: 192,
        height: 192,
        base64: undefined,
      } as any);

      await expect(preprocessImageForModel('file://test.jpg')).rejects.toThrow(
        'Image preprocessing failed: Failed to get base64 image data from ImageManipulator'
      );
    });

    it('should produce valid tensor values', async () => {
      const result = await preprocessImageForModel('file://test.jpg', 192, '[-1,1]');
      
      // Check that tensor values are in valid range for [-1,1] normalization
      const tensor = result.tensor;
      for (let i = 0; i < Math.min(tensor.length, 100); i++) {
        expect(tensor[i]).toBeGreaterThanOrEqual(-1.1);
        expect(tensor[i]).toBeLessThanOrEqual(1.1);
      }

      // Check that no NaN or Infinity values exist
      for (let i = 0; i < tensor.length; i++) {
        expect(isFinite(tensor[i])).toBe(true);
      }
    });

    it('should process different image sizes correctly', async () => {
      const sizes = [192, 224, 256];
      
      for (const size of sizes) {
        const result = await preprocessImageForModel('file://test.jpg', size);
        expect(result.width).toBe(size);
        expect(result.height).toBe(size);
        expect(result.tensor.length).toBe(size * size * 3);
      }
    });

    it('should measure processing time', async () => {
      const result = await preprocessImageForModel('file://test.jpg');
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.processingTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('getImageMetadata', () => {
    it('should return image metadata', async () => {
      const metadata = await getImageMetadata('file://test.jpg');

      expect(metadata).toEqual({
        width: 0, // Will be determined after manipulation
        height: 0, // Will be determined after manipulation
        format: 'jpg',
        size: 1024,
      });
    });

    it('should handle file without extension', async () => {
      const metadata = await getImageMetadata('file://test');
      expect(metadata.format).toBe('unknown');
    });

    it('should handle uppercase extensions', async () => {
      const metadata = await getImageMetadata('file://test.JPG');
      expect(metadata.format).toBe('jpg');
    });

    it('should handle missing file', async () => {
      vi.mocked(FileSystem.getInfoAsync).mockResolvedValue({
        exists: false,
        uri: 'file://missing.jpg',
      } as any);

      await expect(getImageMetadata('file://missing.jpg')).rejects.toThrow(
        'Failed to get image metadata: Image file does not exist'
      );
    });

    it('should handle filesystem error', async () => {
      vi.mocked(FileSystem.getInfoAsync).mockRejectedValue(new Error('Filesystem error'));

      await expect(getImageMetadata('file://test.jpg')).rejects.toThrow(
        'Failed to get image metadata: Filesystem error'
      );
    });
  });

  describe('validateTensor', () => {
    it('should validate correct tensor', () => {
      const tensor = new Float32Array(192 * 192 * 3);
      // Fill with valid values
      for (let i = 0; i < tensor.length; i++) {
        tensor[i] = (Math.random() - 0.5) * 2; // Values between -1 and 1
      }

      const result = validateTensor(tensor, 192, 3);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect wrong tensor size', () => {
      const tensor = new Float32Array(100); // Wrong size
      const result = validateTensor(tensor, 192, 3);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Tensor size mismatch: expected 110592, got 100'
      );
    });

    it('should detect NaN values', () => {
      const tensor = new Float32Array(192 * 192 * 3);
      tensor[1000] = NaN;
      
      const result = validateTensor(tensor, 192, 3);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid tensor value at index 1000: NaN');
    });

    it('should detect Infinity values', () => {
      const tensor = new Float32Array(192 * 192 * 3);
      tensor[1000] = Infinity;
      
      const result = validateTensor(tensor, 192, 3);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid tensor value at index 1000: Infinity');
    });

    it('should detect values outside valid range', () => {
      const tensor = new Float32Array(192 * 192 * 3);
      tensor[1000] = 2.0; // Outside [-1, 1] range
      
      const result = validateTensor(tensor, 192, 3);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Tensor values outside expected range [-1, 1]');
    });
  });

  describe('getTensorStats', () => {
    it('should calculate tensor statistics correctly', () => {
      const tensor = new Float32Array([0.0, 0.5, 1.0, -0.5, -1.0]);
      const stats = getTensorStats(tensor);

      expect(stats.min).toBe(-1.0);
      expect(stats.max).toBe(1.0);
      expect(stats.mean).toBe(0.0);
      expect(stats.size).toBe(5);
      expect(stats.std).toBeCloseTo(0.7905694150420949, 5); // Standard deviation of [0, 0.5, 1, -0.5, -1]
    });

    it('should handle empty tensor', () => {
      const tensor = new Float32Array(0);
      const stats = getTensorStats(tensor);

      expect(stats.min).toBe(Infinity);
      expect(stats.max).toBe(-Infinity);
      expect(stats.mean).toBeNaN();
      expect(stats.size).toBe(0);
    });

    it('should handle uniform tensor', () => {
      const tensor = new Float32Array(100);
      tensor.fill(0.5);
      
      const stats = getTensorStats(tensor);
      expect(stats.min).toBe(0.5);
      expect(stats.max).toBe(0.5);
      expect(stats.mean).toBe(0.5);
      expect(stats.std).toBe(0);
    });
  });

  describe('batchPreprocessImages', () => {
    it('should process batch of images', async () => {
      const uris = ['file://test1.jpg', 'file://test2.jpg', 'file://test3.jpg'];
      const results = await batchPreprocessImages(uris, 192);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.width).toBe(192);
        expect(result.height).toBe(192);
        expect(result.tensor.length).toBe(192 * 192 * 3);
      });

      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledTimes(3);
    });

    it('should process large batch in parallel groups', async () => {
      const uris = Array.from({ length: 12 }, (_, i) => `file://test${i}.jpg`);
      const results = await batchPreprocessImages(uris, 192);

      expect(results).toHaveLength(12);
      // Should process in batches of 5, so 3 calls total
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledTimes(3);
    });

    it('should handle empty batch', async () => {
      const results = await batchPreprocessImages([], 192);
      expect(results).toEqual([]);
      expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
    });

    it('should handle batch processing errors', async () => {
      vi.mocked(ImageManipulator.manipulateAsync)
        .mockResolvedValueOnce({
          uri: 'file://resized1.jpg',
          width: 192,
          height: 192,
          base64: 'data:image/jpeg;base64,test',
        } as any)
        .mockRejectedValueOnce(new Error('Processing failed'));

      const uris = ['file://test1.jpg', 'file://test2.jpg'];
      
      await expect(batchPreprocessImages(uris, 192)).rejects.toThrow('Processing failed');
    });

    it('should use different target sizes', async () => {
      const uris = ['file://test1.jpg', 'file://test2.jpg'];
      await batchPreprocessImages(uris, 224);

      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        expect.any(String),
        [{ resize: { width: 224, height: 224 } }],
        expect.any(Object)
      );
    });
  });

  describe('Constants', () => {
    it('should have correct MobileNet normalization constants', () => {
      expect(MOBILENET_NORMALIZATION.MEAN).toEqual([127.5, 127.5, 127.5]);
      expect(MOBILENET_NORMALIZATION.SCALE).toBe(127.5);
    });

    it('should have correct model input sizes', () => {
      expect(MODEL_INPUT_SIZES.MOBILENET_V3_SMALL).toBe(192);
      expect(MODEL_INPUT_SIZES.MOBILENET_V3_LARGE).toBe(224);
      expect(MODEL_INPUT_SIZES.MOBILENET_V2).toBe(224);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small target size', async () => {
      const result = await preprocessImageForModel('file://test.jpg', 32);
      expect(result.width).toBe(32);
      expect(result.height).toBe(32);
      expect(result.tensor.length).toBe(32 * 32 * 3);
    });

    it('should handle large target size', async () => {
      const result = await preprocessImageForModel('file://test.jpg', 512);
      expect(result.width).toBe(512);
      expect(result.height).toBe(512);
      expect(result.tensor.length).toBe(512 * 512 * 3);
    });

    it('should handle corrupted base64 data', async () => {
      vi.mocked(ImageManipulator.manipulateAsync).mockResolvedValue({
        uri: 'file://resized.jpg',
        width: 192,
        height: 192,
        base64: 'invalid-base64-data!!!',
      } as any);

      await expect(preprocessImageForModel('file://test.jpg')).rejects.toThrow(
        'Image preprocessing failed: Failed to decode base64 image data'
      );
    });

    it('should handle data URL prefix in base64', async () => {
      vi.mocked(ImageManipulator.manipulateAsync).mockResolvedValue({
        uri: 'file://resized.jpg',
        width: 192,
        height: 192,
        base64: 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      } as any);

      const result = await preprocessImageForModel('file://test.jpg', 192);
      expect(result.tensor).toBeInstanceOf(Float32Array);
      expect(result.tensor.length).toBe(192 * 192 * 3);
    });
  });
});
