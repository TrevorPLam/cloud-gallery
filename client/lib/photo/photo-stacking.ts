// AI-META-BEGIN
// AI-META: Photo stacking service integrating perceptual hashing, burst detection, and quality scoring
// OWNERSHIP: client/lib/photo
// ENTRYPOINTS: imported by photo stacking screen and gallery components
// DEPENDENCIES: perceptual-hash, burst-detection, quality-score, storage
// DANGER: Complex integration requires careful error handling and performance optimization
// CHANGE-SAFETY: Add new stacking strategies by extending PhotoStackingService class
// TESTS: client/lib/photo/photo-stacking.test.ts
// AI-META-END

import { Platform } from "react-native";
import { Photo } from "@/types";
import { getPhotos, savePhotos } from "../storage";
import { getPerceptualHasher, generateCompositeHash } from "./perceptual-hash";
import { getBurstDetector, extractPhotoMetadata, type BurstGroup } from "./burst-detection";
import { getPhotoQualityScorer, getQualityRating } from "./quality-score";

// ─────────────────────────────────────────────────────────
// TYPES AND INTERFACES
// ─────────────────────────────────────────────────────────

export interface PhotoStack {
  /** Unique identifier for the stack */
  id: string;
  /** Array of photo IDs in this stack */
  photoIds: string[];
  /** Type of stacking */
  type: "duplicate" | "burst" | "similar" | "mixed";
  /** Confidence score (0-1) */
  confidence: number;
  /** Best photo ID based on quality */
  bestPhotoId: string;
  /** Stack creation timestamp */
  createdAt: number;
  /** Last modified timestamp */
  modifiedAt: number;
  /** User preferences */
  userPreferences: {
    /** Whether user has reviewed this stack */
    reviewed: boolean;
    /** User's preferred photo (if different from best) */
    preferredPhotoId?: string;
    /** User notes about the stack */
    notes?: string;
    /** Whether to keep all photos or just the best */
    keepStrategy: "all" | "best" | "custom";
  };
  /** Analysis metadata */
  analysis: {
    /** Perceptual hash similarity scores */
    hashSimilarities: Record<string, number>;
    /** Quality scores for each photo */
    qualityScores: Record<string, number>;
    /** Burst group information (if applicable) */
    burstInfo?: BurstGroup;
  };
}

export interface StackingConfig {
  /** Similarity threshold for duplicate detection */
  duplicateThreshold: number;
  /** Similarity threshold for similar photos */
  similarThreshold: number;
  /** Minimum quality score for best photo selection */
  minQualityScore: number;
  /** Whether to auto-review stacks */
  autoReview: boolean;
  /** Maximum photos per stack */
  maxPhotosPerStack: number;
  /** Whether to include burst photos in stacking */
  includeBursts: boolean;
}

export interface StackingResult {
  /** Total photos processed */
  totalPhotos: number;
  /** Number of stacks created */
  stacksCreated: number;
  /** Number of photos in stacks */
  photosInStacks: number;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Created stacks */
  stacks: PhotoStack[];
}

export interface StackingStatistics {
  /** Total number of stacks */
  totalStacks: number;
  /** Breakdown by stack type */
  stackTypes: {
    duplicate: number;
    burst: number;
    similar: number;
    mixed: number;
  };
  /** Average stack size */
  avgStackSize: number;
  /** Storage savings (estimated) */
  storageSavings: number;
  /** User engagement metrics */
  userEngagement: {
    reviewedStacks: number;
    customSelections: number;
    userNotes: number;
  };
}

// ─────────────────────────────────────────────────────────
// PHOTO STACKING SERVICE CLASS
// ─────────────────────────────────────────────────────────

export class PhotoStackingService {
  private static readonly DEFAULT_CONFIG: StackingConfig = {
    duplicateThreshold: 5, // Hamming distance for duplicates
    similarThreshold: 15, // Hamming distance for similar photos
    minQualityScore: 60,
    autoReview: false,
    maxPhotosPerStack: 10,
    includeBursts: true,
  };

  private config: StackingConfig;
  private hasher = getPerceptualHasher();
  private burstDetector = getBurstDetector();
  private qualityScorer = getPhotoQualityScorer();

  constructor(config: Partial<StackingConfig> = {}) {
    this.config = { ...PhotoStackingService.DEFAULT_CONFIG, ...config };
  }

  // ─── PUBLIC STACKING METHODS ─────────────────────────────

  /**
   * Analyze all photos and create stacks
   * Main entry point for photo stacking
   */
  public async analyzeAndStackPhotos(): Promise<StackingResult> {
    const startTime = Date.now();

    try {
      // Get all photos
      const photos = await getPhotos();
      
      // Extract metadata for all photos
      const photoMetadata = await Promise.all(
        photos.map(photo => extractPhotoMetadata(photo.uri, photo.id))
      );

      // Detect bursts
      const burstGroups = this.config.includeBursts 
        ? await this.burstDetector.detectBursts(photoMetadata)
        : [];

      // Generate perceptual hashes for all photos
      const hashPromises = photos.map(async (photo) => {
        const hash = await generateCompositeHash(photo.uri);
        return { photoId: photo.id, hash };
      });
      
      const hashes = await Promise.all(hashPromises);
      const hashMap = new Map(hashes.map(h => [h.photoId, h.hash]));

      // Generate quality scores for all photos
      const qualityPromises = photos.map(async (photo) => {
        const quality = await this.qualityScorer.quickQualityCheck(photo.uri);
        return { photoId: photo.id, score: quality.score };
      });
      
      const qualities = await Promise.all(qualityPromises);
      const qualityMap = new Map(qualities.map(q => [q.photoId, q.score]));

      // Create stacks
      const stacks = await this.createStacks(
        photos,
        hashMap,
        qualityMap,
        burstGroups
      );

      // Update photos with stack information
      await this.updatePhotosWithStacks(photos, stacks);

      const processingTime = Date.now() - startTime;

      return {
        totalPhotos: photos.length,
        stacksCreated: stacks.length,
        photosInStacks: stacks.reduce((sum, stack) => sum + stack.photoIds.length, 0),
        processingTime,
        stacks,
      };
    } catch (error) {
      console.error("PhotoStackingService: Analysis failed:", error);
      throw error;
    }
  }

  /**
   * Get all existing stacks
   */
  public async getStacks(): Promise<PhotoStack[]> {
    const photos = await getPhotos();
    const stackMap = new Map<string, PhotoStack>();

    // Extract stack information from photos
    photos.forEach(photo => {
      if (photo.duplicateGroupId) {
        if (!stackMap.has(photo.duplicateGroupId)) {
          stackMap.set(photo.duplicateGroupId, {
            id: photo.duplicateGroupId,
            photoIds: [],
            type: "duplicate", // Default, will be updated
            confidence: 0,
            bestPhotoId: photo.id,
            createdAt: photo.createdAt,
            modifiedAt: photo.modifiedAt,
            userPreferences: {
              reviewed: false,
              keepStrategy: "all",
            },
            analysis: {
              hashSimilarities: {},
              qualityScores: {},
            },
          });
        }
        
        const stack = stackMap.get(photo.duplicateGroupId)!;
        stack.photoIds.push(photo.id);
      }
    });

    return Array.from(stackMap.values());
  }

  /**
   * Update user preferences for a stack
   */
  public async updateStackPreferences(
    stackId: string,
    preferences: Partial<PhotoStack["userPreferences"]>
  ): Promise<void> {
    const photos = await getPhotos();
    const updatedPhotos = photos.map(photo => {
      if (photo.duplicateGroupId === stackId) {
        // In a real implementation, would store user preferences separately
        // For now, we'll simulate by updating photo metadata
        return {
          ...photo,
          notes: preferences.notes || photo.notes,
        };
      }
      return photo;
    });

    await savePhotos(updatedPhotos);
  }

  /**
   * Select best photo for a stack
   */
  public async selectBestPhoto(stackId: string, photoId: string): Promise<void> {
    const photos = await getPhotos();
    const stackPhotos = photos.filter(p => p.duplicateGroupId === stackId);
    
    if (!stackPhotos.find(p => p.id === photoId)) {
      throw new Error("Photo not found in stack");
    }

    // Update best photo preference
    await this.updateStackPreferences(stackId, {
      preferredPhotoId: photoId,
      keepStrategy: "custom",
    });
  }

  /**
   * Get stacking statistics
   */
  public async getStackingStatistics(): Promise<StackingStatistics> {
    const stacks = await this.getStacks();
    
    const stackTypes = {
      duplicate: 0,
      burst: 0,
      similar: 0,
      mixed: 0,
    };

    let totalPhotos = 0;
    let reviewedStacks = 0;
    let customSelections = 0;
    let userNotes = 0;

    stacks.forEach(stack => {
      stackTypes[stack.type]++;
      totalPhotos += stack.photoIds.length;
      
      if (stack.userPreferences.reviewed) reviewedStacks++;
      if (stack.userPreferences.preferredPhotoId) customSelections++;
      if (stack.userPreferences.notes) userNotes++;
    });

    const avgStackSize = stacks.length > 0 ? totalPhotos / stacks.length : 0;
    const storageSavings = this.estimateStorageSavings(stacks);

    return {
      totalStacks: stacks.length,
      stackTypes,
      avgStackSize,
      storageSavings,
      userEngagement: {
        reviewedStacks,
        customSelections,
        userNotes,
      },
    };
  }

  // ─── PRIVATE STACKING ALGORITHMS ───────────────────────

  private async createStacks(
    photos: Photo[],
    hashMap: Map<string, string>,
    qualityMap: Map<string, number>,
    burstGroups: BurstGroup[]
  ): Promise<PhotoStack[]> {
    const stacks: PhotoStack[] = [];
    const processedPhotos = new Set<string>();

    // Create burst-based stacks
    if (this.config.includeBursts) {
      for (const burstGroup of burstGroups) {
        const burstPhotos = photos.filter(p => burstGroup.photoIds.includes(p.id));
        if (burstPhotos.length >= 2) {
          const stack = await this.createBurstStack(burstPhotos, burstGroup, qualityMap);
          stacks.push(stack);
          burstPhotos.forEach(photo => processedPhotos.add(photo.id));
        }
      }
    }

    // Create duplicate stacks
    const duplicateStacks = await this.createDuplicateStacks(
      photos.filter(p => !processedPhotos.has(p.id)),
      hashMap,
      qualityMap
    );
    stacks.push(...duplicateStacks);

    // Create similar photo stacks
    const remainingPhotos = photos.filter(p => 
      !processedPhotos.has(p.id) && 
      !duplicateStacks.some(stack => stack.photoIds.includes(p.id))
    );
    
    const similarStacks = await this.createSimilarStacks(
      remainingPhotos,
      hashMap,
      qualityMap
    );
    stacks.push(...similarStacks);

    return stacks;
  }

  private async createBurstStack(
    photos: Photo[],
    burstGroup: BurstGroup,
    qualityMap: Map<string, number>
  ): Promise<PhotoStack> {
    // Select best photo based on quality
    const bestPhoto = photos.reduce((best, photo) => {
      const bestScore = qualityMap.get(best.id) || 0;
      const photoScore = qualityMap.get(photo.id) || 0;
      return photoScore > bestScore ? photo : best;
    });

    const stackId = `burst_${burstGroup.id}`;
    const qualityScores: Record<string, number> = {};
    photos.forEach(photo => {
      qualityScores[photo.id] = qualityMap.get(photo.id) || 0;
    });

    return {
      id: stackId,
      photoIds: photos.map(p => p.id),
      type: "burst",
      confidence: burstGroup.confidence,
      bestPhotoId: bestPhoto.id,
      createdAt: Math.min(...photos.map(p => p.createdAt)),
      modifiedAt: Math.max(...photos.map(p => p.modifiedAt)),
      userPreferences: {
        reviewed: false,
        keepStrategy: "all",
      },
      analysis: {
        hashSimilarities: {},
        qualityScores,
        burstInfo: burstGroup,
      },
    };
  }

  private async createDuplicateStacks(
    photos: Photo[],
    hashMap: Map<string, string>,
    qualityMap: Map<string, number>
  ): Promise<PhotoStack[]> {
    const stacks: PhotoStack[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < photos.length; i++) {
      const photo1 = photos[i];
      if (processed.has(photo1.id)) continue;

      const hash1 = hashMap.get(photo1.id);
      if (!hash1) continue;

      const duplicatePhotos = [photo1];
      processed.add(photo1.id);

      // Find duplicates
      for (let j = i + 1; j < photos.length; j++) {
        const photo2 = photos[j];
        if (processed.has(photo2.id)) continue;

        const hash2 = hashMap.get(photo2.id);
        if (!hash2) continue;

        const similarity = this.hasher.compareHashes(hash1, hash2, this.config.duplicateThreshold);
        if (similarity.isDuplicate) {
          duplicatePhotos.push(photo2);
          processed.add(photo2.id);
        }
      }
    }

    // Create stack if we found duplicates
    if (duplicatePhotos.length > 1) {
      const stack = await this.createDuplicateStack(duplicatePhotos, hashMap, qualityMap);
      stacks.push(stack);
    }

    return stacks;
  }

  private async createDuplicateStack(
    photos: Photo[],
    hashMap: Map<string, string>,
    qualityMap: Map<string, number>
  ): Promise<PhotoStack> {
    // Select best photo based on quality
    const bestPhoto = photos.reduce((best, photo) => {
      const bestScore = qualityMap.get(best.id) || 0;
      const photoScore = qualityMap.get(photo.id) || 0;
      return photoScore > bestScore ? photo : best;
    });

    const stackId = `duplicate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const hashSimilarities: Record<string, number> = {};
    const qualityScores: Record<string, number> = {};

    // Calculate similarity scores
    const baseHash = hashMap.get(photos[0].id) || "";
    photos.forEach(photo => {
      const photoHash = hashMap.get(photo.id) || "";
      const similarity = this.hasher.compareHashes(baseHash, photoHash);
      hashSimilarities[photo.id] = similarity.similarity;
      qualityScores[photo.id] = qualityMap.get(photo.id) || 0;
    });

    return {
      id: stackId,
      photoIds: photos.map(p => p.id),
      type: "duplicate",
      confidence: 0.9, // High confidence for duplicates
      bestPhotoId: bestPhoto.id,
      createdAt: Math.min(...photos.map(p => p.createdAt)),
      modifiedAt: Math.max(...photos.map(p => p.modifiedAt)),
      userPreferences: {
        reviewed: false,
        keepStrategy: "all",
      },
      analysis: {
        hashSimilarities,
        qualityScores,
      },
    };
  }

  private async createSimilarStacks(
    photos: Photo[],
    hashMap: Map<string, string>,
    qualityMap: Map<string, number>
  ): Promise<PhotoStack[]> {
    const stacks: PhotoStack[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < photos.length; i++) {
      const photo1 = photos[i];
      if (processed.has(photo1.id)) continue;

      const hash1 = hashMap.get(photo1.id);
      if (!hash1) continue;

      const similarPhotos = [photo1];
      processed.add(photo1.id);

      // Find similar photos
      for (let j = i + 1; j < photos.length; j++) {
        const photo2 = photos[j];
        if (processed.has(photo2.id)) continue;

        const hash2 = hashMap.get(photo2.id);
        if (!hash2) continue;

        const similarity = this.hasher.compareHashes(hash1, hash2, this.config.similarThreshold);
        if (similarity.isDuplicate && similarity.distance > this.config.duplicateThreshold) {
          similarPhotos.push(photo2);
          processed.add(photo2.id);
        }
      }

      // Create stack if we found similar photos
      if (similarPhotos.length > 1) {
        const stack = await this.createSimilarStack(similarPhotos, hashMap, qualityMap);
        stacks.push(stack);
      }
    }

    return stacks;
  }

  private async createSimilarStack(
    photos: Photo[],
    hashMap: Map<string, string>,
    qualityMap: Map<string, number>
  ): Promise<PhotoStack> {
    // Select best photo based on quality
    const bestPhoto = photos.reduce((best, photo) => {
      const bestScore = qualityMap.get(best.id) || 0;
      const photoScore = qualityMap.get(photo.id) || 0;
      return photoScore > bestScore ? photo : best;
    });

    const stackId = `similar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const hashSimilarities: Record<string, number> = {};
    const qualityScores: Record<string, number> = {};

    // Calculate similarity scores
    const baseHash = hashMap.get(photos[0].id) || "";
    photos.forEach(photo => {
      const photoHash = hashMap.get(photo.id) || "";
      const similarity = this.hasher.compareHashes(baseHash, photoHash);
      hashSimilarities[photo.id] = similarity.similarity;
      qualityScores[photo.id] = qualityMap.get(photo.id) || 0;
    });

    return {
      id: stackId,
      photoIds: photos.map(p => p.id),
      type: "similar",
      confidence: 0.7, // Medium confidence for similar photos
      bestPhotoId: bestPhoto.id,
      createdAt: Math.min(...photos.map(p => p.createdAt)),
      modifiedAt: Math.max(...photos.map(p => p.modifiedAt)),
      userPreferences: {
        reviewed: false,
        keepStrategy: "all",
      },
      analysis: {
        hashSimilarities,
        qualityScores,
      },
    };
  }

  private async updatePhotosWithStacks(photos: Photo[], stacks: PhotoStack[]): Promise<void> {
    const updatedPhotos = photos.map(photo => {
      const stack = stacks.find(s => s.photoIds.includes(photo.id));
      if (stack) {
        return {
          ...photo,
          duplicateGroupId: stack.id,
          perceptualHash: stack.analysis.hashSimilarities[photo.id] ? "computed" : photo.perceptualHash,
        };
      }
      return photo;
    });

    await savePhotos(updatedPhotos);
  }

  private estimateStorageSavings(stacks: PhotoStack[]): number {
    // Estimate storage savings by assuming we could keep only the best photo from each stack
    const totalPhotos = stacks.reduce((sum, stack) => sum + stack.photoIds.length, 0);
    const bestPhotosOnly = stacks.length;
    const redundantPhotos = totalPhotos - bestPhotosOnly;
    
    // Assume average photo size of 3MB
    return redundantPhotos * 3 * 1024 * 1024; // in bytes
  }
}

// ─────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────

/**
 * Get singleton instance of PhotoStackingService
 */
export function getPhotoStackingService(config?: Partial<StackingConfig>): PhotoStackingService {
  const key = JSON.stringify(config || {});
  if (!(global as any).photoStackingServiceInstances) {
    (global as any).photoStackingServiceInstances = new Map();
  }
  
  if (!(global as any).photoStackingServiceInstances.has(key)) {
    (global as any).photoStackingServiceInstances.set(key, new PhotoStackingService(config));
  }
  
  return (global as any).photoStackingServiceInstances.get(key);
}

/**
 * Quick stack detection for a single photo
 */
export async function detectPhotoStacks(photoId: string): Promise<{
  duplicates: string[];
  similar: string[];
  bursts?: string[];
}> {
  const service = getPhotoStackingService();
  const stacks = await service.getStacks();
  
  const duplicates: string[] = [];
  const similar: string[] = [];
  let bursts: string[] = [];

  stacks.forEach(stack => {
    if (stack.photoIds.includes(photoId)) {
      switch (stack.type) {
        case "duplicate":
          duplicates.push(...stack.photoIds.filter(id => id !== photoId));
          break;
        case "similar":
          similar.push(...stack.photoIds.filter(id => id !== photoId));
          break;
        case "burst":
          bursts = stack.photoIds.filter(id => id !== photoId);
          break;
      }
    }
  });

  return { duplicates, similar, bursts };
}

/**
 * Get stack summary for display
 */
export async function getStackSummary(stackId: string): Promise<{
  stack: PhotoStack | null;
  photos: Photo[];
  summary: string;
  recommendations: string[];
}> {
  const service = getPhotoStackingService();
  const stacks = await service.getStacks();
  const stack = stacks.find(s => s.id === stackId) || null;
  
  if (!stack) {
    return { stack: null, photos: [], summary: "", recommendations: [] };
  }

  const allPhotos = await getPhotos();
  const photos = allPhotos.filter(p => stack.photoIds.includes(p.id));

  const summary = generateStackSummary(stack, photos);
  const recommendations = generateStackRecommendations(stack, photos);

  return { stack, photos, summary, recommendations };
}

function generateStackSummary(stack: PhotoStack, photos: Photo[]): string {
  const typeText = stack.type.charAt(0).toUpperCase() + stack.type.slice(1);
  const qualityRating = getQualityRating(stack.analysis.qualityScores[stack.bestPhotoId] || 0);
  
  return `${typeText} group of ${photos.length} photos. Best photo quality: ${qualityRating}.`;
}

function generateStackRecommendations(stack: PhotoStack, photos: Photo[]): string[] {
  const recommendations: string[] = [];
  
  if (stack.type === "duplicate") {
    recommendations.push("Consider keeping only the best photo to save storage space.");
  } else if (stack.type === "burst") {
    recommendations.push("Review the burst sequence and keep the sharpest photo.");
  } else if (stack.type === "similar") {
    recommendations.push("These photos are visually similar but not identical.");
  }

  if (stack.userPreferences.reviewed) {
    recommendations.push("You've already reviewed this stack.");
  } else {
    recommendations.push("Review this stack to select your preferred photo.");
  }

  return recommendations;
}
