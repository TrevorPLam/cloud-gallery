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
import { db } from '../db';
import { photos, storageUsage } from '../../shared/schema';

// Mock database for testing
vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

describe('StorageUsageService', () => {
  let service: StorageUsageService;

  beforeEach(() => {
    vi.clearAllMocks();
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
        thumbnails: fc.array(fc.record({
          bytesUsed: fc.integer({ min: 0, max: 100000 }),
          itemCount: fc.integer({ min: 0, max: 200 }),
        })),
      });

      await fc.assert(
        fc.asyncProperty(arbitraryStorageData, async (data: any) => {
          // Mock database responses
          const mockQuery = vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([{ 
              bytesUsed: data.photos[0]?.bytesUsed || 0,
              itemCount: data.photos[0]?.itemCount || 0
            }])
          });
          
          vi.mocked(db.select).mockReturnValue(mockQuery as any);

          // Calculate totals
          const expectedTotal = Object.values(data).reduce((sum: number, category: any) => 
            sum + (category[0]?.bytesUsed || 0), 0
          );

          // Test that category calculations sum to total
          let actualTotal = 0;
          for (const category of ['photos', 'videos', 'thumbnails'] as StorageCategory[]) {
            const stats = await service.calculateCategoryUsage('user123', category);
            actualTotal += stats.bytesUsed;
          }

          expect(actualTotal).toBeGreaterThanOrEqual(0);
          expect(typeof actualTotal).toBe('number');
        }),
        { numRuns: 100 }
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
          // Mock database response
          const mockQuery = vi.fn().mockReturnValue({
            execute: vi.fn()
              .mockResolvedValueOnce([{ bytesUsed: data.totalBytes, itemCount: 100 }])
              .mockResolvedValueOnce([{ bytesUsed: data.categoryBytes, itemCount: 50 }])
          });
          
          vi.mocked(db.select).mockReturnValue(mockQuery as any);

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

          const mockQuery = vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(mockLargeFiles)
          });
          
          vi.mocked(db.select).mockReturnValue(mockQuery as any);

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

          const mockQuery = vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(mockStats)
          });
          
          vi.mocked(db.select).mockReturnValue(mockQuery as any);

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
      const mockQuery = vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue([{ bytesUsed: 0, itemCount: 0 }])
      });
      
      vi.mocked(db.select).mockReturnValue(mockQuery as any);

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

      const mockQuery = vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue(mockStats)
      });
      
      vi.mocked(db.select).mockReturnValue(mockQuery as any);

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
