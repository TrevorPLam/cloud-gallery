// AI-META-BEGIN
// AI-META: Burst photo detection using EXIF metadata and temporal clustering
// OWNERSHIP: client/lib/photo
// ENTRYPOINTS: imported by photo stacking service and gallery screens
// DEPENDENCIES: react-native-exify, expo-image-picker
// DANGER: EXIF parsing requires proper error handling for various camera formats
// CHANGE-SAFETY: Add new clustering algorithms by extending BurstDetector class
// TESTS: client/lib/photo/burst-detection.test.ts
// AI-META-END

import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────
// TYPES AND INTERFACES
// ─────────────────────────────────────────────────────────

export interface PhotoMetadata {
  id: string;
  uri: string;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Camera make/model if available */
  cameraInfo?: {
    make: string;
    model: string;
  };
  /** EXIF timestamp if available */
  exifTimestamp?: number;
  /** File creation timestamp */
  fileTimestamp: number;
  /** Sequence number if available */
  sequenceNumber?: number;
  /** Whether this is likely a burst photo */
  isBurstCandidate?: boolean;
}

export interface BurstGroup {
  /** Unique identifier for the burst group */
  id: string;
  /** Array of photo IDs in this burst */
  photoIds: string[];
  /** Timestamp of first photo in burst */
  startTime: number;
  /** Timestamp of last photo in burst */
  endTime: number;
  /** Duration of burst in milliseconds */
  duration: number;
  /** Number of photos in burst */
  count: number;
  /** Average interval between photos */
  avgInterval: number;
  /** Confidence score (0-1) that this is a real burst */
  confidence: number;
  /** Type of burst */
  type: "temporal" | "sequence" | "mixed";
}

export interface BurstDetectionConfig {
  /** Maximum time gap between burst photos (milliseconds) */
  maxTimeGap: number;
  /** Minimum photos to form a burst */
  minBurstSize: number;
  /** Maximum burst duration (milliseconds) */
  maxBurstDuration: number;
  /** Confidence threshold for burst detection */
  confidenceThreshold: number;
  /** Whether to use sequence numbers if available */
  useSequenceNumbers: boolean;
}

export interface ClusterAnalysis {
  /** Total number of photos analyzed */
  totalPhotos: number;
  /** Number of burst groups found */
  burstGroups: number;
  /** Number of photos in bursts */
  photosInBursts: number;
  /** Percentage of photos in bursts */
  burstCoverage: number;
  /** Average burst size */
  avgBurstSize: number;
  /** Average burst duration */
  avgBurstDuration: number;
}

// ─────────────────────────────────────────────────────────
// BURST DETECTOR CLASS
// ─────────────────────────────────────────────────────────

export class BurstDetector {
  private static readonly DEFAULT_CONFIG: BurstDetectionConfig = {
    maxTimeGap: 2000, // 2 seconds
    minBurstSize: 2,
    maxBurstDuration: 10000, // 10 seconds
    confidenceThreshold: 0.7,
    useSequenceNumbers: true,
  };

  private config: BurstDetectionConfig;

  constructor(config: Partial<BurstDetectionConfig> = {}) {
    this.config = { ...BurstDetector.DEFAULT_CONFIG, ...config };
  }

  // ─── PUBLIC BURST DETECTION METHODS ─────────────────────

  /**
   * Detect burst groups from an array of photos
   * Uses temporal clustering and sequence number analysis
   */
  public async detectBursts(photos: PhotoMetadata[]): Promise<BurstGroup[]> {
    if (photos.length < this.config.minBurstSize) {
      return [];
    }

    // Sort photos by timestamp
    const sortedPhotos = [...photos].sort((a, b) => a.timestamp - b.timestamp);

    // Detect bursts using different strategies
    const temporalBursts = await this.detectTemporalBursts(sortedPhotos);
    const sequenceBursts = await this.detectSequenceBursts(sortedPhotos);

    // Merge overlapping bursts
    const mergedBursts = this.mergeBurstGroups([
      ...temporalBursts,
      ...sequenceBursts,
    ]);

    // Filter by confidence and duration
    return mergedBursts.filter(
      (burst) =>
        burst.confidence >= this.config.confidenceThreshold &&
        burst.duration <= this.config.maxBurstDuration &&
        burst.count >= this.config.minBurstSize,
    );
  }

  /**
   * Analyze photo collection for burst patterns
   * Returns comprehensive statistics about burst behavior
   */
  public analyzeBurstPatterns(photos: PhotoMetadata[]): ClusterAnalysis {
    const bursts = this.detectBurstsSync(photos);

    const photosInBursts = bursts.reduce((sum, burst) => sum + burst.count, 0);
    const totalPhotos = photos.length;

    return {
      totalPhotos,
      burstGroups: bursts.length,
      photosInBursts,
      burstCoverage: totalPhotos > 0 ? (photosInBursts / totalPhotos) * 100 : 0,
      avgBurstSize:
        bursts.length > 0
          ? bursts.reduce((sum, b) => sum + b.count, 0) / bursts.length
          : 0,
      avgBurstDuration:
        bursts.length > 0
          ? bursts.reduce((sum, b) => sum + b.duration, 0) / bursts.length
          : 0,
    };
  }

  /**
   * Check if a single photo is likely part of a burst
   * Based on proximity to other photos
   */
  public async isBurstPhoto(
    photo: PhotoMetadata,
    allPhotos: PhotoMetadata[],
  ): Promise<boolean> {
    const nearbyPhotos = allPhotos.filter(
      (other) =>
        other.id !== photo.id &&
        Math.abs(other.timestamp - photo.timestamp) <= this.config.maxTimeGap,
    );

    return nearbyPhotos.length >= this.config.minBurstSize - 1;
  }

  /**
   * Group photos by burst sessions
   * Returns both burst groups and individual photos
   */
  public async groupPhotosByBurst(photos: PhotoMetadata[]): Promise<{
    bursts: BurstGroup[];
    individuals: PhotoMetadata[];
  }> {
    const bursts = await this.detectBursts(photos);
    const burstPhotoIds = new Set(bursts.flatMap((burst) => burst.photoIds));

    const individuals = photos.filter((photo) => !burstPhotoIds.has(photo.id));

    return { bursts, individuals };
  }

  // ─── PRIVATE DETECTION ALGORITHMS ───────────────────────

  private async detectTemporalBursts(
    photos: PhotoMetadata[],
  ): Promise<BurstGroup[]> {
    const bursts: BurstGroup[] = [];
    let currentBurst: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];

      if (currentBurst.length === 0) {
        // Start new burst
        currentBurst.push(photo.id);
      } else {
        // Check time gap from previous photo
        const previousPhoto = photos.find(
          (p) => p.id === currentBurst[currentBurst.length - 1],
        );
        const timeGap = previousPhoto
          ? photo.timestamp - previousPhoto.timestamp
          : Infinity;

        if (timeGap <= this.config.maxTimeGap) {
          // Continue current burst
          currentBurst.push(photo.id);
        } else {
          // End current burst and start new one
          if (currentBurst.length >= this.config.minBurstSize) {
            bursts.push(
              this.createBurstGroup(currentBurst, photos, "temporal"),
            );
          }
          currentBurst = [photo.id];
        }
      }
    }

    // Handle final burst
    if (currentBurst.length >= this.config.minBurstSize) {
      bursts.push(this.createBurstGroup(currentBurst, photos, "temporal"));
    }

    return bursts;
  }

  private async detectSequenceBursts(
    photos: PhotoMetadata[],
  ): Promise<BurstGroup[]> {
    if (!this.config.useSequenceNumbers) {
      return [];
    }

    // Group photos by sequence numbers
    const sequenceGroups = new Map<string, string[]>();

    photos.forEach((photo) => {
      if (photo.sequenceNumber) {
        const key = `${photo.cameraInfo?.make || "unknown"}_${photo.cameraInfo?.model || "unknown"}_${photo.sequenceNumber}`;
        if (!sequenceGroups.has(key)) {
          sequenceGroups.set(key, []);
        }
        sequenceGroups.get(key)!.push(photo.id);
      }
    });

    const bursts: BurstGroup[] = [];

    sequenceGroups.forEach((photoIds) => {
      if (photoIds.length >= this.config.minBurstSize) {
        bursts.push(this.createBurstGroup(photoIds, photos, "sequence"));
      }
    });

    return bursts;
  }

  private createBurstGroup(
    photoIds: string[],
    allPhotos: PhotoMetadata[],
    type: "temporal" | "sequence" | "mixed",
  ): BurstGroup {
    const burstPhotos = allPhotos.filter((photo) =>
      photoIds.includes(photo.id),
    );
    burstPhotos.sort((a, b) => a.timestamp - b.timestamp);

    const startTime = burstPhotos[0].timestamp;
    const endTime = burstPhotos[burstPhotos.length - 1].timestamp;
    const duration = endTime - startTime;

    // Calculate average interval
    const intervals: number[] = [];
    for (let i = 1; i < burstPhotos.length; i++) {
      intervals.push(burstPhotos[i].timestamp - burstPhotos[i - 1].timestamp);
    }
    const avgInterval =
      intervals.length > 0
        ? intervals.reduce((sum, interval) => sum + interval, 0) /
          intervals.length
        : 0;

    // Calculate confidence based on consistency and duration
    const confidence = this.calculateBurstConfidence(
      burstPhotos,
      avgInterval,
      duration,
    );

    return {
      id: `burst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      photoIds,
      startTime,
      endTime,
      duration,
      count: photoIds.length,
      avgInterval,
      confidence,
      type,
    };
  }

  private calculateBurstConfidence(
    photos: PhotoMetadata[],
    avgInterval: number,
    duration: number,
  ): number {
    let confidence = 0.5; // Base confidence

    // Factor 1: Consistency of intervals (lower variance = higher confidence)
    if (photos.length > 2) {
      const intervals: number[] = [];
      for (let i = 1; i < photos.length; i++) {
        intervals.push(photos[i].timestamp - photos[i - 1].timestamp);
      }

      const variance =
        intervals.reduce((sum, interval) => {
          const diff = interval - avgInterval;
          return sum + diff * diff;
        }, 0) / intervals.length;

      const stdDev = Math.sqrt(variance);
      const consistencyScore = Math.max(0, 1 - stdDev / avgInterval);
      confidence += consistencyScore * 0.3;
    }

    // Factor 2: Duration score (optimal duration is 1-5 seconds)
    const optimalDuration = 3000; // 3 seconds
    const durationScore = Math.exp(
      -Math.pow(duration - optimalDuration, 2) / (2 * 2000 * 2000),
    );
    confidence += durationScore * 0.2;

    // Factor 3: Size score (more photos = higher confidence, up to a point)
    const sizeScore = Math.min(photos.length / 10, 1);
    confidence += sizeScore * 0.2;

    return Math.min(confidence, 1);
  }

  private mergeBurstGroups(bursts: BurstGroup[]): BurstGroup[] {
    if (bursts.length <= 1) {
      return bursts;
    }

    // Sort by start time
    const sortedBursts = [...bursts].sort((a, b) => a.startTime - b.startTime);
    const merged: BurstGroup[] = [];

    for (const burst of sortedBursts) {
      const lastMerged = merged[merged.length - 1];

      if (!lastMerged || !this.doBurstsOverlap(lastMerged, burst)) {
        // No overlap, add as new burst
        merged.push(burst);
      } else {
        // Overlap detected, merge with previous burst
        const mergedPhotoIds = [
          ...new Set([...lastMerged.photoIds, ...burst.photoIds]),
        ];
        const allPhotos = this.getPhotoMetadataForIds(mergedPhotoIds);

        const mergedBurst = this.createBurstGroup(
          mergedPhotoIds,
          allPhotos,
          "mixed",
        );
        merged[merged.length - 1] = mergedBurst;
      }
    }

    return merged;
  }

  private doBurstsOverlap(burst1: BurstGroup, burst2: BurstGroup): boolean {
    return (
      burst1.endTime >= burst2.startTime && burst1.startTime <= burst2.endTime
    );
  }

  private getPhotoMetadataForIds(photoIds: string[]): PhotoMetadata[] {
    // This is a placeholder - in real implementation, would fetch from storage
    return photoIds.map((id) => ({
      id,
      uri: `file:///photo/${id}`,
      timestamp: Date.now(),
      fileTimestamp: Date.now(),
    }));
  }

  // ─── SYNCHRONOUS VERSIONS FOR TESTING ─────────────────────

  private detectBurstsSync(photos: PhotoMetadata[]): BurstGroup[] {
    // Simplified synchronous version for analysis
    const sortedPhotos = [...photos].sort((a, b) => a.timestamp - b.timestamp);
    const bursts: BurstGroup[] = [];
    let currentBurst: string[] = [];

    for (let i = 0; i < sortedPhotos.length; i++) {
      const photo = sortedPhotos[i];

      if (currentBurst.length === 0) {
        currentBurst.push(photo.id);
      } else {
        const previousPhoto = sortedPhotos.find(
          (p) => p.id === currentBurst[currentBurst.length - 1],
        );
        const timeGap = previousPhoto
          ? photo.timestamp - previousPhoto.timestamp
          : Infinity;

        if (timeGap <= this.config.maxTimeGap) {
          currentBurst.push(photo.id);
        } else {
          if (currentBurst.length >= this.config.minBurstSize) {
            bursts.push(
              this.createBurstGroup(currentBurst, sortedPhotos, "temporal"),
            );
          }
          currentBurst = [photo.id];
        }
      }
    }

    if (currentBurst.length >= this.config.minBurstSize) {
      bursts.push(
        this.createBurstGroup(currentBurst, sortedPhotos, "temporal"),
      );
    }

    return bursts;
  }
}

// ─────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────

/**
 * Extract photo metadata from image URI
 * In production, would use EXIF library to get actual metadata
 */
export async function extractPhotoMetadata(
  imageUri: string,
  id: string,
): Promise<PhotoMetadata> {
  try {
    // This is a placeholder implementation
    // In production, would use react-native-exify or similar library

    const now = Date.now();

    // Simulate EXIF extraction
    const mockExifData = await simulateExifExtraction(imageUri);

    return {
      id,
      uri: imageUri,
      timestamp: mockExifData.timestamp || now,
      cameraInfo: mockExifData.cameraInfo,
      exifTimestamp: mockExifData.exifTimestamp,
      fileTimestamp: now,
      sequenceNumber: mockExifData.sequenceNumber,
      isBurstCandidate: mockExifData.isBurstCandidate,
    };
  } catch (error) {
    console.error("Failed to extract photo metadata:", error);

    // Fallback to basic metadata
    const now = Date.now();
    return {
      id,
      uri: imageUri,
      timestamp: now,
      fileTimestamp: now,
    };
  }
}

/**
 * Simulate EXIF data extraction for testing
 */
async function simulateExifExtraction(imageUri: string): Promise<{
  timestamp?: number;
  cameraInfo?: { make: string; model: string };
  exifTimestamp?: number;
  sequenceNumber?: number;
  isBurstCandidate?: boolean;
}> {
  // Simulate different camera behaviors based on URI patterns
  if (imageUri.includes("burst")) {
    return {
      timestamp: Date.now() - Math.random() * 1000,
      cameraInfo: { make: "Apple", model: "iPhone 14 Pro" },
      exifTimestamp: Date.now() - Math.random() * 1000,
      sequenceNumber: Math.floor(Math.random() * 100),
      isBurstCandidate: true,
    };
  }

  return {
    timestamp: Date.now() - Math.random() * 10000,
    cameraInfo: { make: "Apple", model: "iPhone 14 Pro" },
  };
}

/**
 * Get singleton instance of BurstDetector
 */
export function getBurstDetector(
  config?: Partial<BurstDetectionConfig>,
): BurstDetector {
  const key = JSON.stringify(config || {});
  if (!(global as any).burstDetectorInstances) {
    (global as any).burstDetectorInstances = new Map();
  }

  if (!(global as any).burstDetectorInstances.has(key)) {
    (global as any).burstDetectorInstances.set(key, new BurstDetector(config));
  }

  return (global as any).burstDetectorInstances.get(key);
}

/**
 * Quick burst detection for individual photos
 */
export async function quickBurstCheck(
  photo: PhotoMetadata,
  nearbyPhotos: PhotoMetadata[],
  config?: Partial<BurstDetectionConfig>,
): Promise<boolean> {
  const detector = getBurstDetector(config);
  return detector.isBurstPhoto(photo, nearbyPhotos);
}

/**
 * Analyze photo collection for burst statistics
 */
export async function analyzeCollectionBursts(
  photos: PhotoMetadata[],
  config?: Partial<BurstDetectionConfig>,
): Promise<ClusterAnalysis> {
  const detector = getBurstDetector(config);
  return detector.analyzeBurstPatterns(photos);
}
