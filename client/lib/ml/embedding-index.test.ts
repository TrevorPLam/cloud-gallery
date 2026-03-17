// AI-META-BEGIN
// AI-META: Comprehensive tests for embedding index with encryption and search validation
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: imported by test runner and CI pipeline
// DEPENDENCIES: embedding-index.ts, clip-embeddings.ts, vitest, AsyncStorage mocks
// DANGER: Search tests require proper mocking to avoid actual storage operations
// CHANGE-SAFETY: Add new test cases by extending describe blocks
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getEmbeddingIndex,
  resetEmbeddingIndexForTesting,
  EmbeddingIndex,
  SemanticSearchQuery,
  EmbeddingIndexEntry,
} from "./embedding-index";
import {
  getCLIPEmbeddingsService,
  resetCLIPEmbeddingsServiceForTesting,
} from "./clip-embeddings";

// Mock dependencies
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock("../search-index", () => ({
  initializeSearchIndex: vi.fn(() => ({
    metadata: { version: "1.0", createdAt: Date.now() },
    invertedIndex: new Map(),
    documentIndex: new Map(),
    termCache: new Map(),
  })),
  addDocumentToIndex: vi.fn(),
  searchEncryptedIndex: vi.fn(),
  getIndexStats: vi.fn(() => ({
    totalDocuments: 0,
    totalTerms: 0,
    indexSize: 0,
    averageQueryTime: 0,
  })),
}));

vi.mock("../encryption", () => ({
  encryptData: vi.fn((data, key) => `encrypted_${data}_${key}`),
  decryptData: vi.fn((data, key) => data.replace(`encrypted_`, "").replace(`_${key}`, "")),
}));

vi.mock("./clip-embeddings", () => ({
  getCLIPEmbeddingsService: vi.fn(() => ({
    generateTextEmbeddings: vi.fn(),
    generateImageEmbeddings: vi.fn(),
    cosineSimilarity: vi.fn(),
    euclideanDistance: vi.fn(),
    isReady: vi.fn(() => true),
  })),
  resetCLIPEmbeddingsServiceForTesting: vi.fn(),
}));

// Mock crypto for encryption key generation
Object.defineProperty(global, "crypto", {
  value: {
    getRandomValues: vi.fn(() => new Uint8Array(32).fill(1)),
  },
  writable: true,
});

describe("EmbeddingIndex", () => {
  let embeddingIndex: EmbeddingIndex;
  let mockClipService: any;

  beforeEach(async () => {
    // Reset singletons
    resetEmbeddingIndexForTesting();
    resetCLIPEmbeddingsServiceForTesting();
    
    // Clear AsyncStorage mocks
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    vi.mocked(AsyncStorage.setItem).mockResolvedValue();
    
    // Create new instance
    embeddingIndex = getEmbeddingIndex();
    mockClipService = getCLIPEmbeddingsService();
    
    // Initialize
    await embeddingIndex.initialize();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should create singleton instance", () => {
      const index1 = getEmbeddingIndex();
      const index2 = getEmbeddingIndex();
      expect(index1).toBe(index2);
    });

    it("should initialize with default configuration", async () => {
      const config = embeddingIndex.getConfig();
      
      expect(config.strategy).toBe("hybrid");
      expect(config.embeddingDimension).toBe(512);
      expect(config.similarityThreshold).toBe(0.1);
      expect(config.maxResults).toBe(50);
      expect(config.encryptionEnabled).toBe(true);
      expect(config.cacheSize).toBe(1000);
      expect(config.backgroundIndexing).toBe(true);
    });

    it("should accept custom configuration", () => {
      const customIndex = new EmbeddingIndex({
        strategy: "exact-match",
        embeddingDimension: 256,
        similarityThreshold: 0.2,
        maxResults: 25,
        encryptionEnabled: false,
        cacheSize: 500,
        backgroundIndexing: false,
      });

      const config = customIndex.getConfig();
      
      expect(config.strategy).toBe("exact-match");
      expect(config.embeddingDimension).toBe(256);
      expect(config.similarityThreshold).toBe(0.2);
      expect(config.maxResults).toBe(25);
      expect(config.encryptionEnabled).toBe(false);
      expect(config.cacheSize).toBe(500);
      expect(config.backgroundIndexing).toBe(false);
    });

    it("should load configuration from storage", async () => {
      const storedConfig = JSON.stringify({
        strategy: "approximate",
        similarityThreshold: 0.15,
      });
      
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@embedding_index_config") {
          return Promise.resolve(storedConfig);
        }
        return Promise.resolve(null);
      });

      const newIndex = new EmbeddingIndex();
      await newIndex.initialize();
      
      const config = newIndex.getConfig();
      expect(config.strategy).toBe("approximate");
      expect(config.similarityThreshold).toBe(0.15);
    });

    it("should generate encryption key when enabled", async () => {
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@embedding_index_key") {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });

      const newIndex = new EmbeddingIndex({ encryptionEnabled: true });
      await newIndex.initialize();
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@embedding_index_key",
        expect.any(String)
      );
    });

    it("should use existing encryption key", async () => {
      const existingKey = "existing-encryption-key";
      
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@embedding_index_key") {
          return Promise.resolve(existingKey);
        }
        return Promise.resolve(null);
      });

      const newIndex = new EmbeddingIndex({ encryptionEnabled: true });
      await newIndex.initialize();
      
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
        "@embedding_index_key",
        expect.any(String)
      );
    });
  });

  describe("Embedding Management", () => {
    it("should add embedding successfully", async () => {
      const embedding = new Float32Array(512).fill(0.1);
      const metadata = {
        uri: "file://test.jpg",
        width: 1024,
        height: 768,
        createdAt: Date.now(),
        tags: ["beach", "sunset"],
        location: "California",
      };

      await embeddingIndex.addEmbedding("test-id", embedding, metadata);
      
      const retrieved = await embeddingIndex.getEmbedding("test-id");
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe("test-id");
      expect(retrieved!.embedding).toEqual(embedding);
      expect(retrieved!.metadata).toEqual(metadata);
      expect(retrieved!.encrypted).toBe(true);
      expect(retrieved!.checksum).toBeDefined();
    });

    it("should validate embedding dimensions", async () => {
      const wrongDimensionEmbedding = new Float32Array(256).fill(0.1);
      const metadata = {
        uri: "file://test.jpg",
        width: 1024,
        height: 768,
        createdAt: Date.now(),
      };

      await expect(
        embeddingIndex.addEmbedding("test-id", wrongDimensionEmbedding, metadata)
      ).rejects.toThrow("Embedding dimension mismatch: expected 512, got 256");
    });

    it("should manage memory cache correctly", async () => {
      const embedding = new Float32Array(512).fill(0.1);
      const metadata = {
        uri: "file://test.jpg",
        width: 1024,
        height: 768,
        createdAt: Date.now(),
      };

      // Add embeddings up to cache limit
      for (let i = 0; i < 1005; i++) {
        await embeddingIndex.addEmbedding(`test-id-${i}`, embedding, {
          ...metadata,
          uri: `file://test-${i}.jpg`,
        });
      }

      // Check that oldest entries are evicted
      const oldest = await embeddingIndex.getEmbedding("test-id-0");
      expect(oldest).toBeNull();

      // Check that newest entries are still cached
      const newest = await embeddingIndex.getEmbedding("test-id-1004");
      expect(newest).toBeDefined();
    });

    it("should remove embedding successfully", async () => {
      const embedding = new Float32Array(512).fill(0.1);
      const metadata = {
        uri: "file://test.jpg",
        width: 1024,
        height: 768,
        createdAt: Date.now(),
      };

      await embeddingIndex.addEmbedding("test-id", embedding, metadata);
      await embeddingIndex.removeEmbedding("test-id");
      
      const retrieved = await embeddingIndex.getEmbedding("test-id");
      expect(retrieved).toBeNull();
    });

    it("should clear index successfully", async () => {
      const embedding = new Float32Array(512).fill(0.1);
      const metadata = {
        uri: "file://test.jpg",
        width: 1024,
        height: 768,
        createdAt: Date.now(),
      };

      await embeddingIndex.addEmbedding("test-id-1", embedding, metadata);
      await embeddingIndex.addEmbedding("test-id-2", embedding, metadata);
      await embeddingIndex.clearIndex();
      
      const retrieved1 = await embeddingIndex.getEmbedding("test-id-1");
      const retrieved2 = await embeddingIndex.getEmbedding("test-id-2");
      
      expect(retrieved1).toBeNull();
      expect(retrieved2).toBeNull();
    });
  });

  describe("Semantic Search", () => {
    beforeEach(async () => {
      // Add test embeddings
      const embeddings = [
        new Float32Array([1, 0, 0, 0, 0]), // High similarity to "red"
        new Float32Array([0, 1, 0, 0, 0]), // High similarity to "green"  
        new Float32Array([0, 0, 1, 0, 0]), // High similarity to "blue"
        new Float32Array([0.5, 0.5, 0, 0, 0]), // Medium similarity to "red green"
      ];

      for (let i = 0; i < embeddings.length; i++) {
        const fullEmbedding = new Float32Array(512).fill(0);
        fullEmbedding.set(embeddings[i]);
        
        await embeddingIndex.addEmbedding(`test-id-${i}`, fullEmbedding, {
          uri: `file://test-${i}.jpg`,
          width: 1024,
          height: 768,
          createdAt: Date.now() - i * 1000,
          tags: [`tag-${i}`],
          location: `location-${i}`,
        });
      }
    });

    it("should perform text-based semantic search", async () => {
      const queryEmbedding = new Float32Array([1, 0, 0, 0, 0]);
      vi.mocked(mockClipService.generateTextEmbeddings).mockResolvedValue([
        new Float32Array(512).fill(0).set(queryEmbedding),
      ]);

      vi.mocked(mockClipService.cosineSimilarity).mockImplementation((a, b) => {
        // Simple similarity calculation for test
        const similarity = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        return similarity;
      });

      vi.mocked(mockClipService.euclideanDistance).mockReturnValue(0.5);

      const query: SemanticSearchQuery = {
        text: "red",
        limit: 10,
        threshold: 0.1,
      };

      const results = await embeddingIndex.semanticSearch(query);

      expect(results).toHaveLength(2); // Should find embeddings with similarity > 0.1
      expect(results[0].similarity.score).toBeGreaterThan(results[1].similarity.score);
      expect(results[0].similarity.rank).toBe(1);
      expect(results[1].similarity.rank).toBe(2);
    });

    it("should perform image-based semantic search", async () => {
      const queryEmbedding = new Float32Array([0, 1, 0, 0, 0]);
      vi.mocked(mockClipService.generateImageEmbeddings).mockResolvedValue([
        new Float32Array(512).fill(0).set(queryEmbedding),
      ]);

      vi.mocked(mockClipService.cosineSimilarity).mockImplementation((a, b) => {
        const similarity = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        return similarity;
      });

      vi.mocked(mockClipService.euclideanDistance).mockReturnValue(0.3);

      const query: SemanticSearchQuery = {
        imageUri: "file://query-image.jpg",
        limit: 5,
        threshold: 0.1,
      };

      const results = await embeddingIndex.semanticSearch(query);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("test-id-1"); // Should match green embedding
    });

    it("should perform embedding-based semantic search", async () => {
      const queryEmbedding = new Float32Array([0, 0, 1, 0, 0]);

      vi.mocked(mockClipService.cosineSimilarity).mockImplementation((a, b) => {
        const similarity = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        return similarity;
      });

      vi.mocked(mockClipService.euclideanDistance).mockReturnValue(0.2);

      const query: SemanticSearchQuery = {
        embedding: new Float32Array(512).fill(0).set(queryEmbedding),
        limit: 3,
        threshold: 0.1,
      };

      const results = await embeddingIndex.semanticSearch(query);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("test-id-2"); // Should match blue embedding
    });

    it("should respect similarity threshold", async () => {
      const queryEmbedding = new Float32Array([1, 0, 0, 0, 0]);

      vi.mocked(mockClipService.cosineSimilarity).mockReturnValue(0.05); // Below threshold
      vi.mocked(mockClipService.euclideanDistance).mockReturnValue(1.0);

      const query: SemanticSearchQuery = {
        text: "red",
        limit: 10,
        threshold: 0.1, // Higher than similarity
      };

      const results = await embeddingIndex.semanticSearch(query);

      expect(results).toHaveLength(0);
    });

    it("should respect result limit", async () => {
      const queryEmbedding = new Float32Array([0.5, 0.5, 0, 0, 0]);

      vi.mocked(mockClipService.cosineSimilarity).mockReturnValue(0.8); // High similarity
      vi.mocked(mockClipService.euclideanDistance).mockReturnValue(0.1);

      const query: SemanticSearchQuery = {
        text: "red green",
        limit: 2,
        threshold: 0.1,
      };

      const results = await embeddingIndex.semanticSearch(query);

      expect(results).toHaveLength(2);
    });

    it("should apply date range filters", async () => {
      const queryEmbedding = new Float32Array([1, 0, 0, 0, 0]);

      vi.mocked(mockClipService.cosineSimilarity).mockReturnValue(0.8);
      vi.mocked(mockClipService.euclideanDistance).mockReturnValue(0.1);

      const query: SemanticSearchQuery = {
        text: "red",
        limit: 10,
        threshold: 0.1,
        filters: {
          dateRange: {
            start: Date.now() - 2000,
            end: Date.now() - 500,
          },
        },
      };

      const results = await embeddingIndex.semanticSearch(query);

      // Should only include results within date range
      expect(results.length).toBeLessThanOrEqual(2);
      for (const result of results) {
        expect(result.metadata.createdAt).toBeGreaterThanOrEqual(query.filters!.dateRange!.start);
        expect(result.metadata.createdAt).toBeLessThanOrEqual(query.filters!.dateRange!.end);
      }
    });

    it("should apply tags filters", async () => {
      const queryEmbedding = new Float32Array([1, 0, 0, 0, 0]);

      vi.mocked(mockClipService.cosineSimilarity).mockReturnValue(0.8);
      vi.mocked(mockClipService.euclideanDistance).mockReturnValue(0.1);

      const query: SemanticSearchQuery = {
        text: "red",
        limit: 10,
        threshold: 0.1,
        filters: {
          tags: ["tag-0", "tag-2"],
        },
      };

      const results = await embeddingIndex.semanticSearch(query);

      // Should only include results with matching tags
      for (const result of results) {
        expect(result.metadata.tags).toEqual(
          expect.arrayContaining(["tag-0", "tag-2"])
        );
      }
    });

    it("should apply location filters", async () => {
      const queryEmbedding = new Float32Array([1, 0, 0, 0, 0]);

      vi.mocked(mockClipService.cosineSimilarity).mockReturnValue(0.8);
      vi.mocked(mockClipService.euclideanDistance).mockReturnValue(0.1);

      const query: SemanticSearchQuery = {
        text: "red",
        limit: 10,
        threshold: 0.1,
        filters: {
          location: "location-1",
        },
      };

      const results = await embeddingIndex.semanticSearch(query);

      // Should only include results with matching location
      for (const result of results) {
        expect(result.metadata.location).toBe("location-1");
      }
    });

    it("should handle invalid query", async () => {
      const query: SemanticSearchQuery = {};

      await expect(embeddingIndex.semanticSearch(query)).rejects.toThrow(
        "Query must contain text, imageUri, or embedding"
      );
    });
  });

  describe("Statistics and Metadata", () => {
    it("should return correct statistics", async () => {
      const embedding = new Float32Array(512).fill(0.1);
      const metadata = {
        uri: "file://test.jpg",
        width: 1024,
        height: 768,
        createdAt: Date.now(),
      };

      // Add some embeddings
      for (let i = 0; i < 10; i++) {
        await embeddingIndex.addEmbedding(`test-id-${i}`, embedding, {
          ...metadata,
          uri: `file://test-${i}.jpg`,
        });
      }

      const stats = await embeddingIndex.getStats();

      expect(stats.totalEmbeddings).toBe(10);
      expect(stats.memoryUsageMB).toBeGreaterThan(0);
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(stats.encryptionOverhead).toBe(0.2); // 20% overhead estimate
    });

    it("should update configuration", async () => {
      const newConfig = {
        similarityThreshold: 0.2,
        maxResults: 25,
        cacheSize: 500,
      };

      await embeddingIndex.updateConfig(newConfig);

      const config = embeddingIndex.getConfig();
      expect(config.similarityThreshold).toBe(0.2);
      expect(config.maxResults).toBe(25);
      expect(config.cacheSize).toBe(500);
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@embedding_index_config",
        JSON.stringify(newConfig)
      );
    });
  });

  describe("Cleanup", () => {
    it("should cleanup resources correctly", async () => {
      const embedding = new Float32Array(512).fill(0.1);
      const metadata = {
        uri: "file://test.jpg",
        width: 1024,
        height: 768,
        createdAt: Date.now(),
      };

      await embeddingIndex.addEmbedding("test-id", embedding, metadata);
      await embeddingIndex.cleanup();

      // Check that configuration is saved
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@embedding_index_config",
        expect.any(String)
      );

      // Check that cache is cleared
      const retrieved = await embeddingIndex.getEmbedding("test-id");
      expect(retrieved).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should handle embedding addition errors", async () => {
      const wrongDimensionEmbedding = new Float32Array(256).fill(0.1);
      const metadata = {
        uri: "file://test.jpg",
        width: 1024,
        height: 768,
        createdAt: Date.now(),
      };

      await expect(
        embeddingIndex.addEmbedding("test-id", wrongDimensionEmbedding, metadata)
      ).rejects.toThrow("Embedding dimension mismatch");
    });

    it("should handle search service errors", async () => {
      vi.mocked(mockClipService.generateTextEmbeddings).mockRejectedValue(
        new Error("Service error")
      );

      const query: SemanticSearchQuery = {
        text: "test",
        limit: 10,
        threshold: 0.1,
      };

      await expect(embeddingIndex.semanticSearch(query)).rejects.toThrow(
        "Service error"
      );
    });

    it("should handle initialization errors", async () => {
      vi.mocked(AsyncStorage.getItem).mockRejectedValue(new Error("Storage error"));

      const newIndex = new EmbeddingIndex();
      
      await expect(newIndex.initialize()).rejects.toThrow("Storage error");
    });
  });

  describe("Performance and Memory Management", () => {
    it("should handle large numbers of embeddings efficiently", async () => {
      const embedding = new Float32Array(512).fill(0.1);
      const metadata = {
        uri: "file://test.jpg",
        width: 1024,
        height: 768,
        createdAt: Date.now(),
      };

      // Add many embeddings
      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        await embeddingIndex.addEmbedding(`test-id-${i}`, embedding, {
          ...metadata,
          uri: `file://test-${i}.jpg`,
        });
      }
      const addTime = Date.now() - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(addTime).toBeLessThan(5000); // 5 seconds

      // Test search performance
      vi.mocked(mockClipService.cosineSimilarity).mockReturnValue(0.8);
      vi.mocked(mockClipService.euclideanDistance).mockReturnValue(0.1);

      const searchStartTime = Date.now();
      const results = await embeddingIndex.semanticSearch({
        text: "test",
        limit: 50,
        threshold: 0.1,
      });
      const searchTime = Date.now() - searchStartTime;

      expect(results.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(1000); // 1 second
    });

    it("should manage memory efficiently with cache eviction", async () => {
      const embedding = new Float32Array(512).fill(0.1);
      const metadata = {
        uri: "file://test.jpg",
        width: 1024,
        height: 768,
        createdAt: Date.now(),
      };

      // Create index with small cache
      const smallCacheIndex = new EmbeddingIndex({ cacheSize: 10 });
      await smallCacheIndex.initialize();

      // Add more embeddings than cache size
      for (let i = 0; i < 20; i++) {
        await smallCacheIndex.addEmbedding(`test-id-${i}`, embedding, {
          ...metadata,
          uri: `file://test-${i}.jpg`,
        });
      }

      // Check that cache size is maintained
      const stats = await smallCacheIndex.getStats();
      expect(stats.totalEmbeddings).toBeLessThanOrEqual(10);
    });
  });
});
