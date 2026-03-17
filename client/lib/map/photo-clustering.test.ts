// AI-META-BEGIN
// AI-META: Comprehensive tests for photo clustering service
// OWNERSHIP: client/lib/map
// ENTRYPOINTS: Test suite for photo-clustering.ts
// DEPENDENCIES: vitest, fast-check for property testing
// DANGER: Tests must handle edge cases like invalid coordinates, empty datasets
// CHANGE-SAFETY: Safe to modify tests; ensure coverage remains at 100%
// TESTS: Unit tests, property tests, performance benchmarks
// AI-META-END

import { describe, it, expect, beforeEach, bench } from "vitest";
import { fc } from "fast-check";
import {
  PhotoClusteringService,
  photoClusteringService,
  createPhotoClusteringService,
  isCluster,
  getClusterSizeText,
  getClusterPhotos,
  type ClusterPoint,
  type ClusterOptions,
} from "./photo-clustering";
import { Photo } from "@/types";

// Mock photo data factory
function createMockPhoto(overrides: Partial<Photo> = {}): Photo {
  const id = `photo-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    uri: `file://photos/${id}.jpg`,
    width: 1920,
    height: 1080,
    createdAt: Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000, // Random time in past year
    modifiedAt: Date.now(),
    filename: `${id}.jpg`,
    isFavorite: false,
    albumIds: [],
    location: {
      latitude: -90 + Math.random() * 180, // Random latitude
      longitude: -180 + Math.random() * 360, // Random longitude
      city: ["New York", "London", "Tokyo", "Paris", "Sydney"][
        Math.floor(Math.random() * 5)
      ],
    },
    ...overrides,
  };
}

// Create test photos in specific regions
function createPhotosInRegion(
  count: number,
  centerLat: number,
  centerLng: number,
  spread = 0.1,
): Photo[] {
  return Array.from({ length: count }, () => ({
    ...createMockPhoto(),
    location: {
      latitude: centerLat + (Math.random() - 0.5) * spread,
      longitude: centerLng + (Math.random() - 0.5) * spread,
      city: "Test City",
    },
  }));
}

describe("PhotoClusteringService", () => {
  let service: PhotoClusteringService;

  beforeEach(() => {
    service = createPhotoClusteringService({
      radius: 50,
      maxZoom: 18,
      minZoom: 0,
    });
  });

  describe("Basic Functionality", () => {
    it("should initialize with default options", () => {
      const defaultService = new PhotoClusteringService();
      expect(defaultService).toBeDefined();
      const stats = defaultService.getStats();
      expect(stats.totalPoints).toBe(0);
      expect(stats.clusterCount).toBe(0);
    });

    it("should load photos and convert to points", () => {
      const photos = [createMockPhoto(), createMockPhoto()];
      service.loadPhotos(photos);

      const stats = service.getStats();
      expect(stats.totalPoints).toBe(2);
      expect(stats.clusterCount).toBeGreaterThan(0);
    });

    it("should filter out photos with invalid locations", () => {
      const photos = [
        createMockPhoto(),
        createMockPhoto({ location: undefined }),
        createMockPhoto({
          location: { latitude: "invalid" as any, longitude: 123 },
        }),
        createMockPhoto({ location: { latitude: 91, longitude: 123 } }), // Invalid latitude
        createMockPhoto({ location: { latitude: 45, longitude: 181 } }), // Invalid longitude
      ];

      service.loadPhotos(photos);
      const stats = service.getStats();
      expect(stats.totalPoints).toBe(1); // Only the first photo should be valid
    });

    it("should clear data properly", () => {
      const photos = [createMockPhoto(), createMockPhoto()];
      service.loadPhotos(photos);
      expect(service.getStats().totalPoints).toBe(2);

      service.clear();
      expect(service.getStats().totalPoints).toBe(0);
      expect(service.getStats().clusterCount).toBe(0);
    });
  });

  describe("Clustering Logic", () => {
    it("should cluster nearby photos at low zoom levels", () => {
      // Create photos very close to each other
      const photos = createPhotosInRegion(10, 40.7128, -74.006, 0.01); // NYC area
      service.loadPhotos(photos);

      // At low zoom level, should see clusters
      const clusters = service.getClusters(
        {
          northeast: { latitude: 41, longitude: -73 },
          southwest: { latitude: 40, longitude: -75 },
        },
        5, // Low zoom
      );

      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters.some(isCluster)).toBe(true);
    });

    it("should show individual photos at high zoom levels", () => {
      const photos = createPhotosInRegion(5, 40.7128, -74.006, 0.01);
      service.loadPhotos(photos);

      // At high zoom level, should see individual photos
      const clusters = service.getClusters(
        {
          northeast: { latitude: 40.72, longitude: -74.005 },
          southwest: { latitude: 40.7, longitude: -74.007 },
        },
        18, // High zoom
      );

      expect(clusters.length).toBe(5);
      expect(clusters.every((point) => !isCluster(point))).toBe(true);
    });

    it("should handle empty bounds gracefully", () => {
      service.loadPhotos([createMockPhoto()]);

      const clusters = service.getClusters(
        {
          northeast: { latitude: 0, longitude: 0 },
          southwest: { latitude: 0, longitude: 0 },
        },
        10,
      );

      expect(clusters).toEqual([]);
    });

    it("should get cluster leaves correctly", () => {
      const photos = createPhotosInRegion(5, 40.7128, -74.006, 0.01);
      service.loadPhotos(photos);

      const clusters = service.getClusters(
        {
          northeast: { latitude: 41, longitude: -73 },
          southwest: { latitude: 40, longitude: -75 },
        },
        5,
      );

      const cluster = clusters.find(isCluster);
      if (cluster) {
        const leaves = service.getClusterLeaves(cluster.properties.cluster_id!);
        expect(leaves.length).toBeGreaterThan(0);
        expect(leaves.length).toBeLessThanOrEqual(5);
      }
    });

    it("should calculate cluster expansion zoom", () => {
      const photos = createPhotosInRegion(5, 40.7128, -74.006, 0.01);
      service.loadPhotos(photos);

      const clusters = service.getClusters(
        {
          northeast: { latitude: 41, longitude: -73 },
          southwest: { latitude: 40, longitude: -75 },
        },
        5,
      );

      const cluster = clusters.find(isCluster);
      if (cluster) {
        const expansionZoom = service.getClusterExpansionZoom(
          cluster.properties.cluster_id!,
        );
        expect(expansionZoom).toBeGreaterThan(5);
        expect(expansionZoom).toBeLessThanOrEqual(20);
      }
    });
  });

  describe("Viewport-based Clustering", () => {
    it("should cluster by viewport dimensions", () => {
      const photos = createPhotosInRegion(10, 40.7128, -74.006, 0.1);
      service.loadPhotos(photos);

      const clusters = service.getClustersByViewport(
        { latitude: 40.7128, longitude: -74.006 },
        10,
        375, // iPhone width
        667, // iPhone height
      );

      expect(clusters.length).toBeGreaterThan(0);
    });

    it("should handle different viewport sizes", () => {
      const photos = createPhotosInRegion(10, 40.7128, -74.006, 0.1);
      service.loadPhotos(photos);

      const smallViewport = service.getClustersByViewport(
        { latitude: 40.7128, longitude: -74.006 },
        10,
        200,
        300,
      );

      const largeViewport = service.getClustersByViewport(
        { latitude: 40.7128, longitude: -74.006 },
        10,
        1000,
        1000,
      );

      // Larger viewport should show more clusters/points
      expect(largeViewport.length).toBeGreaterThanOrEqual(smallViewport.length);
    });
  });

  describe("Nearest Cluster Finding", () => {
    it("should find nearest cluster", () => {
      const photos = createPhotosInRegion(5, 40.7128, -74.006, 0.01);
      service.loadPhotos(photos);

      const nearest = service.findNearestCluster(
        { latitude: 40.7128, longitude: -74.006 },
        10,
      );

      expect(nearest).toBeDefined();
    });

    it("should return null when no clusters are nearby", () => {
      const photos = createPhotosInRegion(5, 40.7128, -74.006, 0.01);
      service.loadPhotos(photos);

      const nearest = service.findNearestCluster(
        { latitude: 0, longitude: 0 }, // Far away
        10,
        1, // Very small max distance
      );

      expect(nearest).toBeNull();
    });
  });

  describe("Options Management", () => {
    it("should update clustering options", () => {
      service.loadPhotos([createMockPhoto()]);
      const originalStats = service.getStats();

      service.updateOptions({ radius: 100 });

      // Stats should remain the same but clustering behavior changes
      const newStats = service.getStats();
      expect(newStats.totalPoints).toBe(originalStats.totalPoints);
    });

    it("should preserve data when updating options", () => {
      const photos = [createMockPhoto()];
      service.loadPhotos(photos);

      service.updateOptions({ maxZoom: 15 });

      const clusters = service.getClusters(
        {
          northeast: { latitude: 90, longitude: 180 },
          southwest: { latitude: -90, longitude: -180 },
        },
        10,
      );

      expect(clusters.length).toBeGreaterThan(0);
    });
  });

  describe("Utility Functions", () => {
    it("should identify clusters correctly", () => {
      const cluster: ClusterPoint = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: { cluster: true, photoId: "", photoUri: "", createdAt: 0 },
      };

      const point: ClusterPoint = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: {
          cluster: false,
          photoId: "test",
          photoUri: "",
          createdAt: 0,
        },
      };

      expect(isCluster(cluster)).toBe(true);
      expect(isCluster(point)).toBe(false);
    });

    it("should format cluster size text correctly", () => {
      const largeCluster: ClusterPoint = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: {
          cluster: true,
          photoId: "",
          photoUri: "",
          createdAt: 0,
          point_count: 1000,
          point_count_abbreviated: "1k",
        },
      };

      const smallCluster: ClusterPoint = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: {
          cluster: true,
          photoId: "",
          photoUri: "",
          createdAt: 0,
          point_count: 5,
        },
      };

      expect(getClusterSizeText(largeCluster)).toBe("1k");
      expect(getClusterSizeText(smallCluster)).toBe("5");
      expect(getClusterSizeText({} as ClusterPoint)).toBe("");
    });

    it("should get cluster photos correctly", () => {
      const photos = createPhotosInRegion(5, 40.7128, -74.006, 0.01);
      service.loadPhotos(photos);

      const clusters = service.getClusters(
        {
          northeast: { latitude: 41, longitude: -73 },
          southwest: { latitude: 40, longitude: -75 },
        },
        5,
      );

      const cluster = clusters.find(isCluster);
      if (cluster) {
        const clusterPhotos = getClusterPhotos(cluster, service);
        expect(clusterPhotos.length).toBeGreaterThan(0);
        expect(clusterPhotos.length).toBeLessThanOrEqual(10); // Default limit
      }
    });
  });

  describe("Data Export", () => {
    it("should export data correctly", () => {
      const photos = [createMockPhoto(), createMockPhoto()];
      service.loadPhotos(photos);

      const exported = service.exportData();

      expect(exported.points).toHaveLength(2);
      expect(exported.options.radius).toBe(50);
      expect(exported.stats.totalPoints).toBe(2);
    });
  });
});

describe("Property-based Tests", () => {
  it("should handle arbitrary photo collections", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            uri: fc.string(),
            width: fc.integer(1, 4000),
            height: fc.integer(1, 4000),
            createdAt: fc.integer(0, Date.now()),
            modifiedAt: fc.integer(0, Date.now()),
            filename: fc.string(),
            isFavorite: fc.boolean(),
            albumIds: fc.array(fc.string()),
            location: fc.record({
              latitude: fc.float(-90, 90),
              longitude: fc.float(-180, 180),
              city: fc.option(fc.string()),
            }),
          }),
          { minLength: 0, maxLength: 100 },
        ),
        (photos) => {
          const service = createPhotoClusteringService();

          // Should not crash with any photo collection
          expect(() => service.loadPhotos(photos)).not.toThrow();

          // Should handle empty collections
          if (photos.length === 0) {
            expect(service.getStats().totalPoints).toBe(0);
          }

          // Should handle valid coordinates
          const validPhotos = photos.filter(
            (p) =>
              p.location &&
              typeof p.location.latitude === "number" &&
              typeof p.location.longitude === "number" &&
              p.location.latitude >= -90 &&
              p.location.latitude <= 90 &&
              p.location.longitude >= -180 &&
              p.location.longitude <= 180,
          );

          if (validPhotos.length > 0) {
            expect(service.getStats().totalPoints).toBe(validPhotos.length);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should maintain clustering invariants", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            latitude: fc.float(-85, 85), // Avoid poles for mercator
            longitude: fc.float(-180, 180),
          }),
          { minLength: 10, maxLength: 50 },
        ),
        fc.integer(0, 20), // zoom level
        (coordinates, zoom) => {
          const photos = coordinates.map((coord, index) =>
            createMockPhoto({
              id: `photo-${index}`,
              location: coord,
            }),
          );

          const service = createPhotoClusteringService();
          service.loadPhotos(photos);

          const clusters = service.getClusters(
            {
              northeast: { latitude: 85, longitude: 180 },
              southwest: { latitude: -85, longitude: -180 },
            },
            zoom,
          );

          // Sum of cluster points should equal total photos
          const totalClusterPoints = clusters.reduce((sum, cluster) => {
            if (isCluster(cluster)) {
              return sum + (cluster.properties.point_count || 0);
            }
            return sum + 1;
          }, 0);

          expect(totalClusterPoints).toBe(photos.length);
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe("Performance Tests", () => {
  it("should handle large datasets efficiently", () => {
    const photos = createPhotosInRegion(1000, 40.7128, -74.006, 1);

    bench("load 1000 photos", () => {
      const service = createPhotoClusteringService();
      service.loadPhotos(photos);
    });

    const service = createPhotoClusteringService();
    service.loadPhotos(photos);

    bench("get clusters for large dataset", () => {
      service.getClusters(
        {
          northeast: { latitude: 41, longitude: -73 },
          southwest: { latitude: 40, longitude: -75 },
        },
        10,
      );
    });

    bench("get clusters by viewport", () => {
      service.getClustersByViewport(
        { latitude: 40.7128, longitude: -74.006 },
        10,
        375,
        667,
      );
    });
  });

  it("should handle rapid clustering operations", () => {
    const service = createPhotoClusteringService();
    const photos = createPhotosInRegion(100, 40.7128, -74.006, 0.5);
    service.loadPhotos(photos);

    bench("rapid clustering operations", () => {
      for (let i = 0; i < 10; i++) {
        service.getClusters(
          {
            northeast: { latitude: 41, longitude: -73 },
            southwest: { latitude: 40, longitude: -75 },
          },
          i,
        );
      }
    });
  });
});
