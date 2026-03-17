// AI-META-BEGIN
// AI-META: Geospatial clustering service for photo locations using SuperCluster
// OWNERSHIP: client/lib/map
// ENTRYPOINTS: Used by PhotoMapScreen for clustering photo markers
// DEPENDENCIES: supercluster, @mapbox/geo-viewport, Photo type
// DANGER: Large datasets may impact performance; implement proper zoom-based clustering
// CHANGE-SAFETY: Safe to modify clustering algorithms; ensure backward compatibility
// TESTS: Property-based testing for clustering accuracy, performance benchmarks
// AI-META-END

// Conditional imports for testing
import { Photo } from "@/types";

let Supercluster: any;
let geoViewport: any;

if (process.env.NODE_ENV === "test") {
  Supercluster = require("./__mocks__/supercluster.ts").default;
  geoViewport = require("./__mocks__/geo-viewport.ts").default;
} else {
  Supercluster = require("supercluster").default;
  geoViewport = require("@mapbox/geo-viewport").default;
}

export interface ClusterPoint {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    photoId: string;
    photoUri: string;
    city?: string;
    createdAt: number;
    cluster?: boolean;
    cluster_id?: number;
    point_count?: number;
    point_count_abbreviated?: string;
  };
}

export interface ClusterOptions {
  radius?: number;
  maxZoom?: number;
  minZoom?: number;
  extent?: number;
  nodeSize?: number;
}

export interface BoundingBox {
  northeast: { latitude: number; longitude: number };
  southwest: { latitude: number; longitude: number };
}

export interface ViewportBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * Service for clustering photo locations on a map
 * Uses SuperCluster algorithm for efficient geospatial clustering
 */
export class PhotoClusteringService {
  private cluster: Supercluster.Cluster<ClusterPoint>;
  private points: ClusterPoint[] = [];
  private options: Required<ClusterOptions>;

  constructor(options: ClusterOptions = {}) {
    this.options = {
      radius: 60, // Cluster radius in pixels
      maxZoom: 20, // Maximum zoom level for clustering
      minZoom: 0, // Minimum zoom level for clustering
      extent: 512, // Tile extent
      nodeSize: 64, // Node size for KD-tree
      ...options,
    };

    this.cluster = new Supercluster(this.options);
  }

  /**
   * Convert photos to GeoJSON points for clustering
   */
  private photosToPoints(photos: Photo[]): ClusterPoint[] {
    return photos
      .filter((photo) => this.isValidLocation(photo.location))
      .map((photo) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [photo.location!.longitude, photo.location!.latitude],
        },
        properties: {
          photoId: photo.id,
          photoUri: photo.uri,
          city: photo.location?.city,
          createdAt: photo.createdAt,
        },
      }));
  }

  /**
   * Validate that location data is complete and valid
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
   * Load photos and initialize clustering
   */
  loadPhotos(photos: Photo[]): void {
    this.points = this.photosToPoints(photos);
    this.cluster.load(this.points);
  }

  /**
   * Get clusters for a specific map viewport
   */
  getClusters(bounds: BoundingBox, zoom: number): ClusterPoint[] {
    const viewportBounds: ViewportBounds = {
      west: bounds.southwest.longitude,
      south: bounds.southwest.latitude,
      east: bounds.northeast.longitude,
      north: bounds.northeast.latitude,
    };

    return this.cluster.getClusters(viewportBounds, zoom);
  }

  /**
   * Get clusters using viewport calculation for optimal performance
   */
  getClustersByViewport(
    center: { latitude: number; longitude: number },
    zoom: number,
    width: number,
    height: number,
  ): ClusterPoint[] {
    const bounds = geoViewport.bounds(
      [center.longitude, center.latitude],
      zoom,
      [width, height],
    );

    const viewportBounds: ViewportBounds = {
      west: bounds[0],
      south: bounds[1],
      east: bounds[2],
      north: bounds[3],
    };

    return this.cluster.getClusters(viewportBounds, zoom);
  }

  /**
   * Get individual photos within a cluster
   */
  getClusterLeaves(clusterId: number, limit = 10, offset = 0): ClusterPoint[] {
    return this.cluster.getLeaves(clusterId, limit, offset);
  }

  /**
   * Get cluster expansion zoom level
   */
  getClusterExpansionZoom(clusterId: number): number {
    return this.cluster.getClusterExpansionZoom(clusterId);
  }

  /**
   * Find the nearest cluster to a point
   */
  findNearestCluster(
    point: { latitude: number; longitude: number },
    zoom: number,
    maxDistance = 100, // in kilometers
  ): ClusterPoint | null {
    const nearbyClusters = this.getClusters(
      {
        northeast: {
          latitude: point.latitude + 0.5,
          longitude: point.longitude + 0.5,
        },
        southwest: {
          latitude: point.latitude - 0.5,
          longitude: point.longitude - 0.5,
        },
      },
      zoom,
    );

    let nearestCluster: ClusterPoint | null = null;
    let minDistance = maxDistance;

    for (const cluster of nearbyClusters) {
      const distance = this.calculateDistance(point, {
        latitude: cluster.geometry.coordinates[1],
        longitude: cluster.geometry.coordinates[0],
      });

      if (distance < minDistance) {
        minDistance = distance;
        nearestCluster = cluster;
      }
    }

    return nearestCluster;
  }

  /**
   * Calculate distance between two points in kilometers
   */
  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number },
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.latitude)) *
        Math.cos(this.toRadians(point2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get clustering statistics
   */
  getStats(): {
    totalPoints: number;
    clusterCount: number;
    averagePointsPerCluster: number;
  } {
    const totalPoints = this.points.length;
    const clusterCount =
      this.points.length > 0
        ? this.cluster.getClusters([-180, -85, 180, 85], 0).length
        : 0;
    const averagePointsPerCluster =
      clusterCount > 0 ? totalPoints / clusterCount : 0;

    return {
      totalPoints,
      clusterCount,
      averagePointsPerCluster,
    };
  }

  /**
   * Clear all loaded data
   */
  clear(): void {
    this.points = [];
    this.cluster = new Supercluster(this.options);
  }

  /**
   * Update clustering options
   */
  updateOptions(options: Partial<ClusterOptions>): void {
    this.options = { ...this.options, ...options };
    this.cluster = new Supercluster(this.options);
    if (this.points.length > 0) {
      this.cluster.load(this.points);
    }
  }

  /**
   * Export cluster data for debugging
   */
  exportData(): {
    points: ClusterPoint[];
    options: Required<ClusterOptions>;
    stats: ReturnType<typeof this.getStats>;
  } {
    return {
      points: this.points,
      options: this.options,
      stats: this.getStats(),
    };
  }
}

/**
 * Default clustering service instance
 */
export const photoClusteringService = new PhotoClusteringService();

/**
 * Utility function to create clustering service with custom options
 */
export function createPhotoClusteringService(
  options: ClusterOptions,
): PhotoClusteringService {
  return new PhotoClusteringService(options);
}

/**
 * Utility function to check if a point is a cluster
 */
export function isCluster(point: ClusterPoint): boolean {
  return Boolean(point.properties.cluster);
}

/**
 * Utility function to get cluster size display text
 */
export function getClusterSizeText(point: ClusterPoint): string {
  if (!isCluster(point)) return "";
  return (
    point.properties.point_count_abbreviated ||
    String(point.properties.point_count || 0)
  );
}

/**
 * Utility function to get cluster photos
 */
export function getClusterPhotos(
  cluster: ClusterPoint,
  clusteringService: PhotoClusteringService,
  limit = 10,
): ClusterPoint[] {
  if (!isCluster(cluster) || !cluster.properties.cluster_id) return [];
  return clusteringService.getClusterLeaves(
    cluster.properties.cluster_id,
    limit,
  );
}
