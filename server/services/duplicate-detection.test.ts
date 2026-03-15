// AI-META-BEGIN
// AI-META: Unit tests for duplicate detection algorithms
// OWNERSHIP: server/services
// ENTRYPOINTS: run by npm test for algorithm validation
// DEPENDENCIES: vitest, ./duplicate-detection
// DANGER: Tests must validate algorithm correctness for edge cases
// CHANGE-SAFETY: Maintain test coverage for all public functions
// TESTS: npm run test:watch for development, npm run test:coverage for validation
// AI-META-END

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateHammingDistance,
  calculateQualityMetrics,
  detectBurstSequence,
  findDuplicatePhotos,
  resolveDuplicateGroups,
  updateDuplicateGroups,
  DuplicateDetectionConfig,
} from './duplicate-detection';

// Module-scope mock database object
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Helper function to rebuild mock chains
function rewireMockDb() {
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue(Promise.resolve([])),
        }),
      }),
    }),
  });
  
  mockDb.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockReturnValue(Promise.resolve([{ id: 'test-id' }])),
    }),
  });
  
  mockDb.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  });
  
  mockDb.delete.mockReturnValue({
    where: vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue(undefined),
    }),
  });
}

// Mock database using factory function to avoid hoisting issues
vi.mock('../db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(Promise.resolve([])),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue(Promise.resolve([{ id: 'test-id' }])),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

describe('Duplicate Detection Service - Unit Tests', () => {
  describe('calculateHammingDistance', () => {
    it('should satisfy hash distance symmetry property', () => {
      const testCases = [
        ['1234567890ABCDEF', 'FEDCBA0987654321'],
        ['0000000000000000', 'FFFFFFFFFFFFFFFF'],
        ['ABCDEF1234567890', 'ABCDEF1234567890'],
        ['12345678', '87654321'],
        ['FFFFFFFF', '00000000'],
      ];

      for (const [hash1, hash2] of testCases) {
        const distance1 = calculateHammingDistance(hash1, hash2);
        const distance2 = calculateHammingDistance(hash2, hash1);
        expect(distance1).toBe(distance2);
      }
    });

    it('should satisfy hash distance identity property', () => {
      const testHashes = [
        '1234567890ABCDEF',
        '0000000000000000',
        'FFFFFFFFFFFFFFFF',
        'ABCDEF1234567890',
      ];

      for (const hash of testHashes) {
        const distance = calculateHammingDistance(hash, hash);
        expect(distance).toBe(0);
      }
    });

    it('should satisfy hash distance triangle inequality', () => {
      const hash1 = '1234567890ABCDEF';
      const hash2 = 'FEDCBA0987654321';
      const hash3 = 'ABCDEF1234567890';

      const distance12 = calculateHammingDistance(hash1, hash2);
      const distance23 = calculateHammingDistance(hash2, hash3);
      const distance13 = calculateHammingDistance(hash1, hash3);

      // Triangle inequality: d(a,c) ≤ d(a,b) + d(b,c)
      expect(distance13).toBeLessThanOrEqual(distance12 + distance23);
    });

    it('should handle invalid inputs gracefully', () => {
      expect(calculateHammingDistance('', '')).toBe(Infinity);
      expect(calculateHammingDistance('', '123')).toBe(Infinity);
      expect(calculateHammingDistance('123', '')).toBe(Infinity);
      expect(calculateHammingDistance('short', 'longer')).toBe(Infinity);
    });

    it('should return correct distances for known cases', () => {
      // Maximum distance case (all bits different)
      expect(calculateHammingDistance('0000000000000000', 'FFFFFFFFFFFFFFFF')).toBe(64);
      
      // Zero distance case (identical)
      expect(calculateHammingDistance('1234567890ABCDEF', '1234567890ABCDEF')).toBe(0);
      
      // Some bits different
      expect(calculateHammingDistance('0000000000000000', '0000000000000001')).toBe(1);
      expect(calculateHammingDistance('FFFFFFFFFFFFFFFF', 'FFFFFFFEFFFFFFFF')).toBe(1);
    });
  });

  describe('calculateQualityMetrics', () => {
    it('should produce consistent quality scores for same input', () => {
      const photo = { width: 1920, height: 1080, originalSize: 5000000 };
      const metrics1 = calculateQualityMetrics(photo);
      const metrics2 = calculateQualityMetrics(photo);
      
      expect(JSON.stringify(metrics1)).toBe(JSON.stringify(metrics2));
    });

    it('should handle missing file size gracefully', () => {
      const photo = { width: 1920, height: 1080, originalSize: undefined };
      const metrics = calculateQualityMetrics(photo);
      
      expect(typeof metrics.resolution).toBe('number');
      expect(typeof metrics.fileSize).toBe('number');
      expect(typeof metrics.sharpness).toBe('number');
      expect(typeof metrics.overall).toBe('number');
      expect(metrics.fileSize).toBe(0);
    });

    it('should calculate resolution correctly', () => {
      const testCases = [
        { width: 1920, height: 1080, expected: 2073600 },
        { width: 1280, height: 720, expected: 921600 },
        { width: 640, height: 480, expected: 307200 },
      ];

      for (const { width, height, expected } of testCases) {
        const metrics = calculateQualityMetrics({ width, height, originalSize: 1000000 });
        expect(metrics.resolution).toBe(expected);
      }
    });

    it('should produce higher quality scores for better photos', () => {
      const lowRes = { width: 640, height: 480, originalSize: 500000 };
      const highRes = { width: 3840, height: 2160, originalSize: 5000000 };
      
      const lowMetrics = calculateQualityMetrics(lowRes);
      const highMetrics = calculateQualityMetrics(highRes);
      
      expect(highMetrics.resolution).toBeGreaterThan(lowMetrics.resolution);
      expect(highMetrics.overall).toBeGreaterThan(lowMetrics.overall);
    });

    it('should handle edge cases', () => {
      // Minimum values
      const minPhoto = { width: 1, height: 1, originalSize: 1 };
      const minMetrics = calculateQualityMetrics(minPhoto);
      expect(minMetrics.resolution).toBe(1);
      expect(minMetrics.overall).toBeGreaterThanOrEqual(0);

      // Very large values
      const largePhoto = { width: 100000, height: 100000, originalSize: 1000000000 };
      const largeMetrics = calculateQualityMetrics(largePhoto);
      expect(largeMetrics.resolution).toBe(10000000000);
      expect(largeMetrics.overall).toBeLessThanOrEqual(100);
    });
  });

  describe('detectBurstSequence', () => {
    it('should correctly identify burst sequences within time window', () => {
      const baseTime = new Date('2024-01-01T00:00:00.000Z');
      
      // 3 photos within 3 seconds - should be burst
      const burstPhotos = [
        { createdAt: baseTime },
        { createdAt: new Date(baseTime.getTime() + 1000) },
        { createdAt: new Date(baseTime.getTime() + 2000) },
      ];
      
      expect(detectBurstSequence(burstPhotos, 3)).toBe(true);
    });

    it('should reject sequences outside time window', () => {
      const baseTime = new Date('2024-01-01T00:00:00.000Z');
      
      // 3 photos over 5 seconds - should not be burst with 3s window
      const nonBurstPhotos = [
        { createdAt: baseTime },
        { createdAt: new Date(baseTime.getTime() + 2000) },
        { createdAt: new Date(baseTime.getTime() + 5000) },
      ];
      
      expect(detectBurstSequence(nonBurstPhotos, 3)).toBe(false);
    });

    it('should reject sequences with insufficient photos', () => {
      const baseTime = new Date('2024-01-01T00:00:00.000Z');
      
      // Only 2 photos - should never be burst
      const twoPhotos = [
        { createdAt: baseTime },
        { createdAt: new Date(baseTime.getTime() + 1000) },
      ];
      
      expect(detectBurstSequence(twoPhotos, 3)).toBe(false);
      
      // Empty array
      expect(detectBurstSequence([], 3)).toBe(false);
      
      // Single photo
      expect(detectBurstSequence([{ createdAt: baseTime }], 3)).toBe(false);
    });

    it('should handle photos exactly at time window boundary', () => {
      const baseTime = new Date('2024-01-01T00:00:00.000Z');
      
      // Exactly 3 seconds apart - should be burst with 3s window
      const boundaryPhotos = [
        { createdAt: baseTime },
        { createdAt: new Date(baseTime.getTime() + 3000) },
        { createdAt: new Date(baseTime.getTime() + 3000) },
      ];
      
      expect(detectBurstSequence(boundaryPhotos, 3)).toBe(true);
    });

    it('should handle unsorted photo arrays', () => {
      const baseTime = new Date('2024-01-01T00:00:00.000Z');
      
      // Unsorted but within time window
      const unsortedPhotos = [
        { createdAt: new Date(baseTime.getTime() + 2000) }, // middle
        { createdAt: baseTime }, // first
        { createdAt: new Date(baseTime.getTime() + 1000) }, // second
      ];
      
      expect(detectBurstSequence(unsortedPhotos, 3)).toBe(true);
    });
  });

  describe('findDuplicatePhotos - Integration Tests', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      
      // Setup mock database to return empty results
      const { db } = require('../db');
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
    });

    it('should handle empty photo sets gracefully', async () => {
      const result = await findDuplicatePhotos('nonexistent-user');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should accept custom configuration', async () => {
      const config: Partial<DuplicateDetectionConfig> = {
        hammingThreshold: 5,
        burstTimeWindow: 10,
        minBurstSize: 5,
      };
      
      const result = await findDuplicatePhotos('nonexistent-user', config);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('resolveDuplicateGroups - Integration Tests', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      
      // Setup mock database for resolve operations
      const { db } = require('../db');
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
    });

    it('should handle empty resolution arrays', async () => {
      const result = await resolveDuplicateGroups('test-user', []);
      expect(result.resolved).toBe(0);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate photo ownership', async () => {
      const resolutions = [
        {
          groupId: 'test-group',
          keepPhotoIds: ['nonexistent-photo'],
          deletePhotoIds: ['another-nonexistent-photo'],
        },
      ];
      
      const result = await resolveDuplicateGroups('test-user', resolutions);
      expect(result.resolved).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle mixed valid and invalid resolutions', async () => {
      const resolutions = [
        {
          groupId: 'test-group-1',
          keepPhotoIds: [],
          deletePhotoIds: ['nonexistent-photo'],
        },
        {
          groupId: 'test-group-2',
          keepPhotoIds: [],
          deletePhotoIds: [],
        },
      ];
      
      const result = await resolveDuplicateGroups('test-user', resolutions);
      expect(result.resolved).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('updateDuplicateGroups - Integration Tests', () => {
    beforeEach(() => {
      // Setup mock database for update operations
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
    });

    it('should handle non-existent photos gracefully', async () => {
      // Should not throw error for non-existent photos
      await expect(updateDuplicateGroups('test-user', 'nonexistent-photo')).resolves.not.toThrow();
    });

    it('should handle photos without hashes', async () => {
      // Should not throw error for photos without perceptual hashes
      await expect(updateDuplicateGroups('test-user', 'photo-without-hash')).resolves.not.toThrow();
    });
  });
});

describe('Duplicate Detection Service - Algorithm Properties', () => {
  describe('Hamming Distance Properties', () => {
    it('should be deterministic', () => {
      const hash1 = '1234567890ABCDEF';
      const hash2 = 'FEDCBA0987654321';
      
      const distance1 = calculateHammingDistance(hash1, hash2);
      const distance2 = calculateHammingDistance(hash1, hash2);
      const distance3 = calculateHammingDistance(hash1, hash2);
      
      expect(distance1).toBe(distance2);
      expect(distance2).toBe(distance3);
    });

    it('should be non-negative', () => {
      const testCases = [
        ['1234567890ABCDEF', 'FEDCBA0987654321'],
        ['0000000000000000', 'FFFFFFFFFFFFFFFF'],
        ['ABCDEF1234567890', 'ABCDEF1234567890'],
        ['12345678', '87654321'],
      ];

      for (const [hash1, hash2] of testCases) {
        const distance = calculateHammingDistance(hash1, hash2);
        expect(distance).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle different length inputs correctly', () => {
      expect(calculateHammingDistance('1234', '12345678')).toBe(Infinity);
      expect(calculateHammingDistance('12345678', '1234')).toBe(Infinity);
      expect(calculateHammingDistance('', '1234')).toBe(Infinity);
      expect(calculateHammingDistance('1234', '')).toBe(Infinity);
    });
  });

  describe('Quality Metrics Properties', () => {
    it('should produce scores in expected ranges', () => {
      const photo = { width: 1920, height: 1080, originalSize: 5000000 };
      const metrics = calculateQualityMetrics(photo);
      
      expect(metrics.resolution).toBeGreaterThan(0);
      expect(metrics.fileSize).toBeGreaterThanOrEqual(0);
      expect(metrics.sharpness).toBeGreaterThanOrEqual(0);
      expect(metrics.overall).toBeGreaterThanOrEqual(0);
      expect(metrics.overall).toBeLessThanOrEqual(100);
    });

    it('should handle zero values gracefully', () => {
      const photo = { width: 0, height: 0, originalSize: 0 };
      const metrics = calculateQualityMetrics(photo);
      
      expect(metrics.resolution).toBe(0);
      expect(metrics.fileSize).toBe(0);
      expect(typeof metrics.sharpness).toBe('number');
      expect(typeof metrics.overall).toBe('number');
    });
  });

  describe('Burst Detection Properties', () => {
    it('should be time window dependent', () => {
      const baseTime = new Date('2024-01-01T00:00:00.000Z');
      const photos = [
        { createdAt: baseTime },
        { createdAt: new Date(baseTime.getTime() + 2000) },
        { createdAt: new Date(baseTime.getTime() + 4000) },
      ];
      
      // Should be burst with 5s window
      expect(detectBurstSequence(photos, 5)).toBe(true);
      
      // Should not be burst with 3s window
      expect(detectBurstSequence(photos, 3)).toBe(false);
    });

    it('should be photo count dependent', () => {
      const baseTime = new Date('2024-01-01T00:00:00.000Z');
      
      const twoPhotos = [
        { createdAt: baseTime },
        { createdAt: new Date(baseTime.getTime() + 1000) },
      ];
      
      const threePhotos = [
        { createdAt: baseTime },
        { createdAt: new Date(baseTime.getTime() + 1000) },
        { createdAt: new Date(baseTime.getTime() + 2000) },
      ];
      
      // Same time window, different photo counts
      expect(detectBurstSequence(twoPhotos, 3)).toBe(false);
      expect(detectBurstSequence(threePhotos, 3)).toBe(true);
    });
  });
});
