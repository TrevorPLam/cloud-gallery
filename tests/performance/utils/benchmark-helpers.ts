/**
 * Benchmark utilities for performance testing in Cloud Gallery
 * Provides consistent measurement patterns and helper functions
 */

import { bench, describe } from "vitest";

/**
 * Performance measurement wrapper for consistent benchmarking
 */
export interface BenchmarkOptions {
  /** Number of iterations to run (default: auto-determined by Vitest) */
  iterations?: number;
  /** Warmup iterations before measurement */
  warmup?: number;
  /** Setup function to run before each iteration */
  setup?: () => void | Promise<void>;
  /** Teardown function to run after each iteration */
  teardown?: () => void | Promise<void>;
}

/**
 * Create a performance benchmark with proper setup/teardown
 */
export function createBenchmark(
  name: string,
  fn: () => void | Promise<void>,
  options: BenchmarkOptions = {},
) {
  return bench(name, async () => {
    if (options.setup) await options.setup();
    await fn();
    if (options.teardown) await options.teardown();
  });
}

/**
 * Memory usage measurement utilities
 */
export interface MemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  memoryDelta: number;
}

/**
 * Get current memory usage (if available)
 */
export function getMemoryUsage(): MemoryMetrics | null {
  if (typeof performance === "undefined" || !(performance as any).memory) {
    return null;
  }

  const memory = (performance as any).memory;
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
    memoryDelta: 0,
  };
}

/**
 * Measure memory usage change during operation
 */
export async function measureMemoryUsage<T>(
  operation: () => T | Promise<T>,
): Promise<{
  result: T;
  memoryBefore: MemoryMetrics | null;
  memoryAfter: MemoryMetrics | null;
  memoryDelta: number;
}> {
  const memoryBefore = getMemoryUsage();
  const result = await operation();
  const memoryAfter = getMemoryUsage();

  const memoryDelta =
    memoryBefore && memoryAfter
      ? memoryAfter.usedJSHeapSize - memoryBefore.usedJSHeapSize
      : 0;

  return {
    result,
    memoryBefore,
    memoryAfter,
    memoryDelta,
  };
}

/**
 * Time measurement utilities
 */
export interface TimeMetrics {
  startTime: number;
  endTime: number;
  duration: number;
}

/**
 * Measure execution time of an operation
 */
export async function measureTime<T>(
  operation: () => T | Promise<T>,
): Promise<{ result: T; metrics: TimeMetrics }> {
  const startTime = performance.now();
  const result = await operation();
  const endTime = performance.now();

  return {
    result,
    metrics: {
      startTime,
      endTime,
      duration: endTime - startTime,
    },
  };
}

/**
 * Batch operation performance testing
 */
export interface BatchPerformanceOptions {
  batchSize: number;
  iterations: number;
  concurrent?: boolean;
}

/**
 * Measure performance of batch operations
 */
export async function measureBatchPerformance<T, R>(
  items: T[],
  operation: (item: T) => R | Promise<R>,
  options: BatchPerformanceOptions,
): Promise<{
  results: R[];
  totalTime: number;
  avgTime: number;
  throughput: number;
}> {
  const { batchSize, iterations, concurrent = false } = options;

  const startTime = performance.now();
  let results: R[] = [];

  if (concurrent) {
    // Run batches concurrently
    const batches = [];
    for (let i = 0; i < iterations; i++) {
      const batch = items.slice(0, batchSize);
      const batchPromises = batch.map((item) => operation(item));
      batches.push(Promise.all(batchPromises));
    }
    const batchResults = await Promise.all(batches);
    results = batchResults.flat();
  } else {
    // Run batches sequentially
    for (let i = 0; i < iterations; i++) {
      const batch = items.slice(0, batchSize);
      for (const item of batch) {
        const result = await operation(item);
        results.push(result);
      }
    }
  }

  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const totalOperations = batchSize * iterations;

  return {
    results,
    totalTime,
    avgTime: totalTime / totalOperations,
    throughput: totalOperations / (totalTime / 1000), // operations per second
  };
}

/**
 * Performance assertion helpers
 */
export class PerformanceAssertions {
  /**
   * Assert that operation completes within time threshold
   */
  static async assertTimeThreshold<T>(
    operation: () => T | Promise<T>,
    thresholdMs: number,
    message?: string,
  ): Promise<T> {
    const { result, metrics } = await measureTime(operation);

    if (metrics.duration > thresholdMs) {
      throw new Error(
        message ||
          `Performance threshold exceeded: ${metrics.duration.toFixed(2)}ms > ${thresholdMs}ms`,
      );
    }

    return result;
  }

  /**
   * Assert that memory usage stays within threshold
   */
  static async assertMemoryThreshold(
    fn: () => any,
    maxMemoryBytes: number,
    message?: string,
  ): Promise<{ result: any; memoryDelta: number }> {
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const result = await fn();

    // Force garbage collection if available
    if (typeof global !== "undefined" && (global as any).gc) {
      (global as any).gc();
    }

    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryDelta = Math.max(0, finalMemory - initialMemory);

    if (memoryDelta > maxMemoryBytes) {
      throw new Error(
        `${message || "Memory usage exceeded threshold"}: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB > ${(maxMemoryBytes / 1024 / 1024).toFixed(2)}MB`,
      );
    }

    return { result, memoryDelta };
  }

  /**
   * Assert throughput meets minimum requirement
   */
  static async assertMinThroughput<T, R>(
    items: T[],
    operation: (item: T) => R | Promise<R>,
    minThroughput: number, // operations per second
    options: Omit<BatchPerformanceOptions, "iterations">,
  ): Promise<void> {
    const { throughput } = await measureBatchPerformance(items, operation, {
      ...options,
      iterations: 1,
    });

    if (throughput < minThroughput) {
      throw new Error(
        `Throughput threshold exceeded: ${throughput.toFixed(2)} ops/sec < ${minThroughput} ops/sec`,
      );
    }
  }
}

/**
 * Performance test data generators
 */
export class PerformanceTestData {
  /**
   * Generate large dataset for testing
   */
  static generateLargePhotoDataset(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `photo_${i}`,
      uri: `file://photo_${i}.jpg`,
      width: 1920 + (i % 1000),
      height: 1080 + (i % 1000),
      size: 1024 * 1024 * (2 + (i % 5)), // 2-6MB
      createdAt: Date.now() - i * 1000,
      metadata: {
        description: `Test photo ${i}`,
        tags: [`tag_${i % 10}`, `category_${i % 5}`],
        location: {
          latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
          longitude: -74.006 + (Math.random() - 0.5) * 0.1,
        },
      },
    }));
  }

  /**
   * Generate search queries for testing
   */
  static generateSearchQueries(count: number) {
    const terms = [
      "vacation",
      "family",
      "nature",
      "city",
      "portrait",
      "landscape",
      "sunset",
      "beach",
      "mountain",
      "food",
    ];
    return Array.from({ length: count }, (_, i) => ({
      query: terms[i % terms.length] + (i > terms.length ? ` ${i}` : ""),
      filters: {
        dateRange: {
          start: Date.now() - 30 * 24 * 60 * 60 * 1000,
          end: Date.now(),
        },
        tags: [terms[i % terms.length]],
      },
    }));
  }
}
