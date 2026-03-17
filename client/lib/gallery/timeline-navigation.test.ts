// AI-META-BEGIN
// AI-META: Comprehensive tests for timeline navigation service with property-based testing
// OWNERSHIP: client/lib/gallery (timeline navigation testing)
// ENTRYPOINTS: Used by test runners for timeline navigation validation
// DEPENDENCIES: vitest, @/types, timeline-navigation service, fast-check for property tests
// DANGER: Performance-sensitive tests with large datasets; memory usage with 10k+ photos
// CHANGE-SAFETY: Safe to modify test cases; risky to change performance test thresholds
// TESTS: Property tests for hierarchy creation, navigation path validation, zoom level calculations
// AI-META-END

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import fc from "fast-check";
import {
  createTimelineHierarchy,
  findTimelineNode,
  getTimelinePath,
  getParentTimelineNode,
  getTimelineSiblings,
  getZoomLevelForScale,
  getTimelineDataForLevel,
  timelineToFlashListData,
  estimateVisiblePhotos,
  TimelineCache,
  DEFAULT_ZOOM_LEVELS,
  type TimelineNode,
  type Photo,
} from "./timeline-navigation";

// Mock photo factory for testing
function createMockPhoto(overrides: Partial<Photo> = {}): Photo {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    id: `photo-${Math.random().toString(36).substr(2, 9)}`,
    uri: `file://photo-${Math.random().toString(36).substr(2, 9)}.jpg`,
    width: 1920,
    height: 1080,
    filename: `photo-${Math.random().toString(36).substr(2, 9)}.jpg`,
    createdAt: now - Math.floor(Math.random() * 365 * dayMs), // Random date within last year
    modifiedAt: now,
    isFavorite: false,
    isPrivate: false,
    albumIds: [],
    ...overrides,
  };
}

// Create realistic test data
function createTestPhotos(
  count: number,
  dateRange?: { start: Date; end: Date },
): Photo[] {
  const photos: Photo[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    let createdAt: number;

    if (dateRange) {
      const range = dateRange.end.getTime() - dateRange.start.getTime();
      createdAt = dateRange.start.getTime() + Math.random() * range;
    } else {
      createdAt = now - Math.floor(Math.random() * 365 * dayMs);
    }

    photos.push(
      createMockPhoto({
        id: `photo-${i}`,
        createdAt,
        modifiedAt: createdAt,
      }),
    );
  }

  return photos;
}

describe("Timeline Navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTimelineHierarchy", () => {
    it("should create empty hierarchy for no photos", () => {
      const hierarchy = createTimelineHierarchy([]);
      expect(hierarchy).toEqual([]);
    });

    it("should create single year for photos from same year", () => {
      const photos = createTestPhotos(5, {
        start: new Date(2023, 0, 1),
        end: new Date(2023, 11, 31),
      });

      const hierarchy = createTimelineHierarchy(photos);

      expect(hierarchy).toHaveLength(1);
      expect(hierarchy[0].level).toBe("year");
      expect(hierarchy[0].title).toBe("2023");
      expect(hierarchy[0].count).toBe(5);
    });

    it("should create multiple years for photos from different years", () => {
      const photos = [
        ...createTestPhotos(3, {
          start: new Date(2023, 6, 1),
          end: new Date(2023, 8, 31),
        }),
        ...createTestPhotos(2, {
          start: new Date(2022, 6, 1),
          end: new Date(2022, 8, 31),
        }),
      ];

      const hierarchy = createTimelineHierarchy(photos);

      expect(hierarchy).toHaveLength(2);
      expect(hierarchy[0].title).toBe("2023"); // Most recent first
      expect(hierarchy[1].title).toBe("2022");
      expect(hierarchy[0].count).toBe(3);
      expect(hierarchy[1].count).toBe(2);
    });

    it("should create month nodes within years", () => {
      const photos = [
        createMockPhoto({ createdAt: new Date(2023, 0, 15).getTime() }), // January
        createMockPhoto({ createdAt: new Date(2023, 1, 15).getTime() }), // February
        createMockPhoto({ createdAt: new Date(2023, 0, 20).getTime() }), // January
      ];

      const hierarchy = createTimelineHierarchy(photos);

      expect(hierarchy).toHaveLength(1);
      const year = hierarchy[0];
      expect(year.children).toHaveLength(2);
      expect(year.children![0].title).toBe("February 2023"); // Most recent first
      expect(year.children![1].title).toBe("January 2023");
    });

    it("should create day nodes within months", () => {
      const photos = [
        createMockPhoto({ createdAt: new Date(2023, 0, 15, 10, 0).getTime() }), // Jan 15 AM
        createMockPhoto({ createdAt: new Date(2023, 0, 15, 15, 0).getTime() }), // Jan 15 PM
        createMockPhoto({ createdAt: new Date(2023, 0, 16, 10, 0).getTime() }), // Jan 16
      ];

      const hierarchy = createTimelineHierarchy(photos);

      const year = hierarchy[0];
      const month = year.children![0];

      // Days are sorted chronologically (newest first), so Jan 16 comes first
      expect(month.children).toHaveLength(2); // 2 days: Jan 16 and Jan 15
      expect(month.children![0].level).toBe("day");
      expect(month.children![0].count).toBe(1); // Jan 16 has 1 photo (newest)
      expect(month.children![1].count).toBe(2); // Jan 15 has 2 photos (older)
    });

    it("should sort chronologically (newest first)", () => {
      const photos = [
        createMockPhoto({ createdAt: new Date(2021, 6, 15).getTime() }),
        createMockPhoto({ createdAt: new Date(2023, 6, 15).getTime() }),
        createMockPhoto({ createdAt: new Date(2022, 6, 15).getTime() }),
      ];

      const hierarchy = createTimelineHierarchy(photos);

      expect(hierarchy.map((n) => n.title)).toEqual(["2023", "2022", "2021"]);
    });

    // Property-based test for hierarchy structure integrity
    it("should maintain hierarchy structure integrity for any photo set", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string(),
              uri: fc.string(),
              width: fc.integer({ min: 1, max: 4000 }),
              height: fc.integer({ min: 1, max: 4000 }),
              filename: fc.string(),
              createdAt: fc.integer({ min: 0, max: Date.now() }),
              modifiedAt: fc.integer({ min: 0, max: Date.now() }),
              isFavorite: fc.boolean(),
              isPrivate: fc.boolean(),
              albumIds: fc.array(fc.string()),
            }),
            { minLength: 0, maxLength: 100 },
          ),
          (photoRecords) => {
            // Convert records to Photo type
            const photos = photoRecords.map((record) => ({
              ...record,
              isFavorite: Boolean(record.isFavorite),
              isPrivate: Boolean(record.isPrivate),
              albumIds: Array.isArray(record.albumIds) ? record.albumIds : [],
            })) as Photo[];

            const hierarchy = createTimelineHierarchy(photos);

            // Verify structure invariants
            const totalPhotos = hierarchy.reduce(
              (sum, year) => sum + year.count,
              0,
            );
            expect(totalPhotos).toBe(photos.length);

            // Verify no duplicate IDs
            const allIds = new Set<string>();
            hierarchy.forEach((year) => {
              expect(allIds.has(year.id)).toBe(false);
              allIds.add(year.id);

              year.children?.forEach((month) => {
                expect(allIds.has(month.id)).toBe(false);
                allIds.add(month.id);

                month.children?.forEach((day) => {
                  expect(allIds.has(day.id)).toBe(false);
                  allIds.add(day.id);
                });
              });
            });
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("findTimelineNode", () => {
    let hierarchy: TimelineNode[];
    let testPhotos: Photo[];

    beforeEach(() => {
      testPhotos = createTestPhotos(10);
      hierarchy = createTimelineHierarchy(testPhotos);
    });

    it("should find year node by ID", () => {
      const yearNode = hierarchy[0];
      const found = findTimelineNode(hierarchy, yearNode.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(yearNode.id);
      expect(found!.level).toBe("year");
    });

    it("should find month node by ID", () => {
      const yearNode = hierarchy[0];
      const monthNode = yearNode.children![0];
      const found = findTimelineNode(hierarchy, monthNode.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(monthNode.id);
      expect(found!.level).toBe("month");
    });

    it("should return null for non-existent node", () => {
      const found = findTimelineNode(hierarchy, "non-existent-id");
      expect(found).toBeNull();
    });
  });

  describe("getTimelinePath", () => {
    let hierarchy: TimelineNode[];
    let testPhotos: Photo[];

    beforeEach(() => {
      testPhotos = [
        createMockPhoto({ createdAt: new Date(2023, 1, 15, 10, 0).getTime() }),
      ];
      hierarchy = createTimelineHierarchy(testPhotos);
    });

    it("should return path to year node", () => {
      const yearNode = hierarchy[0];
      const path = getTimelinePath(hierarchy, yearNode.id);

      expect(path).toHaveLength(1);
      expect(path[0].level).toBe("year");
      expect(path[0].nodeId).toBe(yearNode.id);
    });

    it("should return path to day node", () => {
      const yearNode = hierarchy[0];
      const monthNode = yearNode.children![0];
      const dayNode = monthNode.children![0];

      const path = getTimelinePath(hierarchy, dayNode.id);

      expect(path).toHaveLength(3);
      expect(path[0].level).toBe("year");
      expect(path[1].level).toBe("month");
      expect(path[2].level).toBe("day");
      expect(path[2].nodeId).toBe(dayNode.id);
    });

    it("should return empty path for non-existent node", () => {
      const path = getTimelinePath(hierarchy, "non-existent-id");
      expect(path).toHaveLength(0);
    });
  });

  describe("getZoomLevelForScale", () => {
    it("should return year level for very small scale", () => {
      const level = getZoomLevelForScale(0.1);
      expect(level.level).toBe("year");
      expect(level.columns).toBe(1);
    });

    it("should return month level for medium scale", () => {
      const level = getZoomLevelForScale(0.5);
      expect(level.level).toBe("month");
      expect(level.columns).toBe(2);
    });

    it("should return photo level for full scale", () => {
      const level = getZoomLevelForScale(1.0);
      expect(level.level).toBe("photo");
      expect(level.columns).toBe(4);
    });

    it("should return photo level for scale greater than 1", () => {
      const level = getZoomLevelForScale(1.5);
      expect(level.level).toBe("photo");
    });

    // Property-based test for zoom level thresholds
    it("should handle any scale value correctly", () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 2 }), (scale) => {
          const level = getZoomLevelForScale(scale);

          // Should always return a valid level
          expect(
            DEFAULT_ZOOM_LEVELS.some((zl) => zl.level === level.level),
          ).toBe(true);

          // Should have valid configuration
          expect(level.columns).toBeGreaterThan(0);
          expect(level.itemHeight).toBeGreaterThan(0);
          expect(level.threshold).toBeGreaterThan(0);
          expect(level.threshold).toBeLessThanOrEqual(1);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe("timelineToFlashListData", () => {
    let nodes: TimelineNode[];

    beforeEach(() => {
      nodes = [
        {
          id: "year-2023",
          level: "year",
          title: "2023",
          count: 100,
          date: new Date(2023, 0, 1),
          thumbnail: createMockPhoto(),
        },
        {
          id: "year-2022",
          level: "year",
          title: "2022",
          count: 50,
          date: new Date(2022, 0, 1),
          thumbnail: createMockPhoto(),
        },
      ];
    });

    it("should convert nodes to flat data with headers", () => {
      const flatData = timelineToFlashListData(nodes, true);

      expect(flatData).toHaveLength(4); // 2 headers + 2 nodes
      expect(flatData[0]).toEqual({ type: "header", title: "2023" });
      expect(flatData[1]).toEqual(nodes[0]);
      expect(flatData[2]).toEqual({ type: "header", title: "2022" });
      expect(flatData[3]).toEqual(nodes[1]);
    });

    it("should convert nodes to flat data without headers", () => {
      const flatData = timelineToFlashListData(nodes, false);

      expect(flatData).toHaveLength(2);
      expect(flatData[0]).toEqual(nodes[0]);
      expect(flatData[1]).toEqual(nodes[1]);
    });

    it("should not add headers for photo level", () => {
      const photoNodes = nodes.map((n) => ({ ...n, level: "photo" as const }));
      const flatData = timelineToFlashListData(photoNodes, true);

      expect(flatData).toHaveLength(2); // No headers
      expect(flatData[0]).toEqual(photoNodes[0]);
      expect(flatData[1]).toEqual(photoNodes[1]);
    });
  });

  describe("TimelineCache", () => {
    let cache: TimelineCache;
    let testHierarchy: TimelineNode[];

    beforeEach(() => {
      cache = new TimelineCache();
      testHierarchy = createTimelineHierarchy(createTestPhotos(5));
    });

    it("should store and retrieve hierarchy", () => {
      cache.set("test-key", testHierarchy);

      const retrieved = cache.get("test-key");
      expect(retrieved).toEqual(testHierarchy);
    });

    it("should return undefined for non-existent key", () => {
      const retrieved = cache.get("non-existent");
      expect(retrieved).toBeUndefined();
    });

    it("should check if key exists", () => {
      expect(cache.has("test-key")).toBe(false);

      cache.set("test-key", testHierarchy);
      expect(cache.has("test-key")).toBe(true);
    });

    it("should limit cache size", () => {
      // Fill cache beyond max size
      for (let i = 0; i < 15; i++) {
        cache.set(`key-${i}`, testHierarchy);
      }

      // Should only have most recent entries
      expect(cache.has("key-0")).toBe(false);
      expect(cache.has("key-14")).toBe(true);
      expect(cache.has("key-4")).toBe(false); // Should be evicted
      expect(cache.has("key-10")).toBe(true); // Should still be present
    });

    it("should clear cache", () => {
      cache.set("key-1", testHierarchy);
      cache.set("key-2", testHierarchy);

      expect(cache.has("key-1")).toBe(true);
      expect(cache.has("key-2")).toBe(true);

      cache.clear();

      expect(cache.has("key-1")).toBe(false);
      expect(cache.has("key-2")).toBe(false);
    });
  });

  describe("Performance Tests", () => {
    it("should handle large photo libraries efficiently", () => {
      const largePhotoSet = createTestPhotos(10000);

      const startTime = performance.now();
      const hierarchy = createTimelineHierarchy(largePhotoSet);
      const endTime = performance.now();

      // Should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(1000); // 1 second
      expect(hierarchy.length).toBeGreaterThan(0);

      // Verify structure integrity
      const totalPhotos = hierarchy.reduce((sum, year) => sum + year.count, 0);
      expect(totalPhotos).toBe(10000);
    });

    it("should handle memory efficiently with caching", () => {
      const cache = new TimelineCache();

      // Add more items than cache max size to trigger eviction
      for (let i = 0; i < 15; i++) {
        const photos = createTestPhotos(1000);
        const hierarchy = createTimelineHierarchy(photos);
        cache.set(`key-${i}`, hierarchy);
      }

      // Cache should maintain size limit - oldest items should be evicted
      expect(cache.has("key-0")).toBe(false); // Evicted
      expect(cache.has("key-14")).toBe(true); // Most recent
      expect(cache.has("key-9")).toBe(true); // Should still be present

      // Retrieved data should be identical
      const originalHierarchy = createTimelineHierarchy(createTestPhotos(1000));
      const cachedHierarchy = cache.get("key-14");
      expect(cachedHierarchy).toBeDefined();
      expect(cachedHierarchy!.length).toBe(originalHierarchy.length);
    });
  });

  describe("Edge Cases", () => {
    it("should handle photos with same timestamp", () => {
      const timestamp = Date.now();
      const photos = [
        createMockPhoto({ createdAt: timestamp }),
        createMockPhoto({ createdAt: timestamp }),
        createMockPhoto({ createdAt: timestamp }),
      ];

      const hierarchy = createTimelineHierarchy(photos);

      expect(hierarchy).toHaveLength(1);
      expect(hierarchy[0].count).toBe(3);
    });

    it("should handle photos from future dates", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const photos = [createMockPhoto({ createdAt: futureDate.getTime() })];
      const hierarchy = createTimelineHierarchy(photos);

      expect(hierarchy).toHaveLength(1);
      expect(hierarchy[0].title).toBe(futureDate.getFullYear().toString());
    });

    it("should handle photos from year 0", () => {
      const photos = [createMockPhoto({ createdAt: 0 })];
      const hierarchy = createTimelineHierarchy(photos);

      expect(hierarchy).toHaveLength(1);
      expect(hierarchy[0].title).toBe("1969"); // Unix epoch in local timezone
    });
  });
});
