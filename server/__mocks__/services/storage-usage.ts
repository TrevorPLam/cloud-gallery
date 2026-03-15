import { vi } from "vitest";

export const storageUsageService = {
  getStorageBreakdown: vi.fn().mockResolvedValue({
    totalBytesUsed: 1000000,
    totalItemCount: 50,
    storageLimit: 5000000,
    categories: [
      {
        category: "photos",
        bytesUsed: 800000,
        itemCount: 40,
        percentage: 80,
        calculatedAt: new Date(),
      },
      {
        category: "videos",
        bytesUsed: 200000,
        itemCount: 10,
        percentage: 20,
        calculatedAt: new Date(),
      },
    ],
    largeFiles: [],
    compressionStats: {
      originalSize: 1200000,
      compressedSize: 960000,
      compressionRatio: 1.25,
      compressedCount: 30,
    },
  }),
  isNearStorageLimit: vi.fn().mockResolvedValue(false),
  getStorageRecommendations: vi.fn().mockResolvedValue([]),
  getLargeFiles: vi.fn().mockResolvedValue([]),
  compressPhotos: vi.fn().mockResolvedValue({
    compressed: [],
    errors: [],
    totalSaved: 0,
  }),
  freeUpSpace: vi.fn().mockResolvedValue({
    deleted: [],
    errors: [],
    totalFreed: 0,
  }),
  updateStorageUsage: vi.fn().mockResolvedValue(undefined),
  getFilesForCleanup: vi.fn().mockResolvedValue(["photo1", "photo2", "photo3"]),
  getCompressionCandidates: vi.fn().mockResolvedValue(["photo1", "photo2"]),
};

export const StorageUsageService = vi.fn();
export const StorageCategory = {};
