// AI-META-BEGIN
// AI-META: Duplicate detection service using perceptual hashing and Hamming distance
// OWNERSHIP: server/services
// ENTRYPOINTS: imported by duplicate-routes.ts and photo upload flow
// DEPENDENCIES: drizzle-orm, ../shared/schema, ./db
// DANGER: Performance-critical algorithms; must handle large photo libraries efficiently
// CHANGE-SAFETY: Maintain hash comparison thresholds and grouping logic consistency
// TESTS: Property tests for algorithm correctness, integration tests for API endpoints
// AI-META-END

import { db } from "../db";
import { photos, insertPhotoSchema } from "../../shared/schema";
import {
  eq,
  and,
  isNull,
  isNotNull,
  desc,
  lt,
  gte,
  inArray,
} from "drizzle-orm";

/**
 * Configuration for duplicate detection
 */
export interface DuplicateDetectionConfig {
  /** Maximum Hamming distance for considering photos as duplicates (default: 2) */
  hammingThreshold: number;
  /** Maximum time difference in seconds for burst sequence detection (default: 3) */
  burstTimeWindow: number;
  /** Minimum number of photos for a burst sequence (default: 3) */
  minBurstSize: number;
}

/**
 * Photo quality metrics for best photo selection
 */
export interface PhotoQualityMetrics {
  /** Resolution score (higher is better) */
  resolution: number;
  /** File size score (higher is better) */
  fileSize: number;
  /** Sharpness estimate (higher is better) */
  sharpness: number;
  /** Overall quality score (higher is better) */
  overall: number;
}

/**
 * Duplicate group information
 */
export interface DuplicateGroup {
  /** Unique group identifier */
  groupId: string;
  /** Photos in this duplicate group */
  photos: {
    id: string;
    uri: string;
    filename: string;
    width: number;
    height: number;
    fileSize: number;
    createdAt: Date;
    perceptualHash?: string;
    qualityMetrics: PhotoQualityMetrics;
    isBest: boolean;
  }[];
  /** Group type: 'exact', 'similar', 'burst' */
  groupType: "exact" | "similar" | "burst";
  /** Average similarity within the group */
  averageSimilarity: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: DuplicateDetectionConfig = {
  hammingThreshold: 2,
  burstTimeWindow: 3,
  minBurstSize: 3,
};

/**
 * Calculate Hamming distance between two hexadecimal hash strings
 * Hamming distance = number of differing bits
 */
export function calculateHammingDistance(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) {
    return Infinity;
  }

  // Convert hex strings to BigInt for XOR operation
  const h1 = BigInt("0x" + hash1);
  const h2 = BigInt("0x" + hash2);

  // XOR the hashes and count set bits
  const xor = h1 ^ h2;

  // Count set bits using Kernighan's algorithm (convert to string for compatibility)
  const xorBinary = xor.toString(2);
  let count = 0;
  for (const bit of xorBinary) {
    if (bit === "1") count++;
  }

  return count;
}

/**
 * Calculate quality metrics for a photo
 * Higher scores indicate better quality
 */
export function calculateQualityMetrics(photo: {
  width: number;
  height: number;
  originalSize?: number;
}): PhotoQualityMetrics {
  const resolution = photo.width * photo.height;
  const fileSize = photo.originalSize || 0;

  // Normalize resolution score (0-100, higher is better)
  const resolutionScore = Math.min(100, (resolution / (1920 * 1080)) * 100);

  // Normalize file size score (0-100, higher is better)
  const fileSizeScore = Math.min(100, (fileSize / (5 * 1024 * 1024)) * 100); // 5MB as reference

  // Estimate sharpness based on resolution and aspect ratio
  const aspectRatio = photo.width / photo.height;
  const idealAspectRatio = 16 / 9;
  const aspectRatioScore = Math.max(
    0,
    100 - Math.abs(aspectRatio - idealAspectRatio) * 20,
  );

  // Overall quality score (weighted average)
  const overall =
    resolutionScore * 0.4 + fileSizeScore * 0.3 + aspectRatioScore * 0.3;

  return {
    resolution,
    fileSize,
    sharpness: aspectRatioScore,
    overall,
  };
}

/**
 * Detect if photos form a burst sequence based on timestamps
 */
export function detectBurstSequence(
  photos: { createdAt: Date }[],
  timeWindowSeconds: number,
): boolean {
  if (photos.length < 3) return false;

  // Sort by creation time
  const sortedPhotos = [...photos].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  // Check if all photos are within the time window
  const firstTime = sortedPhotos[0].createdAt.getTime();
  const lastTime = sortedPhotos[sortedPhotos.length - 1].createdAt.getTime();
  const timeDiffSeconds = (lastTime - firstTime) / 1000;

  return timeDiffSeconds <= timeWindowSeconds;
}

/**
 * Find duplicate photos for a user
 */
export async function findDuplicatePhotos(
  userId: string,
  config: Partial<DuplicateDetectionConfig> = {},
): Promise<DuplicateGroup[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Get all photos with perceptual hashes for the user
  const userPhotos = await db
    .select({
      id: photos.id,
      uri: photos.uri,
      filename: photos.filename,
      width: photos.width,
      height: photos.height,
      originalSize: photos.originalSize,
      createdAt: photos.createdAt,
      perceptualHash: photos.perceptualHash,
      duplicateGroupId: photos.duplicateGroupId,
    })
    .from(photos)
    .where(
      and(
        eq(photos.userId, userId),
        isNotNull(photos.perceptualHash),
        isNull(photos.deletedAt),
      ),
    )
    .orderBy(desc(photos.createdAt));

  if (userPhotos.length === 0) {
    return [];
  }

  // Group photos by similarity
  const groups: Map<string, typeof userPhotos> = new Map();
  const processed = new Set<string>();

  for (const photo of userPhotos) {
    if (processed.has(photo.id)) continue;

    const similarPhotos: typeof userPhotos = [photo];
    processed.add(photo.id);

    // Find similar photos
    for (const otherPhoto of userPhotos) {
      if (processed.has(otherPhoto.id)) continue;

      if (photo.perceptualHash && otherPhoto.perceptualHash) {
        const distance = calculateHammingDistance(
          photo.perceptualHash,
          otherPhoto.perceptualHash,
        );

        if (distance <= finalConfig.hammingThreshold) {
          similarPhotos.push(otherPhoto);
          processed.add(otherPhoto.id);
        }
      }
    }

    if (similarPhotos.length > 1) {
      const groupId =
        photo.duplicateGroupId ||
        `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      groups.set(groupId, similarPhotos);
    }
  }

  // Convert to DuplicateGroup format
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [groupId, groupPhotos] of Array.from(groups.entries())) {
    // Calculate quality metrics for each photo
    const photosWithMetrics = groupPhotos.map((photo) => ({
      ...photo,
      qualityMetrics: calculateQualityMetrics({
        width: photo.width,
        height: photo.height,
        originalSize: photo.originalSize || undefined,
      }),
      isBest: false, // Will be determined below
    }));

    // Determine best photo
    const bestPhoto = photosWithMetrics.reduce((best: any, current: any) =>
      current.qualityMetrics.overall > best.qualityMetrics.overall
        ? current
        : best,
    );
    bestPhoto.isBest = true;

    // Detect if this is a burst sequence
    const isBurst = detectBurstSequence(
      groupPhotos,
      finalConfig.burstTimeWindow,
    );

    // Calculate average similarity
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < groupPhotos.length; i++) {
      for (let j = i + 1; j < groupPhotos.length; j++) {
        if (groupPhotos[i].perceptualHash && groupPhotos[j].perceptualHash) {
          const distance = calculateHammingDistance(
            groupPhotos[i].perceptualHash!,
            groupPhotos[j].perceptualHash!,
          );
          const similarity = Math.max(0, 1 - distance / 64); // Normalize to 0-1
          totalSimilarity += similarity;
          comparisons++;
        }
      }
    }

    const averageSimilarity =
      comparisons > 0 ? totalSimilarity / comparisons : 0;

    // Determine group type
    let groupType: "exact" | "similar" | "burst" = "similar";
    if (isBurst && groupPhotos.length >= finalConfig.minBurstSize) {
      groupType = "burst";
    } else if (averageSimilarity >= 0.95) {
      groupType = "exact";
    }

    duplicateGroups.push({
      groupId,
      photos: photosWithMetrics.map(
        ({ duplicateGroupId: _groupId, ...photo }) => ({
          ...photo,
          fileSize: photo.originalSize || 0,
          perceptualHash: photo.perceptualHash || undefined,
        }),
      ),
      groupType,
      averageSimilarity,
    });
  }

  return duplicateGroups.sort(
    (a, b) => b.averageSimilarity - a.averageSimilarity,
  );
}

/**
 * Resolve duplicate groups by keeping selected photos and deleting others
 */
export async function resolveDuplicateGroups(
  userId: string,
  resolutions: {
    groupId: string;
    keepPhotoIds: string[];
    deletePhotoIds: string[];
  }[],
): Promise<{ resolved: number; errors: string[] }> {
  const errors: string[] = [];
  let resolved = 0;

  try {
    for (const resolution of resolutions) {
      // Verify ownership of all photos
      const photoIds = [
        ...resolution.keepPhotoIds,
        ...resolution.deletePhotoIds,
      ];

      if (photoIds.length === 0) {
        errors.push(`No photos specified for group ${resolution.groupId}`);
        continue;
      }

      const userPhotos = await db
        .select({ id: photos.id })
        .from(photos)
        .where(
          and(
            eq(photos.userId, userId),
            photoIds.length > 1
              ? inArray(photos.id, photoIds)
              : eq(photos.id, photoIds[0]),
          ),
        );

      if (userPhotos.length !== photoIds.length) {
        errors.push(
          `Some photos not found or not owned by user for group ${resolution.groupId}`,
        );
        continue;
      }

      // Soft delete photos marked for deletion
      if (resolution.deletePhotoIds.length > 0) {
        const updateSchema = insertPhotoSchema.partial();
        const validatedData = updateSchema.parse({
          deletedAt: new Date(),
          modifiedAt: new Date(),
          duplicateGroupId: null,
        });

        await db
          .update(photos)
          .set(validatedData)
          .where(
            and(
              eq(photos.userId, userId),
              resolution.deletePhotoIds.length > 1
                ? inArray(photos.id, resolution.deletePhotoIds)
                : eq(photos.id, resolution.deletePhotoIds[0]),
            ),
          );
      }

      // Clear duplicate group ID for kept photos
      if (resolution.keepPhotoIds.length > 0) {
        const updateSchema = insertPhotoSchema.partial();
        const validatedData = updateSchema.parse({
          duplicateGroupId: null,
          modifiedAt: new Date(),
        });

        await db
          .update(photos)
          .set(validatedData)
          .where(
            and(
              eq(photos.userId, userId),
              resolution.keepPhotoIds.length > 1
                ? inArray(photos.id, resolution.keepPhotoIds)
                : eq(photos.id, resolution.keepPhotoIds[0]),
            ),
          );
      }

      resolved++;
    }
  } catch (error) {
    errors.push(
      `Database error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  return { resolved, errors };
}

/**
 * Update duplicate groups for newly uploaded photos
 * This should be called after photo upload and ML analysis
 */
export async function updateDuplicateGroups(
  userId: string,
  photoId: string,
): Promise<void> {
  try {
    // Get the newly uploaded photo with its hash
    const newPhoto = await db
      .select({
        id: photos.id,
        perceptualHash: photos.perceptualHash,
        createdAt: photos.createdAt,
      })
      .from(photos)
      .where(and(eq(photos.userId, userId), eq(photos.id, photoId)))
      .limit(1);

    if (newPhoto.length === 0 || !newPhoto[0].perceptualHash) {
      return; // No hash available, skip duplicate detection
    }

    // Find existing photos with similar hashes
    const existingPhotos = await db
      .select({
        id: photos.id,
        perceptualHash: photos.perceptualHash,
        duplicateGroupId: photos.duplicateGroupId,
        createdAt: photos.createdAt,
      })
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          isNotNull(photos.perceptualHash),
          isNull(photos.deletedAt),
          lt(photos.createdAt, newPhoto[0].createdAt), // Only previous photos
        ),
      )
      .orderBy(desc(photos.createdAt));

    // Check for duplicates
    let foundDuplicate = false;
    let targetGroupId: string | null = null;

    for (const existingPhoto of existingPhotos) {
      if (existingPhoto.perceptualHash) {
        const distance = calculateHammingDistance(
          newPhoto[0].perceptualHash,
          existingPhoto.perceptualHash,
        );

        if (distance <= DEFAULT_CONFIG.hammingThreshold) {
          foundDuplicate = true;

          if (existingPhoto.duplicateGroupId) {
            // Join existing group
            targetGroupId = existingPhoto.duplicateGroupId;
          } else {
            // Create new group
            targetGroupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Update existing photo to join the group
            const updateSchema = insertPhotoSchema.partial();
            const validatedData = updateSchema.parse({
              duplicateGroupId: targetGroupId,
            });

            await db
              .update(photos)
              .set(validatedData)
              .where(eq(photos.id, existingPhoto.id));
          }
          break;
        }
      }
    }

    // Update new photo if duplicate found
    if (foundDuplicate && targetGroupId) {
      const updateSchema = insertPhotoSchema.partial();
      const validatedData = updateSchema.parse({
        duplicateGroupId: targetGroupId,
      });

      await db.update(photos).set(validatedData).where(eq(photos.id, photoId));
    }
  } catch (error) {
    console.error("Error updating duplicate groups:", error);
    // Don't throw - this is non-critical background processing
  }
}
