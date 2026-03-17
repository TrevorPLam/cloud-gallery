/**
 * Photo processing performance benchmarks
 * Tests image metadata extraction, thumbnail generation, and batch processing
 */

import { bench, describe } from "vitest";
import {
  PerformanceAssertions,
  measureBatchPerformance,
  measureTime,
} from "../utils/benchmark-helpers";
import { serverThresholds } from "../utils/thresholds";
import { generateTestPhotos } from "../utils/data-generators";

// Mock photo processing service
class MockPhotoProcessingService {
  // Simulate EXIF metadata extraction
  extractMetadata(photo: any) {
    const startTime = performance.now();

    // Simulate reading file and parsing EXIF data
    const metadata = {
      width: photo.width,
      height: photo.height,
      size: photo.size,
      format: "JPEG",
      colorSpace: "sRGB",
      hasAlpha: false,
      exif: {
        Make: "Canon",
        Model: "EOS R5",
        DateTime: new Date(photo.createdAt).toISOString(),
        ISO: 100 + Math.floor(Math.random() * 3200),
        Aperture: `f/${1.4 + Math.random() * 4}`,
        ShutterSpeed: `1/${100 + Math.floor(Math.random() * 1000)}`,
        FocalLength: `${24 + Math.floor(Math.random() * 200)}mm`,
        GPSLatitude: photo.metadata?.location?.latitude || 0,
        GPSLongitude: photo.metadata?.location?.longitude || 0,
      },
    };

    return {
      ...metadata,
      processingTime: performance.now() - startTime,
    };
  }

  // Simulate thumbnail generation
  generateThumbnail(photo: any, size: number = 200) {
    const startTime = performance.now();

    // Simulate image processing operations
    const aspectRatio = photo.width / photo.height;
    let thumbWidth, thumbHeight;

    if (aspectRatio > 1) {
      thumbWidth = size;
      thumbHeight = Math.round(size / aspectRatio);
    } else {
      thumbHeight = size;
      thumbWidth = Math.round(size * aspectRatio);
    }

    // Simulate JPEG compression
    const quality = 0.8;
    const originalPixels = photo.width * photo.height;
    const thumbPixels = thumbWidth * thumbHeight;
    const estimatedSize = Math.round(
      (originalPixels * quality * (thumbPixels / originalPixels)) / 1000,
    );

    return {
      uri: `thumb_${photo.id}_${size}x${size}.jpg`,
      width: thumbWidth,
      height: thumbHeight,
      size: estimatedSize,
      quality,
      processingTime: performance.now() - startTime,
    };
  }

  // Simulate batch photo processing
  processBatch(
    photos: any[],
    options: { extractMetadata?: boolean; generateThumbnails?: boolean } = {},
  ) {
    const startTime = performance.now();
    const results = [];

    for (const photo of photos) {
      const result = { id: photo.id };

      if (options.extractMetadata) {
        (result as any).metadata = this.extractMetadata(photo);
      }

      if (options.generateThumbnails) {
        (result as any).thumbnails = {
          small: this.generateThumbnail(photo, 100),
          medium: this.generateThumbnail(photo, 200),
          large: this.generateThumbnail(photo, 400),
        };
      }

      results.push(result);
    }

    return {
      results,
      processingTime: performance.now() - startTime,
      avgTimePerPhoto: (performance.now() - startTime) / photos.length,
    };
  }

  // Simulate image optimization
  optimizeImage(
    photo: any,
    options: { quality?: number; maxWidth?: number; maxHeight?: number } = {},
  ) {
    const startTime = performance.now();
    const { quality = 0.85, maxWidth = 2048, maxHeight = 2048 } = options;

    // Calculate new dimensions
    let newWidth = photo.width;
    let newHeight = photo.height;

    if (newWidth > maxWidth || newHeight > maxHeight) {
      const aspectRatio = newWidth / newHeight;

      if (newWidth > maxWidth) {
        newWidth = maxWidth;
        newHeight = Math.round(maxWidth / aspectRatio);
      }

      if (newHeight > maxHeight) {
        newHeight = maxHeight;
        newWidth = Math.round(maxHeight * aspectRatio);
      }
    }

    // Estimate file size reduction
    const originalPixels = photo.width * photo.height;
    const newPixels = newWidth * newHeight;
    const sizeReduction = Math.min(0.7, newPixels / originalPixels);
    const estimatedNewSize = Math.round(photo.size * sizeReduction * quality);

    return {
      uri: `optimized_${photo.id}.jpg`,
      width: newWidth,
      height: newHeight,
      size: estimatedNewSize,
      quality,
      originalSize: photo.size,
      sizeSavings: photo.size - estimatedNewSize,
      compressionRatio: estimatedNewSize / photo.size,
      processingTime: performance.now() - startTime,
    };
  }
}

describe("Photo Processing Performance Tests", () => {
  const processingService = new MockPhotoProcessingService();

  describe("Metadata Extraction Performance", () => {
    bench("extract metadata from small photo (1MB)", async () => {
      const photos = generateTestPhotos(1, {
        minSize: 1024 * 1024,
        maxSize: 2 * 1024 * 1024,
      });
      await PerformanceAssertions.assertTimeThreshold(
        () => processingService.extractMetadata(photos[0]),
        serverThresholds.photoProcessing.extractMetadata.maxTime,
        "Small photo metadata extraction should complete within threshold",
      );
    });

    bench("extract metadata from large photo (10MB)", async () => {
      const photos = generateTestPhotos(1, {
        minSize: 8 * 1024 * 1024,
        maxSize: 12 * 1024 * 1024,
      });
      await PerformanceAssertions.assertTimeThreshold(
        () => processingService.extractMetadata(photos[0]),
        serverThresholds.photoProcessing.extractMetadata.maxTime * 2,
        "Large photo metadata extraction should complete within threshold",
      );
    });

    bench("batch metadata extraction 10 photos", async () => {
      const photos = generateTestPhotos(10);
      const { avgTimePerPhoto } = processingService.processBatch(photos, {
        extractMetadata: true,
      });

      if (
        avgTimePerPhoto >
        serverThresholds.photoProcessing.extractMetadata.maxTime
      ) {
        throw new Error(
          `Batch metadata extraction too slow: ${avgTimePerPhoto.toFixed(2)}ms avg`,
        );
      }
    });

    bench("batch metadata extraction 100 photos", async () => {
      const photos = generateTestPhotos(100);
      await PerformanceAssertions.assertTimeThreshold(
        () => processingService.processBatch(photos, { extractMetadata: true }),
        serverThresholds.photoProcessing.processBatch.maxTime,
        "Batch metadata extraction for 100 photos should complete within threshold",
      );
    });
  });

  describe("Thumbnail Generation Performance", () => {
    bench("generate small thumbnail (100px)", async () => {
      const photos = generateTestPhotos(1);
      await PerformanceAssertions.assertTimeThreshold(
        () => processingService.generateThumbnail(photos[0], 100),
        serverThresholds.photoProcessing.generateThumbnail.maxTime * 0.5,
        "Small thumbnail generation should complete within threshold",
      );
    });

    bench("generate medium thumbnail (200px)", async () => {
      const photos = generateTestPhotos(1);
      await PerformanceAssertions.assertTimeThreshold(
        () => processingService.generateThumbnail(photos[0], 200),
        serverThresholds.photoProcessing.generateThumbnail.maxTime,
        "Medium thumbnail generation should complete within threshold",
      );
    });

    bench("generate large thumbnail (400px)", async () => {
      const photos = generateTestPhotos(1);
      await PerformanceAssertions.assertTimeThreshold(
        () => processingService.generateThumbnail(photos[0], 400),
        serverThresholds.photoProcessing.generateThumbnail.maxTime * 1.5,
        "Large thumbnail generation should complete within threshold",
      );
    });

    bench("batch thumbnail generation 10 photos", async () => {
      const photos = generateTestPhotos(10);
      const { avgTimePerPhoto } = processingService.processBatch(photos, {
        generateThumbnails: true,
      });

      // Should be faster per photo when batched
      const expectedMaxTime =
        serverThresholds.photoProcessing.generateThumbnail.maxTime * 3; // 3 thumbnails per photo
      if (avgTimePerPhoto > expectedMaxTime) {
        throw new Error(
          `Batch thumbnail generation too slow: ${avgTimePerPhoto.toFixed(2)}ms avg`,
        );
      }
    });
  });

  describe("Image Optimization Performance", () => {
    bench("optimize high-resolution photo", async () => {
      const photos = generateTestPhotos(1, {
        minDimensions: [4000, 3000],
        maxDimensions: [6000, 4000],
      });
      await PerformanceAssertions.assertTimeThreshold(
        () =>
          processingService.optimizeImage(photos[0], {
            maxWidth: 2048,
            maxHeight: 2048,
          }),
        serverThresholds.photoProcessing.generateThumbnail.maxTime * 2,
        "High-resolution photo optimization should complete within threshold",
      );
    });

    bench("batch optimization 10 photos", async () => {
      const photos = generateTestPhotos(10);
      const startTime = performance.now();

      photos.forEach((photo) => {
        processingService.optimizeImage(photo, {
          maxWidth: 2048,
          maxHeight: 2048,
        });
      });

      const totalTime = performance.now() - startTime;
      const avgTime = totalTime / photos.length;

      if (
        avgTime >
        serverThresholds.photoProcessing.generateThumbnail.maxTime * 2
      ) {
        throw new Error(
          `Batch optimization too slow: ${avgTime.toFixed(2)}ms avg`,
        );
      }
    });
  });

  describe("Complete Photo Processing Pipeline", () => {
    bench("process single photo (metadata + thumbnails)", async () => {
      const photos = generateTestPhotos(1);
      await PerformanceAssertions.assertTimeThreshold(
        () =>
          processingService.processBatch(photos, {
            extractMetadata: true,
            generateThumbnails: true,
          }),
        serverThresholds.photoProcessing.processBatch.maxTime / 10,
        "Single photo processing should complete within threshold",
      );
    });

    bench("process 10 photos (metadata + thumbnails)", async () => {
      const photos = generateTestPhotos(10);
      const result = processingService.processBatch(photos, {
        extractMetadata: true,
        generateThumbnails: true,
      });

      if (
        result.processingTime >
        serverThresholds.photoProcessing.processBatch.maxTime
      ) {
        throw new Error(
          `10 photo processing too slow: ${result.processingTime.toFixed(2)}ms`,
        );
      }

      if (
        result.avgTimePerPhoto >
        serverThresholds.photoProcessing.processBatch.maxTime / 10
      ) {
        throw new Error(
          `10 photo processing avg time too high: ${result.avgTimePerPhoto.toFixed(2)}ms`,
        );
      }
    });

    bench("process 100 photos (metadata + thumbnails)", async () => {
      const photos = generateTestPhotos(100);
      await PerformanceAssertions.assertTimeThreshold(
        () =>
          processingService.processBatch(photos, {
            extractMetadata: true,
            generateThumbnails: true,
          }),
        serverThresholds.photoProcessing.processBatch.maxTime * 10,
        "100 photo processing should complete within threshold",
      );
    });
  });

  describe("Memory Usage Tests", () => {
    bench("memory usage during batch processing", async () => {
      const photos = generateTestPhotos(100, {
        minSize: 5 * 1024 * 1024,
        maxSize: 10 * 1024 * 1024,
      });

      const { memoryDelta } = await PerformanceAssertions.assertMemoryThreshold(
        () =>
          processingService.processBatch(photos, {
            extractMetadata: true,
            generateThumbnails: true,
          }),
        100 * 1024 * 1024, // 100MB max for 100 photos
        "Batch processing should not exceed memory threshold",
      );

      console.log(
        `Batch processing memory usage: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`,
      );
    });

    bench("memory cleanup after processing", async () => {
      const photos = generateTestPhotos(50);

      // Process photos
      await processingService.processBatch(photos, {
        extractMetadata: true,
        generateThumbnails: true,
      });

      // Force garbage collection if available
      if (typeof global !== "undefined" && global.gc) {
        global.gc();
      }

      // Memory should be reasonable after cleanup
      const memoryAfter = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryLimit = 50 * 1024 * 1024; // 50MB

      if (memoryAfter > memoryLimit) {
        console.warn(
          `Memory after cleanup: ${(memoryAfter / 1024 / 1024).toFixed(2)}MB (may indicate memory leak)`,
        );
      }
    });
  });

  describe("Throughput Tests", () => {
    bench("photo processing throughput", async () => {
      const photos = generateTestPhotos(50);

      const { throughput } = await measureBatchPerformance(
        photos,
        (photo) =>
          processingService.processBatch([photo], {
            extractMetadata: true,
            generateThumbnails: true,
          }),
        { batchSize: 50, iterations: 1 },
      );

      const minThroughput =
        serverThresholds.photoProcessing.processBatch.minThroughput || 10;
      if (throughput < minThroughput) {
        throw new Error(
          `Photo processing throughput too low: ${throughput.toFixed(2)} ops/sec < ${minThroughput} ops/sec`,
        );
      }

      console.log(
        `Photo processing throughput: ${throughput.toFixed(2)} photos/sec`,
      );
    });
  });
});
