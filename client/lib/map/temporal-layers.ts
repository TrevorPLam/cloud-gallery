// AI-META-BEGIN
// AI-META: Temporal layers service for time-based photo filtering and animation
// OWNERSHIP: client/lib/map
// ENTRYPOINTS: Used by PhotoMapScreen for timeline scrubbing and temporal overlays
// DEPENDENCIES: react-native-reanimated, Photo type, clustering service
// DANGER: Performance issues with large datasets; implement efficient time-based indexing
// CHANGE-SAFETY: Safe to modify animation patterns and time bucketing strategies
// TESTS: Unit tests for time bucketing, performance benchmarks for animations
// AI-META-END

import React, { useMemo, useCallback } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
  useDerivedValue,
} from "react-native-reanimated";
import { Photo } from "@/types";

export interface TimeRange {
  start: number; // Unix timestamp in milliseconds
  end: number; // Unix timestamp in milliseconds
}

export interface TimeBucket {
  id: string;
  start: number;
  end: number;
  photos: Photo[];
  count: number;
}

export interface TemporalLayer {
  id: string;
  name: string;
  timeRange: TimeRange;
  photos: Photo[];
  visible: boolean;
  opacity: number;
  color: string;
}

export interface TimelineConfig {
  bucketSize?: "day" | "week" | "month" | "quarter" | "year";
  animationDuration?: number;
  springConfig?: {
    damping: number;
    stiffness: number;
    mass: number;
  };
  paddingDays?: number; // Padding around time range
}

export interface AnimationState {
  isPlaying: boolean;
  currentTime: number;
  progress: number; // 0-1
  speed: number; // 1x, 2x, 4x, etc.
}

/**
 * Utility functions for time bucketing and range calculations
 */
export class TimeUtils {
  /**
   * Get bucket size in milliseconds
   */
  static getBucketSize(
    bucketSize: NonNullable<TimelineConfig["bucketSize"]>,
  ): number {
    const dayMs = 24 * 60 * 60 * 1000;
    switch (bucketSize) {
      case "day":
        return dayMs;
      case "week":
        return 7 * dayMs;
      case "month":
        return 30 * dayMs;
      case "quarter":
        return 90 * dayMs;
      case "year":
        return 365 * dayMs;
      default:
        return dayMs;
    }
  }

  /**
   * Create time buckets for photos
   */
  static createTimeBuckets(
    photos: Photo[],
    bucketSize: NonNullable<TimelineConfig["bucketSize"]>,
    paddingDays = 0,
  ): TimeBucket[] {
    if (photos.length === 0) return [];

    const bucketMs = this.getBucketSize(bucketSize);
    const paddingMs = paddingDays * 24 * 60 * 60 * 1000;

    const timestamps = photos.map((p) => p.createdAt);
    const minTime = Math.min(...timestamps) - paddingMs;
    const maxTime = Math.max(...timestamps) + paddingMs;

    const buckets: TimeBucket[] = [];
    let currentStart = this.roundToBucket(minTime, bucketMs);

    while (currentStart < maxTime) {
      const currentEnd = currentStart + bucketMs;
      const bucketPhotos = photos.filter(
        (p) => p.createdAt >= currentStart && p.createdAt < currentEnd,
      );

      if (bucketPhotos.length > 0) {
        buckets.push({
          id: `bucket-${currentStart}`,
          start: currentStart,
          end: currentEnd,
          photos: bucketPhotos,
          count: bucketPhotos.length,
        });
      }

      currentStart = currentEnd;
    }

    return buckets;
  }

  /**
   * Round timestamp to bucket boundary
   */
  static roundToBucket(timestamp: number, bucketMs: number): number {
    return Math.floor(timestamp / bucketMs) * bucketMs;
  }

  /**
   * Get time range from photos
   */
  static getTimeRange(photos: Photo[]): TimeRange {
    if (photos.length === 0) {
      const now = Date.now();
      return { start: now, end: now };
    }

    const timestamps = photos.map((p) => p.createdAt);
    return {
      start: Math.min(...timestamps),
      end: Math.max(...timestamps),
    };
  }

  /**
   * Check if time ranges overlap
   */
  static rangesOverlap(range1: TimeRange, range2: TimeRange): boolean {
    return range1.start < range2.end && range2.start < range1.end;
  }

  /**
   * Merge overlapping time ranges
   */
  static mergeRanges(ranges: TimeRange[]): TimeRange[] {
    if (ranges.length === 0) return [];

    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const merged: TimeRange[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const last = merged[merged.length - 1];

      if (this.rangesOverlap(last, current)) {
        merged[merged.length - 1] = {
          start: Math.min(last.start, current.start),
          end: Math.max(last.end, current.end),
        };
      } else {
        merged.push(current);
      }
    }

    return merged;
  }

  /**
   * Format timestamp for display
   */
  static formatTimestamp(
    timestamp: number,
    format: "short" | "medium" | "long" = "medium",
  ): string {
    const date = new Date(timestamp);

    switch (format) {
      case "short":
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      case "medium":
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      case "long":
        return date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      default:
        return date.toLocaleDateString();
    }
  }

  /**
   * Get relative time string
   */
  static getRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const absDiff = Math.abs(diff);

    const seconds = Math.floor(absDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0)
      return `${years} year${years > 1 ? "s" : ""} ${diff > 0 ? "ago" : "from now"}`;
    if (months > 0)
      return `${months} month${months > 1 ? "s" : ""} ${diff > 0 ? "ago" : "from now"}`;
    if (weeks > 0)
      return `${weeks} week${weeks > 1 ? "s" : ""} ${diff > 0 ? "ago" : "from now"}`;
    if (days > 0)
      return `${days} day${days > 1 ? "s" : ""} ${diff > 0 ? "ago" : "from now"}`;
    if (hours > 0)
      return `${hours} hour${hours > 1 ? "s" : ""} ${diff > 0 ? "ago" : "from now"}`;
    if (minutes > 0)
      return `${minutes} minute${minutes > 1 ? "s" : ""} ${diff > 0 ? "ago" : "from now"}`;
    return "just now";
  }
}

/**
 * Service for managing temporal layers and timeline animations
 */
export class TemporalLayersService {
  private config: Required<TimelineConfig>;
  private layers: Map<string, TemporalLayer> = new Map();
  private buckets: TimeBucket[] = [];
  private animationState: AnimationState = {
    isPlaying: false,
    currentTime: Date.now(),
    progress: 0,
    speed: 1,
  };

  constructor(config: TimelineConfig = {}) {
    this.config = {
      bucketSize: "week",
      animationDuration: 300,
      springConfig: {
        damping: 20,
        stiffness: 300,
        mass: 1,
      },
      paddingDays: 7,
      ...config,
    };
  }

  /**
   * Initialize temporal layers from photos
   */
  initializeLayers(photos: Photo[]): void {
    this.buckets = TimeUtils.createTimeBuckets(
      photos,
      this.config.bucketSize,
      this.config.paddingDays,
    );

    // Create layers from buckets
    this.layers.clear();
    this.buckets.forEach((bucket, index) => {
      const layer: TemporalLayer = {
        id: bucket.id,
        name: this.generateLayerName(bucket),
        timeRange: { start: bucket.start, end: bucket.end },
        photos: bucket.photos,
        visible: true,
        opacity: 1,
        color: this.generateLayerColor(index),
      };
      this.layers.set(layer.id, layer);
    });

    // Reset animation state
    const timeRange = TimeUtils.getTimeRange(photos);
    this.animationState.currentTime = timeRange.start;
    this.animationState.progress = 0;
  }

  /**
   * Generate human-readable layer name
   */
  private generateLayerName(bucket: TimeBucket): string {
    return `${TimeUtils.formatTimestamp(bucket.start, "short")} - ${TimeUtils.formatTimestamp(bucket.end - 1, "short")}`;
  }

  /**
   * Generate color for layer
   */
  private generateLayerColor(index: number): string {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FFEAA7",
      "#DDA0DD",
      "#98D8C8",
      "#F7DC6F",
      "#BB8FCE",
      "#85C1E2",
    ];
    return colors[index % colors.length];
  }

  /**
   * Get all layers
   */
  getLayers(): TemporalLayer[] {
    return Array.from(this.layers.values());
  }

  /**
   * Get layer by ID
   */
  getLayer(id: string): TemporalLayer | undefined {
    return this.layers.get(id);
  }

  /**
   * Update layer visibility
   */
  setLayerVisibility(id: string, visible: boolean): void {
    const layer = this.layers.get(id);
    if (layer) {
      layer.visible = visible;
    }
  }

  /**
   * Update layer opacity
   */
  setLayerOpacity(id: string, opacity: number): void {
    const layer = this.layers.get(id);
    if (layer) {
      layer.opacity = Math.max(0, Math.min(1, opacity));
    }
  }

  /**
   * Get photos visible at specific time
   */
  getPhotosAtTime(timestamp: number): Photo[] {
    const visibleLayers = Array.from(this.layers.values()).filter(
      (layer) =>
        layer.visible &&
        timestamp >= layer.timeRange.start &&
        timestamp < layer.timeRange.end,
    );

    return visibleLayers.flatMap((layer) => layer.photos);
  }

  /**
   * Get photos in time range
   */
  getPhotosInRange(timeRange: TimeRange): Photo[] {
    const visibleLayers = Array.from(this.layers.values()).filter(
      (layer) =>
        layer.visible && TimeUtils.rangesOverlap(layer.timeRange, timeRange),
    );

    return visibleLayers.flatMap((layer) =>
      layer.photos.filter(
        (photo) =>
          photo.createdAt >= timeRange.start && photo.createdAt < timeRange.end,
      ),
    );
  }

  /**
   * Get animation state
   */
  getAnimationState(): AnimationState {
    return { ...this.animationState };
  }

  /**
   * Set animation time
   */
  setAnimationTime(timestamp: number): void {
    const timeRange = this.getOverallTimeRange();
    if (timeRange.start === 0 && timeRange.end === 0) return;

    const duration = timeRange.end - timeRange.start;
    const progress = Math.max(
      0,
      Math.min(1, (timestamp - timeRange.start) / duration),
    );

    this.animationState.currentTime = timestamp;
    this.animationState.progress = progress;
  }

  /**
   * Set animation progress (0-1)
   */
  setAnimationProgress(progress: number): void {
    const timeRange = this.getOverallTimeRange();
    if (timeRange.start === 0 && timeRange.end === 0) return;

    const clampedProgress = Math.max(0, Math.min(1, progress));
    const timestamp =
      timeRange.start + (timeRange.end - timeRange.start) * clampedProgress;

    this.animationState.progress = clampedProgress;
    this.animationState.currentTime = timestamp;
  }

  /**
   * Start/stop animation
   */
  setAnimationPlaying(isPlaying: boolean): void {
    this.animationState.isPlaying = isPlaying;
  }

  /**
   * Set animation speed
   */
  setAnimationSpeed(speed: number): void {
    this.animationState.speed = Math.max(0.25, Math.min(8, speed));
  }

  /**
   * Get overall time range
   */
  getOverallTimeRange(): TimeRange {
    if (this.buckets.length === 0) {
      return { start: 0, end: 0 };
    }

    const starts = this.buckets.map((b) => b.start);
    const ends = this.buckets.map((b) => b.end);

    return {
      start: Math.min(...starts),
      end: Math.max(...ends),
    };
  }

  /**
   * Get time buckets
   */
  getTimeBuckets(): TimeBucket[] {
    return this.buckets;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TimelineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.layers.clear();
    this.buckets = [];
    this.animationState = {
      isPlaying: false,
      currentTime: Date.now(),
      progress: 0,
      speed: 1,
    };
  }

  /**
   * Export data for debugging
   */
  exportData(): {
    layers: TemporalLayer[];
    buckets: TimeBucket[];
    animationState: AnimationState;
    config: Required<TimelineConfig>;
  } {
    return {
      layers: this.getLayers(),
      buckets: this.buckets,
      animationState: this.getAnimationState(),
      config: this.config,
    };
  }
}

/**
 * Default temporal layers service instance
 */
export const temporalLayersService = new TemporalLayersService();

/**
 * Hook for using temporal layers with animations
 */
export function useTemporalLayers(photos: Photo[], config?: TimelineConfig) {
  const service = useMemo(() => new TemporalLayersService(config), [config]);

  // Initialize service when photos change
  React.useEffect(() => {
    service.initializeLayers(photos);
  }, [photos, service]);

  // Animation values
  const progressValue = useSharedValue(0);
  const isPlayingValue = useSharedValue(false);
  const speedValue = useSharedValue(1);

  // Update service when animation values change
  const updateServiceProgress = useCallback(
    (progress: number) => {
      service.setAnimationProgress(progress);
    },
    [service],
  );

  const updateServicePlaying = useCallback(
    (isPlaying: boolean) => {
      service.setAnimationPlaying(isPlaying);
    },
    [service],
  );

  // Derived values
  const currentTime = useDerivedValue(() => {
    const timeRange = service.getOverallTimeRange();
    return (
      timeRange.start + (timeRange.end - timeRange.start) * progressValue.value
    );
  });

  const visiblePhotos = useDerivedValue(() => {
    return service.getPhotosAtTime(currentTime.value);
  });

  // Animated styles
  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: interpolate(progressValue.value, [0, 1], [-100, 100]) },
      ],
    };
  });

  // Control functions
  const play = useCallback(() => {
    isPlayingValue.value = true;
    updateServicePlaying(true);
  }, [isPlayingValue, updateServicePlaying]);

  const pause = useCallback(() => {
    isPlayingValue.value = false;
    updateServicePlaying(false);
  }, [isPlayingValue, updateServicePlaying]);

  const seekTo = useCallback(
    (progress: number) => {
      progressValue.value = withTiming(progress, {
        duration: service.config.animationDuration,
      });
      runOnJS(updateServiceProgress)(progress);
    },
    [progressValue, service.config.animationDuration, updateServiceProgress],
  );

  const seekToTime = useCallback(
    (timestamp: number) => {
      const timeRange = service.getOverallTimeRange();
      const progress =
        (timestamp - timeRange.start) / (timeRange.end - timeRange.start);
      seekTo(Math.max(0, Math.min(1, progress)));
    },
    [service, seekTo],
  );

  const setSpeed = useCallback(
    (speed: number) => {
      const clampedSpeed = Math.max(0.25, Math.min(8, speed));
      speedValue.value = clampedSpeed;
      service.setAnimationSpeed(clampedSpeed);
    },
    [speedValue, service],
  );

  return {
    service,
    progressValue,
    isPlayingValue,
    speedValue,
    currentTime,
    visiblePhotos,
    animatedProgressStyle,
    play,
    pause,
    seekTo,
    seekToTime,
    setSpeed,
  };
}

/**
 * Utility function to create temporal layers service with custom config
 */
export function createTemporalLayersService(
  config: TimelineConfig,
): TemporalLayersService {
  return new TemporalLayersService(config);
}

/**
 * Utility function to create timeline markers
 */
export function createTimelineMarkers(buckets: TimeBucket[]): {
  time: number;
  label: string;
  count: number;
}[] {
  return buckets.map((bucket) => ({
    time: bucket.start,
    label: TimeUtils.formatTimestamp(bucket.start, "short"),
    count: bucket.count,
  }));
}

/**
 * Utility function to get temporal statistics
 */
export function getTemporalStatistics(layers: TemporalLayer[]): {
  totalLayers: number;
  totalPhotos: number;
  averagePhotosPerLayer: number;
  timeSpan: number; // in days
} {
  const totalLayers = layers.length;
  const totalPhotos = layers.reduce(
    (sum, layer) => sum + layer.photos.length,
    0,
  );
  const averagePhotosPerLayer = totalLayers > 0 ? totalPhotos / totalLayers : 0;

  const timeRanges = layers.map((layer) => layer.timeRange);
  const merged = TimeUtils.mergeRanges(timeRanges);
  const timeSpan =
    merged.length > 0
      ? (merged[0].end - merged[0].start) / (24 * 60 * 60 * 1000)
      : 0;

  return {
    totalLayers,
    totalPhotos,
    averagePhotosPerLayer,
    timeSpan,
  };
}
