// AI-META-BEGIN
// AI-META: Storage usage calculation service for managing photo storage by category
// OWNERSHIP: server/services
// ENTRYPOINTS: imported by storage-routes.ts for API endpoints
// DEPENDENCIES: drizzle-orm, ../shared/schema, ./db
// DANGER: Performance-critical for large photo libraries; efficient queries required
// CHANGE-SAFETY: Maintain storage category consistency and calculation accuracy
// TESTS: Property tests for calculation algorithms, integration tests for API endpoints
// AI-META-END

import { db } from '../db';
import { photos, storageUsage, users } from '../../shared/schema';
import { eq, and, sum, count, gte, lte, desc, isNull, isNotNull } from 'drizzle-orm';

/**
 * Storage category types for tracking usage
 */
export type StorageCategory = 'photos' | 'videos' | 'thumbnails' | 'cache';

/**
 * Storage usage statistics for a category
 */
export interface StorageUsageStats {
  /** Storage category */
  category: StorageCategory;
  /** Total bytes used in this category */
  bytesUsed: number;
  /** Number of items in this category */
  itemCount: number;
  /** Percentage of total storage */
  percentage: number;
  /** Last calculated timestamp */
  calculatedAt: Date;
}

/**
 * Complete storage breakdown for a user
 */
export interface StorageBreakdown {
  /** Total storage used across all categories */
  totalBytesUsed: number;
  /** Total number of items */
  totalItemCount: number;
  /** Storage limit in bytes (null if unlimited) */
  storageLimit: number | null;
  /** Usage by category */
  categories: StorageUsageStats[];
  /** Large files (>10MB) */
  largeFiles: Array<{
    id: string;
    filename: string;
    size: number | null;
    uri: string;
    isVideo: boolean;
  }>;
  /** Compression statistics */
  compressionStats: {
    /** Total original size */
    originalTotal: number;
    /** Total compressed size */
    compressedTotal: number;
    /** Compression ratio (original/compressed) */
    compressionRatio: number;
    /** Number of compressed files */
    compressedCount: number;
  };
}

/**
 * Configuration for storage management
 */
export interface StorageConfig {
  /** Storage limit per user in bytes (null for unlimited) */
  storageLimit: number | null;
  /** Large file threshold in bytes */
  largeFileThreshold: number;
  /** Compression quality (0.1-1.0) */
  compressionQuality: number;
  /** Auto-cleanup threshold (percentage) */
  autoCleanupThreshold: number;
}

/**
 * Default storage configuration
 */
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  storageLimit: 5 * 1024 * 1024 * 1024, // 5GB
  largeFileThreshold: 10 * 1024 * 1024, // 10MB
  compressionQuality: 0.8,
  autoCleanupThreshold: 0.9, // 90%
};

/**
 * Service for managing storage usage calculations and limits
 */
export class StorageUsageService {
  private config: StorageConfig;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...DEFAULT_STORAGE_CONFIG, ...config };
  }

  /**
   * Calculate storage usage for a specific category
   */
  async calculateCategoryUsage(
    userId: string,
    category: StorageCategory
  ): Promise<StorageUsageStats> {
    const query = this.buildCategoryQuery(userId, category);
    const result = await query.execute();

    const bytesUsed = Number(result[0]?.bytesUsed || 0);
    const itemCount = Number(result[0]?.itemCount || 0);

    // Get total usage for percentage calculation
    const totalResult = await this.getTotalUsageQuery(userId).execute();
    const totalBytesUsed = Number(totalResult[0]?.bytesUsed || 0);
    const percentage = totalBytesUsed > 0 ? (bytesUsed / totalBytesUsed) * 100 : 0;

    return {
      category,
      bytesUsed,
      itemCount,
      percentage,
      calculatedAt: new Date(),
    };
  }

  /**
   * Get complete storage breakdown for a user
   */
  async getStorageBreakdown(userId: string): Promise<StorageBreakdown> {
    // Calculate usage for all categories
    const categories: StorageUsageStats[] = [];
    let totalBytesUsed = 0;
    let totalItemCount = 0;

    for (const category of ['photos', 'videos', 'thumbnails', 'cache'] as StorageCategory[]) {
      const stats = await this.calculateCategoryUsage(userId, category);
      categories.push(stats);
      totalBytesUsed += stats.bytesUsed;
      totalItemCount += stats.itemCount;
    }

    // Get large files
    const largeFiles = await this.getLargeFiles(userId);

    // Get compression statistics
    const compressionStats = await this.getCompressionStats(userId);

    return {
      totalBytesUsed,
      totalItemCount,
      storageLimit: this.config.storageLimit,
      categories,
      largeFiles,
      compressionStats,
    };
  }

  /**
   * Update storage usage records for a user
   */
  async updateStorageUsage(userId: string): Promise<void> {
    const categories: StorageCategory[] = ['photos', 'videos', 'thumbnails', 'cache'];

    for (const category of categories) {
      const stats = await this.calculateCategoryUsage(userId, category);

      // Upsert storage usage record
      await db
        .insert(storageUsage)
        .values({
          userId,
          category,
          bytesUsed: stats.bytesUsed,
          itemCount: stats.itemCount,
          calculatedAt: stats.calculatedAt,
        })
        .onConflictDoUpdate({
          target: [storageUsage.userId, storageUsage.category],
          set: {
            bytesUsed: stats.bytesUsed,
            itemCount: stats.itemCount,
            calculatedAt: stats.calculatedAt,
            updatedAt: new Date(),
          },
        });
    }
  }

  /**
   * Check if user is approaching storage limit
   */
  async isNearStorageLimit(userId: string): Promise<boolean> {
    if (!this.config.storageLimit) return false;

    const breakdown = await this.getStorageBreakdown(userId);
    const usagePercentage = (breakdown.totalBytesUsed / this.config.storageLimit) * 100;
    return usagePercentage >= this.config.autoCleanupThreshold;
  }

  /**
   * Get files that can be safely freed up
   */
  async getFilesForCleanup(userId: string): Promise<string[]> {
    // Get non-favorite photos older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const oldPhotos = await db
      .select({ id: photos.id })
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          eq(photos.isFavorite, false),
          lte(photos.createdAt, thirtyDaysAgo),
          isNull(photos.deletedAt)
        )
      )
      .orderBy(desc(photos.createdAt))
      .limit(100)
      .execute();

    return oldPhotos.map(p => p.id);
  }

  /**
   * Get compression candidates (large uncompressed photos)
   */
  async getCompressionCandidates(userId: string): Promise<string[]> {
    const candidates = await db
      .select({ id: photos.id })
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          gte(photos.originalSize, this.config.largeFileThreshold),
          isNull(photos.compressedSize),
          eq(photos.isVideo, false),
          isNull(photos.deletedAt)
        )
      )
      .orderBy(desc(photos.originalSize))
      .limit(50)
      .execute();

    return candidates.map(p => p.id);
  }

  /**
   * Build query for category-specific usage
   */
  private buildCategoryQuery(userId: string, category: StorageCategory) {
    switch (category) {
      case 'photos':
        return db
          .select({
            bytesUsed: sum(photos.originalSize).mapWith(Number),
            itemCount: count(photos.id).mapWith(Number),
          })
          .from(photos)
          .where(
            and(
              eq(photos.userId, userId),
              eq(photos.isVideo, false),
              isNull(photos.deletedAt)
            )
          );

      case 'videos':
        return db
          .select({
            bytesUsed: sum(photos.originalSize).mapWith(Number),
            itemCount: count(photos.id).mapWith(Number),
          })
          .from(photos)
          .where(
            and(
              eq(photos.userId, userId),
              eq(photos.isVideo, true),
              isNull(photos.deletedAt)
            )
          );

      case 'thumbnails':
        // For thumbnails, estimate based on photo count
        return db
          .select({
            bytesUsed: sum(photos.originalSize).mapWith(Number),
            itemCount: count(photos.id).mapWith(Number),
          })
          .from(photos)
          .where(
            and(
              eq(photos.userId, userId),
              isNull(photos.deletedAt)
            )
          );

      case 'cache':
        // Cache is estimated as 5% of total usage
        return this.getTotalUsageQuery(userId);

      default:
        throw new Error(`Unknown storage category: ${category}`);
    }
  }

  /**
   * Get total usage query
   */
  private getTotalUsageQuery(userId: string) {
    return db
      .select({
        bytesUsed: sum(photos.originalSize).mapWith(Number),
        itemCount: count(photos.id).mapWith(Number),
      })
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          isNull(photos.deletedAt)
        )
      );
  }

  /**
   * Get large files for a user
   */
  private async getLargeFiles(userId: string) {
    return db
      .select({
        id: photos.id,
        filename: photos.filename,
        size: photos.originalSize,
        uri: photos.uri,
        isVideo: photos.isVideo,
      })
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          gte(photos.originalSize, this.config.largeFileThreshold),
          isNull(photos.deletedAt)
        )
      )
      .orderBy(desc(photos.originalSize))
      .limit(20)
      .execute();
  }

  /**
   * Get compression statistics
   */
  private async getCompressionStats(userId: string) {
    const stats = await db
      .select({
        originalTotal: sum(photos.originalSize).mapWith(Number),
        compressedTotal: sum(photos.compressedSize).mapWith(Number),
        compressedCount: count(photos.compressedSize).mapWith(Number),
      })
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          isNotNull(photos.compressedSize),
          isNull(photos.deletedAt)
        )
      )
      .execute();

    const originalTotal = Number(stats[0]?.originalTotal || 0);
    const compressedTotal = Number(stats[0]?.compressedTotal || 0);
    const compressedCount = Number(stats[0]?.compressedCount || 0);

    return {
      originalTotal,
      compressedTotal,
      compressionRatio: originalTotal > 0 ? originalTotal / compressedTotal : 1,
      compressedCount,
    };
  }
}

/**
 * Default storage service instance
 */
export const storageUsageService = new StorageUsageService();
