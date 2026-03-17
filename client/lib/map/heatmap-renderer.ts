// AI-META-BEGIN
// AI-META: Heatmap visualization service for photo density mapping
// OWNERSHIP: client/lib/map
// ENTRYPOINTS: Used by PhotoMapScreen for density visualization
// DEPENDENCIES: Web Mercator projection, canvas rendering
// DANGER: Performance issues with large datasets; implement proper data sampling
// CHANGE-SAFETY: Safe to modify gradient schemes and intensity calculations
// TESTS: Unit tests for projection accuracy, performance benchmarks
// AI-META-END

import React from "react";
import { ViewStyle, View } from "react-native";
import { Photo } from "@/types";

export interface HeatmapPoint {
  longitude: number;
  latitude: number;
  intensity: number;
}

export interface HeatmapRegion {
  longitude: number;
  latitude: number;
  longitudeDelta: number;
  latitudeDelta: number;
}

export interface HeatmapOptions {
  radius?: number;
  opacity?: number;
  gradient?: {
    colors: string[];
    startPoints: number[];
  };
  maxIntensity?: number;
  heatmapMode?: "density" | "time" | "frequency";
}

export interface HeatmapStats {
  totalPoints: number;
  averageIntensity: number;
  maxIntensity: number;
  density: number; // points per square kilometer
}

/**
 * Web Mercator projection utilities for accurate coordinate mapping
 */
class WebMercatorProjection {
  private static readonly RADIUS = 6378137; // Earth's radius in meters
  private static readonly DEGREES_TO_RADIANS = Math.PI / 180;
  private static readonly RADIANS_TO_DEGREES = 180 / Math.PI;

  /**
   * Convert latitude/longitude to Web Mercator x/y coordinates
   */
  static project(lat: number, lng: number): { x: number; y: number } {
    const x = this.RADIUS * lng * this.DEGREES_TO_RADIANS;
    const y =
      this.RADIUS *
      Math.log(Math.tan(Math.PI * 0.25 + 0.5 * lat * this.DEGREES_TO_RADIANS));
    return { x, y };
  }

  /**
   * Convert Web Mercator x/y coordinates to latitude/longitude
   */
  static unproject(x: number, y: number): { lat: number; lng: number } {
    const lng = (x * this.RADIANS_TO_DEGREES) / this.RADIUS;
    const lat =
      (2 * Math.atan(Math.exp(y / this.RADIUS)) - Math.PI * 0.5) *
      this.RADIANS_TO_DEGREES;
    return { lat, lng };
  }

  /**
   * Calculate distance between two points in meters
   */
  static distance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const p1 = this.project(lat1, lng1);
    const p2 = this.project(lat2, lng2);
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }
}

/**
 * Service for rendering heatmap visualizations of photo density
 */
export class HeatmapRenderer {
  private options: Required<HeatmapOptions>;
  private cachedPoints: HeatmapPoint[] = [];
  private cachedStats: HeatmapStats | null = null;

  constructor(options: HeatmapOptions = {}) {
    this.options = {
      radius: 40,
      opacity: 0.7,
      gradient: {
        colors: [
          "#3288bd",
          "#66c2a5",
          "#abdda4",
          "#e6f598",
          "#fee08b",
          "#fdae61",
          "#f46d43",
          "#d53e4f",
        ],
        startPoints: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 1],
      },
      maxIntensity: 100,
      heatmapMode: "density",
      ...options,
    };
  }

  /**
   * Convert photos to heatmap points
   */
  private photosToHeatmapPoints(photos: Photo[]): HeatmapPoint[] {
    return photos
      .filter((photo) => this.isValidLocation(photo.location))
      .map((photo) => ({
        longitude: photo.location!.longitude,
        latitude: photo.location!.latitude,
        intensity: this.calculateIntensity(photo),
      }));
  }

  /**
   * Validate location data
   */
  private isValidLocation(
    location: any,
  ): location is NonNullable<Photo["location"]> {
    return (
      location &&
      typeof location.latitude === "number" &&
      typeof location.longitude === "number" &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      location.longitude >= -180 &&
      location.longitude <= 180
    );
  }

  /**
   * Calculate intensity for a photo based on heatmap mode
   */
  private calculateIntensity(photo: Photo): number {
    switch (this.options.heatmapMode) {
      case "density":
        return 1; // All photos contribute equally to density

      case "time":
        // Newer photos have higher intensity
        const ageInDays =
          (Date.now() - photo.createdAt) / (1000 * 60 * 60 * 24);
        return Math.max(0, 100 - ageInDays / 3.65); // Decay over ~27 years

      case "frequency":
        // Photos with more metadata have higher intensity
        let intensity = 10; // Base intensity
        if (photo.isFavorite) intensity += 20;
        if (photo.tags && photo.tags.length > 0)
          intensity += photo.tags.length * 2;
        if (photo.mlLabels && photo.mlLabels.length > 0)
          intensity += photo.mlLabels.length;
        if (photo.notes) intensity += 5;
        return Math.min(intensity, 100);

      default:
        return 1;
    }
  }

  /**
   * Process photos and generate heatmap data
   */
  processPhotos(photos: Photo[]): HeatmapPoint[] {
    this.cachedPoints = this.photosToHeatmapPoints(photos);
    this.cachedStats = this.calculateStats(this.cachedPoints);
    return this.cachedPoints;
  }

  /**
   * Get heatmap points for a specific region
   */
  getPointsInRegion(
    points: HeatmapPoint[],
    region: HeatmapRegion,
  ): HeatmapPoint[] {
    return points.filter(
      (point) =>
        point.latitude >= region.latitude - region.latitudeDelta &&
        point.latitude <= region.latitude + region.latitudeDelta &&
        point.longitude >= region.longitude - region.longitudeDelta &&
        point.longitude <= region.longitude + region.longitudeDelta,
    );
  }

  /**
   * Calculate statistics for heatmap points
   */
  private calculateStats(points: HeatmapPoint[]): HeatmapStats {
    if (points.length === 0) {
      return {
        totalPoints: 0,
        averageIntensity: 0,
        maxIntensity: 0,
        density: 0,
      };
    }

    const totalIntensity = points.reduce(
      (sum, point) => sum + point.intensity,
      0,
    );
    const averageIntensity = totalIntensity / points.length;
    const maxIntensity = Math.max(...points.map((p) => p.intensity));

    // Calculate density (points per square kilometer)
    let density = 0;
    if (points.length > 1) {
      const bounds = this.calculateBounds(points);
      const area = this.calculateArea(bounds);
      density = points.length / area;
    }

    return {
      totalPoints: points.length,
      averageIntensity,
      maxIntensity,
      density,
    };
  }

  /**
   * Calculate bounding box for points
   */
  private calculateBounds(points: HeatmapPoint[]): {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } {
    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);

    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }

  /**
   * Calculate area in square kilometers
   */
  private calculateArea(
    bounds: ReturnType<typeof this.calculateBounds>,
  ): number {
    const width = WebMercatorProjection.distance(
      bounds.minLat,
      bounds.minLng,
      bounds.minLat,
      bounds.maxLng,
    );
    const height = WebMercatorProjection.distance(
      bounds.minLat,
      bounds.minLng,
      bounds.maxLat,
      bounds.minLng,
    );
    return (width * height) / 1000000; // Convert to square kilometers
  }

  /**
   * Sample points for performance optimization
   */
  samplePoints(points: HeatmapPoint[], maxPoints = 1000): HeatmapPoint[] {
    if (points.length <= maxPoints) return points;

    // Use stratified sampling to maintain geographic distribution
    const bounds = this.calculateBounds(points);
    const gridSize = Math.ceil(Math.sqrt(maxPoints));
    const latStep = (bounds.maxLat - bounds.minLat) / gridSize;
    const lngStep = (bounds.maxLng - bounds.minLng) / gridSize;

    const sampled: HeatmapPoint[] = [];
    const grid: HeatmapPoint[][] = Array.from({ length: gridSize }, () => []);

    // Assign points to grid cells
    points.forEach((point) => {
      const latIndex = Math.min(
        Math.floor((point.latitude - bounds.minLat) / latStep),
        gridSize - 1,
      );
      const lngIndex = Math.min(
        Math.floor((point.longitude - bounds.minLng) / lngStep),
        gridSize - 1,
      );
      const gridIndex = latIndex * gridSize + lngIndex;

      if (!grid[gridIndex]) grid[gridIndex] = [];
      grid[gridIndex].push(point);
    });

    // Sample from each grid cell
    grid.forEach((cell) => {
      if (cell.length > 0) {
        // Take the point with highest intensity from each cell
        const selected = cell.reduce((max, point) =>
          point.intensity > max.intensity ? point : max,
        );
        sampled.push(selected);
      }
    });

    // If we still have too many points, take the highest intensity ones
    if (sampled.length > maxPoints) {
      return sampled
        .sort((a, b) => b.intensity - a.intensity)
        .slice(0, maxPoints);
    }

    return sampled;
  }

  /**
   * Generate heatmap data for rendering
   */
  generateHeatmapData(photos: Photo[], region?: HeatmapRegion): number[][] {
    let points = this.processPhotos(photos);

    if (region) {
      points = this.getPointsInRegion(points, region);
    }

    // Sample for performance
    points = this.samplePoints(points);

    // Convert to format expected by react-native-heat-map
    return points.map((point) => [
      point.longitude,
      point.latitude,
      Math.min(point.intensity, this.options.maxIntensity),
    ]);
  }

  /**
   * Render heatmap component (placeholder for future canvas implementation)
   */
  renderHeatmap(
    photos: Photo[],
    region: HeatmapRegion,
    style?: ViewStyle,
  ): React.ReactElement {
    // Placeholder implementation - would use canvas rendering in production
    return React.createElement(View, {
      style: style || { flex: 1 },
    });
  }

  /**
   * Get heatmap statistics
   */
  getStats(): HeatmapStats | null {
    return this.cachedStats;
  }

  /**
   * Update heatmap options
   */
  updateOptions(options: Partial<HeatmapOptions>): void {
    this.options = { ...this.options, ...options };
    // Clear cache to force recalculation
    this.cachedPoints = [];
    this.cachedStats = null;
  }

  /**
   * Clear cached data
   */
  clear(): void {
    this.cachedPoints = [];
    this.cachedStats = null;
  }

  /**
   * Export heatmap data for debugging
   */
  exportData(): {
    points: HeatmapPoint[];
    stats: HeatmapStats | null;
    options: Required<HeatmapOptions>;
  } {
    return {
      points: this.cachedPoints,
      stats: this.cachedStats,
      options: this.options,
    };
  }
}

/**
 * Default heatmap renderer instance
 */
export const heatmapRenderer = new HeatmapRenderer();

/**
 * Utility function to create heatmap renderer with custom options
 */
export function createHeatmapRenderer(
  options: HeatmapOptions,
): HeatmapRenderer {
  return new HeatmapRenderer(options);
}

/**
 * Utility function to calculate optimal heatmap radius based on zoom level
 */
export function calculateOptimalRadius(
  zoomLevel: number,
  baseRadius = 40,
): number {
  // Adjust radius based on zoom level
  const zoomFactor = Math.max(0.5, Math.min(2, zoomLevel / 10));
  return Math.round(baseRadius * zoomFactor);
}

/**
 * Utility function to create time-based gradient
 */
export function createTimeBasedGradient(): {
  colors: string[];
  startPoints: number[];
} {
  return {
    colors: [
      "#ff0000",
      "#ff4500",
      "#ffa500",
      "#ffff00",
      "#00ff00",
      "#00ffff",
      "#0000ff",
      "#800080",
    ],
    startPoints: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 1],
  };
}

/**
 * Utility function to create density-based gradient
 */
export function createDensityBasedGradient(): {
  colors: string[];
  startPoints: number[];
} {
  return {
    colors: [
      "#3288bd",
      "#66c2a5",
      "#abdda4",
      "#e6f598",
      "#fee08b",
      "#fdae61",
      "#f46d43",
      "#d53e4f",
    ],
    startPoints: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 1],
  };
}
