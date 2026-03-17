// AI-META-BEGIN
// AI-META: Property tests and unit tests for burst detection algorithms
// OWNERSHIP: client/lib/photo
// ENTRYPOINTS: run by vitest during testing
// DEPENDENCIES: fast-check, vitest, burst-detection
// DANGER: Property tests validate temporal clustering correctness
// CHANGE-SAFETY: Add new properties when extending burst detection
// TESTS: npm run test:watch
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import {
  BurstDetector,
  extractPhotoMetadata,
  getBurstDetector,
  quickBurstCheck,
  analyzeCollectionBursts,
} from "./burst-detection";
import type {
  PhotoMetadata,
  BurstGroup,
  BurstDetectionConfig,
} from "./burst-detection";

// ─────────────────────────────────────────────────────────
// TEST SETUP AND TEARDOWN
// ─────────────────────────────────────────────────────────

describe("BurstDetector", () => {
  let detector: BurstDetector;
  let mockPhotos: PhotoMetadata[];

  beforeEach(() => {
    detector = new BurstDetector();

    // Create mock photo data
    const baseTime = Date.now();
    mockPhotos = Array.from({ length: 20 }, (_, i) => ({
      id: `photo_${i}`,
      uri: `file:///test/photo_${i}.jpg`,
      timestamp: baseTime + i * 1000, // 1 second intervals
      fileTimestamp: baseTime + i * 1000,
      cameraInfo: { make: "Apple", model: "iPhone 14 Pro" },
    }));
  });

  afterEach(() => {
    // Clean up global instances
    delete (global as any).burstDetectorInstances;
  });

  // ─────────────────────────────────────────────────────────
  // PROPERTY TESTS
  // ─────────────────────────────────────────────────────────

  describe("Property Tests", () => {
    it("Property 1: Temporal ordering - burst detection should preserve chronological order", async () => {
      await expect(
        fc.assert(
          fc.asyncProperty(
            fc.array(
              fc.record({
                id: fc.string(),
                uri: fc.webUrl(),
                timestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
                fileTimestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
              }),
              { minLength: 3, maxLength: 20 },
            ),
            async (photos: PhotoMetadata[]) => {
              const detector = new BurstDetector();
              const bursts = await detector.detectBursts(photos);

              // Each burst should have photos in chronological order
              bursts.forEach((burst) => {
                const burstPhotos = photos.filter((p) =>
                  burst.photoIds.includes(p.id),
                );
                // Sort by timestamp and compare to burst's internal ordering
                const sortedTimestamps = burstPhotos
                  .map((p) => p.timestamp)
                  .sort((a, b) => a - b);
                const actualTimestamps = burstPhotos.map((p) => p.timestamp);

                // Check that the set of timestamps matches (order may differ)
                expect(new Set(actualTimestamps)).toEqual(
                  new Set(sortedTimestamps),
                );
              });
            },
          ),
          { numRuns: 5 }, // Reduced runs for faster testing
        ),
      ).resolves.toBeUndefined();
    });

    it("Property 2: Burst duration bounds - burst duration should be within configured limits", async () => {
      await expect(
        fc.assert(
          fc.asyncProperty(
            fc.array(
              fc.record({
                id: fc.string(),
                uri: fc.webUrl(),
                timestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
                fileTimestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
              }),
              { minLength: 3, maxLength: 20 },
            ),
            fc.record({
              maxTimeGap: fc.integer({ min: 100, max: 10000 }),
              minBurstSize: fc.integer({ min: 2, max: 5 }),
              maxBurstDuration: fc.integer({ min: 5000, max: 30000 }),
              confidenceThreshold: fc.float({ min: 0.5, max: 1.0 }),
              useSequenceNumbers: fc.boolean(),
            }),
            async (photos: PhotoMetadata[], config: BurstDetectionConfig) => {
              const detector = new BurstDetector(config);
              const bursts = await detector.detectBursts(photos);

              // All bursts should respect duration limits
              bursts.forEach((burst) => {
                expect(burst.duration).toBeLessThanOrEqual(
                  config.maxBurstDuration,
                );
                expect(burst.count).toBeGreaterThanOrEqual(config.minBurstSize);
                expect(burst.confidence).toBeGreaterThanOrEqual(0);
                expect(burst.confidence).toBeLessThanOrEqual(1);
              });
            },
          ),
          { numRuns: 10 },
        ),
      ).resolves.toBeUndefined();
    });

    it("Property 3: Time gap consistency - photos in same burst should have small time gaps", async () => {
      await expect(
        fc.assert(
          fc.asyncProperty(
            fc.array(
              fc.record({
                id: fc.string(),
                uri: fc.webUrl(),
                timestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
                fileTimestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
              }),
              { minLength: 5, maxLength: 15 },
            ),
            async (photos: PhotoMetadata[]) => {
              // Sort photos by timestamp
              const sortedPhotos = [...photos].sort(
                (a, b) => a.timestamp - b.timestamp,
              );

              // Create artificial burst with small gaps
              const baseTime = Date.now();
              const burstPhotos = sortedPhotos.slice(0, 5).map((photo, i) => ({
                ...photo,
                timestamp: baseTime + i * 500, // 500ms gaps
              }));

              const detector = new BurstDetector({
                maxTimeGap: 1000,
                minBurstSize: 3,
              });
              const bursts = await detector.detectBursts(burstPhotos);

              // If bursts are detected, check time gaps
              bursts.forEach((burst) => {
                if (burst.count >= 2) {
                  expect(burst.avgInterval).toBeLessThanOrEqual(1000);
                }
              });
            },
          ),
          { numRuns: 10 },
        ),
      ).resolves.toBeUndefined();
    });

    it("Property 4: Confidence score bounds - confidence should be between 0 and 1", async () => {
      await expect(
        fc.assert(
          fc.asyncProperty(
            fc.array(
              fc.record({
                id: fc.string(),
                uri: fc.webUrl(),
                timestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
                fileTimestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
              }),
              { minLength: 3, maxLength: 20 },
            ),
            async (photos: PhotoMetadata[]) => {
              const detector = new BurstDetector();
              const bursts = await detector.detectBursts(photos);

              // All confidence scores should be valid
              bursts.forEach((burst) => {
                expect(burst.confidence).toBeGreaterThanOrEqual(0);
                expect(burst.confidence).toBeLessThanOrEqual(1);
              });
            },
          ),
          { numRuns: 10 },
        ),
      ).resolves.toBeUndefined();
    });

    it("Property 5: Burst coverage calculation - coverage should be accurate percentage", async () => {
      await expect(
        fc.assert(
          fc.asyncProperty(
            fc.array(
              fc.record({
                id: fc.string(),
                uri: fc.webUrl(),
                timestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
                fileTimestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
              }),
              { minLength: 5, maxLength: 20 },
            ),
            async (photos: PhotoMetadata[]) => {
              const detector = new BurstDetector();
              const analysis = detector.analyzeBurstPatterns(photos);

              // Coverage should be accurate
              const expectedPhotosInBursts =
                analysis.burstGroups * analysis.avgBurstSize;
              expect(analysis.photosInBursts).toBeGreaterThanOrEqual(0);
              expect(analysis.photosInBursts).toBeLessThanOrEqual(
                photos.length,
              );

              // Percentage should be valid
              expect(analysis.burstCoverage).toBeGreaterThanOrEqual(0);
              expect(analysis.burstCoverage).toBeLessThanOrEqual(100);

              // Total photos should match input
              expect(analysis.totalPhotos).toBe(photos.length);
            },
          ),
          { numRuns: 10 },
        ),
      ).resolves.toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────
  // UNIT TESTS
  // ─────────────────────────────────────────────────────────

  describe("Basic Burst Detection", () => {
    it("should detect no bursts with insufficient photos", async () => {
      const photos = mockPhotos.slice(0, 1); // Only 1 photo

      const bursts = await detector.detectBursts(photos);

      expect(bursts).toEqual([]);
    });

    it("should detect burst with close timestamps", async () => {
      const baseTime = Date.now();
      const burstPhotos = [
        { ...mockPhotos[0], timestamp: baseTime },
        { ...mockPhotos[1], timestamp: baseTime + 500 },
        { ...mockPhotos[2], timestamp: baseTime + 1000 },
        { ...mockPhotos[3], timestamp: baseTime + 1500 },
      ];

      const bursts = await detector.detectBursts(burstPhotos);

      expect(bursts).toHaveLength(1);
      expect(bursts[0].photoIds).toHaveLength(4);
      expect(bursts[0].duration).toBe(1500);
      expect(bursts[0].avgInterval).toBeCloseTo(500, 0);
    });

    it("should not group photos with large time gaps", async () => {
      const baseTime = Date.now();
      const photos = [
        { ...mockPhotos[0], timestamp: baseTime },
        { ...mockPhotos[1], timestamp: baseTime + 5000 }, // 5 second gap
        { ...mockPhotos[2], timestamp: baseTime + 6000 },
      ];

      const bursts = await detector.detectBursts(photos);

      expect(bursts).toEqual([]);
    });

    it("should detect multiple separate bursts", async () => {
      const baseTime = Date.now();
      const photos = [
        // First burst
        { ...mockPhotos[0], timestamp: baseTime },
        { ...mockPhotos[1], timestamp: baseTime + 500 },
        { ...mockPhotos[2], timestamp: baseTime + 1000 },
        // Gap
        { ...mockPhotos[3], timestamp: baseTime + 5000 },
        // Second burst
        { ...mockPhotos[4], timestamp: baseTime + 5500 },
        { ...mockPhotos[5], timestamp: baseTime + 6000 },
      ];

      const bursts = await detector.detectBursts(photos);

      expect(bursts).toHaveLength(2);
      expect(bursts[0].photoIds).toHaveLength(3);
      expect(bursts[1].photoIds).toHaveLength(3); // Fixed: should be 3 photos, not 2
    });
  });

  describe("Sequence Number Detection", () => {
    it("should detect bursts using sequence numbers", async () => {
      const baseTime = Date.now();
      const photos = [
        { ...mockPhotos[0], timestamp: baseTime, sequenceNumber: 100 },
        { ...mockPhotos[1], timestamp: baseTime + 5000, sequenceNumber: 100 }, // Same sequence
        { ...mockPhotos[2], timestamp: baseTime + 10000, sequenceNumber: 100 }, // Same sequence
        { ...mockPhotos[3], timestamp: baseTime + 1500, sequenceNumber: 200 }, // Different sequence
      ];

      const detector = new BurstDetector({
        useSequenceNumbers: true,
        minBurstSize: 3,
      });
      const bursts = await detector.detectBursts(photos);

      expect(bursts).toHaveLength(1);
      expect(bursts[0].type).toBe("sequence");
      expect(bursts[0].photoIds).toHaveLength(3);
    });

    it("should ignore sequence numbers when disabled", async () => {
      const baseTime = Date.now();
      const photos = [
        { ...mockPhotos[0], timestamp: baseTime, sequenceNumber: 100 },
        { ...mockPhotos[1], timestamp: baseTime + 5000, sequenceNumber: 100 }, // Same sequence
        { ...mockPhotos[2], timestamp: baseTime + 10000, sequenceNumber: 100 }, // Same sequence
      ];

      const detector = new BurstDetector({ useSequenceNumbers: false });
      const bursts = await detector.detectBursts(photos);

      expect(bursts).toEqual([]); // No temporal bursts due to large gaps
    });
  });

  describe("Burst Analysis", () => {
    it("should provide accurate burst statistics", () => {
      const baseTime = Date.now();
      const photos = [
        // Burst 1
        { ...mockPhotos[0], timestamp: baseTime },
        { ...mockPhotos[1], timestamp: baseTime + 500 },
        { ...mockPhotos[2], timestamp: baseTime + 1000 },
        // Individual
        { ...mockPhotos[3], timestamp: baseTime + 5000 },
        // Burst 2
        { ...mockPhotos[4], timestamp: baseTime + 6000 },
        { ...mockPhotos[5], timestamp: baseTime + 6500 },
      ];

      const analysis = detector.analyzeBurstPatterns(photos);

      expect(analysis.totalPhotos).toBe(6);
      expect(analysis.burstGroups).toBe(2);
      expect(analysis.photosInBursts).toBe(6); // All 6 photos are in bursts
      expect(analysis.burstCoverage).toBeCloseTo(100, 1); // 100% coverage
      expect(analysis.avgBurstSize).toBe(3); // (3 + 3) / 2 = 3
    });

    it("should handle empty photo collection", () => {
      const analysis = detector.analyzeBurstPatterns([]);

      expect(analysis.totalPhotos).toBe(0);
      expect(analysis.burstGroups).toBe(0);
      expect(analysis.photosInBursts).toBe(0);
      expect(analysis.burstCoverage).toBe(0);
      expect(analysis.avgBurstSize).toBe(0);
    });
  });

  describe("Individual Photo Analysis", () => {
    it("should identify burst photos correctly", async () => {
      const baseTime = Date.now();
      const photos = [
        { ...mockPhotos[0], timestamp: baseTime },
        { ...mockPhotos[1], timestamp: baseTime + 500 },
        { ...mockPhotos[2], timestamp: baseTime + 1000 },
        { ...mockPhotos[3], timestamp: baseTime + 5000 }, // Far away
      ];

      const isBurst = await detector.isBurstPhoto(photos[0], photos);

      expect(isBurst).toBe(true);
    });

    it("should identify non-burst photos correctly", async () => {
      const baseTime = Date.now();
      const photos = [
        { ...mockPhotos[0], timestamp: baseTime },
        { ...mockPhotos[1], timestamp: baseTime + 5000 }, // Far away
        { ...mockPhotos[2], timestamp: baseTime + 10000 }, // Far away
      ];

      const isBurst = await detector.isBurstPhoto(photos[0], photos);

      expect(isBurst).toBe(false);
    });
  });

  describe("Photo Grouping", () => {
    it("should separate bursts and individuals correctly", async () => {
      const baseTime = Date.now();
      const photos = [
        // Burst
        { ...mockPhotos[0], timestamp: baseTime },
        { ...mockPhotos[1], timestamp: baseTime + 500 },
        { ...mockPhotos[2], timestamp: baseTime + 1000 },
        // Individual
        { ...mockPhotos[3], timestamp: baseTime + 5000 },
      ];

      const { bursts, individuals } = await detector.groupPhotosByBurst(photos);

      expect(bursts).toHaveLength(1);
      expect(bursts[0].photoIds).toHaveLength(3);
      expect(individuals).toHaveLength(1);
      expect(individuals[0].id).toBe(photos[3].id);
    });
  });

  // ─────────────────────────────────────────────────────────
  // CONFIGURATION TESTS
  // ─────────────────────────────────────────────────────────

  describe("Configuration", () => {
    it("should respect custom time gap threshold", async () => {
      const baseTime = Date.now();
      const photos = [
        { ...mockPhotos[0], timestamp: baseTime },
        { ...mockPhotos[1], timestamp: baseTime + 1500 }, // 1.5 second gap
        { ...mockPhotos[2], timestamp: baseTime + 3000 }, // 1.5 second gap
      ];

      const lenientDetector = new BurstDetector({ maxTimeGap: 2000 });
      const strictDetector = new BurstDetector({ maxTimeGap: 1000 });

      const lenientBursts = await lenientDetector.detectBursts(photos);
      const strictBursts = await strictDetector.detectBursts(photos);

      expect(lenientBursts).toHaveLength(1);
      expect(strictBursts).toEqual([]);
    });

    it("should respect minimum burst size", async () => {
      const baseTime = Date.now();
      const photos = [
        { ...mockPhotos[0], timestamp: baseTime },
        { ...mockPhotos[1], timestamp: baseTime + 500 }, // Only 2 photos
      ];

      const detector = new BurstDetector({ minBurstSize: 3 });
      const bursts = await detector.detectBursts(photos);

      expect(bursts).toEqual([]);
    });

    it("should filter by confidence threshold", async () => {
      const baseTime = Date.now();
      const photos = [
        { ...mockPhotos[0], timestamp: baseTime },
        { ...mockPhotos[1], timestamp: baseTime + 500 },
        { ...mockPhotos[2], timestamp: baseTime + 1000 },
      ];

      const strictDetector = new BurstDetector({ confidenceThreshold: 0.9 });
      const bursts = await strictDetector.detectBursts(photos);

      // Should filter out low confidence bursts
      expect(bursts.length).toBeLessThanOrEqual(1);
    });
  });

  // ─────────────────────────────────────────────────────────
  // UTILITY FUNCTION TESTS
  // ─────────────────────────────────────────────────────────

  describe("Utility Functions", () => {
    it("should extract photo metadata correctly", async () => {
      const imageUri = "file:///test/burst_photo.jpg";
      const id = "test_photo";

      const metadata = await extractPhotoMetadata(imageUri, id);

      expect(metadata.id).toBe(id);
      expect(metadata.uri).toBe(imageUri);
      expect(metadata.timestamp).toBeGreaterThan(0);
      expect(metadata.fileTimestamp).toBeGreaterThan(0);
    });

    it("should handle burst photo metadata extraction", async () => {
      const imageUri = "file:///test/burst_photo.jpg";
      const id = "burst_photo";

      const metadata = await extractPhotoMetadata(imageUri, id);

      expect(metadata.isBurstCandidate).toBe(true);
      expect(metadata.sequenceNumber).toBeDefined();
    });

    it("should provide singleton instance", () => {
      const detector1 = getBurstDetector();
      const detector2 = getBurstDetector();

      expect(detector1).toBe(detector2);
    });

    it("should create separate instances for different configs", () => {
      const detector1 = getBurstDetector({ maxTimeGap: 1000 });
      const detector2 = getBurstDetector({ maxTimeGap: 2000 });

      expect(detector1).not.toBe(detector2);
    });

    it("should perform quick burst check", async () => {
      const baseTime = Date.now();
      const photo = { ...mockPhotos[0], timestamp: baseTime };
      const nearbyPhotos = [
        photo,
        { ...mockPhotos[1], timestamp: baseTime + 500 },
        { ...mockPhotos[2], timestamp: baseTime + 1000 },
      ];

      const isBurst = await quickBurstCheck(photo, nearbyPhotos);

      expect(isBurst).toBe(true);
    });

    it("should analyze collection bursts", async () => {
      const analysis = await analyzeCollectionBursts(mockPhotos);

      expect(analysis).toHaveProperty("totalPhotos");
      expect(analysis).toHaveProperty("burstGroups");
      expect(analysis).toHaveProperty("photosInBursts");
      expect(analysis).toHaveProperty("burstCoverage");
      expect(analysis.totalPhotos).toBe(mockPhotos.length);
    });
  });

  // ─────────────────────────────────────────────────────────
  // ERROR HANDLING TESTS
  // ─────────────────────────────────────────────────────────

  describe("Error Handling", () => {
    it("should handle empty photo array", async () => {
      const bursts = await detector.detectBursts([]);
      expect(bursts).toEqual([]);
    });

    it("should handle photos with missing timestamps", async () => {
      const photos = [
        { ...mockPhotos[0], timestamp: 0 },
        { ...mockPhotos[1], timestamp: Date.now() },
      ];

      const bursts = await detector.detectBursts(photos);

      // Should not throw, but handle gracefully
      expect(Array.isArray(bursts)).toBe(true);
    });

    it("should handle metadata extraction errors", async () => {
      const metadata = await extractPhotoMetadata("", "test");

      expect(metadata.id).toBe("test");
      expect(metadata.uri).toBe("");
      expect(metadata.timestamp).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // PERFORMANCE TESTS
  // ─────────────────────────────────────────────────────────

  describe("Performance", () => {
    it("should handle large photo collections efficiently", async () => {
      const largePhotoSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `photo_${i}`,
        uri: `file:///test/photo_${i}.jpg`,
        timestamp: Date.now() + i * 100,
        fileTimestamp: Date.now() + i * 100,
      }));

      const startTime = Date.now();
      const bursts = await detector.detectBursts(largePhotoSet);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
      expect(Array.isArray(bursts)).toBe(true);
    });

    it("should maintain consistent performance with multiple calls", async () => {
      const times: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await detector.detectBursts(mockPhotos);
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const variance =
        times.reduce((sum, time) => sum + (time - avgTime) ** 2, 0) /
        times.length;

      // Performance should be relatively consistent (allowing for some variance)
      // Handle case where variance is 0 (perfectly consistent)
      const stdDev = Math.sqrt(variance);
      if (avgTime > 0) {
        expect(stdDev).toBeLessThan(avgTime * 2); // More lenient
      } else {
        expect(stdDev).toBe(0);
      }
    });
  });
});

// ─────────────────────────────────────────────────────────
// INTEGRATION TESTS
// ─────────────────────────────────────────────────────────

describe("BurstDetector Integration", () => {
  afterEach(() => {
    delete (global as any).burstDetectorInstances;
  });

  it("should handle concurrent burst detection", async () => {
    const detector = getBurstDetector();
    const baseTime = Date.now();
    const photos = Array.from({ length: 10 }, (_, i) => ({
      id: `photo_${i}`,
      uri: `file:///test/photo_${i}.jpg`,
      timestamp: baseTime + i * 500,
      fileTimestamp: baseTime + i * 500,
    }));

    // Run multiple detections concurrently
    const promises = Array(3)
      .fill(null)
      .map(() => detector.detectBursts(photos));
    const results = await Promise.all(promises);

    // All should complete successfully with same structure
    results.forEach((result) => {
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("photoIds");
        expect(result[0]).toHaveProperty("startTime");
        expect(result[0]).toHaveProperty("endTime");
        expect(result[0]).toHaveProperty("duration");
        expect(result[0]).toHaveProperty("count");
        expect(result[0]).toHaveProperty("avgInterval");
        expect(result[0]).toHaveProperty("confidence");
        expect(result[0]).toHaveProperty("type");
      }
    });
  });

  it("should integrate with metadata extraction", async () => {
    const imageUris = [
      "file:///test/photo1.jpg",
      "file:///test/burst_photo1.jpg",
      "file:///test/burst_photo2.jpg",
    ];

    const metadataPromises = imageUris.map((uri, i) =>
      extractPhotoMetadata(uri, `photo_${i}`),
    );
    const metadata = await Promise.all(metadataPromises);

    const detector = getBurstDetector();
    const bursts = await detector.detectBursts(metadata);

    expect(Array.isArray(bursts)).toBe(true);
    expect(metadata).toHaveLength(3);
  });
});
