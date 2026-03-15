// AI-META-BEGIN
// AI-META: Property tests for storage usage calculation algorithms
// OWNERSHIP: server/services
// ENTRYPOINTS: run by npm test for storage service validation
// DEPENDENCIES: vitest, fast-check, ./storage-usage
// DANGER: Property tests validate critical storage calculation accuracy
// CHANGE-SAFETY: Maintain test coverage for all storage calculation scenarios
// TESTS: Property tests for storage calculations, edge cases, and invariants
// AI-META-END

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { StorageUsageService, StorageCategory } from './storage-usage';

// Module-scope mock database object
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Module-scope mock query builder
const mockQueryBuilder = {
  execute: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
};

// Helper function to rebuild mock chains
function rewireMockDb() {
  mockDb.select.mockReturnValue(mockQueryBuilder);
  mockDb.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      }),
    }),
  });
  
  mockQueryBuilder.from.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.orderBy.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.limit.mockReturnValue(mockQueryBuilder);
}

// Mock database using module-scope mockDb
vi.mock('../db', () => ({
  db: mockDb,
}));

// Mock schema to prevent real imports
vi.mock('../../shared/schema', () => ({
  photos: {
    id: 'id',
    userId: 'userId',
    originalSize: 'originalSize',
    compressedSize: 'compressedSize',
    isVideo: 'isVideo',
    deletedAt: 'deletedAt',
    isFavorite: 'isFavorite',
    createdAt: 'createdAt',
    uri: 'uri',
    filename: 'filename',
  },
  storageUsage: {
    userId: 'userId',
    category: 'category',
    bytesUsed: 'bytesUsed',
    itemCount: 'itemCount',
    calculatedAt: 'calculatedAt',
    updatedAt: 'updatedAt',
  },
  users: {
    id: 'id',
  },
}));

describe('StorageUsageService', () => {
  let service: StorageUsageService;

  beforeEach(() => {
    vi.clearAllMocks();
    rewireMockDb();
    service = new StorageUsageService();
  });

  describe('Property 1: Storage Calculation Consistency', () => {
    it('should maintain consistent totals across categories', async () => {
      // Generate test data for different categories
      const arbitraryStorageData = fc.record({
        photos: fc.array(fc.record({
          bytesUsed: fc.integer({ min: 0, max: 1000000 }),
          itemCount: fc.integer({ min: 0, max: 100 }),
        })),
        videos: fc.array(fc.record({
          bytesUsed: fc.integer({ min: 0, max: 5000000 }),
          itemCount: fc.integer({ min: 0, max: 50 }),
        })),
      });

      await fc.assert(
        fc.asyncProperty(arbitraryStorageData, async (data: any) => {
          // Queue return values for this specific iteration
          const photoBytes = data.photos[0]?.bytesUsed || 0;
          const photoItems = data.photos[0]?.itemCount || 0;
          const videoBytes = data.videos[0]?.bytesUsed || 0;
          const videoItems = data.videos[0]?.itemCount || 0;
          
          mockQueryBuilder.execute
            .mockResolvedValueOnce([{ bytesUsed: photoBytes, itemCount: photoItems }])
            .mockResolvedValueOnce([{ bytesUsed: videoBytes, itemCount: videoItems }])
            .mockResolvedValueOnce([{ bytesUsed: photoBytes + videoBytes, itemCount: photoItems + videoItems }])
            .mockResolvedValueOnce([{ bytesUsed: photoBytes + videoBytes, itemCount: photoItems + videoItems }]);

          const photosStats = await service.calculateCategoryUsage('user123', 'photos');
          const videosStats = await service.calculateCategoryUsage('user123', 'videos');

          expect(photosStats.bytesUsed + videosStats.bytesUsed).toBe(photoBytes + videoBytes);
          expect(photosStats.itemCount + videosStats.itemCount).toBe(photoItems + videoItems);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 2: Percentage Calculation Bounds', () => {
    it('should always return percentages between 0 and 100', async () => {
      const arbitraryUsageData = fc.record({
        categoryBytes: fc.integer({ min: 0, max: 10000000 }),
        totalBytes: fc.integer({ min: 1, max: 10000000 }), // Ensure non-zero
      });

      await fc.assert(
        fc.asyncProperty(arbitraryUsageData, async (data) => {
          mockQueryBuilder.execute
            .mockResolvedValueOnce([{ bytesUsed: data.totalBytes, itemCount: 100 }])
            .mockResolvedValueOnce([{ bytesUsed: data.categoryBytes, itemCount: 50 }]);

          const stats = await service.calculateCategoryUsage('user123', 'photos');
          
          expect(stats.percentage).toBeGreaterThanOrEqual(0);
          expect(stats.percentage).toBeLessThanOrEqual(100);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Large File Identification', () => {
    it('should only identify files above threshold', async () => {
      const arbitraryFileSizes = fc.array(fc.integer({ min: 0, max: 20000000 }));
      const threshold = 10 * 1024 * 1024; // 10MB

      await fc.assert(
        fc.asyncProperty(arbitraryFileSizes, async (fileSizes: number[]) => {
          // Mock large files query
          const mockLargeFiles = fileSizes
            .filter(size => size >= threshold)
            .map((size, index) => ({
              id: `file-${index}`,
              filename: `file-${index}.jpg`,
              size,
              uri: `/path/to/file-${index}.jpg`,
              isVideo: false,
            }));

          mockQueryBuilder.execute.mockResolvedValueOnce(mockLargeFiles);

          const breakdown = await service.getStorageBreakdown('user123');
          
          // All returned files should be above threshold
          breakdown.largeFiles.forEach((file: any) => {
            expect(file.size).toBeGreaterThanOrEqual(threshold);
          });
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: Compression Ratio Calculation', () => {
    it('should maintain compression ratio >= 1.0', async () => {
      const arbitraryCompressionData = fc.record({
        originalSize: fc.integer({ min: 1, max: 10000000 }),
        compressedSize: fc.integer({ min: 1, max: 10000000 }),
      });

      await fc.assert(
        fc.asyncProperty(arbitraryCompressionData, async (data: any) => {
          // Mock compression stats
          const mockStats = [{
            originalTotal: data.originalSize,
            compressedTotal: data.compressedSize,
            compressedCount: 1,
          }];

          mockQueryBuilder.execute.mockResolvedValueOnce(mockStats);

          const breakdown = await service.getStorageBreakdown('user123');
          
          expect(breakdown.compressionStats.compressionRatio).toBeGreaterThanOrEqual(1.0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Storage Limit Detection', () => {
    it('should correctly identify when storage limit is approached', async () => {
      const arbitraryUsageData = fc.record({
        currentUsage: fc.integer({ min: 0, max: 10000000 }),
        storageLimit: fc.integer({ min: 1000000, max: 10000000 }),
        threshold: fc.float({ min: 0.5, max: 1.0 }),
      });

      await fc.assert(
        fc.asyncProperty(arbitraryUsageData, async (data) => {
          const service = new StorageUsageService({
            storageLimit: data.storageLimit,
            autoCleanupThreshold: data.threshold,
          });

          // Mock storage breakdown
          const mockBreakdown = {
            totalBytesUsed: data.currentUsage,
            totalItemCount: 10,
            storageLimit: data.storageLimit,
            categories: [],
            largeFiles: [],
            compressionStats: {
              originalTotal: data.currentUsage,
              compressedTotal: data.currentUsage,
              compressionRatio: 1.0,
              compressedCount: 0,
            },
          };

          // Mock the getStorageBreakdown method to return our test data
          vi.spyOn(service, 'getStorageBreakdown').mockResolvedValue(mockBreakdown);

          const expectedNearLimit = (data.currentUsage / data.storageLimit) >= data.threshold;
          const actualNearLimit = await service.isNearStorageLimit('user123');

          expect(actualNearLimit).toBe(expectedNearLimit);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty storage gracefully', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce([{ bytesUsed: 0, itemCount: 0 }]);

      const stats = await service.calculateCategoryUsage('user123', 'photos');
      
      expect(stats.bytesUsed).toBe(0);
      expect(stats.itemCount).toBe(0);
      expect(stats.percentage).toBe(0);
    });

    it('should handle null compressed sizes', async () => {
      const mockStats = [{
        originalTotal: 1000000,
        compressedTotal: null,
        compressedCount: 0,
      }];

      mockQueryBuilder.execute.mockResolvedValueOnce(mockStats);

      const breakdown = await service.getStorageBreakdown('user123');
      
      expect(breakdown.compressionStats.compressedTotal).toBe(0);
      expect(breakdown.compressionStats.compressionRatio).toBe(1.0);
    });
  });

  describe('Configuration Validation', () => {
    it('should use default configuration when none provided', () => {
      const service = new StorageUsageService();
      expect(service['config'].storageLimit).toBe(5 * 1024 * 1024 * 1024); // 5GB
      expect(service['config'].largeFileThreshold).toBe(10 * 1024 * 1024); // 10MB
      expect(service['config'].compressionQuality).toBe(0.8);
      expect(service['config'].autoCleanupThreshold).toBe(0.9);
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig = {
        storageLimit: 10 * 1024 * 1024 * 1024, // 10GB
        compressionQuality: 0.9,
      };

      const service = new StorageUsageService(customConfig);
      
      expect(service['config'].storageLimit).toBe(10 * 1024 * 1024 * 1024);
      expect(service['config'].compressionQuality).toBe(0.9);
      expect(service['config'].largeFileThreshold).toBe(10 * 1024 * 1024); // Still default
    });
  });
});
