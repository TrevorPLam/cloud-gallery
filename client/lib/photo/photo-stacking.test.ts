// AI-META-BEGIN
// AI-META: Property tests and unit tests for photo stacking service
// OWNERSHIP: client/lib/photo
// ENTRYPOINTS: run by vitest during testing
// DEPENDENCIES: fast-check, vitest, photo-stacking
// DANGER: Property tests validate stacking algorithm correctness
// CHANGE-SAFETY: Add new properties when extending stacking functionality
// TESTS: npm run test:watch
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  uniquePhotoArray,
  standardAsyncProperty,
  runAsyncPropertyTest,
  lightConfig,
  uniqueIds,
  validTimestamps,
} from "../../../tests/utils/property-testing";
import fc from "fast-check";
import {
  PhotoStackingService,
  getPhotoStackingService,
  detectPhotoStacks,
  getStackSummary,
} from "./photo-stacking";
import { Photo } from "@/types";
import type {
  PhotoStack,
  StackingConfig,
  StackingResult,
} from "./photo-stacking";

import { getPhotos, savePhotos } from "../storage";
import { getPerceptualHasher, generateCompositeHash } from "./perceptual-hash";
import { getBurstDetector, extractPhotoMetadata } from "./burst-detection";
import { getPhotoQualityScorer } from "./quality-score";

// Mock dependencies
vi.mock("../storage", () => ({
  getPhotos: vi.fn(),
  savePhotos: vi.fn(),
}));

vi.mock("./perceptual-hash", () => ({
  getPerceptualHasher: vi.fn(),
  generateCompositeHash: vi.fn(),
}));

vi.mock("./burst-detection", () => ({
  getBurstDetector: vi.fn(),
  extractPhotoMetadata: vi.fn(),
}));

vi.mock("./quality-score", () => ({
  getPhotoQualityScorer: vi.fn(),
  getQualityRating: vi.fn(),
}));

// ─────────────────────────────────────────────────────────
// TEST SETUP AND TEARDOWN
// ─────────────────────────────────────────────────────────

describe("PhotoStackingService", () => {
  let service: PhotoStackingService;
  let mockPhotos: Photo[];

  beforeEach(() => {
    service = new PhotoStackingService();

    // Create mock photo data
    const baseTime = Date.now();
    mockPhotos = Array.from({ length: 20 }, (_, i) => ({
      id: `photo_${i}`,
      uri: `file:///test/photo_${i}.jpg`,
      width: 1920,
      height: 1080,
      createdAt: baseTime + i * 1000,
      modifiedAt: baseTime + i * 1000,
      filename: `photo_${i}.jpg`,
      isFavorite: false,
      albumIds: [],
    }));

    // Mock storage
    (getPhotos as any).mockResolvedValue(mockPhotos);
    (savePhotos as any).mockResolvedValue(undefined);

    // Mock perceptual hasher
    const mockHasher = {
      compareHashes: vi.fn(
        (hash1: string, hash2: string, threshold: number) => ({
          distance: Math.floor(Math.random() * 20),
          similarity: Math.random(),
          isDuplicate: Math.random() < 0.3,
          threshold,
        }),
      ),
    };
    (getPerceptualHasher as any).mockReturnValue(mockHasher);
    (generateCompositeHash as any).mockResolvedValue(
      `hash_${Math.random().toString(36)}`,
    );

    // Mock burst detector
    const mockBurstDetector = {
      detectBursts: vi.fn().mockResolvedValue([]),
    };
    (getBurstDetector as any).mockReturnValue(mockBurstDetector);

    // Mock quality scorer
    const mockQualityScorer = {
      quickQualityCheck: vi.fn().mockResolvedValue({
        score: Math.random() * 100,
        sharpness: Math.random() * 100,
        exposure: Math.random() * 100,
        processingTime: 100,
      }),
    };
    (getPhotoQualityScorer as any).mockReturnValue(mockQualityScorer);

    // Mock metadata extraction
    (extractPhotoMetadata as any).mockImplementation(
      (uri: string, id: string) => ({
        id,
        uri,
        timestamp: Date.now(),
        fileTimestamp: Date.now(),
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (global as any).photoStackingServiceInstances;
  });

  // ─────────────────────────────────────────────────────────
  // PROPERTY TESTS
  // ─────────────────────────────────────────────────────────

  describe("Property Tests", () => {
    it("Property 1: Stack ID uniqueness - each stack should have unique ID", async () => {
      const property = standardAsyncProperty(
        uniquePhotoArray(5, 20),
        async (photos: Photo[]) => {
          (getPhotos as any).mockResolvedValue(photos);

          const service = new PhotoStackingService();
          const result = await service.analyzeAndStackPhotos();

          // All stack IDs should be unique
          const stackIds = result.stacks.map((stack) => stack.id);
          const uniqueIds = new Set(stackIds);

          expect(uniqueIds.size).toBe(stackIds.length);
        }
      );
      
      await runAsyncPropertyTest(property, lightConfig);
    });

    it("Property 2: Stack photo count bounds - stacks should have reasonable photo counts", async () => {
      const property = standardAsyncProperty(
        uniquePhotoArray(5, 20),
        async (photos: Photo[]) => {
          (getPhotos as any).mockResolvedValue(photos);

          const service = new PhotoStackingService();
          const result = await service.analyzeAndStackPhotos();

          // All stacks should have at least 2 photos
          result.stacks.forEach((stack) => {
            expect(stack.photoIds.length).toBeGreaterThanOrEqual(2);
            expect(stack.photoIds.length).toBeLessThanOrEqual(10); // Default max
          });
        }
      );
      
      await runAsyncPropertyTest(property, lightConfig);
    });

    it("Property 3: Confidence score bounds - confidence should be between 0 and 1", async () => {
      const property = standardAsyncProperty(
        uniquePhotoArray(5, 20),
        async (photos: Photo[]) => {
          (getPhotos as any).mockResolvedValue(photos);

          const service = new PhotoStackingService();
          const result = await service.analyzeAndStackPhotos();

          // All confidence scores should be valid
          result.stacks.forEach((stack) => {
            expect(stack.confidence).toBeGreaterThanOrEqual(0);
            expect(stack.confidence).toBeLessThanOrEqual(1);
          });
        }
      );
      
      await runAsyncPropertyTest(property, lightConfig);
    });

    it("Property 4: Processing time consistency - analysis should complete within reasonable time", async () => {
      const property = standardAsyncProperty(
        uniquePhotoArray(5, 20).filter(photos => photos.length <= 20), // Limit for performance testing
        async (photos: Photo[]) => {
          (getPhotos as any).mockResolvedValue(photos);

          const service = new PhotoStackingService();
          const startTime = Date.now();
          const result = await service.analyzeAndStackPhotos();
          const endTime = Date.now();

          // Processing time should be recorded and reasonable
          expect(result.processingTime).toBeGreaterThanOrEqual(0);
          expect(result.processingTime).toBeLessThan(30000); // 30 seconds max
          expect(endTime - startTime).toBeLessThan(30000);
        }
      );
      
      await runAsyncPropertyTest(property, lightConfig);
    });

    it("Property 5: Result consistency - total photos should match input", async () => {
      const property = standardAsyncProperty(
        uniquePhotoArray(5, 20),
        async (photos: Photo[]) => {
          (getPhotos as any).mockResolvedValue(photos);

          const service = new PhotoStackingService();
          const result = await service.analyzeAndStackPhotos();

          // Total photos should match input
          expect(result.totalPhotos).toBe(photos.length);

          // Photos in stacks should not exceed total
          expect(result.photosInStacks).toBeLessThanOrEqual(photos.length);

          // Number of stacks should be reasonable
          expect(result.stacksCreated).toBeLessThanOrEqual(
            Math.floor(photos.length / 2),
          );
        }
      );
      
      await runAsyncPropertyTest(property, lightConfig);
    });
  });

  // ─────────────────────────────────────────────────────────
  // UNIT TESTS
  // ─────────────────────────────────────────────────────────

  describe("Stacking Analysis", () => {
    it("should analyze and stack photos", async () => {
      const result = await service.analyzeAndStackPhotos();

      expect(result).toHaveProperty("totalPhotos");
      expect(result).toHaveProperty("stacksCreated");
      expect(result).toHaveProperty("photosInStacks");
      expect(result).toHaveProperty("processingTime");
      expect(result).toHaveProperty("stacks");

      expect(Array.isArray(result.stacks)).toBe(true);
      expect(typeof result.processingTime).toBe("number");
    });

    it("should handle empty photo collection", async () => {
      (getPhotos as any).mockResolvedValue([]);

      const result = await service.analyzeAndStackPhotos();

      expect(result.totalPhotos).toBe(0);
      expect(result.stacksCreated).toBe(0);
      expect(result.photosInStacks).toBe(0);
      expect(result.stacks).toEqual([]);
    });

    it("should handle single photo", async () => {
      (getPhotos as any).mockResolvedValue([mockPhotos[0]]);

      const result = await service.analyzeAndStackPhotos();

      expect(result.totalPhotos).toBe(1);
      expect(result.stacksCreated).toBe(0);
      expect(result.photosInStacks).toBe(0);
      expect(result.stacks).toEqual([]);
    });

    it("should create burst stacks when bursts are detected", async () => {
      const mockBurstDetector = {
        detectBursts: vi.fn().mockResolvedValue([
          {
            id: "burst_1",
            photoIds: ["photo_0", "photo_1", "photo_2"],
            startTime: Date.now(),
            endTime: Date.now() + 2000,
            duration: 2000,
            count: 3,
            avgInterval: 1000,
            confidence: 0.8,
            type: "temporal" as const,
          },
        ]),
      };
      (getBurstDetector as any).mockReturnValue(mockBurstDetector);

      const result = await service.analyzeAndStackPhotos();

      expect(result.stacks.length).toBeGreaterThan(0);
      expect(result.stacks.some((stack) => stack.type === "burst")).toBe(true);
    });

    it("should create duplicate stacks for similar photos", async () => {
      const mockHasher = {
        compareHashes: vi.fn().mockReturnValue({
          distance: 3,
          similarity: 0.95,
          isDuplicate: true,
          threshold: 5,
        }),
      };
      (getPerceptualHasher as any).mockReturnValue(mockHasher);

      const result = await service.analyzeAndStackPhotos();

      expect(result.stacks.length).toBeGreaterThan(0);
      expect(result.stacks.some((stack) => stack.type === "duplicate")).toBe(
        true,
      );
    });

    it("should select best photo based on quality", async () => {
      const mockQualityScorer = {
        quickQualityCheck: vi.fn().mockImplementation((uri: string) => {
          const photoIndex = parseInt(uri.split("_")[1]);
          return {
            score: 50 + photoIndex * 10, // Increasing quality
            sharpness: 50 + photoIndex * 10,
            exposure: 50 + photoIndex * 10,
            processingTime: 100,
          };
        }),
      };
      (getPhotoQualityScorer as any).mockReturnValue(mockQualityScorer);

      const result = await service.analyzeAndStackPhotos();

      result.stacks.forEach((stack) => {
        const bestPhotoIndex = parseInt(stack.bestPhotoId.split("_")[1]);
        stack.photoIds.forEach((photoId) => {
          const photoIndex = parseInt(photoId.split("_")[1]);
          expect(bestPhotoIndex).toBeGreaterThanOrEqual(photoIndex);
        });
      });
    });
  });

  describe("Stack Management", () => {
    it("should get existing stacks", async () => {
      // Mock photos with duplicate groups
      const photosWithGroups = mockPhotos.map((photo, i) => ({
        ...photo,
        duplicateGroupId: i < 4 ? "group_1" : i < 8 ? "group_2" : undefined,
      }));
      (getPhotos as any).mockResolvedValue(photosWithGroups);

      const stacks = await service.getStacks();

      expect(stacks).toHaveLength(2);
      expect(stacks[0].photoIds).toHaveLength(4);
      expect(stacks[1].photoIds).toHaveLength(4);
    });

    it("should update stack preferences", async () => {
      const stacks = await service.getStacks();
      if (stacks.length === 0) return;

      await service.updateStackPreferences(stacks[0].id, {
        reviewed: true,
        notes: "Test notes",
        keepStrategy: "best",
      });

      // Verify savePhotos was called
      expect(savePhotos).toHaveBeenCalled();
    });

    it("should select best photo for stack", async () => {
      const stacks = await service.getStacks();
      if (stacks.length === 0) return;

      const stack = stacks[0];
      const alternativePhotoId = stack.photoIds.find(
        (id) => id !== stack.bestPhotoId,
      );

      if (alternativePhotoId) {
        await service.selectBestPhoto(stack.id, alternativePhotoId);
        expect(savePhotos).toHaveBeenCalled();
      }
    });
  });

  describe("Statistics", () => {
    it("should calculate stacking statistics", async () => {
      // Create mock stacks
      const mockStacks: PhotoStack[] = [
        {
          id: "stack_1",
          photoIds: ["photo_1", "photo_2"],
          type: "duplicate",
          confidence: 0.9,
          bestPhotoId: "photo_1",
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          userPreferences: {
            reviewed: true,
            keepStrategy: "all",
          },
          analysis: {
            hashSimilarities: {},
            qualityScores: {},
          },
        },
        {
          id: "stack_2",
          photoIds: ["photo_3", "photo_4", "photo_5"],
          type: "burst",
          confidence: 0.8,
          bestPhotoId: "photo_3",
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          userPreferences: {
            reviewed: false,
            keepStrategy: "best",
            preferredPhotoId: "photo_4",
          },
          analysis: {
            hashSimilarities: {},
            qualityScores: {},
          },
        },
      ];

      // Mock getStacks to return our test data
      vi.spyOn(service, "getStacks").mockResolvedValue(mockStacks);

      const stats = await service.getStackingStatistics();

      expect(stats.totalStacks).toBe(2);
      expect(stats.stackTypes.duplicate).toBe(1);
      expect(stats.stackTypes.burst).toBe(1);
      expect(stats.avgStackSize).toBe(2.5);
      expect(stats.userEngagement.reviewedStacks).toBe(1);
      expect(stats.userEngagement.customSelections).toBe(1);
    });

    it("should handle empty statistics", async () => {
      vi.spyOn(service, "getStacks").mockResolvedValue([]);

      const stats = await service.getStackingStatistics();

      expect(stats.totalStacks).toBe(0);
      expect(stats.avgStackSize).toBe(0);
      expect(stats.storageSavings).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // CONFIGURATION TESTS
  // ─────────────────────────────────────────────────────────

  describe("Configuration", () => {
    it("should use custom duplicate threshold", async () => {
      const customService = new PhotoStackingService({
        duplicateThreshold: 10,
      });

      const mockHasher = {
        compareHashes: vi.fn().mockReturnValue({
          distance: 8,
          similarity: 0.8,
          isDuplicate: false, // Should not be duplicate with threshold 10
          threshold: 10,
        }),
      };
      (getPerceptualHasher as any).mockReturnValue(mockHasher);

      const result = await customService.analyzeAndStackPhotos();

      // Should not create duplicate stacks with higher threshold
      expect(result.stacks.filter((s) => s.type === "duplicate")).toHaveLength(
        0,
      );
    });

    it("should respect max photos per stack", async () => {
      const customService = new PhotoStackingService({ maxPhotosPerStack: 3 });

      // This would require more complex mocking to test properly
      const result = await customService.analyzeAndStackPhotos();

      expect(Array.isArray(result.stacks)).toBe(true);
      result.stacks.forEach((stack) => {
        expect(stack.photoIds.length).toBeLessThanOrEqual(3);
      });
    });

    it("should handle burst inclusion setting", async () => {
      const customService = new PhotoStackingService({ includeBursts: false });

      const result = await customService.analyzeAndStackPhotos();

      // Should not have burst stacks
      expect(result.stacks.filter((s) => s.type === "burst")).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // UTILITY FUNCTION TESTS
  // ─────────────────────────────────────────────────────────

  describe("Utility Functions", () => {
    it("should provide singleton instance", () => {
      const service1 = getPhotoStackingService();
      const service2 = getPhotoStackingService();

      expect(service1).toBe(service2);
      expect(service1).toBeInstanceOf(PhotoStackingService);
    });

    it("should create separate instances for different configs", () => {
      const service1 = getPhotoStackingService({ duplicateThreshold: 5 });
      const service2 = getPhotoStackingService({ duplicateThreshold: 10 });

      expect(service1).not.toBe(service2);
    });

    it("should detect photo stacks", async () => {
      // Mock stacks
      const mockStacks: PhotoStack[] = [
        {
          id: "stack_1",
          photoIds: ["photo_1", "photo_2"],
          type: "duplicate",
          confidence: 0.9,
          bestPhotoId: "photo_1",
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          userPreferences: {
            reviewed: false,
            keepStrategy: "all",
          },
          analysis: {
            hashSimilarities: {},
            qualityScores: {},
          },
        },
      ];

      vi.spyOn(service, "getStacks").mockResolvedValue(mockStacks);

      const result = await detectPhotoStacks("photo_1");

      expect(result.duplicates).toContain("photo_2");
      expect(result.similar).toEqual([]);
      expect(result.bursts).toEqual([]);
    });

    it("should get stack summary", async () => {
      const mockStack: PhotoStack = {
        id: "stack_1",
        photoIds: ["photo_1", "photo_2"],
        type: "duplicate",
        confidence: 0.9,
        bestPhotoId: "photo_1",
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        userPreferences: {
          reviewed: false,
          keepStrategy: "all",
        },
        analysis: {
          hashSimilarities: { photo_1: 1.0, photo_2: 0.95 },
          qualityScores: { photo_1: 85, photo_2: 75 },
        },
      };

      vi.spyOn(service, "getStacks").mockResolvedValue([mockStack]);
      (getPhotos as any).mockResolvedValue(mockPhotos.slice(0, 2));

      const result = await getStackSummary("stack_1");

      expect(result.stack).toBe(mockStack);
      expect(result.photos).toHaveLength(2);
      expect(result.summary).toContain("Duplicate group");
      expect(result.summary).toContain("2 photos");
      expect(result.summary).toContain("Excellent");
      expect(result.recommendations).toHaveLength(2);
    });

    it("should handle missing stack in summary", async () => {
      vi.spyOn(service, "getStacks").mockResolvedValue([]);

      const result = await getStackSummary("nonexistent");

      expect(result.stack).toBeNull();
      expect(result.photos).toEqual([]);
      expect(result.summary).toBe("");
      expect(result.recommendations).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────
  // ERROR HANDLING TESTS
  // ─────────────────────────────────────────────────────────

  describe("Error Handling", () => {
    it("should handle storage errors gracefully", async () => {
      (getPhotos as any).mockRejectedValue(new Error("Storage error"));

      await expect(service.analyzeAndStackPhotos()).rejects.toThrow(
        "Storage error",
      );
    });

    it("should handle hashing errors gracefully", async () => {
      (generateCompositeHash as any).mockRejectedValue(
        new Error("Hashing error"),
      );

      const result = await service.analyzeAndStackPhotos();

      // Should still complete but with fallback behavior
      expect(result.totalPhotos).toBe(mockPhotos.length);
    });

    it("should handle quality scoring errors gracefully", async () => {
      const mockQualityScorer = {
        quickQualityCheck: vi
          .fn()
          .mockRejectedValue(new Error("Quality error")),
      };
      (getPhotoQualityScorer as any).mockReturnValue(mockQualityScorer);

      const result = await service.analyzeAndStackPhotos();

      // Should still complete but with fallback quality scores
      expect(result.totalPhotos).toBe(mockPhotos.length);
    });

    it("should handle invalid photo selection", async () => {
      const stacks = await service.getStacks();
      if (stacks.length === 0) return;

      await expect(
        service.selectBestPhoto(stacks[0].id, "invalid_photo_id"),
      ).rejects.toThrow("Photo not found in stack");
    });
  });

  // ─────────────────────────────────────────────────────────
  // PERFORMANCE TESTS
  // ─────────────────────────────────────────────────────────

  describe("Performance", () => {
    it("should handle large photo collections efficiently", async () => {
      const largePhotoSet = Array.from({ length: 100 }, (_, i) => ({
        id: `photo_${i}`,
        uri: `file:///test/photo_${i}.jpg`,
        width: 1920,
        height: 1080,
        createdAt: Date.now() + i * 1000,
        modifiedAt: Date.now() + i * 1000,
        filename: `photo_${i}.jpg`,
        isFavorite: false,
        albumIds: [],
      }));

      (getPhotos as any).mockResolvedValue(largePhotoSet);

      const startTime = Date.now();
      const result = await service.analyzeAndStackPhotos();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(60000); // 60 seconds max
      expect(result.totalPhotos).toBe(100);
      expect(Array.isArray(result.stacks)).toBe(true);
    });

    it("should maintain consistent performance with multiple calls", async () => {
      const times: number[] = [];

      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        await service.analyzeAndStackPhotos();
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const variance =
        times.reduce((sum, time) => sum + (time - avgTime) ** 2, 0) /
        times.length;

      // Performance should be relatively consistent
      expect(Math.sqrt(variance)).toBeLessThan(avgTime);
    });
  });
});

// ─────────────────────────────────────────────────────────
// INTEGRATION TESTS
// ─────────────────────────────────────────────────────────

describe("PhotoStackingService Integration", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete (global as any).photoStackingServiceInstances;
  });

  it("should integrate all components correctly", async () => {
    const service = getPhotoStackingService();

    // Mock all dependencies to work together
    const mockHasher = {
      compareHashes: vi.fn((hash1: string, hash2: string) => ({
        distance: Math.random() * 20,
        similarity: Math.random(),
        isDuplicate: Math.random() < 0.3,
        threshold: 5,
      })),
    };
    (getPerceptualHasher as any).mockReturnValue(mockHasher);

    const mockBurstDetector = {
      detectBursts: vi.fn().mockResolvedValue([
        {
          id: "burst_1",
          photoIds: ["photo_0", "photo_1"],
          startTime: Date.now(),
          endTime: Date.now() + 1000,
          duration: 1000,
          count: 2,
          avgInterval: 500,
          confidence: 0.8,
          type: "temporal" as const,
        },
      ]),
    };
    (getBurstDetector as any).mockReturnValue(mockBurstDetector);

    const mockQualityScorer = {
      quickQualityCheck: vi.fn().mockResolvedValue({
        score: 75,
        sharpness: 80,
        exposure: 70,
        processingTime: 100,
      }),
    };
    (getPhotoQualityScorer as any).mockReturnValue(mockQualityScorer);

    const result = await service.analyzeAndStackPhotos();

    expect(result.totalPhotos).toBeGreaterThan(0);
    expect(result.stacks.length).toBeGreaterThan(0);

    // Should have both burst and other types of stacks
    const stackTypes = result.stacks.map((s) => s.type);
    expect(stackTypes).toContain("burst");

    // Verify all components were called
    expect(getPerceptualHasher).toHaveBeenCalled();
    expect(getBurstDetector).toHaveBeenCalled();
    expect(getPhotoQualityScorer).toHaveBeenCalled();
  });

  it("should handle concurrent stacking operations", async () => {
    const service = getPhotoStackingService();

    // Run multiple analyses concurrently
    const promises = Array(3)
      .fill(null)
      .map(() => service.analyzeAndStackPhotos());
    const results = await Promise.all(promises);

    // All should complete successfully
    results.forEach((result) => {
      expect(result.totalPhotos).toBeGreaterThan(0);
      expect(Array.isArray(result.stacks)).toBe(true);
    });
  });
});
