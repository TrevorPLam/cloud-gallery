// AI-META-BEGIN
// AI-META: Comprehensive tests for temporal layers service
// OWNERSHIP: client/lib/map
// ENTRYPOINTS: Test suite for temporal-layers.ts
// DEPENDENCIES: vitest, fast-check for property testing
// DANGER: Tests must handle edge cases like empty datasets, invalid timestamps
// CHANGE-SAFETY: Safe to modify tests; ensure coverage remains at 100%
// TESTS: Unit tests, property tests, animation performance benchmarks
// AI-META-END

import { describe, it, expect, beforeEach, bench } from "vitest";
import { fc } from "fast-check";
import React from "react";
import {
  TemporalLayersService,
  temporalLayersService,
  createTemporalLayersService,
  useTemporalLayers,
  TimeUtils,
  createTimelineMarkers,
  getTemporalStatistics,
  type TimeRange,
  type TimeBucket,
  type TemporalLayer,
  type TimelineConfig,
} from "./temporal-layers";
import { Photo } from "@/types";

// Mock photo data factory
function createMockPhoto(overrides: Partial<Photo> = {}): Photo {
  const id = `photo-${Math.random().toString(36).substr(2, 9)}`;
  const baseTime = Date.now() - 365 * 24 * 60 * 60 * 1000; // 1 year ago
  return {
    id,
    uri: `file://photos/${id}.jpg`,
    width: 1920,
    height: 1080,
    createdAt: baseTime + Math.random() * 365 * 24 * 60 * 60 * 1000, // Random time in past year
    modifiedAt: Date.now(),
    filename: `${id}.jpg`,
    isFavorite: false,
    albumIds: [],
    location: {
      latitude: -90 + Math.random() * 180,
      longitude: -180 + Math.random() * 360,
      city: "Test City",
    },
    ...overrides,
  };
}

// Create photos with specific timestamps
function createPhotosWithTimestamps(timestamps: number[]): Photo[] {
  return timestamps.map((timestamp, index) =>
    createMockPhoto({
      id: `photo-${index}`,
      createdAt: timestamp,
    }),
  );
}

describe("TimeUtils", () => {
  describe("Bucket Size Calculations", () => {
    it("should return correct bucket sizes", () => {
      const dayMs = 24 * 60 * 60 * 1000;

      expect(TimeUtils.getBucketSize("day")).toBe(dayMs);
      expect(TimeUtils.getBucketSize("week")).toBe(7 * dayMs);
      expect(TimeUtils.getBucketSize("month")).toBe(30 * dayMs);
      expect(TimeUtils.getBucketSize("quarter")).toBe(90 * dayMs);
      expect(TimeUtils.getBucketSize("year")).toBe(365 * dayMs);
    });
  });

  describe("Time Bucket Creation", () => {
    it("should create buckets correctly", () => {
      const baseTime = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
      const timestamps = [
        baseTime,
        baseTime + 2 * 24 * 60 * 60 * 1000, // 2 days later
        baseTime + 5 * 24 * 60 * 60 * 1000, // 5 days later
        baseTime + 10 * 24 * 60 * 60 * 1000, // 10 days later
      ];
      const photos = createPhotosWithTimestamps(timestamps);

      const buckets = TimeUtils.createTimeBuckets(photos, "day");

      expect(buckets.length).toBeGreaterThan(0);
      expect(buckets.every((bucket) => bucket.photos.length > 0)).toBe(true);
      expect(
        buckets.every((bucket) => bucket.count === bucket.photos.length),
      ).toBe(true);
    });

    it("should handle empty photo arrays", () => {
      const buckets = TimeUtils.createTimeBuckets([], "day");
      expect(buckets).toEqual([]);
    });

    it("should respect padding", () => {
      const baseTime = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
      const photos = createPhotosWithTimestamps([baseTime]);

      const bucketsWithoutPadding = TimeUtils.createTimeBuckets(
        photos,
        "day",
        0,
      );
      const bucketsWithPadding = TimeUtils.createTimeBuckets(photos, "day", 5);

      expect(bucketsWithPadding.length).toBeGreaterThanOrEqual(
        bucketsWithoutPadding.length,
      );
    });
  });

  describe("Time Range Operations", () => {
    it("should get time range from photos", () => {
      const timestamps = [1000, 2000, 3000];
      const photos = createPhotosWithTimestamps(timestamps);

      const range = TimeUtils.getTimeRange(photos);
      expect(range.start).toBe(1000);
      expect(range.end).toBe(3000);
    });

    it("should handle empty photo arrays for time range", () => {
      const range = TimeUtils.getTimeRange([]);
      const now = Date.now();
      expect(range.start).toBe(now);
      expect(range.end).toBe(now);
    });

    it("should detect overlapping ranges", () => {
      const range1: TimeRange = { start: 1000, end: 2000 };
      const range2: TimeRange = { start: 1500, end: 2500 };
      const range3: TimeRange = { start: 2500, end: 3500 };

      expect(TimeUtils.rangesOverlap(range1, range2)).toBe(true);
      expect(TimeUtils.rangesOverlap(range2, range3)).toBe(true);
      expect(TimeUtils.rangesOverlap(range1, range3)).toBe(false);
    });

    it("should merge overlapping ranges", () => {
      const ranges: TimeRange[] = [
        { start: 1000, end: 2000 },
        { start: 1500, end: 2500 },
        { start: 3000, end: 4000 },
        { start: 3500, end: 4500 },
      ];

      const merged = TimeUtils.mergeRanges(ranges);
      expect(merged).toEqual([
        { start: 1000, end: 2500 },
        { start: 3000, end: 4500 },
      ]);
    });
  });

  describe("Timestamp Formatting", () => {
    it("should format timestamps correctly", () => {
      const timestamp = Date.now();

      const short = TimeUtils.formatTimestamp(timestamp, "short");
      const medium = TimeUtils.formatTimestamp(timestamp, "medium");
      const long = TimeUtils.formatTimestamp(timestamp, "long");

      expect(short).toMatch(/^[A-Za-z]{3} \d{1,2}$/);
      expect(medium).toMatch(/^[A-Za-z]{3} \d{1,2}, \d{4}$/);
      expect(long).toMatch(/^[A-Za-z]{3} [A-Za-z]{3} \d{1,2}, \d{4}$/);
    });

    it("should get relative time correctly", () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

      expect(TimeUtils.getRelativeTime(now)).toBe("just now");
      expect(TimeUtils.getRelativeTime(oneHourAgo)).toContain("hour");
      expect(TimeUtils.getRelativeTime(oneDayAgo)).toContain("day");
      expect(TimeUtils.getRelativeTime(oneWeekAgo)).toContain("week");
    });
  });
});

describe("TemporalLayersService", () => {
  let service: TemporalLayersService;

  beforeEach(() => {
    service = createTemporalLayersService({
      bucketSize: "day",
      animationDuration: 200,
      paddingDays: 0,
    });
  });

  describe("Basic Functionality", () => {
    it("should initialize with default config", () => {
      const defaultService = new TemporalLayersService();
      expect(defaultService).toBeDefined();
      expect(defaultService.getLayers()).toHaveLength(0);
    });

    it("should initialize layers from photos", () => {
      const photos = createPhotosWithTimestamps([
        Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days ago
        Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
        Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
      ]);

      service.initializeLayers(photos);

      const layers = service.getLayers();
      expect(layers.length).toBeGreaterThan(0);
      expect(layers.every((layer) => layer.photos.length > 0)).toBe(true);
    });

    it("should handle empty photo arrays", () => {
      service.initializeLayers([]);
      expect(service.getLayers()).toHaveLength(0);
      expect(service.getTimeBuckets()).toHaveLength(0);
    });

    it("should clear data properly", () => {
      const photos = [createMockPhoto()];
      service.initializeLayers(photos);
      expect(service.getLayers().length).toBeGreaterThan(0);

      service.clear();
      expect(service.getLayers()).toHaveLength(0);
      expect(service.getTimeBuckets()).toHaveLength(0);
    });
  });

  describe("Layer Management", () => {
    beforeEach(() => {
      const photos = createPhotosWithTimestamps([
        Date.now() - 5 * 24 * 60 * 60 * 1000,
        Date.now() - 3 * 24 * 60 * 60 * 1000,
        Date.now() - 1 * 24 * 60 * 60 * 1000,
      ]);
      service.initializeLayers(photos);
    });

    it("should get layer by ID", () => {
      const layers = service.getLayers();
      if (layers.length > 0) {
        const layer = service.getLayer(layers[0].id);
        expect(layer).toBeDefined();
        expect(layer?.id).toBe(layers[0].id);
      }
    });

    it("should update layer visibility", () => {
      const layers = service.getLayers();
      if (layers.length > 0) {
        const layerId = layers[0].id;

        service.setLayerVisibility(layerId, false);
        expect(service.getLayer(layerId)?.visible).toBe(false);

        service.setLayerVisibility(layerId, true);
        expect(service.getLayer(layerId)?.visible).toBe(true);
      }
    });

    it("should update layer opacity", () => {
      const layers = service.getLayers();
      if (layers.length > 0) {
        const layerId = layers[0].id;

        service.setLayerOpacity(layerId, 0.5);
        expect(service.getLayer(layerId)?.opacity).toBe(0.5);

        service.setLayerOpacity(layerId, 1.5); // Should be clamped to 1
        expect(service.getLayer(layerId)?.opacity).toBe(1);

        service.setLayerOpacity(layerId, -0.5); // Should be clamped to 0
        expect(service.getLayer(layerId)?.opacity).toBe(0);
      }
    });
  });

  describe("Time-based Photo Filtering", () => {
    beforeEach(() => {
      const baseTime = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
      const photos = createPhotosWithTimestamps([
        baseTime, // Day 0
        baseTime + 2 * 24 * 60 * 60 * 1000, // Day 2
        baseTime + 4 * 24 * 60 * 60 * 1000, // Day 4
        baseTime + 6 * 24 * 60 * 60 * 1000, // Day 6
        baseTime + 8 * 24 * 60 * 60 * 1000, // Day 8
      ]);
      service.initializeLayers(photos);
    });

    it("should get photos at specific time", () => {
      const timeRange = service.getOverallTimeRange();
      const middleTime =
        timeRange.start + (timeRange.end - timeRange.start) / 2;

      const photos = service.getPhotosAtTime(middleTime);
      expect(Array.isArray(photos)).toBe(true);
    });

    it("should get photos in time range", () => {
      const timeRange = service.getOverallTimeRange();
      const middleRange = {
        start: timeRange.start + (timeRange.end - timeRange.start) * 0.25,
        end: timeRange.start + (timeRange.end - timeRange.start) * 0.75,
      };

      const photos = service.getPhotosInRange(middleRange);
      expect(Array.isArray(photos)).toBe(true);
    });

    it("should respect layer visibility", () => {
      const layers = service.getLayers();
      if (layers.length > 0) {
        const layerId = layers[0].id;
        const timeRange = service.getOverallTimeRange();

        // Hide layer
        service.setLayerVisibility(layerId, false);
        const hiddenPhotos = service.getPhotosInRange(timeRange);

        // Show layer
        service.setLayerVisibility(layerId, true);
        const visiblePhotos = service.getPhotosInRange(timeRange);

        expect(visiblePhotos.length).toBeGreaterThanOrEqual(
          hiddenPhotos.length,
        );
      }
    });
  });

  describe("Animation State Management", () => {
    beforeEach(() => {
      const photos = createPhotosWithTimestamps([
        Date.now() - 5 * 24 * 60 * 60 * 1000,
        Date.now() - 3 * 24 * 60 * 60 * 1000,
        Date.now() - 1 * 24 * 60 * 60 * 1000,
      ]);
      service.initializeLayers(photos);
    });

    it("should manage animation state correctly", () => {
      const state = service.getAnimationState();
      expect(typeof state.isPlaying).toBe("boolean");
      expect(typeof state.currentTime).toBe("number");
      expect(typeof state.progress).toBe("number");
      expect(typeof state.speed).toBe("number");
    });

    it("should set animation time", () => {
      const timeRange = service.getOverallTimeRange();
      const targetTime =
        timeRange.start + (timeRange.end - timeRange.start) * 0.5;

      service.setAnimationTime(targetTime);
      const state = service.getAnimationState();

      expect(state.currentTime).toBe(targetTime);
      expect(state.progress).toBeCloseTo(0.5, 2);
    });

    it("should set animation progress", () => {
      service.setAnimationProgress(0.75);
      const state = service.getAnimationState();

      expect(state.progress).toBe(0.75);
    });

    it("should clamp animation progress", () => {
      service.setAnimationProgress(-0.5);
      expect(service.getAnimationState().progress).toBe(0);

      service.setAnimationProgress(1.5);
      expect(service.getAnimationState().progress).toBe(1);
    });

    it("should manage playing state", () => {
      service.setAnimationPlaying(true);
      expect(service.getAnimationState().isPlaying).toBe(true);

      service.setAnimationPlaying(false);
      expect(service.getAnimationState().isPlaying).toBe(false);
    });

    it("should set animation speed with limits", () => {
      service.setAnimationSpeed(2);
      expect(service.getAnimationState().speed).toBe(2);

      service.setAnimationSpeed(0.1); // Below minimum
      expect(service.getAnimationState().speed).toBe(0.25);

      service.setAnimationSpeed(10); // Above maximum
      expect(service.getAnimationState().speed).toBe(8);
    });
  });

  describe("Configuration Management", () => {
    it("should update configuration", () => {
      service.updateConfig({
        bucketSize: "week",
        animationDuration: 500,
        paddingDays: 3,
      });

      // Should not throw
      expect(() => service.updateConfig({})).not.toThrow();
    });
  });

  describe("Data Export", () => {
    it("should export data correctly", () => {
      const photos = [createMockPhoto(), createMockPhoto()];
      service.initializeLayers(photos);

      const exported = service.exportData();

      expect(exported.layers).toBeDefined();
      expect(exported.buckets).toBeDefined();
      expect(exported.animationState).toBeDefined();
      expect(exported.config).toBeDefined();
      expect(Array.isArray(exported.layers)).toBe(true);
      expect(Array.isArray(exported.buckets)).toBe(true);
    });
  });
});

describe("Utility Functions", () => {
  describe("createTimelineMarkers", () => {
    it("should create timeline markers from buckets", () => {
      const baseTime = Date.now() - 10 * 24 * 60 * 60 * 1000;
      const buckets: TimeBucket[] = [
        {
          id: "bucket-1",
          start: baseTime,
          end: baseTime + 24 * 60 * 60 * 1000,
          photos: [],
          count: 5,
        },
        {
          id: "bucket-2",
          start: baseTime + 2 * 24 * 60 * 60 * 1000,
          end: baseTime + 3 * 24 * 60 * 60 * 1000,
          photos: [],
          count: 3,
        },
      ];

      const markers = createTimelineMarkers(buckets);

      expect(markers).toHaveLength(2);
      expect(markers[0]).toHaveProperty("time");
      expect(markers[0]).toHaveProperty("label");
      expect(markers[0]).toHaveProperty("count");
      expect(markers[0].count).toBe(5);
      expect(markers[1].count).toBe(3);
    });
  });

  describe("getTemporalStatistics", () => {
    it("should calculate statistics correctly", () => {
      const baseTime = Date.now() - 10 * 24 * 60 * 60 * 1000;
      const layers: TemporalLayer[] = [
        {
          id: "layer-1",
          name: "Layer 1",
          timeRange: { start: baseTime, end: baseTime + 24 * 60 * 60 * 1000 },
          photos: [createMockPhoto(), createMockPhoto()],
          visible: true,
          opacity: 1,
          color: "#FF0000",
        },
        {
          id: "layer-2",
          name: "Layer 2",
          timeRange: {
            start: baseTime + 2 * 24 * 60 * 60 * 1000,
            end: baseTime + 3 * 24 * 60 * 60 * 1000,
          },
          photos: [createMockPhoto()],
          visible: true,
          opacity: 1,
          color: "#00FF00",
        },
      ];

      const stats = getTemporalStatistics(layers);

      expect(stats.totalLayers).toBe(2);
      expect(stats.totalPhotos).toBe(3);
      expect(stats.averagePhotosPerLayer).toBe(1.5);
      expect(stats.timeSpan).toBeGreaterThan(0);
    });

    it("should handle empty layers array", () => {
      const stats = getTemporalStatistics([]);

      expect(stats.totalLayers).toBe(0);
      expect(stats.totalPhotos).toBe(0);
      expect(stats.averagePhotosPerLayer).toBe(0);
      expect(stats.timeSpan).toBe(0);
    });
  });
});

describe("Property-based Tests", () => {
  it("should handle arbitrary timestamp arrays", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(0, Date.now()), { minLength: 0, maxLength: 100 }),
        (timestamps) => {
          const photos = createPhotosWithTimestamps(timestamps);
          const service = createTemporalLayersService();

          // Should not crash with any timestamp array
          expect(() => service.initializeLayers(photos)).not.toThrow();

          // Should handle empty arrays
          if (timestamps.length === 0) {
            expect(service.getLayers()).toHaveLength(0);
            expect(service.getTimeBuckets()).toHaveLength(0);
          }

          // Time range should be valid
          const timeRange = service.getOverallTimeRange();
          if (timestamps.length > 0) {
            expect(timeRange.start).toBeLessThanOrEqual(timeRange.end);
            expect(timeRange.start).toBe(Math.min(...timestamps));
            expect(timeRange.end).toBe(Math.max(...timestamps));
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should maintain time bucket invariants", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(0, Date.now()), { minLength: 10, maxLength: 100 }),
        fc.constantFrom("day", "week", "month", "quarter", "year"),
        (timestamps, bucketSize) => {
          const photos = createPhotosWithTimestamps(timestamps);
          const buckets = TimeUtils.createTimeBuckets(photos, bucketSize);

          // All photos should be in exactly one bucket
          const bucketedPhotos = buckets.flatMap((b) => b.photos);
          expect(bucketedPhotos.length).toBe(photos.length);

          // Buckets should be in chronological order
          for (let i = 1; i < buckets.length; i++) {
            expect(buckets[i].start).toBeGreaterThanOrEqual(
              buckets[i - 1].start,
            );
          }

          // Bucket counts should match photo counts
          buckets.forEach((bucket) => {
            expect(bucket.count).toBe(bucket.photos.length);
          });
        },
      ),
      { numRuns: 50 },
    );
  });

  it("should maintain animation state invariants", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(0, Date.now()), { minLength: 2, maxLength: 50 }),
        fc.float(0, 1), // progress
        fc.float(0.25, 8), // speed
        (timestamps, progress, speed) => {
          const photos = createPhotosWithTimestamps(timestamps);
          const service = createTemporalLayersService();
          service.initializeLayers(photos);

          // Set animation state
          service.setAnimationProgress(progress);
          service.setAnimationSpeed(speed);

          const state = service.getAnimationState();

          // Progress should be clamped
          expect(state.progress).toBeGreaterThanOrEqual(0);
          expect(state.progress).toBeLessThanOrEqual(1);

          // Speed should be clamped
          expect(state.speed).toBeGreaterThanOrEqual(0.25);
          expect(state.speed).toBeLessThanOrEqual(8);

          // Current time should be within range
          const timeRange = service.getOverallTimeRange();
          if (timeRange.start !== timeRange.end) {
            expect(state.currentTime).toBeGreaterThanOrEqual(timeRange.start);
            expect(state.currentTime).toBeLessThanOrEqual(timeRange.end);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe("Performance Tests", () => {
  it("should handle large photo collections efficiently", () => {
    const baseTime = Date.now() - 365 * 24 * 60 * 60 * 1000; // 1 year ago
    const timestamps = Array.from(
      { length: 1000 },
      (_, i) => baseTime + i * 24 * 60 * 60 * 1000, // One photo per day
    );
    const photos = createPhotosWithTimestamps(timestamps);

    bench("initialize 1000 photos", () => {
      const service = createTemporalLayersService();
      service.initializeLayers(photos);
    });

    const service = createTemporalLayersService();
    service.initializeLayers(photos);

    bench("get photos at time", () => {
      const timeRange = service.getOverallTimeRange();
      const middleTime =
        timeRange.start + (timeRange.end - timeRange.start) * 0.5;
      service.getPhotosAtTime(middleTime);
    });

    bench("get photos in range", () => {
      const timeRange = service.getOverallTimeRange();
      const middleRange = {
        start: timeRange.start + (timeRange.end - timeRange.start) * 0.25,
        end: timeRange.start + (timeRange.end - timeRange.start) * 0.75,
      };
      service.getPhotosInRange(middleRange);
    });
  });

  it("should handle rapid time operations", () => {
    const service = createTemporalLayersService();
    const photos = createPhotosWithTimestamps([
      Date.now() - 10 * 24 * 60 * 60 * 1000,
      Date.now() - 5 * 24 * 60 * 60 * 1000,
      Date.now(),
    ]);
    service.initializeLayers(photos);

    bench("rapid animation updates", () => {
      for (let i = 0; i < 100; i++) {
        service.setAnimationProgress(i / 100);
        service.getPhotosAtTime(service.getAnimationState().currentTime);
      }
    });
  });

  it("should handle time bucketing efficiently", () => {
    const baseTime = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const timestamps = Array.from(
      { length: 500 },
      (_, i) => baseTime + Math.random() * 365 * 24 * 60 * 60 * 1000,
    );
    const photos = createPhotosWithTimestamps(timestamps);

    bench("create time buckets - day", () => {
      TimeUtils.createTimeBuckets(photos, "day");
    });

    bench("create time buckets - week", () => {
      TimeUtils.createTimeBuckets(photos, "week");
    });

    bench("create time buckets - month", () => {
      TimeUtils.createTimeBuckets(photos, "month");
    });
  });
});
