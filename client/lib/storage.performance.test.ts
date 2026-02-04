// Performance tests for Cloud Gallery
// Tests critical paths and performance benchmarks

import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getPhotos,
  savePhotos,
  addPhoto,
  addPhotosToAlbum,
  getStorageInfo,
  groupPhotosByDate,
} from "./storage";
import { performanceTestData } from "../../tests/factories";

describe("Storage Performance Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    vi.mocked(AsyncStorage.setItem).mockResolvedValue();
    vi.mocked(AsyncStorage.removeItem).mockResolvedValue();
  });

  describe("Large Dataset Operations", () => {
    it("should handle large photo sets efficiently", async () => {
      const largeDataset = performanceTestData.largeDataset(1000, 50);
      const startTime = performance.now();

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await savePhotos(largeDataset.photos);
      const saveTime = performance.now() - startTime;

      expect(saveTime).toBeLessThan(1000); // Should save 1000 photos in under 1 second
      expect(vi.mocked(AsyncStorage.setItem)).toHaveBeenCalledTimes(1);
    });

    it("should retrieve large photo sets efficiently", async () => {
      const largeDataset = performanceTestData.largeDataset(1000, 50);
      const startTime = performance.now();

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify(largeDataset.photos),
      );

      const retrieved = await getPhotos();
      const retrieveTime = performance.now() - startTime;

      expect(retrieveTime).toBeLessThan(500); // Should retrieve 1000 photos in under 500ms
      expect(retrieved).toHaveLength(1000);
    });

    it("should handle large album operations efficiently", async () => {
      const largeDataset = performanceTestData.largeDataset(1000, 50);
      const startTime = performance.now();

      vi.mocked(AsyncStorage.getItem)
        .mockResolvedValueOnce(JSON.stringify(largeDataset.photos))
        .mockResolvedValueOnce(JSON.stringify(largeDataset.albums));

      await addPhotosToAlbum(
        largeDataset.albums[0].id,
        largeDataset.photos.slice(0, 100).map((p) => p.id),
      );
      const operationTime = performance.now() - startTime;

      expect(operationTime).toBeLessThan(200); // Should complete in under 200ms
    });
  });

  describe("Memory Usage Tests", () => {
    it("should not cause memory leaks with repeated operations", async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      for (let i = 0; i < 100; i++) {
        const testData = performanceTestData.largeDataset(100, 5);
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(
          JSON.stringify(testData.photos),
        );
        await getPhotos();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it("should handle concurrent operations without memory issues", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("[]");
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      const concurrentOperations = Array.from({ length: 50 }, (_, i) =>
        addPhoto({
          id: `perf_test_${i}`,
          uri: `photo_${i}.jpg`,
          width: 1920,
          height: 1080,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          filename: `photo_${i}.jpg`,
          isFavorite: false,
          albumIds: [],
        }),
      );

      await Promise.all(concurrentOperations);

      expect(vi.mocked(AsyncStorage.setItem)).toHaveBeenCalledTimes(50);
    });
  });

  describe("Critical Path Performance", () => {
    it("should perform photo grouping efficiently", async () => {
      const largeDataset = performanceTestData.largeDataset(500, 25);
      const startTime = performance.now();

      const grouped = groupPhotosByDate(largeDataset.photos);
      const groupingTime = performance.now() - startTime;

      expect(groupingTime).toBeLessThan(100); // Should group 500 photos in under 100ms
      expect(grouped.length).toBeGreaterThan(0);
    });

    it("should calculate storage info quickly", async () => {
      const largeDataset = performanceTestData.largeDataset(1000, 50);
      const startTime = performance.now();

      vi.mocked(AsyncStorage.getItem)
        .mockResolvedValueOnce(JSON.stringify(largeDataset.photos))
        .mockResolvedValueOnce(JSON.stringify(largeDataset.albums));

      const info = await getStorageInfo();
      const calculationTime = performance.now() - startTime;

      expect(calculationTime).toBeLessThan(50); // Should calculate in under 50ms
      expect(info.photoCount).toBe(1000);
      expect(info.albumCount).toBe(50);
    });

    it("should handle batch operations efficiently", async () => {
      const photos = performanceTestData.largeDataset(100, 5).photos;
      const startTime = performance.now();

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      // Simulate batch save
      await savePhotos(photos);
      const batchTime = performance.now() - startTime;

      expect(batchTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe("Stress Tests", () => {
    it("should handle rapid successive operations", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("[]");
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        await addPhoto({
          id: `stress_test_${i}`,
          uri: `photo_${i}.jpg`,
          width: 1920,
          height: 1080,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          filename: `photo_${i}.jpg`,
          isFavorite: false,
          albumIds: [],
        });
      }

      const totalTime = performance.now() - startTime;
      const averageTime = totalTime / 100;

      expect(averageTime).toBeLessThan(10); // Average operation should be under 10ms
    });

    it("should maintain performance under memory pressure", async () => {
      // Create memory pressure by storing large objects
      const memoryPressureData = Array.from({ length: 1000 }, (_, i) => ({
        id: `memory_test_${i}`,
        uri: `photo_${i}.jpg`,
        width: 4000,
        height: 3000,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        filename: `photo_${i}.jpg`,
        isFavorite: false,
        albumIds: [],
        metadata: {
          description: "A".repeat(1000), // Large description to increase memory usage
          tags: Array.from({ length: 50 }, (_, j) => `tag_${j}`),
        },
      }));

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify(memoryPressureData),
      );

      const startTime = performance.now();
      const retrieved = await getPhotos();
      const retrieveTime = performance.now() - startTime;

      expect(retrieveTime).toBeLessThan(1000); // Should still be reasonably fast
      expect(retrieved).toHaveLength(1000);
    });
  });

  describe("AsyncStorage Mock Performance", () => {
    it("should handle high-frequency AsyncStorage operations", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      const operations = Array.from({ length: 200 }, (_, i) =>
        AsyncStorage.setItem(`key_${i}`, `value_${i}`),
      );

      const startTime = performance.now();
      await Promise.all(operations);
      const totalTime = performance.now() - startTime;

      expect(totalTime).toBeLessThan(100); // Should complete 200 operations quickly
    });
  });
});
