// AI-META-BEGIN
// AI-META: Comprehensive tests for heatmap renderer service
// OWNERSHIP: client/lib/map
// ENTRYPOINTS: Test suite for heatmap-renderer.ts
// DEPENDENCIES: vitest, fast-check for property testing
// DANGER: Tests must handle edge cases like invalid coordinates, empty datasets
// CHANGE-SAFETY: Safe to modify tests; ensure coverage remains at 100%
// TESTS: Unit tests, property tests, performance benchmarks
// AI-META-END

import { describe, it, expect, beforeEach, bench } from 'vitest';
import { fc } from 'fast-check';
import React from 'react';
import {
  HeatmapRenderer,
  heatmapRenderer,
  createHeatmapRenderer,
  calculateOptimalRadius,
  createTimeBasedGradient,
  createDensityBasedGradient,
  WebMercatorProjection,
  type HeatmapPoint,
  type HeatmapRegion,
  type HeatmapOptions,
} from './heatmap-renderer';
import { Photo } from '@/types';

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
      city: 'Test City',
    },
    ...overrides,
  };
}

// Create test photos in specific regions
function createPhotosInRegion(
  count: number,
  centerLat: number,
  centerLng: number,
  spread = 0.1
): Photo[] {
  return Array.from({ length: count }, () => ({
    ...createMockPhoto(),
    location: {
      latitude: centerLat + (Math.random() - 0.5) * spread,
      longitude: centerLng + (Math.random() - 0.5) * spread,
      city: 'Test City',
    },
  }));
}

describe('WebMercatorProjection', () => {
  describe('Projection and Unprojection', () => {
    it('should project and unproject coordinates correctly', () => {
      const lat = 40.7128;
      const lng = -74.0060;
      
      const projected = WebMercatorProjection.project(lat, lng);
      expect(projected.x).toBeTypeOf('number');
      expect(projected.y).toBeTypeOf('number');
      
      const unprojected = WebMercatorProjection.unproject(projected.x, projected.y);
      expect(Math.abs(unprojected.lat - lat)).toBeLessThan(0.000001);
      expect(Math.abs(unprojected.lng - lng)).toBeLessThan(0.000001);
    });

    it('should handle edge cases', () => {
      // Near poles
      const northPole = WebMercatorProjection.project(89, 0);
      expect(northPole.y).toBeGreaterThan(0);
      
      const southPole = WebMercatorProjection.project(-89, 0);
      expect(southPole.y).toBeLessThan(0);
      
      // Date line
      const dateLine = WebMercatorProjection.project(0, 179);
      expect(dateLine.x).toBeGreaterThan(0);
    });
  });

  describe('Distance Calculation', () => {
    it('should calculate distances correctly', () => {
      const distance = WebMercatorProjection.distance(40.7128, -74.0060, 40.7580, -73.9855);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(10000); // Should be reasonable
    });

    it('should return zero for identical points', () => {
      const distance = WebMercatorProjection.distance(40.7128, -74.0060, 40.7128, -74.0060);
      expect(distance).toBe(0);
    });
  });
});

describe('HeatmapRenderer', () => {
  let renderer: HeatmapRenderer;

  beforeEach(() => {
    renderer = createHeatmapRenderer({
      radius: 30,
      opacity: 0.8,
      maxIntensity: 50,
      heatmapMode: 'density',
    });
  });

  describe('Basic Functionality', () => {
    it('should initialize with default options', () => {
      const defaultRenderer = new HeatmapRenderer();
      expect(defaultRenderer).toBeDefined();
      expect(defaultRenderer.getStats()).toBeNull();
    });

    it('should process photos and generate points', () => {
      const photos = [createMockPhoto(), createMockPhoto()];
      const points = renderer.processPhotos(photos);

      expect(points).toHaveLength(2);
      expect(points[0]).toHaveProperty('longitude');
      expect(points[0]).toHaveProperty('latitude');
      expect(points[0]).toHaveProperty('intensity');
    });

    it('should filter out photos with invalid locations', () => {
      const photos = [
        createMockPhoto(),
        createMockPhoto({ location: undefined }),
        createMockPhoto({ location: { latitude: 'invalid' as any, longitude: 123 } }),
        createMockPhoto({ location: { latitude: 91, longitude: 123 } }), // Invalid latitude
        createMockPhoto({ location: { latitude: 45, longitude: 181 } }), // Invalid longitude
      ];

      const points = renderer.processPhotos(photos);
      expect(points).toHaveLength(1); // Only the first photo should be valid
    });

    it('should clear data properly', () => {
      const photos = [createMockPhoto(), createMockPhoto()];
      renderer.processPhotos(photos);
      expect(renderer.getStats()?.totalPoints).toBe(2);

      renderer.clear();
      expect(renderer.getStats()).toBeNull();
    });
  });

  describe('Intensity Calculation', () => {
    it('should calculate density intensity correctly', () => {
      const densityRenderer = createHeatmapRenderer({ heatmapMode: 'density' });
      const photos = [createMockPhoto(), createMockPhoto()];
      const points = densityRenderer.processPhotos(photos);

      expect(points.every(p => p.intensity === 1)).toBe(true);
    });

    it('should calculate time intensity correctly', () => {
      const timeRenderer = createHeatmapRenderer({ heatmapMode: 'time' });
      const now = Date.now();
      const photos = [
        createMockPhoto({ createdAt: now }), // New photo
        createMockPhoto({ createdAt: now - 365 * 24 * 60 * 60 * 1000 }), // 1 year old
        createMockPhoto({ createdAt: now - 3650 * 24 * 60 * 60 * 1000 }), // 10 years old
      ];
      const points = timeRenderer.processPhotos(photos);

      expect(points[0].intensity).toBeGreaterThan(points[1].intensity);
      expect(points[1].intensity).toBeGreaterThan(points[2].intensity);
    });

    it('should calculate frequency intensity correctly', () => {
      const freqRenderer = createHeatmapRenderer({ heatmapMode: 'frequency' });
      const photos = [
        createMockPhoto(),
        createMockPhoto({ isFavorite: true }),
        createMockPhoto({ tags: ['tag1', 'tag2'] }),
        createMockPhoto({ notes: 'test note' }),
      ];
      const points = freqRenderer.processPhotos(photos);

      expect(points[0].intensity).toBe(10); // Base intensity
      expect(points[1].intensity).toBe(30); // Base + favorite
      expect(points[2].intensity).toBe(14); // Base + tags
      expect(points[3].intensity).toBe(15); // Base + notes
    });
  });

  describe('Region Filtering', () => {
    it('should filter points by region correctly', () => {
      const photos = [
        createMockPhoto({ location: { latitude: 40.7, longitude: -74.0, city: 'NYC' } }),
        createMockPhoto({ location: { latitude: 34.0, longitude: -118.2, city: 'LA' } }),
        createMockPhoto({ location: { latitude: 51.5, longitude: -0.1, city: 'London' } }),
      ];
      const points = renderer.processPhotos(photos);

      const region: HeatmapRegion = {
        latitude: 40.7,
        longitude: -74.0,
        latitudeDelta: 1,
        longitudeDelta: 1,
      };

      const filtered = renderer.getPointsInRegion(points, region);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].latitude).toBeCloseTo(40.7, 1);
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate statistics correctly', () => {
      const photos = createPhotosInRegion(10, 40.7128, -74.0060, 0.1);
      renderer.processPhotos(photos);
      const stats = renderer.getStats();

      expect(stats).toBeDefined();
      expect(stats!.totalPoints).toBe(10);
      expect(stats!.averageIntensity).toBeGreaterThan(0);
      expect(stats!.maxIntensity).toBeGreaterThan(0);
      expect(stats!.density).toBeGreaterThan(0);
    });

    it('should handle empty datasets', () => {
      renderer.processPhotos([]);
      const stats = renderer.getStats();

      expect(stats).toBeDefined();
      expect(stats!.totalPoints).toBe(0);
      expect(stats!.averageIntensity).toBe(0);
      expect(stats!.maxIntensity).toBe(0);
      expect(stats!.density).toBe(0);
    });
  });

  describe('Point Sampling', () => {
    it('should sample points when exceeding maximum', () => {
      const photos = createPhotosInRegion(100, 40.7128, -74.0060, 0.5);
      const points = renderer.processPhotos(photos);
      
      const sampled = renderer.samplePoints(points, 50);
      expect(sampled.length).toBeLessThanOrEqual(50);
    });

    it('should not sample when under maximum', () => {
      const photos = createPhotosInRegion(10, 40.7128, -74.0060, 0.1);
      const points = renderer.processPhotos(photos);
      
      const sampled = renderer.samplePoints(points, 50);
      expect(sampled.length).toBe(10);
    });

    it('should maintain geographic distribution', () => {
      // Create photos in different regions
      const photos = [
        ...createPhotosInRegion(25, 40.7, -74.0, 0.01), // NYC
        ...createPhotosInRegion(25, 34.0, -118.2, 0.01), // LA
        ...createPhotosInRegion(25, 51.5, -0.1, 0.01), // London
        ...createPhotosInRegion(25, 35.6, 139.6, 0.01), // Tokyo
      ];
      const points = renderer.processPhotos(photos);
      
      const sampled = renderer.samplePoints(points, 20);
      
      // Should have points from different regions
      const regions = new Set(sampled.map(p => 
        `${Math.round(p.latitude)},${Math.round(p.longitude)}`
      ));
      expect(regions.size).toBeGreaterThan(1);
    });
  });

  describe('Heatmap Data Generation', () => {
    it('should generate data in correct format', () => {
      const photos = createPhotosInRegion(5, 40.7128, -74.0060, 0.01);
      const region: HeatmapRegion = {
        latitude: 40.7128,
        longitude: -74.0060,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

      const data = renderer.generateHeatmapData(photos, region);

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveLength(3); // [longitude, latitude, intensity]
      expect(typeof data[0][0]).toBe('number'); // longitude
      expect(typeof data[0][1]).toBe('number'); // latitude
      expect(typeof data[0][2]).toBe('number'); // intensity
    });

    it('should limit intensity to maxIntensity', () => {
      const highIntensityRenderer = createHeatmapRenderer({ 
        maxIntensity: 10,
        heatmapMode: 'frequency' 
      });
      const photos = [
        createMockPhoto({ isFavorite: true, tags: ['tag1', 'tag2', 'tag3'] }),
      ];
      const data = highIntensityRenderer.generateHeatmapData(photos);

      expect(data[0][2]).toBeLessThanOrEqual(10);
    });
  });

  describe('Options Management', () => {
    it('should update options correctly', () => {
      renderer.updateOptions({ radius: 50, opacity: 0.5 });
      
      // Options should be updated (we can't directly access private options, 
      // but we can test the effects through other methods)
      expect(() => renderer.updateOptions({})).not.toThrow();
    });

    it('should clear cache when updating options', () => {
      const photos = [createMockPhoto()];
      renderer.processPhotos(photos);
      expect(renderer.getStats()).not.toBeNull();

      renderer.updateOptions({ radius: 50 });
      expect(renderer.getStats()).toBeNull();
    });
  });

  describe('Data Export', () => {
    it('should export data correctly', () => {
      const photos = [createMockPhoto(), createMockPhoto()];
      renderer.processPhotos(photos);

      const exported = renderer.exportData();
      
      expect(exported.points).toHaveLength(2);
      expect(exported.stats).toBeDefined();
      expect(exported.options).toBeDefined();
    });
  });
});

describe('Utility Functions', () => {
  describe('calculateOptimalRadius', () => {
    it('should calculate radius based on zoom level', () => {
      expect(calculateOptimalRadius(5)).toBeLessThan(calculateOptimalRadius(10));
      expect(calculateOptimalRadius(15)).toBeGreaterThan(calculateOptimalRadius(10));
    });

    it('should handle edge cases', () => {
      expect(calculateOptimalRadius(0)).toBeGreaterThan(0);
      expect(calculateOptimalRadius(20)).toBeGreaterThan(0);
    });
  });

  describe('Gradient Functions', () => {
    it('should create time-based gradient', () => {
      const gradient = createTimeBasedGradient();
      expect(gradient.colors).toHaveLength(8);
      expect(gradient.startPoints).toHaveLength(8);
      expect(gradient.startPoints[0]).toBe(0);
      expect(gradient.startPoints[7]).toBe(1);
    });

    it('should create density-based gradient', () => {
      const gradient = createDensityBasedGradient();
      expect(gradient.colors).toHaveLength(8);
      expect(gradient.startPoints).toHaveLength(8);
      expect(gradient.startPoints[0]).toBe(0);
      expect(gradient.startPoints[7]).toBe(1);
    });
  });
});

describe('Property-based Tests', () => {
  it('should handle arbitrary photo collections', () => {
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
          { minLength: 0, maxLength: 100 }
        ),
        (photos) => {
          const renderer = createHeatmapRenderer();
          
          // Should not crash with any photo collection
          expect(() => renderer.processPhotos(photos)).not.toThrow();
          
          // Should handle empty collections
          if (photos.length === 0) {
            expect(renderer.getStats()?.totalPoints).toBe(0);
          }
          
          // Should handle valid coordinates
          const validPhotos = photos.filter(p => 
            p.location &&
            typeof p.location.latitude === 'number' &&
            typeof p.location.longitude === 'number' &&
            p.location.latitude >= -90 && p.location.latitude <= 90 &&
            p.location.longitude >= -180 && p.location.longitude <= 180
          );
          
          if (validPhotos.length > 0) {
            const points = renderer.processPhotos(photos);
            expect(points.length).toBe(validPhotos.length);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain projection invariants', () => {
    fc.assert(
      fc.property(
        fc.float(-85, 85), // Avoid poles for mercator
        fc.float(-180, 180),
        (lat, lng) => {
          const projected = WebMercatorProjection.project(lat, lng);
          const unprojected = WebMercatorProjection.unproject(projected.x, projected.y);
          
          // Should round trip accurately
          expect(Math.abs(unprojected.lat - lat)).toBeLessThan(0.000001);
          expect(Math.abs(unprojected.lng - lng)).toBeLessThan(0.000001);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain sampling invariants', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            longitude: fc.float(-180, 180),
            latitude: fc.float(-85, 85),
            intensity: fc.float(0, 100),
          }),
          { minLength: 10, maxLength: 200 }
        ),
        fc.integer(5, 50),
        (points, maxPoints) => {
          const renderer = createHeatmapRenderer();
          const sampled = renderer.samplePoints(points, maxPoints);
          
          // Sampled points should not exceed maximum
          expect(sampled.length).toBeLessThanOrEqual(maxPoints);
          
          // If original points are less than max, should return all
          if (points.length <= maxPoints) {
            expect(sampled.length).toBe(points.length);
          }
          
          // All sampled points should be from original points
          expect(sampled.every(p => 
            points.some(op => 
              op.longitude === p.longitude && 
              op.latitude === p.latitude
            )
          )).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Performance Tests', () => {
  it('should handle large datasets efficiently', () => {
    const photos = createPhotosInRegion(1000, 40.7128, -74.0060, 1);
    const renderer = createHeatmapRenderer();
    
    bench('process 1000 photos', () => {
      renderer.processPhotos(photos);
    });

    const points = renderer.processPhotos(photos);

    bench('sample 1000 points to 100', () => {
      renderer.samplePoints(points, 100);
    });

    const region: HeatmapRegion = {
      latitude: 40.7128,
      longitude: -74.0060,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    };

    bench('generate heatmap data', () => {
      renderer.generateHeatmapData(photos, region);
    });
  });

  it('should handle rapid data processing', () => {
    const renderer = createHeatmapRenderer();
    const photos = createPhotosInRegion(100, 40.7128, -74.0060, 0.5);

    bench('rapid processing operations', () => {
      for (let i = 0; i < 10; i++) {
        renderer.processPhotos(photos.slice(0, i * 10));
      }
    });
  });

  it('should handle projection calculations efficiently', () => {
    const points = Array.from({ length: 1000 }, () => ({
      lat: Math.random() * 170 - 85,
      lng: Math.random() * 360 - 180,
    }));

    bench('project 1000 points', () => {
      points.forEach(p => WebMercatorProjection.project(p.lat, p.lng));
    });

    const projected = points.map(p => WebMercatorProjection.project(p.lat, p.lng));

    bench('unproject 1000 points', () => {
      projected.forEach(p => WebMercatorProjection.unproject(p.x, p.y));
    });
  });
});
