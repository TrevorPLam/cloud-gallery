// AI-META-BEGIN
// AI-META: Comprehensive test suite for embedding cache with encryption and performance validation
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: run by test runner during CI/CD
// DEPENDENCIES: vitest, embedding-cache.ts, clip-embeddings.ts (mocked), AsyncStorage (mocked)
// DANGER: Cache eviction tests require precise timing; encryption tests need proper mocking
// CHANGE-SAFETY: Add new cache strategies by extending test fixtures
// TESTS: All cache functionality including encryption, eviction, and background processing
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getEmbeddingCache,
  resetEmbeddingCacheForTesting,
  CacheStrategy,
  CacheConfig,
  GenerationProgress,
  CacheStats,
} from "./embedding-cache";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { encryptData, decryptData } from "../encryption";
import { Float32Array } from "./clip-embeddings";

// Mock dependencies
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    getAllKeys: vi.fn(),
    multiRemove: vi.fn(),
  },
}));

vi.mock("../encryption", () => ({
  encryptData: vi.fn(),
  decryptData: vi.fn(),
  XCHACHA20_KEYBYTES: 32,
}));

vi.mock("./clip-embeddings", () => ({
  getCLIPEmbeddingsService: vi.fn(() => ({
    generateTextEmbeddings: vi.fn(),
    generateImageEmbeddings: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
  })),
  Float32Array: typeof Float32Array,
}));

// Mock implementation
const mockAsyncStorage = AsyncStorage as any;
const mockEncryptData = encryptData as any;
const mockDecryptData = decryptData as any;

describe("EmbeddingCache", () => {
  let cache: ReturnType<typeof getEmbeddingCache>;
  const testConfig: Partial<CacheConfig> = {
    maxMemoryEntries: 10,
    maxDiskEntries: 20,
    maxMemoryMB: 1,
    maxDiskCacheMB: 2,
    encryptionEnabled: false, // Disable for most tests
    backgroundGeneration: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetEmbeddingCacheForTesting();
    cache = getEmbeddingCache(testConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize with default configuration", () => {
      const defaultCache = getEmbeddingCache();
      const config = defaultCache.getConfig();

      expect(config.strategy).toBe("hybrid");
      expect(config.maxMemoryEntries).toBe(1000);
      expect(config.maxDiskCacheMB).toBe(1024);
      expect(config.encryptionEnabled).toBe(true);
    });

    it("should initialize with custom configuration", () => {
      const config = cache.getConfig();

      expect(config.maxMemoryEntries).toBe(10);
      expect(config.maxDiskEntries).toBe(20);
      expect(config.encryptionEnabled).toBe(false);
    });

    it("should load configuration from storage", async () => {
      const storedConfig = {
        strategy: "memory-only",
        maxMemoryEntries: 50,
        encryptionEnabled: true,
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(storedConfig));

      resetEmbeddingCacheForTesting();
      const newCache = getEmbeddingCache();

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 0));

      const config = newCache.getConfig();
      expect(config.strategy).toBe("memory-only");
      expect(config.maxMemoryEntries).toBe(50);
      expect(config.encryptionEnabled).toBe(true);
    });
  });

  describe("Memory Cache Operations", () => {
    it("should store and retrieve embeddings from memory", async () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3]);
      const id = "test-embedding-1";

      await cache.put(id, "text", embedding);
      const retrieved = await cache.get(id);

      expect(retrieved).not.toBeNull();
      expect(retrieved).toEqual(embedding);
    });

    it("should return null for non-existent embeddings", async () => {
      const retrieved = await cache.get("non-existent-id");
      expect(retrieved).toBeNull();
    });

    it("should update access statistics on retrieval", async () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3]);
      const id = "test-embedding-1";

      await cache.put(id, "text", embedding);

      // First access
      await cache.get(id);
      let stats = await cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);

      // Second access
      await cache.get(id);
      stats = await cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(0);

      // Miss
      await cache.get("non-existent");
      stats = await cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it("should evict from memory when capacity exceeded", async () => {
      const config = cache.getConfig();

      // Fill memory cache to capacity
      for (let i = 0; i < config.maxMemoryEntries; i++) {
        const embedding = new Float32Array([i * 0.1]);
        await cache.put(`id-${i}`, "text", embedding);
      }

      let stats = await cache.getStats();
      expect(stats.memoryEntries).toBe(config.maxMemoryEntries);

      // Add one more to trigger eviction
      const extraEmbedding = new Float32Array([0.99]);
      await cache.put("extra", "text", extraEmbedding);

      stats = await cache.getStats();
      expect(stats.memoryEntries).toBe(config.maxMemoryEntries);
      expect(stats.evictionCount).toBeGreaterThan(0);
    });

    it("should use LRU eviction policy", async () => {
      const config = cache.getConfig();

      // Fill cache
      for (let i = 0; i < config.maxMemoryEntries; i++) {
        const embedding = new Float32Array([i * 0.1]);
        await cache.put(`id-${i}`, "text", embedding);
      }

      // Access first entry to make it most recently used
      await cache.get("id-0");

      // Add entry to trigger eviction
      const extraEmbedding = new Float32Array([0.99]);
      await cache.put("extra", "text", extraEmbedding);

      // id-0 should still be in cache (most recently used)
      const retrieved = await cache.get("id-0");
      expect(retrieved).not.toBeNull();

      // Some other entry should have been evicted
      const stats = await cache.getStats();
      expect(stats.memoryEntries).toBe(config.maxMemoryEntries);
    });
  });

  describe("Disk Cache Operations", () => {
    beforeEach(() => {
      // Enable disk cache for these tests
      resetEmbeddingCacheForTesting();
      cache = getEmbeddingCache({
        ...testConfig,
        strategy: "disk-priority",
        encryptionEnabled: false,
      });
    });

    it("should store and retrieve embeddings from disk", async () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3]);
      const id = "test-disk-embedding";

      await cache.put(id, "image", embedding);

      // Clear memory cache to force disk retrieval
      await cache.cleanup();
      resetEmbeddingCacheForTesting();
      cache = getEmbeddingCache({
        ...testConfig,
        strategy: "disk-priority",
        encryptionEnabled: false,
      });

      const retrieved = await cache.get(id);
      expect(retrieved).toEqual(embedding);
    });

    it("should handle disk storage errors gracefully", async () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3]);
      const id = "test-error";

      mockAsyncStorage.setItem.mockRejectedValue(new Error("Storage error"));

      // Should not throw, but should handle error gracefully
      await expect(cache.put(id, "text", embedding)).resolves.not.toThrow();
    });

    it("should respect disk cache size limits", async () => {
      const config = cache.getConfig();

      // Mock disk keys to simulate full disk cache
      const diskKeys = Array.from(
        { length: config.maxDiskEntries + 5 },
        (_, i) => `@embedding_cache_disk-${i}`,
      );
      mockAsyncStorage.getAllKeys.mockResolvedValue(diskKeys);

      // Mock individual item retrieval to simulate eviction
      let callCount = 0;
      mockAsyncStorage.getItem.mockImplementation(async (key) => {
        callCount++;
        if (callCount <= config.maxDiskEntries) {
          return JSON.stringify({
            id: key,
            embedding: [0.1, 0.2, 0.3],
            lastAccessed: Date.now() - callCount * 1000,
            size: 100,
          });
        }
        return null;
      });

      await cache.ensureCacheSizeLimits();

      // Should have removed some items due to size limit
      expect(mockAsyncStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe("Encryption", () => {
    beforeEach(() => {
      resetEmbeddingCacheForTesting();
      cache = getEmbeddingCache({
        ...testConfig,
        encryptionEnabled: true,
      });
    });

    it("should generate and store encryption key", async () => {
      // Mock no existing key
      mockAsyncStorage.getItem.mockResolvedValue(null);

      resetEmbeddingCacheForTesting();
      const encryptedCache = getEmbeddingCache({
        ...testConfig,
        encryptionEnabled: true,
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "@embedding_cache_key",
        expect.stringMatching(/^[a-f0-9]{64}$/), // 32 bytes = 64 hex chars
      );
    });

    it("should load existing encryption key", async () => {
      const existingKey = "a".repeat(64); // 32 bytes in hex
      mockAsyncStorage.getItem.mockResolvedValue(existingKey);

      resetEmbeddingCacheForTesting();
      const encryptedCache = getEmbeddingCache({
        ...testConfig,
        encryptionEnabled: true,
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockAsyncStorage.setItem).not.toHaveBeenCalledWith(
        "@embedding_cache_key",
        expect.any(String),
      );
    });

    it("should encrypt data before storing to disk", async () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3]);
      const id = "encrypted-test";

      mockEncryptData.mockResolvedValue(Buffer.from("encrypted-data"));

      await cache.put(id, "text", embedding);

      expect(mockEncryptData).toHaveBeenCalled();
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        `@embedding_cache_${id}`,
        expect.stringMatching(/^[A-Za-z0-9+/=]+$/), // Base64
      );
    });

    it("should decrypt data when retrieving from disk", async () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3]);
      const id = "decrypt-test";

      // Mock encrypted data
      mockAsyncStorage.getItem.mockResolvedValue("ZW5jcnlwdGVkLWRhdGE="); // "encrypted-data" in base64
      mockDecryptData.mockResolvedValue(
        JSON.stringify({
          id,
          embedding: [0.1, 0.2, 0.3],
          lastAccessed: Date.now(),
          size: 12,
        }),
      );

      // Clear memory to force disk retrieval
      await cache.cleanup();

      const retrieved = await cache.get(id);

      expect(mockDecryptData).toHaveBeenCalled();
      expect(retrieved).toEqual(embedding);
    });
  });

  describe("Progressive Generation", () => {
    beforeEach(() => {
      const mockClipService =
        require("./clip-embeddings").getCLIPEmbeddingsService();
      mockClipService.generateTextEmbeddings.mockResolvedValue([
        new Float32Array([0.1, 0.2, 0.3]),
      ]);
      mockClipService.generateImageEmbeddings.mockResolvedValue([
        new Float32Array([0.4, 0.5, 0.6]),
      ]);
    });

    it("should generate and cache embedding on demand", async () => {
      const id = "progressive-test";
      const input = "test query";

      const embedding = await cache.generateAndCache(id, "text", input, "high");

      expect(embedding).toBeInstanceOf(Float32Array);
      expect(embedding.length).toBe(3);

      // Check progress
      const progress = await cache.getGenerationProgress(id);
      expect(progress?.stage).toBe("completed");
      expect(progress?.progress).toBe(100);
    });

    it("should return cached embedding if available", async () => {
      const id = "cached-test";
      const embedding = new Float32Array([0.1, 0.2, 0.3]);
      const input = "test query";

      // Pre-cache the embedding
      await cache.put(id, "text", embedding);

      // Generate should return cached version
      const result = await cache.generateAndCache(id, "text", input, "high");

      expect(result).toEqual(embedding);

      // Should not have called generation service
      const mockClipService =
        require("./clip-embeddings").getCLIPEmbeddingsService();
      expect(mockClipService.generateTextEmbeddings).not.toHaveBeenCalled();
    });

    it("should handle generation errors gracefully", async () => {
      const id = "error-test";
      const input = "test query";

      const mockClipService =
        require("./clip-embeddings").getCLIPEmbeddingsService();
      mockClipService.generateTextEmbeddings.mockRejectedValue(
        new Error("Generation failed"),
      );

      await expect(
        cache.generateAndCache(id, "text", input, "high"),
      ).rejects.toThrow("Generation failed");

      const progress = await cache.getGenerationProgress(id);
      expect(progress?.stage).toBe("error");
      expect(progress?.error).toBe("Generation failed");
    });

    it("should timeout for long-running generation", async () => {
      const id = "timeout-test";
      const input = "test query";

      // Mock slow generation
      const mockClipService =
        require("./clip-embeddings").getCLIPEmbeddingsService();
      mockClipService.generateTextEmbeddings.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000)),
      );

      await expect(
        cache.generateAndCache(id, "text", input, "medium"),
      ).rejects.toThrow("timeout");
    });
  });

  describe("Background Processing", () => {
    beforeEach(() => {
      resetEmbeddingCacheForTesting();
      cache = getEmbeddingCache({
        ...testConfig,
        backgroundGeneration: true,
      });
    });

    it("should queue low priority generation for background", async () => {
      const id = "background-test";
      const input = "test query";

      // Mock immediate completion
      const mockClipService =
        require("./clip-embeddings").getCLIPEmbeddingsService();
      mockClipService.generateTextEmbeddings.mockResolvedValue([
        new Float32Array([0.1, 0.2, 0.3]),
      ]);

      // Start background generation (low priority)
      const promise = cache.generateAndCache(id, "text", input, "low");

      // Should be queued immediately
      const progress = await cache.getGenerationProgress(id);
      expect(progress?.stage).toBe("queued");

      // Wait for completion
      const result = await promise;
      expect(result).toBeInstanceOf(Float32Array);
    });

    it("should process queue in FIFO order", async () => {
      const mockClipService =
        require("./clip-embeddings").getCLIPEmbeddingsService();
      const processedOrder: string[] = [];

      mockClipService.generateTextEmbeddings.mockImplementation(async () => {
        // Simulate processing time
        await new Promise((resolve) => setTimeout(resolve, 10));
        return [new Float32Array([0.1])];
      });

      // Queue multiple items
      const promises = [];
      for (let i = 0; i < 3; i++) {
        const id = `queue-test-${i}`;
        promises.push(
          cache
            .generateAndCache(id, "text", `query-${i}`, "low")
            .then(() => processedOrder.push(id)),
        );
      }

      await Promise.all(promises);

      expect(processedOrder).toEqual([
        "queue-test-0",
        "queue-test-1",
        "queue-test-2",
      ]);
    });
  });

  describe("Cache Strategies", () => {
    it("should use memory-only strategy correctly", async () => {
      resetEmbeddingCacheForTesting();
      const memoryCache = getEmbeddingCache({
        ...testConfig,
        strategy: "memory-only",
      });

      const embedding = new Float32Array([0.1, 0.2, 0.3]);
      const id = "memory-only-test";

      await memoryCache.put(id, "text", embedding);

      // Should not attempt disk storage
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it("should use disk-priority strategy correctly", async () => {
      resetEmbeddingCacheForTesting();
      const diskCache = getEmbeddingCache({
        ...testConfig,
        strategy: "disk-priority",
      });

      const embedding = new Float32Array([0.1, 0.2, 0.3]);
      const id = "disk-priority-test";

      await diskCache.put(id, "text", embedding);

      // Should attempt disk storage
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });

    it("should use progressive strategy with background generation", async () => {
      resetEmbeddingCacheForTesting();
      const progressiveCache = getEmbeddingCache({
        ...testConfig,
        strategy: "progressive",
        backgroundGeneration: true,
      });

      const config = progressiveCache.getConfig();
      expect(config.strategy).toBe("progressive");
      expect(config.backgroundGeneration).toBe(true);
    });
  });

  describe("Statistics and Monitoring", () => {
    it("should provide accurate cache statistics", async () => {
      // Add some entries
      for (let i = 0; i < 5; i++) {
        const embedding = new Float32Array([i * 0.1]);
        await cache.put(`stat-test-${i}`, "text", embedding);
      }

      const stats = await cache.getStats();

      expect(stats.memoryEntries).toBe(5);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeLessThanOrEqual(1);
      expect(stats.missRate).toBeGreaterThanOrEqual(0);
      expect(stats.missRate).toBeLessThanOrEqual(1);
      expect(stats.hitRate + stats.missRate).toBeCloseTo(1, 2);
    });

    it("should track eviction statistics", async () => {
      const config = cache.getConfig();

      // Fill cache to trigger evictions
      for (let i = 0; i < config.maxMemoryEntries + 5; i++) {
        const embedding = new Float32Array([i * 0.01]);
        await cache.put(`evict-test-${i}`, "text", embedding);
      }

      const stats = await cache.getStats();
      expect(stats.evictionCount).toBeGreaterThan(0);
    });

    it("should calculate encryption overhead", async () => {
      resetEmbeddingCacheForTesting();
      const encryptedCache = getEmbeddingCache({
        ...testConfig,
        encryptionEnabled: true,
      });

      const stats = await encryptedCache.getStats();
      expect(stats.encryptionOverhead).toBeGreaterThan(0);
    });
  });

  describe("Configuration Management", () => {
    it("should update configuration dynamically", async () => {
      const newConfig = {
        maxMemoryEntries: 20,
        encryptionEnabled: true,
      };

      await cache.updateConfig(newConfig);

      const config = cache.getConfig();
      expect(config.maxMemoryEntries).toBe(20);
      expect(config.encryptionEnabled).toBe(true);

      // Should save to storage
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "@embedding_cache_config",
        expect.stringContaining("maxMemoryEntries"),
      );
    });

    it("should apply new cache limits after config update", async () => {
      await cache.updateConfig({ maxMemoryEntries: 3 });

      // Add more entries than new limit
      for (let i = 0; i < 5; i++) {
        const embedding = new Float32Array([i * 0.1]);
        await cache.put(`config-test-${i}`, "text", embedding);
      }

      const stats = await cache.getStats();
      expect(stats.memoryEntries).toBeLessThanOrEqual(3);
    });
  });

  describe("Cache Maintenance", () => {
    it("should clear all cache data", async () => {
      // Add some data
      for (let i = 0; i < 3; i++) {
        const embedding = new Float32Array([i * 0.1]);
        await cache.put(`clear-test-${i}`, "text", embedding);
      }

      await cache.clearCache();

      const stats = await cache.getStats();
      expect(stats.memoryEntries).toBe(0);
      expect(stats.diskEntries).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it("should cleanup resources properly", async () => {
      await cache.cleanup();

      // Should stop background processing
      const progress = await cache.getAllGenerationProgress();
      expect(progress).toEqual([]);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle corrupted disk cache entries", async () => {
      const id = "corrupted-test";

      // Mock corrupted data
      mockAsyncStorage.getItem.mockResolvedValue("invalid-json-data");

      const retrieved = await cache.get(id);
      expect(retrieved).toBeNull();
    });

    it("should handle embedding size calculation", async () => {
      const embedding = new Float32Array(1000); // Large embedding
      const id = "size-test";

      await cache.put(id, "text", embedding);

      const stats = await cache.getStats();
      expect(stats.memoryUsageMB).toBeGreaterThan(0);
    });

    it("should handle concurrent access safely", async () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3]);
      const id = "concurrent-test";

      // Multiple concurrent operations
      const promises = [
        cache.put(id, "text", embedding),
        cache.get(id),
        cache.put(id, "image", embedding),
        cache.get(id),
      ];

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it("should validate cache configuration", async () => {
      // Invalid configuration should be handled gracefully
      const invalidCache = getEmbeddingCache({
        maxMemoryEntries: -1, // Invalid
        maxMemoryMB: 0, // Invalid
      });

      const config = invalidCache.getConfig();
      expect(config.maxMemoryEntries).toBeGreaterThanOrEqual(0);
      expect(config.maxMemoryMB).toBeGreaterThanOrEqual(0);
    });
  });
});
